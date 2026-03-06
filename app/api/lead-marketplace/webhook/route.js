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

  if (!existing) {
    market.soldByLeadId[leadKey] = {
      leadKey,
      buyerName: clean(session?.metadata?.buyerName || ''),
      buyerEmail: clean(session?.metadata?.buyerEmail || (session?.customer_details?.email || '')).toLowerCase(),
      buyerRole: clean(session?.metadata?.buyerRole || 'agent'),
      tier: clean(session?.metadata?.tier || ''),
      state: clean(session?.metadata?.state || ''),
      stripeSessionId: clean(session?.id || ''),
      stripePaymentIntent: clean(session?.payment_intent || ''),
      paymentStatus: clean(session?.payment_status || 'paid'),
      amountTotalUsd: Number(session?.amount_total || 0) / 100,
      paidAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    await saveJsonFile(MARKETPLACE_PATH, market);
  }

  return Response.json({ ok: true });
}
