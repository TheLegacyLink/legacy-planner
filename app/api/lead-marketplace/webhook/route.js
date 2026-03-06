import nodemailer from 'nodemailer';
import { loadJsonFile, saveJsonFile } from '../../../../lib/blobJsonStore';

const MARKETPLACE_PATH = 'stores/lead-marketplace.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalizeStore(raw = {}) {
  return {
    settings: {
      sponsorshipTier1Price: 50,
      sponsorshipTier2Price: 89,
      ...(raw?.settings || {})
    },
    engagementByLeadId: raw?.engagementByLeadId && typeof raw.engagementByLeadId === 'object' ? raw.engagementByLeadId : {},
    soldByLeadId: raw?.soldByLeadId && typeof raw.soldByLeadId === 'object' ? raw.soldByLeadId : {},
    hiddenLeadKeys: raw?.hiddenLeadKeys && typeof raw.hiddenLeadKeys === 'object' ? raw.hiddenLeadKeys : {},
    upsellBySourceSessionId: raw?.upsellBySourceSessionId && typeof raw.upsellBySourceSessionId === 'object' ? raw.upsellBySourceSessionId : {}
  };
}

function shouldProcess(type = '') {
  return type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded';
}

function smtp() {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass) return null;

  return {
    from,
    tx: nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  };
}

function scriptByEngagement(engagement = '') {
  const engaged = clean(engagement).toLowerCase().includes('replied');
  if (engaged) {
    return {
      callOpener: 'Hey [Lead First Name], this is [Your Name] with The Legacy Link. Good news — you were approved for sponsorship. You replied already, so I wanted to get your next step call locked in right now.',
      bridge: 'Are you still ready to move forward this week?',
      close: 'Perfect. I can do [Option 1] or [Option 2] today. Which one works best?',
      noAnswerText: 'Hey [Lead First Name], this is [Your Name] with The Legacy Link. Great news — you were approved for sponsorship. Let’s lock your quick next-step call. I have [Option 1] or [Option 2].'
    };
  }

  return {
    callOpener: 'Hey [Lead First Name], this is [Your Name] with The Legacy Link. Great news — you were approved for sponsorship, and I’m your assigned advisor.',
    bridge: 'Are you still open to getting started?',
    close: 'Awesome. Let’s lock your quick onboarding call now. I have [Option 1] or [Option 2], what works better?',
    noAnswerText: 'Hey [Lead First Name], this is [Your Name] with The Legacy Link. Good news — you were approved for sponsorship. I’m assigned to help you next. What time today works for a quick 10-minute call?'
  };
}

async function sendBuyerReceiptEmail(payload = {}) {
  const to = clean(payload?.buyerEmail);
  if (!to) return { ok: false, error: 'missing_buyer_email' };

  const mailer = smtp();
  if (!mailer) return { ok: false, error: 'missing_gmail_env' };

  const leadName = clean(payload?.leadApplicant || 'Sponsorship Lead');
  const state = clean(payload?.state || 'Unknown State');
  const tier = clean(payload?.tier || 'tier1').toUpperCase();
  const engagement = clean(payload?.engagement || 'No Reply');
  const amount = Number(payload?.amountTotalUsd || 0).toFixed(2);
  const paidAt = clean(payload?.paidAt || new Date().toISOString());
  const buyerName = clean(payload?.buyerName || 'Agent');
  const script = scriptByEngagement(engagement);

  const subject = `Lead Purchase Receipt — ${leadName} (${state})`;

  const text = [
    `Congrats ${buyerName} — your lead purchase is confirmed.`,
    '',
    'Receipt',
    `- Lead: ${leadName}`,
    `- Tier: ${tier}`,
    `- Amount: $${amount}`,
    `- Purchased At: ${paidAt}`,
    `- Stripe Session: ${clean(payload?.stripeSessionId || '')}`,
    '',
    'Lead Details',
    `- Name: ${leadName}`,
    `- Phone: ${clean(payload?.leadPhone || 'N/A')}`,
    `- Email: ${clean(payload?.leadEmail || 'N/A')}`,
    `- State: ${state}`,
    `- Engagement: ${engagement}`,
    '',
    'Call Script (Approved Lead)',
    `1) Opener: ${script.callOpener}`,
    `2) Bridge Question: ${script.bridge}`,
    `3) Booking Close: ${script.close}`,
    `4) No-Answer Text: ${script.noAnswerText}`,
    '',
    'Execution Standard',
    '- Call in 5 minutes or less',
    '- Minimum 5–7 attempts',
    '- Log all outcomes in CRM'
  ].join('\n');

  const html = `
    <div style="margin:0;padding:24px;background:#f4f5fb;font-family:Inter,Arial,sans-serif;color:#111827;line-height:1.5;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(17,24,39,.08);">
        <div style="background:linear-gradient(135deg,#2f00ff 0%,#5b21b6 100%);padding:20px 24px;color:#fff;">
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">The Legacy Link</div>
          <h2 style="margin:6px 0 0;font-size:22px;line-height:1.2;">✅ Lead Purchase Confirmed</h2>
          <p style="margin:8px 0 0;opacity:.95;">Congrats ${buyerName} — your lead is secured and unlocked.</p>
        </div>

        <div style="padding:22px 24px;">
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
            <span style="background:#eef2ff;color:#312e81;border:1px solid #c7d2fe;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;">${tier}</span>
            <span style="background:#dcfce7;color:#166534;border:1px solid #86efac;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;">$${amount}</span>
            <span style="background:#ecfeff;color:#0f766e;border:1px solid #99f6e4;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;">Approved Lead</span>
          </div>

          <h3 style="margin:0 0 8px;font-size:16px;">Receipt</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
            <tr><td style="padding:6px 0;color:#6b7280;">Lead</td><td style="padding:6px 0;font-weight:600;">${leadName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">State</td><td style="padding:6px 0;font-weight:600;">${state}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Engagement</td><td style="padding:6px 0;font-weight:600;">${engagement}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Purchased At</td><td style="padding:6px 0;font-weight:600;">${paidAt}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Reference</td><td style="padding:6px 0;font-weight:600;">${clean(payload?.stripeSessionId || '')}</td></tr>
          </table>

          <div style="border:1px dashed #d1d5db;border-radius:12px;padding:14px;margin-bottom:16px;background:#fcfcff;">
            <h3 style="margin:0 0 8px;font-size:16px;">Lead Details</h3>
            <p style="margin:4px 0;"><strong>Name:</strong> ${leadName}</p>
            <p style="margin:4px 0;"><strong>Phone:</strong> ${clean(payload?.leadPhone || 'N/A')}</p>
            <p style="margin:4px 0;"><strong>Email:</strong> ${clean(payload?.leadEmail || 'N/A')}</p>
          </div>

          <h3 style="margin:0 0 8px;font-size:16px;">Approved Lead Script</h3>
          <ol style="padding-left:18px;margin:0 0 14px;">
            <li style="margin-bottom:8px;"><strong>Opener:</strong> ${script.callOpener}</li>
            <li style="margin-bottom:8px;"><strong>Bridge:</strong> ${script.bridge}</li>
            <li style="margin-bottom:8px;"><strong>Booking Close:</strong> ${script.close}</li>
            <li><strong>No-Answer Text:</strong> ${script.noAnswerText}</li>
          </ol>

          <div style="background:#111827;color:#fff;border-radius:12px;padding:14px;">
            <div style="font-weight:700;margin-bottom:6px;">Execution Standard</div>
            <div style="font-size:14px;opacity:.95;">Call in 5 minutes • 5–7 attempts minimum • log every outcome in CRM</div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const info = await mailer.tx.sendMail({
      from: mailer.from,
      to,
      subject,
      text,
      html
    });

    return { ok: true, messageId: info?.messageId || '' };
  } catch (error) {
    return { ok: false, error: error?.message || 'email_send_failed' };
  }
}

export async function POST(req) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    return Response.json({ ok: false, error: 'missing_stripe_env' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return Response.json({ ok: false, error: 'missing_signature' }, { status: 400 });
  }

  const payload = await req.text();

  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return Response.json({ ok: false, error: `invalid_signature:${error?.message || 'unknown'}` }, { status: 400 });
  }

  if (!shouldProcess(event?.type)) {
    return Response.json({ ok: true, ignored: true });
  }

  const session = event?.data?.object || {};
  const metadataType = clean(session?.metadata?.type || '');

  const rawMarket = await loadJsonFile(MARKETPLACE_PATH, {});
  const market = normalizeStore(rawMarket);

  if (metadataType === 'marketplace_upsell_fallback') {
    const sourceSessionId = clean(session?.metadata?.sourceSessionId || '');
    const offerLeadKeys = clean(session?.metadata?.offerLeadKeys || '')
      .split(',')
      .map((x) => clean(x))
      .filter(Boolean);

    if (!sourceSessionId || !offerLeadKeys.length) {
      return Response.json({ ok: false, error: 'invalid_upsell_metadata' }, { status: 400 });
    }

    if (market.upsellBySourceSessionId[sourceSessionId]) {
      return Response.json({ ok: true, idempotent: true, upsell: market.upsellBySourceSessionId[sourceSessionId] });
    }

    const paidAt = new Date().toISOString();
    for (const leadKey of offerLeadKeys) {
      if (market.soldByLeadId[leadKey]) continue;
      market.soldByLeadId[leadKey] = {
        leadKey,
        buyerName: clean(session?.metadata?.buyerName || ''),
        buyerEmail: clean(session?.metadata?.buyerEmail || (session?.customer_details?.email || '')).toLowerCase(),
        buyerRole: clean(session?.metadata?.buyerRole || 'agent'),
        tier: 'tier1',
        state: '',
        engagement: 'No Reply',
        leadApplicant: '',
        leadPhone: '',
        leadEmail: '',
        stripeSessionId: clean(session?.id || ''),
        stripePaymentIntent: clean(session?.payment_intent || ''),
        paymentStatus: clean(session?.payment_status || 'paid'),
        amountTotalUsd: Number(session?.amount_total || 0) / Math.max(1, offerLeadKeys.length) / 100,
        paidAt,
        createdAt: paidAt,
        source: 'upsell_offer_fallback'
      };
    }

    market.upsellBySourceSessionId[sourceSessionId] = {
      leadKeys: offerLeadKeys,
      amountUsd: Number(session?.amount_total || 0) / 100,
      chargeId: clean(session?.payment_intent || ''),
      paidAt
    };

    await saveJsonFile(MARKETPLACE_PATH, market);
    return Response.json({ ok: true, upsell: market.upsellBySourceSessionId[sourceSessionId] });
  }

  const leadKey = clean(session?.metadata?.leadKey || '');
  if (!leadKey) {
    return Response.json({ ok: false, error: 'missing_lead_key' }, { status: 400 });
  }

  const existing = market?.soldByLeadId?.[leadKey];

  if (existing?.stripeSessionId && existing.stripeSessionId === session.id) {
    return Response.json({ ok: true, idempotent: true });
  }

  const soldPayload = {
    leadKey,
    buyerName: clean(session?.metadata?.buyerName || ''),
    buyerEmail: clean(session?.metadata?.buyerEmail || (session?.customer_details?.email || '')).toLowerCase(),
    buyerRole: clean(session?.metadata?.buyerRole || 'agent'),
    tier: clean(session?.metadata?.tier || ''),
    state: clean(session?.metadata?.state || ''),
    engagement: clean(session?.metadata?.engagement || ''),
    leadApplicant: clean(session?.metadata?.leadApplicant || ''),
    leadPhone: clean(session?.metadata?.leadPhone || ''),
    leadEmail: clean(session?.metadata?.leadEmail || ''),
    stripeSessionId: clean(session?.id || ''),
    stripePaymentIntent: clean(session?.payment_intent || ''),
    paymentStatus: clean(session?.payment_status || 'paid'),
    amountTotalUsd: Number(session?.amount_total || 0) / 100,
    paidAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  if (!existing) {
    market.soldByLeadId[leadKey] = soldPayload;
    await saveJsonFile(MARKETPLACE_PATH, market);
  }

  const emailResult = await sendBuyerReceiptEmail(soldPayload);

  return Response.json({ ok: true, email: emailResult });
}
