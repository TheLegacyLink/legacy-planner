import nodemailer from 'nodemailer';

function clean(v = '') { return String(v || '').trim(); }

function toUtcRange(dateIso = '', durationMin = 30) {
  const start = new Date(dateIso);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + Number(durationMin || 30) * 60 * 1000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return { startUtc: fmt(start), endUtc: fmt(end) };
}

function buildCalendarLink({ title = '', details = '', startUtc = '', endUtc = '' }) {
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', title);
  url.searchParams.set('dates', `${startUtc}/${endUtc}`);
  url.searchParams.set('details', details);
  url.searchParams.set('location', 'Zoom');
  return url.toString();
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const to = clean(body?.to);
  const attendeeName = clean(body?.attendeeName || 'there');
  const zoomLink = clean(body?.zoomLink);
  const meetingIso = clean(body?.meetingIso); // e.g. 2026-03-11T15:00:00.000Z
  const etLabel = clean(body?.etLabel || '11:00 AM ET');
  const ctLabel = clean(body?.ctLabel || '10:00 AM CT');
  const meetingDateLabel = clean(body?.meetingDateLabel || 'Wednesday, March 11, 2026');
  const durationMin = Number(body?.durationMin || 30);

  if (!to || !zoomLink || !meetingIso) {
    return Response.json({ ok: false, error: 'missing_required_fields' }, { status: 400 });
  }

  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass || !from) {
    return Response.json({ ok: false, error: 'missing_gmail_env' }, { status: 500 });
  }

  const range = toUtcRange(meetingIso, durationMin);
  if (!range) return Response.json({ ok: false, error: 'invalid_meeting_iso' }, { status: 400 });

  const title = 'Inner Circle Strategy Call — Kimora Link + ' + attendeeName;
  const details = `Your Inner Circle strategy call is confirmed.\n\nZoom: ${zoomLink}\n\nTime: ${meetingDateLabel} at ${etLabel} (${ctLabel}).`;
  const calendarLink = buildCalendarLink({ title, details, startUtc: range.startUtc, endUtc: range.endUtc });

  const subject = `Inner Circle Strategy Call Confirmed — ${meetingDateLabel} ${etLabel}`;
  const text = [
    `Hi ${attendeeName},`,
    '',
    'Your Inner Circle strategy call is confirmed.',
    '',
    `Time: ${meetingDateLabel} at ${etLabel} (${ctLabel})`,
    `Zoom Link: ${zoomLink}`,
    `Add to Google Calendar: ${calendarLink}`,
    '',
    'Looking forward to meeting with you.',
    '',
    '- Kimora Link'
  ].join('\n');

  try {
    const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    const info = await tx.sendMail({ from, to, subject, text });
    return Response.json({ ok: true, messageId: info?.messageId || '', calendarLink });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
