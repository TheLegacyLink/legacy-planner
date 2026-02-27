import { DEFAULT_CONFIG } from '../../../lib/runtimeConfig';
import { loadJsonFile, saveJsonFile, loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const SETTINGS_PATH = 'stores/lead-router-settings.json';
const EVENTS_PATH = 'stores/lead-router-events.json';
const CALLER_PATH = 'stores/caller-leads.json';
const SPONSORSHIP_PATH = 'stores/sponsorship-applications.json';

const DEFAULT_SETTINGS = {
  enabled: true,
  mode: 'random',
  maxPerDay: 2,
  maxPerWeek: 14,
  maxPerMonth: 60,
  timezone: 'America/Chicago',
  overflowAgent: 'Kimora Link',
  agents: (DEFAULT_CONFIG?.agents || []).map((name) => ({
    name,
    active: true,
    paused: false,
    windowStart: '09:00',
    windowEnd: '21:00',
    capPerDay: null,
    capPerWeek: null,
    capPerMonth: null
  })),
  outboundWebhookUrl: '',
  outboundToken: '',
  outboundEnabled: false,
  slaEnabled: true,
  slaMinutes: 10,
  slaAction: 'reassign'
};

function clean(v = '') {
  return String(v || '').trim();
}

function normalizeName(v = '') {
  return clean(v).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizePhone(v = '') {
  return String(v || '').replace(/\D/g, '');
}

function nowIso() {
  return new Date().toISOString();
}

function cstDateParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = fmt.formatToParts(date);
  const pick = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day')
  };
}

function cstDateKey(date = new Date()) {
  const p = cstDateParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function cstMonthKey(date = new Date()) {
  const p = cstDateParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

function cstDateKeyFromIso(iso = '') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return cstDateKey(d);
}

function isoWeekKeyFromParts(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function cstWeekKey(date = new Date()) {
  const p = cstDateParts(date);
  return isoWeekKeyFromParts(p.year, p.month, p.day);
}

function cstMinuteOfDay(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const value = fmt.format(date);
  const [h, m] = value.split(':').map((x) => Number(x));
  return h * 60 + m;
}

function parseTimeToMin(v = '00:00') {
  const [h, m] = String(v || '00:00').split(':').map((x) => Number(x));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}


function minutesSince(iso = '') {
  if (!iso) return 0;
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return 0;
  return Math.floor((Date.now() - ts) / 60000);
}

function computeYesterdayCounts(settings, events, now = new Date()) {
  const yesterdayKey = cstDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const out = {};
  for (const a of settings.agents) out[a.name] = 0;
  for (const e of events) {
    if (e?.type !== 'assigned' || e?.dateKey !== yesterdayKey) continue;
    const owner = clean(e?.assignedTo || '');
    if (!owner) continue;
    out[owner] = Number(out[owner] || 0) + 1;
  }
  return out;
}

function getEligibleAgents(settings, counts, minute) {
  return settings.agents.filter((a) => {
    if (!a.active || a.paused) return false;
    const startMin = parseTimeToMin(a.windowStart || '00:00');
    const endMin = parseTimeToMin(a.windowEnd || '23:59');
    const inWindow = minute >= startMin && minute <= endMin;
    if (!inWindow) return false;

    const capDay = a.capPerDay == null ? Number(settings.maxPerDay || 0) : Number(a.capPerDay || 0);
    const capWeek = a.capPerWeek == null ? Number(settings.maxPerWeek || 0) : Number(a.capPerWeek || 0);
    const capMonth = a.capPerMonth == null ? Number(settings.maxPerMonth || 0) : Number(a.capPerMonth || 0);

    const count = counts[a.name] || { today: 0, week: 0, month: 0 };
    if (capDay > 0 && count.today >= capDay) return false;
    if (capWeek > 0 && count.week >= capWeek) return false;
    if (capMonth > 0 && count.month >= capMonth) return false;
    return true;
  });
}

function withDefaults(raw = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  const names = new Set([...(DEFAULT_SETTINGS.agents || []).map((a) => a.name), ...((raw?.agents || []).map((a) => a.name))]);
  merged.agents = Array.from(names).map((name) => {
    const current = (raw?.agents || []).find((a) => a.name === name);
    return {
      name,
      active: current?.active ?? true,
      paused: current?.paused ?? false,
      windowStart: clean(current?.windowStart || '09:00') || '09:00',
      windowEnd: clean(current?.windowEnd || '21:00') || '21:00',
      capPerDay: current?.capPerDay == null || current?.capPerDay === '' ? null : Number(current.capPerDay),
      capPerWeek: current?.capPerWeek == null || current?.capPerWeek === '' ? null : Number(current.capPerWeek),
      capPerMonth: current?.capPerMonth == null || current?.capPerMonth === '' ? null : Number(current.capPerMonth)
    };
  });
  return merged;
}

function parseLeadPayload(body = {}) {
  const candidate = body?.lead || body?.contact || body || {};
  const first = clean(candidate.firstName || candidate.first_name);
  const last = clean(candidate.lastName || candidate.last_name);
  const fullName = clean(candidate.name) || clean(`${first} ${last}`) || 'Unknown Lead';

  return {
    id: clean(candidate.id) || clean(candidate.contactId) || clean(candidate.contact_id) || `ghl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    externalId: clean(candidate.id || candidate.contactId || candidate.contact_id || ''),
    name: fullName,
    email: clean(candidate.email).toLowerCase(),
    phone: clean(candidate.phone || candidate.phoneNumber || candidate.phone_number),
    source: clean(candidate.source || body.source || 'GHL Webhook'),
    notes: clean(candidate.notes || body.notes || ''),
    licensedStatus: clean(candidate.licensedStatus || candidate.licensed_status || body.licensedStatus || body.licensed_status || 'Unknown') || 'Unknown'
  };
}

function validateToken(req, body = {}) {
  const required = process.env.GHL_INTAKE_TOKEN || '';
  if (!required) return true;
  const headerToken = req.headers.get('x-intake-token') || req.headers.get('x-ghl-token') || '';
  const bodyToken = clean(body?.token);
  return headerToken === required || bodyToken === required;
}

function randomPick(arr = []) {
  if (!arr.length) return null;
  const i = Math.floor(Math.random() * arr.length);
  return arr[i];
}

function pickBalancedEligible(eligible = [], counts = {}, events = [], yesterdayCounts = {}) {
  if (!eligible.length) return null;

  const recentAssigned = [...events]
    .filter((e) => e?.type === 'assigned' && clean(e?.assignedTo))
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

  const lastAssignedName = clean(recentAssigned[0]?.assignedTo || '');
  const lastAssignedAtByName = {};
  for (const e of recentAssigned) {
    const name = clean(e?.assignedTo || '');
    if (!name || lastAssignedAtByName[name]) continue;
    lastAssignedAtByName[name] = new Date(e.timestamp || 0).getTime() || 0;
  }

  const minToday = Math.min(...eligible.map((a) => Number(counts[a.name]?.today || 0)));
  let pool = eligible.filter((a) => Number(counts[a.name]?.today || 0) === minToday);

  // Carry-over fairness: among today's lowest, prioritize who got fewer leads yesterday
  if (pool.length > 1) {
    const minYesterday = Math.min(...pool.map((a) => Number(yesterdayCounts[a.name] || 0)));
    pool = pool.filter((a) => Number(yesterdayCounts[a.name] || 0) === minYesterday);
  }

  // Avoid same person twice in a row when alternatives exist
  if (pool.length > 1 && lastAssignedName) {
    const withoutLast = pool.filter((a) => a.name !== lastAssignedName);
    if (withoutLast.length) pool = withoutLast;
  }

  // Deterministic tie-break: least recently assigned, then name
  pool.sort((a, b) => {
    const aTs = Number(lastAssignedAtByName[a.name] || 0);
    const bTs = Number(lastAssignedAtByName[b.name] || 0);
    if (aTs !== bTs) return aTs - bTs;
    return a.name.localeCompare(b.name);
  });

  return pool[0] || null;
}

async function postOutboundAssignment(settings, payload) {
  const url = clean(settings?.outboundWebhookUrl || '');
  if (!url || !settings?.outboundEnabled) return;

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings?.outboundToken ? { 'x-router-token': settings.outboundToken } : {})
      },
      body: JSON.stringify(payload)
    });
  } catch {
    // best effort outbound dispatch
  }
}

function sponsorshipLookup(rows = []) {
  const map = new Map();
  for (const row of rows || []) {
    const status = clean(row?.status || 'Pending');
    const n = normalizeName(`${row?.firstName || ''} ${row?.lastName || ''}`);
    const e = clean(row?.email || '').toLowerCase();
    const p = normalizePhone(row?.phone || '');
    if (n) map.set(`n:${n}`, status);
    if (e) map.set(`e:${e}`, status);
    if (p) map.set(`p:${p}`, status);
  }
  return map;
}

function resolveSponsorshipStatus({ name = '', email = '', phone = '' } = {}, sponsorshipMap = new Map()) {
  const em = clean(email).toLowerCase();
  const ph = normalizePhone(phone);
  const n = normalizeName(name);

  // Strict priority: email match first (most reliable), then exact name.
  if (em && sponsorshipMap.has(`e:${em}`)) return sponsorshipMap.get(`e:${em}`) || '';
  if (n && sponsorshipMap.has(`n:${n}`)) return sponsorshipMap.get(`n:${n}`) || '';

  // Phone-only matches can cross-wire people; use only if name is blank/unknown.
  const unknownName = !n || n === 'UNKNOWN LEAD';
  if (unknownName && ph && sponsorshipMap.has(`p:${ph}`)) return sponsorshipMap.get(`p:${ph}`) || '';

  return '';
}

function enrichEvents(events = [], sponsorshipMap = new Map()) {
  return events.map((e) => {
    const sponsorshipStatus = resolveSponsorshipStatus({
      name: e?.name || '',
      email: e?.email || '',
      phone: e?.phone || ''
    }, sponsorshipMap);
    return { ...e, sponsorshipStatus };
  });
}

function buildAgentCounts(settings, events, keys) {
  const counts = {};
  for (const a of settings.agents) counts[a.name] = { today: 0, week: 0, month: 0 };

  for (const e of events) {
    if (e?.type !== 'assigned') continue;
    const owner = clean(e?.assignedTo || '');
    if (!counts[owner]) counts[owner] = { today: 0, week: 0, month: 0 };
    if (e?.dateKey === keys.dateKey) counts[owner].today += 1;
    if (e?.weekKey === keys.weekKey) counts[owner].week += 1;
    if (e?.monthKey === keys.monthKey) counts[owner].month += 1;
  }

  return counts;
}

function inferCalledAt(row = {}) {
  const direct = clean(row?.calledAt || '');
  if (direct) return direct;

  const stage = clean(row?.stage || '').toLowerCase();
  const impliesCall = ['called', 'connected', 'qualified', 'form completed', 'policy started', 'approved', 'onboarding started', 'moved forward'].includes(stage);
  if (!impliesCall) return '';

  const fallback = clean(row?.lastCallAttemptAt || row?.updatedAt || '');
  return fallback;
}

function inferDurationSec(row = {}) {
  const explicit = Number(row?.lastCallDurationSec || 0) || 0;
  if (explicit > 0) return explicit;
  const calledTs = new Date(inferCalledAt(row) || 0).getTime();
  const createdTs = new Date(row?.createdAt || row?.updatedAt || 0).getTime();
  if (!Number.isFinite(calledTs) || !Number.isFinite(createdTs)) return 0;
  const sec = Math.round((calledTs - createdTs) / 1000);
  // only trust as proxy if in a sane range
  return sec > 0 && sec <= 4 * 60 * 60 ? sec : 0;
}

function buildCalledLeadRows(leads = [], sponsorshipMap = new Map()) {
  return (leads || [])
    .map((r) => {
      const calledAt = inferCalledAt(r);
      if (!calledAt) return null;
      return {
        id: r.id,
        owner: clean(r.owner || '') || 'Unknown',
        name: clean(r.name || '') || 'Unknown Lead',
        email: clean(r.email || ''),
        phone: clean(r.phone || ''),
        calledAt,
        callResult: clean(r.callResult || ''),
        lastCallDurationSec: inferDurationSec(r),
        lastCallRecordingUrl: clean(r.lastCallRecordingUrl || ''),
        stage: clean(r.stage || ''),
        sponsorshipStatus: resolveSponsorshipStatus({ name: r?.name, email: r?.email, phone: r?.phone }, sponsorshipMap)
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.calledAt || 0).getTime() - new Date(a.calledAt || 0).getTime())
    .slice(0, 1000);
}

function buildCallMetrics(settings, leads = [], sponsorshipMap = new Map()) {
  const todayKey = cstDateKey();
  const byOwner = {};

  for (const a of settings.agents || []) {
    byOwner[a.name] = {
      assigned: 0,
      exemptFormSubmitted: 0,
      callable: 0,
      called: 0,
      calledToday: 0,
      uncalled: 0,
      totalFirstCallMinutes: 0,
      firstCallSamples: 0,
      totalWaitMinutes: 0,
      waitSamples: 0
    };
  }

  for (const row of leads || []) {
    const owner = clean(row?.owner || '') || 'Unassigned';
    if (!byOwner[owner]) {
      byOwner[owner] = {
        assigned: 0,
        exemptFormSubmitted: 0,
        callable: 0,
        called: 0,
        calledToday: 0,
        uncalled: 0,
        totalFirstCallMinutes: 0,
        firstCallSamples: 0,
        totalWaitMinutes: 0,
        waitSamples: 0
      };
    }

    const bucket = byOwner[owner];
    bucket.assigned += 1;

    const sponsorshipStatus = resolveSponsorshipStatus({
      name: row?.name || '',
      email: row?.email || '',
      phone: row?.phone || ''
    }, sponsorshipMap);
    const isExempt = !!String(sponsorshipStatus || '').trim() || !!clean(row?.formCompletedAt);

    if (isExempt) {
      bucket.exemptFormSubmitted += 1;
      continue;
    }

    bucket.callable += 1;

    const calledAt = inferCalledAt(row);
    const createdAt = clean(row?.createdAt || row?.updatedAt || '');

    if (calledAt) {
      bucket.called += 1;
      if (cstDateKeyFromIso(calledAt) === todayKey) bucket.calledToday += 1;

      const calledTs = new Date(calledAt).getTime();
      const createdTs = new Date(createdAt).getTime();
      if (Number.isFinite(calledTs) && Number.isFinite(createdTs) && calledTs >= createdTs) {
        bucket.totalFirstCallMinutes += Math.round((calledTs - createdTs) / 60000);
        bucket.firstCallSamples += 1;
      }
    } else {
      bucket.uncalled += 1;
      const ageMin = minutesSince(createdAt);
      bucket.totalWaitMinutes += ageMin;
      bucket.waitSamples += 1;
    }
  }

  const totals = Object.values(byOwner).reduce(
    (acc, b) => {
      acc.assigned += b.assigned;
      acc.exemptFormSubmitted += b.exemptFormSubmitted;
      acc.callable += b.callable;
      acc.called += b.called;
      acc.calledToday += b.calledToday;
      acc.uncalled += b.uncalled;
      acc.totalFirstCallMinutes += b.totalFirstCallMinutes;
      acc.firstCallSamples += b.firstCallSamples;
      acc.totalWaitMinutes += b.totalWaitMinutes;
      acc.waitSamples += b.waitSamples;
      return acc;
    },
    {
      assigned: 0,
      exemptFormSubmitted: 0,
      callable: 0,
      called: 0,
      calledToday: 0,
      uncalled: 0,
      totalFirstCallMinutes: 0,
      firstCallSamples: 0,
      totalWaitMinutes: 0,
      waitSamples: 0
    }
  );

  const ownerRows = Object.entries(byOwner).map(([name, b]) => ({
    name,
    ...b,
    callRate: b.callable ? Math.round((b.called / b.callable) * 100) : 0,
    avgFirstCallMinutes: b.firstCallSamples ? Math.round(b.totalFirstCallMinutes / b.firstCallSamples) : null,
    avgWaitMinutes: b.waitSamples ? Math.round(b.totalWaitMinutes / b.waitSamples) : null
  }));

  return {
    totals: {
      ...totals,
      callRate: totals.callable ? Math.round((totals.called / totals.callable) * 100) : 0,
      avgFirstCallMinutes: totals.firstCallSamples ? Math.round(totals.totalFirstCallMinutes / totals.firstCallSamples) : null,
      avgWaitMinutes: totals.waitSamples ? Math.round(totals.totalWaitMinutes / totals.waitSamples) : null
    },
    byOwner: ownerRows.sort((a, b) => a.name.localeCompare(b.name))
  };
}

export async function GET() {
  const settings = withDefaults(await loadJsonFile(SETTINGS_PATH, DEFAULT_SETTINGS));
  const events = await loadJsonStore(EVENTS_PATH, []);
  const leads = await loadJsonStore(CALLER_PATH, []);
  const sponsorship = await loadJsonStore(SPONSORSHIP_PATH, []);

  const keys = {
    dateKey: cstDateKey(),
    weekKey: cstWeekKey(),
    monthKey: cstMonthKey()
  };

  const counts = buildAgentCounts(settings, events, keys);
  const yesterdayCounts = computeYesterdayCounts(settings, events, new Date());

  const sponsorshipMap = sponsorshipLookup(sponsorship);
  const callMetrics = buildCallMetrics(settings, leads, sponsorshipMap);
  const calledLeadRows = buildCalledLeadRows(leads, sponsorshipMap);
  const recent = enrichEvents(events, sponsorshipMap).sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).slice(0, 300);

  const tomorrowStartOrder = [...(settings.agents || [])]
    .filter((a) => a.active && !a.paused)
    .sort((a, b) => {
      const aToday = Number(counts[a.name]?.today || 0);
      const bToday = Number(counts[b.name]?.today || 0);
      if (aToday !== bToday) return aToday - bToday;
      const aY = Number(yesterdayCounts[a.name] || 0);
      const bY = Number(yesterdayCounts[b.name] || 0);
      if (aY !== bY) return aY - bY;
      return a.name.localeCompare(b.name);
    })
    .map((a) => ({
      name: a.name,
      today: Number(counts[a.name]?.today || 0),
      yesterday: Number(yesterdayCounts[a.name] || 0)
    }));

  return Response.json({ ok: true, settings, counts, recent, keys, tomorrowStartOrder, callMetrics, calledLeadRows });
}

export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  const current = withDefaults(await loadJsonFile(SETTINGS_PATH, DEFAULT_SETTINGS));

  const next = withDefaults({
    ...current,
    ...(body?.patch || {})
  });

  await saveJsonFile(SETTINGS_PATH, next);
  return Response.json({ ok: true, settings: next });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (!validateToken(req, body)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const settings = withDefaults(await loadJsonFile(SETTINGS_PATH, DEFAULT_SETTINGS));
  const events = await loadJsonStore(EVENTS_PATH, []);
  const leads = await loadJsonStore(CALLER_PATH, []);

  const incoming = parseLeadPayload(body);
  const now = new Date();
  const keys = {
    dateKey: cstDateKey(now),
    weekKey: cstWeekKey(now),
    monthKey: cstMonthKey(now)
  };
  const minute = cstMinuteOfDay(now);

  const counts = buildAgentCounts(settings, events, keys);
  const yesterdayCounts = computeYesterdayCounts(settings, events, now);

  let assignedTo = settings.overflowAgent || 'Kimora Link';
  let reason = 'overflow';

  if (settings.enabled) {
    const eligible = getEligibleAgents(settings, counts, minute);

    if (eligible.length) {
      const picked = pickBalancedEligible(eligible, counts, events, yesterdayCounts);
      if (picked?.name) {
        assignedTo = picked.name;
        reason = 'eligible_balanced_carryover';
      }
    }
  } else {
    reason = 'router_disabled';
  }


  let slaReassigned = 0;
  if (settings.enabled && settings.slaEnabled) {
    const stale = leads
      .filter((r) => {
        const stage = clean(r?.stage || 'New').toLowerCase();
        if (stage !== 'new') return false;
        if (clean(r?.calledAt)) return false;
        if (!clean(r?.owner)) return false;
        const ageMin = minutesSince(r?.createdAt || r?.updatedAt || '');
        return ageMin >= Number(settings.slaMinutes || 10);
      })
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
      .slice(0, 5);

    for (const row of stale) {
      const currentOwner = clean(row.owner || '');
      const eligibleNow = getEligibleAgents(settings, counts, minute).filter((a) => a.name !== currentOwner);
      if (!eligibleNow.length) continue;

      if (settings.slaAction === 'reassign') {
        const picked = pickBalancedEligible(eligibleNow, counts, events, yesterdayCounts);
        if (!picked?.name) continue;

        row.owner = picked.name;
        row.updatedAt = nowIso();
        row.reassignedAt = nowIso();
        row.reassignCount = Number(row.reassignCount || 0) + 1;

        const toCount = counts[picked.name] || { today: 0, week: 0, month: 0 };
        toCount.today += 1;
        toCount.week += 1;
        toCount.month += 1;
        counts[picked.name] = toCount;

        events.push({
          id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'reassigned_sla',
          timestamp: nowIso(),
          dateKey: keys.dateKey,
          weekKey: keys.weekKey,
          monthKey: keys.monthKey,
          leadId: row.id,
          externalId: row.externalId || '',
          name: row.name || '',
          email: row.email || '',
          phone: row.phone || '',
          assignedTo: picked.name,
          previousOwner: currentOwner,
          reason: 'sla_reassign',
          mode: settings.mode
        });

        await postOutboundAssignment(settings, {
          event: 'sla_reassign',
          assignedTo: picked.name,
          previousOwner: currentOwner,
          reason: 'sla_reassign',
          timestamp: nowIso(),
          message: `SLA reassigned lead to ${picked.name}: ${row.name} (${row.phone || row.email || 'no contact'})`,
          lead: {
            id: row.externalId || row.id,
            name: row.name,
            email: row.email,
            phone: row.phone
          }
        });

        slaReassigned += 1;
      }
    }

    if (slaReassigned > 0) {
      await saveJsonStore(CALLER_PATH, leads);
    }
  }

  const existingIdx = leads.findIndex((r) => r.externalId && r.externalId === incoming.externalId);
  const row = {
    id: existingIdx >= 0 ? leads[existingIdx].id : `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    externalId: incoming.externalId,
    name: incoming.name,
    email: incoming.email,
    phone: incoming.phone,
    licensedStatus: incoming.licensedStatus || (existingIdx >= 0 ? leads[existingIdx].licensedStatus : 'Unknown'),
    source: incoming.source,
    notes: incoming.notes,
    stage: existingIdx >= 0 ? leads[existingIdx].stage : 'New',
    owner: assignedTo,
    calledAt: existingIdx >= 0 ? leads[existingIdx].calledAt : '',
    connectedAt: existingIdx >= 0 ? leads[existingIdx].connectedAt : '',
    qualifiedAt: existingIdx >= 0 ? leads[existingIdx].qualifiedAt : '',
    formSentAt: existingIdx >= 0 ? leads[existingIdx].formSentAt : '',
    inviteSentAt: existingIdx >= 0 ? leads[existingIdx].inviteSentAt : '',
    formCompletedAt: existingIdx >= 0 ? leads[existingIdx].formCompletedAt : '',
    policyStartedAt: existingIdx >= 0 ? leads[existingIdx].policyStartedAt : '',
    approvedAt: existingIdx >= 0 ? leads[existingIdx].approvedAt : '',
    onboardingStartedAt: existingIdx >= 0 ? leads[existingIdx].onboardingStartedAt : '',
    movedForwardAt: existingIdx >= 0 ? leads[existingIdx].movedForwardAt : '',
    createdAt: existingIdx >= 0 ? leads[existingIdx].createdAt : nowIso(),
    updatedAt: nowIso()
  };

  if (existingIdx >= 0) leads[existingIdx] = row;
  else leads.push(row);
  await saveJsonStore(CALLER_PATH, leads);

  events.push({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'assigned',
    timestamp: nowIso(),
    dateKey: keys.dateKey,
    weekKey: keys.weekKey,
    monthKey: keys.monthKey,
    leadId: row.id,
    externalId: incoming.externalId,
    name: incoming.name,
    email: incoming.email,
    phone: incoming.phone,
    assignedTo,
    reason,
    mode: settings.mode
  });
  const trimmed = events.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()).slice(-5000);
  await saveJsonStore(EVENTS_PATH, trimmed);

  await postOutboundAssignment(settings, {
    event: 'lead_assigned',
    assignedTo,
    reason,
    timestamp: nowIso(),
    message: `New lead assigned to ${assignedTo}: ${incoming.name} (${incoming.phone || incoming.email || 'no contact'})`,
    lead: {
      id: incoming.externalId || row.id,
      name: incoming.name,
      email: incoming.email,
      phone: incoming.phone
    }
  });

  return Response.json({ ok: true, assignedTo, reason, row, slaReassigned });
}
