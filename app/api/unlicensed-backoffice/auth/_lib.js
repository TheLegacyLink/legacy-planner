import nodemailer from 'nodemailer';
import { createHash, randomBytes } from 'crypto';
import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';

const APPS_PATH = 'stores/sponsorship-applications.json';
const START_INTAKE_PATH = 'stores/start-intake.json';
export const CODES_PATH = 'stores/unlicensed-backoffice-login-codes.json';
export const SESSIONS_PATH = 'stores/unlicensed-backoffice-sessions.json';

const UNLICENSED_PREVIEW_USERS = [
  {
    email: 'kimora@thelegacylink.com',
    name: 'Kimora Preview User',
    phone: '',
    state: 'GA',
    applicationId: 'preview_unlicensed_kimora'
  },
  {
    email: 'leticiawright05@gmail.com',
    name: 'Letitia Wright',
    phone: '',
    state: 'GA',
    applicationId: 'preview_unlicensed_letitia'
  }
];

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function digits(v = '') { return clean(v).replace(/\D+/g, ''); }

export function nowIso() { return new Date().toISOString(); }
export function sha256(v = '') { return createHash('sha256').update(String(v || '')).digest('hex'); }

function isUnlicensed(row = {}) {
  const v = String(row?.isLicensed ?? '').toLowerCase();
  return v === 'false' || v === '' || v === '0';
}

async function resolveFromSignedIntake({ email = '' } = {}) {
  const e = norm(email);
  if (!e) return null;

  const rows = await loadJsonStore(START_INTAKE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const hit = list.find((r) => (
    norm(r?.email) === e
    && norm(r?.trackType) === 'unlicensed'
    && norm(r?.contractStatus) === 'signed'
  ));

  if (!hit) return null;

  return {
    email: clean(hit?.email).toLowerCase(),
    name: clean(`${clean(hit?.firstName)} ${clean(hit?.lastName)}`),
    phone: clean(hit?.phone),
    state: clean(hit?.homeState),
    applicationId: clean(hit?.id || `intake_${Date.now()}`),
    referrerName: clean(hit?.referredBy || '')
  };
}

export async function resolveUnlicensedProfile({ email = '', fullName = '' } = {}) {
  const rows = await loadJsonStore(APPS_PATH, []);
  const list = (Array.isArray(rows) ? rows : []).filter(isUnlicensed);

  const e = norm(email);
  const n = norm(fullName);

  if (!e) return { ok: false, error: 'email_required' };

  // Preview/testing allowlist (temporary helper)
  const preview = UNLICENSED_PREVIEW_USERS.find((u) => {
    const emailMatch = norm(u?.email) === e;
    const nameMatch = n ? norm(u?.name) === n : true;
    return emailMatch && nameMatch;
  });
  if (preview) {
    return {
      ok: true,
      profile: {
        email: clean(preview.email).toLowerCase(),
        name: clean(preview.name),
        phone: clean(preview.phone),
        state: clean(preview.state),
        applicationId: clean(preview.applicationId),
        referrerName: clean(preview.referrerName || '')
      }
    };
  }

  const signedIntake = await resolveFromSignedIntake({ email: e });
  if (signedIntake) {
    if (!n || norm(signedIntake?.name) === n) return { ok: true, profile: signedIntake };
  }

  const hit = list.find((r) => {
    const re = norm(r?.email);
    const rn = norm(`${clean(r?.firstName)} ${clean(r?.lastName)}`);
    return re === e && (!n || rn === n);
  }) || null;

  if (!hit) return { ok: false, error: 'not_found' };

  return {
    ok: true,
    profile: {
      email: clean(hit?.email).toLowerCase(),
      name: clean(`${clean(hit?.firstName)} ${clean(hit?.lastName)}`),
      phone: clean(hit?.phone),
      state: clean(hit?.state),
      applicationId: clean(hit?.id),
      referrerName: clean(hit?.referralName || hit?.referredBy || '')
    }
  };
}

export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendCodeEmail({ to = '', code = '' } = {}) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass) return { ok: false, error: 'missing_gmail_env' };

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const subject = 'Legacy Link Unlicensed Back Office Login Code';
  const text = `Your Legacy Link code is: ${code}\n\nThis code expires in 10 minutes.`;
  const html = `<div style="font-family:Arial,sans-serif"><h3>Legacy Link</h3><p>Your code:</p><div style="font-size:20px;font-weight:700;background:#111827;color:#fff;display:inline-block;padding:8px 14px;border-radius:8px;letter-spacing:1px">${code}</div><p>This code expires in 10 minutes.</p></div>`;
  const info = await tx.sendMail({ from, to, subject, text, html });
  return { ok: true, messageId: info?.messageId || '' };
}

export async function issueSession(profile = {}) {
  const rows = await loadJsonStore(SESSIONS_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const token = randomBytes(24).toString('hex');
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const next = [
    ...list.filter((r) => clean(r?.email).toLowerCase() !== clean(profile?.email).toLowerCase()),
    { tokenHash, ...profile, createdAt: nowIso(), expiresAt, active: true }
  ];
  await saveJsonStore(SESSIONS_PATH, next);
  return { token, expiresAt };
}

export async function sessionFromToken(token = '') {
  const t = clean(token);
  if (!t) return null;
  const tokenHash = sha256(t);
  const rows = await loadJsonStore(SESSIONS_PATH, []);
  const hit = (Array.isArray(rows) ? rows : []).find((r) => clean(r?.tokenHash) === tokenHash && r?.active !== false);
  if (!hit) return null;
  const exp = new Date(hit?.expiresAt || 0).getTime();
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;
  return {
    email: clean(hit?.email).toLowerCase(),
    name: clean(hit?.name),
    phone: clean(hit?.phone),
    state: clean(hit?.state),
    applicationId: clean(hit?.applicationId),
    referrerName: clean(hit?.referrerName),
    sessionCreatedAt: clean(hit?.createdAt)
  };
}
