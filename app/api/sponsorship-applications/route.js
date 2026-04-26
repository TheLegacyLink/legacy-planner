import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { loadJsonStore, saveJsonStore, loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';
import users from '../../../data/innerCircleUsers.json';

const STORE_PATH = 'stores/sponsorship-applications.json';
const FB_LEADS_PATH = 'stores/fb-leads.json';
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

function refCodeFromName(name = '') {
  return clean(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function looseKey(v = '') {
  return clean(v).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mapRefCodeToName(refCode = '') {
  const rc = clean(refCode).toLowerCase();
  if (!rc) return '';

  const aliases = {
    latricia_wright: 'leticia_wright',
    letitia_wright: 'leticia_wright'
  };
  const key = aliases[rc] || rc;

  const hit = (users || []).find((u) => refCodeFromName(u?.name || '') === key);
  return clean(hit?.name || '');
}

function mapEmailLikeToName(value = '') {
  const lk = looseKey(value);
  if (!lk) return '';

  for (const u of (users || [])) {
    const emKey = looseKey(u?.email || '');
    if (!emKey) continue;
    if (lk === emKey || lk.includes(emKey) || emKey.includes(lk)) return clean(u?.name || '');
  }

  return '';
}

function resolveSponsorDisplayName(row = {}) {
  const direct = clean(row?.referralName || row?.referredByName || row?.referred_by || '');
  const directNorm = normalize(direct);
  if (directNorm) {
    const userHit = (users || []).find((u) => normalize(u?.name || '') === directNorm);
    if (userHit?.name) return clean(userHit.name);
  }

  const fromEmailLike = mapEmailLikeToName(direct);
  if (fromEmailLike) return fromEmailLike;

  const fromRefCode = mapRefCodeToName(row?.refCode || row?.referral_code || '');
  if (fromRefCode) return fromRefCode;

  const codeAsEmailLike = mapEmailLikeToName(row?.refCode || row?.referral_code || '');
  if (codeAsEmailLike) return codeAsEmailLike;

  if (direct) return direct;
  return 'Unattributed';
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

        <div style="margin:14px 0;padding:14px;border:1px solid #92400e;border-radius:10px;background:#1a0e00;">
          <div style="font-weight:800;margin-bottom:8px;color:#fbbf24;">&#x26A0;&#xFE0F; First: Sign Your ICA (Required)</div>
          <p style="margin:0 0 8px;font-size:14px;">Before accessing your back office, you will complete a one-time signing sequence:</p>
          <ul style="margin:0 0 8px 18px;padding:0;font-size:14px;">
            <li>Independent Contractor Agreement (ICA V3)</li>
            <li>Compliance &amp; Coverage Addendum</li>
            <li>Suitability Assessment + Policy Election</li>
          </ul>
          <p style="margin:0;font-size:13px;color:#94a3b8;">This takes about 5 minutes. Complete it in one sitting. Your upline and Kimora Link will be notified for countersignature review.</p>
        </div>

        <div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">Then Execute These Steps in Order</div>
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
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">Onboarding Resources</div>
          <p style="margin:0 0 10px;">Your track-specific onboarding playbook is attached to this email. You can also view your step-by-step visual guide online:</p>
          <a href="https://innercirclelink.com/docs/onboarding/agent-onboarding-guide.html" style="display:inline-block;background:#F58426;color:#0B1020;padding:10px 14px;border-radius:8px;font-weight:800;text-decoration:none;margin-bottom:8px;">View Step-by-Step Onboarding Guide</a><br/>
          <a href="${playbookUrl}" style="display:inline-block;background:#0f172a;color:#F58426;border:1px solid #F58426;padding:10px 14px;border-radius:8px;font-weight:800;text-decoration:none;">Open PDF Playbook</a>
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
    ? 'You are approved on the licensed track. Your first step is to sign your Independent Contractor Agreement — you will be prompted immediately when you log in. Complete it in one sitting (about 5 minutes), then follow the steps below to move into production.'
    : 'You are approved on the unlicensed track. Your first step is to sign your Independent Contractor Agreement — the link is on your confirmation page right now. Complete it in one sitting (about 5 minutes), then follow the steps below to begin your licensing path.';

  const text = [
    `Hi ${firstName || 'Agent'},`,
    '',
    intro,
    '',
    'FIRST — Sign Your ICA (Required before back office access):',
    'You will be prompted to complete: ICA V3 + Compliance Addendum + Suitability Assessment + Policy Election.',
    'This is a one-time requirement. Takes about 5 minutes.',
    '',
    'Then execute these steps in order:',
    `Step 1 — SOP Portal: ${sopLink}`,
    ...(licensed ? [`Step 2 — Contracting (Licensed Required): ${contractingUrl}`] : []),
    `Step ${licensed ? '3' : '2'} — Skool Community: ${skoolUrl}`,
    `Step ${licensed ? '4' : '3'} — YouTube (Whatever It Takes): ${youtubeUrl}`,
    '',
    `SOP Login Name: ${loginName || to}`,
    `SOP Password: ${loginPassword || ''}`,
    '',
    'Step-by-Step Visual Guide: https://innercirclelink.com/docs/onboarding/agent-onboarding-guide.html',
    'Your onboarding PDF is also attached for reference.',
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

function calculateAgeFromBirthday(birthday = '') {
  const dob = new Date(birthday);
  if (Number.isNaN(dob.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
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
  if (!clean(record.birthday)) missing.push('birthday');
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

  const enriched = rows.map((r) => ({
    ...r,
    sponsorDisplayName: resolveSponsorDisplayName(r)
  }));

  return Response.json({ ok: true, rows: enriched });
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
      birthday: clean(body?.birthday || body?.dateOfBirth || ''),
      submitted_at: body?.submitted_at || nowIso(),
      updatedAt: nowIso(),
      normalizedName: normalizeName(`${body?.firstName || ''} ${body?.lastName || ''}`)
    };

    if ((!record.age || Number(record.age) <= 0) && record.birthday) {
      const derivedAge = calculateAgeFromBirthday(record.birthday);
      if (derivedAge > 0) record.age = derivedAge;
    }

    const sponsorName = resolveSponsorDisplayName(record);
    if (sponsorName && sponsorName !== 'Unattributed') {
      record.referralName = sponsorName;
      if (!clean(record.referredByName)) record.referredByName = sponsorName;
      if (!clean(record.referred_by)) record.referred_by = sponsorName;
    }

    // Option B: FB lead assignment overrides form referral attribution.
    // If this applicant was distributed to an agent via the lead hub, that agent gets credit.
    // This prevents mismatches where someone fills out with a different agent's link.
    try {
      const fbLeads = await loadJsonStore(FB_LEADS_PATH, []);
      const appEmail = clean(record.email || '').toLowerCase();
      const appPhone = (record.phone || '').replace(/\D/g, '');
      const matchedLead = (Array.isArray(fbLeads) ? fbLeads : []).find((fl) => {
        const distTo = clean(fl?.distributedTo || '');
        if (!distTo) return false; // not yet assigned
        const flEmail = clean(fl?.email || '').toLowerCase();
        const flPhone = (fl?.phone_number || fl?.phone || '').replace(/\D/g, '');
        if (appEmail && flEmail && appEmail === flEmail) return true;
        if (appPhone && flPhone && appPhone.slice(-10) === flPhone.slice(-10)) return true;
        return false;
      });
      if (matchedLead && clean(matchedLead.distributedTo)) {
        const assignedAgent = clean(matchedLead.distributedTo);
        record.referralName = assignedAgent;
        record.referredByName = assignedAgent;
        record.referred_by = assignedAgent;
        record.sponsorDisplayName = assignedAgent;
        record.refCode = assignedAgent.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        record.referralLocked = true;
        record.assignmentSource = 'fb_lead_distribution';
      }
    } catch { /* non-blocking */ }

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

    // Upsell alert email to Kimora when Agency Ownership or Inner Circle candidate submits
    const upsellTier = clean(record.upsell_tier || '');
    if (upsellTier === 'agency_ownership' || upsellTier === 'inner_circle') {
      try {
        const user = clean(process.env.GMAIL_APP_USER);
        const pass = clean(process.env.GMAIL_APP_PASSWORD);
        const from = clean(process.env.GMAIL_FROM) || user;
        const ownerEmail = clean(process.env.OWNER_NOTIFY_EMAIL || 'support@thelegacylink.com');
        if (user && pass && ownerEmail) {
          const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
          const tierLabel = record.upsell_label || (upsellTier === 'agency_ownership' ? '🏆 Agency Ownership Candidate' : '⭐ Inner Circle Candidate');
          const pitch = record.upsell_pitch || '';
          const incomeLabels = { under_30k: 'Under $30K', '30k_60k': '$30K–$60K', '60k_100k': '$60K–$100K', '100k_plus': '$100K+' };
          const creditLabels = { below_580: 'Below 580', '580_669': '580–669', '670_739': '670–739', '740_plus': '740+' };
          await tx.sendMail({
            from,
            to: ownerEmail,
            subject: `🚨 Upsell Candidate: ${record.firstName} ${record.lastName} — ${tierLabel}`,
            html: `
              <div style="font-family:sans-serif;max-width:560px;">
                <h2 style="margin:0 0 8px;">${tierLabel}</h2>
                <p style="margin:0 0 16px;color:#374151;">${pitch}</p>
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                  <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Name</td><td style="padding:6px 0;"><strong>${record.firstName} ${record.lastName}</strong></td></tr>
                  <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Email</td><td style="padding:6px 0;">${record.email || '—'}</td></tr>
                  <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Phone</td><td style="padding:6px 0;">${record.phone || '—'}</td></tr>
                  <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">State</td><td style="padding:6px 0;">${record.state || '—'}</td></tr>
                  <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Annual Income</td><td style="padding:6px 0;">${incomeLabels[record.annualIncome] || record.annualIncome || '—'}</td></tr>
                  <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Credit Score</td><td style="padding:6px 0;">${creditLabels[record.creditScore] || record.creditScore || '—'}</td></tr>
                  <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Has Income</td><td style="padding:6px 0;">${record.hasIncome === 'yes' ? 'Yes — ' + (record.incomeSource || 'not specified') : 'No'}</td></tr>
                  <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">App Score</td><td style="padding:6px 0;">${record.application_score ?? '—'}/100</td></tr>
                  <tr><td style="padding:6px 12px 6px 0;color:#6b7280;">Submitted</td><td style="padding:6px 0;">${record.submitted_at || '—'}</td></tr>
                </table>
                <p style="margin:20px 0 0;"><a href="https://innercirclelink.com/sponsorship-review" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">View in Review Queue →</a></p>
              </div>
            `
          });
        }
      } catch { /* non-blocking — don't fail the submission */ }
    }

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
