import nodemailer from 'nodemailer';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const BOOKINGS_PATH = 'stores/inner-circle-bookings.json';

function clean(v = '') { return String(v || '').trim(); }
function nowIso() { return new Date().toISOString(); }

function mailer() {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass || !from) return null;
  return { from, tx: nodemailer.createTransport({ service: 'gmail', auth: { user, pass } }) };
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const bookingId = clean(body?.bookingId);
  if (!bookingId) return Response.json({ ok: false, error: 'missing_booking_id' }, { status: 400 });

  const rows = await loadJsonStore(BOOKINGS_PATH, []);
  const idx = rows.findIndex((r) => clean(r?.id) === bookingId);
  if (idx < 0) return Response.json({ ok: false, error: 'booking_not_found' }, { status: 404 });

  const row = rows[idx] || {};
  const to = clean(row?.applicant_email || '');
  if (!to) return Response.json({ ok: false, error: 'missing_applicant_email' }, { status: 400 });

  const contractUrl = clean(process.env.NEXT_PUBLIC_DOCUSIGN_INNER_CIRCLE_CONTRACT_URL || process.env.NEXT_PUBLIC_DOCUSIGN_IUL_ICA_URL || process.env.NEXT_PUBLIC_DOCUSIGN_ICA_URL || 'https://innercirclelink.com/iul-agreement');
  const m = mailer();
  if (!m) return Response.json({ ok: false, error: 'mail_not_configured' }, { status: 500 });

  const name = clean(row?.applicant_name || 'there');
  const subject = 'Inner Circle Contract — Next Step';
  const text = [
    `Hi ${name},`,
    '',
    'Great speaking with you today.',
    'Your next step is to complete your Inner Circle contract below:',
    contractUrl,
    '',
    'Once signed, we can move your onboarding forward immediately.',
    '',
    '- Kimora Link'
  ].join('\n');

  try {
    const info = await m.tx.sendMail({ from: m.from, to, subject, text });

    const sentAt = nowIso();
    rows[idx] = {
      ...row,
      contract_invite_sent_at: sentAt,
      contract_invite_count: Number(row?.contract_invite_count || 0) + 1,
      updated_at: sentAt
    };
    await saveJsonStore(BOOKINGS_PATH, rows);

    return Response.json({ ok: true, messageId: info?.messageId || '', sentAt, count: rows[idx].contract_invite_count });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
