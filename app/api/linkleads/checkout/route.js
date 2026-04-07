import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';

const CHECKOUT_PROFILES_PATH = 'stores/linkleads-checkout-profiles.json';

function clean(v = '') {
  return String(v || '').trim();
}

function slugify(v = '') {
  return clean(v)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ORDER_MENU = {
  veterans: { label: 'Veterans Leads', unitPrice: 31.5, minQty: 20 },
  'final-expense': { label: 'Final Expense Leads', unitPrice: 20.7, minQty: 20 },
  iul: { label: 'IUL Leads', unitPrice: 34.2, minQty: 20 },
  'mortgage-protection': { label: 'Mortgage Protection Leads', unitPrice: 38.1, minQty: 20 },
  spanish: { label: 'Spanish Leads', unitPrice: 38.1, minQty: 20 },
  trucker: { label: 'Trucker Leads', unitPrice: 45, minQty: 20 },
  'health-under-65': { label: 'Health Leads (Under 65)', unitPrice: 42, minQty: 20 },
  sponsor: { label: 'Recruiting Leads', unitPrice: 31.25, minQty: 15 }
};

const LEAD_PACKAGE_PRICING = {
  veterans: { standard: 24, blended: 31.5, premium: 54 },
  'final-expense': { standard: 18, blended: 20.7, premium: 28.8 },
  iul: { standard: 30, blended: 34.2, premium: 49.2 },
  'mortgage-protection': { standard: 32.4, blended: 38.1, premium: 57.6 },
  spanish: { standard: 32.4, blended: 38.1, premium: 57.6 },
  trucker: { standard: 38.4, blended: 45, premium: 67.2 },
  'health-under-65': { standard: 42, blended: 42, premium: 42 },
  sponsor: { standard: 25, blended: 31.25, premium: 41 }
};

function packageUnitPrice(leadType = '', pkg = 'blended', fallback = 0) {
  const row = LEAD_PACKAGE_PRICING[String(leadType || '').toLowerCase()] || null;
  const price = Number(row?.[pkg]);
  if (Number.isFinite(price) && price > 0) return price;
  const fb = Number(fallback || 0);
  return Number.isFinite(fb) ? fb : 0;
}

export async function POST(req) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return Response.json({ ok: false, error: 'missing_stripe_secret_key' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const leadType = clean(body?.leadType || '').toLowerCase();
  const item = ORDER_MENU[leadType];
  if (!item) {
    return Response.json({ ok: false, error: 'invalid_lead_type' }, { status: 400 });
  }

  const leadPackage = clean(body?.leadPackage || 'blended').toLowerCase();
  const normalizedLeadPackage = ['standard', 'blended', 'premium'].includes(leadPackage) ? leadPackage : 'blended';

  const qtyRaw = Number(body?.quantity || 0);
  const steppedQty = Math.ceil((Number.isFinite(qtyRaw) ? qtyRaw : item.minQty) / 5) * 5;
  const quantity = Math.max(item.minQty, steppedQty);

  const buyerName = clean(body?.buyerName);
  const buyerEmail = clean(body?.buyerEmail).toLowerCase();
  const buyerNpn = clean(body?.buyerNpn);
  const targetState = clean(body?.targetState || 'all');
  const subscriptionWeekly = String(body?.subscriptionWeekly) === 'true' || body?.subscriptionWeekly === true;
  const subscriptionDiscountPct = subscriptionWeekly ? Math.max(0, Math.min(50, Number(body?.subscriptionDiscountPct || 0))) : 0;
  const policyAccepted = String(body?.policyAccepted) === 'true' || body?.policyAccepted === true;
  const policyAcceptedAt = clean(body?.policyAcceptedAt || new Date().toISOString());
  const firstTimeSetup = body?.firstTimeSetup && typeof body.firstTimeSetup === 'object' ? body.firstTimeSetup : {};
  const digitalSignature = body?.digitalSignature && typeof body.digitalSignature === 'object' ? body.digitalSignature : {};
  if (!buyerName || !buyerEmail) {
    return Response.json({ ok: false, error: 'missing_buyer_details' }, { status: 400 });
  }
  if (!policyAccepted) {
    return Response.json({ ok: false, error: 'policy_not_accepted' }, { status: 400 });
  }

  const signatureDataUrl = clean(digitalSignature?.dataUrl || '');
  if (!signatureDataUrl) {
    return Response.json({ ok: false, error: 'missing_digital_signature' }, { status: 400 });
  }

  const setupDailyCap = Number(firstTimeSetup?.dailyLeadCap || 0);
  const setupValid = clean(firstTimeSetup?.firstName)
    && clean(firstTimeSetup?.lastName)
    && clean(firstTimeSetup?.email)
    && clean(firstTimeSetup?.phone)
    && clean(firstTimeSetup?.dateOfBirth)
    && clean(firstTimeSetup?.npnId)
    && Array.isArray(firstTimeSetup?.licensedStates)
    && firstTimeSetup.licensedStates.length > 0
    && Number.isFinite(setupDailyCap)
    && setupDailyCap >= 5;

  if (!setupValid) {
    return Response.json({ ok: false, error: 'setup_incomplete' }, { status: 400 });
  }

  const packagePriceUsd = packageUnitPrice(leadType, normalizedLeadPackage, Number(item.unitPrice || 0));
  const baseUnitAmount = Math.max(1, Math.round(packagePriceUsd * 100));
  const discountedUnitAmount = subscriptionWeekly
    ? Math.max(1, Math.round(baseUnitAmount * (1 - (subscriptionDiscountPct / 100))))
    : baseUnitAmount;
  const unitAmount = discountedUnitAmount;
  const totalUsd = (unitAmount * quantity) / 100;

  const origin = clean(body?.origin) || clean(req.headers.get('origin') || '') || clean(process.env.NEXT_PUBLIC_APP_URL) || 'https://innercirclelink.com';
  const successUrl = `${origin}/linkleads/order-builder?checkout=success&view=profile`;
  const cancelUrl = `${origin}/linkleads/order-builder?checkout=cancel`;

  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

  const metadata = {
    type: 'linkleads_bulk_order',
    leadType,
    leadLabel: item.label,
    quantity: String(quantity),
    leadPackage: normalizedLeadPackage,
    unitPriceUsd: String(packagePriceUsd),
    effectiveUnitPriceUsd: String((unitAmount / 100).toFixed(2)),
    subscriptionWeekly: subscriptionWeekly ? 'true' : 'false',
    subscriptionDiscountPct: String(subscriptionDiscountPct || 0),
    subtotalUsd: String(totalUsd),
    pricingMode: 'flat_no_tax',
    buyerName,
    buyerEmail,
    buyerNpn,
    targetState,
    policyAccepted: 'true',
    policyAcceptedAt,
    setupLicensedStatesCount: String(Array.isArray(firstTimeSetup?.licensedStates) ? firstTimeSetup.licensedStates.length : 0),
    setupDailyLeadCap: clean(firstTimeSetup?.dailyLeadCap || '-'),
    setupTimeZone: clean(firstTimeSetup?.timeZone || ''),
    digitalSignatureCaptured: signatureDataUrl ? 'true' : 'false',
    signatureIpAddress: clean(digitalSignature?.ipAddress || ''),
    etaHours: '48'
  };

  const session = await stripe.checkout.sessions.create({
    mode: subscriptionWeekly ? 'subscription' : 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    automatic_tax: { enabled: false },
    tax_id_collection: { enabled: false },
    customer_email: buyerEmail || undefined,
    line_items: [
      {
        quantity,
        price_data: {
          currency: 'usd',
          unit_amount: unitAmount,
          ...(subscriptionWeekly ? { recurring: { interval: 'week' } } : {}),
          product_data: {
            name: item.label,
            description: `Link Leads order${subscriptionWeekly ? ' • weekly subscription billing enabled' : ''}${subscriptionWeekly ? ' • 12% weekly discount applied' : ''} • setup begins immediately • delivery window up to 48 hours`
          }
        }
      }
    ],
    ...(subscriptionWeekly ? { subscription_data: { metadata } } : {}),
    metadata
  });

  const existing = await loadJsonStore(CHECKOUT_PROFILES_PATH, []);
  const row = {
    stripeSessionId: clean(session?.id || ''),
    buyerEmail,
    buyerName,
    buyerNpn,
    targetState,
    leadPackage: normalizedLeadPackage,
    subscriptionWeekly,
    subscriptionDiscountPct,
    agentSlug: slugify(`${firstTimeSetup?.firstName || ''} ${firstTimeSetup?.lastName || ''}`) || slugify(buyerEmail.split('@')[0] || ''),
    firstTimeSetup,
    digitalSignature: {
      dataUrl: signatureDataUrl,
      ipAddress: clean(digitalSignature?.ipAddress || ''),
      signedAt: clean(digitalSignature?.signedAt || new Date().toISOString())
    },
    createdAt: new Date().toISOString()
  };
  await saveJsonStore(CHECKOUT_PROFILES_PATH, [...existing.filter((r) => clean(r?.stripeSessionId) !== row.stripeSessionId), row]);

  return Response.json({ ok: true, url: session.url, sessionId: session.id });
}
