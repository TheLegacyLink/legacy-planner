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

function minutesTo12h(minutes = 0) {
  const m = Number(minutes || 0);
  const hh24 = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const ap = hh24 >= 12 ? 'PM' : 'AM';
  const hh12 = hh24 % 12 === 0 ? 12 : hh24 % 12;
  return `${hh12}:${String(mm).padStart(2, '0')} ${ap}`;
}

function shiftDateKey(dateKey = '', dayDelta = 0) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateKey;
  d.setUTCDate(d.getUTCDate() + Number(dayDelta || 0));
  return d.toISOString().slice(0, 10);
}

function zoneLabelFromEt(dateKey = '', etMinutes = 0, offsetMinutes = 0, zone = 'ET') {
  let total = Number(etMinutes || 0) + Number(offsetMinutes || 0);
  let dayDelta = 0;
  while (total < 0) { total += 1440; dayDelta -= 1; }
  while (total >= 1440) { total -= 1440; dayDelta += 1; }
  return `${shiftDateKey(dateKey, dayDelta)} ${minutesTo12h(total)} ${zone}`;
}

function timezoneForState(state = '') {
  const s = clean(state).toUpperCase();
  const PT = new Set(['CA','WA','OR','NV']);
  const MT = new Set(['AZ','CO','ID','MT','NM','UT','WY']);
  const CT = new Set(['TX','IL','WI','MN','IA','MO','AR','LA','MS','AL','TN','KY','OK','KS','NE','SD','ND']);
  if (PT.has(s)) return { zone: 'PT', offsetMinutes: -180 };
  if (MT.has(s)) return { zone: 'MT', offsetMinutes: -120 };
  if (CT.has(s)) return { zone: 'CT', offsetMinutes: -60 };
  return { zone: 'ET', offsetMinutes: 0 };
}

function localSlotLabel(row = {}) {
  const parsed = parseRequestedAtEst(row?.requested_at_est || '');
  if (!parsed) return clean(row?.requested_at_est || '—');
  const tz = timezoneForState(row?.applicant_state || '');
  return zoneLabelFromEt(parsed.dateKey, parsed.minutes, tz.offsetMinutes, tz.zone);
}

function buildCalendarLink(row = {}, zoomLink = '') {
  const parsed = parseRequestedAtEst(row?.requested_at_est || '');
  if (!parsed) return '';
  const ymd = parsed.dateKey.replace(/-/g, '');
  const hh = String(Math.floor(parsed.minutes / 60)).padStart(2, '0');
  const mm = String(parsed.minutes % 60).padStart(2, '0');
  const end = parsed.minutes + 45;
  const eh = String(Math.floor(end / 60)).padStart(2, '0');
  const em = String(end % 60).padStart(2, '0');
  const title = `Inner Circle Strategy Call — Kimora Link + ${clean(row?.applicant_name || 'Client')}`;
  const details = `Your Inner Circle strategy call is confirmed.\n\nZoom: ${zoomLink}`;
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', title);
  url.searchParams.set('dates', `${ymd}T${hh}${mm}00/${ymd}T${eh}${em}00`);
  url.searchParams.set('ctz', 'America/New_York');
  url.searchParams.set('details', details);
  url.searchParams.set('location', 'Zoom');
  return url.toString();
}

function mergeRowsById(baseRows = [], incomingRows = []) {
  const map = new Map();
  for (const r of (baseRows || [])) {
    const id = clean(r?.id);
    if (!id) continue;
    map.set(id, { ...r });
  }
  for (const r of (incomingRows || [])) {
    const id = clean(r?.id);
    if (!id) continue;
    map.set(id, { ...(map.get(id) || {}), ...r });
  }
  const out = Array.from(map.values());
  out.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  return out;
}

function emailTransport() {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass || !from) return null;
  return {
    from,
    tx: nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  };
}

async function sendInnerCircleBookedEmail(row = {}) {
  const mailer = emailTransport();
  const to = clean(process.env.INNER_CIRCLE_BOOKING_NOTIFY_EMAIL || process.env.KIMORA_NOTIFY_EMAIL || 'support@thelegacylink.com');

  if (!mailer || !to) return { ok: false, error: 'email_not_configured' };

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
    const info = await mailer.tx.sendMail({
      from: mailer.from,
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

async function sendAttendeeConfirmationEmail(row = {}) {
  const mailer = emailTransport();
  const to = clean(row?.applicant_email || '');
  if (!mailer || !to) return { ok: false, skipped: true, error: 'missing_attendee_email_or_mailer' };

  const zoomLink = clean(process.env.INNER_CIRCLE_ZOOM_LINK || process.env.NEXT_PUBLIC_INNER_CIRCLE_ZOOM_LINK || 'https://us06web.zoom.us/j/9574933592?pwd=KiWiYeUNEXTbCIhGvIGGd5M9JKAWkY.1');
  const localTime = localSlotLabel(row);
  const calLink = buildCalendarLink(row, zoomLink);

  const subject = 'Inner Circle Strategy Call Confirmation';
  const applicant = clean(row?.applicant_name || 'there');
  const text = [
    `Hi ${applicant},`,
    '',
    'Your Inner Circle strategy call is confirmed.',
    '',
    `Time: ${localTime}`,
    `Zoom Link: ${zoomLink}`,
    calLink ? `Add to Google Calendar: ${calLink}` : '',
    '',
    'If you need to reschedule, please reply to this email in advance.',
    '',
    'Best regards,',
    'Kimora Link',
    'The Legacy Link'
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px;margin:0 auto;">
      <h2 style="margin:0 0 10px;color:#111827;">Inner Circle Strategy Call Confirmation</h2>
      <p>Hi <strong>${applicant}</strong>,</p>
      <p>Your Inner Circle strategy call is confirmed.</p>
      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;background:#f8fafc;">
        <p style="margin:0 0 6px;"><strong>Time:</strong> ${localTime}</p>
        <p style="margin:0;"><strong>Zoom Link:</strong> <a href="${zoomLink}">Join Meeting</a></p>
      </div>
      ${calLink ? `<p style="margin-top:12px;"><a href="${calLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;">Add to Google Calendar</a></p>` : ''}
      <p>If you need to reschedule, please reply to this email in advance.</p>
      <p style="margin-top:16px;">Best regards,<br/><strong>Kimora Link</strong><br/>The Legacy Link</p>
    </div>
  `;

  try {
    const info = await mailer.tx.sendMail({ from: mailer.from, to, subject, text, html });
    return { ok: true, messageId: info?.messageId || '', calendarLink: calLink };
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

    const latest = await loadJsonStore(STORE_PATH, []);
    const merged = mergeRowsById(latest, rows);
    await saveJsonStore(STORE_PATH, merged);
    const saved = merged.find((r) => clean(r?.id) === id) || rows[idx];
    return Response.json({ ok: true, row: saved });
  }

  if (mode === 'send_attendee_confirmation') {
    const id = clean(body?.id);
    if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });
    const idx = rows.findIndex((r) => clean(r?.id) === id);
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    const row = rows[idx] || {};
    const sent = await sendAttendeeConfirmationEmail(row);
    if (!sent?.ok) {
      return Response.json({ ok: false, error: sent?.error || 'send_failed' }, { status: 500 });
    }

    const sentAt = nowIso();
    rows[idx] = {
      ...row,
      meeting_email_sent_at: sentAt,
      meeting_email_sent_count: Number(row?.meeting_email_sent_count || 0) + 1,
      updated_at: sentAt
    };

    const latest = await loadJsonStore(STORE_PATH, []);
    const merged = mergeRowsById(latest, rows);
    await saveJsonStore(STORE_PATH, merged);
    const saved = merged.find((r) => clean(r?.id) === id) || rows[idx];

    return Response.json({ ok: true, row: saved, sent });
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

  const latest = await loadJsonStore(STORE_PATH, []);
  const merged = mergeRowsById(latest, rows);
  await saveJsonStore(STORE_PATH, merged);

  let notify = { internal: { ok: false, skipped: true }, attendee: { ok: false, skipped: true } };
  if (idx < 0) {
    const [internal, attendee] = await Promise.all([
      sendInnerCircleBookedEmail(next),
      sendAttendeeConfirmationEmail(next)
    ]);
    notify = { internal, attendee };
  }

  const saved = merged.find((r) => clean(r?.id) === id) || next;
  return Response.json({ ok: true, row: saved, notify });
}
