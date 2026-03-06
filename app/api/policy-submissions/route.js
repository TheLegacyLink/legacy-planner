export const dynamic = 'force-dynamic';
export const revalidate = 0;

import nodemailer from 'nodemailer';
import { loadJsonStore, saveJsonStore, loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';
import users from '../../../data/innerCircleUsers.json';

const STORE_PATH = 'stores/policy-submissions.json';
const SPONSORSHIP_APPS_STORE_PATH = 'stores/sponsorship-applications.json';
const MEMBERS_PATH = 'stores/sponsorship-program-members.json';
const INVITES_PATH = 'stores/sponsorship-sop-invites.json';

const DEFAULT_SKOOL_URL = 'https://www.skool.com/legacylink/about';
const DEFAULT_YOUTUBE_URL = 'https://youtu.be/SVvU9SvCH9o?si=H9BNtEDzglTuvJaI';

function clean(v = '') {
  return String(v || '').trim();
}


function dupNameKey(v = '') {
  return String(v || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function dupAmount(v) {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function sameDayIso(a = '', b = '') {
  const da = new Date(a || 0);
  const db = new Date(b || 0);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function nowIso() {
  return new Date().toISOString();
}

function randomToken(prefix = 'sop') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function plusWeeksIso(iso = '', weeks = 8) {
  const ts = new Date(iso || Date.now()).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return '';
  return new Date(ts + Number(weeks || 8) * 7 * 24 * 60 * 60 * 1000).toISOString();
}

function isLicensedValue(v = '') {
  const n = normalize(v);
  return n === 'licensed' || n === 'yes' || n === 'true';
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function refCodeFromName(name = '') {
  return clean(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function applicantNameKey(name = '') {
  return clean(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findApplicantIndex(rows = [], applicantName = '', exceptId = '') {
  const key = applicantNameKey(applicantName);
  if (!key) return -1;
  return rows.findIndex((r) => applicantNameKey(r?.applicantName) === key && clean(r?.id) !== clean(exceptId));
}

function clampMonthlyPremium(value = 0) {
  const n = Number(value || 0);
  if (Number.isNaN(n) || n < 0) return 0;
  if (n > 5000) return 5000;
  return Math.round(n * 100) / 100;
}

function followingWeekFridayIso(fromIso = '') {
  const d = fromIso ? new Date(fromIso) : new Date();
  if (Number.isNaN(d.getTime())) return '';

  const day = d.getDay(); // 0 Sun ... 6 Sat
  const mondayOffset = (day + 6) % 7; // Mon->0 ... Sun->6
  const monday = new Date(d);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - mondayOffset);

  const nextWeekFriday = new Date(monday);
  nextWeekFriday.setDate(monday.getDate() + 11); // Friday next week
  nextWeekFriday.setHours(12, 0, 0, 0);
  return nextWeekFriday.toISOString();
}

async function getStore() {
  return await loadJsonStore(STORE_PATH, []);
}

async function writeStore(rows) {
  return await saveJsonStore(STORE_PATH, rows);
}

function normalizedRecord(row = {}) {
  return {
    id: clean(row.id) || `pol_${Date.now()}`,
    applicantName: clean(row.applicantName),
    referredByName: clean(row.referredByName),
    policyWriterName: clean(row.policyWriterName),
    applicantEmail: clean(row.applicantEmail).toLowerCase(),
    applicantPhone: clean(row.applicantPhone),
    applicantLicensedStatus: clean(row.applicantLicensedStatus),
    submittedBy: clean(row.submittedBy),
    submittedByRole: clean(row.submittedByRole),
    state: clean(row.state).toUpperCase(),
    policyNumber: clean(row.policyNumber),
    monthlyPremium: clampMonthlyPremium(row.monthlyPremium || 0),
    carrier: clean(row.carrier || 'F&G') || 'F&G',
    productName: clean(row.productName || 'IUL Pathsetter') || 'IUL Pathsetter',
    status: clean(row.status || 'Submitted') || 'Submitted',
    approvedAt: clean(row.approvedAt || ''),
    payoutDueAt: clean(row.payoutDueAt || ''),
    payoutAmount: Number(row.payoutAmount || 0) || 0,
    payoutStatus: clean(row.payoutStatus || 'Unpaid') || 'Unpaid',
    payoutPaidAt: clean(row.payoutPaidAt || ''),
    payoutPaidBy: clean(row.payoutPaidBy || ''),
    payoutNotes: clean(row.payoutNotes || ''),
    refCode: clean(row.refCode || ''),
    submittedAt: clean(row.submittedAt || nowIso()),
    updatedAt: nowIso()
  };
}

function findUserEmailByName(name = '') {
  const n = normalize(name);
  const hit = (users || []).find((u) => normalize(u.name) === n);
  return clean(hit?.email);
}

function adminEmails() {
  return [...new Set((users || [])
    .filter((u) => normalize(u.role) === 'admin' && clean(u.email))
    .map((u) => clean(u.email)))];
}

function brandEmailFrame(title = '', bodyHtml = '') {
  const royalBlue = '#0047AB';
  return `
  <div style="font-family:Inter,Arial,sans-serif; background:#f8fafc; padding:20px;">
    <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
      <div style="padding:18px 20px; background:${royalBlue}; text-align:center;">
        <div style="color:#fff;font-weight:800;font-size:32px;letter-spacing:.8px;line-height:1;">THE LEGACY LINK</div>
      </div>
      <div style="padding:20px; color:#0f172a;">
        <h2 style="margin:0 0 14px 0; font-size:20px;">${title}</h2>
        ${bodyHtml}
        <p style="margin:18px 0 0 0;">Keep up the great work. 💪</p>
        <p style="margin:8px 0 0 0; color:#334155;"><strong>The Legacy Link Support Team</strong></p>
      </div>
    </div>
  </div>`;
}

async function sendApprovalEmail(row = {}) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass) return { ok: false, error: 'missing_gmail_env' };

  const writer = clean(row.policyWriterName);
  const writerEmail = findUserEmailByName(writer);
  const recipients = [...new Set([writerEmail, ...adminEmails()].filter(Boolean))];
  if (!recipients.length) return { ok: false, error: 'no_recipients' };

  const due = row.payoutDueAt ? new Date(row.payoutDueAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : 'next Friday';
  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const subject = `Policy Approved: ${row.applicantName || 'Applicant'} — payout next week`;

  const text = [
    `Hi ${writer || 'Agent'},`,
    '',
    'Your submitted policy has been approved.',
    '',
    `Client: ${row.applicantName || '—'}`,
    `Referred By: ${row.referredByName || '—'}`,
    `Policy Writer: ${row.policyWriterName || '—'}`,
    `Monthly Premium: ${clampMonthlyPremium(row.monthlyPremium || 0)}`, 
    '',
    `Payout timing: Expect payout the following week on Friday (${due}).`,
    '',
    'Keep up the great work.',
    '',
    'The Legacy Link Support Team'
  ].join('\n');

  const html = brandEmailFrame(
    'Policy Approved',
    `<p>Hi <strong>${writer || 'Agent'}</strong>,</p>
     <p>Your submitted policy has been approved.</p>
     <ul style="padding-left:18px; margin:10px 0;">
       <li><strong>Client:</strong> ${row.applicantName || '—'}</li>
       <li><strong>Referred By:</strong> ${row.referredByName || '—'}</li>
       <li><strong>Policy Writer:</strong> ${row.policyWriterName || '—'}</li>
       <li><strong>Monthly Premium:</strong> ${clampMonthlyPremium(row.monthlyPremium || 0)}</li>
     </ul>
     <p><strong>Payout timing:</strong> Expect payout the following week on Friday (${due}).</p>`
  );

  const info = await tx.sendMail({ from, to: recipients.join(', '), subject, text, html });
  return { ok: true, messageId: info.messageId, to: recipients };
}

async function sendDeclineEmail(row = {}) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass) return { ok: false, error: 'missing_gmail_env' };

  const writer = clean(row.policyWriterName);
  const writerEmail = findUserEmailByName(writer);
  const recipients = [...new Set([writerEmail, ...adminEmails()].filter(Boolean))];
  if (!recipients.length) return { ok: false, error: 'no_recipients' };

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const subject = `Policy Declined: ${row.applicantName || 'Applicant'} — next options`;
  const text = [
    `Hi ${writer || 'Agent'},`,
    '',
    'This policy has been marked as declined.',
    '',
    `Client: ${row.applicantName || '—'}`,
    `Referred By: ${row.referredByName || '—'}`,
    `Policy Writer: ${row.policyWriterName || '—'}`,
    '',
    'Next options to present:',
    '1) JumpStart Program with a qualifying family member',
    '2) Sponsorship Program with spouse (if married)',
    '3) Sponsorship Program with a child age 18+',
    '',
    'Please follow up with the prospect and offer the options above.',
    '',
    'Keep up the great work.',
    '',
    'The Legacy Link Support Team'
  ].join('\n');

  const html = brandEmailFrame(
    'Policy Declined — Next Options',
    `<p>Hi <strong>${writer || 'Agent'}</strong>,</p>
     <p>This policy has been marked as declined.</p>
     <ul style="padding-left:18px; margin:10px 0;">
       <li><strong>Client:</strong> ${row.applicantName || '—'}</li>
       <li><strong>Referred By:</strong> ${row.referredByName || '—'}</li>
       <li><strong>Policy Writer:</strong> ${row.policyWriterName || '—'}</li>
     </ul>
     <p><strong>Next options to present:</strong></p>
     <ol style="padding-left:18px; margin:8px 0;">
       <li>JumpStart Program with a qualifying family member</li>
       <li>Sponsorship Program with spouse (if married)</li>
       <li>Sponsorship Program with a child age 18+</li>
     </ol>
     <p>Please follow up with the prospect and offer the options above.</p>`
  );

  const info = await tx.sendMail({ from, to: recipients.join(', '), subject, text, html });
  return { ok: true, messageId: info.messageId, to: recipients };
}

function mapRefCodeToInnerCircleName(refCode = '') {
  const rc = clean(refCode).toLowerCase();
  if (!rc) return '';

  const exact = (users || []).find((u) => refCodeFromName(u.name) === rc);
  if (exact) return clean(exact.name);

  // common alias seen in flows
  if (rc === 'latricia_wright') {
    const leticia = (users || []).find((u) => normalize(u.name).includes('leticia wright'));
    if (leticia) return clean(leticia.name);
  }

  return '';
}

function buildOrUpdateProgramMember(existing = {}, row = {}) {
  const licensed = isLicensedValue(row?.applicantLicensedStatus);
  const now = nowIso();
  const tier0StartAt = clean(existing?.tier0StartAt || now);

  return {
    id: clean(existing?.id || `spm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    name: clean(existing?.name || row?.applicantName),
    email: clean(existing?.email || row?.applicantEmail).toLowerCase(),
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

async function sendSopInviteEmail({ to = '', firstName = '', sopLink = '', licensed = false } = {}) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!to || !user || !pass) return { ok: false, error: 'missing_gmail_env' };

  const skoolUrl = clean(process.env.SPONSORSHIP_SKOOL_URL || DEFAULT_SKOOL_URL);
  const youtubeUrl = clean(process.env.SPONSORSHIP_YOUTUBE_URL || DEFAULT_YOUTUBE_URL);

  const intro = licensed
    ? 'You are on the licensed track. Complete each SOP step and submit approvals where required.'
    : 'You are currently on the unlicensed track. Complete SOP steps and licensing to unlock lead access.';

  const subject = 'Your Legacy Link Sponsorship SOP Portal';
  const text = [
    `Hi ${firstName || 'Agent'},`,
    '',
    intro,
    `Your personal SOP link: ${sopLink}`,
    `Skool Community: ${skoolUrl}`,
    `YouTube (Whatever It Takes): ${youtubeUrl}`,
    '',
    '— The Legacy Link Team'
  ].join('\n');

  const html = brandEmailFrame(
    'Your Sponsorship SOP Portal',
    `<p>Hi <strong>${firstName || 'Agent'}</strong>,</p>
     <p>${intro}</p>
     <p><strong>Your personal SOP link:</strong><br/><a href="${sopLink}">${sopLink}</a></p>
     <ul style="padding-left:18px; margin:10px 0;">
       <li><strong>Skool Community:</strong> <a href="${skoolUrl}">${skoolUrl}</a></li>
       <li><strong>YouTube (Whatever It Takes):</strong> <a href="${youtubeUrl}">${youtubeUrl}</a></li>
     </ul>`
  );

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const info = await tx.sendMail({ from, to, subject, text, html });
  return { ok: true, messageId: info?.messageId || '' };
}

async function ensureSopProvisionFromActSubmit(row = {}) {
  const email = clean(row?.applicantEmail).toLowerCase();
  const name = clean(row?.applicantName);
  if (!email || !name) return { ok: false, error: 'missing_applicant_identity' };

  const [membersRaw, invitesRaw] = await Promise.all([
    loadJsonFile(MEMBERS_PATH, []),
    loadJsonFile(INVITES_PATH, [])
  ]);

  const members = Array.isArray(membersRaw) ? membersRaw : [];
  const invites = Array.isArray(invitesRaw) ? invitesRaw : [];

  const mIdx = members.findIndex((m) => normalize(m?.email || '') === normalize(email));
  const existing = mIdx >= 0 ? members[mIdx] : {};
  const member = buildOrUpdateProgramMember(existing, row);

  if (mIdx >= 0) members[mIdx] = member;
  else members.push(member);

  const invite = upsertInvite(invites, member);
  const appUrl = clean(process.env.NEXT_PUBLIC_APP_URL || 'https://innercirclelink.com').replace(/\/$/, '');
  const sopLink = `${appUrl}/sponsorship-sop?invite=${encodeURIComponent(invite.token)}`;

  const inviteEmail = await sendSopInviteEmail({
    to: email,
    firstName: clean(name.split(' ')[0]),
    sopLink,
    licensed: isLicensedValue(row?.applicantLicensedStatus)
  }).catch((e) => ({ ok: false, error: clean(e?.message || 'send_failed') }));

  await Promise.all([
    saveJsonFile(MEMBERS_PATH, members),
    saveJsonFile(INVITES_PATH, invites)
  ]);

  return { ok: true, sopLink, inviteToken: invite.token, inviteEmail };
}

export async function GET() {
  const rows = await getStore();
  rows.sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
  return Response.json({ ok: true, rows });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const duplicateBypass = Boolean(body?.forceDuplicate || body?.confirmDuplicate);
  if (!duplicateBypass) {
    const applicantName = String(body?.submission?.applicantName || body?.submission?.applicant_name || body?.applicantName || body?.applicant_name || '');
    const amountRaw = body?.submission?.annualPremium ?? body?.submission?.annual_premium ?? body?.annualPremium ?? body?.annual_premium ?? body?.premium;
    const newNameKey = dupNameKey(applicantName);
    const newAmount = dupAmount(amountRaw);
    if (newNameKey && newAmount > 0) {
      const existingRows = await loadJsonStore(STORE_PATH, []);
      const nowIso = new Date().toISOString();
      const dup = (existingRows || []).find((r) => {
        const existingName = dupNameKey(r?.applicantName || r?.applicant_name || '');
        const existingAmount = dupAmount(r?.annualPremium ?? r?.annual_premium ?? r?.premium);
        const existingAt = r?.submittedAt || r?.submitted_at || r?.createdAt || r?.created_at;
        return existingName === newNameKey && existingAmount === newAmount && sameDayIso(existingAt, nowIso);
      });
      if (dup) {
        return Response.json({ ok: false, error: 'duplicate_submitted_today', message: 'This has already been submitted today. Do you still want to continue?', existing: dup }, { status: 409 });
      }
    }
  }

  const mode = clean(body?.mode || 'upsert').toLowerCase();
  const store = await getStore();

  if (mode === 'import_base44') {
    const sourceRows = await loadJsonStore(SPONSORSHIP_APPS_STORE_PATH, []);
    let imported = 0;
    let skippedDuplicates = 0;

    for (const app of sourceRows) {
      const referredByName = mapRefCodeToInnerCircleName(app?.refCode || app?.referral_code || '');
      if (!referredByName) continue; // Inner Circle only

      const applicantName = clean(`${app?.firstName || ''} ${app?.lastName || ''}`);
      if (!applicantName) continue;

      const id = `base44_${clean(app?.id || applicantName.replace(/\s+/g, '_').toLowerCase())}`;
      const idx = store.findIndex((r) => clean(r.id) === id);
      const duplicateIdx = findApplicantIndex(store, applicantName, id);
      const approved = String(app?.status || '').toLowerCase().includes('approved');
      const approvedAt = approved ? clean(app?.approved_at || app?.reviewedAt || app?.updatedAt || app?.submitted_at || nowIso()) : '';

      const rec = normalizedRecord({
        id,
        applicantName,
        referredByName,
        policyWriterName: clean(app?.policyWriterName || ''),
        submittedBy: 'Base44 Sync',
        submittedByRole: 'system',
        state: clean(app?.state || ''),
        policyNumber: clean(app?.policyNumber || ''),
        monthlyPremium: clampMonthlyPremium(app?.monthlyPremium || 0),
        carrier: 'F&G',
        productName: 'IUL Pathsetter',
        status: approved ? 'Approved' : 'Submitted',
        approvedAt,
        payoutDueAt: approved ? followingWeekFridayIso(approvedAt) : '',
        refCode: clean(app?.refCode || ''),
        submittedAt: clean(app?.submitted_at || app?.createdAt || nowIso())
      });

      // Prevent duplicate credit: keep existing non-system (human-entered) applicant records.
      if (duplicateIdx >= 0 && normalize(store[duplicateIdx]?.submittedByRole) !== 'system') {
        if (approved && normalize(store[duplicateIdx]?.status) !== 'approved') {
          store[duplicateIdx] = {
            ...store[duplicateIdx],
            status: 'Approved',
            approvedAt: store[duplicateIdx]?.approvedAt || approvedAt,
            payoutDueAt: store[duplicateIdx]?.payoutDueAt || followingWeekFridayIso(approvedAt),
            updatedAt: nowIso()
          };
          imported += 1;
        } else {
          skippedDuplicates += 1;
        }
        continue;
      }

      if (duplicateIdx >= 0 && normalize(store[duplicateIdx]?.submittedByRole) === 'system') {
        store[duplicateIdx] = {
          ...store[duplicateIdx],
          ...rec,
          id: store[duplicateIdx].id,
          submittedAt: store[duplicateIdx].submittedAt || rec.submittedAt,
          updatedAt: nowIso()
        };
        imported += 1;
        continue;
      }

      if (idx >= 0) {
        store[idx] = {
          ...store[idx],
          ...rec,
          id: store[idx].id,
          submittedAt: store[idx].submittedAt || rec.submittedAt,
          updatedAt: nowIso()
        };
      } else {
        store.unshift(rec);
      }
      imported += 1;
    }

    await writeStore(store);
    return Response.json({ ok: true, imported, skippedDuplicates, total: store.length });
  }

  if (mode !== 'upsert') return Response.json({ ok: false, error: 'unsupported_mode' }, { status: 400 });

  const rec = normalizedRecord(body?.record || body);
  if (!rec.applicantName) return Response.json({ ok: false, error: 'missing_applicant' }, { status: 400 });

  const idx = store.findIndex((r) => clean(r.id) === rec.id);
  const duplicateIdx = findApplicantIndex(store, rec.applicantName, rec.id);

  if (idx >= 0) {
    store[idx] = {
      ...store[idx],
      ...rec,
      id: store[idx].id,
      submittedAt: store[idx].submittedAt || rec.submittedAt,
      updatedAt: nowIso()
    };
  } else if (duplicateIdx >= 0) {
    // Merge duplicates by applicant name to avoid double credit.
    store[duplicateIdx] = {
      ...store[duplicateIdx],
      ...rec,
      id: store[duplicateIdx].id,
      submittedAt: store[duplicateIdx].submittedAt || rec.submittedAt,
      updatedAt: nowIso()
    };
  } else {
    store.unshift(rec);
  }

  await writeStore(store);

  const finalRow = idx >= 0 ? store[idx] : duplicateIdx >= 0 ? store[duplicateIdx] : rec;
  const sop = await ensureSopProvisionFromActSubmit(finalRow).catch((e) => ({ ok: false, error: clean(e?.message || 'sop_provision_failed') }));

  return Response.json({ ok: true, row: finalRow, sop });
}

export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  const duplicateBypass = Boolean(body?.forceDuplicate || body?.confirmDuplicate);
  if (!duplicateBypass) {
    const applicantName = String(body?.submission?.applicantName || body?.submission?.applicant_name || body?.applicantName || body?.applicant_name || '');
    const amountRaw = body?.submission?.annualPremium ?? body?.submission?.annual_premium ?? body?.annualPremium ?? body?.annual_premium ?? body?.premium;
    const newNameKey = dupNameKey(applicantName);
    const newAmount = dupAmount(amountRaw);
    if (newNameKey && newAmount > 0) {
      const existingRows = await loadJsonStore(STORE_PATH, []);
      const nowIso = new Date().toISOString();
      const dup = (existingRows || []).find((r) => {
        const existingName = dupNameKey(r?.applicantName || r?.applicant_name || '');
        const existingAmount = dupAmount(r?.annualPremium ?? r?.annual_premium ?? r?.premium);
        const existingAt = r?.submittedAt || r?.submitted_at || r?.createdAt || r?.created_at;
        return existingName === newNameKey && existingAmount === newAmount && sameDayIso(existingAt, nowIso);
      });
      if (dup) {
        return Response.json({ ok: false, error: 'duplicate_submitted_today', message: 'This has already been submitted today. Do you still want to continue?', existing: dup }, { status: 409 });
      }
    }
  }

  const id = clean(body?.id);
  if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const store = await getStore();
  const idx = store.findIndex((r) => clean(r.id) === id);
  if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  const patch = body?.patch || {};
  const prevStatus = clean(store[idx].status).toLowerCase();
  const nextStatus = patch.status != null ? clean(patch.status) : store[idx].status;
  const suppressEmail = Boolean(patch?.suppressEmail);
  const approveTransition = prevStatus !== 'approved' && clean(nextStatus).toLowerCase() === 'approved';
  const declineTransition = prevStatus !== 'declined' && clean(nextStatus).toLowerCase() === 'declined';

  const approvedAt = approveTransition
    ? nowIso()
    : (declineTransition ? '' : (patch.approvedAt != null ? clean(patch.approvedAt) : store[idx].approvedAt));
  const payoutDueAt = approveTransition
    ? followingWeekFridayIso(approvedAt)
    : (declineTransition ? '' : (patch.payoutDueAt != null ? clean(patch.payoutDueAt) : store[idx].payoutDueAt));

  store[idx] = {
    ...store[idx],
    payoutAmount: patch.payoutAmount != null ? Number(patch.payoutAmount || 0) || 0 : store[idx].payoutAmount,
    payoutStatus: patch.payoutStatus != null ? clean(patch.payoutStatus) : store[idx].payoutStatus,
    payoutPaidAt: patch.payoutPaidAt != null ? clean(patch.payoutPaidAt) : store[idx].payoutPaidAt,
    payoutPaidBy: patch.payoutPaidBy != null ? clean(patch.payoutPaidBy) : store[idx].payoutPaidBy,
    payoutNotes: patch.payoutNotes != null ? clean(patch.payoutNotes) : store[idx].payoutNotes,
    referredByName: patch.referredByName != null ? clean(patch.referredByName) : store[idx].referredByName,
    policyWriterName: patch.policyWriterName != null ? clean(patch.policyWriterName) : store[idx].policyWriterName,
    monthlyPremium: patch.monthlyPremium != null ? clampMonthlyPremium(patch.monthlyPremium || 0) : store[idx].monthlyPremium,
    status: nextStatus,
    approvedAt,
    payoutDueAt,
    policyNumber: patch.policyNumber != null ? clean(patch.policyNumber) : store[idx].policyNumber,
    updatedAt: nowIso()
  };

  let email = null;
  if (!suppressEmail && approveTransition) {
    email = await sendApprovalEmail(store[idx]).catch((e) => ({ ok: false, error: e?.message || 'email_failed' }));
  } else if (!suppressEmail && declineTransition) {
    email = await sendDeclineEmail(store[idx]).catch((e) => ({ ok: false, error: e?.message || 'email_failed' }));
  }

  await writeStore(store);
  return Response.json({ ok: true, row: store[idx], email });
}
