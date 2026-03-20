import nodemailer from 'nodemailer';
import users from '../../../data/innerCircleUsers.json';
import { loadJsonFile, saveJsonFile, loadJsonStore } from '../../../lib/blobJsonStore';

const APPS_PATH = 'stores/sponsorship-applications.json';
const BOOKINGS_PATH = 'stores/sponsorship-bookings.json';
const POLICY_SUBMISSIONS_PATH = 'stores/policy-submissions.json';
const CALLER_LEADS_PATH = 'stores/caller-leads.json';
const REMINDER_STATE_PATH = 'stores/sponsorship-approved-not-booked-reminders.json';
const OWNER_REMINDER_EMAIL = 'investalinkagency@gmail.com';

const REF_CODE_MAP = {
  kimora_link: 'Kimora Link',
  jamal_holmes: 'Jamal Holmes',
  mahogany_burns: 'Mahogany Burns',
  madalyn_adams: 'Madalyn Adams',
  kelin_brown: 'Kelin Brown',
  leticia_wright: 'Leticia Wright',
  latricia_wright: 'Leticia Wright',
  breanna_james: 'Breanna James',
  shannon_maxwell: 'Shannon Maxwell',
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

function normalizePhone(v = '') {
  return String(v || '').replace(/\D/g, '');
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

function hasSubmittedPolicy(app = {}, policyRows = []) {
  const appNameKey = normalizeNameKey(applicantName(app));
  const appEmail = normalize(app?.email || app?.applicant_email || '');
  const appPhone = clean(app?.phone || app?.applicant_phone || '').replace(/\D/g, '');

  return (policyRows || []).some((p) => {
    const pStatus = normalize(p?.status || 'submitted');
    const doneStatus = ['submitted', 'approved', 'declined', 'paid', 'pending', 'complete', 'completed', 'booked', 'issued']
      .some((k) => pStatus.includes(k));
    if (!doneStatus) return false;

    const pNameKey = normalizeNameKey(p?.applicantName || p?.applicant_name || '');
    const pEmail = normalize(p?.applicantEmail || p?.applicant_email || '');
    const pPhone = clean(p?.applicantPhone || p?.applicant_phone || '').replace(/\D/g, '');

    const sameApplicant = (appNameKey && pNameKey && appNameKey === pNameKey)
      || (appEmail && pEmail && appEmail === pEmail)
      || (appPhone && pPhone && appPhone === pPhone);

    if (!sameApplicant) return false;

    const policySignal = normalize(`${p?.carrier || ''} ${p?.policyType || ''} ${p?.appType || ''} ${p?.productName || ''}`);
    const fngOrNlg = policySignal.includes('f&g') || policySignal.includes('fg ') || policySignal.includes('national life') || policySignal.includes('nlg') || policySignal.includes('flex life');

    return fngOrNlg || doneStatus;
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

function userByName(name = '') {
  if (!name) return null;
  return (users || []).find((u) => normalize(u?.name) === normalize(name)) || null;
}

function emailByName(name = '') {
  if (isKimora(name)) return OWNER_REMINDER_EMAIL;
  const hit = userByName(name);
  return clean(hit?.email);
}

function referredAgentEmail(app = {}) {
  return emailByName(referredAgentName(app));
}

function isKimora(name = '') {
  return normalize(name) === 'kimora link';
}

const AGENT_TZ_OVERRIDES = {
  'jamal holmes': 'America/New_York',
  'leticia wright': 'America/New_York',
  'latricia wright': 'America/New_York',
  'mahogany burns': 'America/New_York',
  'breanna james': 'America/New_York',
  'donyell richardson': 'America/New_York',
  'shannon maxwell': 'America/New_York',
  'andrea cannon': 'America/New_York',
  'angelica lassiter': 'America/New_York',
  'angelic': 'America/New_York'
};

function resolveAgentTimeZone(agentName = '') {
  const n = normalize(agentName);
  const fromOverride = AGENT_TZ_OVERRIDES[n];
  if (fromOverride) return fromOverride;

  const u = userByName(agentName) || {};
  const tz = clean(u?.timeZone || u?.timezone || '');
  return tz || 'America/New_York';
}

function parseRequestedAtEst(raw = '') {
  const v = clean(raw);
  if (!v) return null;

  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  let hour12 = Number(m[4]);
  const minute = Number(m[5]);
  const ampm = String(m[6] || '').toUpperCase();
  if (ampm === 'PM' && hour12 !== 12) hour12 += 12;
  if (ampm === 'AM' && hour12 === 12) hour12 = 0;

  // Treat source string as Eastern Time wall clock by app convention.
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-04:00`;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatInTz(dateValue, timeZone = 'America/New_York') {
  if (!dateValue) return '';
  const dt = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
    timeZoneName: 'short'
  }).format(dt);
}

function findBookingRowForApp(app = {}, bookings = []) {
  const appId = clean(app?.id);
  const appNameKey = normalizeNameKey(applicantName(app));
  const appEmail = normalize(app?.email || app?.applicant_email || '');

  return (bookings || []).find((b) => {
    if (clean(b?.source_application_id) && clean(b?.source_application_id) === appId) return true;
    const bNameKey = normalizeNameKey(b?.applicant_name || '');
    const bEmail = normalize(b?.applicant_email || '');
    return (appNameKey && bNameKey && appNameKey === bNameKey) || (appEmail && bEmail && appEmail === bEmail);
  }) || null;
}

function centralHourNow() {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Chicago' }).format(new Date()));
  return Number.isNaN(hour) ? 12 : hour;
}

function isQuietHoursNow() {
  const h = centralHourNow();
  return h >= 21 || h < 8;
}

function smtp() {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass || !from) return null;
  return {
    from,
    tx: nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      connectionTimeout: 7000,
      greetingTimeout: 7000,
      socketTimeout: 10000
    })
  };
}

async function sendMailSafe(tx, options = {}, timeoutMs = 10000) {
  try {
    const timer = new Promise((_, reject) => setTimeout(() => reject(new Error('mail_timeout')), timeoutMs));
    const sent = await Promise.race([tx.sendMail(options), timer]);
    return { ok: true, messageId: sent?.messageId || '' };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

function resolveContactIdForApp(app = {}, callerRows = []) {
  const appId = clean(app?.id);
  const appName = normalizeNameKey(applicantName(app));
  const appEmail = normalize(app?.email || app?.applicant_email || '');
  const appPhone = normalizePhone(app?.phone || app?.applicant_phone || '');

  for (const c of callerRows || []) {
    const cId = clean(c?.externalId || c?.contactId || c?.id || c?.contact_id || '');
    if (!cId) continue;

    const cExt = clean(c?.externalId || c?.id || c?.contactId || c?.contact_id || '');
    const cName = normalizeNameKey(c?.name || `${c?.firstName || ''} ${c?.lastName || ''}`);
    const cEmail = normalize(c?.email || '');
    const cPhone = normalizePhone(c?.phone || '');

    if (appId && cExt && appId === cExt) return cId;
    if (appEmail && cEmail && appEmail === cEmail) return cId;
    if (appPhone && cPhone && appPhone === cPhone) return cId;
    if (appName && cName && appName === cName) return cId;
  }

  return '';
}

async function postJsonWithTimeout(url, payload, timeoutMs = 8000, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store'
    });
    const text = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, text };
  } catch (error) {
    return { ok: false, status: 0, text: String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

async function sendGhlSms({ contactId = '', message = '', firstName = '', lastName = '', email = '', phone = '', bookingLink = '', appId = '' } = {}) {
  if (!message) return { ok: false, reason: 'missing_message' };

  const webhookUrl = clean(process.env.GHL_SMS_WEBHOOK_URL || 'https://services.leadconnectorhq.com/hooks/I7bXOorPHk415nKgsFfa/webhook-trigger/d59c6cb3-8d28-48b7-9cf8-f65998a2bd03');
  if (webhookUrl) {
    const webhookPayload = {
      event: 'approved_not_booked_sms',
      appId,
      contactId,
      firstName,
      lastName,
      email,
      phone,
      bookingLink,
      message
    };
    const out = await postJsonWithTimeout(webhookUrl, webhookPayload, 8000);
    if (out.ok) return { ok: true, mode: 'webhook', status: out.status };
    return { ok: false, reason: 'ghl_webhook_failed', detail: out.text?.slice(0, 220) };
  }

  return { ok: false, reason: 'missing_ghl_sms_config_or_payload' };
}

function brandFrame(title = '', bodyHtml = '') {
  const royalBlue = '#0047AB';
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;line-height:1.6;"><div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><div style="background:${royalBlue};padding:18px 18px;text-align:center;"><div style="color:#ffffff;font-weight:800;font-size:32px;letter-spacing:.8px;line-height:1;">THE LEGACY LINK</div></div><div style="padding:20px;"><h2 style="margin:0 0 12px;font-size:20px;color:#0f172a;">${title}</h2>${bodyHtml}<p style="margin:18px 0 0;color:#475569;">— The Legacy Link Support Team</p></div></div></div>`;
}

async function sendBrandedEmail({ to = '', subject = '', text = '', htmlBody = '' }) {
  const mailer = smtp();
  if (!mailer) return { ok: false, error: 'missing_gmail_env' };

  const html = brandFrame(subject, htmlBody || `<p style="white-space:pre-line;">${clean(text).replace(/\n/g, '<br/>')}</p>`);
  const out = await sendMailSafe(mailer.tx, { from: mailer.from, to, subject, text, html }, 10000);
  if (out.ok) return { ok: true, messageId: out.messageId };
  return { ok: false, error: out.error || 'send_failed' };
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (clean(body?.mode).toLowerCase() === 'test_sms') {
    const contactId = clean(body?.contactId || process.env.KIMORA_GHL_CONTACT_ID || '');
    const message = clean(body?.message || 'Test SMS from Legacy Planner approved-not-booked flow.');
    const out = await sendGhlSms({ contactId, message });
    return Response.json({ ok: Boolean(out?.ok), test: true, contactId, result: out });
  }

  const apps = await loadJsonStore(APPS_PATH, []);
  const bookings = await loadJsonStore(BOOKINGS_PATH, []);
  const policyRows = await loadJsonStore(POLICY_SUBMISSIONS_PATH, []);
  const callerRows = await loadJsonStore(CALLER_LEADS_PATH, []);
  const state = await loadJsonFile(REMINDER_STATE_PATH, { byId: {}, updatedAt: '' });

  const byId = { ...(state?.byId || {}) };
  const now = new Date();

  const maxPerRun = Number(body?.maxPerRun || process.env.ABN_MAX_PER_RUN || 20);
  const maxRuntimeMs = Number(body?.maxRuntimeMs || process.env.ABN_MAX_RUNTIME_MS || 15000);
  const includeErrorDetails = clean(body?.debug || '').toLowerCase() === '1' || clean(body?.debug || '').toLowerCase() === 'true';
  const leanMode = clean(body?.lean || '').toLowerCase() === '1' || clean(body?.lean || '').toLowerCase() === 'true';
  const startedAtMs = Date.now();
  let stoppedEarly = false;

  let attempted = 0;
  let applicantSent = 0;
  let agentSent = 0;
  let escalation48hSent = 0;
  let sms4mSent = 0;
  let uplineApprovedSent = 0;
  let uplineBookedSent = 0;
  let uplineOneHourSent = 0;
  let applicantBookedSent = 0;
  const errors = [];

  const quietHours = isQuietHoursNow();

  for (const app of apps) {
    if (attempted >= maxPerRun) break;
    if (Date.now() - startedAtMs >= maxRuntimeMs) {
      stoppedEarly = true;
      break;
    }
    if (!isApproved(app)) continue;

    const anchor = approvedAnchor(app);
    if (!anchor) continue;

    const ageMs = now.getTime() - anchor.getTime();

    const appId = clean(app?.id);
    if (!appId) continue;

    const record = byId[appId] || {};

    const firstName = clean(app?.firstName || app?.first_name || '');
    const lastName = clean(app?.lastName || app?.last_name || '');
    const fullName = applicantName(app) || clean(app?.name || `${firstName} ${lastName}`) || 'Applicant';
    const email = clean(app?.email || app?.applicant_email || '');
    const phone = clean(app?.phone || app?.applicant_phone || 'N/A');
    const stateCode = clean(app?.state || app?.applicant_state || 'N/A');
    const bookingLink = `https://innercirclelink.com/sponsorship-booking?id=${encodeURIComponent(appId)}`;
    const contactId = resolveContactIdForApp(app, callerRows);

    const uplineName = referredAgentName(app) || 'Agent';
    const uplineEmail = referredAgentEmail(app);
    const bookingExists = isBooked(app, bookings);
    const bookingRow = bookingExists ? findBookingRowForApp(app, bookings) : null;
    const agentTz = resolveAgentTimeZone(uplineName);
    const bookedEtRaw = clean(bookingRow?.requested_at_est || '');
    const bookedAtEt = parseRequestedAtEst(bookedEtRaw);
    const bookedAtEtLabel = bookedAtEt ? formatInTz(bookedAtEt, 'America/New_York') : bookedEtRaw;
    const bookedAtAgentLabel = bookedAtEt ? formatInTz(bookedAtEt, agentTz) : '';

    attempted += 1;

    // Upline notifications (all referrers)
    if (uplineEmail) {
      if (!record?.uplineApprovedSentAt && ageMs >= 0 && ageMs <= 24 * 60 * 60 * 1000) {
        const subject = `Sponsorship Approved: ${fullName}`;
        const text = [
          `Hi ${uplineName},`,
          '',
          `${fullName} in your downline was just approved for sponsorship.`,
          '',
          `Full Name: ${fullName}`,
          `Email: ${email || 'N/A'}`,
          `Phone: ${phone}`,
          `State: ${stateCode}`,
          `Approved At (ET): ${formatInTz(anchor, 'America/New_York') || anchor.toLocaleString('en-US')}`,
          `Booking Link: ${bookingLink}`,
          '',
          'Please support them in getting scheduled quickly.',
          '',
          'The Legacy Link Support Team'
        ].join('\n');

        const htmlBody = `
          <p>Hi <strong>${uplineName}</strong>,</p>
          <p><strong>${fullName}</strong> in your downline was just approved for sponsorship.</p>
          <ul>
            <li><strong>Full Name:</strong> ${fullName}</li>
            <li><strong>Email:</strong> ${email || 'N/A'}</li>
            <li><strong>Phone:</strong> ${phone}</li>
            <li><strong>State:</strong> ${stateCode}</li>
            <li><strong>Approved At (ET):</strong> ${formatInTz(anchor, 'America/New_York') || anchor.toLocaleString('en-US')}</li>
            <li><strong>Booking Link:</strong> <a href="${bookingLink}">${bookingLink}</a></li>
          </ul>
          <p>Please support them in getting scheduled quickly.</p>
        `;

        const out = await sendBrandedEmail({ to: uplineEmail, subject, text, htmlBody });
        if (out.ok) {
          uplineApprovedSent += 1;
          record.uplineApprovedSentAt = nowIso();
        } else {
          errors.push({ appId, type: 'upline_approved', error: out.error });
        }
      }

      if (bookingExists && !record?.uplineBookedSentAt && ageMs <= 48 * 60 * 60 * 1000) {
        const subject = `Booked: ${fullName} is now scheduled`;
        const text = [
          `Hi ${uplineName},`,
          '',
          `${fullName} (approved sponsorship) is now booked.`,
          '',
          `Full Name: ${fullName}`,
          `Email: ${email || 'N/A'}`,
          `Phone: ${phone}`,
          `State: ${stateCode}`,
          `Booked Time (ET): ${bookedAtEtLabel || 'N/A'}`,
          `Booked Time (${agentTz}): ${bookedAtAgentLabel || bookedAtEtLabel || 'N/A'}`,
          '',
          'Great momentum — keep the follow-through tight.',
          '',
          'The Legacy Link Support Team'
        ].join('\n');

        const htmlBody = `
          <p>Hi <strong>${uplineName}</strong>,</p>
          <p><strong>${fullName}</strong> (approved sponsorship) is now booked.</p>
          <ul>
            <li><strong>Full Name:</strong> ${fullName}</li>
            <li><strong>Email:</strong> ${email || 'N/A'}</li>
            <li><strong>Phone:</strong> ${phone}</li>
            <li><strong>State:</strong> ${stateCode}</li>
            <li><strong>Booked Time (ET):</strong> ${bookedAtEtLabel || 'N/A'}</li>
            <li><strong>Booked Time (${agentTz}):</strong> ${bookedAtAgentLabel || bookedAtEtLabel || 'N/A'}</li>
          </ul>
          <p>Great momentum — keep the follow-through tight.</p>
        `;

        const out = await sendBrandedEmail({ to: uplineEmail, subject, text, htmlBody });
        if (out.ok) {
          uplineBookedSent += 1;
          record.uplineBookedSentAt = nowIso();
        } else {
          errors.push({ appId, type: 'upline_booked', error: out.error });
        }
      }

      if (!bookingExists && ageMs >= 60 * 60 * 1000 && !record?.uplineOneHourNotBookedSentAt) {
        const subject = `Action Needed (1-Hour): ${fullName} approved but not booked`;
        const text = [
          `Hi ${uplineName},`,
          '',
          `${fullName} was approved over an hour ago and still has not booked.`,
          '',
          `Full Name: ${fullName}`,
          `Email: ${email || 'N/A'}`,
          `Phone: ${phone}`,
          `State: ${stateCode}`,
          `Booking Link: ${bookingLink}`,
          '',
          'Please reach out immediately and get them on a schedule.',
          '',
          'The Legacy Link Support Team'
        ].join('\n');

        const htmlBody = `
          <p>Hi <strong>${uplineName}</strong>,</p>
          <p><strong>${fullName}</strong> was approved over an hour ago and still has not booked.</p>
          <ul>
            <li><strong>Full Name:</strong> ${fullName}</li>
            <li><strong>Email:</strong> ${email || 'N/A'}</li>
            <li><strong>Phone:</strong> ${phone}</li>
            <li><strong>State:</strong> ${stateCode}</li>
            <li><strong>Booking Link:</strong> <a href="${bookingLink}">${bookingLink}</a></li>
          </ul>
          <p>Please reach out immediately and get them on a schedule.</p>
        `;

        const out = await sendBrandedEmail({ to: uplineEmail, subject, text, htmlBody });
        if (out.ok) {
          uplineOneHourSent += 1;
          record.uplineOneHourNotBookedSentAt = nowIso();
        } else {
          errors.push({ appId, type: 'upline_one_hour_not_booked', error: out.error });
        }
      }
    }

    // If already booked, send applicant confirmation once, then skip not-booked reminder logic below.
    if (bookingExists) {
      if (email && !record?.applicantBookedSentAt) {
        const applicantSubject = 'You’re Booked — Sponsorship Onboarding Confirmed';
        const applicantText = [
          `Hi ${clean(app?.firstName || 'there')},`,
          '',
          'Great news — your sponsorship onboarding appointment is confirmed.',
          '',
          `Booked Time (ET): ${bookedAtEtLabel || 'Scheduled'}`,
          `${bookedAtAgentLabel ? `Booked Time (${agentTz}): ${bookedAtAgentLabel}` : ''}`,
          '',
          'If you need to update your appointment, please reply to this email.',
          '',
          'The Legacy Link Support Team'
        ].filter(Boolean).join('\n');

        const applicantHtmlBody = `
          <p>Hi <strong>${clean(app?.firstName || 'there')}</strong>,</p>
          <p>Great news — your sponsorship onboarding appointment is confirmed.</p>
          <ul>
            <li><strong>Booked Time (ET):</strong> ${bookedAtEtLabel || 'Scheduled'}</li>
            ${bookedAtAgentLabel ? `<li><strong>Booked Time (${agentTz}):</strong> ${bookedAtAgentLabel}</li>` : ''}
          </ul>
          <p>If you need to update your appointment, please reply to this email.</p>
        `;

        const out = await sendBrandedEmail({ to: email, subject: applicantSubject, text: applicantText, htmlBody: applicantHtmlBody });
        if (out.ok) {
          applicantBookedSent += 1;
          record.applicantBookedSentAt = nowIso();
        } else {
          errors.push({ appId, type: 'applicant_booked_confirmation', error: out.error });
        }
      }

      record.lastTouchedAt = nowIso();
      byId[appId] = record;
      continue;
    }

    if (hasSubmittedPolicy(app, policyRows)) {
      record.lastTouchedAt = nowIso();
      byId[appId] = record;
      continue;
    }

    // Single SMS reminder: 4 minutes after approval if still not booked.
    const hasLegacySms = Boolean(record?.sms10mSentAt || record?.sms30mSentAt || record?.sms24hSentAt);
    if (contactId && ageMs >= 4 * 60 * 1000 && ageMs < 24 * 60 * 60 * 1000 && !record?.sms4mSentAt && !hasLegacySms) {
      const sms = [
        `Hi ${clean(app?.firstName || '') || 'there'},`,
        '',
        'Congratulations — your sponsorship application has been approved.',
        '',
        'Your next step is to book your first onboarding meeting:',
        bookingLink,
        '',
        'Reply CONFIRM once booked.',
        '',
        '— The Legacy Link Support Team'
      ].join('\n');

      const out = await sendGhlSms({
        contactId,
        message: sms,
        appId,
        firstName: clean(app?.firstName || ''),
        lastName: clean(app?.lastName || ''),
        email,
        phone,
        bookingLink
      });
      if (out.ok) {
        sms4mSent += 1;
        record.sms4mSentAt = nowIso();
      } else {
        errors.push({ appId, type: 'sms4m', error: out?.detail || out?.reason || 'send_failed' });
      }
    }

    if (ageMs < 24 * 60 * 60 * 1000) {
      if (record.sms4mSentAt || hasLegacySms) {
        record.lastTouchedAt = nowIso();
        byId[appId] = record;
      }
      continue;
    }

    if (record?.followup24hSentAt && record?.agent24hSentAt && record?.escalation48hSentAt) {
      if (record.sms4mSentAt || record.sms10mSentAt || record.sms30mSentAt || record.sms24hSentAt) {
        byId[appId] = record;
      }
      continue;
    }

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

    // Legacy 24h/48h upline reminders replaced by 1-hour upline escalation logic above.

    if (
      record.followup24hSentAt
      || record.uplineApprovedSentAt
      || record.uplineBookedSentAt
      || record.uplineOneHourNotBookedSentAt
      || record.agent24hSentAt
      || record.escalation48hSentAt
      || record.sms4mSentAt
      || record.sms10mSentAt
      || record.sms30mSentAt
      || record.sms24hSentAt
    ) {
      record.lastTouchedAt = nowIso();
      byId[appId] = record;
    }
  }

  await saveJsonFile(REMINDER_STATE_PATH, { byId, updatedAt: nowIso() });

  const errorsByType = errors.reduce((acc, e) => {
    const k = clean(e?.type || 'unknown');
    acc[k] = Number(acc[k] || 0) + 1;
    return acc;
  }, {});

  const response = {
    ok: true,
    attempted,
    maxPerRun,
    maxRuntimeMs,
    stoppedEarly,
    applicantSent,
    applicantBookedSent,
    agentSent,
    escalation48hSent,
    uplineApprovedSent,
    uplineBookedSent,
    uplineOneHourSent,
    quietHours,
    sms4mSent,
    errorsCount: errors.length,
    errorsByType,
    durationMs: Date.now() - startedAtMs
  };

  if (!leanMode || includeErrorDetails) {
    response.errors = includeErrorDetails ? errors : errors.slice(0, 10);
  }

  return Response.json(response);
}

export async function GET() {
  const state = await loadJsonFile(REMINDER_STATE_PATH, { byId: {}, updatedAt: '' });
  const keys = Object.keys(state?.byId || {});
  return Response.json({ ok: true, tracked: keys.length, updatedAt: state?.updatedAt || '' });
}
