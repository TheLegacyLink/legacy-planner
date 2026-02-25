import { loadJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/sponsorship-bookings.json';

function clean(v = '') {
  return String(v || '').trim();
}

async function tgSend(chatId, text) {
  const token = clean(process.env.TELEGRAM_BOT_TOKEN);
  if (!token || !chatId) return { ok: false, error: 'missing_telegram_env' };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

  if (!res.ok) return { ok: false, error: await res.text().catch(() => 'telegram_error') };
  return { ok: true };
}

export async function POST() {
  const chatId = clean(process.env.TELEGRAM_CHAT_ID);
  const rows = await loadJsonStore(STORE_PATH, []);

  const claimed = rows.filter((r) => clean(r.claim_status).toLowerCase() === 'claimed' && clean(r.claimed_by));
  if (!claimed.length) {
    const sent = await tgSend(chatId, '📌 Sponsorship assignment reminder: no claimed bookings at the moment.');
    return Response.json({ ok: sent.ok, total: 0, error: sent.error });
  }

  const byClaimer = new Map();
  claimed.forEach((r) => {
    const key = clean(r.claimed_by);
    if (!byClaimer.has(key)) byClaimer.set(key, []);
    byClaimer.get(key).push(r);
  });

  const lines = ['📌 Sponsorship Assignment Reminder'];
  for (const [claimer, list] of byClaimer.entries()) {
    lines.push(`\n${claimer}`);
    list
      .sort((a, b) => new Date(a.requested_at_est || 0).getTime() - new Date(b.requested_at_est || 0).getTime())
      .forEach((r) => {
        lines.push(`- ${r.applicant_name || 'Unknown'} | ${r.applicant_state || '—'} | ${r.requested_at_est || '—'} | ${r.id}`);
      });
  }

  const sent = await tgSend(chatId, lines.join('\n'));
  return Response.json({ ok: sent.ok, total: claimed.length, error: sent.error });
}
