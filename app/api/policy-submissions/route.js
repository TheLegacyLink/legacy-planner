export const dynamic = 'force-dynamic';
export const revalidate = 0;

import nodemailer from 'nodemailer';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import users from '../../../data/innerCircleUsers.json';

const STORE_PATH = 'stores/policy-submissions.json';
const SPONSORSHIP_APPS_STORE_PATH = 'stores/sponsorship-applications.json';

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
    submittedBy: clean(row.submittedBy),
    submittedByRole: clean(row.submittedByRole),
    state: clean(row.state).toUpperCase(),
    policyNumber: clean(row.policyNumber),
    monthlyPremium: Number(row.monthlyPremium || 0) || 0,
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

function emailLogoUrl() {
  return clean(process.env.LEGACY_LINK_LOGO_URL || 'https://innercirclelink.com/legacy-link-sponsorship-badge.jpg');
}

function brandEmailFrame(title = '', bodyHtml = '') {
  const logo = emailLogoUrl();
  return `
  <div style="font-family:Inter,Arial,sans-serif; background:#f8fafc; padding:20px;">
    <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
      <div style="padding:16px 20px; background:#0f172a; text-align:center;">
        <img src="${logo}" alt="The Legacy Link" style="max-height:56px; width:auto; object-fit:contain;" />
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
    `Monthly Premium: ${Number(row.monthlyPremium || 0) || 0}`,
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
       <li><strong>Monthly Premium:</strong> ${Number(row.monthlyPremium || 0) || 0}</li>
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

export async function GET() {
  const rows = await getStore();
  rows.sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
  return Response.json({ ok: true, rows });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const mode = clean(body?.mode || 'upsert').toLowerCase();
  const store = await getStore();

  if (mode === 'import_base44') {
    const sourceRows = await loadJsonStore(SPONSORSHIP_APPS_STORE_PATH, []);
    let imported = 0;

    for (const app of sourceRows) {
      const referredByName = mapRefCodeToInnerCircleName(app?.refCode || app?.referral_code || '');
      if (!referredByName) continue; // Inner Circle only

      const applicantName = clean(`${app?.firstName || ''} ${app?.lastName || ''}`);
      if (!applicantName) continue;

      const id = `base44_${clean(app?.id || applicantName.replace(/\s+/g, '_').toLowerCase())}`;
      const idx = store.findIndex((r) => clean(r.id) === id);
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
        monthlyPremium: Number(app?.monthlyPremium || 0) || 0,
        carrier: 'F&G',
        productName: 'IUL Pathsetter',
        status: approved ? 'Approved' : 'Submitted',
        approvedAt,
        payoutDueAt: approved ? followingWeekFridayIso(approvedAt) : '',
        refCode: clean(app?.refCode || ''),
        submittedAt: clean(app?.submitted_at || app?.createdAt || nowIso())
      });

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
    return Response.json({ ok: true, imported, total: store.length });
  }

  if (mode !== 'upsert') return Response.json({ ok: false, error: 'unsupported_mode' }, { status: 400 });

  const rec = normalizedRecord(body?.record || body);
  if (!rec.applicantName) return Response.json({ ok: false, error: 'missing_applicant' }, { status: 400 });

  const idx = store.findIndex((r) => clean(r.id) === rec.id);
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

  await writeStore(store);
  return Response.json({ ok: true, row: rec });
}

export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  const id = clean(body?.id);
  if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const store = await getStore();
  const idx = store.findIndex((r) => clean(r.id) === id);
  if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  const patch = body?.patch || {};
  const prevStatus = clean(store[idx].status).toLowerCase();
  const nextStatus = patch.status != null ? clean(patch.status) : store[idx].status;
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
    monthlyPremium: patch.monthlyPremium != null ? Number(patch.monthlyPremium || 0) || 0 : store[idx].monthlyPremium,
    status: nextStatus,
    approvedAt,
    payoutDueAt,
    policyNumber: patch.policyNumber != null ? clean(patch.policyNumber) : store[idx].policyNumber,
    updatedAt: nowIso()
  };

  let email = null;
  if (approveTransition) {
    email = await sendApprovalEmail(store[idx]).catch((e) => ({ ok: false, error: e?.message || 'email_failed' }));
  } else if (declineTransition) {
    email = await sendDeclineEmail(store[idx]).catch((e) => ({ ok: false, error: e?.message || 'email_failed' }));
  }

  await writeStore(store);
  return Response.json({ ok: true, row: store[idx], email });
}
