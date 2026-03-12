import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { loadJsonStore, saveJsonStore, loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/sponsorship-applications.json';
const MEMBERS_PATH = 'stores/sponsorship-program-members.json';
const INVITES_PATH = 'stores/sponsorship-sop-invites.json';
const AUTH_USERS_PATH = 'stores/sponsorship-sop-auth-users.json';

const DEFAULT_SKOOL_URL = 'https://www.skool.com/legacylink/about';
const DEFAULT_YOUTUBE_URL = 'https://youtu.be/SVvU9SvCH9o?si=H9BNtEDzglTuvJaI';
const DEFAULT_LICENSED_CONTRACTING_URL = 'https://accounts.surancebay.com/oauth/authorize?redirect_uri=https%3A%2F%2Fsurelc.surancebay.com%2Fproducer%2Foauth%3FreturnUrl%3D%252Fprofile%252Fcontact-info%253FgaId%253D168%2526gaId%253D168%2526branch%253DInvestaLink%2526branchVisible%253Dtrue%2526branchEditable%253Dfalse%2526branchRequired%253Dtrue%2526autoAdd%253Dfalse%2526requestMethod%253DGET&gaId=168&client_id=surecrmweb&response_type=code';
const DEFAULT_LICENSED_ONBOARDING_PLAYBOOK_RELATIVE_PATH = 'public/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf';
const DEFAULT_UNLICENSED_ONBOARDING_PLAYBOOK_RELATIVE_PATH = 'public/docs/onboarding/legacy-link-unlicensed-onboarding-playbook.pdf';

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

function buildProgramOnboardingHtml({
  firstName = 'Agent',
  licensed = false,
  intro = '',
  sopLink = '',
  contractingUrl = '',
  skoolUrl = '',
  youtubeUrl = '',
  loginName = '',
  loginPassword = '',
  playbookUrl = ''
} = {}) {
  const title = licensed ? 'Licensed Approval — Execute Your Next Steps' : 'Unlicensed Approval — Start Your Licensing Path';
  const contractingStep = licensed
    ? `<li style="margin-bottom:10px;"><strong>Contracting (Licensed Required):</strong><br/><a href="${contractingUrl}" style="color:#F58426;text-decoration:none;font-weight:700;">${contractingUrl}</a></li>`
    : '';

  return `
  <div style="font-family:Inter,Arial,sans-serif;background:#0B1020;padding:20px;color:#E2E8F0;">
    <div style="max-width:640px;margin:0 auto;border:1px solid #1f2a44;border-radius:14px;overflow:hidden;background:#121A33;">
      <div style="padding:18px 20px;background:#0047AB;text-align:center;">
        <div style="color:#fff;font-weight:800;font-size:32px;letter-spacing:.8px;line-height:1;">THE LEGACY LINK</div>
      </div>
      <div style="padding:20px;">
        <h2 style="margin:0 0 14px;font-size:22px;color:#fff;">${title}</h2>
        <p style="margin:0 0 14px;">Hi ${firstName || 'Agent'},</p>
        <p style="margin:0 0 14px;">${intro}</p>

        <div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">Execute these steps in order</div>
          <ol style="margin:0 0 0 18px;padding:0;">
            <li style="margin-bottom:10px;"><strong>SOP Portal:</strong><br/><a href="${sopLink}" style="color:#F58426;text-decoration:none;font-weight:700;">${sopLink}</a></li>
            ${contractingStep}
            <li style="margin-bottom:10px;"><strong>Skool Community:</strong><br/><a href="${skoolUrl}" style="color:#F58426;text-decoration:none;font-weight:700;">${skoolUrl}</a></li>
            <li><strong>YouTube (Whatever It Takes):</strong><br/><a href="${youtubeUrl}" style="color:#F58426;text-decoration:none;font-weight:700;">${youtubeUrl}</a></li>
          </ol>
        </div>

        <div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">Your Login Credentials</div>
          <p style="margin:0 0 6px;"><strong>Login Email:</strong> ${loginName}</p>
          <p style="margin:0;"><strong>Password:</strong> <span style="display:inline-block;background:#F58426;color:#0B1020;padding:4px 10px;border-radius:8px;font-weight:800;">${loginPassword}</span></p>
        </div>

        <div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">Onboarding Playbook (PDF)</div>
          <p style="margin:0 0 10px;">Your track-specific onboarding playbook is attached to this email.</p>
          <a href="${playbookUrl}" style="display:inline-block;background:#F58426;color:#0B1020;padding:10px 14px;border-radius:8px;font-weight:800;text-decoration:none;">Open Playbook Link</a>
        </div>

        <p style="margin:14px 0 0;"><strong>Let’s execute.</strong><br/>The Legacy Link Team</p>
      </div>
    </div>
  </div>`;
}

async function sendSopInviteEmail({ to = '', firstName = '', sopLink = '', licensed = false, loginName = '', loginPassword = '' } = {}) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!to || !user || !pass) return { ok: false, error: 'email_not_configured' };

  const skoolUrl = clean(process.env.SPONSORSHIP_SKOOL_URL || DEFAULT_SKOOL_URL);
  const youtubeUrl = clean(process.env.SPONSORSHIP_YOUTUBE_URL || DEFAULT_YOUTUBE_URL);
  const contractingUrl = clean(process.env.SPONSORSHIP_LICENSED_CONTRACTING_URL || DEFAULT_LICENSED_CONTRACTING_URL);
  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });

  const subject = licensed
    ? 'Legacy Link Approval: Licensed SOP + Contracting (Start Today)'
    : 'Legacy Link Approval: Unlicensed SOP + Licensing Path (Start Today)';

  const intro = licensed
    ? 'You are approved on the licensed track. Complete your SOP and contracting steps now so you can move into production quickly.'
    : 'You are approved on the unlicensed track. Complete your SOP and licensing steps now to unlock lead access.';

  const text = [
    `Hi ${firstName || 'Agent'},`,
    '',
    intro,
    '',
    'Execute these steps in order:',
    `Step 1 — SOP Portal: ${sopLink}`,
    ...(licensed ? [`Step 2 — Contracting (Licensed Required): ${contractingUrl}`] : []),
    `Step ${licensed ? '3' : '2'} — Skool Community: ${skoolUrl}`,
    `Step ${licensed ? '4' : '3'} — YouTube (Whatever It Takes): ${youtubeUrl}`,
    '',
    `SOP Login Name: ${loginName || to}`,
    `SOP Password: ${loginPassword || ''}`,
    '',
    'Your onboarding PDF is attached for a full step-by-step reference.',
    '',
    'Let’s execute.',
    '— The Legacy Link Team'
  ].join('\n');

  const appUrl = clean(process.env.NEXT_PUBLIC_APP_URL || 'https://innercirclelink.com').replace(/\/$/, '');
  const defaultPublicPlaybookPath = licensed
    ? '/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf'
    : '/docs/onboarding/legacy-link-unlicensed-onboarding-playbook.pdf';
  const playbookUrl = clean(process.env.SPONSORSHIP_ONBOARDING_PLAYBOOK_PUBLIC_URL || `${appUrl}${defaultPublicPlaybookPath}`);

  const html = buildProgramOnboardingHtml({
    firstName,
    licensed,
    intro,
    sopLink,
    contractingUrl,
    skoolUrl,
    youtubeUrl,
    loginName: loginName || to,
    loginPassword: loginPassword || '',
    playbookUrl
  });

  const defaultPdfPath = licensed
    ? path.join(process.cwd(), DEFAULT_LICENSED_ONBOARDING_PLAYBOOK_RELATIVE_PATH)
    : path.join(process.cwd(), DEFAULT_UNLICENSED_ONBOARDING_PLAYBOOK_RELATIVE_PATH);
  const configuredPdfPath = licensed
    ? clean(process.env.SPONSORSHIP_ONBOARDING_PDF_PATH_LICENSED || process.env.SPONSORSHIP_ONBOARDING_PDF_PATH || '')
    : clean(process.env.SPONSORSHIP_ONBOARDING_PDF_PATH_UNLICENSED || process.env.SPONSORSHIP_ONBOARDING_PDF_PATH || '');
  const pdfPath = configuredPdfPath || defaultPdfPath;
  const attachmentName = licensed
    ? 'Legacy-Link-Licensed-Onboarding-Playbook.pdf'
    : 'Legacy-Link-Unlicensed-Onboarding-Playbook.pdf';
  const attachments = fs.existsSync(pdfPath)
    ? [{ filename: attachmentName, path: pdfPath, contentType: 'application/pdf' }]
    : [];

  try {
    const info = await tx.sendMail({ from, to, subject, text, html, attachments });
    return { ok: true, messageId: clean(info?.messageId), attachmentIncluded: attachments.length > 0 };
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
