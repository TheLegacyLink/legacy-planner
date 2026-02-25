import nodemailer from 'nodemailer';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import users from '../../../data/innerCircleUsers.json';

const STORE_PATH = 'stores/sponsorship-bookings.json';

function clean(v = '') {
  return String(v || '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function parseRequestedEst(value = '') {
  const m = clean(value).match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  const [, d, hhRaw, mm, ampmRaw] = m;
  let hh = Number(hhRaw);
  const ampm = ampmRaw.toUpperCase();
  if (ampm === 'PM' && hh !== 12) hh += 12;
  if (ampm === 'AM' && hh === 12) hh = 0;
  return new Date(`${d}T${String(hh).padStart(2, '0')}:${mm}:00-05:00`);
}

function calendarLink(booking = {}) {
  const start = parseRequestedEst(booking.requested_at_est);
  if (!start) return '';
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const text = encodeURIComponent(`Sponsorship Application - ${booking.applicant_name || 'Applicant'}`);
  const details = encodeURIComponent([
    `Referral Owner: ${booking.referred_by || 'Unknown'}`,
    'This claim is for handling the booked application session only.',
    'Referral ownership does NOT transfer with this claim.'
  ].join('\n'));
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(start)}/${fmt(end)}&details=${details}`;
}

function findUserEmailByName(name = '') {
  const n = normalize(name);
  const hit = (users || []).find((u) => normalize(u.name) === n && clean(u.email));
  return clean(hit?.email);
}

function adminEmails() {
  return [...new Set((users || [])
    .filter((u) => normalize(u.role) === 'admin' && clean(u.email))
    .map((u) => clean(u.email)))];
}

async function sendAssignmentEmail(booking = {}, claimedBy = '') {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass) return { ok: false, error: 'missing_gmail_env' };

  const closerEmail = findUserEmailByName(claimedBy);
  const admins = adminEmails();
  const recipients = [...new Set([closerEmail, ...admins].filter(Boolean))];
  if (!recipients.length) return { ok: false, error: 'no_recipients' };

  const first = clean(booking.applicant_first_name) || clean((booking.applicant_name || '').split(' ')[0]);
  const last = clean(booking.applicant_last_name) || clean((booking.applicant_name || '').split(' ').slice(1).join(' '));
  const cal = calendarLink(booking);

  const subject = `Claim Confirmed: ${booking.applicant_name || 'Applicant'} (${booking.requested_at_est || 'Time TBD'})`;
  const text = [
    `Hi ${claimedBy},`,
    '',
    'Your claim is confirmed. Here are the booking details:',
    `- First Name: ${first || '—'}`,
    `- Last Name: ${last || '—'}`,
    `- Email: ${booking.applicant_email || '—'}`,
    `- Phone: ${booking.applicant_phone || '—'}`,
    `- Booked Time (EST): ${booking.requested_at_est || '—'}`,
    `- Referred By: ${booking.referred_by || 'Unknown'}`,
    '',
    'Important:',
    '- This claim is for handling the booked application session.',
    '- Referral ownership does NOT transfer. Payout referral credit stays with the referred-by owner.',
    '- No immediate call is required just because claim is confirmed; follow the booked schedule.',
    '',
    cal ? `Add to calendar: ${cal}` : 'Add to calendar: unavailable',
    '',
    'Thanks,'
  ].join('\n');

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const info = await tx.sendMail({ from, to: recipients.join(', '), subject, text });
  return { ok: true, messageId: info.messageId, to: recipients };
}

function claimerFromMessage(msg = {}) {
  const text = clean(msg?.text);
  const byPattern = text.match(/^\s*CONFIRM\s+book_[0-9]+\s*-\s*([^\-\n]+)(?:-|$)/i);
  if (byPattern?.[1]) return clean(byPattern[1]);
  const first = clean(msg?.from?.first_name);
  const last = clean(msg?.from?.last_name);
  return clean(`${first} ${last}`) || clean(msg?.from?.username);
}

function bookingIdFromMessage(text = '') {
  const m = clean(text).match(/\b(book_[0-9]+)\b/i);
  return m ? m[1] : '';
}

async function tgSend(chatId, text) {
  const token = clean(process.env.TELEGRAM_BOT_TOKEN);
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  }).catch(() => null);
}

export async function POST(req) {
  const update = await req.json().catch(() => ({}));
  const msg = update?.message || update?.edited_message;
  if (!msg?.text) return Response.json({ ok: true, skipped: 'no_text' });

  const text = clean(msg.text);
  if (!/^\s*CONFIRM\b/i.test(text)) {
    return Response.json({ ok: true, skipped: 'not_confirm' });
  }

  const bookingId = bookingIdFromMessage(text);
  if (!bookingId) {
    await tgSend(msg.chat?.id, 'Please use: CONFIRM book_1234567890 - Your Name - I can take this.');
    return Response.json({ ok: false, error: 'missing_booking_id' }, { status: 400 });
  }

  const claimedBy = claimerFromMessage(msg);
  if (!claimedBy) {
    await tgSend(msg.chat?.id, 'Could not read your name. Please use: CONFIRM book_1234567890 - Your Name - I can take this.');
    return Response.json({ ok: false, error: 'missing_name' }, { status: 400 });
  }

  const rows = await loadJsonStore(STORE_PATH, []);
  const idx = rows.findIndex((r) => clean(r.id) === bookingId);

  if (idx < 0) {
    await tgSend(msg.chat?.id, `Booking ${bookingId} not found.`);
    return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const currentStatus = normalize(rows[idx]?.claim_status);
  const currentClaimer = clean(rows[idx]?.claimed_by);

  // First valid confirm wins. Keep idempotent response for same claimer.
  if (currentStatus === 'claimed' && currentClaimer) {
    if (normalize(currentClaimer) === normalize(claimedBy)) {
      await tgSend(
        msg.chat?.id,
        `✅ Already claimed by you: ${bookingId}\nApplicant: ${rows[idx].applicant_name || 'Unknown'}\nTime: ${rows[idx].requested_at_est || '—'}`
      );
      return Response.json({ ok: true, bookingId, claimedBy, duplicate: true });
    }

    await tgSend(
      msg.chat?.id,
      `⚠️ ${bookingId} is already claimed by ${currentClaimer}.`
    );
    return Response.json({ ok: false, error: 'already_claimed', claimedBy: currentClaimer }, { status: 409 });
  }

  rows[idx] = {
    ...rows[idx],
    claim_status: 'Claimed',
    claimed_by: claimedBy,
    claimed_at: nowIso(),
    updated_at: nowIso()
  };

  await saveJsonStore(STORE_PATH, rows);

  const emailResult = await sendAssignmentEmail(rows[idx], claimedBy).catch((e) => ({ ok: false, error: e?.message || 'email_failed' }));

  await tgSend(
    msg.chat?.id,
    `✅ Claimed: ${bookingId}\nCloser: ${claimedBy}\nApplicant: ${rows[idx].applicant_name || 'Unknown'}\nTime: ${rows[idx].requested_at_est || '—'}${emailResult?.ok ? '\nAssignment email sent.' : '\n(Email send pending/fallback.)'}`
  );

  return Response.json({ ok: true, bookingId, claimedBy, email: emailResult });
}
