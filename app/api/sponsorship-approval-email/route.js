export const dynamic = 'force-dynamic';
export const revalidate = 0;

import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { loadJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/sponsorship-applications.json';
const ADMIN_EMAILS = new Set(['kimora@thelegacylink.com', 'investalinkinsurance@gmail.com']);

function clean(v = '') { return String(v || '').trim(); }

function isAdmin(email = '') {
  return ADMIN_EMAILS.has(clean(email).toLowerCase());
}

function mailer() {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass) return null;
  return { from, tx: nodemailer.createTransport({ service: 'gmail', auth: { user, pass } }) };
}

function buildApprovalHtml(firstName = '') {
  const templatePath = path.join(process.cwd(), 'templates', 'sponsorship-approval-email.html');
  let html = '';
  try {
    html = fs.readFileSync(templatePath, 'utf8');
  } catch {
    // fallback minimal
    html = `<p>Hi ${firstName || 'there'},</p><p>Your sponsorship has been approved. Please visit <a href="https://innercirclelink.com/start">innercirclelink.com/start</a> to get started.</p>`;
  }
  const safeName = clean(firstName) || 'there';
  html = html.replace(/\{\{FIRST_NAME\}\}/g, safeName);

  // Replace base64-embedded images with hosted URLs — base64 is blocked by Gmail/Outlook
  html = html.replace(/src="data:image\/png;base64,[^"]+"/g, 'src="https://innercirclelink.com/legacy-link-logo-white.png"');
  html = html.replace(/src="data:image\/jpeg;base64,[^"]+"/g, 'src="https://img.youtube.com/vi/l5ulLiizCGg/hqdefault.jpg"');

  return html;
}

function buildApprovalText(firstName = '') {
  const name = clean(firstName) || 'there';
  return [
    `Hi ${name},`,
    '',
    'Your sponsorship has been approved — The Legacy Link',
    '',
    'You filled out the form. You went through the process. And you made it.',
    'Your sponsorship has been approved, which means you now have access to a company-funded insurance policy through National Life Group at no cost to you.',
    '',
    'FOUR STEPS TO GET STARTED:',
    '',
    '1. Sign Your Contract',
    '   This locks in your spot and gives you access to the back office.',
    '   https://innercirclelink.com/start',
    '',
    '2. Book Your Activation Call',
    '   This is your activation call — not just info. Come with your ID ready and camera on.',
    '   https://thelegacylink.com/booking-page-sponsorship',
    '',
    '3. Fill Out the Pre-Qualification Form',
    '   Only required if you want the company-funded policy. Takes about 5 minutes.',
    '   https://innercirclelink.com/apply',
    '',
    '4. Sign Two Quick Documents from National Life Group',
    '   A HIPAA authorization and the application — both arrive by email.',
    '',
    'After that, your policy is processed and mailed to you within 24-48 hours.',
    '',
    'Your legacy starts with a decision. Make it today.',
    '',
    'Kimora Link',
    'Founder, The Legacy Link',
    'thelegacylink.com'
  ].join('\n');
}

async function sendApprovalEmail({ to, firstName }) {
  const m = mailer();
  if (!m) return { ok: false, error: 'mail_not_configured' };

  const subject = 'Your Sponsorship Has Been Approved — The Legacy Link';
  const html = buildApprovalHtml(firstName);
  const text = buildApprovalText(firstName);

  try {
    const info = await m.tx.sendMail({ from: m.from, to, subject, text, html });
    return { ok: true, messageId: info?.messageId || '', accepted: info?.accepted || [] };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

// POST /api/sponsorship-approval-email
// Body: { actorEmail, single: { to, firstName } } → send to one person
// Body: { actorEmail, batch: true } → send to all approved applicants
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const actorEmail = clean(body?.actorEmail || '');

  if (!isAdmin(actorEmail)) {
    return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  // Single send
  if (body?.single) {
    const to = clean(body.single.to || '');
    const firstName = clean(body.single.firstName || '');
    if (!to) return Response.json({ ok: false, error: 'missing_to' }, { status: 400 });
    const result = await sendApprovalEmail({ to, firstName });
    return Response.json({ ok: result.ok, result });
  }

  // Batch send — all approved applicants
  if (body?.batch) {
    const rows = await loadJsonStore(STORE_PATH, []);
    const approved = (Array.isArray(rows) ? rows : []).filter(
      (r) => clean(r?.decision_bucket) === 'auto_approved' || (clean(r?.status || '').toLowerCase().includes('approved') && !clean(r?.status || '').toLowerCase().includes('not'))
    );

    const results = [];
    for (const row of approved) {
      const to = clean(row?.email || '');
      const firstName = clean(row?.firstName || row?.first_name || '');
      if (!to) {
        results.push({ name: firstName, email: to, ok: false, error: 'missing_email' });
        continue;
      }
      // small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 400));
      const result = await sendApprovalEmail({ to, firstName });
      results.push({ name: firstName, email: to, ...result });
    }

    const sent = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    return Response.json({ ok: true, sent, failed, results });
  }

  return Response.json({ ok: false, error: 'missing_single_or_batch' }, { status: 400 });
}
