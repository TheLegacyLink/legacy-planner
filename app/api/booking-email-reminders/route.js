import nodemailer from 'nodemailer';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import users from '../../../data/innerCircleUsers.json';

const STORE_PATH = 'stores/sponsorship-bookings.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function parseRequestedEst(value = '') {
  // Expected: YYYY-MM-DD h:mm AM/PM
  const m = clean(value).match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  const [, d, hhRaw, mm, ampmRaw] = m;
  let hh = Number(hhRaw);
  const ampm = ampmRaw.toUpperCase();
  if (ampm === 'PM' && hh !== 12) hh += 12;
  if (ampm === 'AM' && hh === 12) hh = 0;

  // Use EST offset (-05:00) as canonical booking timezone label currently used in UI.
  return new Date(`${d}T${String(hh).padStart(2, '0')}:${mm}:00-05:00`);
}

function toEtYmd(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(date);
}

function nowIso() {
  return new Date().toISOString();
}

function findUserEmailByName(name = '') {
  const n = normalize(name);
  const hit = (users || []).find((u) => normalize(u.name) === n);
  return clean(hit?.email);
}

function adminEmails() {
  const list = (users || [])
    .filter((u) => clean(u.role).toLowerCase() === 'admin' && clean(u.email))
    .map((u) => clean(u.email));
  return [...new Set(list)];
}

function transporterFromEnv() {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass || !from) return null;

  return {
    from,
    tx: nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    })
  };
}

async function sendMail(to, subject, text) {
  const smtp = transporterFromEnv();
  if (!smtp) return { ok: false, error: 'missing_gmail_env' };
  try {
    const info = await smtp.tx.sendMail({ from: smtp.from, to, subject, text });
    return { ok: true, id: info.messageId };
  } catch (error) {
    return { ok: false, error: error?.message || 'send_failed' };
  }
}

function bookingInfoText(b) {
  return [
    `Applicant: ${b.applicant_name || 'Unknown'}`,
    `State: ${b.applicant_state || '—'}`,
    `Time (EST): ${b.requested_at_est || '—'}`,
    `Phone: ${b.applicant_phone || '—'}`,
    `Email: ${b.applicant_email || '—'}`,
    `Booking ID: ${b.id || '—'}`
  ].join('\n');
}

export async function POST() {
  const rows = await loadJsonStore(STORE_PATH, []);
  const admins = adminEmails();
  const now = new Date();
  const nowMs = now.getTime();
  const todayEt = toEtYmd(now);

  let sent = 0;
  const errors = [];

  for (const b of rows) {
    if (clean(b.claim_status).toLowerCase() !== 'claimed') continue;

    const closerName = clean(b.claimed_by);
    const closerEmail = findUserEmailByName(closerName);
    if (!closerEmail) continue;

    const eventDate = parseRequestedEst(b.requested_at_est);
    if (!eventDate || Number.isNaN(eventDate.getTime())) continue;

    const minsToEvent = Math.round((eventDate.getTime() - nowMs) / 60000);
    const eventEt = toEtYmd(eventDate);

    const to = [...new Set([closerEmail, ...admins])].join(', ');

    // Day-of reminder (once, after 7:00 AM ET on event date)
    if (!b.day_of_reminder_sent_at && eventEt === todayEt) {
      const hourEt = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(now));
      if (!Number.isNaN(hourEt) && hourEt >= 7) {
        const msg = await sendMail(
          to,
          `Day-Of Sponsorship Reminder: ${b.applicant_name || 'Applicant'} (${b.requested_at_est || ''})`,
          `Day-of reminder for claimed sponsorship booking.\n\nCloser: ${closerName}\n\n${bookingInfoText(b)}`
        );
        if (msg.ok) {
          b.day_of_reminder_sent_at = nowIso();
          sent += 1;
        } else {
          errors.push({ bookingId: b.id, type: 'day_of', error: msg.error });
        }
      }
    }

    // One-hour-before reminder (once, between 50 and 70 minutes before)
    if (!b.hour_before_reminder_sent_at && minsToEvent <= 70 && minsToEvent >= 50) {
      const msg = await sendMail(
        to,
        `1-Hour Reminder: ${b.applicant_name || 'Applicant'} (${b.requested_at_est || ''})`,
        `One-hour reminder for claimed sponsorship booking.\n\nCloser: ${closerName}\n\n${bookingInfoText(b)}`
      );
      if (msg.ok) {
        b.hour_before_reminder_sent_at = nowIso();
        sent += 1;
      } else {
        errors.push({ bookingId: b.id, type: 'hour_before', error: msg.error });
      }
    }
  }

  await saveJsonStore(STORE_PATH, rows);
  return Response.json({ ok: true, sent, errorsCount: errors.length, errors });
}
