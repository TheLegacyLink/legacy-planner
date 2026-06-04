import nodemailer from 'nodemailer';
import { createHash, randomBytes } from 'crypto';
import { loadJsonStore, saveJsonStore, loadJsonFile, saveJsonFile } from '../../../../lib/blobJsonStore';
import { clean, findLicensedByEmail, isStrongAliasMatch, matchLicensedAgent } from '../../../../lib/licensedAgentMatch';

const START_INTAKE_PATH = 'stores/start-intake.json';

// Resolve a licensed-track member from start-intake (signed ICA, licensed track)
async function resolveFromStartIntake({ email = '', fullName = '', phone = '' } = {}) {
  const rows = await loadJsonFile(START_INTAKE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];

  const e = clean(email).toLowerCase();
  const p = clean(phone).replace(/\D/g, '').slice(-10);
  const n = clean(fullName).toLowerCase();

  const hit = list.find((r) => {
    if (clean(r?.trackType).toLowerCase() !== 'licensed') return false;
    const re = clean(r?.email).toLowerCase();
    const rp = clean(r?.phone).replace(/\D/g, '').slice(-10);
    const rn = clean(`${r?.firstName || ''} ${r?.lastName || ''}`).toLowerCase();
    // Match by email OR (name + phone)
    if (e && re === e) return true;
    if (p && n && rp === p && rn.includes(n.split(' ')[0])) return true;
    return false;
  });

  if (!hit) return null;

  return {
    email: clean(hit.email).toLowerCase(),
    name: clean(`${hit.firstName || ''} ${hit.lastName || ''}`),
    agentId: clean(hit.npn || hit.id || `intake_${Date.now()}`),
    homeState: clean(hit.homeState || hit.state || ''),
    carriersActive: [],
    trackType: 'licensed',
    contractSigned: hit.contractStatus === 'signed'
  };
}

export const ALIASES_PATH = 'stores/licensed-backoffice-email-aliases.json';
export const ALIAS_REVIEW_PATH = 'stores/licensed-backoffice-alias-review.json';
export const CODES_PATH = 'stores/licensed-backoffice-login-codes.json';
export const SESSIONS_PATH = 'stores/licensed-backoffice-sessions.json';

export function nowIso() { return new Date().toISOString(); }
export function sha256(v = '') { return createHash('sha256').update(String(v || '')).digest('hex'); }

export async function loadAliases() {
  const rows = await loadJsonStore(ALIASES_PATH, []);
  return Array.isArray(rows) ? rows : [];
}

export async function saveAliases(rows = []) {
  await saveJsonStore(ALIASES_PATH, Array.isArray(rows) ? rows : []);
}

export async function loadAliasReviewRows() {
  const rows = await loadJsonStore(ALIAS_REVIEW_PATH, []);
  return Array.isArray(rows) ? rows : [];
}

export async function saveAliasReviewRows(rows = []) {
  await saveJsonStore(ALIAS_REVIEW_PATH, Array.isArray(rows) ? rows : []);
}

async function queuePendingVerification({ email = '', fullName = '', phone = '', reason = '', candidates = [] } = {}) {
  const list = await loadAliasReviewRows();
  const keyEmail = clean(email).toLowerCase();
  const now = nowIso();
  const row = {
    id: `alias_review_${Date.now()}`,
    email: keyEmail,
    fullName: clean(fullName),
    phone: clean(phone),
    reason: clean(reason) || 'pending_verification',
    candidates: Array.isArray(candidates) ? candidates.slice(0, 5) : [],
    status: 'pending',
    createdAt: now,
    updatedAt: now
  };

  const next = [
    ...list.filter((r) => !(clean(r?.email).toLowerCase() === keyEmail && clean(r?.status || 'pending') === 'pending')),
    row
  ];
  await saveAliasReviewRows(next);
  return row;
}

// Demo/preview users — Inner Circle members who need access for onboarding demos
// Also used for licensed-track members whose email differs across records
const LICENSED_PREVIEW_USERS = [
  // Kimora Link — admin access via work emails
  {
    email: 'kimora@thelegacylink.com',
    name: 'Kimora Link',
    agentId: 'kimora_link_admin',
    homeState: 'GA',
    carriersActive: ['F&G', 'National Life Group'],
    role: 'admin',
    isDemo: false
  },
  {
    email: 'link@thelegacylink.com',
    name: 'Kimora Link',
    agentId: 'kimora_link_admin',
    homeState: 'GA',
    carriersActive: ['F&G', 'National Life Group'],
    role: 'admin',
    isDemo: false
  },
  {
    email: 'leticiawright05@gmail.com',
    name: 'Leticia Wright',
    agentId: 'demo_leticia_wright',
    homeState: 'GA',
    carriersActive: ['F&G', 'Mutual of Omaha'],
    isDemo: true
  },
  // Knakita Jones — licensed track agent
  {
    email: 'insurancejfb@gmail.com',
    name: 'Knakita Jones',
    agentId: 'intake_knakita_jones',
    homeState: '',
    carriersActive: [],
    isDemo: false
  },
  // Rashonda Gunn — licensed track, signed ICA; email has typo variants across records
  {
    email: 'shondacanee631@gmail.com',
    name: 'Rashonda Gunn',
    agentId: 'intake_rashonda_gunn',
    homeState: 'IN',
    carriersActive: [],
    isDemo: false
  },
  {
    email: 'shondacares631@gmail.com',
    name: 'Rashonda Gunn',
    agentId: 'intake_rashonda_gunn',
    homeState: 'IN',
    carriersActive: [],
    isDemo: false
  },
  {
    email: 'shondacates631@gmail.com',
    name: 'Rashonda Gunn',
    agentId: 'intake_rashonda_gunn',
    homeState: 'IN',
    carriersActive: [],
    isDemo: false
  }
];

export async function resolveLicensedProfile({ email = '', fullName = '', phone = '' } = {}) {
  const e = clean(email).toLowerCase();

  // 0) Demo/preview allowlist (Inner Circle onboarding demos)
  const preview = LICENSED_PREVIEW_USERS.find((u) => clean(u.email).toLowerCase() === e);
  if (preview) {
    return {
      ok: true,
      profile: {
        email: clean(preview.email).toLowerCase(),
        name: clean(preview.name),
        agentId: clean(preview.agentId),
        homeState: clean(preview.homeState),
        carriersActive: Array.isArray(preview.carriersActive) ? preview.carriersActive : [],
        role: clean(preview.role || ''),
        isDemo: Boolean(preview.isDemo)
      },
      via: 'preview_user'
    };
  }

  // 1) Exact licensed email
  const byEmail = findLicensedByEmail(e);
  if (byEmail) return { ok: true, profile: byEmail, via: 'licensed_email' };

  // 2) Approved alias mapping
  const aliases = await loadAliases();
  const alias = aliases.find((a) => clean(a?.aliasEmail).toLowerCase() === e && a?.active !== false);
  if (alias) {
    const rematch = matchLicensedAgent({ fullName: alias?.name, email: alias?.primaryEmail, phone: alias?.phone });
    if (rematch?.matched && rematch?.match) {
      return { ok: true, profile: rematch.match, via: 'alias_email' };
    }
  }

  // 3) Name + phone match flow (for alternate emails)
  // Approval gates removed — any match auto-approves immediately
  const m = matchLicensedAgent({ fullName, phone, email });
  if (!m?.matched || !m?.match) {
    // 4) Start-intake fallback — licensed-track members who signed ICA but aren't contracted yet
    const intakeProfile = await resolveFromStartIntake({ email, fullName, phone });
    if (intakeProfile) return { ok: true, profile: intakeProfile, via: 'start_intake' };

    return { ok: false, error: 'not_found' };
  }

  const primaryEmail = clean(m.match.email).toLowerCase();

  // Auto-link alias on strong match
  if (e) {
    const next = [...aliases];
    const idx = next.findIndex((a) => clean(a?.aliasEmail).toLowerCase() === e);
    const row = {
      aliasEmail: e,
      primaryEmail,
      name: clean(m.match.name),
      phone: clean(m.match.phone),
      agentId: clean(m.match.agentId),
      active: true,
      linkedAt: nowIso(),
      linkedBy: 'auto_strong_match'
    };
    if (idx >= 0) next[idx] = { ...next[idx], ...row };
    else next.push(row);
    await saveAliases(next);
  }

  return { ok: true, profile: m.match, via: 'name_phone_match' };
}

export function generateCode() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}

export async function sendCodeEmail({ to = '', code = '' } = {}) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass) return { ok: false, error: 'missing_gmail_env' };

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const subject = 'Legacy Link Back Office Login Code';
  const text = [
    'Your Legacy Link login verification code is:',
    '',
    code,
    '',
    'This code expires in 10 minutes.',
    'If you did not request this, ignore this email.'
  ].join('\n');

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a"><h2 style="margin:0 0 10px">Legacy Link Back Office</h2><p>Your verification code is:</p><div style="display:inline-block;background:#111827;color:#fff;padding:8px 14px;border-radius:8px;font-size:20px;font-weight:700;letter-spacing:1px">${code}</div><p style="margin-top:14px">This code expires in 10 minutes.</p></div>`;

  const info = await tx.sendMail({ from, to, subject, text, html });
  return { ok: true, messageId: info?.messageId || '' };
}

export async function issueSession(profile = {}) {
  const sessions = await loadJsonStore(SESSIONS_PATH, []);
  const list = Array.isArray(sessions) ? sessions : [];

  const token = randomBytes(24).toString('hex');
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)).toISOString();

  const next = [
    ...list.filter((s) => clean(s?.email).toLowerCase() !== clean(profile?.email).toLowerCase()),
    {
      tokenHash,
      email: clean(profile?.email).toLowerCase(),
      name: clean(profile?.name),
      agentId: clean(profile?.agentId),
      homeState: clean(profile?.homeState),
      carriersActive: Array.isArray(profile?.carriersActive) ? profile.carriersActive : [],
      createdAt: nowIso(),
      expiresAt,
      active: true
    }
  ];

  await saveJsonStore(SESSIONS_PATH, next);
  return { token, expiresAt };
}

export async function sessionFromToken(rawToken = '') {
  const token = clean(rawToken);
  if (!token) return null;
  const tokenHash = sha256(token);

  const sessions = await loadJsonStore(SESSIONS_PATH, []);
  const list = Array.isArray(sessions) ? sessions : [];
  const row = list.find((s) => clean(s?.tokenHash) === tokenHash && s?.active !== false);
  if (!row) return null;

  const exp = new Date(row.expiresAt || 0);
  if (Number.isNaN(exp.getTime()) || exp.getTime() <= Date.now()) return null;

  return {
    email: clean(row.email).toLowerCase(),
    name: clean(row.name),
    agentId: clean(row.agentId),
    homeState: clean(row.homeState),
    carriersActive: Array.isArray(row.carriersActive) ? row.carriersActive : []
  };
}
