import licensedAgents from '../../../data/licensedAgents.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function normalizeKey(v = '') {
  return clean(v).toLowerCase().replace(/[^a-z0-9]/g, '');
}

const REF_CODE_MAP = {
  kimora_link: 'Kimora Link',
  jamal_holmes: 'Jamal Holmes',
  mahogany_burns: 'Mahogany Burns',
  madalyn_adams: 'Madalyn Adams',
  kelin_brown: 'Kelin Brown',
  leticia_wright: 'Leticia Wright',
  latricia_wright: 'Leticia Wright',
  breanna_james: 'Breanna James',
  dr_brianna: 'Breanna James'
};

function referralOwnerName(booking = {}) {
  const byName = clean(booking?.referred_by || booking?.referredBy || '');
  if (byName) return byName;
  const byCode = clean(booking?.referral_code || booking?.refCode || '').toLowerCase();
  return REF_CODE_MAP[byCode] || '';
}

function isKimoraReferral(booking = {}) {
  return normalize(referralOwnerName(booking)) === 'kimora link';
}

function parseFullName(lastFirst = '') {
  const raw = clean(lastFirst);
  if (!raw) return '';
  if (!raw.includes(',')) return raw;
  const [last, first] = raw.split(',').map((x) => clean(x));
  return clean(`${first} ${last}`);
}

function hasStateLicense(agentName = '', state = '') {
  const nameKey = normalizeKey(agentName);
  const stateCode = clean(state).toUpperCase().slice(0, 2);
  if (!nameKey || !stateCode) return false;

  return (licensedAgents || []).some((row) => {
    const rowName = parseFullName(row?.full_name || row?.name || '');
    const rowKey = normalizeKey(rowName);
    const rowState = clean(row?.state_code || row?.home_state || '').toUpperCase().slice(0, 2);
    return rowKey === nameKey && rowState === stateCode;
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const booking = body?.booking || {};
    const alertText = body?.alertText || '';

    // Sponsorship call alert routing:
    // 1) Kimora referrals => always send Telegram.
    // 2) Non-Kimora referrals => send Telegram only when referral owner is NOT licensed in applicant state.
    const isSponsorshipBooking = Boolean(clean(booking?.source_application_id));
    if (isSponsorshipBooking) {
      if (!isKimoraReferral(booking)) {
        const owner = referralOwnerName(booking);
        const state = clean(booking?.applicant_state || '').toUpperCase();
        const ownerLicensedInState = hasStateLicense(owner, state);

        if (ownerLicensedInState) {
          return Response.json({ ok: true, skipped: 'owner_licensed_in_state' });
        }
      }
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
