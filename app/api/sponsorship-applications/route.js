import nodemailer from 'nodemailer';
import { loadJsonStore, saveJsonStore, loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/sponsorship-applications.json';
const MEMBERS_PATH = 'stores/sponsorship-program-members.json';
const INVITES_PATH = 'stores/sponsorship-sop-invites.json';
const AUTH_USERS_PATH = 'stores/sponsorship-sop-auth-users.json';

const DEFAULT_SKOOL_URL = 'https://www.skool.com/legacylink/about';
const DEFAULT_YOUTUBE_URL = 'https://youtu.be/SVvU9SvCH9o?si=H9BNtEDzglTuvJaI';

async function getStore() {
  return await loadJsonStore(STORE_PATH, []);
}

async function writeStore(rows) {
  return await saveJsonStore(STORE_PATH, rows);
}

function clean(v = '') {
  return String(v || '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function randomToken(prefix = 'sop') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function randomPassword() {
  const base = Math.random().toString(36).slice(-6).toUpperCase();
  return `LL-${base}`;
}

function plusWeeksIso(iso = '', weeks = 8) {
  const ts = new Date(iso || Date.now()).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return '';
  return new Date(ts + Number(weeks || 8) * 7 * 24 * 60 * 60 * 1000).toISOString();
}

function boolFromLicensed(value = '') {
  return normalize(value) === 'yes' || normalize(value) === 'licensed' || normalize(value) === 'true';
}

function buildOrUpdateProgramMember(existing = {}, app = {}) {
  const licensed = boolFromLicensed(app?.isLicensed);
  const now = nowIso();
  const tier0StartAt = clean(existing?.tier0StartAt || now);

  const member = {
    id: clean(existing?.id || `spm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    name: clean(existing?.name || `${app?.firstName || ''} ${app?.lastName || ''}`),
    email: clean(existing?.email || app?.email).toLowerCase(),
    licensed,
    onboardingComplete: Boolean(existing?.onboardingComplete),
    communityServiceApproved: Boolean(existing?.communityServiceApproved),
    schoolCommunityJoined: Boolean(existing?.schoolCommunityJoined),
    youtubeCommentApproved: Boolean(existing?.youtubeCommentApproved),
    contractingStarted: Boolean(existing?.contractingStarted),
    contractingComplete: Boolean(existing?.contractingComplete),
    active: existing?.active !== false,
    tier: clean(existing?.tier || 'PROGRAM_TIER_0'),
    tier0WeeklyCap: Number(existing?.tier0WeeklyCap || 5),
    tier0StartAt,
    tier0EndAt: clean(existing?.tier0EndAt || plusWeeksIso(tier0StartAt, 8)),
    commissionNonSponsoredPct: Number(existing?.commissionNonSponsoredPct || 50),
    notes: clean(existing?.notes || ''),
    createdAt: clean(existing?.createdAt || now),
    updatedAt: now,
    leadAccessActive: Boolean(
      licensed &&
      existing?.onboardingComplete &&
      existing?.communityServiceApproved &&
      existing?.schoolCommunityJoined &&
      existing?.youtubeCommentApproved &&
      (existing?.contractingStarted || existing?.contractingComplete) &&
      existing?.active !== false
    )
  };

  return member;
}

function upsertInvite(invites = [], member = {}) {
  const em = normalize(member?.email || '');
  const idx = invites.findIndex((i) => normalize(i?.memberEmail) === em);
  const invite = {
    id: clean(idx >= 0 ? invites[idx].id : `spi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    token: randomToken('sop'),
    memberName: clean(member?.name),
    memberEmail: clean(member?.email).toLowerCase(),
    status: 'active',
    createdAt: clean(idx >= 0 ? invites[idx].createdAt : nowIso()),
    updatedAt: nowIso()
  };

  if (idx >= 0) invites[idx] = invite;
  else invites.push(invite);

  return invite;
}

function upsertAuthUser(authUsers = [], member = {}) {
  const email = clean(member?.email).toLowerCase();
  const name = clean(member?.name);
  const idx = authUsers.findIndex((u) => normalize(u?.email) === normalize(email));
  const password = randomPassword();

  if (idx >= 0) {
    authUsers[idx] = {
      ...authUsers[idx],
      name,
      email,
      password,
      active: true,
      role: clean(authUsers[idx]?.role || 'agent') || 'agent',
      updatedAt: nowIso()
    };
    return { user: authUsers[idx], plainPassword: password, created: false, reset: true };
  }

  const user = {
    id: `sau_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    email,
    role: 'agent',
    password,
    active: true,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  authUsers.push(user);
  return { user, plainPassword: password, created: true, reset: false };
}

async function sendSopInviteEmail({ to = '', firstName = '', sopLink = '', licensed = false, loginName = '', loginPassword = '' } = {}) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!to || !user || !pass) return { ok: false, error: 'email_not_configured' };

  const skoolUrl = clean(process.env.SPONSORSHIP_SKOOL_URL || DEFAULT_SKOOL_URL);
  const youtubeUrl = clean(process.env.SPONSORSHIP_YOUTUBE_URL || DEFAULT_YOUTUBE_URL);
  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });

  const subject = 'Your Legacy Link Sponsorship SOP Portal';
  const intro = licensed
    ? 'You are on the licensed track. Complete each SOP step and submit approvals where required.'
    : 'You are currently on the unlicensed track. Complete the SOP steps and licensing milestone to unlock lead access.';

  const loginBlockText = ['SOP Login Name: ' + (loginName || to), 'SOP Password: ' + (loginPassword || '')];

  const text = [
    `Hi ${firstName || 'Agent'},`,
    '',
    'Welcome to your Sponsorship SOP portal.',
    intro,
    '',
    `Your personal SOP link: ${sopLink}`,
    '',
    ...loginBlockText,
    '',
    `Skool Community: ${skoolUrl}`,
    `YouTube (Whatever It Takes): ${youtubeUrl}`,
    '',
    'Some steps are self-complete; some require approval. Click Request Approval where prompted.',
    '',
    '— The Legacy Link Team'
  ].join('\n');

  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;">
    <h2>Your Sponsorship SOP Portal</h2>
    <p>Hi <strong>${firstName || 'Agent'}</strong>,</p>
    <p>${intro}</p>
    <p><strong>Your personal SOP link:</strong><br/><a href="${sopLink}">${sopLink}</a></p>
    <p><strong>SOP Login Name:</strong> ${loginName || to}<br/>
    <strong>SOP Password:</strong> ${loginPassword || ''}</p>
    <ul>
      <li><strong>Skool Community:</strong> <a href="${skoolUrl}">${skoolUrl}</a></li>
      <li><strong>YouTube (Whatever It Takes):</strong> <a href="${youtubeUrl}">${youtubeUrl}</a></li>
    </ul>
    <p>Some steps are self-complete; some require approval. Click <strong>Request Approval</strong> where prompted.</p>
    <p>— The Legacy Link Team</p>
  </div>`;

  try {
    const info = await tx.sendMail({ from, to, subject, text, html });
    return { ok: true, messageId: clean(info?.messageId) };
  } catch (error) {
    return { ok: false, error: clean(error?.message || 'send_failed') || 'send_failed' };
  }
}

function normalizeName(v = '') {
  return clean(v).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizePhone(v = '') {
  return String(v || '').replace(/\D/g, '');
}

function canonicalKey(row = {}) {
  const name = normalizeName(`${row.firstName || ''} ${row.lastName || ''}`);
  if (!name) return '';
  const email = clean(row.email).toLowerCase();
  const phone = normalizePhone(row.phone);
  return `${name}|${email || '-'}|${phone || '-'}`;
}

function validateRequiredSubmissionFields(record = {}) {
  const missing = [];
  const age = Number(record.age || 0);
  const phone = normalizePhone(record.phone);

  if (!clean(record.firstName)) missing.push('firstName');
  if (!clean(record.lastName)) missing.push('lastName');
  if (!clean(record.state)) missing.push('state');
  if (!clean(record.email)) missing.push('email');
  if (!phone || phone.length < 10) missing.push('phone');
  if (!record.age || age < 18 || age > 100) missing.push('age');

  if (!clean(record.healthStatus)) missing.push('healthStatus');
  if (!clean(record.motivation)) missing.push('motivation');
  if (!clean(record.hoursPerWeek)) missing.push('hoursPerWeek');

  if (clean(record.hasIncome).toLowerCase() === 'yes' && !clean(record.incomeSource)) missing.push('incomeSource');
  if (clean(record.isLicensed).toLowerCase() === 'yes' && !clean(record.licenseDetails)) missing.push('licenseDetails');

  const referralLocked = Boolean(clean(record.refCode || record.referral_code));
  if (!referralLocked && !clean(record.referralName)) missing.push('referralName');

  if (clean(record.whyJoin).length < 50) missing.push('whyJoin');
  if (clean(record.goal12Month).length < 20) missing.push('goal12Month');

  if (!record.agreeTraining) missing.push('agreeTraining');
  if (!record.agreeWeekly) missing.push('agreeWeekly');
  if (!record.agreeService) missing.push('agreeService');
  if (!record.agreeTerms) missing.push('agreeTerms');

  return missing;
}

function mostRecentIso(a, b) {
  const da = new Date(a || 0).getTime();
  const db = new Date(b || 0).getTime();
  return db > da ? b : a;
}

function dedupeRows(rows = []) {
  const byKey = new Map();
  let removed = 0;

  const sorted = [...rows].sort((a, b) => {
    const ta = new Date(a.updatedAt || a.submitted_at || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.submitted_at || b.createdAt || 0).getTime();
    return tb - ta;
  });

  for (const row of sorted) {
    const key = canonicalKey(row);
    if (!key || key.endsWith('|-|-')) {
      const passthroughKey = `id:${row.id || Math.random().toString(36).slice(2)}`;
      byKey.set(passthroughKey, row);
      continue;
    }

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }

    removed += 1;
    byKey.set(key, {
      ...row,
      ...existing,
      id: existing.id,
      submitted_at: mostRecentIso(existing.submitted_at, row.submitted_at),
      updatedAt: nowIso()
    });
  }

  return { rows: Array.from(byKey.values()), removed };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const status = clean(searchParams.get('status')).toLowerCase();
  const store = await getStore();
  const rows = status ? store.filter((r) => String(r.status || '').toLowerCase() === status) : store;
  rows.sort((a, b) => new Date(b.submitted_at || b.createdAt || 0).getTime() - new Date(a.submitted_at || a.createdAt || 0).getTime());
  return Response.json({ ok: true, rows });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const mode = clean(body?.mode || 'submit').toLowerCase();
  const store = await getStore();

  if (mode === 'submit') {
    const record = {
      ...body,
      id: clean(body?.id) || `sapp_${Date.now()}`,
      firstName: clean(body?.firstName),
      lastName: clean(body?.lastName),
      email: clean(body?.email),
      phone: clean(body?.phone),
      status: clean(body?.status || 'Pending Review'),
      decision_bucket: clean(body?.decision_bucket || 'manual_review'),
      submitted_at: body?.submitted_at || nowIso(),
      updatedAt: nowIso(),
      normalizedName: normalizeName(`${body?.firstName || ''} ${body?.lastName || ''}`)
    };

    if (!record.firstName || !record.lastName) {
      return Response.json({ ok: false, error: 'missing_name' }, { status: 400 });
    }

    const missing = validateRequiredSubmissionFields(record);
    if (missing.length) {
      return Response.json({ ok: false, error: 'missing_required_fields', missing }, { status: 400 });
    }

    const recordEmail = clean(record.email).toLowerCase();
    const recordPhone = normalizePhone(record.phone);

    const idx = store.findIndex((r) => {
      if (r.id === record.id) return true;

      const sameName = normalizeName(`${r.firstName || ''} ${r.lastName || ''}`) === record.normalizedName;
      const sameEmail = recordEmail && clean(r.email).toLowerCase() === recordEmail;
      const samePhone = recordPhone && normalizePhone(r.phone) === recordPhone;

      return sameName && (sameEmail || samePhone);
    });

    if (idx >= 0) {
      store[idx] = {
        ...store[idx],
        ...record,
        id: store[idx].id,
        submitted_at: store[idx].submitted_at || record.submitted_at,
        updatedAt: nowIso()
      };
    } else {
      store.push(record);
    }

    await writeStore(store);
    return Response.json({ ok: true, row: record });
  }

  if (mode === 'dedupe') {
    const result = dedupeRows(store);
    await writeStore(result.rows);
    return Response.json({ ok: true, removed: result.removed, total: result.rows.length });
  }

  if (mode === 'review') {
    const id = clean(body?.id);
    const decision = clean(body?.decision).toLowerCase();
    if (!id || !decision) return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    const idx = store.findIndex((r) => r.id === id);
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    const status = decision === 'approve' ? 'Approved – Onboarding Pending' : decision === 'decline' ? 'Not Qualified At This Time' : store[idx].status;
    store[idx] = {
      ...store[idx],
      status,
      decision_bucket: decision === 'approve' ? 'auto_approved' : decision === 'decline' ? 'not_qualified' : store[idx].decision_bucket,
      reviewedAt: nowIso(),
      reviewedBy: clean(body?.reviewedBy || 'Kimora'),
      updatedAt: nowIso()
    };

    let sopLink = '';
    let inviteToken = '';
    let inviteEmail = { ok: false, error: 'not_sent' };

    if (decision === 'approve') {
      const [membersRaw, invitesRaw, authUsersRaw] = await Promise.all([
        loadJsonFile(MEMBERS_PATH, []),
        loadJsonFile(INVITES_PATH, []),
        loadJsonFile(AUTH_USERS_PATH, [])
      ]);

      const members = Array.isArray(membersRaw) ? membersRaw : [];
      const invites = Array.isArray(invitesRaw) ? invitesRaw : [];
      const authUsers = Array.isArray(authUsersRaw) ? authUsersRaw : [];
      const approved = store[idx];

      const em = normalize(approved?.email || '');
      const nm = normalize(`${approved?.firstName || ''} ${approved?.lastName || ''}`);
      const mIdx = members.findIndex((m) => normalize(m?.email || '') === em || normalize(m?.name || '') === nm);
      const existingMember = mIdx >= 0 ? members[mIdx] : {};
      const member = buildOrUpdateProgramMember(existingMember, approved);

      if (mIdx >= 0) members[mIdx] = member;
      else members.push(member);

      const invite = upsertInvite(invites, member);
      const authProvision = upsertAuthUser(authUsers, member);
      inviteToken = invite.token;

      const appUrl = clean(process.env.NEXT_PUBLIC_APP_URL || 'https://innercirclelink.com').replace(/\/$/, '');
      sopLink = `${appUrl}/sponsorship-sop?invite=${encodeURIComponent(inviteToken)}`;

      inviteEmail = await sendSopInviteEmail({
        to: clean(member.email),
        firstName: clean(approved?.firstName),
        sopLink,
        licensed: boolFromLicensed(approved?.isLicensed),
        loginName: authProvision.user?.email || member.email || clean(approved?.email),
        loginPassword: authProvision.plainPassword
      });

      store[idx] = {
        ...store[idx],
        sopInviteToken: inviteToken,
        sopLink,
        sopInviteSentAt: inviteEmail.ok ? nowIso() : clean(store[idx]?.sopInviteSentAt || '')
      };

      await Promise.all([
        saveJsonFile(MEMBERS_PATH, members),
        saveJsonFile(INVITES_PATH, invites),
        saveJsonFile(AUTH_USERS_PATH, authUsers)
      ]);
    }

    await writeStore(store);
    return Response.json({ ok: true, row: store[idx], sopLink, inviteToken, inviteEmail });
  }

  return Response.json({ ok: false, error: 'unsupported_mode' }, { status: 400 });
}

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const id = clean(searchParams.get('id'));
  if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const store = await getStore();
  const idx = store.findIndex((r) => r.id === id);
  if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  const [removed] = store.splice(idx, 1);
  await writeStore(store);
  return Response.json({ ok: true, removed });
}
