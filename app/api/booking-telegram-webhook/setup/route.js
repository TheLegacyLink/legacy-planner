function clean(v = '') {
  return String(v || '').trim();
}

// Single-brain mode: keep Telegram updates flowing to OpenClaw.
// This endpoint now clears webhooks instead of setting one.
export async function POST() {
  const token = clean(process.env.TELEGRAM_BOT_TOKEN);
  if (!token) return Response.json({ ok: false, error: 'missing_telegram_token' }, { status: 400 });

  const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drop_pending_updates: false })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return Response.json({ ok: false, error: data }, { status: 502 });

  return Response.json({
    ok: true,
    mode: 'single-brain',
    note: 'Webhook removed so OpenClaw can receive Telegram messages.',
    data
  });
}
