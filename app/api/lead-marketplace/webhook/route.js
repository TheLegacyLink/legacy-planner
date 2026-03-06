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
    soldByLeadId: raw?.soldByLeadId && typeof raw.soldByLeadId === 'object' ? raw.soldByLeadId : {}
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
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 10px">✅ Lead Purchase Confirmed</h2>
      <p><strong>Congrats ${buyerName}</strong> — your lead purchase is confirmed.</p>

      <h3 style="margin-bottom:6px">Receipt</h3>
      <ul>
        <li><strong>Lead:</strong> ${leadName}</li>
        <li><strong>Tier:</strong> ${tier}</li>
        <li><strong>Amount:</strong> $${amount}</li>
        <li><strong>Purchased At:</strong> ${paidAt}</li>
        <li><strong>Stripe Session:</strong> ${clean(payload?.stripeSessionId || '')}</li>
      </ul>

      <h3 style="margin-bottom:6px">Lead Details</h3>
      <ul>
        <li><strong>Name:</strong> ${leadName}</li>
        <li><strong>Phone:</strong> ${clean(payload?.leadPhone || 'N/A')}</li>
        <li><strong>Email:</strong> ${clean(payload?.leadEmail || 'N/A')}</li>
        <li><strong>State:</strong> ${state}</li>
        <li><strong>Engagement:</strong> ${engagement}</li>
      </ul>

      <h3 style="margin-bottom:6px">Call Script (Approved Lead)</h3>
      <ol>
        <li><strong>Opener:</strong> ${script.callOpener}</li>
        <li><strong>Bridge Question:</strong> ${script.bridge}</li>
        <li><strong>Booking Close:</strong> ${script.close}</li>
        <li><strong>No-Answer Text:</strong> ${script.noAnswerText}</li>
      </ol>

      <h3 style="margin-bottom:6px">Execution Standard</h3>
      <ul>
        <li>Call in 5 minutes or less</li>
        <li>Minimum 5–7 attempts</li>
        <li>Log all outcomes in CRM</li>
      </ul>
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
  const leadKey = clean(session?.metadata?.leadKey || '');
  if (!leadKey) {
    return Response.json({ ok: false, error: 'missing_lead_key' }, { status: 400 });
  }

  const rawMarket = await loadJsonFile(MARKETPLACE_PATH, {});
  const market = normalizeStore(rawMarket);
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
