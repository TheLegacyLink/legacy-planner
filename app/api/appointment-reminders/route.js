import nodemailer from 'nodemailer';
import { loadJsonFile, saveJsonFile, loadJsonStore } from '../../../lib/blobJsonStore';

const BOOKINGS_PATH = 'stores/sponsorship-bookings.json';
const REPLIES_PATH = 'stores/ghl-sms-replies.json';
const STATE_PATH = 'stores/appointment-reminders-state.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase(); }
function nowIso() { return new Date().toISOString(); }

function authorized(req) {
  const required = clean(process.env.APPOINTMENT_REMINDER_TOKEN || '');
  if (!required) return true;
  const bearer = clean(req.headers.get('authorization')).replace(/^Bearer\s+/i, '');
  const header = clean(req.headers.get('x-admin-token') || req.headers.get('x-intake-token'));
  const token = bearer || header;
  return token === required;
}

function parseRequestedAtEst(raw = '') {
  const m = clean(raw).match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  let hour12 = Number(m[4]);
  const minute = Number(m[5]);
  const ampm = String(m[6] || '').toUpperCase();
  if (ampm === 'PM' && hour12 !== 12) hour12 += 12;
  if (ampm === 'AM' && hour12 === 12) hour12 = 0;

  // Existing app convention stores this as ET wall clock.
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-04:00`;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function toEtCtLabel(dateValue) {
  const dt = dateValue instanceof Date ? dateValue : new Date(dateValue || 0);
  if (Number.isNaN(dt.getTime())) return '';
  const et = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York'
  }).format(dt);
  const ct = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago'
  }).format(dt);
  return `${et} ET (${ct} CT)`;
}

function normalizeUsPhone(v = '') {
  const d = clean(v).replace(/\D+/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return '';
}

function firstName(name = '') {
  return clean(name).split(/\s+/).filter(Boolean)[0] || 'there';
}

function smtp() {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass || !from) return null;
  return { from, tx: nodemailer.createTransport({ service: 'gmail', auth: { user, pass } }) };
}

async function sendEmail({ to = '', subject = '', text = '' } = {}) {
  const mailer = smtp();
  if (!mailer || !to || !subject || !text) return { ok: false, reason: 'missing_mailer_or_fields' };
  try {
    const info = await mailer.tx.sendMail({ from: mailer.from, to, subject, text });
    return { ok: true, messageId: info?.messageId || '' };
  } catch (error) {
    return { ok: false, reason: clean(error?.message || 'send_failed') };
  }
}

async function postJson(url, payload, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store'
    });
    const text = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, text };
  } catch (error) {
    return { ok: false, status: 0, text: clean(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

async function sendSms({ phone = '', message = '', first = '', email = '', appId = '' } = {}) {
  const webhookRaw = clean(process.env.GHL_MANUAL_SMS_WEBHOOK_URL || '');
  const webhook = webhookRaw.replace(/\\n/g, '').replace(/\n/g, '');
  if (!webhook || !phone || !message) return { ok: false, reason: 'missing_sms_config_or_fields' };
  const payload = {
    event: 'manual_sms_send',
    mode: 'exact_message',
    appId,
    firstName: first,
    email,
    phone,
    message,
    smsBody: message,
    text: message,
    addReplyTrackingTag: true,
    replyTrackingTag: 'appointment-reminder',
    tags: ['appointment-reminder']
  };
  const out = await postJson(webhook, payload, 10000);
  return out.ok ? { ok: true } : { ok: false, reason: clean(out.text).slice(0, 220) || `status_${out.status}` };
}

function isActive(status = '') {
  return normalize(status) !== 'canceled';
}

function matchesReply(booking = {}, reply = {}) {
  const bName = normalize(booking?.applicant_name || '');
  const bEmail = normalize(booking?.applicant_email || '');
  const bPhone = clean(booking?.applicant_phone || '').replace(/\D/g, '');

  const rName = normalize(`${reply?.contactName || ''} ${reply?.firstName || ''} ${reply?.lastName || ''}`);
  const rEmail = normalize(reply?.email || '');
  const rPhone = clean(reply?.phone || '').replace(/\D/g, '');

  const nameHit = bName && rName && (rName.includes(bName) || bName.includes(rName));
  const emailHit = bEmail && rEmail && bEmail === rEmail;
  const phoneHit = bPhone && rPhone && (rPhone.endsWith(bPhone) || bPhone.endsWith(rPhone));

  return nameHit || emailHit || phoneHit;
}

function hasConfirmReply(booking = {}, replies = []) {
  return (replies || []).some((r) => {
    if (!matchesReply(booking, r)) return false;
    return /\bconfirm(ed)?\b/i.test(String(r?.message || r?.body || ''));
  });
}

function reminderText(kind = '24h', booking = {}, whenLabel = '') {
  const first = firstName(booking?.applicant_name || '');
  const zoom = clean(process.env.INNER_CIRCLE_ZOOM_LINK || process.env.NEXT_PUBLIC_INNER_CIRCLE_ZOOM_LINK || 'https://us06web.zoom.us/j/9574933592?pwd=KiWiYeUNEXTbCIhGvIGGd5M9JKAWkY.1');

  if (kind === '24h') {
    return {
      sms: [
        `Hi ${first} — reminder: your appointment is tomorrow.`,
        `${whenLabel}`,
        `Zoom: ${zoom}`,
        'Please reply CONFIRM to lock your spot.'
      ].join('\n'),
      emailSubject: 'Reminder: Your Appointment Is Tomorrow',
      emailText: [
        `Hi ${first},`,
        '',
        'Quick reminder: your appointment is tomorrow.',
        '',
        `Time: ${whenLabel}`,
        `Zoom: ${zoom}`,
        '',
        'Please reply CONFIRM to lock your spot.',
        '',
        '— The Legacy Link Team'
      ].join('\n')
    };
  }

  if (kind === '2h') {
    return {
      sms: [
        `Hi ${first} — your appointment starts in about 2 hours.`,
        `${whenLabel}`,
        'Reply CONFIRM now so we know you are ready.'
      ].join('\n'),
      emailSubject: '2-Hour Reminder: Please Confirm Attendance',
      emailText: [
        `Hi ${first},`,
        '',
        'Your appointment starts in about 2 hours.',
        '',
        `Time: ${whenLabel}`,
        'Please reply CONFIRM now so we can hold your slot.',
        '',
        '— The Legacy Link Team'
      ].join('\n')
    };
  }

  if (kind === '15m') {
    return {
      sms: [
        `Hi ${first} — your appointment starts in 15 minutes.`,
        `${whenLabel}`,
        'Join now and be ready. Reply CONFIRM.'
      ].join('\n'),
      emailSubject: '15-Minute Reminder: Join Your Appointment',
      emailText: [
        `Hi ${first},`,
        '',
        'Your appointment starts in 15 minutes.',
        '',
        `${whenLabel}`,
        'Please join now and reply CONFIRM.',
        '',
        '— The Legacy Link Team'
      ].join('\n')
    };
  }

  return {
    sms: '',
    emailSubject: '',
    emailText: ''
  };
}

async function maybeCreateCallTask(booking = {}) {
  const webhook = clean(process.env.GHL_APPOINTMENT_CALL_TASK_WEBHOOK_URL || '');
  if (!webhook) return { ok: false, skipped: true, reason: 'missing_call_task_webhook' };
  const payload = {
    event: 'appointment_unconfirmed_2h',
    bookingId: clean(booking?.id || ''),
    applicantName: clean(booking?.applicant_name || ''),
    applicantEmail: clean(booking?.applicant_email || ''),
    applicantPhone: normalizeUsPhone(booking?.applicant_phone || ''),
    requestedAtEst: clean(booking?.requested_at_est || ''),
    note: 'No CONFIRM reply within 2-hour window. Please call now.'
  };
  const out = await postJson(webhook, payload, 10000);
  return out.ok ? { ok: true } : { ok: false, reason: clean(out.text).slice(0, 220) || `status_${out.status}` };
}

async function sendKind(kind = '24h', booking = {}, whenLabel = '') {
  const first = firstName(booking?.applicant_name || '');
  const email = clean(booking?.applicant_email || '');
  const phone = normalizeUsPhone(booking?.applicant_phone || '');
  const payload = reminderText(kind, booking, whenLabel);

  const [smsOut, emailOut] = await Promise.all([
    phone ? sendSms({ phone, message: payload.sms, first, email, appId: clean(booking?.source_application_id || '') }) : Promise.resolve({ ok: false, skipped: true, reason: 'missing_phone' }),
    email ? sendEmail({ to: email, subject: payload.emailSubject, text: payload.emailText }) : Promise.resolve({ ok: false, skipped: true, reason: 'missing_email' })
  ]);

  return {
    ok: Boolean(smsOut?.ok || emailOut?.ok),
    sms: smsOut,
    email: emailOut
  };
}

export async function POST(req) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dryRun = Boolean(body?.dryRun);
  const mode = normalize(body?.mode || 'scheduled');

  if (mode === 'single_send') {
    const bookings = await loadJsonStore(BOOKINGS_PATH, []);
    const bookingId = clean(body?.bookingId || body?.id || '');
    const bookingName = normalize(body?.applicantName || body?.name || '');

    const target = (bookings || []).find((b) => {
      if (bookingId && clean(b?.id) === bookingId) return true;
      if (bookingName) return normalize(b?.applicant_name || '') === bookingName;
      return false;
    });

    if (!target) return Response.json({ ok: false, error: 'booking_not_found' }, { status: 404 });

    const when = parseRequestedAtEst(target?.requested_at_est || '');
    const whenLabel = when ? toEtCtLabel(when) : clean(target?.requested_at_est || '');
    const kind = normalize(body?.kind || 'custom');

    let smsMessage = clean(body?.sms || body?.message || '');
    let emailSubject = clean(body?.emailSubject || body?.subject || 'Appointment Confirmation');
    let emailText = clean(body?.emailText || body?.email || '');

    if (!smsMessage || !emailText) {
      const payload = kind === '24h' || kind === '2h' || kind === '15m'
        ? reminderText(kind, target, whenLabel)
        : {
            sms: [
              `Hi ${firstName(target?.applicant_name || '')} — your Legacy Link appointment is confirmed.`,
              `${whenLabel}`,
              'Reply CONFIRM to confirm your attendance.'
            ].join('\n'),
            emailSubject: 'Appointment Confirmation — Legacy Link',
            emailText: [
              `Hi ${firstName(target?.applicant_name || '')},`,
              '',
              'Your Legacy Link appointment is confirmed.',
              '',
              `Time: ${whenLabel}`,
              '',
              'Reply CONFIRM to confirm your attendance.',
              '',
              '— The Legacy Link Team'
            ].join('\n')
          };

      if (!smsMessage) smsMessage = clean(payload.sms || '');
      if (!emailText) emailText = clean(payload.emailText || '');
      if (!emailSubject) emailSubject = clean(payload.emailSubject || 'Appointment Confirmation');
    }

    const phone = normalizeUsPhone(target?.applicant_phone || '');
    const email = clean(target?.applicant_email || '');
    const appId = clean(target?.source_application_id || '');

    if (dryRun) {
      return Response.json({
        ok: true,
        dryRun: true,
        target: { id: clean(target?.id), applicant: clean(target?.applicant_name), phone, email, whenLabel },
        payload: { smsMessage, emailSubject, emailText }
      });
    }

    const [smsOut, emailOut] = await Promise.all([
      phone ? sendSms({ phone, message: smsMessage, first: firstName(target?.applicant_name || ''), email, appId }) : Promise.resolve({ ok: false, skipped: true, reason: 'missing_phone' }),
      email ? sendEmail({ to: email, subject: emailSubject, text: emailText }) : Promise.resolve({ ok: false, skipped: true, reason: 'missing_email' })
    ]);

    return Response.json({
      ok: Boolean(smsOut?.ok || emailOut?.ok),
      mode: 'single_send',
      target: { id: clean(target?.id), applicant: clean(target?.applicant_name), phone, email, whenLabel },
      sms: smsOut,
      email: emailOut
    });
  }

  const [bookings, replies, stateRaw] = await Promise.all([
    loadJsonStore(BOOKINGS_PATH, []),
    loadJsonStore(REPLIES_PATH, []),
    loadJsonFile(STATE_PATH, { byBookingId: {}, updatedAt: '' })
  ]);

  const byBookingId = { ...(stateRaw?.byBookingId || {}) };
  const now = new Date();

  let reminders24h = 0;
  let reminders2h = 0;
  let reminders15m = 0;
  let urgentFollowups = 0;
  let taskCreates = 0;
  let confirms = 0;
  const errors = [];

  for (const b of (bookings || [])) {
    if (!isActive(b?.booking_status || 'booked')) continue;

    const when = parseRequestedAtEst(b?.requested_at_est || '');
    if (!when) continue;

    const msTo = when.getTime() - now.getTime();
    if (msTo < -2 * 60 * 60 * 1000) continue; // ignore old bookings
    if (msTo > 48 * 60 * 60 * 1000) continue;

    const id = clean(b?.id || '');
    if (!id) continue;

    const rec = byBookingId[id] || {};
    const whenLabel = toEtCtLabel(when);

    const confirmed = hasConfirmReply(b, replies);
    if (confirmed && !rec.confirmedAt) {
      rec.confirmedAt = nowIso();
      confirms += 1;
    }

    const in24hWindow = msTo <= 24 * 60 * 60 * 1000 && msTo > (24 * 60 * 60 * 1000 - 75 * 60 * 1000);
    const in2hWindow = msTo <= 2 * 60 * 60 * 1000 && msTo > (2 * 60 * 60 * 1000 - 45 * 60 * 1000);
    const in15mWindow = msTo <= 15 * 60 * 1000 && msTo > -10 * 60 * 1000;

    if (in24hWindow && !rec.r24hSentAt) {
      if (!dryRun) {
        const out = await sendKind('24h', b, whenLabel);
        if (!out.ok) errors.push({ id, kind: '24h', error: out?.sms?.reason || out?.email?.reason || 'send_failed' });
      }
      rec.r24hSentAt = nowIso();
      reminders24h += 1;
    }

    if (in2hWindow && !rec.r2hSentAt) {
      if (!dryRun) {
        const out = await sendKind('2h', b, whenLabel);
        if (!out.ok) errors.push({ id, kind: '2h', error: out?.sms?.reason || out?.email?.reason || 'send_failed' });
      }
      rec.r2hSentAt = nowIso();
      reminders2h += 1;
    }

    if (in15mWindow && !rec.r15mSentAt) {
      if (!dryRun) {
        const out = await sendKind('15m', b, whenLabel);
        if (!out.ok) errors.push({ id, kind: '15m', error: out?.sms?.reason || out?.email?.reason || 'send_failed' });
      }
      rec.r15mSentAt = nowIso();
      reminders15m += 1;
    }

    // If inside 2h and still not confirmed, send one urgent follow-up + optional call task.
    if (msTo <= 2 * 60 * 60 * 1000 && msTo > 20 * 60 * 1000 && !confirmed && !rec.urgent2hSentAt) {
      if (!dryRun) {
        const urgentMsg = [
          `Hi ${firstName(b?.applicant_name || '')}, we still need your CONFIRM for your upcoming appointment.`,
          `${whenLabel}`,
          'Reply CONFIRM now to keep your spot.'
        ].join('\n');

        const phone = normalizeUsPhone(b?.applicant_phone || '');
        const email = clean(b?.applicant_email || '');
        const [smsOut, emailOut, taskOut] = await Promise.all([
          phone ? sendSms({ phone, message: urgentMsg, first: firstName(b?.applicant_name || ''), email, appId: clean(b?.source_application_id || '') }) : Promise.resolve({ ok: false, skipped: true }),
          email ? sendEmail({ to: email, subject: 'Action Needed: Confirm Your Appointment', text: urgentMsg }) : Promise.resolve({ ok: false, skipped: true }),
          maybeCreateCallTask(b)
        ]);

        if (!smsOut?.ok && !emailOut?.ok) {
          errors.push({ id, kind: 'urgent_2h', error: smsOut?.reason || emailOut?.reason || 'send_failed' });
        }
        if (taskOut?.ok) taskCreates += 1;
      }
      rec.urgent2hSentAt = nowIso();
      urgentFollowups += 1;
    }

    rec.lastSeenAt = nowIso();
    byBookingId[id] = rec;
  }

  await saveJsonFile(STATE_PATH, { byBookingId, updatedAt: nowIso() });

  return Response.json({
    ok: true,
    dryRun,
    reminders24h,
    reminders2h,
    reminders15m,
    urgentFollowups,
    taskCreates,
    confirmsUpdated: confirms,
    tracked: Object.keys(byBookingId).length,
    errorsCount: errors.length,
    errors: errors.slice(0, 20)
  });
}

export async function GET(req) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const state = await loadJsonFile(STATE_PATH, { byBookingId: {}, updatedAt: '' });
  const count = Object.keys(state?.byBookingId || {}).length;
  return Response.json({ ok: true, tracked: count, updatedAt: state?.updatedAt || '' });
}
