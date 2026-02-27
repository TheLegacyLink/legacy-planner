function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function isKimoraReferral(booking = {}) {
  const byName = normalize(booking?.referred_by || booking?.referredBy || '');
  const byCode = normalize(booking?.referral_code || booking?.refCode || '').replace(/[_-]+/g, ' ');
  return byName === 'kimora link' || byCode === 'kimora link';
}

export async function POST(req) {
  try {
    const body = await req.json();
    const booking = body?.booking || {};
    const alertText = body?.alertText || '';

    // For sponsorship call alerts, only send Telegram notifications for Kimora referrals.
    const isSponsorshipBooking = Boolean(clean(booking?.source_application_id));
    if (isSponsorshipBooking && !isKimoraReferral(booking)) {
      return Response.json({ ok: true, skipped: 'non_kimora_referral' });
    }

    const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();

    if (!token || !chatId) {
      return Response.json({ ok: false, error: 'missing_telegram_env' }, { status: 400 });
    }

    const text = alertText || [
      'New policy help request',
      `State: ${booking.applicant_state || '—'}`,
      `Referred by: ${booking.referred_by || 'Unknown'}`
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
