import nodemailer from 'nodemailer';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { loadJsonStore, saveJsonStore, loadJsonFile, saveJsonFile } from '../../../../lib/blobJsonStore';
import { normalizePersonName } from '../../../../lib/nameAliases';

const APPS_PATH = 'stores/sponsorship-applications.json';
const START_INTAKE_PATH = 'stores/start-intake.json';
export const CODES_PATH = 'stores/unlicensed-backoffice-login-codes.json';
export const SESSIONS_PATH = 'stores/unlicensed-backoffice-sessions.json';
export const PASSWORDS_PATH = 'stores/unlicensed-bo-passwords.json';
export const SETUP_TOKENS_PATH = 'stores/unlicensed-bo-setup-tokens.json';

const UNLICENSED_PREVIEW_USERS = [
  {
    email: 'kimora@thelegacylink.com',
    name: 'Kimora Preview User',
    phone: '',
    state: 'GA',
    applicationId: 'preview_unlicensed_kimora'
  },
  {
    email: 'Leticia@thelegacylink.com',
    name: 'Leticia Wright',
    phone: '',
    state: 'GA',
    applicationId: 'preview_unlicensed_leticia'
  }
];

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function normName(v = '') { return normalizePersonName(v); }
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
  const n = normName(fullName);

  if (!e) return { ok: false, error: 'email_required' };

  // Preview/testing allowlist (temporary helper)
  const preview = UNLICENSED_PREVIEW_USERS.find((u) => {
    const emailMatch = norm(u?.email) === e;
    const nameMatch = n ? normName(u?.name) === n : true;
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
    if (!n || normName(signedIntake?.name) === n) return { ok: true, profile: { ...signedIntake, skipIca: true } };
  }

  const hit = list.find((r) => {
    const re = norm(r?.email);
    const rn = normName(`${clean(r?.firstName)} ${clean(r?.lastName)}`);
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
  const text = [
    'Legacy Link — Unlicensed Back Office',
    '',
    `Your login verification code: ${code}`,
    '',
    'This code expires in 10 minutes.',
    '',
    'Start here: https://innercirclelink.com/start'
  ].join('\n');
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#040B23;padding:24px;color:#E5E7EB;line-height:1.6;">
      <div style="max-width:720px;margin:0 auto;background:#0B1534;border:1px solid #1E3A8A;border-radius:16px;overflow:hidden;">
        <div style="padding:16px 22px;background:#1651AE;text-align:center;">
          <div style="color:#fff;font-weight:800;font-size:34px;line-height:1;letter-spacing:.8px;">THE LEGACY LINK</div>
        </div>
        <div style="padding:24px;">
          <h2 style="margin:0 0 10px;font-size:28px;color:#F8FAFC;">Unlicensed Back Office Access</h2>
          <p style="margin:0 0 12px;color:#CBD5E1;">Use this one-time code to sign in:</p>
          <div style="display:inline-block;background:#0F172A;color:#fff;padding:10px 16px;border-radius:10px;font-size:28px;font-weight:800;letter-spacing:2px;">${code}</div>
          <p style="margin:14px 0 10px;color:#CBD5E1;">This code expires in 10 minutes.</p>
          <p style="margin:0;color:#E2E8F0;">Start here:<br/><a href="https://innercirclelink.com/start" target="_blank" rel="noopener noreferrer" style="color:#60A5FA;text-decoration:underline;font-weight:700;">https://innercirclelink.com/start</a></p>
        </div>
      </div>
    </div>`;
  const info = await tx.sendMail({ from, to, subject, text, html });
  return { ok: true, messageId: info?.messageId || '' };
}

export async function issueSession(profile = {}) {
  const rows = await loadJsonStore(SESSIONS_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const token = randomBytes(24).toString('hex');
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const now = Date.now();
  const next = [
    // Prune expired sessions + dedupe by email for this agent
    ...list.filter((r) => {
      const notThisAgent = clean(r?.email).toLowerCase() !== clean(profile?.email).toLowerCase();
      const notExpired = new Date(r?.expiresAt || 0).getTime() > now;
      return notThisAgent && notExpired;
    }),
    { tokenHash, ...profile, createdAt: nowIso(), expiresAt, active: true }
  ];
  await saveJsonStore(SESSIONS_PATH, next);
  return { token, expiresAt };
}

// ─── Password helpers ───────────────────────────────────────────────────────

function scryptAsync(password, salt, keylen) {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, keylen, (err, key) => (err ? reject(err) : resolve(key)))
  );
}

export async function hashPassword(password = '') {
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(String(password), salt, 64);
  return { hash: key.toString('hex'), salt };
}

export async function verifyPassword(password = '', storedHash = '', salt = '') {
  try {
    const key = await scryptAsync(String(password), salt, 64);
    const keyBuf = Buffer.from(key.toString('hex'));
    const storedBuf = Buffer.from(storedHash);
    if (keyBuf.length !== storedBuf.length) return false;
    return timingSafeEqual(keyBuf, storedBuf);
  } catch { return false; }
}

export async function getPasswordRecord(email = '') {
  const e = norm(email);
  const rows = await loadJsonStore(PASSWORDS_PATH, []);
  return (Array.isArray(rows) ? rows : []).find((r) => norm(r?.email) === e) || null;
}

export async function savePasswordRecord(email = '', hash = '', salt = '') {
  const rows = await loadJsonStore(PASSWORDS_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const e = norm(email);
  const next = [
    ...list.filter((r) => norm(r?.email) !== e),
    { email: e, passwordHash: hash, salt, createdAt: nowIso(), updatedAt: nowIso() }
  ];
  await saveJsonStore(PASSWORDS_PATH, next);
}

export async function generateSetupToken(email = '') {
  const e = norm(email);
  const token = randomBytes(32).toString('hex');
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48h
  const rows = await loadJsonStore(SETUP_TOKENS_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const next = [
    ...list.filter((r) => norm(r?.email) !== e && new Date(r?.expiresAt || 0).getTime() > Date.now()),
    { email: e, tokenHash, expiresAt, used: false, createdAt: nowIso() }
  ];
  await saveJsonStore(SETUP_TOKENS_PATH, next);
  return token;
}

export async function verifySetupToken(token = '') {
  const hash = sha256(clean(token));
  const rows = await loadJsonStore(SETUP_TOKENS_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => clean(r?.tokenHash) === hash && !r?.used);
  if (idx < 0) return null;
  const row = list[idx];
  if (new Date(row?.expiresAt || 0).getTime() <= Date.now()) return null;
  return row.email;
}

export async function consumeSetupToken(token = '') {
  const hash = sha256(clean(token));
  const rows = await loadJsonStore(SETUP_TOKENS_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => clean(r?.tokenHash) === hash && !r?.used);
  if (idx < 0) return false;
  list[idx] = { ...list[idx], used: true, usedAt: nowIso() };
  await saveJsonStore(SETUP_TOKENS_PATH, list);
  return true;
}

// ─── Session ─────────────────────────────────────────────────────────────────

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
