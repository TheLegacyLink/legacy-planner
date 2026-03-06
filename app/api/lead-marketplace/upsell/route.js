import { loadJsonFile, loadJsonStore, saveJsonFile } from '../../../../lib/blobJsonStore';

const APPLICATIONS_PATH = 'stores/sponsorship-applications.json';
const BOOKINGS_PATH = 'stores/sponsorship-bookings.json';
const CALLER_LEADS_PATH = 'stores/caller-leads.json';
const MARKETPLACE_PATH = 'stores/lead-marketplace.json';

const OFFER_AMOUNT_USD = 75;
const OFFER_LEAD_COUNT = 2;

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function isApprovedStatus(status = '') {
  return normalize(status).includes('approved');
}

function fullName(row = {}) {
  return clean(`${row.firstName || ''} ${row.lastName || ''}`);
}

function leadKey(row = {}) {
  const id = clean(row.id);
  if (id) return id;
  return `${normalize(row.applicant)}|${normalize(row.email)}|${normalize(row.phone)}`;
}

function normalizeStore(raw = {}) {
  return {
    settings: {
      sponsorshipTier1Price: 50,
      sponsorshipTier2Price: 89,
      marketplaceOwnerTag: 'link',
      ...(raw?.settings || {})
    },
    engagementByLeadId: raw?.engagementByLeadId && typeof raw.engagementByLeadId === 'object' ? raw.engagementByLeadId : {},
    soldByLeadId: raw?.soldByLeadId && typeof raw.soldByLeadId === 'object' ? raw.soldByLeadId : {},
    hiddenLeadKeys: raw?.hiddenLeadKeys && typeof raw.hiddenLeadKeys === 'object' ? raw.hiddenLeadKeys : {},
    upsellBySourceSessionId: raw?.upsellBySourceSessionId && typeof raw.upsellBySourceSessionId === 'object' ? raw.upsellBySourceSessionId : {}
  };
}

function isOwnedByMarketplace(app = {}, ownerTagRaw = 'link') {
  const ownerTag = normalize(ownerTagRaw || 'link');
  if (!ownerTag) return true;

  const referral = normalize(app?.referralName || app?.referred_by || app?.refCode || app?.referral_code || '');
  const reviewedBy = normalize(app?.reviewedBy || app?.assignedTo || app?.assigned_to || '');

  return referral.includes(ownerTag) || reviewedBy.includes(ownerTag);
}

function buildApprovedNotBooked(apps = [], bookings = [], ownerTag = 'link') {
  const bookingBySourceId = new Map();
  const bookingByName = new Map();

  for (const b of bookings || []) {
    const sourceId = clean(b?.source_application_id);
    if (sourceId) bookingBySourceId.set(sourceId, b);

    const name = normalize(b?.applicant_name);
    if (name && !bookingByName.has(name)) bookingByName.set(name, b);
  }

  const list = [];
  const seen = new Set();

  for (const app of apps || []) {
    if (!isApprovedStatus(app?.status)) continue;
    if (!isOwnedByMarketplace(app, ownerTag)) continue;

    const applicant = fullName(app);
    const sourceId = clean(app?.id);
    const hasBookingById = sourceId && bookingBySourceId.has(sourceId);
    const hasBookingByName = applicant && bookingByName.has(normalize(applicant));
    if (hasBookingById || hasBookingByName) continue;

    const row = {
      id: sourceId,
      applicant,
      email: clean(app?.email),
      phone: clean(app?.phone),
      state: clean(app?.state),
      approvedAt: clean(app?.reviewedAt || app?.updatedAt || app?.submitted_at || '')
    };

    const dedupeKey = `${normalize(row.applicant)}|${normalize(row.email)}|${normalize(row.phone)}`;
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    list.push(row);
  }

  return list.sort((a, b) => new Date(b.approvedAt || 0).getTime() - new Date(a.approvedAt || 0).getTime());
}

function normalizePhone(v = '') {
  return String(v || '').replace(/\D/g, '');
}

function isRepliedSignalFromCaller(row = {}) {
  const stage = normalize(row?.stage || '');
  const callResult = normalize(row?.callResult || row?.call_result || '');
  const direction = normalize(row?.callDirection || row?.direction || row?.event || row?.source || '');

  if (direction.includes('inbound') || direction === 'in') return true;
  if (callResult.includes('spoke') || callResult.includes('connected') || callResult.includes('replied')) return true;

  return ['connected', 'qualified', 'form completed', 'policy started', 'approved', 'onboarding started', 'moved forward'].includes(stage);
}

function buildAutoEngagementByLeadId(rows = [], callerRows = []) {
  const byEmail = new Map();
  const byPhone = new Map();
  const byName = new Map();

  for (const c of callerRows || []) {
    if (!isRepliedSignalFromCaller(c)) continue;

    const em = normalize(c?.email || '');
    const ph = normalizePhone(c?.phone || '');
    const nm = normalize(c?.name || `${c?.firstName || ''} ${c?.lastName || ''}`);

    if (em && !byEmail.has(em)) byEmail.set(em, true);
    if (ph && !byPhone.has(ph)) byPhone.set(ph, true);
    if (nm && !byName.has(nm)) byName.set(nm, true);
  }

  const out = {};
  for (const row of rows || []) {
    const key = leadKey(row);
    const em = normalize(row?.email || '');
    const ph = normalizePhone(row?.phone || '');
    const nm = normalize(row?.applicant || '');

    const replied = (em && byEmail.has(em)) || (ph && byPhone.has(ph)) || (nm && byName.has(nm));
    if (replied) out[key] = 'replied';
  }

  return out;
}

function withTier(rows = [], market = {}, autoEngagementByLeadId = {}) {
  const engagement = market?.engagementByLeadId || {};
  const soldByLeadId = market?.soldByLeadId || {};
  const hiddenLeadKeys = market?.hiddenLeadKeys || {};

  return (rows || []).map((row) => {
    const key = leadKey(row);
    const replied = engagement[key] === 'replied' || autoEngagementByLeadId[key] === 'replied';
    const sold = soldByLeadId[key] || null;

    return {
      ...row,
      key,
      tier: replied ? 'tier2' : 'tier1',
      engagement: replied ? 'Replied' : 'No Reply',
      sold,
      hidden: Boolean(hiddenLeadKeys[key])
    };
  }).filter((r) => !r.hidden);
}

function pickUpsellLeadKeys(rows = [], sourceLeadKey = '') {
  return rows
    .filter((r) => r.tier === 'tier1' && !r.sold && r.key !== sourceLeadKey)
    .slice(0, OFFER_LEAD_COUNT)
    .map((r) => r.key);
}

async function loadStripe(secretKey) {
  const { default: Stripe } = await import('stripe');
  return new Stripe(secretKey, { apiVersion: '2024-06-20' });
}

export async function POST(req) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return Response.json({ ok: false, error: 'missing_stripe_secret_key' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const action = normalize(body?.action || 'preview');
  const sourceSessionId = clean(body?.sourceSessionId || body?.sessionId || '');

  if (!sourceSessionId) {
    return Response.json({ ok: false, error: 'missing_source_session_id' }, { status: 400 });
  }

  const stripe = await loadStripe(secretKey);
  const sourceSession = await stripe.checkout.sessions.retrieve(sourceSessionId);

  if (!sourceSession?.id) {
    return Response.json({ ok: false, error: 'invalid_source_session' }, { status: 404 });
  }

  const sourceLeadKey = clean(sourceSession?.metadata?.leadKey || '');

  const [apps, bookings, callerLeads, rawMarket] = await Promise.all([
    loadJsonStore(APPLICATIONS_PATH, []),
    loadJsonStore(BOOKINGS_PATH, []),
    loadJsonStore(CALLER_LEADS_PATH, []),
    loadJsonFile(MARKETPLACE_PATH, {})
  ]);

  const market = normalizeStore(rawMarket);
  const baseRows = buildApprovedNotBooked(apps, bookings, market?.settings?.marketplaceOwnerTag || 'link');
  const autoEngagementByLeadId = buildAutoEngagementByLeadId(baseRows, callerLeads);
  const rows = withTier(baseRows, market, autoEngagementByLeadId);
  const offerLeadKeys = pickUpsellLeadKeys(rows, sourceLeadKey);

  if (action === 'preview') {
    return Response.json({
      ok: true,
      offer: {
        amountUsd: OFFER_AMOUNT_USD,
        leadCount: OFFER_LEAD_COUNT,
        availableCount: offerLeadKeys.length,
        canClaimNow: offerLeadKeys.length >= OFFER_LEAD_COUNT
      }
    });
  }

  if (action !== 'accept') {
    return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
  }

  if (market.upsellBySourceSessionId[sourceSessionId]) {
    return Response.json({ ok: true, idempotent: true, result: market.upsellBySourceSessionId[sourceSessionId] });
  }

  if (offerLeadKeys.length < OFFER_LEAD_COUNT) {
    return Response.json({ ok: false, error: 'insufficient_tier1_inventory' }, { status: 409 });
  }

  const customerId = clean(sourceSession?.customer || '');
  const sourcePaymentIntentId = clean(sourceSession?.payment_intent || '');

  async function createFallbackCheckout() {
    const origin = clean(body?.origin) || clean(req.headers.get('origin') || '') || clean(process.env.NEXT_PUBLIC_APP_URL) || 'https://innercirclelink.com';
    const successUrl = `${origin}/lead-marketplace?upsell=success`;
    const cancelUrl = `${origin}/lead-marketplace?upsell=cancel`;

    const fallbackSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer: customerId || undefined,
      customer_email: clean(sourceSession?.metadata?.buyerEmail || sourceSession?.customer_details?.email || '') || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: OFFER_AMOUNT_USD * 100,
            product_data: {
              name: `Limited-Time Upsell (${OFFER_LEAD_COUNT} Tier 1 Leads)`,
              description: 'Special post-purchase offer'
            }
          }
        }
      ],
      metadata: {
        type: 'marketplace_upsell_fallback',
        sourceSessionId,
        sourceLeadKey,
        offerLeadKeys: offerLeadKeys.join(','),
        buyerName: clean(sourceSession?.metadata?.buyerName || ''),
        buyerEmail: clean(sourceSession?.metadata?.buyerEmail || sourceSession?.customer_details?.email || ''),
        buyerRole: clean(sourceSession?.metadata?.buyerRole || 'agent')
      }
    });

    return Response.json({ ok: false, requiresCheckout: true, checkoutUrl: fallbackSession.url });
  }

  if (!customerId || !sourcePaymentIntentId) {
    return createFallbackCheckout();
  }

  const sourceIntent = await stripe.paymentIntents.retrieve(sourcePaymentIntentId);
  const paymentMethodId = clean(sourceIntent?.payment_method || '');
  if (!paymentMethodId) {
    return createFallbackCheckout();
  }

  try {
    const intent = await stripe.paymentIntents.create({
      amount: OFFER_AMOUNT_USD * 100,
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      metadata: {
        type: 'marketplace_upsell',
        sourceSessionId,
        sourceLeadKey,
        offerLeadCount: String(OFFER_LEAD_COUNT),
        offerAmountUsd: String(OFFER_AMOUNT_USD)
      }
    });

    const paidAt = new Date().toISOString();
    for (const leadKey of offerLeadKeys) {
      market.soldByLeadId[leadKey] = {
        leadKey,
        buyerName: clean(sourceSession?.metadata?.buyerName || ''),
        buyerEmail: clean(sourceSession?.metadata?.buyerEmail || sourceSession?.customer_details?.email || '').toLowerCase(),
        buyerRole: clean(sourceSession?.metadata?.buyerRole || 'agent'),
        tier: 'tier1',
        state: clean(rows.find((r) => r.key === leadKey)?.state || ''),
        engagement: clean(rows.find((r) => r.key === leadKey)?.engagement || 'No Reply'),
        leadApplicant: clean(rows.find((r) => r.key === leadKey)?.applicant || ''),
        leadPhone: clean(rows.find((r) => r.key === leadKey)?.phone || ''),
        leadEmail: clean(rows.find((r) => r.key === leadKey)?.email || ''),
        stripeSessionId: clean(sourceSessionId),
        stripePaymentIntent: clean(intent?.id || ''),
        paymentStatus: clean(intent?.status || 'succeeded'),
        amountTotalUsd: OFFER_AMOUNT_USD / OFFER_LEAD_COUNT,
        paidAt,
        createdAt: paidAt,
        source: 'upsell_offer'
      };
    }

    const result = {
      leadKeys: offerLeadKeys,
      amountUsd: OFFER_AMOUNT_USD,
      chargeId: clean(intent?.id || ''),
      paidAt
    };

    market.upsellBySourceSessionId[sourceSessionId] = result;
    await saveJsonFile(MARKETPLACE_PATH, market);

    return Response.json({ ok: true, result });
  } catch (error) {
    const code = clean(error?.code || '');
    const requiresAuth = code === 'authentication_required' || code === 'card_declined';

    if (requiresAuth) {
      return createFallbackCheckout();
    }

    return Response.json({ ok: false, error: error?.message || 'upsell_charge_failed' }, { status: 500 });
  }
}
