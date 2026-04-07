import nodemailer from 'nodemailer';
import { createHash, randomBytes } from 'crypto';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import { normalizePersonName } from '../../../lib/nameAliases';

export const CODES_PATH = 'stores/start-auth-codes.json';
export const SESSIONS_PATH = 'stores/start-auth-sessions.json';
const START_INTAKE_PATH = 'stores/start-intake.json';
const APPS_PATH = 'stores/sponsorship-applications.json';
const LICENSED_AGENTS_PATH = 'data/licensedAgents.json';

export function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
export function nowIso() { return new Date().toISOString(); }
export function sha256(v = '') { return createHash('sha256').update(String(v || '')).digest('hex'); }

export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── Profile resolution ────────────────────────────────────────────────────

export async function resolveProfileByEmail(email = '') {
  const e = norm(email);
  if (!e) return null;

  // 1. Check start-intake (most recent registrations, both tracks)
  const intakeRows = await loadJsonStore(START_INTAKE_PATH, []);
  const intake = (Array.isArray(intakeRows) ? intakeRows : []).find((r) => norm(r?.email) === e);
  if (intake) {
    return {
      email: e,
      name: clean(`${clean(intake?.firstName)} ${clean(intake?.lastName)}`),
      phone: clean(intake?.phone || ''),
      state: clean(intake?.homeState || ''),
      trackType: clean(intake?.trackType || 'unlicensed'),
      applicationId: clean(intake?.id || ''),
      referrerName: clean(intake?.referredBy || '')
    };
  }

  // 2. Check sponsorship applications (unlicensed)
  const appRows = await loadJsonStore(APPS_PATH, []);
  const app = (Array.isArray(appRows) ? appRows : []).find((r) => norm(r?.email) === e);
  if (app) {
    const isLicensed = String(app?.isLicensed ?? '').toLowerCase() === 'true';
    return {
      email: e,
      name: clean(`${clean(app?.firstName)} ${clean(app?.lastName)}`),
      phone: clean(app?.phone || ''),
      state: clean(app?.state || ''),
      trackType: isLicensed ? 'licensed' : 'unlicensed',
      applicationId: clean(app?.id || ''),
      referrerName: clean(app?.referralName || app?.referredBy || '')
    };
  }

  // 3. Check licensed agents JSON
  let licensedAgents = [];
  try {
    const rows2 = await loadJsonStore(LICENSED_AGENTS_PATH, []);
    licensedAgents = Array.isArray(rows2) ? rows2 : [];
  } catch {
    const rows = await loadJsonStore(LICENSED_AGENTS_PATH, []);
    licensedAgents = Array.isArray(rows) ? rows : [];
  }
  const agent = licensedAgents.find((r) => norm(r?.email) === e);
  if (agent) {
    const raw = clean(agent?.name || `${clean(agent?.firstName || '')} ${clean(agent?.lastName || '')}`);
    const displayName = raw.includes(',')
      ? raw.split(',').map(s => clean(s)).reverse().join(' ')
      : raw;
    return {
      email: e,
      name: displayName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
      phone: clean(agent?.phone || ''),
      state: clean(agent?.state || agent?.homeState || ''),
      trackType: 'licensed',
      applicationId: clean(agent?.agentId || agent?.npn || ''),
      referrerName: clean(agent?.upline || '')
    };
  }

  return null;
}

// ─── OTP email ────────────────────────────────────────────────────────────

export async function sendOtpEmail({ to = '', code = '', name = '' } = {}) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass) return { ok: false, error: 'missing_gmail_env' };

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,';
  const subject = 'Your Legacy Link Login Code';
  const text = [
    `Legacy Link — Back Office Access`,
    '',
    `Your one-time login code: ${code}`,
    '',
    'This code expires in 10 minutes.',
    '',
    'If you did not request this, you can ignore this email.',
    '',
    '— The Legacy Link Team'
  ].join('\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#040B23;padding:24px;color:#E5E7EB;line-height:1.6;">
      <div style="max-width:680px;margin:0 auto;background:#0B1534;border:1px solid #1E3A8A;border-radius:16px;overflow:hidden;">
        <div style="padding:16px 22px;background:#1651AE;text-align:center;">
          <div style="color:#fff;font-weight:800;font-size:32px;letter-spacing:.8px;">THE LEGACY LINK</div>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 8px;color:#CBD5E1;">${greeting}</p>
          <p style="margin:0 0 16px;color:#CBD5E1;">Use the code below to access your back office:</p>
          <div style="display:inline-block;background:#0F172A;color:#fff;padding:12px 24px;border-radius:10px;font-size:32px;font-weight:800;letter-spacing:4px;margin-bottom:16px;">${code}</div>
          <p style="margin:0 0 8px;color:#94A3B8;font-size:13px;">This code expires in 10 minutes. Do not share it with anyone.</p>
          <p style="margin:16px 0 0;color:#94A3B8;font-size:12px;">If you did not request this code, no action is needed.</p>
        </div>
      </div>
    </div>`;

  const info = await tx.sendMail({ from, to, subject, text, html });
  return { ok: true, messageId: info?.messageId || '' };
}

// ─── OTP store (request + verify) ─────────────────────────────────────────

export async function storeCode({ email = '', code = '' } = {}) {
  const e = norm(email);
  const rows = await loadJsonStore(CODES_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const now = Date.now();
  const filtered = list.filter((r) => norm(r?.email) !== e);
  filtered.push({
    email: e,
    codeHash: sha256(code),
    createdAt: nowIso(),
    expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
    used: false
  });
  await saveJsonStore(CODES_PATH, filtered);
}

export async function verifyCode({ email = '', code = '' } = {}) {
  const e = norm(email);
  const c = clean(code).replace(/\s+/g, '');
  if (!e || !c) return { ok: false, error: 'missing_fields' };

  const rows = await loadJsonStore(CODES_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => norm(r?.email) === e);
  if (idx < 0) return { ok: false, error: 'code_not_found' };

  const row = list[idx];
  if (row?.used) return { ok: false, error: 'code_already_used' };
  if (new Date(row?.expiresAt).getTime() < Date.now()) return { ok: false, error: 'code_expired' };
  if (sha256(c) !== clean(row?.codeHash)) return { ok: false, error: 'invalid_code' };

  // Mark used
  list[idx] = { ...row, used: true, usedAt: nowIso() };
  await saveJsonStore(CODES_PATH, list);
  return { ok: true };
}

// ─── Session (JWT-lite) ────────────────────────────────────────────────────

export async function issueSession(profile = {}) {
  const rows = await loadJsonStore(SESSIONS_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const token = randomBytes(28).toString('hex');
  const tokenHash = sha256(token);
  const e = norm(profile?.email);
  const filtered = list.filter((r) => norm(r?.email) !== e);
  filtered.push({
    tokenHash,
    email: e,
    name: clean(profile?.name),
    phone: clean(profile?.phone || ''),
    state: clean(profile?.state || ''),
    trackType: clean(profile?.trackType || 'unlicensed'),
    applicationId: clean(profile?.applicationId || ''),
    referrerName: clean(profile?.referrerName || ''),
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    active: true
  });
  await saveJsonStore(SESSIONS_PATH, filtered);
  return { token, expiresAt: filtered[filtered.length - 1].expiresAt };
}

export async function sessionFromToken(token = '') {
  const t = clean(token);
  if (!t) return null;
  const h = sha256(t);
  const rows = await loadJsonStore(SESSIONS_PATH, []);
  const hit = (Array.isArray(rows) ? rows : []).find((r) => clean(r?.tokenHash) === h && r?.active !== false);
  if (!hit) return null;
  const exp = new Date(hit?.expiresAt || 0).getTime();
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;
  return {
    email: norm(hit?.email),
    name: clean(hit?.name),
    phone: clean(hit?.phone || ''),
    state: clean(hit?.state || ''),
    trackType: clean(hit?.trackType || 'unlicensed'),
    applicationId: clean(hit?.applicationId || ''),
    referrerName: clean(hit?.referrerName || '')
  };
}
