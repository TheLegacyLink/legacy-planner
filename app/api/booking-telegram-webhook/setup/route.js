function clean(v = '') {
  return String(v || '').trim();
}

export async function POST() {
  const token = clean(process.env.TELEGRAM_BOT_TOKEN);
  if (!token) return Response.json({ ok: false, error: 'missing_telegram_token' }, { status: 400 });

  const webhookUrl = 'https://innercirclelink.com/api/booking-telegram-webhook';
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return Response.json({ ok: false, error: data }, { status: 502 });
  return Response.json({ ok: true, data });
}
