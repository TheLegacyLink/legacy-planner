import { DEFAULT_CONFIG } from '../../../lib/runtimeConfig';
import { loadJsonFile, saveJsonFile, loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import ownerOverrides from '../../../data/callerOwnerOverrides.json';
import users from '../../../data/innerCircleUsers.json';
import nodemailer from 'nodemailer';

const SETTINGS_PATH = 'stores/lead-router-settings.json';
const EVENTS_PATH = 'stores/lead-router-events.json';
const CALLER_PATH = 'stores/caller-leads.json';
const SPONSORSHIP_PATH = 'stores/sponsorship-applications.json';
const POLICY_SUBMISSIONS_PATH = 'stores/policy-submissions.json';

const DEFAULT_SETTINGS = {
  enabled: true,
  mode: 'random',
  routingMode: 'live', // live | delayed24h
  delayedReleaseEnabled: true,
  delayedReleaseHours: 24,
  maxPerDay: 2,
  maxPerWeek: 14,
  maxPerMonth: 60,
  timezone: 'America/Chicago',
  overflowAgent: 'Kimora Link',
  agents: (DEFAULT_CONFIG?.agents || []).map((name) => ({
    name,
    active: true,
    paused: false,
    delayedReleaseEnabled: false,
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

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function findUserEmailByName(name = '') {
  const n = normalize(name);
  const hit = (users || []).find((u) => normalize(u?.name || '') === n);
  return clean(hit?.email || '');
}

async function sendLeadAssignedEmail({ assignedTo = '', previousOwner = '', row = {}, reason = '' } = {}) {
  const to = findUserEmailByName(assignedTo);
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!to || !user || !pass) return { ok: false, error: 'email_not_configured' };

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const leadName = clean(row?.name || 'Unknown Lead');
  const leadPhone = clean(row?.phone || '—');
  const leadEmail = clean(row?.email || '—');

  const subject = `New Lead Assigned: ${leadName}`;
  const text = [
    `Hi ${assignedTo},`,
    '',
    'You have a new lead assignment.',
    '',
    `Lead: ${leadName}`,
    `Phone: ${leadPhone}`,
    `Email: ${leadEmail}`,
    `Previous Owner: ${previousOwner || '—'}`,
    `Assignment Type: ${reason || 'router_assignment'}`,
    '',
    'Please reach out as soon as possible.',
    '',
    '— The Legacy Link Support Team'
  ].join('\n');

  try {
    const info = await tx.sendMail({
      from,
      to,
      cc: 'support@thelegacylink.com',
      subject,
      text,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;">
        <h2 style="margin:0 0 12px;">New Lead Assignment</h2>
        <p>Hi <strong>${assignedTo}</strong>,</p>
        <p>You have a new lead assignment.</p>
        <ul>
          <li><strong>Lead:</strong> ${leadName}</li>
          <li><strong>Phone:</strong> ${leadPhone}</li>
          <li><strong>Email:</strong> ${leadEmail}</li>
          <li><strong>Previous Owner:</strong> ${previousOwner || '—'}</li>
          <li><strong>Assignment Type:</strong> ${reason || 'router_assignment'}</li>
        </ul>
        <p>Please reach out as soon as possible.</p>
        <p>— The Legacy Link Support Team</p>
      </div>`
    });
    return { ok: true, messageId: info?.messageId || '' };
  } catch (error) {
    return { ok: false, error: clean(error?.message || 'send_failed') || 'send_failed' };
  }
}

function safeJsonParse(raw, fallback = {}) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function resolveOwnerUserId(assignedToName = '') {
  const map = safeJsonParse(process.env.GHL_USER_ID_MAP_JSON || '{}', {});
  const direct = map?.[assignedToName];
  if (direct) return String(direct);

  const fallback = clean(process.env.GHL_FALLBACK_USER_ID || '');
  return fallback || '';
}

async function updateGhlContactOwner({ contactId, assignedUserId }) {
  const token = clean(process.env.GHL_API_TOKEN || '');
  if (!token || !contactId || !assignedUserId) {
    return { ok: false, reason: 'missing_ghl_config_or_ids' };
  }

  const body = JSON.stringify({ assignedTo: assignedUserId });
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28'
  };

  const bases = [
    clean(process.env.GHL_API_BASE_URL || ''),
    'https://services.leadconnectorhq.com',
    'https://rest.gohighlevel.com'
  ].filter(Boolean);

  const paths = [
    `/contacts/${encodeURIComponent(contactId)}`,
    `/v1/contacts/${encodeURIComponent(contactId)}`
  ];

  let lastError = 'unknown';

  for (const base of bases) {
    for (const path of paths) {
      const url = `${base.replace(/\/$/, '')}${path}`;
      try {
        const res = await fetch(url, {
          method: 'PUT',
          headers,
          body,
          cache: 'no-store'
        });

        if (res.ok) {
          return { ok: true, url, status: res.status };
        }

        const text = await res.text().catch(() => '');
        lastError = `${url} -> ${res.status} ${text.slice(0, 200)}`;
      } catch (err) {
        lastError = `${url} -> ${String(err?.message || err)}`;
      }
    }
  }

  return { ok: false, reason: 'ghl_update_failed', detail: lastError };
}

async function syncGhlOwnerForRelease({ row = {}, assignedTo = '' } = {}) {
  const contactId = clean(row?.externalId || row?.contactId || row?.id || '');
  const assignedUserId = resolveOwnerUserId(assignedTo);
  if (!contactId || !assignedUserId) return { ok: false, reason: 'missing_contact_or_user' };
  return await updateGhlContactOwner({ contactId, assignedUserId });
}

function normalizeName(v = '') {
  return clean(v).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizePhone(v = '') {
  return String(v || '').replace(/\D/g, '');
}

function normalizeDirection(v = '') {
  const s = clean(v).toLowerCase();
  if (!s) return '';
  if (s.includes('inbound') || s === 'in') return 'inbound';
  if (s.includes('outbound') || s === 'out') return 'outbound';
  return '';
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

function cstWeekKeyFromIso(iso = '') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return cstWeekKey(d);
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

function plusHoursIso(iso = '', hours = 24) {
  const ts = new Date(iso || Date.now()).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return '';
  return new Date(ts + (Number(hours || 24) * 60 * 60 * 1000)).toISOString();
}

function hasSponsorshipFormSubmitted(row = {}) {
  if (clean(row?.formCompletedAt)) return true;
  const stage = clean(row?.stage || '').toLowerCase();
  return ['form completed', 'policy started', 'approved', 'onboarding started', 'moved forward'].includes(stage);
}

function shouldRunDelayedRelease(settings = {}) {
  // Delayed release is independent from instant router pause.
  return Boolean(settings?.delayedReleaseEnabled);
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

function agentWithinCapsAndWindow(agent, settings, counts, minute) {
  const startMin = parseTimeToMin(agent.windowStart || '00:00');
  const endMin = parseTimeToMin(agent.windowEnd || '23:59');
  const inWindow = minute >= startMin && minute <= endMin;
  if (!inWindow) return false;

  const capDay = agent.capPerDay == null ? Number(settings.maxPerDay || 0) : Number(agent.capPerDay || 0);
  const capWeek = agent.capPerWeek == null ? Number(settings.maxPerWeek || 0) : Number(agent.capPerWeek || 0);
  const capMonth = agent.capPerMonth == null ? Number(settings.maxPerMonth || 0) : Number(agent.capPerMonth || 0);

  const count = counts[agent.name] || { today: 0, week: 0, month: 0 };
  if (capDay > 0 && count.today >= capDay) return false;
  if (capWeek > 0 && count.week >= capWeek) return false;
  if (capMonth > 0 && count.month >= capMonth) return false;
  return true;
}

function getEligibleAgents(settings, counts, minute) {
  return settings.agents.filter((a) => {
    if (!a.active || a.paused) return false;
    return agentWithinCapsAndWindow(a, settings, counts, minute);
  });
}

function getDelayedEligibleAgents(settings, counts, minute) {
  return settings.agents.filter((a) => {
    if (!a.active) return false;
    if (!Boolean(a.delayedReleaseEnabled)) return false;
    return agentWithinCapsAndWindow(a, settings, counts, minute);
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
      delayedReleaseEnabled: current?.delayedReleaseEnabled ?? false,
      windowStart: clean(current?.windowStart || '09:00') || '09:00',
      windowEnd: clean(current?.windowEnd || '21:00') || '21:00',
      capPerDay: current?.capPerDay == null || current?.capPerDay === '' ? null : Number(current.capPerDay),
      capPerWeek: current?.capPerWeek == null || current?.capPerWeek === '' ? null : Number(current.capPerWeek),
      capPerMonth: current?.capPerMonth == null || current?.capPerMonth === '' ? null : Number(current.capPerMonth)
    };
  });

  const routingMode = clean(merged.routingMode || 'live').toLowerCase();
  merged.routingMode = routingMode === 'delayed24h' ? 'delayed24h' : 'live';
  merged.delayedReleaseEnabled = merged.delayedReleaseEnabled !== false;
  merged.delayedReleaseHours = Math.max(1, Number(merged.delayedReleaseHours || 24));
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
    const e = clean(row?.email || row?.applicant_email || '').toLowerCase();
    const p = normalizePhone(row?.phone || row?.applicant_phone || '');
    if (n) map.set(`n:${n}`, status);
    if (e) map.set(`e:${e}`, status);
    if (p) map.set(`p:${p}`, status);
  }
  return map;
}

function buildSubmittedBlockLookup(sponsorshipRows = [], policyRows = []) {
  const set = new Set();

  const push = ({ name = '', email = '', phone = '' } = {}) => {
    const n = normalizeName(name);
    const e = clean(email).toLowerCase();
    const p = normalizePhone(phone);
    if (n) set.add(`n:${n}`);
    if (e) set.add(`e:${e}`);
    if (p) set.add(`p:${p}`);
  };

  for (const row of sponsorshipRows || []) {
    // Any submitted sponsorship application should block auto release.
    push({
      name: clean(row?.name || `${row?.firstName || ''} ${row?.lastName || ''}`),
      email: clean(row?.email || row?.applicant_email || ''),
      phone: clean(row?.phone || row?.applicant_phone || '')
    });
  }

  for (const row of policyRows || []) {
    // Any submitted/approved policy should block auto release.
    push({
      name: clean(row?.applicantName || row?.applicant_name || row?.name || ''),
      email: clean(row?.email || row?.applicant_email || ''),
      phone: clean(row?.phone || row?.applicant_phone || '')
    });
  }

  return set;
}

function isBlockedBySubmittedCrossCheck(lead = {}, blockLookup = new Set()) {
  const keys = [
    `n:${normalizeName(lead?.name || '')}`,
    `e:${clean(lead?.email || '').toLowerCase()}`,
    `p:${normalizePhone(lead?.phone || '')}`
  ].filter((k) => !k.endsWith(':'));

  return keys.some((k) => blockLookup.has(k));
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

function isUnknownOwner(v = '') {
  const s = clean(v).toLowerCase();
  return !s || s === 'unknown' || s === 'unassigned';
}

function ownerOverrideForLead(row = {}) {
  const n = normalizeName(row?.name || '');
  const e = clean(row?.email || '').toLowerCase();
  const p = normalizePhone(row?.phone || '');

  const hit = (ownerOverrides || []).find((o) => {
    const on = normalizeName(o?.name || '');
    const oe = clean(o?.email || '').toLowerCase();
    const op = normalizePhone(o?.phone || '');
    return (on && n && on === n) || (oe && e && oe === e) || (op && p && op === p);
  });

  return clean(hit?.owner || '');
}

function buildOwnerLookup(events = []) {
  const map = new Map();
  const sorted = [...(events || [])].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  for (const e of sorted) {
    const owner = clean(e?.assignedTo || e?.owner || '');
    if (isUnknownOwner(owner)) continue;

    const keys = [
      clean(e?.leadId || ''),
      clean(e?.externalId || ''),
      clean(e?.email || '').toLowerCase(),
      normalizePhone(e?.phone || ''),
      normalizeName(e?.name || '')
    ].filter(Boolean);

    for (const key of keys) {
      if (!map.has(key)) map.set(key, owner);
    }
  }
  return map;
}

function resolveLeadOwner(row = {}, ownerLookup = new Map()) {
  const current = clean(row?.owner || '');
  if (!isUnknownOwner(current)) return current;

  const overrideOwner = ownerOverrideForLead(row);
  if (!isUnknownOwner(overrideOwner)) return overrideOwner;

  const keys = [
    clean(row?.id || ''),
    clean(row?.externalId || ''),
    clean(row?.email || '').toLowerCase(),
    normalizePhone(row?.phone || ''),
    normalizeName(row?.name || '')
  ].filter(Boolean);

  for (const key of keys) {
    const hit = clean(ownerLookup.get(key) || '');
    if (!isUnknownOwner(hit)) return hit;
  }

  return current || 'Unknown';
}

function isInnerCircleOwner(owner = '', settings = {}) {
  const set = new Set((settings?.agents || []).map((a) => clean(a.name)));
  return set.has(clean(owner));
}

function isOutboundCall(row = {}) {
  const dir = normalizeDirection(row?.callDirection || row?.direction || row?.event || '');
  if (dir === 'inbound') return false;
  if (dir === 'outbound') return true;

  const source = clean(row?.source || '').toLowerCase();
  if (source.includes('inbound')) return false;
  if (source.includes('outbound')) return true;

  // fallback: if direction is missing, treat as outbound for legacy records
  return true;
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

const ASSIGNMENT_EVENT_TYPES = new Set(['assigned', 'delayed_release_assigned', 'reassigned_sla', 'manual_bulk_release_assigned']);

function buildAgentCounts(settings, events, keys) {
  const counts = {};
  for (const a of settings.agents) counts[a.name] = { today: 0, week: 0, month: 0 };

  for (const e of events) {
    if (!ASSIGNMENT_EVENT_TYPES.has(clean(e?.type || ''))) continue;
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
  // Duration must be exact from call-source payload; no estimates.
  const explicit = Number(row?.lastCallDurationSec || 0) || 0;
  return explicit > 0 ? explicit : 0;
}

function buildCalledLeadRows(leads = [], sponsorshipMap = new Map(), ownerLookup = new Map(), settings = {}, submittedBlockLookup = new Set()) {
  return (leads || [])
    .map((r) => {
      const calledAt = inferCalledAt(r);
      if (!calledAt) return null;

      const owner = resolveLeadOwner(r, ownerLookup);
      if (!isInnerCircleOwner(owner, settings)) return null;
      if (!isOutboundCall(r)) return null;
      if (hasSponsorshipFormSubmitted(r) || isBlockedBySubmittedCrossCheck(r, submittedBlockLookup)) return null;

      const createdAt = clean(r?.createdAt || r?.updatedAt || '');
      const calledTs = new Date(calledAt || 0).getTime();
      const createdTs = new Date(createdAt || 0).getTime();
      const timeToFirstCallMin = Number.isFinite(calledTs) && Number.isFinite(createdTs) && calledTs >= createdTs
        ? Math.round((calledTs - createdTs) / 60000)
        : null;

      return {
        id: r.id,
        owner,
        name: clean(r.name || '') || 'Unknown Lead',
        email: clean(r.email || ''),
        phone: clean(r.phone || ''),
        createdAt,
        calledAt,
        callResult: clean(r.callResult || ''),
        callDirection: normalizeDirection(r.callDirection || ''),
        lastCallDurationSec: inferDurationSec(r),
        lastCallRecordingUrl: clean(r.lastCallRecordingUrl || ''),
        stage: clean(r.stage || ''),
        timeToFirstCallMin,
        sponsorshipStatus: resolveSponsorshipStatus({ name: r?.name, email: r?.email, phone: r?.phone }, sponsorshipMap)
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.calledAt || 0).getTime() - new Date(a.calledAt || 0).getTime())
    .slice(0, 1000);
}

function buildCallMetrics(settings, leads = [], sponsorshipMap = new Map(), ownerLookup = new Map()) {
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
    const owner = resolveLeadOwner(row, ownerLookup) || 'Unassigned';
    if (!isInnerCircleOwner(owner, settings)) continue;
    if (!isOutboundCall(row)) continue;

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

    if (!!String(sponsorshipStatus || '').trim() || !!clean(row?.formCompletedAt)) {
      bucket.exemptFormSubmitted += 1;
    }

    // Kimora requirement: every call counts as a call, regardless of form completion stage.
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

  const totals = Object.entries(byOwner)
    .filter(([name]) => !isUnknownOwner(name))
    .map(([, b]) => b)
    .reduce(
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

  const ownerRows = Object.entries(byOwner)
    .filter(([name]) => !isUnknownOwner(name))
    .map(([name, b]) => ({
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

async function runDelayedReleasePass({ settings, leads, events, submittedBlockLookup = new Set(), now = new Date() }) {
  if (!shouldRunDelayedRelease(settings)) {
    return { released: 0, blockedSubmitted: 0, blockedManualHold: 0, waitingWindow: 0, waitingEligibleAgent: 0 };
  }

  const keys = {
    dateKey: cstDateKey(now),
    weekKey: cstWeekKey(now),
    monthKey: cstMonthKey(now)
  };
  const minute = cstMinuteOfDay(now);
  const yesterdayCounts = computeYesterdayCounts(settings, events, now);
  const counts = buildAgentCounts(settings, events, keys);

  const out = {
    released: 0,
    blockedSubmitted: 0,
    blockedManualHold: 0,
    waitingWindow: 0,
    waitingEligibleAgent: 0
  };

  const releaseCandidates = [...(leads || [])]
    .filter((r) => clean(r?.releaseMode || '').toLowerCase() === 'delayed24h')
    .sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime());

  for (const row of releaseCandidates) {
    if (clean(row?.releaseStatus || '') === 'released_to_agent') continue;

    if (hasSponsorshipFormSubmitted(row) || isBlockedBySubmittedCrossCheck(row, submittedBlockLookup)) {
      if (clean(row?.releaseStatus || '') !== 'blocked_submitted') {
        row.releaseStatus = 'blocked_submitted';
        row.updatedAt = nowIso();
      }
      out.blockedSubmitted += 1;
      continue;
    }

    if (Boolean(row?.manualHold)) {
      if (clean(row?.releaseStatus || '') !== 'manual_hold') {
        row.releaseStatus = 'manual_hold';
        row.updatedAt = nowIso();
      }
      out.blockedManualHold += 1;
      continue;
    }

    const releaseAt = new Date(row?.releaseEligibleAt || 0).getTime();
    if (!Number.isFinite(releaseAt) || releaseAt <= 0 || now.getTime() < releaseAt) {
      out.waitingWindow += 1;
      continue;
    }

    const eligible = getDelayedEligibleAgents(settings, counts, minute)
      .filter((a) => a.name !== clean(settings?.overflowAgent || ''));

    if (!eligible.length) {
      row.releaseStatus = 'ready_waiting_agent';
      row.updatedAt = nowIso();
      out.waitingEligibleAgent += 1;
      continue;
    }

    const picked = pickBalancedEligible(eligible, counts, events, yesterdayCounts);
    if (!picked?.name) {
      row.releaseStatus = 'ready_waiting_agent';
      row.updatedAt = nowIso();
      out.waitingEligibleAgent += 1;
      continue;
    }

    const previousOwner = clean(row?.owner || settings?.overflowAgent || 'Kimora Link');
    row.owner = picked.name;
    row.releaseStatus = 'released_to_agent';
    row.releasedAt = nowIso();
    row.releaseReason = '24h_no_sponsorship_submit';
    row.updatedAt = nowIso();

    const toCount = counts[picked.name] || { today: 0, week: 0, month: 0 };
    toCount.today += 1;
    toCount.week += 1;
    toCount.month += 1;
    counts[picked.name] = toCount;

    events.push({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'delayed_release_assigned',
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
      previousOwner,
      reason: '24h_no_sponsorship_submit',
      mode: settings.mode,
      routingMode: settings.routingMode || 'live'
    });

    await postOutboundAssignment(settings, {
      event: 'lead_delayed_release_assigned',
      assignedTo: picked.name,
      previousOwner,
      reason: '24h_no_sponsorship_submit',
      timestamp: nowIso(),
      message: `Delayed-release lead assigned to ${picked.name}: ${row.name} (${row.phone || row.email || 'no contact'})`,
      lead: {
        id: row.externalId || row.id,
        name: row.name,
        email: row.email,
        phone: row.phone
      }
    });

    const ghlSync = await syncGhlOwnerForRelease({ row, assignedTo: picked.name });
    events.push({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'ghl_owner_sync',
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
      ok: Boolean(ghlSync?.ok),
      reason: clean(ghlSync?.reason || ''),
      detail: clean(ghlSync?.detail || ''),
      status: ghlSync?.status || null
    });

    const emailNotify = await sendLeadAssignedEmail({
      assignedTo: picked.name,
      previousOwner,
      row,
      reason: '24h_no_sponsorship_submit'
    });
    events.push({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'agent_email_notify',
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
      ok: Boolean(emailNotify?.ok),
      reason: clean(emailNotify?.error || ''),
      detail: clean(emailNotify?.messageId || '')
    });

    out.released += 1;
  }

  return out;
}

function buildWeekUnsubmittedLeads(leads = [], submittedBlockLookup = new Set(), now = new Date()) {
  const currentWeek = cstWeekKey(now);
  return (leads || [])
    .filter((r) => cstWeekKeyFromIso(r?.createdAt || r?.updatedAt || '') === currentWeek)
    .filter((r) => !hasSponsorshipFormSubmitted(r))
    .filter((r) => !isBlockedBySubmittedCrossCheck(r, submittedBlockLookup))
    .sort((a, b) => new Date(b?.createdAt || b?.updatedAt || 0).getTime() - new Date(a?.createdAt || a?.updatedAt || 0).getTime())
    .slice(0, 500)
    .map((r) => ({
      id: r.id,
      externalId: r.externalId || '',
      name: r.name || '',
      email: r.email || '',
      phone: r.phone || '',
      owner: r.owner || '',
      stage: r.stage || '',
      createdAt: r.createdAt || '',
      releaseMode: r.releaseMode || 'live',
      releaseStatus: r.releaseStatus || '',
      manualHold: Boolean(r.manualHold),
      releaseEligibleAt: r.releaseEligibleAt || ''
    }));
}

function pickAutoBulkAgent(settings = {}, counts = {}, events = [], now = new Date()) {
  const minute = cstMinuteOfDay(now);
  const eligibleNow = getDelayedEligibleAgents(settings, counts, minute);
  if (eligibleNow.length) return pickBalancedEligible(eligibleNow, counts, events, computeYesterdayCounts(settings, events, now));

  const delayedActive = (settings?.agents || []).filter((a) => a.active && Boolean(a.delayedReleaseEnabled));
  if (delayedActive.length) return delayedActive[0];

  return (settings?.agents || [])[0] || null;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const runRelease = clean(searchParams.get('runRelease')).toLowerCase() === '1';

  const settings = withDefaults(await loadJsonFile(SETTINGS_PATH, DEFAULT_SETTINGS));
  const events = await loadJsonStore(EVENTS_PATH, []);
  const leads = await loadJsonStore(CALLER_PATH, []);
  const sponsorship = await loadJsonStore(SPONSORSHIP_PATH, []);
  const policySubmissions = await loadJsonStore(POLICY_SUBMISSIONS_PATH, []);
  const submittedBlockLookup = buildSubmittedBlockLookup(sponsorship, policySubmissions);

  let releaseRun = { released: 0, blockedSubmitted: 0, blockedManualHold: 0, waitingWindow: 0, waitingEligibleAgent: 0 };
  if (runRelease) {
    releaseRun = await runDelayedReleasePass({ settings, leads, events, submittedBlockLookup, now: new Date() });
    if (releaseRun.released || releaseRun.blockedSubmitted || releaseRun.blockedManualHold || releaseRun.waitingEligibleAgent) {
      await saveJsonStore(CALLER_PATH, leads);
      const trimmedReleaseEvents = events
        .sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime())
        .slice(-5000);
      await saveJsonStore(EVENTS_PATH, trimmedReleaseEvents);
    }
  }

  const keys = {
    dateKey: cstDateKey(),
    weekKey: cstWeekKey(),
    monthKey: cstMonthKey()
  };

  const counts = buildAgentCounts(settings, events, keys);
  const yesterdayCounts = computeYesterdayCounts(settings, events, new Date());

  const sponsorshipMap = sponsorshipLookup(sponsorship);
  const ownerLookup = buildOwnerLookup(events);
  const callMetrics = buildCallMetrics(settings, leads, sponsorshipMap, ownerLookup);
  const calledLeadRows = buildCalledLeadRows(leads, sponsorshipMap, ownerLookup, settings, submittedBlockLookup);
  const recent = enrichEvents(events, sponsorshipMap).sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).slice(0, 300);

  const ghlSyncEvents = [...(events || [])]
    .filter((e) => clean(e?.type || '') === 'ghl_owner_sync')
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

  const leadById = new Map();
  const leadByExternalId = new Map();
  const leadByEmail = new Map();
  const leadByPhone = new Map();
  for (const row of leads || []) {
    if (clean(row?.id)) leadById.set(clean(row.id), row);
    if (clean(row?.externalId)) leadByExternalId.set(clean(row.externalId), row);
    if (clean(row?.email)) leadByEmail.set(clean(row.email).toLowerCase(), row);
    if (clean(row?.phone)) leadByPhone.set(normalizePhone(row.phone), row);
  }

  const resolveLeadForSyncEvent = (e = {}) => {
    const byId = leadById.get(clean(e?.leadId || ''));
    if (byId) return byId;
    const byExt = leadByExternalId.get(clean(e?.externalId || ''));
    if (byExt) return byExt;
    const byEmail = leadByEmail.get(clean(e?.email || '').toLowerCase());
    if (byEmail) return byEmail;
    const byPhone = leadByPhone.get(normalizePhone(e?.phone || ''));
    if (byPhone) return byPhone;
    return null;
  };

  const ghlSyncSummary = {
    total: ghlSyncEvents.length,
    success: ghlSyncEvents.filter((e) => Boolean(e?.ok)).length,
    failed: ghlSyncEvents.filter((e) => !Boolean(e?.ok)).length,
    recentAttempts: ghlSyncEvents
      .slice(0, 30)
      .map((e) => {
        const row = resolveLeadForSyncEvent(e);
        return {
          timestamp: e.timestamp || '',
          leadId: e.leadId || '',
          externalId: e.externalId || '',
          leadName: e.name || clean(row?.name || ''),
          leadEmail: e.email || clean(row?.email || ''),
          leadPhone: e.phone || clean(row?.phone || ''),
          assignedTo: e.assignedTo || '',
          ok: Boolean(e?.ok),
          reason: e.reason || '',
          detail: e.detail || ''
        };
      }),
    recentFailures: ghlSyncEvents
      .filter((e) => !Boolean(e?.ok))
      .slice(0, 20)
      .map((e) => {
        const row = resolveLeadForSyncEvent(e);
        return {
          timestamp: e.timestamp || '',
          leadId: e.leadId || '',
          externalId: e.externalId || '',
          leadName: e.name || clean(row?.name || ''),
          assignedTo: e.assignedTo || '',
          reason: e.reason || '',
          detail: e.detail || ''
        };
      })
  };
  const delayedQueue = (leads || [])
    .filter((r) => clean(r?.releaseMode || '').toLowerCase() === 'delayed24h' && clean(r?.releaseStatus || '') !== 'released_to_agent')
    .filter((r) => !hasSponsorshipFormSubmitted(r) && !isBlockedBySubmittedCrossCheck(r, submittedBlockLookup))
    .sort((a, b) => new Date(a?.releaseEligibleAt || a?.createdAt || 0).getTime() - new Date(b?.releaseEligibleAt || b?.createdAt || 0).getTime())
    .slice(0, 200)
    .map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      owner: r.owner,
      createdAt: r.createdAt,
      releaseEligibleAt: r.releaseEligibleAt,
      releaseStatus: r.releaseStatus,
      manualHold: Boolean(r.manualHold),
      formCompletedAt: r.formCompletedAt || ''
    }));
  const weekUnsubmittedLeads = buildWeekUnsubmittedLeads(leads, submittedBlockLookup, new Date());

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

  return Response.json({ ok: true, settings, counts, recent, keys, tomorrowStartOrder, callMetrics, calledLeadRows, delayedQueue, weekUnsubmittedLeads, releaseRun, ghlSyncSummary });
}

export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));

  const mode = clean(body?.mode || '').toLowerCase();
  if (mode === 'set-manual-hold') {
    const leadId = clean(body?.leadId || body?.id);
    if (!leadId) return Response.json({ ok: false, error: 'missing_lead_id' }, { status: 400 });

    const leads = await loadJsonStore(CALLER_PATH, []);
    const idx = leads.findIndex((r) => clean(r?.id) === leadId);
    if (idx < 0) return Response.json({ ok: false, error: 'lead_not_found' }, { status: 404 });

    const hold = Boolean(body?.hold);
    leads[idx] = {
      ...leads[idx],
      manualHold: hold,
      releaseStatus: hold ? 'manual_hold' : (clean(leads[idx]?.releaseStatus || '') === 'manual_hold' ? 'owner_window' : leads[idx]?.releaseStatus || ''),
      updatedAt: nowIso()
    };

    await saveJsonStore(CALLER_PATH, leads);
    return Response.json({ ok: true, row: leads[idx] });
  }

  if (mode === 'set-lead-release-mode') {
    const leadId = clean(body?.leadId || body?.id);
    if (!leadId) return Response.json({ ok: false, error: 'missing_lead_id' }, { status: 400 });

    const releaseMode = clean(body?.releaseMode || '').toLowerCase();
    if (!['live', 'delayed24h'].includes(releaseMode)) {
      return Response.json({ ok: false, error: 'invalid_release_mode' }, { status: 400 });
    }

    const holdHours = Math.max(1, Number(body?.holdHours || 24));
    const leads = await loadJsonStore(CALLER_PATH, []);
    const idx = leads.findIndex((r) => clean(r?.id) === leadId);
    if (idx < 0) return Response.json({ ok: false, error: 'lead_not_found' }, { status: 404 });

    const current = leads[idx] || {};
    const next = {
      ...current,
      releaseMode,
      updatedAt: nowIso()
    };

    if (releaseMode === 'delayed24h') {
      next.releaseEligibleAt = plusHoursIso(nowIso(), holdHours);
      next.releaseStatus = 'owner_window';
      next.releasedAt = '';
      next.releaseReason = '';
    } else {
      next.releaseEligibleAt = '';
      next.releaseStatus = '';
      next.releasedAt = '';
      next.releaseReason = '';
    }

    leads[idx] = next;
    await saveJsonStore(CALLER_PATH, leads);
    return Response.json({ ok: true, row: next });
  }

  if (mode === 'bulk-release-week-unsubmitted') {
    const settings = withDefaults(await loadJsonFile(SETTINGS_PATH, DEFAULT_SETTINGS));
    const leads = await loadJsonStore(CALLER_PATH, []);
    const events = await loadJsonStore(EVENTS_PATH, []);
    const sponsorship = await loadJsonStore(SPONSORSHIP_PATH, []);
    const policySubmissions = await loadJsonStore(POLICY_SUBMISSIONS_PATH, []);
    const submittedBlockLookup = buildSubmittedBlockLookup(sponsorship, policySubmissions);
    const now = new Date();

    const strategy = clean(body?.strategy || 'auto').toLowerCase(); // auto | agent
    const targetAgent = clean(body?.targetAgent || '');
    const leadIds = Array.isArray(body?.leadIds) ? body.leadIds.map((x) => clean(x)).filter(Boolean) : [];
    const leadIdSet = new Set(leadIds);

    const keys = {
      dateKey: cstDateKey(now),
      weekKey: cstWeekKey(now),
      monthKey: cstMonthKey(now)
    };
    const counts = buildAgentCounts(settings, events, keys);

    const candidates = (leads || [])
      .filter((r) => cstWeekKeyFromIso(r?.createdAt || r?.updatedAt || '') === keys.weekKey)
      .filter((r) => !hasSponsorshipFormSubmitted(r))
      .filter((r) => !isBlockedBySubmittedCrossCheck(r, submittedBlockLookup))
      .filter((r) => !Boolean(r?.manualHold))
      .filter((r) => leadIdSet.size ? leadIdSet.has(clean(r?.id)) : true)
      .sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime());

    let updated = 0;
    for (const row of candidates) {
      let pickedName = '';
      if (strategy === 'agent') {
        pickedName = targetAgent;
      } else {
        const picked = pickAutoBulkAgent(settings, counts, events, now);
        pickedName = clean(picked?.name || '');
      }

      if (!pickedName) continue;

      const previousOwner = clean(row?.owner || settings?.overflowAgent || 'Kimora Link');
      row.owner = pickedName;
      row.releaseStatus = 'released_to_agent';
      row.releaseReason = strategy === 'agent' ? 'manual_bulk_release_target_agent' : 'manual_bulk_release_auto';
      row.releasedAt = nowIso();
      row.releaseMode = row.releaseMode || settings.routingMode || 'live';
      row.updatedAt = nowIso();

      const toCount = counts[pickedName] || { today: 0, week: 0, month: 0 };
      toCount.today += 1;
      toCount.week += 1;
      toCount.month += 1;
      counts[pickedName] = toCount;

      events.push({
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'manual_bulk_release_assigned',
        timestamp: nowIso(),
        dateKey: keys.dateKey,
        weekKey: keys.weekKey,
        monthKey: keys.monthKey,
        leadId: row.id,
        externalId: row.externalId || '',
        name: row.name || '',
        email: row.email || '',
        phone: row.phone || '',
        assignedTo: pickedName,
        previousOwner,
        reason: row.releaseReason,
        mode: settings.mode,
        routingMode: settings.routingMode || 'live'
      });

      const ghlSync = await syncGhlOwnerForRelease({ row, assignedTo: pickedName });
      events.push({
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'ghl_owner_sync',
        timestamp: nowIso(),
        dateKey: keys.dateKey,
        weekKey: keys.weekKey,
        monthKey: keys.monthKey,
        leadId: row.id,
        externalId: row.externalId || '',
        name: row.name || '',
        email: row.email || '',
        phone: row.phone || '',
        assignedTo: pickedName,
        ok: Boolean(ghlSync?.ok),
        reason: clean(ghlSync?.reason || ''),
        detail: clean(ghlSync?.detail || ''),
        status: ghlSync?.status || null
      });

      await postOutboundAssignment(settings, {
        event: 'lead_manual_bulk_release_assigned',
        assignedTo: pickedName,
        previousOwner,
        reason: row.releaseReason,
        timestamp: nowIso(),
        message: `Bulk-release lead assigned to ${pickedName}: ${row.name} (${row.phone || row.email || 'no contact'})`,
        lead: {
          id: row.externalId || row.id,
          name: row.name,
          email: row.email,
          phone: row.phone
        }
      });

      const emailNotify = await sendLeadAssignedEmail({
        assignedTo: pickedName,
        previousOwner,
        row,
        reason: row.releaseReason
      });
      events.push({
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'agent_email_notify',
        timestamp: nowIso(),
        dateKey: keys.dateKey,
        weekKey: keys.weekKey,
        monthKey: keys.monthKey,
        leadId: row.id,
        externalId: row.externalId || '',
        name: row.name || '',
        email: row.email || '',
        phone: row.phone || '',
        assignedTo: pickedName,
        ok: Boolean(emailNotify?.ok),
        reason: clean(emailNotify?.error || ''),
        detail: clean(emailNotify?.messageId || '')
      });

      updated += 1;
    }

    if (updated > 0) {
      await saveJsonStore(CALLER_PATH, leads);
      const trimmed = events.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()).slice(-5000);
      await saveJsonStore(EVENTS_PATH, trimmed);
    }

    return Response.json({ ok: true, mode: 'bulk-release-week-unsubmitted', strategy, targetAgent: targetAgent || null, requestedLeadIds: leadIds.length, updated });
  }

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
  const sponsorship = await loadJsonStore(SPONSORSHIP_PATH, []);
  const policySubmissions = await loadJsonStore(POLICY_SUBMISSIONS_PATH, []);
  const submittedBlockLookup = buildSubmittedBlockLookup(sponsorship, policySubmissions);
  const now = new Date();

  const mode = clean(body?.mode || '').toLowerCase();
  if (mode === 'run-delayed-release' || mode === 'process-delayed-release') {
    const releaseRun = await runDelayedReleasePass({ settings, leads, events, submittedBlockLookup, now });
    if (releaseRun.released || releaseRun.blockedSubmitted || releaseRun.blockedManualHold || releaseRun.waitingEligibleAgent) {
      await saveJsonStore(CALLER_PATH, leads);
      const trimmed = events.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()).slice(-5000);
      await saveJsonStore(EVENTS_PATH, trimmed);
    }
    return Response.json({ ok: true, mode: 'process-delayed-release', releaseRun });
  }

  const releaseRun = await runDelayedReleasePass({ settings, leads, events, submittedBlockLookup, now });

  const incoming = parseLeadPayload(body);
  const keys = {
    dateKey: cstDateKey(now),
    weekKey: cstWeekKey(now),
    monthKey: cstMonthKey(now)
  };
  const minute = cstMinuteOfDay(now);

  const counts = buildAgentCounts(settings, events, keys);
  const yesterdayCounts = computeYesterdayCounts(settings, events, now);
  const existingIdx = leads.findIndex((r) => r.externalId && r.externalId === incoming.externalId);

  let assignedTo = settings.overflowAgent || 'Kimora Link';
  let reason = 'overflow';

  if (settings.enabled) {
    if (settings.routingMode === 'delayed24h') {
      const existing = existingIdx >= 0 ? leads[existingIdx] : null;
      if (clean(existing?.releaseStatus || '') === 'released_to_agent' && clean(existing?.owner || '') && clean(existing?.owner || '') !== clean(settings.overflowAgent || '')) {
        assignedTo = existing.owner;
        reason = 'delayed_existing_released_preserved';
      } else {
        assignedTo = settings.overflowAgent || 'Kimora Link';
        reason = 'delayed_owner_window';
      }
    } else {
      const eligible = getEligibleAgents(settings, counts, minute);
      if (eligible.length) {
        const picked = pickBalancedEligible(eligible, counts, events, yesterdayCounts);
        if (picked?.name) {
          assignedTo = picked.name;
          reason = 'eligible_balanced_carryover';
        }
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
    releaseMode: settings.routingMode || 'live',
    manualHold: existingIdx >= 0 ? Boolean(leads[existingIdx].manualHold) : false,
    releaseEligibleAt: settings.routingMode === 'delayed24h'
      ? (existingIdx >= 0
        ? (leads[existingIdx].releaseEligibleAt || plusHoursIso(leads[existingIdx].createdAt || nowIso(), settings.delayedReleaseHours || 24))
        : plusHoursIso(nowIso(), settings.delayedReleaseHours || 24))
      : '',
    releaseStatus: settings.routingMode === 'delayed24h'
      ? (existingIdx >= 0
        ? (clean(leads[existingIdx].releaseStatus || '') || 'owner_window')
        : 'owner_window')
      : '',
    releasedAt: settings.routingMode === 'delayed24h' && existingIdx >= 0 ? (leads[existingIdx].releasedAt || '') : '',
    releaseReason: settings.routingMode === 'delayed24h' && existingIdx >= 0 ? (leads[existingIdx].releaseReason || '') : '',
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

  if (settings.routingMode === 'delayed24h' && (hasSponsorshipFormSubmitted(row) || isBlockedBySubmittedCrossCheck(row, submittedBlockLookup))) {
    row.releaseStatus = 'blocked_submitted';
  }

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
    mode: settings.mode,
    routingMode: settings.routingMode || 'live'
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

  return Response.json({ ok: true, assignedTo, reason, row, slaReassigned, routingMode: settings.routingMode || 'live', releaseRun });
}
