import nodemailer from 'nodemailer';
import { createHash, randomBytes } from 'crypto';
import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';

const APPS_PATH = 'stores/sponsorship-applications.json';
export const CODES_PATH = 'stores/unlicensed-backoffice-login-codes.json';
export const SESSIONS_PATH = 'stores/unlicensed-backoffice-sessions.json';

const UNLICENSED_PREVIEW_USERS = [
  {
    email: 'kimora@thelegacylink.com',
    name: 'Kimora Preview User',
    phone: '',
    state: 'GA',
    applicationId: 'preview_unlicensed_kimora'
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

export async function resolveUnlicensedProfile({ email = '', fullName = '', phone = '' } = {}) {
  const rows = await loadJsonStore(APPS_PATH, []);
  const list = (Array.isArray(rows) ? rows : []).filter(isUnlicensed);

  const e = norm(email);
  const p = digits(phone);
  const n = norm(fullName);

  // Preview/testing allowlist (temporary helper)
  const preview = UNLICENSED_PREVIEW_USERS.find((u) => norm(u?.email) === e);
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

  let hit = null;
  if (e) hit = list.find((r) => norm(r?.email) === e) || null;

  if (!hit && (p || n)) {
    const scored = list.map((r) => {
      let score = 0;
      const rn = norm(`${clean(r?.firstName)} ${clean(r?.lastName)}`);
      const rp = digits(r?.phone);
      if (p && rp && (p === rp || p.endsWith(rp) || rp.endsWith(p))) score += 100;
      if (n && rn && n === rn) score += 90;
      return { r, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    hit = scored[0]?.r || null;
  }

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
