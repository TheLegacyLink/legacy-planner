export const dynamic = 'force-dynamic';
export const revalidate = 0;

import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { loadJsonStore, saveJsonStore, loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';
import users from '../../../data/innerCircleUsers.json';

const STORE_PATH = 'stores/policy-submissions.json';
const SPONSORSHIP_APPS_STORE_PATH = 'stores/sponsorship-applications.json';
const MEMBERS_PATH = 'stores/sponsorship-program-members.json';
const INVITES_PATH = 'stores/sponsorship-sop-invites.json';
const AUTH_USERS_PATH = 'stores/sponsorship-sop-auth-users.json';
const SPONSORSHIP_BOOKINGS_PATH = 'stores/sponsorship-bookings.json';
const ONBOARDING_DECISIONS_PATH = 'stores/onboarding-decisions.json';
const TEAM_HIERARCHY_PATH = 'stores/team-hierarchy.json';

const DEFAULT_SKOOL_URL = 'https://www.skool.com/legacylink/about';
const DEFAULT_YOUTUBE_URL = 'https://youtu.be/SVvU9SvCH9o?si=H9BNtEDzglTuvJaI';
const DEFAULT_LICENSED_CONTRACTING_URL = 'https://accounts.surancebay.com/oauth/authorize?redirect_uri=https%3A%2F%2Fsurelc.surancebay.com%2Fproducer%2Foauth%3FreturnUrl%3D%252Fprofile%252Fcontact-info%253FgaId%253D168%2526gaId%253D168%2526branch%253DInvestaLink%2526branchVisible%253Dtrue%2526branchEditable%253Dfalse%2526branchRequired%253Dtrue%2526autoAdd%253Dfalse%2526requestMethod%253DGET&gaId=168&client_id=surecrmweb&response_type=code';
const DEFAULT_LICENSED_ONBOARDING_PLAYBOOK_RELATIVE_PATH = 'public/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf';
const DEFAULT_UNLICENSED_ONBOARDING_PLAYBOOK_RELATIVE_PATH = 'public/docs/onboarding/legacy-link-unlicensed-onboarding-playbook.pdf';

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

function randomPassword() {
  const base = Math.random().toString(36).slice(-6).toUpperCase();
  return `LL-${base}`;
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

function personKey(name = '', email = '') {
  const em = normalize(email);
  if (em) return `em:${em}`;
  const nm = normalize(name).replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, '_');
  return nm ? `nm:${nm}` : '';
}

function refCodeFromName(name = '') {
  return clean(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function applicantNameKey(name = '') {
  return clean(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function phoneKey(v = '') {
  return clean(v).replace(/\D/g, '');
}

function bookingMatchesApplicant(booking = {}, rec = {}) {
  const bEmail = clean(booking?.applicant_email || booking?.email || '').toLowerCase();
  const rEmail = clean(rec?.applicantEmail || '').toLowerCase();
  if (bEmail && rEmail && bEmail === rEmail) return true;

  const bPhone = phoneKey(booking?.applicant_phone || booking?.phone || '');
  const rPhone = phoneKey(rec?.applicantPhone || '');
  if (bPhone && rPhone && bPhone === rPhone) return true;

  const bName = applicantNameKey(clean(`${booking?.applicant_first_name || ''} ${booking?.applicant_last_name || ''}`) || booking?.applicant_name || '');
  const rName = applicantNameKey(rec?.applicantName || '');
  return Boolean(bName && rName && bName === rName);
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

function clampAnnualPremium(value = 0) {
  const n = Number(value || 0);
  if (Number.isNaN(n) || n < 0) return 0;
  if (n > 1000000) return 1000000;
  return Math.round(n * 100) / 100;
}

function roundMoney(value = 0) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function normalizePolicyType(value = '') {
  const v = normalize(value);
  if (!v) return '';
  if (v.includes('sponsorship')) return 'Sponsorship Policy';
  if (v.includes('bonus')) return 'Bonus Policy';
  if (v.includes('inner circle')) return 'Inner Circle Policy';
  if (v.includes('juvenile')) return 'Juvenile Policy';
  if (v.includes('regular')) return 'Regular Policy';
  return clean(value);
}

function isInnerCircleName(name = '') {
  const n = normalize(name);
  if (!n) return false;
  return (users || []).some((u) => normalize(u?.name || u?.fullName || '') === n);
}

function sponsorshipFlatRate({ policyWriterName = '', referredByName = '', submittedByRole = '' } = {}) {
  const role = normalize(submittedByRole);
  if (role.includes('inner_circle')) return 500;
  if (isInnerCircleName(policyWriterName) || isInnerCircleName(referredByName)) return 500;
  return 400;
}

function computePolicyPayoutFields({ policyType = '', monthlyPremium = 0, annualPremium = 0, licensed = false, policyWriterName = '', referredByName = '', submittedByRole = '', carrier = '', productName = '' } = {}) {
  const type = normalizePolicyType(policyType);
  const monthly = clampMonthlyPremium(monthlyPremium);
  const annualFromMonthly = roundMoney(monthly * 12);
  const annualInput = clampAnnualPremium(annualPremium || 0);
  const annualPremiumValue = (type === 'Regular Policy' || type === 'Juvenile Policy') && annualInput > 0
    ? annualInput
    : annualFromMonthly;

  let commissionRate = 0;
  let pointsEarned = 0;
  let flatPayout = false;

  if (type === 'Sponsorship Policy') {
    pointsEarned = sponsorshipFlatRate({ policyWriterName, referredByName, submittedByRole });
    flatPayout = true;
  } else if (type === 'Bonus Policy') {
    pointsEarned = licensed ? 500 : 0;
    flatPayout = true;
  } else if (type === 'Inner Circle Policy') {
    const carrierNorm = normalize(carrier);
    const productNorm = normalize(productName);
    const isNlgFlex = carrierNorm.includes('national life') || productNorm.includes('flex life');
    pointsEarned = isNlgFlex ? 1200 : 500;
    flatPayout = true;
  } else if (type === 'Regular Policy') {
    commissionRate = 0.7;
    pointsEarned = roundMoney(annualPremiumValue * commissionRate);
  } else if (type === 'Juvenile Policy') {
    commissionRate = 0.5;
    pointsEarned = roundMoney(annualPremiumValue * commissionRate);
  }

  const advancePayout = flatPayout ? roundMoney(pointsEarned) : roundMoney(pointsEarned * 0.75);
  const remainingBalance = flatPayout ? 0 : roundMoney(pointsEarned - advancePayout);
  const deferredMonthlyPayout = flatPayout ? 0 : roundMoney(remainingBalance / 3);

  return {
    policyType: type,
    monthlyPremium: monthly,
    annualPremium: annualPremiumValue,
    commissionRate,
    pointsEarned: roundMoney(pointsEarned),
    advancePayout,
    remainingBalance,
    month10Payout: deferredMonthlyPayout,
    month11Payout: deferredMonthlyPayout,
    month12Payout: deferredMonthlyPayout
  };
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

async function appendOnboardingDecision(row = {}) {
  const list = await loadJsonStore(ONBOARDING_DECISIONS_PATH, []);
  const rows = Array.isArray(list) ? list : [];
  rows.unshift({
    id: clean(row?.id || `od_${Date.now()}`),
    decision: clean(row?.decision || 'skipped_app') || 'skipped_app',
    applicantName: clean(row?.applicantName || ''),
    applicantEmail: clean(row?.applicantEmail || '').toLowerCase(),
    applicantPhone: clean(row?.applicantPhone || ''),
    applicantLicensedStatus: clean(row?.applicantLicensedStatus || ''),
    referredByName: clean(row?.referredByName || ''),
    policyWriterName: clean(row?.policyWriterName || ''),
    state: clean(row?.state || '').toUpperCase(),
    submittedBy: clean(row?.submittedBy || ''),
    submittedByRole: clean(row?.submittedByRole || ''),
    note: clean(row?.note || ''),
    createdAt: nowIso()
  });
  await saveJsonStore(ONBOARDING_DECISIONS_PATH, rows);
  return rows[0];
}

async function upsertTeamHierarchyLink({ referredByName = '', referredByEmail = '', applicantName = '', applicantEmail = '', policyType = '', appType = '', submittedAt = '' } = {}) {
  const parentName = clean(referredByName);
  const parentEmail = clean(referredByEmail).toLowerCase();
  const childName = clean(applicantName);
  const childEmail = clean(applicantEmail).toLowerCase();

  if ((!parentName && !parentEmail) || (!childName && !childEmail)) {
    return { ok: false, skipped: true, reason: 'missing_parent_or_child' };
  }

  const parentKey = personKey(parentName, parentEmail);
  const childKey = personKey(childName, childEmail);
  if (!parentKey || !childKey || parentKey === childKey) {
    return { ok: false, skipped: true, reason: 'invalid_keys' };
  }

  const list = await loadJsonStore(TEAM_HIERARCHY_PATH, []);
  const rows = Array.isArray(list) ? list : [];
  const idx = rows.findIndex((r) => clean(r?.childKey) === childKey);
  const stamp = nowIso();

  const next = {
    id: idx >= 0 ? clean(rows[idx]?.id) : `th_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    parentKey,
    parentName: parentName || clean(rows[idx]?.parentName || ''),
    parentEmail: parentEmail || clean(rows[idx]?.parentEmail || ''),
    childKey,
    childName: childName || clean(rows[idx]?.childName || ''),
    childEmail: childEmail || clean(rows[idx]?.childEmail || ''),
    source: 'policy_submission',
    rating: Number(idx >= 0 ? rows[idx]?.rating : 0) || 0,
    note: clean(idx >= 0 ? rows[idx]?.note : ''),
    lastAppType: clean(policyType || appType || (idx >= 0 ? rows[idx]?.lastAppType : '')),
    lastEventAt: clean(submittedAt || (idx >= 0 ? rows[idx]?.lastEventAt : '') || stamp),
    createdAt: idx >= 0 ? clean(rows[idx]?.createdAt || stamp) : stamp,
    updatedAt: stamp
  };

  if (idx >= 0) rows[idx] = next;
  else rows.unshift(next);

  await saveJsonStore(TEAM_HIERARCHY_PATH, rows);
  return { ok: true, row: next };
}

function normalizedRecord(row = {}) {
  const appType = clean(row.appType || row.applicationType || row.app_type || '');
  const policyType = normalizePolicyType(row.policyType || appType);
  const applicantLicensedStatus = clean(row.applicantLicensedStatus || row.agentLicensedStatus || '');
  const calc = computePolicyPayoutFields({
    policyType,
    monthlyPremium: row.monthlyPremium || 0,
    annualPremium: row.annualPremium || 0,
    licensed: isLicensedValue(applicantLicensedStatus),
    policyWriterName: row.policyWriterName || '',
    referredByName: row.referredByName || row.referrer || '',
    submittedByRole: row.submittedByRole || '',
    carrier: row.carrier || '',
    productName: row.productName || ''
  });

  const status = clean(row.status || 'Submitted') || 'Submitted';
  const approvalPending = !normalize(status).startsWith('approved');

  return {
    id: clean(row.id) || `pol_${Date.now()}`,
    appType,
    policyType: calc.policyType,
    applicantName: clean(row.applicantName),
    referredByName: clean(row.referredByName),
    referrer: clean(row.referrer || row.referredByName),
    policyWriterName: clean(row.policyWriterName),
    assignedInnerCircleAgent: clean(row.assignedInnerCircleAgent || row.policyWriterName),
    applicantEmail: clean(row.applicantEmail).toLowerCase(),
    applicantPhone: clean(row.applicantPhone),
    applicantLicensedStatus,
    agentLicensedStatus: applicantLicensedStatus,
    submittedBy: clean(row.submittedBy),
    submittedByRole: clean(row.submittedByRole),
    state: clean(row.state).toUpperCase(),
    policyNumber: clean(row.policyNumber),
    monthlyPremium: calc.monthlyPremium,
    annualPremium: calc.annualPremium,
    commissionRate: calc.commissionRate,
    pointsEarned: approvalPending ? 0 : calc.pointsEarned,
    pointsPendingApproval: approvalPending ? calc.pointsEarned : 0,
    advancePayout: approvalPending ? 0 : calc.advancePayout,
    remainingBalance: approvalPending ? 0 : calc.remainingBalance,
    month10Payout: approvalPending ? 0 : calc.month10Payout,
    month11Payout: approvalPending ? 0 : calc.month11Payout,
    month12Payout: approvalPending ? 0 : calc.month12Payout,
    carrier: clean(row.carrier || 'F&G') || 'F&G',
    productName: clean(row.productName || 'IUL Pathsetter') || 'IUL Pathsetter',
    status,
    approvedAt: clean(row.approvedAt || ''),
    payoutDueAt: clean(row.payoutDueAt || ''),
    payoutAmount: Number(row.payoutAmount ?? (approvalPending ? 0 : calc.advancePayout)) || 0,
    payoutStatus: clean(row.payoutStatus || 'Unpaid') || 'Unpaid',
    decisionType: clean(row.decisionType || 'submitted_app') || 'submitted_app',
    payoutPaidAt: clean(row.payoutPaidAt || ''),
    payoutPaidBy: clean(row.payoutPaidBy || ''),
    payoutNotes: clean(row.payoutNotes || ''),
    refCode: clean(row.refCode || ''),
    submittedAt: clean(row.submittedAt || nowIso()),
    updatedAt: nowIso()
  };
}

function applyPolicyMath(row = {}, { preservePayoutAmount = false } = {}) {
  const policyType = normalizePolicyType(row?.policyType || row?.appType || '');
  const licensedStatus = clean(row?.agentLicensedStatus || row?.applicantLicensedStatus || '');
  const calc = computePolicyPayoutFields({
    policyType,
    monthlyPremium: row?.monthlyPremium || 0,
    annualPremium: row?.annualPremium || 0,
    licensed: isLicensedValue(licensedStatus),
    policyWriterName: row?.policyWriterName || '',
    referredByName: row?.referredByName || row?.referrer || '',
    submittedByRole: row?.submittedByRole || '',
    carrier: row?.carrier || '',
    productName: row?.productName || ''
  });

  const isApproved = normalize(row?.status || '').startsWith('approved');
  const approvalPending = !isApproved;

  return {
    ...row,
    policyType: calc.policyType,
    monthlyPremium: calc.monthlyPremium,
    annualPremium: calc.annualPremium,
    commissionRate: calc.commissionRate,
    pointsEarned: approvalPending ? 0 : calc.pointsEarned,
    advancePayout: approvalPending ? 0 : calc.advancePayout,
    remainingBalance: approvalPending ? 0 : calc.remainingBalance,
    month10Payout: approvalPending ? 0 : calc.month10Payout,
    month11Payout: approvalPending ? 0 : calc.month11Payout,
    month12Payout: approvalPending ? 0 : calc.month12Payout,
    payoutAmount: preservePayoutAmount ? Number(row?.payoutAmount || 0) || 0 : (approvalPending ? 0 : calc.advancePayout),
    referrer: clean(row?.referrer || row?.referredByName || ''),
    assignedInnerCircleAgent: clean(row?.assignedInnerCircleAgent || row?.policyWriterName || ''),
    agentLicensedStatus: licensedStatus,
    pointsPendingApproval: approvalPending ? calc.pointsEarned : 0
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

function backOfficeRecipients() {
  const configured = clean(process.env.BACKOFFICE_GHL_SETUP_EMAILS || process.env.BACKOFFICE_GHL_SETUP_EMAIL || '');
  const fallback = 'davevanlarcena0021@gmail.com';
  const list = configured ? configured.split(',').map((s) => clean(s)).filter(Boolean) : [fallback];
  return [...new Set(list)];
}

async function sendBackOfficeGhlSetupEmail(row = {}) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass) return { ok: false, error: 'missing_gmail_env' };

  const recipients = backOfficeRecipients();
  if (!recipients.length) return { ok: false, error: 'missing_backoffice_recipients' };

  const applicant = clean(row?.applicantName || 'Unknown Applicant');
  const email = clean(row?.applicantEmail || '');
  const phone = clean(row?.applicantPhone || '');
  const writer = clean(row?.policyWriterName || '');
  const referrer = clean(row?.referredByName || '');
  const state = clean(row?.state || '');

  const subject = `GHL Setup Needed: ${applicant} (F&G Approved)`;
  const text = [
    'Hi Dave,',
    '',
    'Please create/enable this agent in GoHighLevel so they can receive assigned leads.',
    '',
    `Applicant: ${applicant}`,
    `Email: ${email || '—'}`,
    `Phone: ${phone || '—'}`,
    `State: ${state || '—'}`,
    `Referred By: ${referrer || '—'}`,
    `Policy Writer: ${writer || '—'}`,
    '',
    'Trigger reason: F&G application approved.',
    '',
    '— The Legacy Link System'
  ].join('\n');

  const html = brandEmailFrame(
    'Back Office Action Needed — GHL Setup',
    `<p>Hi Dave,</p>
     <p>Please create/enable this licensed agent in GoHighLevel so they can receive assigned leads.</p>
     <ul style="padding-left:18px; margin:10px 0;">
       <li><strong>Applicant:</strong> ${applicant}</li>
       <li><strong>Email:</strong> ${email || '—'}</li>
       <li><strong>Phone:</strong> ${phone || '—'}</li>
       <li><strong>State:</strong> ${state || '—'}</li>
       <li><strong>Referred By:</strong> ${referrer || '—'}</li>
       <li><strong>Policy Writer:</strong> ${writer || '—'}</li>
     </ul>
     <p><strong>Trigger reason:</strong> F&G application approved.</p>`
  );

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const info = await tx.sendMail({ from, to: recipients.join(', '), subject, text, html });
  return { ok: true, messageId: info?.messageId || '', to: recipients };
}

async function sendPayoutPaidEmail(row = {}) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass) return { ok: false, error: 'missing_gmail_env' };

  const recipients = [...new Set([
    findUserEmailByName(clean(row?.referredByName || '')),
    findUserEmailByName(clean(row?.policyWriterName || '')),
    ...adminEmails()
  ].filter(Boolean))];
  if (!recipients.length) return { ok: false, error: 'no_recipients' };

  const amount = Number(row?.payoutAmount || 0) || 0;
  const subject = `Payout Paid: ${row.applicantName || 'Applicant'}`;
  const text = [
    'Great news — payout has been marked as PAID.',
    '',
    `Client: ${row.applicantName || '—'}`,
    `Referred By: ${row.referredByName || '—'}`,
    `Policy Writer: ${row.policyWriterName || '—'}`,
    `Payout Amount: $${amount.toFixed(2)}`,
    `Paid At: ${row.payoutPaidAt || nowIso()}`,
    '',
    '— The Legacy Link Support Team'
  ].join('\n');

  const html = brandEmailFrame(
    'Payout Marked Paid',
    `<p>Great news — payout has been marked as <strong>PAID</strong>.</p>
     <ul style="padding-left:18px; margin:10px 0;">
       <li><strong>Client:</strong> ${row.applicantName || '—'}</li>
       <li><strong>Referred By:</strong> ${row.referredByName || '—'}</li>
       <li><strong>Policy Writer:</strong> ${row.policyWriterName || '—'}</li>
       <li><strong>Payout Amount:</strong> $${amount.toFixed(2)}</li>
       <li><strong>Paid At:</strong> ${row.payoutPaidAt || nowIso()}</li>
     </ul>`
  );

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const info = await tx.sendMail({ from, to: recipients.join(', '), subject, text, html });
  return { ok: true, messageId: info?.messageId || '', to: recipients };
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

function canonicalInnerCircleName(name = '') {
  const raw = clean(name);
  if (!raw) return '';

  const n = normalize(raw);
  const exact = (users || []).find((u) => normalize(u?.name || '') === n);
  if (exact) return clean(exact.name);

  // common alias/typo seen in flows
  if (n === 'latricia wright') {
    const leticia = (users || []).find((u) => normalize(u?.name || '').includes('leticia wright'));
    if (leticia) return clean(leticia.name);
  }

  return raw;
}

function resolveHierarchyParent(row = {}) {
  // Business rule: hierarchy always follows the referrer (never policy writer fallback).
  const referredByName = canonicalInnerCircleName(clean(row?.referredByName || row?.referrer || ''));
  const parentName = referredByName;

  const referredByEmail = clean(row?.referredByEmail || '').toLowerCase();
  const parentEmail = referredByEmail
    || clean(findUserEmailByName(referredByName) || '').toLowerCase();

  return { parentName, parentEmail };
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
    npn: clean(existing?.npn || ''),
    onboardingComplete: Boolean(existing?.onboardingComplete),
    sponsorshipScriptAcknowledged: Boolean(existing?.sponsorshipScriptAcknowledged),
    communityServiceApproved: Boolean(existing?.communityServiceApproved),
    schoolCommunityJoined: Boolean(existing?.schoolCommunityJoined),
    youtubeCommentApproved: Boolean(existing?.youtubeCommentApproved),
    contractingStarted: Boolean(existing?.contractingStarted),
    contractingComplete: Boolean(existing?.contractingComplete),
    active: existing?.active !== false,
    tier: clean(existing?.tier || 'TIER_SPONSORSHIP') || 'TIER_SPONSORSHIP',
    tier0WeeklyCap: Number(existing?.tier0WeeklyCap || 5),
    tier0StartAt,
    tier0EndAt: clean(existing?.tier0EndAt || plusWeeksIso(tier0StartAt, 8)),
    commissionNonSponsoredPct: Number(existing?.commissionNonSponsoredPct || 50),
    notes: clean(existing?.notes || ''),
    createdAt: clean(existing?.createdAt || now),
    updatedAt: now,
    leadAccessActive: Boolean(
      licensed &&
      clean(existing?.npn) &&
      existing?.communityServiceApproved &&
      existing?.schoolCommunityJoined &&
      existing?.youtubeCommentApproved &&
      (existing?.contractingStarted || existing?.contractingComplete) &&
      existing?.sponsorshipScriptAcknowledged &&
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
  if (!to || !user || !pass) return { ok: false, error: 'missing_gmail_env' };

  const skoolUrl = clean(process.env.SPONSORSHIP_SKOOL_URL || DEFAULT_SKOOL_URL);
  const youtubeUrl = clean(process.env.SPONSORSHIP_YOUTUBE_URL || DEFAULT_YOUTUBE_URL);
  const contractingUrl = clean(process.env.SPONSORSHIP_LICENSED_CONTRACTING_URL || DEFAULT_LICENSED_CONTRACTING_URL);

  const subject = licensed
    ? 'Legacy Link Approval: Licensed SOP + Contracting (Start Today)'
    : 'Legacy Link Approval: Unlicensed SOP + Licensing Path (Start Today)';

  const loginBlockText = ['SOP Login Name: ' + (loginName || to), 'SOP Password: ' + (loginPassword || '')];

  const intro = licensed
    ? 'You are approved on the licensed track. Complete your SOP and contracting steps now so you can move into production quickly.'
    : 'You are approved on the unlicensed track. Complete your SOP and licensing steps now to unlock lead access.';

  const executionChecklist = licensed
    ? [
      `Step 1 — SOP Portal: ${sopLink}`,
      `Step 2 — Contracting (Licensed Required): ${contractingUrl}`,
      `Step 3 — Skool Community: ${skoolUrl}`,
      `Step 4 — YouTube (Whatever It Takes): ${youtubeUrl}`
    ]
    : [
      `Step 1 — SOP Portal: ${sopLink}`,
      `Step 2 — Skool Community: ${skoolUrl}`,
      `Step 3 — YouTube (Whatever It Takes): ${youtubeUrl}`
    ];

  const text = [
    `Hi ${firstName || 'Agent'},`,
    '',
    intro,
    '',
    'Execute these steps in order:',
    ...executionChecklist,
    '',
    ...loginBlockText,
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
    firstName: firstName || 'Agent',
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

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const info = await tx.sendMail({ from, to, subject, text, html, attachments });
  return { ok: true, messageId: info?.messageId || '', attachmentIncluded: attachments.length > 0 };
}

async function sendUnlicensedStartClassEmail(row = {}) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass) return { ok: false, error: 'missing_gmail_env' };

  const jamalEmail = clean(process.env.SPONSORSHIP_UNLICENSED_COACH_EMAIL || findUserEmailByName('Jamal Holmes'));
  if (!jamalEmail) return { ok: false, error: 'missing_jamal_email' };

  const applicant = clean(row?.applicantName || 'Unknown Applicant');
  const email = clean(row?.applicantEmail || '');
  const phone = clean(row?.applicantPhone || '');
  const referrer = clean(row?.referredByName || '');

  const subject = `Unlicensed FNG Submission — Start Online Classes: ${applicant}`;
  const text = [
    'Hi Jamal,',
    '',
    'New unlicensed FNG applicant is ready for onboarding and online class setup.',
    '',
    `Applicant: ${applicant}`,
    `Email: ${email || '—'}`,
    `Phone: ${phone || '—'}`,
    `Referred By: ${referrer || '—'}`,
    '',
    'Please start them on the online classes flow.',
    '',
    '— The Legacy Link System'
  ].join('\n');

  const html = brandEmailFrame(
    'Unlicensed Applicant Ready — Online Classes Start',
    `<p>Hi Jamal,</p>
     <p>New unlicensed FNG applicant is ready for onboarding and online class setup.</p>
     <ul style="padding-left:18px; margin:10px 0;">
       <li><strong>Applicant:</strong> ${applicant}</li>
       <li><strong>Email:</strong> ${email || '—'}</li>
       <li><strong>Phone:</strong> ${phone || '—'}</li>
       <li><strong>Referred By:</strong> ${referrer || '—'}</li>
     </ul>
     <p>Please start them on the online classes flow.</p>`
  );

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const info = await tx.sendMail({ from, to: jamalEmail, subject, text, html });
  return { ok: true, messageId: clean(info?.messageId || ''), to: jamalEmail };
}

async function sendWelcomeEmail(row = {}) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass) return { ok: false, error: 'missing_gmail_env' };

  const to = clean(row?.applicantEmail || '').toLowerCase();
  if (!to) return { ok: false, error: 'missing_applicant_email' };

  const firstName = clean((row?.applicantName || 'Agent').split(' ')[0]) || 'Agent';
  const subject = `You're officially in. Welcome to The Legacy Link. 🏆`;

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
  <body style="margin:0;padding:0;background:#0B1020;font-family:Inter,'Helvetica Neue',Arial,sans-serif;">
    <div style="background:#0B1020;padding:32px 16px;">
      <div style="max-width:600px;margin:0 auto;background:#111827;border:1px solid rgba(200,169,107,0.15);border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <div style="padding:28px 32px 24px;text-align:center;border-bottom:1px solid rgba(200,169,107,0.1);">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#C8A96B;">THE LEGACY LINK</div>
        </div>

        <!-- Body -->
        <div style="padding:36px 32px;">
          <p style="margin:0 0 18px;font-size:17px;font-weight:700;color:#E6D1A6;">Hey ${firstName},</p>

          <p style="margin:0 0 14px;font-size:15px;color:#94a3b8;line-height:1.7;">You just took a step most people only talk about.</p>
          <p style="margin:0 0 14px;font-size:15px;color:#94a3b8;line-height:1.7;">We're glad you're here. Watch this short message from Kimora — it'll take less than 3 minutes.</p>

          <!-- CTA Button -->
          <div style="text-align:center;margin:36px 0;">
            <a href="https://innercirclelink.com/welcome"
               style="display:inline-block;background:linear-gradient(135deg,#C8A96B,#E6D1A6);color:#0B1020;font-size:15px;font-weight:800;text-decoration:none;padding:16px 40px;border-radius:10px;letter-spacing:0.03em;">
              Watch Your Welcome Message &rarr;
            </a>
          </div>

          <p style="margin:0 0 8px;font-size:14px;color:#64748b;line-height:1.7;">Your onboarding materials are on the way. Check your back office at <a href="https://innercirclelink.com/start" style="color:#C8A96B;text-decoration:none;font-weight:600;">innercirclelink.com/start</a> to get started.</p>
        </div>

        <!-- Footer -->
        <div style="padding:24px 32px;border-top:1px solid rgba(200,169,107,0.1);text-align:left;">
          <p style="margin:0;font-size:14px;color:#6b7280;">&mdash; Kimora Link, The Legacy Link</p>
        </div>

      </div>
    </div>
  </body>
  </html>`;

  const text = [
    `Hey ${firstName},`,
    '',
    'You just took a step most people only talk about.',
    "We're glad you're here. Watch this short message from Kimora — it'll take less than 3 minutes.",
    '',
    'Watch your welcome message: https://innercirclelink.com/welcome',
    '',
    'Your onboarding materials are on the way. Check your back office at innercirclelink.com/start to get started.',
    '',
    '— Kimora Link, The Legacy Link'
  ].join('\n');

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const info = await tx.sendMail({ from, to, subject, text, html });
  return { ok: true, messageId: info?.messageId || '', to };
}

async function hasSignedIca(email = '') {
  // Check esign-contracts.json (ICA signed via start portal)
  try {
    const rows = await loadJsonStore('stores/esign-contracts.json', []);
    const list = Array.isArray(rows) ? rows : [];
    const em = normalize(email);
    const hit = list.find((r) => normalize(r?.email || '') === em);
    if (hit?.candidateSignedAt) return true;
  } catch { /* non-fatal */ }

  // Also check contract-signatures.json (legacy/admin-marked signatures)
  try {
    const rows = await loadJsonStore('stores/contract-signatures.json', []);
    const list = Array.isArray(rows) ? rows : [];
    const em = normalize(email);
    const hit = list.find((r) => normalize(r?.email || '') === em);
    if (hit?.signedAt || hit?.signed_at || hit?.completedAt) return true;
  } catch { /* non-fatal */ }

  return false;
}

async function ensureSopProvisionFromActSubmit(row = {}) {
  const email = clean(row?.applicantEmail).toLowerCase();
  const name = clean(row?.applicantName);
  if (!email || !name) return { ok: false, error: 'missing_applicant_identity' };

  const [membersRaw, invitesRaw, authUsersRaw] = await Promise.all([
    loadJsonFile(MEMBERS_PATH, []),
    loadJsonFile(INVITES_PATH, []),
    loadJsonFile(AUTH_USERS_PATH, [])
  ]);

  const members = Array.isArray(membersRaw) ? membersRaw : [];
  const invites = Array.isArray(invitesRaw) ? invitesRaw : [];
  const authUsers = Array.isArray(authUsersRaw) ? authUsersRaw : [];

  const mIdx = members.findIndex((m) => normalize(m?.email || '') === normalize(email));
  const existing = mIdx >= 0 ? members[mIdx] : {};
  const member = buildOrUpdateProgramMember(existing, row);

  if (mIdx >= 0) members[mIdx] = member;
  else members.push(member);

  const invite = upsertInvite(invites, member);
  const authProvision = upsertAuthUser(authUsers, member);

  const appUrl = clean(process.env.NEXT_PUBLIC_APP_URL || 'https://innercirclelink.com').replace(/\/$/, '');
  const sopLink = `${appUrl}/sponsorship-sop?invite=${encodeURIComponent(invite.token)}`;

  const isLicensed = isLicensedValue(row?.applicantLicensedStatus);

  // Duplicate-guard: if the agent already has a signed ICA, their onboarding
  // email was already sent at approval time. Skip the agent-facing SOP invite
  // to prevent duplicate emails. Still provision credentials and notify coach.
  const alreadySigned = await hasSignedIca(email);

  const inviteEmail = alreadySigned
    ? { ok: true, skipped: true, reason: 'ica_already_signed_onboarding_email_previously_sent' }
    : await sendSopInviteEmail({
        to: email,
        firstName: clean(name.split(' ')[0]),
        sopLink,
        licensed: isLicensed,
        loginName: authProvision.user?.email || member.email || email,
        loginPassword: authProvision.plainPassword
      }).catch((e) => ({ ok: false, error: clean(e?.message || 'send_failed') }));

  const unlicensedCoachEmail = !isLicensed
    ? await sendUnlicensedStartClassEmail(row).catch((e) => ({ ok: false, error: clean(e?.message || 'coach_notify_failed') }))
    : { ok: true, skipped: true, reason: 'licensed_track' };

  await Promise.all([
    saveJsonFile(MEMBERS_PATH, members),
    saveJsonFile(INVITES_PATH, invites),
    saveJsonFile(AUTH_USERS_PATH, authUsers)
  ]);

  return { ok: true, sopLink, inviteToken: invite.token, inviteEmail, unlicensedCoachEmail, credentialsCreated: authProvision.created, duplicateEmailSuppressed: alreadySigned };
}

export async function GET() {
  const rows = await getStore();
  rows.sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
  return Response.json({ ok: true, rows });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const requestedModeForDupCheck = clean(body?.mode || 'upsert').toLowerCase();
  const duplicateBypass = Boolean(body?.forceDuplicate || body?.confirmDuplicate);
  if (!duplicateBypass && requestedModeForDupCheck !== 'skip_onboarding') {
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

  if (mode === 'skip_onboarding') {
    const row = {
      id: clean(body?.id || `skip_${Date.now()}`),
      decision: 'skipped_app',
      applicantName: clean(body?.record?.applicantName || body?.applicantName || ''),
      applicantEmail: clean(body?.record?.applicantEmail || body?.applicantEmail || '').toLowerCase(),
      applicantPhone: clean(body?.record?.applicantPhone || body?.applicantPhone || ''),
      applicantLicensedStatus: clean(body?.record?.applicantLicensedStatus || body?.applicantLicensedStatus || ''),
      referredByName: clean(body?.record?.referredByName || body?.referredByName || ''),
      policyWriterName: clean(body?.record?.policyWriterName || body?.policyWriterName || ''),
      state: clean(body?.record?.state || body?.state || '').toUpperCase(),
      submittedBy: clean(body?.record?.submittedBy || body?.submittedBy || ''),
      submittedByRole: clean(body?.record?.submittedByRole || body?.submittedByRole || ''),
      note: clean(body?.record?.note || body?.note || 'Applicant skipped app submission; onboarding credentials requested.')
    };

    if (!row.applicantName || !row.applicantEmail) {
      return Response.json({ ok: false, error: 'missing_applicant_identity' }, { status: 400 });
    }

    const decision = await appendOnboardingDecision(row);
    const parent = resolveHierarchyParent(row);
    const hierarchy = await upsertTeamHierarchyLink({
      referredByName: parent?.parentName,
      referredByEmail: parent?.parentEmail,
      applicantName: row?.applicantName,
      applicantEmail: row?.applicantEmail,
      appType: 'Applicant Skip App',
      submittedAt: nowIso()
    }).catch((e) => ({ ok: false, error: clean(e?.message || 'hierarchy_link_failed') }));
    const sop = await ensureSopProvisionFromActSubmit(row).catch((e) => ({ ok: false, error: clean(e?.message || 'sop_provision_failed') }));

    return Response.json({ ok: true, decision, hierarchy, sop, noProductionCredit: true });
  }

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
        appType: 'Sponsorship App',
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
  if (!rec.appType) return Response.json({ ok: false, error: 'missing_app_type' }, { status: 400 });
  if (!rec.policyType) return Response.json({ ok: false, error: 'missing_policy_type' }, { status: 400 });
  if (!rec.applicantName) return Response.json({ ok: false, error: 'missing_applicant' }, { status: 400 });
  if (rec.policyType === 'Inner Circle Policy' && !normalize(rec.submittedByRole).includes('admin')) {
    return Response.json({ ok: false, error: 'admin_only_inner_circle_submission' }, { status: 403 });
  }

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

  // Queue-retention safeguard: do not auto-remove from sponsorship booking queue here.
  // Bookings are now only auto-expired in sponsorship-bookings route at 24h after booked time.
  const removedFromBookingQueue = 0;

  const parent = resolveHierarchyParent(finalRow);
  const hierarchy = await upsertTeamHierarchyLink({
    referredByName: parent?.parentName,
    referredByEmail: parent?.parentEmail,
    applicantName: finalRow?.applicantName,
    applicantEmail: finalRow?.applicantEmail,
    policyType: finalRow?.policyType,
    appType: finalRow?.appType,
    submittedAt: finalRow?.submittedAt
  }).catch((e) => ({ ok: false, error: clean(e?.message || 'hierarchy_link_failed') }));

  const skipSopProvision = Boolean(body?.skipSopProvision) || normalize(finalRow?.submittedByRole || '').includes('licensed_backoffice');
  const sop = skipSopProvision
    ? { ok: true, skipped: true, reason: 'skip_sop_provision' }
    : await ensureSopProvisionFromActSubmit(finalRow).catch((e) => ({ ok: false, error: clean(e?.message || 'sop_provision_failed') }));

  const welcomeEmail = await sendWelcomeEmail(finalRow).catch((e) => ({ ok: false, error: clean(e?.message || 'welcome_email_failed') }));

  // Notify Jamal for unlicensed submissions — fires regardless of submittedByRole or SOP skip flag
  const isUnlicensedSubmission = !isLicensedValue(finalRow?.applicantLicensedStatus);
  const jamalNotify = isUnlicensedSubmission
    ? await sendUnlicensedStartClassEmail(finalRow).catch((e) => ({ ok: false, error: clean(e?.message || 'jamal_notify_failed') }))
    : { ok: true, skipped: true, reason: 'licensed_applicant' };

  return Response.json({ ok: true, row: finalRow, hierarchy, sop, welcomeEmail, jamalNotify, removedFromBookingQueue, bookingQueueRetention: 'preserved' });
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
  const prevPayoutStatus = clean(store[idx].payoutStatus || 'Unpaid').toLowerCase();
  const nextPayoutStatus = patch.payoutStatus != null ? clean(patch.payoutStatus).toLowerCase() : prevPayoutStatus;
  const paidTransition = prevPayoutStatus !== 'paid' && nextPayoutStatus === 'paid';

  const approvedAt = approveTransition
    ? nowIso()
    : (declineTransition ? '' : (patch.approvedAt != null ? clean(patch.approvedAt) : store[idx].approvedAt));
  const payoutDueAt = approveTransition
    ? followingWeekFridayIso(approvedAt)
    : (declineTransition ? '' : (patch.payoutDueAt != null ? clean(patch.payoutDueAt) : store[idx].payoutDueAt));

  const draftRow = {
    ...store[idx],
    appType: patch.appType != null ? clean(patch.appType) : store[idx].appType,
    payoutAmount: patch.payoutAmount != null ? Number(patch.payoutAmount || 0) || 0 : store[idx].payoutAmount,
    payoutStatus: patch.payoutStatus != null ? clean(patch.payoutStatus) : store[idx].payoutStatus,
    payoutPaidAt: patch.payoutPaidAt != null ? clean(patch.payoutPaidAt) : store[idx].payoutPaidAt,
    payoutPaidBy: patch.payoutPaidBy != null ? clean(patch.payoutPaidBy) : store[idx].payoutPaidBy,
    payoutNotes: patch.payoutNotes != null ? clean(patch.payoutNotes) : store[idx].payoutNotes,
    referredByName: patch.referredByName != null ? clean(patch.referredByName) : store[idx].referredByName,
    policyWriterName: patch.policyWriterName != null ? clean(patch.policyWriterName) : store[idx].policyWriterName,
    monthlyPremium: patch.monthlyPremium != null ? clampMonthlyPremium(patch.monthlyPremium || 0) : store[idx].monthlyPremium,
    annualPremium: patch.annualPremium != null ? clampAnnualPremium(patch.annualPremium || 0) : store[idx].annualPremium,
    status: nextStatus,
    approvedAt,
    payoutDueAt,
    policyNumber: patch.policyNumber != null ? clean(patch.policyNumber) : store[idx].policyNumber,
    applicantLicensedStatus: patch.applicantLicensedStatus != null ? clean(patch.applicantLicensedStatus) : store[idx].applicantLicensedStatus,
    updatedAt: nowIso()
  };

  store[idx] = applyPolicyMath(draftRow, { preservePayoutAmount: patch.payoutAmount != null });

  let email = null;
  let backOfficeEmail = null;
  let payoutEmail = null;
  let sopProvision = null;

  if (!suppressEmail && approveTransition) {
    email = await sendApprovalEmail(store[idx]).catch((e) => ({ ok: false, error: e?.message || 'email_failed' }));
    if (email?.ok) store[idx].approvedEmailSentAt = nowIso();

    if (isLicensedValue(store[idx]?.applicantLicensedStatus)) {
      backOfficeEmail = await sendBackOfficeGhlSetupEmail(store[idx]).catch((e) => ({ ok: false, error: e?.message || 'backoffice_email_failed' }));
      if (backOfficeEmail?.ok) store[idx].backOfficeNotifiedAt = nowIso();
    } else {
      backOfficeEmail = { ok: true, skipped: true, reason: 'not_licensed_agent' };
    }

    sopProvision = await ensureSopProvisionFromActSubmit(store[idx]).catch((e) => ({ ok: false, error: clean(e?.message || 'sop_provision_failed') }));
    if (sopProvision?.inviteEmail?.ok) {
      store[idx].sopInviteSentAt = nowIso();
    }
  } else if (!suppressEmail && declineTransition) {
    email = await sendDeclineEmail(store[idx]).catch((e) => ({ ok: false, error: e?.message || 'email_failed' }));
  }

  if (!suppressEmail && paidTransition) {
    payoutEmail = await sendPayoutPaidEmail(store[idx]).catch((e) => ({ ok: false, error: e?.message || 'payout_email_failed' }));
    if (payoutEmail?.ok) store[idx].payoutEmailSentAt = nowIso();
  }

  const patchParent = resolveHierarchyParent(store[idx]);
  const hierarchy = await upsertTeamHierarchyLink({
    referredByName: patchParent?.parentName,
    referredByEmail: patchParent?.parentEmail,
    applicantName: store[idx]?.applicantName,
    applicantEmail: store[idx]?.applicantEmail,
    policyType: store[idx]?.policyType,
    appType: store[idx]?.appType,
    submittedAt: store[idx]?.submittedAt
  }).catch((e) => ({ ok: false, error: clean(e?.message || 'hierarchy_link_failed') }));

  await writeStore(store);
  return Response.json({ ok: true, row: store[idx], email, backOfficeEmail, payoutEmail, sopProvision, hierarchy });
}

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const id = clean(searchParams.get('id') || '');
  const applicantName = clean(searchParams.get('applicantName') || searchParams.get('name') || '');

  if (!id && !applicantName) {
    return Response.json({ ok: false, error: 'missing_id_or_applicant_name' }, { status: 400 });
  }

  const store = await getStore();
  const before = store.length;

  let kept = store;
  if (id) {
    kept = store.filter((r) => clean(r?.id) !== id);
  } else {
    const key = applicantNameKey(applicantName);
    kept = store.filter((r) => applicantNameKey(r?.applicantName || '') !== key);
  }

  const removed = before - kept.length;
  if (removed <= 0) {
    return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  await writeStore(kept);
  return Response.json({ ok: true, removed, id: id || null, applicantName: applicantName || null });
}
