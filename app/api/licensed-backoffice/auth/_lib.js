import nodemailer from 'nodemailer';
import { createHash, randomBytes } from 'crypto';
import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';
import { clean, findLicensedByEmail, isStrongAliasMatch, matchLicensedAgent } from '../../../../lib/licensedAgentMatch';

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

async function resolveFromSignedIca({ email = '' } = {}) {
  const e = clean(email).toLowerCase();
  if (!e) return null;
  try {
    const rows = await loadJsonStore('stores/esign-contracts.json', []);
    const list = Array.isArray(rows) ? rows : [];
    // Accept any signed ICA (licensed or unlicensed track — contract is what matters)
    const hit = list.find((r) => clean(r?.email).toLowerCase() === e && r?.candidateSignedAt);
    if (!hit) return null;
    return {
      email: e,
      name: clean(hit?.name || ''),
      agentId: clean(hit?.applicationId || ''),
      homeState: clean(hit?.state || ''),
      trackType: clean(hit?.trackType || 'licensed'),
      carriersActive: [],
    };
  } catch { return null; }
}

async function resolveFromStartIntake({ email = '' } = {}) {
  const e = clean(email).toLowerCase();
  if (!e) return null;
  try {
    // Check start-intake (people who registered via /start/licensed or /start/unlicensed)
    const rows = await loadJsonStore('stores/start-intake.json', []);
    const list = Array.isArray(rows) ? rows : [];
    const hit = list.find((r) => clean(r?.email).toLowerCase() === e);
    if (!hit) return null;
    const firstName = clean(hit?.firstName || '');
    const lastName = clean(hit?.lastName || '');
    return {
      email: e,
      name: clean(`${firstName} ${lastName}`),
      agentId: clean(hit?.npn || hit?.id || ''),
      homeState: clean(hit?.homeState || hit?.state || ''),
      trackType: clean(hit?.trackType || 'licensed'),
      carriersActive: [],
    };
  } catch { return null; }
}

async function resolveFromSponsorshipApps({ email = '' } = {}) {
  const e = clean(email).toLowerCase();
  if (!e) return null;
  try {
    const rows = await loadJsonStore('stores/sponsorship-applications.json', []);
    const list = Array.isArray(rows) ? rows : [];
    const hit = list.find((r) => clean(r?.email).toLowerCase() === e);
    if (!hit) return null;
    const firstName = clean(hit?.firstName || '');
    const lastName = clean(hit?.lastName || '');
    return {
      email: e,
      name: clean(`${firstName} ${lastName}`),
      agentId: clean(hit?.npn || hit?.id || ''),
      homeState: clean(hit?.state || ''),
      trackType: 'licensed',
      carriersActive: [],
    };
  } catch { return null; }
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
    // ICA fallback: signed contract = access granted, no admin approval needed
    const icaProfile = await resolveFromSignedIca({ email: e });
    if (icaProfile) return { ok: true, profile: icaProfile, via: 'ica_signed' };

    // Start-intake fallback: registered via /start/licensed or /start/unlicensed
    const intakeProfile = await resolveFromStartIntake({ email: e });
    if (intakeProfile) return { ok: true, profile: intakeProfile, via: 'start_intake' };

    // Sponsorship-app fallback
    const appProfile = await resolveFromSponsorshipApps({ email: e });
    if (appProfile) return { ok: true, profile: appProfile, via: 'sponsorship_app' };

    // No match anywhere — not found
    return { ok: false, error: 'not_found' };
  }

  if (!isStrongAliasMatch({ fullName, phone }, m.match)) {
    // Auto-link on weak match instead of queuing for manual review
    const primaryEmail = clean(m.match.email).toLowerCase();
    const activeAliasesForPrimary = aliases.filter((a) => clean(a?.primaryEmail).toLowerCase() === primaryEmail && a?.active !== false);
    const distinctAliasEmails = [...new Set(activeAliasesForPrimary.map((a) => clean(a?.aliasEmail).toLowerCase()).filter(Boolean))];
    const alreadyLinked = distinctAliasEmails.includes(e);
    if (!alreadyLinked && distinctAliasEmails.length < 2) {
      const next = [...aliases];
      const idx = next.findIndex((a) => clean(a?.aliasEmail).toLowerCase() === e);
      const row = {
        aliasEmail: e, primaryEmail, name: clean(m.match.name), phone: clean(m.match.phone),
        agentId: clean(m.match.agentId), active: true, linkedAt: nowIso(), linkedBy: 'auto_weak_match'
      };
      if (idx >= 0) next[idx] = { ...next[idx], ...row };
      else next.push(row);
      await saveAliases(next);
    }
    return { ok: true, profile: m.match, via: 'weak_match_auto' };
  }

  // Alias policy: up to 2 approved alternate emails per primary roster email.
  const primaryEmail = clean(m.match.email).toLowerCase();
  const activeAliasesForPrimary = aliases.filter((a) => clean(a?.primaryEmail).toLowerCase() === primaryEmail && a?.active !== false);
  const distinctAliasEmails = [...new Set(activeAliasesForPrimary.map((a) => clean(a?.aliasEmail).toLowerCase()).filter(Boolean))];
  const alreadyLinked = distinctAliasEmails.includes(e);
  if (!alreadyLinked && distinctAliasEmails.length >= 2) {
    // Alias limit reached — still let them in via the matched profile (no approval gate)
    return { ok: true, profile: m.match, via: 'alias_limit_passthrough' };
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

export async function issueSession(profile = {}, options = {}) {
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
      trainingMode: Boolean(options?.trainingMode),
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
    carriersActive: Array.isArray(row.carriersActive) ? row.carriersActive : [],
    trainingMode: Boolean(row.trainingMode)
  };
}
