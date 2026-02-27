import nodemailer from 'nodemailer';
import users from '../../../data/innerCircleUsers.json';
import { loadJsonFile, saveJsonFile, loadJsonStore } from '../../../lib/blobJsonStore';

const APPS_PATH = 'stores/sponsorship-applications.json';
const BOOKINGS_PATH = 'stores/sponsorship-bookings.json';
const REMINDER_STATE_PATH = 'stores/sponsorship-approved-not-booked-reminders.json';

const REF_CODE_MAP = {
  kimora_link: 'Kimora Link',
  jamal_holmes: 'Jamal Holmes',
  mahogany_burns: 'Mahogany Burns',
  madalyn_adams: 'Madalyn Adams',
  kelin_brown: 'Kelin Brown',
  leticia_wright: 'Leticia Wright',
  latricia_wright: 'Leticia Wright',
  breanna_james: 'Breanna James',
  dr_brianna: 'Breanna James'
};

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeNameKey(v = '') {
  return clean(v).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isApproved(app = {}) {
  return normalize(app?.status).includes('approved');
}

function approvedAnchor(app = {}) {
  const raw = app?.approved_at || app?.approvedAt || app?.reviewedAt || app?.updatedAt || app?.submitted_at || app?.submittedAt;
  const dt = new Date(raw || 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function applicantName(app = {}) {
  return clean(`${app?.firstName || ''} ${app?.lastName || ''}`);
}

function isBooked(app = {}, bookings = []) {
  const appId = clean(app?.id);
  const appNameKey = normalizeNameKey(applicantName(app));
  const appEmail = normalize(app?.email || app?.applicant_email || '');

  return bookings.some((b) => {
    if (clean(b?.source_application_id) && clean(b?.source_application_id) === appId) return true;
    const bNameKey = normalizeNameKey(b?.applicant_name || '');
    const bEmail = normalize(b?.applicant_email || '');
    return (appNameKey && bNameKey && appNameKey === bNameKey) || (appEmail && bEmail && appEmail === bEmail);
  });
}

function referredAgentName(app = {}) {
  const direct = clean(app?.referralName || app?.referredBy || app?.referred_by || '');
  if (direct) return direct;

  const code = clean(app?.refCode || app?.referral_code || '').toLowerCase();
  if (REF_CODE_MAP[code]) return REF_CODE_MAP[code];

  const normalizedCode = code.replace(/[_-]+/g, ' ');
  const hit = (users || []).find((u) => normalize(normalizedCode).includes(normalize(u?.name)) || normalize(u?.name).includes(normalize(normalizedCode)));
  return clean(hit?.name);
}

function referredAgentEmail(app = {}) {
  const name = referredAgentName(app);
  if (!name) return '';
  const hit = (users || []).find((u) => normalize(u?.name) === normalize(name));
  return clean(hit?.email);
}

function smtp() {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass || !from) return null;
  return {
    from,
    tx: nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  };
}

function brandFrame(title = '', bodyHtml = '') {
  const royalBlue = '#0047AB';
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;line-height:1.6;"><div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><div style="background:${royalBlue};padding:18px 18px;text-align:center;"><div style="color:#ffffff;font-weight:800;font-size:32px;letter-spacing:.8px;line-height:1;">THE LEGACY LINK</div></div><div style="padding:20px;"><h2 style="margin:0 0 12px;font-size:20px;color:#0f172a;">${title}</h2>${bodyHtml}<p style="margin:18px 0 0;color:#475569;">— The Legacy Link Support Team</p></div></div></div>`;
}

async function sendBrandedEmail({ to = '', subject = '', text = '', htmlBody = '' }) {
  const mailer = smtp();
  if (!mailer) return { ok: false, error: 'missing_gmail_env' };

  const html = brandFrame(subject, htmlBody || `<p style="white-space:pre-line;">${clean(text).replace(/\n/g, '<br/>')}</p>`);
  try {
    const info = await mailer.tx.sendMail({ from: mailer.from, to, subject, text, html });
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    return { ok: false, error: error?.message || 'send_failed' };
  }
}

export async function POST() {
  const apps = await loadJsonStore(APPS_PATH, []);
  const bookings = await loadJsonStore(BOOKINGS_PATH, []);
  const state = await loadJsonFile(REMINDER_STATE_PATH, { byId: {}, updatedAt: '' });

  const byId = { ...(state?.byId || {}) };
  const now = new Date();

  let attempted = 0;
  let applicantSent = 0;
  let agentSent = 0;
  const errors = [];

  for (const app of apps) {
    if (!isApproved(app)) continue;
    if (isBooked(app, bookings)) continue;

    const anchor = approvedAnchor(app);
    if (!anchor) continue;

    const ageMs = now.getTime() - anchor.getTime();
    if (ageMs < 24 * 60 * 60 * 1000) continue;

    const appId = clean(app?.id);
    if (!appId) continue;

    const record = byId[appId] || {};
    if (record?.followup24hSentAt && record?.agent24hSentAt) continue;

    const fullName = applicantName(app) || 'Applicant';
    const email = clean(app?.email || app?.applicant_email || '');
    const phone = clean(app?.phone || app?.applicant_phone || 'N/A');
    const bookingLink = `https://innercirclelink.com/sponsorship-booking?id=${encodeURIComponent(appId)}`;

    attempted += 1;

    if (email && !record?.followup24hSentAt) {
      const applicantSubject = 'Reminder: Your Sponsorship Approval is Active — Book Your Call';
      const applicantText = [
        `Hi ${clean(app?.firstName || 'there')},`,
        '',
        'Congratulations again — your sponsorship application has been approved.',
        'Your next step is to book your onboarding call as soon as possible using your personal link below:',
        bookingLink,
        '',
        'If you need help, reply to this email and our team will assist you.',
        '',
        'The Legacy Link Support Team'
      ].join('\n');

      const applicantHtmlBody = `
        <p>Hi <strong>${clean(app?.firstName || 'there')}</strong>,</p>
        <p>Congratulations again — your sponsorship application has been approved.</p>
        <p>Your next step is to book your onboarding call as soon as possible using your personal link below:</p>
        <p><a href="${bookingLink}">${bookingLink}</a></p>
        <p>If you need help, reply to this email and our team will assist you.</p>
      `;

      const out = await sendBrandedEmail({ to: email, subject: applicantSubject, text: applicantText, htmlBody: applicantHtmlBody });
      if (out.ok) {
        applicantSent += 1;
        record.followup24hSentAt = nowIso();
      } else {
        errors.push({ appId, type: 'applicant', error: out.error });
      }
    }

    const agentEmail = referredAgentEmail(app);
    const agentName = referredAgentName(app) || 'Agent';

    if (agentEmail && !record?.agent24hSentAt) {
      const agentSubject = `Action Needed: ${fullName} approved but not booked`;
      const agentText = [
        `Hi ${agentName},`,
        '',
        'This is a 24-hour follow-up notification for one of your referred sponsorship applicants.',
        `${fullName} has been approved but has not booked the onboarding call yet.`,
        '',
        `Applicant Name: ${fullName}`,
        `Applicant Email: ${email || 'N/A'}`,
        `Applicant Phone: ${phone}`,
        `Booking Link: ${bookingLink}`,
        '',
        'Please coordinate with them as soon as possible and get them on schedule.',
        '',
        'The Legacy Link Support Team'
      ].join('\n');

      const agentHtmlBody = `
        <p>Hi <strong>${agentName}</strong>,</p>
        <p>This is a 24-hour follow-up notification for one of your referred sponsorship applicants.</p>
        <p><strong>${fullName}</strong> has been approved but has not booked the onboarding call yet.</p>
        <ul>
          <li><strong>Applicant Name:</strong> ${fullName}</li>
          <li><strong>Applicant Email:</strong> ${email || 'N/A'}</li>
          <li><strong>Applicant Phone:</strong> ${phone}</li>
          <li><strong>Booking Link:</strong> <a href="${bookingLink}">${bookingLink}</a></li>
        </ul>
        <p>Please coordinate with them as soon as possible and get them on schedule.</p>
      `;

      const out = await sendBrandedEmail({ to: agentEmail, subject: agentSubject, text: agentText, htmlBody: agentHtmlBody });
      if (out.ok) {
        agentSent += 1;
        record.agent24hSentAt = nowIso();
      } else {
        errors.push({ appId, type: 'agent', error: out.error });
      }
    }

    if (record.followup24hSentAt || record.agent24hSentAt) {
      record.lastTouchedAt = nowIso();
      byId[appId] = record;
    }
  }

  await saveJsonFile(REMINDER_STATE_PATH, { byId, updatedAt: nowIso() });

  return Response.json({
    ok: true,
    attempted,
    applicantSent,
    agentSent,
    errorsCount: errors.length,
    errors
  });
}

export async function GET() {
  const state = await loadJsonFile(REMINDER_STATE_PATH, { byId: {}, updatedAt: '' });
  const keys = Object.keys(state?.byId || {});
  return Response.json({ ok: true, tracked: keys.length, updatedAt: state?.updatedAt || '' });
}
