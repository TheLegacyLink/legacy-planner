export async function POST(req) {
  try {
    const body = await req.json();
    const booking = body?.booking || {};
    const alertText = body?.alertText || '';

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return Response.json({ ok: false, error: 'missing_telegram_env' }, { status: 400 });
    }

    const text = alertText || [
      'New Sponsorship Booking',
      `Referral: ${booking.referred_by || 'Unknown'}`,
      `Applicant: ${booking.applicant_name || 'Unknown'}`,
      `State: ${booking.applicant_state || '—'}`,
      `Licensed: ${booking.licensed_status || '—'}`,
      `Requested Time (EST): ${booking.requested_at_est || '—'}`,
      `Score: ${booking.score || 0}`,
      `Eligible Closers: ${Array.isArray(booking.eligible_closers) ? booking.eligible_closers.join(', ') : 'None'}`
    ].join('\n');

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
    return Response.json({ ok: true, data });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'server_error' }, { status: 500 });
  }
}
