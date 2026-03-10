import nodemailer from 'nodemailer';
import users from '../../../data/innerCircleUsers.json';
import { loadJsonFile, saveJsonFile, loadJsonStore } from '../../../lib/blobJsonStore';

const APPS_PATH = 'stores/sponsorship-applications.json';
const BOOKINGS_PATH = 'stores/sponsorship-bookings.json';
const POLICY_SUBMISSIONS_PATH = 'stores/policy-submissions.json';
const CALLER_LEADS_PATH = 'stores/caller-leads.json';
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
    if (!['submitted', 'approved', 'declined', 'paid', 'pending'].some((k) => pStatus.includes(k))) return false;

    const pNameKey = normalizeNameKey(p?.applicantName || '');
    const pEmail = normalize(p?.applicantEmail || '');
    const pPhone = clean(p?.applicantPhone || '').replace(/\D/g, '');

    return (appNameKey && pNameKey && appNameKey === pNameKey)
      || (appEmail && pEmail && appEmail === pEmail)
      || (appPhone && pPhone && appPhone === pPhone);
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

function emailByName(name = '') {
  if (!name) return '';
  const hit = (users || []).find((u) => normalize(u?.name) === normalize(name));
  return clean(hit?.email);
}

function referredAgentEmail(app = {}) {
  return emailByName(referredAgentName(app));
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

async function sendGhlSms({ contactId = '', message = '' } = {}) {
  const token = clean(process.env.GHL_API_TOKEN || '');
  if (!token || !contactId || !message) return { ok: false, reason: 'missing_ghl_sms_config_or_payload' };

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28'
  };

  const bases = [
    clean(process.env.GHL_API_BASE_URL || ''),
    'https://services.leadconnectorhq.com',
    'https://rest.gohighlevel.com'
  ].filter(Boolean);

  const paths = ['/conversations/messages', '/v1/conversations/messages'];
  const payloads = [
    { type: 'SMS', contactId, message },
    { contactId, message, type: 'SMS', direction: 'outbound' },
    { contactId, message }
  ];

  let lastError = 'unknown';

  for (const base of bases) {
    for (const path of paths) {
      const url = `${base.replace(/\/$/, '')}${path}`;
      for (const bodyObj of payloads) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(bodyObj),
            cache: 'no-store'
          });
          if (res.ok) return { ok: true, url, status: res.status };
          const text = await res.text().catch(() => '');
          lastError = `${url} -> ${res.status} ${text.slice(0, 220)}`;
        } catch (error) {
          lastError = `${url} -> ${String(error?.message || error)}`;
        }
      }
    }
  }

  return { ok: false, reason: 'ghl_sms_failed', detail: lastError };
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

  let attempted = 0;
  let applicantSent = 0;
  let agentSent = 0;
  let escalation48hSent = 0;
  let sms10mSent = 0;
  let sms30mSent = 0;
  let sms24hSent = 0;
  const errors = [];

  for (const app of apps) {
    if (!isApproved(app)) continue;
    if (isBooked(app, bookings)) continue;
    if (hasSubmittedPolicy(app, policyRows)) continue;

    const anchor = approvedAnchor(app);
    if (!anchor) continue;

    const ageMs = now.getTime() - anchor.getTime();

    const appId = clean(app?.id);
    if (!appId) continue;

    const record = byId[appId] || {};

    const fullName = applicantName(app) || 'Applicant';
    const email = clean(app?.email || app?.applicant_email || '');
    const phone = clean(app?.phone || app?.applicant_phone || 'N/A');
    const bookingLink = `https://innercirclelink.com/sponsorship-booking?id=${encodeURIComponent(appId)}`;
    const contactId = resolveContactIdForApp(app, callerRows);

    attempted += 1;

    // SMS sequence (10m, 30m, 24h) — stops automatically once booked/submitted due to early loop guards.
    if (contactId && ageMs >= 10 * 60 * 1000 && !record?.sms10mSentAt) {
      const sms1 = `Hi ${clean(app?.firstName || '') || 'there'}, your sponsorship application is approved. Please book now so we can keep it moving: ${bookingLink}. If you already booked, disregard.`;
      const out = await sendGhlSms({ contactId, message: sms1 });
      if (out.ok) {
        sms10mSent += 1;
        record.sms10mSentAt = nowIso();
      } else {
        errors.push({ appId, type: 'sms10m', error: out?.detail || out?.reason || 'send_failed' });
      }
    }

    if (contactId && ageMs >= 30 * 60 * 1000 && !record?.sms30mSentAt) {
      const sms2 = `Quick reminder: we still do not see your sponsorship appointment booked. Lock your time here: ${bookingLink}. If you already booked, disregard.`;
      const out = await sendGhlSms({ contactId, message: sms2 });
      if (out.ok) {
        sms30mSent += 1;
        record.sms30mSentAt = nowIso();
      } else {
        errors.push({ appId, type: 'sms30m', error: out?.detail || out?.reason || 'send_failed' });
      }
    }

    if (contactId && ageMs >= 24 * 60 * 60 * 1000 && !record?.sms24hSentAt) {
      const sms3 = `Final reminder: your sponsorship application is approved but still not booked. Book here now: ${bookingLink}. Need help? Reply HELP. If you already booked, disregard.`;
      const out = await sendGhlSms({ contactId, message: sms3 });
      if (out.ok) {
        sms24hSent += 1;
        record.sms24hSentAt = nowIso();
      } else {
        errors.push({ appId, type: 'sms24h', error: out?.detail || out?.reason || 'send_failed' });
      }
    }

    if (ageMs < 24 * 60 * 60 * 1000) {
      if (record.sms10mSentAt || record.sms30mSentAt || record.sms24hSentAt) {
        record.lastTouchedAt = nowIso();
        byId[appId] = record;
      }
      continue;
    }

    if (record?.followup24hSentAt && record?.agent24hSentAt && record?.escalation48hSentAt) {
      if (record.sms10mSentAt || record.sms30mSentAt || record.sms24hSentAt) {
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

    if (ageMs >= 48 * 60 * 60 * 1000 && !record?.escalation48hSentAt) {
      const kimoraEmail = emailByName('Kimora Link');
      const jamalEmail = emailByName('Jamal Holmes');
      const recipients = [...new Set([kimoraEmail, jamalEmail].filter(Boolean))];

      if (recipients.length) {
        const escalationSubject = `48-Hour Escalation: ${fullName} still not booked`;
        const escalationText = [
          'This is a 48-hour escalation for an approved sponsorship applicant who is still not booked.',
          '',
          `Applicant Name: ${fullName}`,
          `Applicant Email: ${email || 'N/A'}`,
          `Applicant Phone: ${phone}`,
          `Referred By: ${referredAgentName(app) || 'N/A'}`,
          `Booking Link: ${bookingLink}`,
          '',
          'Please coordinate immediately and get this applicant scheduled.'
        ].join('\n');

        const escalationHtmlBody = `
          <p>This is a <strong>48-hour escalation</strong> for an approved sponsorship applicant who is still not booked.</p>
          <ul>
            <li><strong>Applicant Name:</strong> ${fullName}</li>
            <li><strong>Applicant Email:</strong> ${email || 'N/A'}</li>
            <li><strong>Applicant Phone:</strong> ${phone}</li>
            <li><strong>Referred By:</strong> ${referredAgentName(app) || 'N/A'}</li>
            <li><strong>Booking Link:</strong> <a href="${bookingLink}">${bookingLink}</a></li>
          </ul>
          <p>Please coordinate immediately and get this applicant scheduled.</p>
        `;

        const out = await sendBrandedEmail({
          to: recipients.join(', '),
          subject: escalationSubject,
          text: escalationText,
          htmlBody: escalationHtmlBody
        });

        if (out.ok) {
          escalation48hSent += 1;
          record.escalation48hSentAt = nowIso();
        } else {
          errors.push({ appId, type: 'escalation48h', error: out.error });
        }
      }
    }

    if (record.followup24hSentAt || record.agent24hSentAt || record.escalation48hSentAt || record.sms10mSentAt || record.sms30mSentAt || record.sms24hSentAt) {
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
    escalation48hSent,
    sms10mSent,
    sms30mSent,
    sms24hSent,
    errorsCount: errors.length,
    errors
  });
}

export async function GET() {
  const state = await loadJsonFile(REMINDER_STATE_PATH, { byId: {}, updatedAt: '' });
  const keys = Object.keys(state?.byId || {});
  return Response.json({ ok: true, tracked: keys.length, updatedAt: state?.updatedAt || '' });
}
