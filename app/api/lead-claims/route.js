import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import nodemailer from 'nodemailer';
import users from '../../../data/innerCircleUsers.json';
import licensedAgents from '../../../data/licensedAgents.json';

const SPONSORSHIP_BOOKINGS_PATH = 'stores/sponsorship-bookings.json';
const POLICY_SUBMISSIONS_PATH = 'stores/policy-submissions.json';
const SPONSORSHIP_APPLICATIONS_PATH = 'stores/sponsorship-applications.json';
const BONUS_BOOKINGS_PATH = 'stores/bonus-bookings.json';
const SETTINGS_PATH = 'stores/lead-claims-settings.json';
const AGENT_ONBOARDING_PATH = 'stores/agent-onboarding.json';

const LICENSE_OVERRIDES = {
  'kelin brown': ['AZ', 'CA', 'CO', 'FL', 'MI', 'NE', 'NV', 'OH', 'OK', 'RI', 'TX', 'VA'],
  'jamal holmes': ['NJ', 'MD', 'FL', 'TX', 'PA'],
  'leticia wright': ['CO', 'FL', 'MO', 'NV', 'NC', 'TX'],
  'dr. breanna': ['CA', 'FL'],
  'breanna james': ['CA', 'FL']
};

const REFERRED_BY_ALIASES = {
  link: 'Kimora Link',
  kimoralink: 'Kimora Link',
  kimora_link: 'Kimora Link',
  'kimora link': 'Kimora Link',
  camorlink: 'Kimora Link'
};

const AGENT_TIMEZONE_BY_NAME = {
  'kimora link': 'CT',
  'kelin brown': 'PT',
  'jamal holmes': 'ET',
  'leticia wright': 'MT',
  'breanna james': 'PT',
  'dr. breanna': 'PT',
  'mahogany burns': 'ET',
  'madalyn adams': 'CT'
};

const ZONE_OFFSET = { ET: -5, CT: -6, MT: -7, PT: -8, AKT: -9, HT: -10, AT: -4 };

const MANUAL_BOOKING_FALLBACK = [
  { id: 'lc_fb_haneef_s', source_application_id: 'manual_haneef_s_20260316', applicant_name: 'Haneef S', applicant_state: 'CO', requested_at_est: '2026-03-16 9:00 AM', referred_by: 'Link' },
  { id: 'lc_fb_juan_v', source_application_id: 'manual_juan_v_20260316', applicant_name: 'Juan V', applicant_state: 'OK', requested_at_est: '2026-03-16 11:00 AM', referred_by: 'Link' },
  { id: 'lc_fb_latoya_l', source_application_id: 'manual_latoya_l_20260318', applicant_name: 'LaToya L', applicant_state: 'MD', requested_at_est: '2026-03-18 1:00 PM', referred_by: 'Link' },
  { id: 'lc_fb_javion_b', source_application_id: 'manual_javion_b_20260319', applicant_name: 'Javion B', applicant_state: 'VA', requested_at_est: '2026-03-19 11:00 AM', referred_by: 'Link' },
  { id: 'lc_fb_lenord_l', source_application_id: 'manual_lenord_l_20260320', applicant_name: 'Lenord L', applicant_state: 'VA', requested_at_est: '2026-03-20 12:00 PM', referred_by: 'Link' }
];

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function normalizeKey(v = '') {
  return clean(v).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function applicantNameKey(v = '') {
  return normalizeKey(v);
}

function nameInitialSignature(v = '') {
  const parts = clean(v).split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = normalize(parts[0]);
  const last = normalize(parts.length > 1 ? parts[parts.length - 1] : '');
  if (!first) return '';
  const li = last ? last.charAt(0) : '';
  return `${first}|${li}`;
}

function stateNameSignature(state = '', name = '') {
  const st = stateCodeFromAny(state);
  const sig = nameInitialSignature(name);
  if (!st || !sig) return '';
  return `${st}|${sig}`;
}

function stateCodeFromAny(v = '') {
  const raw = clean(v).toUpperCase();
  if (!raw) return '';
  if (raw.length === 2) return raw;
  const map = {
    ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA', COLORADO: 'CO',
    CONNECTICUT: 'CT', DELAWARE: 'DE', FLORIDA: 'FL', GEORGIA: 'GA', HAWAII: 'HI', IDAHO: 'ID',
    ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS', KENTUCKY: 'KY', LOUISIANA: 'LA',
    MAINE: 'ME', MARYLAND: 'MD', MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN', MISSISSIPPI: 'MS',
    MISSOURI: 'MO', MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
    'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', OHIO: 'OH',
    OKLAHOMA: 'OK', OREGON: 'OR', PENNSYLVANIA: 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT', VERMONT: 'VT', VIRGINIA: 'VA',
    WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV', WISCONSIN: 'WI', WYOMING: 'WY', 'DISTRICT OF COLUMBIA': 'DC'
  };
  return map[raw] || raw.slice(0, 2);
}

function titleCaseWords(v = '') {
  return clean(v)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function enrichInitialNames(rows = [], appRows = [], policyRows = []) {
  const list = Array.isArray(rows) ? [...rows] : [];
  const initials = /^([A-Za-z][A-Za-z\-']*)\s+([A-Za-z])\.?$/;

  const index = new Map();
  const pushCand = (st = '', first = '', last = '', full = '') => {
    const f = normalize(first);
    const l = clean(last);
    const s = stateCodeFromAny(st);
    if (!f || !l) return;
    const key = `${s}|${f}|${normalize(l[0])}`;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(titleCaseWords(full || `${first} ${last}`.trim()));
  };

  for (const a of (appRows || [])) {
    pushCand(a?.state, a?.firstName, a?.lastName, `${clean(a?.firstName || '')} ${clean(a?.lastName || '')}`.trim());
  }

  for (const p of (policyRows || [])) {
    const full = clean(p?.applicantName || p?.applicant_name || p?.name || '');
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue;
    const first = parts[0];
    const last = parts[parts.length - 1];
    pushCand(p?.applicantState || p?.state, first, last, full);
  }

  return list.map((r) => {
    const name = clean(r?.applicant_name || '');
    const m = name.match(initials);
    if (!m) return r;
    const st = stateCodeFromAny(r?.applicant_state || '');
    const key = `${st}|${normalize(m[1])}|${normalize(m[2])}`;
    const cands = Array.from(new Set(index.get(key) || []));
    if (cands.length !== 1) return r;
    return { ...r, applicant_name: cands[0], applicant_first_name: clean(cands[0].split(/\s+/)[0]), applicant_last_name: clean(cands[0].split(/\s+/).slice(1).join(' ')) };
  });
}

function nowIso() {
  return new Date().toISOString();
}

const DEFAULT_WEEKLY_CLAIM_CAP = Math.max(1, Number(process.env.LEAD_CLAIMS_WEEKLY_CAP || 2));

async function getClaimSettings() {
  const raw = await loadJsonStore(SETTINGS_PATH, { weeklyClaimCap: DEFAULT_WEEKLY_CLAIM_CAP });
  const weeklyClaimCap = Math.max(1, Number(raw?.weeklyClaimCap || DEFAULT_WEEKLY_CLAIM_CAP));
  return { weeklyClaimCap };
}

async function saveClaimSettings(next = {}) {
  const weeklyClaimCap = Math.max(1, Number(next?.weeklyClaimCap || DEFAULT_WEEKLY_CLAIM_CAP));
  await saveJsonStore(SETTINGS_PATH, { weeklyClaimCap });
  return { weeklyClaimCap };
}

function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function claimedThisWeek(rows = [], actorName = '') {
  const actor = normalize(actorName);
  if (!actor) return 0;
  const currentWeek = isoWeekKey(new Date());
  return (rows || []).filter((r) => normalize(r?.claimed_by) === actor)
    .filter((r) => {
      const ts = new Date(r?.claimed_at || 0);
      if (Number.isNaN(ts.getTime())) return false;
      return isoWeekKey(ts) === currentWeek;
    }).length;
}

function parseFullName(lastFirst = '') {
  const raw = clean(lastFirst);
  if (!raw) return '';
  if (!raw.includes(',')) return raw;
  const [last, first] = raw.split(',').map((x) => clean(x));
  return clean(`${first} ${last}`);
}

let RUNTIME_ASSIGNABLE_USERS = null;

function authUsers() {
  return (users || []).filter((u) => u?.active);
}

function activeUsers() {
  return Array.isArray(RUNTIME_ASSIGNABLE_USERS) && RUNTIME_ASSIGNABLE_USERS.length
    ? RUNTIME_ASSIGNABLE_USERS
    : authUsers();
}

async function refreshAssignableUsers() {
  const base = authUsers().map((u) => ({ ...u, name: clean(u?.name), email: clean(u?.email), role: clean(u?.role || 'agent'), active: u?.active !== false }));

  const onboardingRows = await loadJsonStore(AGENT_ONBOARDING_PATH, []);
  const onboard = (Array.isArray(onboardingRows) ? onboardingRows : [])
    .filter((r) => normalize(r?.group) === 'inner' && r?.active !== false)
    .map((r) => ({
      name: clean(r?.name),
      email: clean(r?.email),
      role: 'agent',
      active: true
    }))
    .filter((r) => r.name);

  const byName = new Map();
  for (const row of [...base, ...onboard]) {
    const key = normalize(row?.name);
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, row);
    else {
      const prev = byName.get(key);
      byName.set(key, {
        ...prev,
        ...row,
        email: clean(prev?.email || row?.email),
        role: clean(prev?.role || row?.role || 'agent'),
        active: true
      });
    }
  }

  RUNTIME_ASSIGNABLE_USERS = [...byName.values()].sort((a, b) => clean(a?.name).localeCompare(clean(b?.name)));
  return RUNTIME_ASSIGNABLE_USERS;
}

function findUserEmailByName(name = '') {
  const n = normalize(name);
  const hit = activeUsers().find((u) => normalize(u.name) === n);
  return clean(hit?.email);
}

function findAuthUserByName(name = '') {
  const n = normalize(name);
  if (!n) return null;
  return authUsers().find((u) => normalize(u.name) === n) || null;
}

function emailFrame(title = '', bodyHtml = '') {
  return `<div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:20px;color:#0f172a;"><div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><div style="background:#0047AB;color:#fff;padding:16px 20px;text-align:center;font-weight:800;font-size:28px;line-height:1;">THE LEGACY LINK</div><div style="padding:20px;"><h2 style="margin:0 0 12px;font-size:20px;">${title}</h2>${bodyHtml}<p style="margin:8px 0 0;color:#334155;"><strong>The Legacy Link Support Team</strong></p></div></div></div>`;
}

function parseDateTime12(raw = '') {
  const m = String(raw || '').trim().match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  const [_, date, h, min, ampm] = m;
  let hour = Number(h);
  if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
  if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
  return { date, hour, minute: Number(min) };
}

function bookingUtcMs(row = {}) {
  const parsed = parseDateTime12(clean(row?.requested_at_est || ''));
  if (!parsed) return NaN;

  const zone = clean(row?.booking_timezone || inferTimezoneFromState(row?.applicant_state) || 'ET').toUpperCase();
  const offset = Number(ZONE_OFFSET[zone] ?? -5);
  const [y, mo, d] = parsed.date.split('-').map((n) => Number(n));
  if (!y || !mo || !d) return NaN;

  return Date.UTC(y, mo - 1, d, parsed.hour, parsed.minute, 0, 0) - offset * 60 * 60 * 1000;
}

function isDeleteEligible(row = {}, nowMs = Date.now()) {
  const whenMs = bookingUtcMs(row);
  if (Number.isNaN(whenMs)) return false;
  return nowMs - whenMs >= 24 * 60 * 60 * 1000;
}

function isExpiredUnclaimed(row = {}, nowMs = Date.now()) {
  const whenMs = bookingUtcMs(row);
  if (Number.isNaN(whenMs)) return false;
  return !clean(row?.claimed_by) && whenMs < nowMs;
}

function formatHourMinute(hour24 = 0, minute = 0) {
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  let h = hour24 % 12;
  if (h === 0) h = 12;
  return `${h}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function convertBetweenZones(raw = '', fromZone = 'ET', toZone = 'ET') {
  const parsed = parseDateTime12(raw);
  if (!parsed) return '';
  const from = ZONE_OFFSET[fromZone] ?? -5;
  const to = ZONE_OFFSET[toZone] ?? -5;
  const delta = to - from;

  const base = new Date(`${parsed.date}T00:00:00Z`);
  const minutes = parsed.hour * 60 + parsed.minute + delta * 60;
  const shifted = new Date(base.getTime() + minutes * 60 * 1000);

  const y = shifted.getUTCFullYear();
  const mo = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  const hh = shifted.getUTCHours();
  const mm = shifted.getUTCMinutes();
  return `${y}-${mo}-${d} ${formatHourMinute(hh, mm)}`;
}

function timezoneForAgent(name = '') {
  return AGENT_TIMEZONE_BY_NAME[normalize(name)] || 'ET';
}

async function sendAssignmentEmail({ assignedTo = '', assignedBy = '', row = {}, note = '' }) {
  const to = findUserEmailByName(assignedTo);
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!to || !user || !pass) return { ok: false, error: 'email_not_configured' };

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const subject = `Sponsorship Application Assignment: ${clean(row?.applicant_name) || 'Booked Appointment'}`;

  const clientZone = clean(row?.booking_timezone || inferTimezoneFromState(row?.applicant_state) || 'ET');
  const agentZone = timezoneForAgent(assignedTo);
  const rawAppointment = clean(row?.requested_at_est || '');
  const clientTime = rawAppointment ? `${rawAppointment} (${clientZone})` : '—';
  const agentTimeConverted = rawAppointment ? convertBetweenZones(rawAppointment, clientZone, agentZone) : '';
  const agentTime = agentTimeConverted ? `${agentTimeConverted} (${agentZone})` : '—';

  const text = [
    `Hi ${assignedTo},`,
    '',
    `${assignedBy || 'Admin'} assigned a booked sponsorship appointment to you.`,
    '',
    `Applicant: ${clean(row?.applicant_name) || '—'}`,
    `Phone: ${clean(row?.applicant_phone) || '—'}`,
    `Email: ${clean(row?.applicant_email) || '—'}`,
    `State: ${clean(row?.applicant_state) || '—'}`,
    `Referred By: ${clean(row?.referred_by) || '—'}`,
    `Booked Time (Client): ${clientTime}`,
    `Booked Time (Your Timezone): ${agentTime}`,
    '',
    'This assignment is confirmed and ready to work.',
    'Also reach out to the client 24 hours before their appointment.',
    '',
    note ? `Note from ${assignedBy || 'Link'}: ${note}` : '',
    'Thank you.'
  ].filter(Boolean).join('\n');

  const html = emailFrame(
    'New Sponsorship Application Assignment',
    `<p>Hi <strong>${assignedTo}</strong>,</p>
     <p><strong>${assignedBy || 'Admin'}</strong> assigned a booked sponsorship appointment to you.</p>
     <ul style="padding-left:18px;line-height:1.6;">
       <li><strong>Applicant:</strong> ${clean(row?.applicant_name) || '—'}</li>
       <li><strong>Phone:</strong> ${clean(row?.applicant_phone) || '—'}</li>
       <li><strong>Email:</strong> ${clean(row?.applicant_email) || '—'}</li>
       <li><strong>State:</strong> ${clean(row?.applicant_state) || '—'}</li>
       <li><strong>Referred By:</strong> ${clean(row?.referred_by) || '—'}</li>
       <li><strong>Booked Time (Client):</strong> ${clientTime}</li>
       <li><strong>Booked Time (Your Timezone):</strong> ${agentTime}</li>
     </ul>
     <p>This assignment is confirmed and ready to work.</p>
     <p>Also reach out to the client <strong>24 hours before</strong> their appointment.</p>
     ${note ? `<p><strong>Note from ${assignedBy || 'Link'}:</strong> ${note}</p>` : ''}`
  );

  try {
    const info = await tx.sendMail({
      from,
      to,
      cc: 'support@thelegacylink.com',
      subject,
      text,
      html
    });
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    return { ok: false, error: error?.message || 'send_failed' };
  }
}

async function sendRescheduleEmail({ actorName = '', row = {} }) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  const to = clean(row?.applicant_email || '');
  if (!to || !user || !pass) return { ok: false, error: !to ? 'missing_applicant_email' : 'email_not_configured' };

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });

  const applicantName = clean(row?.applicant_name) || 'there';
  const referredBy = clean(row?.referred_by || '');
  const referredByEmail = findUserEmailByName(referredBy);
  const sourceId = clean(row?.source_application_id || '');
  const bookingLink = sourceId
    ? `https://innercirclelink.com/sponsorship-booking?id=${encodeURIComponent(sourceId)}`
    : 'https://innercirclelink.com/sponsorship-booking';

  const subject = `Please Reschedule Your Sponsorship Appointment: ${applicantName}`;
  const text = [
    `Hi ${applicantName},`,
    '',
    'We noticed your scheduled sponsorship appointment was missed and was never claimed by an agent.',
    'Please use the link below to reschedule your appointment at your earliest convenience:',
    bookingLink,
    '',
    'If you need help booking, reply to this email and our team will assist you.',
    '',
    'Thank you,',
    'The Legacy Link'
  ].join('\n');

  const html = emailFrame(
    'Reschedule Needed',
    `<p>Hi <strong>${applicantName}</strong>,</p>
     <p>We noticed your scheduled sponsorship appointment was missed and was never claimed by an agent.</p>
     <p>Please use the link below to reschedule your appointment at your earliest convenience:</p>
     <p><a href="${bookingLink}">${bookingLink}</a></p>
     <p>If you need help booking, reply to this email and our team will assist you.</p>`
  );

  const ccList = [referredByEmail, 'support@thelegacylink.com'].filter(Boolean);

  try {
    const info = await tx.sendMail({
      from,
      to,
      cc: [...new Set(ccList)].join(', '),
      subject,
      text,
      html
    });
    return { ok: true, messageId: info.messageId, bookingLink, sentBy: actorName };
  } catch (error) {
    return { ok: false, error: error?.message || 'send_failed' };
  }
}

function resolveReferrerName(name = '') {
  const n = normalize(name);
  if (!n) return '';

  if (REFERRED_BY_ALIASES[n]) return REFERRED_BY_ALIASES[n];

  const usersList = activeUsers();

  const exact = usersList.find((u) => normalize(u.name) === n);
  if (exact) return exact.name;

  // Accept first-name references like "Kelin" / "Jamal" from booking flows.
  const firstNameMatches = usersList.filter((u) => {
    const first = normalize(clean(u.name).split(/\s+/)[0]);
    return first && first === n;
  });
  if (firstNameMatches.length === 1) return firstNameMatches[0].name;

  // Accept "First Last" partials where input appears inside canonical name.
  const fuzzy = usersList.find((u) => normalize(u.name).includes(n));
  if (fuzzy) return fuzzy.name;

  return '';
}

function plus24hIso(fromIso = '') {
  const base = new Date(fromIso || nowIso());
  if (Number.isNaN(base.getTime())) return '';
  return new Date(base.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

function inferTimezoneFromState(state = '') {
  const raw = clean(state).toUpperCase();
  if (!raw) return 'ET';

  const nameToCode = {
    ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA',
    COLORADO: 'CO', CONNECTICUT: 'CT', DELAWARE: 'DE', FLORIDA: 'FL', GEORGIA: 'GA',
    HAWAII: 'HI', IDAHO: 'ID', ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS',
    KENTUCKY: 'KY', LOUISIANA: 'LA', MAINE: 'ME', MARYLAND: 'MD', MASSACHUSETTS: 'MA',
    MICHIGAN: 'MI', MINNESOTA: 'MN', MISSISSIPPI: 'MS', MISSOURI: 'MO', MONTANA: 'MT',
    NEBRASKA: 'NE', NEVADA: 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM',
    'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', OHIO: 'OH', OKLAHOMA: 'OK',
    OREGON: 'OR', PENNSYLVANIA: 'PA', RHODE: 'RI', ISLAND: 'RI', 'RHODE ISLAND': 'RI',
    'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT',
    VERMONT: 'VT', VIRGINIA: 'VA', WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV', WISCONSIN: 'WI', WYOMING: 'WY',
    DISTRICT: 'DC', COLUMBIA: 'DC', 'DISTRICT OF COLUMBIA': 'DC', PUERTO: 'PR', RICO: 'PR', 'PUERTO RICO': 'PR'
  };

  const s = raw.length > 2 ? (nameToCode[raw] || raw) : raw;

  const PT = new Set(['CA', 'NV', 'OR', 'WA']);
  const MT = new Set(['AZ', 'CO', 'ID', 'MT', 'NM', 'UT', 'WY']);
  const CT = new Set(['AL', 'AR', 'IA', 'IL', 'KS', 'LA', 'MN', 'MO', 'MS', 'ND', 'NE', 'OK', 'SD', 'TN', 'TX', 'WI']);
  const AT = new Set(['PR', 'VI']);
  const HT = new Set(['HI']);
  const AKT = new Set(['AK']);

  if (PT.has(s)) return 'PT';
  if (MT.has(s)) return 'MT';
  if (CT.has(s)) return 'CT';
  if (AT.has(s)) return 'AT';
  if (HT.has(s)) return 'HT';
  if (AKT.has(s)) return 'AKT';
  return 'ET';
}

function normalizeBookingTimezone(row = {}) {
  const tz = clean(row?.booking_timezone || row?.requested_timezone || row?.timezone || '');
  if (tz) {
    const n = normalize(tz);
    if (n === 'local') return inferTimezoneFromState(row?.applicant_state || row?.state);
    if (n.includes('eastern') || n === 'est' || n === 'edt' || n === 'et') return 'ET';
    if (n.includes('central') || n === 'cst' || n === 'cdt' || n === 'ct') return 'CT';
    if (n.includes('mountain') || n === 'mst' || n === 'mdt' || n === 'mt') return 'MT';
    if (n.includes('pacific') || n === 'pst' || n === 'pdt' || n === 'pt') return 'PT';
    if (n.includes('alaska') || n === 'akt') return 'AKT';
    if (n.includes('hawaii') || n === 'ht') return 'HT';
    return tz.toUpperCase();
  }
  return inferTimezoneFromState(row?.applicant_state || row?.state);
}

function applyPriorityDefaults(row = {}) {
  const canonicalReferred = resolveReferrerName(row?.referred_by || '') || clean(row?.referred_by || '');
  const claimed = Boolean(clean(row?.claimed_by));
  if (claimed) {
    return {
      ...row,
      referred_by: canonicalReferred,
      priority_agent: resolveReferrerName(row?.priority_agent || '') || clean(row?.priority_agent || ''),
      booking_timezone: normalizeBookingTimezone(row)
    };
  }

  const canonicalPriority = resolveReferrerName(row?.priority_agent || '');
  if (canonicalPriority) {
    return {
      ...row,
      referred_by: canonicalReferred,
      priority_agent: canonicalPriority,
      booking_timezone: normalizeBookingTimezone(row)
    };
  }

  const referred = resolveReferrerName(row?.referred_by || '');
  if (!referred) {
    return {
      ...row,
      referred_by: canonicalReferred,
      booking_timezone: normalizeBookingTimezone(row)
    };
  }

  return {
    ...row,
    referred_by: canonicalReferred,
    priority_agent: referred,
    priority_expires_at: clean(row?.priority_expires_at) || plus24hIso(row?.created_at || row?.updated_at),
    priority_released: Boolean(row?.priority_released),
    booking_timezone: normalizeBookingTimezone(row)
  };
}

function findUserByName(name = '') {
  const needle = normalize(name);
  if (!needle) return null;
  return activeUsers().find((u) => normalize(u.name) === needle) || null;
}

function isAdminRole(role = '') {
  return normalize(role) === 'admin';
}

function isManagerRole(role = '') {
  const r = normalize(role);
  return r === 'admin' || r === 'manager';
}

function licensedStatesFor(name = '') {
  const n = normalize(name);
  const override = LICENSE_OVERRIDES[n];
  if (Array.isArray(override) && override.length) return [...new Set(override)].sort();

  const key = normalizeKey(name);
  if (!key) return [];

  const states = new Set();
  for (const row of licensedAgents || []) {
    const rowName = parseFullName(row?.full_name || row?.name || '');
    if (normalizeKey(rowName) !== key) continue;

    const status = normalize(row?.license_status || 'active');
    if (status && !(status.includes('active') || status.includes('licensed'))) continue;

    const stateCode = clean(row?.state_code || row?.home_state || '').toUpperCase().slice(0, 2);
    if (stateCode) states.add(stateCode);
  }

  return [...states].sort();
}

function isWithinPriorityWindow(booking = {}) {
  if (!clean(booking?.priority_agent)) return false;
  if (booking?.priority_released) return false;
  const exp = new Date(booking?.priority_expires_at || 0);
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() > Date.now();
}

function maskName(value = '') {
  const parts = clean(value).split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Private';
  return parts.map((p) => `${p[0]}${'*'.repeat(Math.max(2, p.length - 1))}`).join(' ');
}

function maskEmail(value = '') {
  const email = clean(value);
  if (!email.includes('@')) return 'hidden@private';
  const [left, right] = email.split('@');
  if (!left) return `hidden@${right || 'private'}`;
  return `${left.slice(0, 1)}***@${right || 'private'}`;
}

function maskPhone(value = '') {
  const digits = clean(value).replace(/\D/g, '');
  if (!digits) return '(***) ***-****';
  const tail = digits.slice(-2).padStart(2, '*');
  return `(***) ***-**${tail}`;
}

function refreshExpiredPriority(rows = []) {
  let changed = false;
  const now = Date.now();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || {};
    const claimed = normalize(row?.claim_status).startsWith('claimed') || clean(row?.claimed_by);
    if (claimed) continue;
    if (row?.priority_released) continue;
    if (!clean(row?.priority_agent)) continue;

    const exp = new Date(row?.priority_expires_at || 0);
    if (Number.isNaN(exp.getTime())) continue;

    if (exp.getTime() <= now) {
      rows[i] = {
        ...row,
        priority_released: true,
        claim_status: 'Open',
        updated_at: nowIso()
      };
      changed = true;
    }
  }

  return { rows, changed };
}

function toBonusClaimRow(row = {}) {
  return {
    id: clean(row?.id),
    source_type: 'bonus',
    applicant_name: clean(row?.name) || 'Unknown',
    applicant_email: clean(row?.email || ''),
    applicant_phone: clean(row?.phone || ''),
    applicant_state: clean(row?.state).toUpperCase(),
    requested_at_est: clean(row?.requested_at_est),
    booking_timezone: clean(row?.timezone || row?.requested_timezone || 'Local'),
    referred_by: clean(row?.referred_by || 'Bonus Booking'),
    claim_status: clean(row?.claim_status || 'Open') || 'Open',
    claimed_by: clean(row?.claimed_by || ''),
    claimed_at: clean(row?.claimed_at || ''),
    priority_agent: clean(row?.priority_agent || ''),
    priority_expires_at: clean(row?.priority_expires_at || ''),
    priority_released: Boolean(row?.priority_released),
    created_at: clean(row?.created_at || row?.updated_at || nowIso()),
    updated_at: clean(row?.updated_at || nowIso())
  };
}

function fallbackSlotKey(row = {}) {
  const state = clean(row?.applicant_state || '').toUpperCase();
  const requested = clean(row?.requested_at_est || '').toUpperCase().replace(/\s+(ET|CT|MT|PT|EST|CST|MST|PST)$/i, '').trim();
  const first = normalize((clean(row?.applicant_name || '').split(/\s+/).filter(Boolean)[0] || ''));
  if (!state || !requested || !first) return '';
  return `${state}|${requested}|${first}`;
}

function applyManualBookingFallback(rows = []) {
  const list = Array.isArray(rows) ? [...rows] : [];
  let changed = false;

  const existingBySource = new Set(list.map((r) => clean(r?.source_application_id)).filter(Boolean));
  const existingByName = new Set(list.map((r) => applicantNameKey(r?.applicant_name || '')).filter(Boolean));
  const existingBySlot = new Set(list.map((r) => fallbackSlotKey(r)).filter(Boolean));

  for (const m of MANUAL_BOOKING_FALLBACK) {
    const source = clean(m?.source_application_id);
    const nameKey = applicantNameKey(m?.applicant_name || '');
    const slotKey = fallbackSlotKey(m);
    if ((source && existingBySource.has(source)) || (nameKey && existingByName.has(nameKey)) || (slotKey && existingBySlot.has(slotKey))) continue;

    list.push({
      id: clean(m?.id) || `lc_fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      source_type: 'sponsorship',
      source_application_id: source,
      applicant_name: clean(m?.applicant_name),
      applicant_email: '',
      applicant_phone: '',
      applicant_state: clean(m?.applicant_state).toUpperCase(),
      requested_at_est: clean(m?.requested_at_est),
      booking_timezone: clean(m?.booking_timezone || inferTimezoneFromState(m?.applicant_state) || 'ET'),
      referred_by: resolveReferrerName(m?.referred_by || 'Link') || 'Kimora Link',
      claim_status: 'Priority Hold',
      claimed_by: '',
      claimed_at: '',
      priority_agent: resolveReferrerName('Link') || 'Kimora Link',
      priority_expires_at: plus24hIso(nowIso()),
      priority_released: false,
      created_at: nowIso(),
      updated_at: nowIso(),
      notes: 'Manual fallback booking restore'
    });
    if (source) existingBySource.add(source);
    if (nameKey) existingByName.add(nameKey);
    if (slotKey) existingBySlot.add(slotKey);
    changed = true;
  }

  return { rows: list, changed };
}

function dedupeClaimRows(rows = []) {
  const map = new Map();

  for (const row of rows) {
    const key = applicantNameKey(row?.applicant_name || row?.name || row?.applicantName || row?.id || '');
    if (!key) continue;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, row);
      continue;
    }

    const existingTs = new Date(existing?.created_at || existing?.requested_at_est || 0).getTime();
    const rowTs = new Date(row?.created_at || row?.requested_at_est || 0).getTime();

    const existingClaimed = Boolean(clean(existing?.claimed_by));
    const rowClaimed = Boolean(clean(row?.claimed_by));

    if (rowClaimed && !existingClaimed) {
      map.set(key, row);
      continue;
    }

    if (!rowClaimed && existingClaimed) continue;

    if ((rowTs || 0) >= (existingTs || 0)) map.set(key, row);
  }

  return [...map.values()];
}

function slotDedupKey(row = {}) {
  const state = clean(row?.applicant_state || '').toUpperCase();
  const requestedRaw = clean(row?.requested_at_est || '').toUpperCase();
  const requested = requestedRaw.replace(/\s+(ET|CT|MT|PT|EST|CST|MST|PST)$/i, '').trim();
  const first = normalize((clean(row?.applicant_name || '').split(/\s+/).filter(Boolean)[0] || ''));
  if (!requested || !first) return '';
  return `${state}|${requested}|${first}`;
}

function dedupeByAppointmentSlot(rows = []) {
  const map = new Map();
  for (const row of (rows || [])) {
    const key = slotDedupKey(row) || `id:${clean(row?.id)}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      continue;
    }

    const prevName = clean(prev?.applicant_name || '');
    const curName = clean(row?.applicant_name || '');
    const prevManual = normalize(clean(prev?.notes || '')).includes('manual');
    const curManual = normalize(clean(row?.notes || '')).includes('manual');

    // Prefer richer (fuller) non-manual row when duplicated by same person+slot.
    const pickCurrent =
      (prevManual && !curManual)
      || (curName.length > prevName.length + 1)
      || (!clean(prev?.applicant_email) && clean(row?.applicant_email))
      || (!clean(prev?.applicant_phone) && clean(row?.applicant_phone));

    if (pickCurrent) map.set(key, row);
  }
  return Array.from(map.values());
}

function canViewerSeeFull(row = {}, viewerName = '', viewerRole = '') {
  if (isManagerRole(viewerRole)) return true;
  if (!clean(viewerName)) return false;
  return normalize(row?.claimed_by) === normalize(viewerName);
}

function canonicalDisplayName(name = '') {
  return resolveReferrerName(name) || clean(name);
}

function toPortalRow(row = {}, viewerName = '', viewerRole = '') {
  const full = canViewerSeeFull(row, viewerName, viewerRole);
  const withinPriority = isWithinPriorityWindow(row);
  const claimed = normalize(row?.claim_status).startsWith('claimed') || clean(row?.claimed_by);

  // Policy update: admin assignment is treated as confirmed.
  const assignmentStatusRaw = normalize(row?.assignment_status || '');
  const assignment_status = assignmentStatusRaw === 'pending_confirmation' ? 'confirmed' : clean(row?.assignment_status || '');

  const canClaim = !claimed && (!withinPriority || normalize(viewerName) === normalize(row?.priority_agent) || isManagerRole(viewerRole));

  return {
    ...row,
    referred_by: canonicalDisplayName(row?.referred_by),
    priority_agent: canonicalDisplayName(row?.priority_agent),
    claimed_by: canonicalDisplayName(row?.claimed_by),
    assignment_status,
    visibility: full ? 'full' : 'partial',
    applicant_name: full ? clean(row?.applicant_name) : maskName(row?.applicant_name),
    applicant_email: full ? clean(row?.applicant_email) : maskEmail(row?.applicant_email),
    applicant_phone: full ? clean(row?.applicant_phone) : maskPhone(row?.applicant_phone),
    notes: full ? clean(row?.notes) : '',
    is_priority_window_open: withinPriority,
    can_claim: canClaim,
    delete_eligible: isDeleteEligible(row)
  };
}

function buildPendingPipeline(claimRows = [], policyRows = []) {
  const policyByApplicant = new Set(
    (policyRows || [])
      .map((p) => applicantNameKey(p?.applicantName || p?.applicant_name || ''))
      .filter(Boolean)
  );

  const pending = (claimRows || [])
    .filter((row) => {
      const key = applicantNameKey(row?.applicant_name || '');
      if (!key) return false;
      if (normalize(row?.claim_status) === 'invalid') return false;
      if (!clean(row?.requested_at_est)) return false;
      return !policyByApplicant.has(key);
    })
    .map((row) => ({
      id: clean(row?.id),
      name: clean(row?.applicant_name) || 'Unknown',
      state: clean(row?.applicant_state).toUpperCase(),
      requested_at_est: clean(row?.requested_at_est),
      booking_timezone: normalizeBookingTimezone(row),
      referred_by: clean(row?.referred_by),
      source: row?.source_type === 'bonus' ? 'Bonus Booking' : 'Sponsorship Booking'
    }));

  return dedupeClaimRows(
    pending.map((p) => ({
      id: p.id,
      applicant_name: p.name,
      applicant_state: p.state,
      requested_at_est: p.requested_at_est,
      booking_timezone: p.booking_timezone,
      referred_by: p.referred_by,
      source: p.source,
      created_at: p.requested_at_est || nowIso()
    }))
  )
    .map((r) => ({
      id: r.id,
      name: r.applicant_name,
      state: r.applicant_state,
      requested_at_est: r.requested_at_est,
      booking_timezone: r.booking_timezone,
      referred_by: r.referred_by,
      source: r.source
    }))
    .sort((a, b) => {
      const aTs = new Date(a.requested_at_est || 0).getTime();
      const bTs = new Date(b.requested_at_est || 0).getTime();
      return (bTs || 0) - (aTs || 0);
    });
}

function findById(rows = [], id = '') {
  return rows.findIndex((r) => clean(r?.id) === clean(id));
}

export async function GET(req) {
  await refreshAssignableUsers();

  const { searchParams } = new URL(req.url);
  const viewerName = clean(searchParams.get('viewer'));
  const viewer = findAuthUserByName(viewerName);
  const viewerRole = clean(viewer?.role || 'guest');

  const [sponsorStoreRaw, policyRows, bonusRowsRaw, sponsorshipAppsRaw] = await Promise.all([
    loadJsonStore(SPONSORSHIP_BOOKINGS_PATH, []),
    loadJsonStore(POLICY_SUBMISSIONS_PATH, []),
    loadJsonStore(BONUS_BOOKINGS_PATH, []),
    loadJsonStore(SPONSORSHIP_APPLICATIONS_PATH, [])
  ]);

  const sponsorFallback = applyManualBookingFallback(sponsorStoreRaw);
  const sponsorRefreshed = refreshExpiredPriority(sponsorFallback.rows);
  const sponsorRows = sponsorRefreshed.rows;
  if (sponsorFallback.changed || sponsorRefreshed.changed) await saveJsonStore(SPONSORSHIP_BOOKINGS_PATH, sponsorRows);

  const bonusClaimRows = (bonusRowsRaw || []).map((r) => applyPriorityDefaults(toBonusClaimRow(r)));

  const mergedClaimRows = dedupeClaimRows(enrichInitialNames([
    ...sponsorRows.map((r) => applyPriorityDefaults({ ...r, source_type: 'sponsorship' })),
    ...bonusClaimRows
  ], sponsorshipAppsRaw || [], policyRows || [])).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  const hasPolicyAction = (status = '') => {
    const s = normalize(status);
    return ['submitted', 'approved', 'declined', 'pending', 'paid', 'issued', 'complete', 'completed', 'booked'].some((k) => s.includes(k));
  };

  const policyActionApplicants = new Set(
    (policyRows || [])
      .filter((p) => hasPolicyAction(p?.status || ''))
      .map((p) => applicantNameKey(p?.applicantName || p?.applicant_name || ''))
      .filter(Boolean)
  );

  const policyActionSourceIds = new Set(
    (policyRows || [])
      .filter((p) => hasPolicyAction(p?.status || ''))
      .map((p) => clean(p?.source_application_id || p?.sourceApplicationId || p?.applicationId || p?.sponsorshipApplicationId || ''))
      .filter(Boolean)
  );

  const policyActionStateNameSigs = new Set(
    (policyRows || [])
      .filter((p) => hasPolicyAction(p?.status || ''))
      .map((p) => stateNameSignature(p?.applicantState || p?.state, p?.applicantName || p?.applicant_name || ''))
      .filter(Boolean)
  );

  const openQueueRowsRaw = mergedClaimRows.filter((row) => {
    const rowSourceId = clean(row?.source_application_id || row?.id || '');
    if (rowSourceId && policyActionSourceIds.has(rowSourceId)) return false;

    const key = applicantNameKey(row?.applicant_name || '');
    if (key && policyActionApplicants.has(key)) return false;

    const sig = stateNameSignature(row?.applicant_state, row?.applicant_name || '');
    if (sig && policyActionStateNameSigs.has(sig)) return false;

    return true;
  });

  const openQueueRows = dedupeByAppointmentSlot(openQueueRowsRaw)
    .sort((a, b) => {
      const aWhen = bookingUtcMs(a);
      const bWhen = bookingUtcMs(b);
      if (!Number.isNaN(aWhen) && !Number.isNaN(bWhen)) return aWhen - bWhen;
      if (!Number.isNaN(aWhen)) return -1;
      if (!Number.isNaN(bWhen)) return 1;
      return new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime();
    });

  const pendingPipeline = buildPendingPipeline(openQueueRows, policyRows);
  const settings = await getClaimSettings();
  const viewerClaimedThisWeek = viewer?.name ? claimedThisWeek(mergedClaimRows, viewer.name) : 0;

  return Response.json({
    ok: true,
    viewer: viewer ? { name: viewer.name, role: viewer.role } : null,
    rows: openQueueRows.map((r) => toPortalRow(r, viewer?.name || '', viewerRole)),
    roster: activeUsers().map((u) => ({
      name: u.name,
      role: u.role,
      licensedStates: licensedStatesFor(u.name)
    })),
    pendingPipeline,
    settings,
    viewerClaimedThisWeek
  });
}

export async function POST(req) {
  await refreshAssignableUsers();

  const body = await req.json().catch(() => ({}));
  const action = normalize(body?.action || '');
  const actorName = clean(body?.actorName);
  const actor = findAuthUserByName(actorName);

  if (!actor) return Response.json({ ok: false, error: 'invalid_actor' }, { status: 401 });

  const [sponsorRowsRaw, bonusRows, settings] = await Promise.all([
    loadJsonStore(SPONSORSHIP_BOOKINGS_PATH, []),
    loadJsonStore(BONUS_BOOKINGS_PATH, []),
    getClaimSettings()
  ]);

  const sponsorFallback = applyManualBookingFallback(sponsorRowsRaw);
  const sponsorRows = sponsorFallback.rows;
  if (sponsorFallback.changed) await saveJsonStore(SPONSORSHIP_BOOKINGS_PATH, sponsorRows);

  if (action === 'set_weekly_claim_cap') {
    if (!isManagerRole(actor.role)) {
      return Response.json({ ok: false, error: 'manager_only' }, { status: 403 });
    }
    const cap = Math.max(1, Number(body?.weeklyClaimCap || settings?.weeklyClaimCap || DEFAULT_WEEKLY_CLAIM_CAP));
    const nextSettings = await saveClaimSettings({ weeklyClaimCap: cap });
    return Response.json({ ok: true, settings: nextSettings });
  }

  const bookingId = clean(body?.bookingId);
  if (!bookingId) return Response.json({ ok: false, error: 'missing_booking_id' }, { status: 400 });

  const mergedClaimRows = dedupeClaimRows([
    ...sponsorRows.map((r) => applyPriorityDefaults({ ...r, source_type: 'sponsorship' })),
    ...(bonusRows || []).map((r) => applyPriorityDefaults(toBonusClaimRow(r)))
  ]);

  const sponsorIdx = findById(sponsorRows, bookingId);
  const bonusIdx = findById(bonusRows, bookingId);

  if (sponsorIdx < 0 && bonusIdx < 0) {
    return Response.json({ ok: false, error: 'booking_not_found' }, { status: 404 });
  }

  const targetStore = sponsorIdx >= 0 ? 'sponsor' : 'bonus';
  const row = applyPriorityDefaults(targetStore === 'sponsor' ? { ...sponsorRows[sponsorIdx], source_type: 'sponsorship' } : toBonusClaimRow(bonusRows[bonusIdx]));

  if (action === 'delete') {
    if (!isAdminRole(actor.role)) return Response.json({ ok: false, error: 'admin_only' }, { status: 403 });
    if (!isDeleteEligible(row)) {
      return Response.json({ ok: false, error: 'delete_not_eligible_yet' }, { status: 409 });
    }

    if (targetStore === 'sponsor') {
      const [removed] = sponsorRows.splice(sponsorIdx, 1);
      await saveJsonStore(SPONSORSHIP_BOOKINGS_PATH, sponsorRows);
      return Response.json({ ok: true, removed });
    }

    const [removed] = bonusRows.splice(bonusIdx, 1);
    await saveJsonStore(BONUS_BOOKINGS_PATH, bonusRows);
    return Response.json({ ok: true, removed });
  }

  if (action === 'claim') {
    const alreadyClaimedBy = clean(row?.claimed_by);
    if (alreadyClaimedBy && normalize(alreadyClaimedBy) !== normalize(actor.name)) {
      return Response.json({ ok: false, error: 'already_claimed', claimedBy: alreadyClaimedBy }, { status: 409 });
    }

    if (!isManagerRole(actor.role)) {
      const claimedCount = claimedThisWeek(mergedClaimRows, actor.name);
      if (claimedCount >= Number(settings?.weeklyClaimCap || DEFAULT_WEEKLY_CLAIM_CAP)) {
        return Response.json({
          ok: false,
          error: 'weekly_claim_cap_reached',
          cap: Number(settings?.weeklyClaimCap || DEFAULT_WEEKLY_CLAIM_CAP),
          claimedThisWeek: claimedCount
        }, { status: 409 });
      }
    }

    if (isWithinPriorityWindow(row) && normalize(row?.priority_agent) !== normalize(actor.name) && !isManagerRole(actor.role)) {
      return Response.json(
        {
          ok: false,
          error: 'priority_window_locked',
          priorityAgent: row.priority_agent,
          priorityExpiresAt: row.priority_expires_at
        },
        { status: 409 }
      );
    }

    const next = {
      ...row,
      claim_status: 'Claimed',
      claimed_by: actor.name,
      claimed_at: nowIso(),
      priority_released: true,
      assignment_status: 'confirmed',
      assignment_confirmed_at: nowIso(),
      updated_at: nowIso()
    };

    if (targetStore === 'sponsor') {
      sponsorRows[sponsorIdx] = next;
      await saveJsonStore(SPONSORSHIP_BOOKINGS_PATH, sponsorRows);
    } else {
      bonusRows[bonusIdx] = {
        ...bonusRows[bonusIdx],
        claim_status: next.claim_status,
        claimed_by: next.claimed_by,
        claimed_at: next.claimed_at,
        priority_released: true,
        updated_at: next.updated_at
      };
      await saveJsonStore(BONUS_BOOKINGS_PATH, bonusRows);
    }

    return Response.json({ ok: true, row: toPortalRow(next, actor.name, actor.role) });
  }

  if (action === 'override') {
    if (!isManagerRole(actor.role)) {
      return Response.json({ ok: false, error: 'manager_only' }, { status: 403 });
    }

    const targetName = clean(body?.targetName);
    const target = findUserByName(targetName);
    if (!target) return Response.json({ ok: false, error: 'invalid_target' }, { status: 400 });

    const next = {
      ...row,
      claim_status: 'Claimed',
      claimed_by: target.name,
      claimed_at: nowIso(),
      priority_released: true,
      override_by: actor.name,
      override_at: nowIso(),
      override_note: clean(body?.note || ''),
      assignment_status: 'confirmed',
      assignment_requested_at: nowIso(),
      assignment_confirmed_at: nowIso(),
      updated_at: nowIso()
    };

    if (targetStore === 'sponsor') {
      sponsorRows[sponsorIdx] = next;
      await saveJsonStore(SPONSORSHIP_BOOKINGS_PATH, sponsorRows);
    } else {
      bonusRows[bonusIdx] = {
        ...bonusRows[bonusIdx],
        claim_status: next.claim_status,
        claimed_by: next.claimed_by,
        claimed_at: next.claimed_at,
        override_by: next.override_by,
        override_at: next.override_at,
        override_note: next.override_note,
        assignment_status: next.assignment_status,
        assignment_requested_at: next.assignment_requested_at,
        assignment_confirmed_at: next.assignment_confirmed_at,
        priority_released: true,
        updated_at: next.updated_at
      };
      await saveJsonStore(BONUS_BOOKINGS_PATH, bonusRows);
    }

    const emailResult = await sendAssignmentEmail({ assignedTo: target.name, assignedBy: actor.name, row: next, note: clean(body?.note || '') });

    return Response.json({
      ok: true,
      row: toPortalRow(next, actor.name, actor.role),
      assignmentEmail: emailResult.ok ? 'sent' : 'failed',
      assignmentEmailError: emailResult.ok ? '' : emailResult.error
    });
  }


  if (action === 'confirm_assignment') {
    const isOwner = normalize(row?.claimed_by) === normalize(actor.name);
    if (!isOwner && !isManagerRole(actor.role)) {
      return Response.json({ ok: false, error: 'not_allowed' }, { status: 403 });
    }

    const next = {
      ...row,
      assignment_status: 'confirmed',
      assignment_confirmed_at: nowIso(),
      updated_at: nowIso()
    };

    if (targetStore === 'sponsor') {
      sponsorRows[sponsorIdx] = next;
      await saveJsonStore(SPONSORSHIP_BOOKINGS_PATH, sponsorRows);
    } else {
      bonusRows[bonusIdx] = {
        ...bonusRows[bonusIdx],
        assignment_status: next.assignment_status,
        assignment_confirmed_at: next.assignment_confirmed_at,
        updated_at: next.updated_at
      };
      await saveJsonStore(BONUS_BOOKINGS_PATH, bonusRows);
    }

    return Response.json({ ok: true, row: toPortalRow(next, actor.name, actor.role) });
  }

  if (action === 'reopen_assignment') {
    if (!isManagerRole(actor.role)) {
      return Response.json({ ok: false, error: 'manager_only' }, { status: 403 });
    }

    const next = {
      ...row,
      claim_status: 'Open',
      claimed_by: '',
      claimed_at: '',
      assignment_status: 'open',
      assignment_confirmed_at: '',
      updated_at: nowIso()
    };

    if (targetStore === 'sponsor') {
      sponsorRows[sponsorIdx] = next;
      await saveJsonStore(SPONSORSHIP_BOOKINGS_PATH, sponsorRows);
    } else {
      bonusRows[bonusIdx] = {
        ...bonusRows[bonusIdx],
        claim_status: next.claim_status,
        claimed_by: next.claimed_by,
        claimed_at: next.claimed_at,
        assignment_status: next.assignment_status,
        assignment_confirmed_at: next.assignment_confirmed_at,
        updated_at: next.updated_at
      };
      await saveJsonStore(BONUS_BOOKINGS_PATH, bonusRows);
    }

    return Response.json({ ok: true, row: toPortalRow(next, actor.name, actor.role) });
  }

  if (action === 'send_reschedule_email') {
    if (!isManagerRole(actor.role)) {
      return Response.json({ ok: false, error: 'manager_only' }, { status: 403 });
    }

    if (!isExpiredUnclaimed(row)) {
      return Response.json({ ok: false, error: 'not_expired_unclaimed' }, { status: 409 });
    }

    const emailResult = await sendRescheduleEmail({ actorName: actor.name, row });
    if (!emailResult?.ok) {
      return Response.json({ ok: false, error: emailResult?.error || 'send_failed' }, { status: 500 });
    }

    const sentAt = nowIso();
    const next = {
      ...row,
      reschedule_email_sent_at: sentAt,
      reschedule_email_sent_by: actor.name,
      updated_at: sentAt
    };

    if (targetStore === 'sponsor') {
      sponsorRows[sponsorIdx] = next;
      await saveJsonStore(SPONSORSHIP_BOOKINGS_PATH, sponsorRows);
    } else {
      bonusRows[bonusIdx] = {
        ...bonusRows[bonusIdx],
        reschedule_email_sent_at: sentAt,
        reschedule_email_sent_by: actor.name,
        updated_at: sentAt
      };
      await saveJsonStore(BONUS_BOOKINGS_PATH, bonusRows);
    }

    return Response.json({ ok: true, row: toPortalRow(next, actor.name, actor.role), sentAt, sentBy: actor.name });
  }

  if (action === 'release') {
    if (!isManagerRole(actor.role)) {
      return Response.json({ ok: false, error: 'manager_only' }, { status: 403 });
    }

    const next = {
      ...row,
      priority_released: true,
      claim_status: clean(row?.claimed_by) ? row?.claim_status || 'Claimed' : 'Open',
      updated_at: nowIso()
    };

    if (targetStore === 'sponsor') {
      sponsorRows[sponsorIdx] = next;
      await saveJsonStore(SPONSORSHIP_BOOKINGS_PATH, sponsorRows);
    } else {
      bonusRows[bonusIdx] = {
        ...bonusRows[bonusIdx],
        priority_released: true,
        claim_status: next.claim_status,
        updated_at: next.updated_at
      };
      await saveJsonStore(BONUS_BOOKINGS_PATH, bonusRows);
    }

    return Response.json({ ok: true, row: toPortalRow(next, actor.name, actor.role) });
  }

  return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
}
