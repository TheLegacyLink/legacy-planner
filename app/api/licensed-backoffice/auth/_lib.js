import nodemailer from 'nodemailer';
import { createHash, randomBytes } from 'crypto';
import { loadJsonStore, saveJsonStore } from '../../../../../lib/blobJsonStore';
import { clean, findLicensedByEmail, isStrongAliasMatch, matchLicensedAgent } from '../../../../../lib/licensedAgentMatch';

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

export async function resolveLicensedProfile({ email = '', fullName = '', phone = '' } = {}) {
  const e = clean(email).toLowerCase();

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
  const m = matchLicensedAgent({ fullName, phone, email });
  if (!m?.matched || !m?.match) {
    await queuePendingVerification({ email: e, fullName, phone, reason: 'no_match', candidates: [] });
    return { ok: false, error: 'pending_verification' };
  }

  if (!isStrongAliasMatch({ fullName, phone }, m.match)) {
    await queuePendingVerification({ email: e, fullName, phone, reason: 'weak_match', candidates: m.candidates || [] });
    return { ok: false, error: 'pending_verification', candidates: m.candidates || [] };
  }

  // Alias policy: up to 2 approved alternate emails per primary roster email.
  const primaryEmail = clean(m.match.email).toLowerCase();
  const activeAliasesForPrimary = aliases.filter((a) => clean(a?.primaryEmail).toLowerCase() === primaryEmail && a?.active !== false);
  const distinctAliasEmails = [...new Set(activeAliasesForPrimary.map((a) => clean(a?.aliasEmail).toLowerCase()).filter(Boolean))];
  const alreadyLinked = distinctAliasEmails.includes(e);
  if (!alreadyLinked && distinctAliasEmails.length >= 2) {
    await queuePendingVerification({ email: e, fullName, phone, reason: 'alias_limit_reached', candidates: [m.match] });
    return { ok: false, error: 'pending_verification_alias_limit' };
  }

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
