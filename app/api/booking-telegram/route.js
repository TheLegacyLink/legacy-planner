function clean(v = '') {
  return String(v || '').trim();
}

function portalBaseUrl(req) {
  const envUrl = clean(process.env.LEAD_CLAIM_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL);
  if (envUrl) return envUrl.replace(/\/$/, '');

  try {
    const incoming = new URL(req.url);
    return `${incoming.protocol}//${incoming.host}`;
  } catch {
    return '';
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const booking = body?.booking || {};

    const token = clean(process.env.TELEGRAM_BOT_TOKEN);
    const chatId = clean(process.env.TELEGRAM_CHAT_ID);

    if (!token || !chatId) {
      return Response.json({ ok: false, error: 'missing_telegram_env' }, { status: 400 });
    }

    const base = portalBaseUrl(req);
    const claimUrl = base ? `${base}/lead-claims${clean(booking?.id) ? `?booking=${encodeURIComponent(booking.id)}` : ''}` : '';

    const text = [
      '🔥 New booked lead is ready to claim',
      `Booking ID: ${booking?.id || '—'}`,
      `State: ${booking?.applicant_state || '—'}`,
      `Referred by: ${booking?.referred_by || 'Unknown'}`,
      clean(booking?.priority_agent)
        ? `Priority hold: ${booking.priority_agent} (24h)`
        : 'Priority hold: none (open to all)',
      claimUrl ? `Claim portal: ${claimUrl}` : ''
    ].filter(Boolean).join('\n');

    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    });

    if (!tg.ok) {
      const err = await tg.text().catch(() => 'telegram_error');
      return Response.json({ ok: false, error: err }, { status: 502 });
    }

    const data = await tg.json().catch(() => ({}));
    return Response.json({ ok: true, data, claimUrl });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'server_error' }, { status: 500 });
  }
}
