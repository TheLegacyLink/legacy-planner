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
const AGENT_ONBOARDING_PATH = 'stores/agent-onboarding.json';

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
  slaEnabled: false,
  slaMinutes: 10,
  slaAction: 'none'
};

function clean(v = '') {
  return String(v || '').trim();
}

// Agents permanently blocked from receiving any routed leads.
// This is a code-level override — the settings UI cannot re-activate these agents.
// Agents permanently blocked from receiving any routed leads.
// Code-level override — the settings UI cannot re-activate these agents.
// Per Kimora Link directive (2026-05-21): Andrea was receiving all leads due to
// a stale-UI race condition that kept overwriting her active flag back to true.
const ROUTING_BLOCKED_AGENTS = new Set([
  'Andrea Cannon',
]);

const AGENT_NAME_ALIASES = {
  'latricia wright': 'Leticia Wright',
  'latrisha wright': 'Leticia Wright',
  'letitia wright': 'Leticia Wright',
  'kellen brown': 'Kelin Brown',
  'madeline adams': 'Madalyn Adams',
  'andrea': 'Andrea Cannon',
  'angelica lassiter': 'Angelique Lassiter',
  'angelic lassiter': 'Angelique Lassiter',
  'donyellrichardson': 'Donyell Richardson',
  'donyell richardson': 'Donyell Richardson',
  'danielle': 'Donyell Richardson',
  'danielle richardson': 'Donyell Richardson'
};

const FIXED_GHL_USER_IDS = {
  'kimora link': 'iy1WzfhEHXaI5F637U0F',
  'jamal holmes': 'Gh7J9SiFRpzT1nS1lPFB',
  'mahogany burns': 'RDEgEcrGxHbqRLuVZ22b',
  'leticia wright': 'I9nwDZsv0HP0GROoVUBm',
  'kelin brown': 'IoGkWVZEYwhp41qYa5Am',
  'madalyn adams': 'FuF9KuVPMBbQdQRHxqkj',
  'breanna james': 'UDKjqrAVUIuBS9h1NoRl',
  'dr. breanna james': 'UDKjqrAVUIuBS9h1NoRl',
  'donyell richardson': 'lAbJTT3VKc4Zd0PiS7On',
  'shannon maxwell': 'NdPZIvVsm7PMfIDS1ZkR',
  'mirick whaley': 'cQxQQ7YuDN1wLk8f5nhI',
  'weiner merchant crumbly': 'ETglC9HYN105cxbm6mlx',
  'deshae ford': '2FGkAJuLhGHN7Sf7aRjo'
};

function normalizeAgentLabel(name = '') {
  const nm = clean(name);
  if (!nm) return '';
  return AGENT_NAME_ALIASES[nm.toLowerCase()] || nm;
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function isUnknownOwnerLabel(owner = '') {
  const s = normalize(owner);
  return !s || s === 'unknown' || s.includes('unknown');
}

// Returns the best displayable name for a lead record — falls back to email prefix or phone.
function bestLeadName(row = {}) {
  const name = clean(row?.name || '');
  const nameLower = name.toLowerCase();
  if (name && nameLower !== 'unknown' && nameLower !== 'unknown lead') return name;
  const email = clean(row?.email || '');
  if (email.includes('@')) return email.split('@')[0];
  return clean(row?.phone || '') || 'Unknown Lead';
}

function isKimoraOwner(owner = '') {
  return normalize(owner) === 'kimora link';
}

function safeJsonParse(raw, fallback = {}) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function buildAgentDirectory(rows = []) {
  const byName = new Map();
  for (const r of (rows || [])) {
    const key = normalize(r?.name || '');
    if (!key) continue;
    byName.set(key, r);
  }
  return { byName };
}

function findUserEmailByName(name = '', directory = null) {
  const n = normalize(name);
  const hit = (users || []).find((u) => normalize(u?.name || '') === n);
  if (clean(hit?.email)) return clean(hit.email);

  const mappedDir = clean(directory?.byName?.get(n)?.email || '');
  if (mappedDir) return mappedDir;

  const map = safeJsonParse(process.env.LEAD_AGENT_EMAIL_MAP_JSON || '{}', {});
  const mapped = clean(map?.[name] || map?.[n] || '');
  return mapped;
}

function leadConnectorCredentialForAgent(name = '', directory = null) {
  const dir = directory?.byName?.get(normalize(name));
  if (dir && (clean(dir?.leadConnectorEmail) || clean(dir?.leadConnectorPassword))) {
    return {
      email: clean(dir?.leadConnectorEmail || ''),
      password: clean(dir?.leadConnectorPassword || '')
    };
  }

  const map = safeJsonParse(process.env.LEAD_CONNECTOR_CREDENTIALS_JSON || '{}', {});
  const direct = map?.[name];
  const byLower = map?.[normalize(name)];
  const cfg = direct || byLower || null;
  if (!cfg || typeof cfg !== 'object') return null;
  return {
    email: clean(cfg.email || ''),
    password: clean(cfg.password || '')
  };
}

function hadPriorAssignments(events = [], assignedTo = '') {
  const target = normalizeAgentLabel(assignedTo).toLowerCase();
  return (events || []).some((e) => ASSIGNMENT_EVENT_TYPES.has(clean(e?.type || '')) && normalizeAgentLabel(e?.assignedTo || '').toLowerCase() === target);
}

function toTitleCase(str = '') {
  return clean(str).replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

async function sendLeadAssignedEmail({ assignedTo = '', row = {}, agentDirectory = null } = {}) {
  const to = findUserEmailByName(assignedTo, agentDirectory);
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!to || !user || !pass) return { ok: false, error: 'email_not_configured' };

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const leadName = toTitleCase(row?.name || 'Unknown Lead');
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
    '',
    'Please reach out as soon as possible.',
    '',
    '— The Legacy Link Support Team'
  ].join('\n');

  try {
    const info = await tx.sendMail({
      from,
      to,
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

function resolveOwnerUserId(assignedToName = '', directory = null) {
  const normalizedName = normalizeAgentLabel(assignedToName);
  const map = safeJsonParse(process.env.GHL_USER_ID_MAP_JSON || '{}', {});

  const direct = map?.[normalizedName] || map?.[assignedToName] || map?.[normalize(normalizedName)] || map?.[normalize(assignedToName)];
  if (direct) return String(direct);

  const fixed = clean(FIXED_GHL_USER_IDS[normalize(normalizedName)] || FIXED_GHL_USER_IDS[normalize(assignedToName)] || '');
  if (fixed) return fixed;

  const mappedDir = clean(directory?.byName?.get(normalize(normalizedName))?.ghlUserId || directory?.byName?.get(normalize(assignedToName))?.ghlUserId || '');
  if (mappedDir) return mappedDir;

  const fallback = clean(process.env.GHL_FALLBACK_USER_ID || '');
  return fallback || '';
}

// Fetch existing GHL contact tags so we can merge rather than overwrite
async function getGhlContactTags(contactId, token) {
  const headers = { Authorization: `Bearer ${token}`, Version: '2021-07-28' };
  const bases = [
    clean(process.env.GHL_API_BASE_URL || ''),
    'https://services.leadconnectorhq.com',
    'https://rest.gohighlevel.com'
  ].filter(Boolean);
  const paths = [`/contacts/${encodeURIComponent(contactId)}`, `/v1/contacts/${encodeURIComponent(contactId)}`];
  for (const base of bases) {
    for (const path of paths) {
      try {
        const res = await fetch(`${base.replace(/\/$/, '')}${path}`, { headers, cache: 'no-store' });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          // v2 returns contact.tags, v1 returns contact.tags as well
          const tags = data?.contact?.tags || data?.tags || [];
          return Array.isArray(tags) ? tags.map(String) : [];
        }
      } catch { /* try next */ }
    }
  }
  return [];
}

async function updateGhlContactOwner({ contactId, assignedUserId }) {
  const token = clean(process.env.GHL_API_TOKEN || '');
  if (!token || !contactId || !assignedUserId) {
    return { ok: false, reason: 'missing_ghl_config_or_ids' };
  }

  // Fetch existing tags, then merge in the 'legacy' tag
  const LEGACY_TAG = clean(process.env.GHL_LEAD_TAG || 'legacy');
  let existingTags = [];
  try { existingTags = await getGhlContactTags(contactId, token); } catch { /* best-effort */ }
  const mergedTags = existingTags.includes(LEGACY_TAG) ? existingTags : [...existingTags, LEGACY_TAG];

  const body = JSON.stringify({ assignedTo: assignedUserId, tags: mergedTags });
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
          return { ok: true, url, status: res.status, tagApplied: LEGACY_TAG };
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

// Tag a contact even when we don't need to change owner (e.g. on first intake)
async function applyGhlLegacyTag(contactId) {
  const token = clean(process.env.GHL_API_TOKEN || '');
  if (!token || !contactId) return { ok: false, reason: 'missing_token_or_id' };
  const LEGACY_TAG = clean(process.env.GHL_LEAD_TAG || 'legacy');
  let existingTags = [];
  try { existingTags = await getGhlContactTags(contactId, token); } catch { /* best-effort */ }
  if (existingTags.includes(LEGACY_TAG)) return { ok: true, reason: 'already_tagged' };
  const mergedTags = [...existingTags, LEGACY_TAG];
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Version: '2021-07-28' };
  const bases = [
    clean(process.env.GHL_API_BASE_URL || ''),
    'https://services.leadconnectorhq.com',
    'https://rest.gohighlevel.com'
  ].filter(Boolean);
  const paths = [`/contacts/${encodeURIComponent(contactId)}`, `/v1/contacts/${encodeURIComponent(contactId)}`];
  for (const base of bases) {
    for (const path of paths) {
      try {
        const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
          method: 'PUT', headers, body: JSON.stringify({ tags: mergedTags }), cache: 'no-store'
        });
        if (res.ok) return { ok: true, tag: LEGACY_TAG };
      } catch { /* try next */ }
    }
  }
  return { ok: false, reason: 'tag_update_failed' };
}

async function syncGhlOwnerForRelease({ row = {}, assignedTo = '', agentDirectory = null } = {}) {
  const contactId = clean(row?.externalId || row?.contactId || row?.id || '');
  const assignedUserId = resolveOwnerUserId(assignedTo, agentDirectory);
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

function cstMonthKeyFromIso(iso = '') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return cstMonthKey(d);
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

function hasLeadResponded(row = {}) {
  if (clean(row?.respondedAt || row?.lastResponseAt || row?.lastInboundAt || row?.replyAt)) return true;

  const stage = clean(row?.stage || '').toLowerCase();
  const respondedStages = [
    'responded',
    'replied',
    'connected',
    'qualified',
    'booked',
    'appointment set',
    'appointment booked',
    'form completed',
    'policy started',
    'approved',
    'onboarding started',
    'moved forward'
  ];
  if (respondedStages.some((s) => stage.includes(s))) return true;

  const dir = normalizeDirection(row?.lastMessageDirection || row?.lastContactDirection || row?.direction || '');
  if (dir === 'inbound') return true;

  return false;
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
  const capTotal = agent.capTotal == null || agent.capTotal === '' ? 0 : Number(agent.capTotal || 0);

  const count = counts[agent.name] || { today: 0, week: 0, month: 0, total: 0 };
  if (capDay > 0 && count.today >= capDay) return false;
  if (capWeek > 0 && count.week >= capWeek) return false;
  if (capMonth > 0 && count.month >= capMonth) return false;
  if (capTotal > 0 && count.total >= capTotal) return false;
  return true;
}

function getEligibleAgents(settings, counts, minute) {
  return settings.agents.filter((a) => {
    if (ROUTING_BLOCKED_AGENTS.has(clean(a.name))) return false;
    if (!a.active || a.paused) return false;
    return agentWithinCapsAndWindow(a, settings, counts, minute);
  });
}

function getDelayedEligibleAgents(settings, counts, minute) {
  return settings.agents.filter((a) => {
    if (ROUTING_BLOCKED_AGENTS.has(clean(a.name))) return false;
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
    const isBlocked = ROUTING_BLOCKED_AGENTS.has(clean(name));
    return {
      name,
      active: isBlocked ? false : (current?.active ?? true),
      paused: isBlocked ? true : (current?.paused ?? false),
      delayedReleaseEnabled: current?.delayedReleaseEnabled ?? false,
      windowStart: clean(current?.windowStart || '09:00') || '09:00',
      windowEnd: clean(current?.windowEnd || '21:00') || '21:00',
      capPerDay: current?.capPerDay == null || current?.capPerDay === '' ? null : Number(current.capPerDay),
      capPerWeek: current?.capPerWeek == null || current?.capPerWeek === '' ? null : Number(current.capPerWeek),
      capPerMonth: current?.capPerMonth == null || current?.capPerMonth === '' ? null : Number(current.capPerMonth),
      capTotal: current?.capTotal == null || current?.capTotal === '' ? null : Number(current.capTotal),
      group: current?.group ?? (DEFAULT_CONFIG?.agentGroups?.[name] || 'sponsorship')
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
  // Treat placeholder values as blank — fall through to email/phone instead of storing 'Unknown'
  const rawName = clean(candidate.name);
  const nameIsPlaceholder = !rawName || rawName.toLowerCase() === 'unknown' || rawName.toLowerCase() === 'unknown lead';
  const email = clean(candidate.email || '').toLowerCase();
  const phone = clean(candidate.phone || candidate.phoneNumber || candidate.phone_number || '');
  const fullName = (!nameIsPlaceholder ? rawName : null)
    || clean(`${first} ${last}`)
    || (email.includes('@') ? email.split('@')[0] : '')
    || phone
    || 'Unknown Lead';

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

// True sequential round-robin: advances a pointer through the active agent list.
// Returns { agent, nextPointer } so the caller can persist the new pointer.
function pickRoundRobin(settings = {}, counts = {}, minute = 0) {
  const active = (settings.agents || []).filter((a) => a.active && !a.paused);
  if (!active.length) return { agent: null, nextPointer: 0 };

  const ptr = Number(settings.rrPointer || 0);
  const len = active.length;

  // Walk from the current pointer, skipping anyone who is over their caps or outside window
  for (let i = 0; i < len; i++) {
    const idx = (ptr + i) % len;
    const candidate = active[idx];
    if (!agentWithinCapsAndWindow(candidate, settings, counts, minute)) continue;
    // Found eligible — advance pointer past this agent for next call
    const nextPointer = (idx + 1) % len;
    return { agent: candidate, nextPointer };
  }

  // All agents are capped/outside window — fall through to overflow
  return { agent: null, nextPointer: ptr };
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

function buildAgentCounts(settings, events, keys, leads = []) {
  const counts = {};
  for (const a of settings.agents) counts[a.name] = { today: 0, week: 0, month: 0, total: 0 };

  // Count from events (historical)
  for (const e of events) {
    if (!ASSIGNMENT_EVENT_TYPES.has(clean(e?.type || ''))) continue;
    const owner = clean(e?.assignedTo || '');
    if (!counts[owner]) counts[owner] = { today: 0, week: 0, month: 0, total: 0 };
    if (e?.dateKey === keys.dateKey) counts[owner].today += 1;
    if (e?.weekKey === keys.weekKey) counts[owner].week += 1;
    if (e?.monthKey === keys.monthKey) counts[owner].month += 1;
    counts[owner].total += 1;
  }

  // Also count directly from leads store (catches concurrent assignments events haven't recorded yet)
  const leadCounts = {};
  for (const row of leads) {
    const owner = clean(row?.owner || row?.assignedTo || '');
    if (!owner) continue;
    const created = row?.createdAt || '';
    if (!created) continue;
    const d = new Date(created);
    if (Number.isNaN(d.getTime())) continue;
    const rowDateKey = cstDateKey(d);
    const rowWeekKey = cstWeekKey(d);
    const rowMonthKey = cstMonthKey(d);
    if (!leadCounts[owner]) leadCounts[owner] = { today: 0, week: 0, month: 0, total: 0 };
    if (rowDateKey === keys.dateKey) leadCounts[owner].today += 1;
    if (rowWeekKey === keys.weekKey) leadCounts[owner].week += 1;
    if (rowMonthKey === keys.monthKey) leadCounts[owner].month += 1;
  }

  // Use the higher of events vs lead-row counts (more conservative = better cap enforcement)
  for (const owner of new Set([...Object.keys(counts), ...Object.keys(leadCounts)])) {
    if (!counts[owner]) counts[owner] = { today: 0, week: 0, month: 0, total: 0 };
    counts[owner].today = Math.max(counts[owner].today, leadCounts[owner]?.today || 0);
    counts[owner].week = Math.max(counts[owner].week, leadCounts[owner]?.week || 0);
    counts[owner].month = Math.max(counts[owner].month, leadCounts[owner]?.month || 0);
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

async function runDelayedReleasePass({ settings, leads, events, submittedBlockLookup = new Set(), agentDirectory = null, now = new Date() }) {
  if (!shouldRunDelayedRelease(settings)) {
    return { released: 0, blockedSubmitted: 0, blockedResponded: 0, blockedManualHold: 0, waitingWindow: 0, waitingEligibleAgent: 0 };
  }

  const keys = {
    dateKey: cstDateKey(now),
    weekKey: cstWeekKey(now),
    monthKey: cstMonthKey(now)
  };
  const minute = cstMinuteOfDay(now);
  const yesterdayCounts = computeYesterdayCounts(settings, events, now);
  const counts = buildAgentCounts(settings, events, keys, leads);

  const out = {
    released: 0,
    blockedSubmitted: 0,
    blockedResponded: 0,
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

    if (hasLeadResponded(row)) {
      if (clean(row?.releaseStatus || '') !== 'blocked_responded_inhouse') {
        row.releaseStatus = 'blocked_responded_inhouse';
        row.updatedAt = nowIso();
      }
      out.blockedResponded += 1;
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
    const isFirstLeadForAgent = !hadPriorAssignments(events, picked.name);
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
      name: bestLeadName(row),
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

    const ghlSync = await syncGhlOwnerForRelease({ row, assignedTo: picked.name, agentDirectory });
    events.push({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'ghl_owner_sync',
      timestamp: nowIso(),
      dateKey: keys.dateKey,
      weekKey: keys.weekKey,
      monthKey: keys.monthKey,
      leadId: row.id,
      externalId: row.externalId || '',
      name: bestLeadName(row),
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
      row,
      agentDirectory
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
      name: bestLeadName(row),
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

function monthKeyWithOffset(now = new Date(), offsetMonths = 0) {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() + Number(offsetMonths || 0));
  return cstMonthKey(d);
}

function hasBookedAppointment(row = {}) {
  if (clean(row?.bookedAt || row?.appointmentAt || row?.appointmentDate || row?.appointmentDateTime)) return true;
  const stage = clean(row?.stage || '').toLowerCase();
  const bookedStages = ['booked', 'appointment set', 'appointment booked', 'no-show', 'rescheduled'];
  return bookedStages.some((s) => stage.includes(s));
}

function buildWeekUnsubmittedLeads(leads = [], submittedBlockLookup = new Set(), now = new Date(), distributionMonthScope = 'current') {
  const monthKey = distributionMonthScope === 'previous' ? monthKeyWithOffset(now, -1) : cstMonthKey(now);
  return (leads || [])
    .filter((r) => cstMonthKeyFromIso(r?.createdAt || r?.updatedAt || '') === monthKey)
    .map((r) => {
      const submitted = hasSponsorshipFormSubmitted(r) || isBlockedBySubmittedCrossCheck(r, submittedBlockLookup);
      const booked = hasBookedAppointment(r);
      const prioritySponsorshipNotBooked = submitted && !booked;
      return {
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
        responded: hasLeadResponded(r),
        submitted,
        booked,
        prioritySponsorshipNotBooked,
        releaseEligibleAt: r.releaseEligibleAt || ''
      };
    })
    .sort((a, b) => {
      if (a.prioritySponsorshipNotBooked !== b.prioritySponsorshipNotBooked) return a.prioritySponsorshipNotBooked ? -1 : 1;
      return new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();
    })
    .slice(0, 500);
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
  const distributionMonthScope = clean(searchParams.get('distributionMonthScope')).toLowerCase() === 'previous' ? 'previous' : 'current';

  const settings = withDefaults(await loadJsonFile(SETTINGS_PATH, DEFAULT_SETTINGS));
  const events = await loadJsonStore(EVENTS_PATH, []);
  const leads = await loadJsonStore(CALLER_PATH, []);
  const sponsorship = await loadJsonStore(SPONSORSHIP_PATH, []);
  const policySubmissions = await loadJsonStore(POLICY_SUBMISSIONS_PATH, []);
  const agentOnboarding = await loadJsonStore(AGENT_ONBOARDING_PATH, []);
  const agentDirectory = buildAgentDirectory(agentOnboarding);
  const submittedBlockLookup = buildSubmittedBlockLookup(sponsorship, policySubmissions);

  let releaseRun = { released: 0, blockedSubmitted: 0, blockedResponded: 0, blockedManualHold: 0, waitingWindow: 0, waitingEligibleAgent: 0 };
  if (runRelease) {
    releaseRun = await runDelayedReleasePass({ settings, leads, events, submittedBlockLookup, agentDirectory, now: new Date() });
    if (releaseRun.released || releaseRun.blockedSubmitted || releaseRun.blockedResponded || releaseRun.blockedManualHold || releaseRun.waitingEligibleAgent) {
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

  const counts = buildAgentCounts(settings, events, keys, leads);
  const yesterdayCounts = computeYesterdayCounts(settings, events, new Date());

  const sponsorshipMap = sponsorshipLookup(sponsorship);
  const ownerLookup = buildOwnerLookup(events);
  const callMetrics = buildCallMetrics(settings, leads, sponsorshipMap, ownerLookup);
  const calledLeadRows = buildCalledLeadRows(leads, sponsorshipMap, ownerLookup, settings, submittedBlockLookup);

  // Build lead lookup maps (must come before recent events enrichment)
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

  // Build recent events — fill in missing/unknown names from leads store before sending to UI
  const recent = enrichEvents(events, sponsorshipMap)
    .map((e) => {
      const nameBlank = !clean(e?.name) || clean(e?.name).toLowerCase() === 'unknown' || clean(e?.name).toLowerCase() === 'unknown lead';
      if (!nameBlank) return e;
      const byId = leadById.get(clean(e?.leadId || ''));
      const byExt = leadByExternalId.get(clean(e?.leadId || ''));
      const byEmail = e?.email ? leadByEmail.get(clean(e.email).toLowerCase()) : null;
      const byPhone = e?.phone ? leadByPhone.get(normalizePhone(e.phone)) : null;
      const row = byId || byExt || byEmail || byPhone;
      if (!row) return e;
      const resolvedName = clean(row?.name || `${clean(row?.firstName || '')} ${clean(row?.lastName || '')}`.trim());
      const resolvedEmail = clean(row?.email || e?.email || '');
      const resolvedPhone = clean(row?.phone || e?.phone || '');
      const bestName = resolvedName && resolvedName.toLowerCase() !== 'unknown'
        ? resolvedName
        : resolvedEmail.includes('@') ? resolvedEmail.split('@')[0]
        : resolvedPhone || clean(e?.name || '');
      return { ...e, name: bestName, email: resolvedEmail || e?.email || '', phone: resolvedPhone || e?.phone || '' };
    })
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 300);

  const ghlSyncEvents = [...(events || [])]
    .filter((e) => clean(e?.type || '') === 'ghl_owner_sync')
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

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
    .filter((r) => !hasSponsorshipFormSubmitted(r) && !hasLeadResponded(r) && !isBlockedBySubmittedCrossCheck(r, submittedBlockLookup))
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
      responded: hasLeadResponded(r),
      formCompletedAt: r.formCompletedAt || ''
    }));
  const weekUnsubmittedLeads = buildWeekUnsubmittedLeads(leads, submittedBlockLookup, new Date(), distributionMonthScope);
  const distributionMonthKey = distributionMonthScope === 'previous' ? monthKeyWithOffset(new Date(), -1) : cstMonthKey(new Date());

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

  return Response.json({ ok: true, settings, counts, recent, keys, tomorrowStartOrder, callMetrics, calledLeadRows, delayedQueue, weekUnsubmittedLeads, distributionMonthScope, distributionMonthKey, releaseRun, ghlSyncSummary });
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
    const agentOnboarding = await loadJsonStore(AGENT_ONBOARDING_PATH, []);
    const agentDirectory = buildAgentDirectory(agentOnboarding);
    const submittedBlockLookup = buildSubmittedBlockLookup(sponsorship, policySubmissions);
    const now = new Date();

    const strategy = clean(body?.strategy || 'auto').toLowerCase(); // auto | agent
    const targetAgent = clean(body?.targetAgent || '');
    const leadIds = Array.isArray(body?.leadIds) ? body.leadIds.map((x) => clean(x)).filter(Boolean) : [];
    const leadIdSet = new Set(leadIds);

    const distributionMonthScope = clean(body?.distributionMonthScope || '').toLowerCase() === 'previous' ? 'previous' : 'current';

    const keys = {
      dateKey: cstDateKey(now),
      weekKey: cstWeekKey(now),
      monthKey: cstMonthKey(now)
    };
    const targetMonthKey = distributionMonthScope === 'previous' ? monthKeyWithOffset(now, -1) : keys.monthKey;
    const counts = buildAgentCounts(settings, events, keys, leads);

    const candidates = (leads || [])
      .filter((r) => cstMonthKeyFromIso(r?.createdAt || r?.updatedAt || '') === targetMonthKey)
      .filter((r) => !isUnknownOwnerLabel(r?.owner || ''))
      .filter((r) => isKimoraOwner(r?.owner || ''))
      .filter((r) => !Boolean(r?.manualHold))
      .filter((r) => !hasBookedAppointment(r))
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
      const isFirstLeadForAgent = !hadPriorAssignments(events, pickedName);
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
        name: bestLeadName(row),
        email: row.email || '',
        phone: row.phone || '',
        assignedTo: pickedName,
        previousOwner,
        reason: row.releaseReason,
        mode: settings.mode,
        routingMode: settings.routingMode || 'live'
      });

      const ghlSync = await syncGhlOwnerForRelease({ row, assignedTo: pickedName, agentDirectory });
      // Apply 'legacy' tag — triggers initial email workflow in GHL (best-effort)
      const bulkContactId = clean(row?.externalId || row?.id || '');
      if (bulkContactId) applyGhlLegacyTag(bulkContactId).catch(() => {});
      events.push({
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'ghl_owner_sync',
        timestamp: nowIso(),
        dateKey: keys.dateKey,
        weekKey: keys.weekKey,
        monthKey: keys.monthKey,
        leadId: row.id,
        externalId: row.externalId || '',
        name: bestLeadName(row),
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
        row,
        agentDirectory
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
        name: bestLeadName(row),
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

    return Response.json({ ok: true, mode: 'bulk-release-week-unsubmitted', strategy, distributionMonthScope, distributionMonthKey: targetMonthKey, targetAgent: targetAgent || null, requestedLeadIds: leadIds.length, updated });
  }

  const current = withDefaults(await loadJsonFile(SETTINGS_PATH, DEFAULT_SETTINGS));

  const next = withDefaults({
    ...current,
    ...(body?.patch || {})
  });

  await saveJsonFile(SETTINGS_PATH, next);

  // After saving agents, run a catch-up pass to fill gaps for newly-active agents
  const catchUpResults = [];
  if (body?.patch?.agents && Array.isArray(body.patch.agents)) {
    try {
      const leads = await loadJsonStore(CALLER_PATH, []);
      const events = await loadJsonStore(EVENTS_PATH, []);
      const agentOnboarding = await loadJsonStore(AGENT_ONBOARDING_PATH, []);
      const agentDirectory = buildAgentDirectory(agentOnboarding);
      const now = new Date();
      const todayKey = cstDateKey(now);
      const overflowName = clean(next.overflowAgent || 'Kimora Link');

      // Count today's leads per agent from events
      const todayCounts = {};
      for (const e of events) {
        if (clean(e?.type || '') !== 'assigned') continue;
        if (clean(e?.dateKey || '') !== todayKey) continue;
        const a = clean(e?.assignedTo || '');
        todayCounts[a] = (todayCounts[a] || 0) + 1;
      }

      // Pool: overflow leads from today (assigned to overflowAgent, no progress)
      const overflowPool = leads
        .map((r, idx) => ({ ...r, _idx: idx }))
        .filter((r) => {
          if (normalize(clean(r?.owner || '')) !== normalize(overflowName)) return false;
          if (cstDateKeyFromIso(r?.createdAt || '') !== todayKey) return false;
          if (r?.calledAt || r?.connectedAt || r?.qualifiedAt) return false; // skip if progressed
          return true;
        });

      let poolIdx = 0;

      for (const agent of next.agents) {
        if (!agent.active) continue;
        if (normalize(clean(agent.name)) === normalize(overflowName)) continue;
        const cap = agent.capPerDay ?? next.maxPerDay ?? 0;
        if (!cap) continue;
        const current = todayCounts[clean(agent.name)] || 0;
        const gap = Math.max(0, cap - current);
        if (!gap) continue;

        for (let i = 0; i < gap && poolIdx < overflowPool.length; i++, poolIdx++) {
          const lead = overflowPool[poolIdx];
          const assignedTo = clean(agent.name);

          // Update lead record
          leads[lead._idx] = {
            ...leads[lead._idx],
            owner: assignedTo,
            updatedAt: nowIso(),
          };

          // Log event
          const keys = { dateKey: cstDateKey(now), weekKey: cstWeekKey(now), monthKey: cstMonthKey(now) };
          events.push({
            id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'assigned',
            timestamp: nowIso(),
            dateKey: keys.dateKey,
            weekKey: keys.weekKey,
            monthKey: keys.monthKey,
            leadId: clean(lead.id || ''),
            externalId: clean(lead.externalId || ''),
            name: clean(lead.name || ''),
            email: clean(lead.email || ''),
            phone: clean(lead.phone || ''),
            assignedTo,
            reason: 'catch_up_redistribution',
            mode: next.mode,
            routingMode: next.routingMode || 'live',
          });

          // Send email notification
          const isFirstLead = (todayCounts[assignedTo] || 0) + catchUpResults.filter((r) => r.assignedTo === assignedTo).length === 0;
          const emailResult = await sendLeadAssignedEmail({
            assignedTo,
            row: lead,
            agentDirectory,
          });

          catchUpResults.push({ leadId: clean(lead.id || ''), name: clean(lead.name || ''), assignedTo, emailSent: emailResult?.ok === true });

          // Update GHL contact owner + apply 'legacy' tag to trigger initial email workflow
          syncGhlOwnerForRelease({ row: lead, assignedTo, agentDirectory }).catch(() => {});
          const catchUpContactId = clean(lead?.externalId || lead?.id || '');
          if (catchUpContactId) applyGhlLegacyTag(catchUpContactId).catch(() => {});
        }
      }

      if (catchUpResults.length > 0) {
        await saveJsonStore(CALLER_PATH, leads);
        const trimmed = events.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)).slice(-5000);
        await saveJsonStore(EVENTS_PATH, trimmed);
      }
    } catch (e) {
      // Non-fatal - settings were already saved
      catchUpResults.push({ error: String(e?.message || e) });
    }
  }

  return Response.json({ ok: true, settings: next, catchUp: { ran: body?.patch?.agents != null, distributed: catchUpResults.filter((r) => !r.error).length, results: catchUpResults } });
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
  const agentOnboarding = await loadJsonStore(AGENT_ONBOARDING_PATH, []);
  const agentDirectory = buildAgentDirectory(agentOnboarding);
  const submittedBlockLookup = buildSubmittedBlockLookup(sponsorship, policySubmissions);
  const now = new Date();

  const mode = clean(body?.mode || '').toLowerCase();
  if (mode === 'run-delayed-release' || mode === 'process-delayed-release') {
    const releaseRun = await runDelayedReleasePass({ settings, leads, events, submittedBlockLookup, agentDirectory, now });
    if (releaseRun.released || releaseRun.blockedSubmitted || releaseRun.blockedResponded || releaseRun.blockedManualHold || releaseRun.waitingEligibleAgent) {
      await saveJsonStore(CALLER_PATH, leads);
      const trimmed = events.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()).slice(-5000);
      await saveJsonStore(EVENTS_PATH, trimmed);
    }
    return Response.json({ ok: true, mode: 'process-delayed-release', releaseRun });
  }

  const releaseRun = await runDelayedReleasePass({ settings, leads, events, submittedBlockLookup, agentDirectory, now });

  const incoming = parseLeadPayload(body);
  const keys = {
    dateKey: cstDateKey(now),
    weekKey: cstWeekKey(now),
    monthKey: cstMonthKey(now)
  };
  const minute = cstMinuteOfDay(now);

  const counts = buildAgentCounts(settings, events, keys, leads);
  const yesterdayCounts = computeYesterdayCounts(settings, events, now);
  const existingIdx = leads.findIndex((r) => r.externalId && r.externalId === incoming.externalId);

  // ─── Owner Lock: once a lead has a valid assigned owner, NEVER auto-reassign it.
  // The only way to change a lead's owner is manually through the UI.
  // This prevents GHL sync re-processing or any other trigger from bouncing leads between agents.
  if (existingIdx >= 0) {
    const existingOwner = clean(leads[existingIdx]?.owner || '');
    if (existingOwner && !isUnknownOwnerLabel(existingOwner)) {
      // Update contact info only (name/email/phone may have improved from GHL), preserve owner
      leads[existingIdx] = {
        ...leads[existingIdx],
        name: isUnknownOwnerLabel(leads[existingIdx]?.name || '') && !isUnknownOwnerLabel(incoming.name) ? incoming.name : leads[existingIdx].name,
        email: incoming.email || leads[existingIdx].email,
        phone: incoming.phone || leads[existingIdx].phone,
        updatedAt: nowIso()
      };
      await saveJsonStore(CALLER_PATH, leads);
      return Response.json({ ok: true, assignedTo: existingOwner, reason: 'existing_owner_preserved', skipped: true, row: leads[existingIdx] });
    }
  }

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
    } else if (settings.mode === 'round_robin') {
      const { agent: picked, nextPointer } = pickRoundRobin(settings, counts, minute);
      if (picked?.name) {
        assignedTo = picked.name;
        reason = 'round_robin';
        // Persist the advanced pointer back into settings so the next lead picks up where we left off
        settings.rrPointer = nextPointer;
        saveJsonFile(SETTINGS_PATH, settings).catch(() => {});
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


  // SLA speed-to-lead auto-reassign is DISABLED.
  // Leads are never automatically moved between agents — only manual reassignment is allowed.
  const slaReassigned = 0;

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

  if (settings.routingMode === 'delayed24h') {
    if (hasSponsorshipFormSubmitted(row) || isBlockedBySubmittedCrossCheck(row, submittedBlockLookup)) {
      row.releaseStatus = 'blocked_submitted';
    } else if (hasLeadResponded(row)) {
      row.releaseStatus = 'blocked_responded_inhouse';
    }
  }

  const previousOwnerLive = existingIdx >= 0 ? clean(leads[existingIdx]?.owner || '') : '';
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
  // GHL owner sync for ALL live assignments (overflow + agents)
  // Email notification only for non-overflow agents
  if (assignedTo) {
    const isNonOverflow = assignedTo !== (settings.overflowAgent || 'Kimora Link');
    const isFirstLeadForAgent = isNonOverflow ? !hadPriorAssignments(events, assignedTo) : false;

    const ghlSync = await syncGhlOwnerForRelease({ row, assignedTo, agentDirectory });
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
      assignedTo,
      ok: Boolean(ghlSync?.ok),
      reason: clean(ghlSync?.error || ghlSync?.reason || ''),
      detail: ''
    });

    if (isNonOverflow) {
      const emailNotify = await sendLeadAssignedEmail({
        assignedTo,
        row,
        agentDirectory
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
        assignedTo,
        ok: Boolean(emailNotify?.ok),
        reason: clean(emailNotify?.error || ''),
        detail: clean(emailNotify?.messageId || '')
      });
    }
  }

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

  // Apply 'legacy' tag on the GHL contact — this triggers the initial email workflow.
  // Best-effort: fires after response so it never blocks lead assignment.
  const incomingContactId = clean(incoming.externalId || incoming.id || '');
  if (incomingContactId) {
    applyGhlLegacyTag(incomingContactId).catch(() => {});
  }

  return Response.json({ ok: true, assignedTo, reason, row, slaReassigned, routingMode: settings.routingMode || 'live', releaseRun });
}
