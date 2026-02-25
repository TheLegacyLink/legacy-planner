import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/sponsorship-bookings.json';

function clean(v = '') {
  return String(v || '').trim();
}

function nowIso() {
  return new Date().toISOString();
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

  rows[idx] = {
    ...rows[idx],
    claim_status: 'Claimed',
    claimed_by: claimedBy,
    claimed_at: nowIso(),
    updated_at: nowIso()
  };

  await saveJsonStore(STORE_PATH, rows);

  await tgSend(
    msg.chat?.id,
    `✅ Claimed: ${bookingId}\nCloser: ${claimedBy}\nApplicant: ${rows[idx].applicant_name || 'Unknown'}\nTime: ${rows[idx].requested_at_est || '—'}`
  );

  return Response.json({ ok: true, bookingId, claimedBy });
}
