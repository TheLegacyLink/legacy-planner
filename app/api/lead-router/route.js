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
  timezone: 'America/Chicago',
  overflowAgent: 'Kimora Link',
  agents: (DEFAULT_CONFIG?.agents || []).map((name) => ({
    name,
    active: true,
    paused: false,
    windowStart: '09:00',
    windowEnd: '21:00',
    capPerDay: null
  })),
  outboundWebhookUrl: '',
  outboundToken: ''
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

function cstDateKey(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = fmt.formatToParts(date);
  const pick = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
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
      capPerDay: current?.capPerDay == null || current?.capPerDay === '' ? null : Number(current.capPerDay)
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

async function postOutboundAssignment(settings, payload) {
  const url = clean(settings?.outboundWebhookUrl || '');
  if (!url) return;

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

function enrichEvents(events = [], sponsorshipMap = new Map()) {
  return events.map((e) => {
    const n = normalizeName(e?.name || '');
    const em = clean(e?.email || '').toLowerCase();
    const ph = normalizePhone(e?.phone || '');
    const sponsorshipStatus = sponsorshipMap.get(`e:${em}`) || sponsorshipMap.get(`p:${ph}`) || sponsorshipMap.get(`n:${n}`) || '';
    return { ...e, sponsorshipStatus };
  });
}

export async function GET() {
  const settings = withDefaults(await loadJsonFile(SETTINGS_PATH, DEFAULT_SETTINGS));
  const events = await loadJsonStore(EVENTS_PATH, []);
  const sponsorship = await loadJsonStore(SPONSORSHIP_PATH, []);

  const today = cstDateKey();
  const counts = {};
  for (const a of settings.agents) counts[a.name] = 0;

  for (const e of events) {
    if (e?.type !== 'assigned') continue;
    if (e?.dateKey !== today) continue;
    const owner = clean(e?.assignedTo || '');
    counts[owner] = Number(counts[owner] || 0) + 1;
  }

  const sponsorshipMap = sponsorshipLookup(sponsorship);
  const recent = enrichEvents(events, sponsorshipMap).sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).slice(0, 300);

  return Response.json({ ok: true, settings, counts, recent, today });
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
  const dateKey = cstDateKey(now);
  const minute = cstMinuteOfDay(now);

  const counts = {};
  for (const a of settings.agents) counts[a.name] = 0;
  for (const e of events) {
    if (e?.type !== 'assigned' || e?.dateKey !== dateKey) continue;
    counts[e.assignedTo] = Number(counts[e.assignedTo] || 0) + 1;
  }

  let assignedTo = settings.overflowAgent || 'Kimora Link';
  let reason = 'overflow';

  if (settings.enabled) {
    const eligible = settings.agents.filter((a) => {
      if (!a.active || a.paused) return false;
      const startMin = parseTimeToMin(a.windowStart || '00:00');
      const endMin = parseTimeToMin(a.windowEnd || '23:59');
      const inWindow = minute >= startMin && minute <= endMin;
      if (!inWindow) return false;
      const cap = a.capPerDay == null ? Number(settings.maxPerDay || 0) : Number(a.capPerDay || 0);
      if (cap > 0 && Number(counts[a.name] || 0) >= cap) return false;
      return true;
    });

    if (eligible.length) {
      const picked = settings.mode === 'random' ? randomPick(eligible) : randomPick(eligible);
      if (picked?.name) {
        assignedTo = picked.name;
        reason = 'eligible_random';
      }
    }
  } else {
    reason = 'router_disabled';
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
    dateKey,
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
    lead: {
      id: incoming.externalId || row.id,
      name: incoming.name,
      email: incoming.email,
      phone: incoming.phone
    }
  });

  return Response.json({ ok: true, assignedTo, reason, row });
}
