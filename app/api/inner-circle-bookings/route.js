import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import nodemailer from 'nodemailer';

const STORE_PATH = 'stores/inner-circle-bookings.json';

function clean(v = '') {
  return String(v || '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function parseRequestedAtEst(raw = '') {
  const m = clean(raw).match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  const [, dateKey, hRaw, minRaw, apRaw] = m;
  let h = Number(hRaw || 0);
  const mm = Number(minRaw || 0);
  const ap = String(apRaw || '').toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return { dateKey, minutes: h * 60 + mm };
}

function isActiveBookingStatus(status = '') {
  const s = clean(status).toLowerCase();
  return s !== 'canceled';
}

async function sendInnerCircleBookedEmail(row = {}) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  const to = clean(process.env.INNER_CIRCLE_BOOKING_NOTIFY_EMAIL || process.env.KIMORA_NOTIFY_EMAIL || 'support@thelegacylink.com');

  if (!user || !pass || !to) return { ok: false, error: 'email_not_configured' };

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const subject = `Inner Circle Booking Confirmed: ${clean(row?.applicant_name) || 'Applicant'}`;

  const text = [
    'A qualified Inner Circle applicant booked a one-on-one strategy call.',
    '',
    `Applicant: ${clean(row?.applicant_name)}`,
    `Email: ${clean(row?.applicant_email)}`,
    `Phone: ${clean(row?.applicant_phone)}`,
    `State: ${clean(row?.applicant_state)}`,
    `Booked Time (EST): ${clean(row?.requested_at_est)}`,
    `Application ID: ${clean(row?.source_application_id)}`,
    '',
    `Notes: ${clean(row?.notes || '—')}`
  ].join('\n');

  try {
    const info = await tx.sendMail({
      from,
      to,
      subject,
      text,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
        <h2>Inner Circle Booking Confirmed</h2>
        <p><strong>Applicant:</strong> ${clean(row?.applicant_name)}</p>
        <p><strong>Email:</strong> ${clean(row?.applicant_email)}</p>
        <p><strong>Phone:</strong> ${clean(row?.applicant_phone)}</p>
        <p><strong>State:</strong> ${clean(row?.applicant_state)}</p>
        <p><strong>Booked Time (EST):</strong> ${clean(row?.requested_at_est)}</p>
        <p><strong>Application ID:</strong> ${clean(row?.source_application_id)}</p>
        <p><strong>Notes:</strong> ${clean(row?.notes || '—')}</p>
      </div>`
    });
    return { ok: true, messageId: info?.messageId || '' };
  } catch (error) {
    return { ok: false, error: error?.message || 'send_failed' };
  }
}

export async function GET() {
  const rows = await loadJsonStore(STORE_PATH, []);
  rows.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  return Response.json({ ok: true, rows });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const mode = clean(body?.mode || 'upsert').toLowerCase();

  const rows = await loadJsonStore(STORE_PATH, []);

  if (mode === 'update_status') {
    const id = clean(body?.id);
    const bookingStatus = clean(body?.bookingStatus || '').toLowerCase();
    const ownerNotes = clean(body?.ownerNotes || '');

    if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });
    const idx = rows.findIndex((r) => clean(r?.id) === id);
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    const allowed = new Set(['booked', 'confirmed', 'completed', 'no_show', 'rescheduled', 'canceled']);
    const nextStatus = allowed.has(bookingStatus) ? bookingStatus : clean(rows[idx]?.booking_status || 'booked').toLowerCase();

    rows[idx] = {
      ...rows[idx],
      booking_status: nextStatus,
      owner_notes: ownerNotes,
      updated_at: nowIso()
    };

    await saveJsonStore(STORE_PATH, rows);
    return Response.json({ ok: true, row: rows[idx] });
  }

  if (mode !== 'upsert') {
    return Response.json({ ok: false, error: 'unsupported_mode' }, { status: 400 });
  }

  const booking = body?.booking || {};
  const id = clean(booking?.id);
  if (!id) return Response.json({ ok: false, error: 'missing_booking_id' }, { status: 400 });

  const next = {
    booking_type: 'inner_circle',
    booking_status: clean(booking?.booking_status || 'booked').toLowerCase(),
    owner_notes: clean(booking?.owner_notes || ''),
    ...booking,
    id,
    updated_at: nowIso()
  };

  const nextSlot = parseRequestedAtEst(next?.requested_at_est || '');
  if (!nextSlot) return Response.json({ ok: false, error: 'missing_booking_date' }, { status: 400 });

  const conflicting = rows.find((r) => {
    if (!isActiveBookingStatus(r?.booking_status || 'booked')) return false;
    if (clean(r?.id) === id) return false;

    const existing = parseRequestedAtEst(r?.requested_at_est || '');
    if (!existing) return false;
    if (existing.dateKey !== nextSlot.dateKey) return false;

    // Block 45-minute meeting + 15-minute buffer => 60-minute lock window.
    return Math.abs(existing.minutes - nextSlot.minutes) < 60;
  });
  if (conflicting) {
    return Response.json({ ok: false, error: 'timeslot_unavailable', conflictDate: nextSlot.dateKey }, { status: 409 });
  }

  const idx = rows.findIndex((r) => clean(r?.id) === id);
  if (idx >= 0) rows[idx] = { ...rows[idx], ...next };
  else rows.unshift({ ...next, created_at: clean(next?.created_at || nowIso()) });

  await saveJsonStore(STORE_PATH, rows);

  let notify = { ok: false, skipped: true };
  if (idx < 0) {
    notify = await sendInnerCircleBookedEmail(next);
  }

  return Response.json({ ok: true, row: idx >= 0 ? rows[idx] : rows[0], notify });
}
