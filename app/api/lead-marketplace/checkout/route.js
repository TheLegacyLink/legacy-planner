import { loadJsonFile, loadJsonStore } from '../../../../lib/blobJsonStore';

const APPLICATIONS_PATH = 'stores/sponsorship-applications.json';
const BOOKINGS_PATH = 'stores/sponsorship-bookings.json';
const CALLER_LEADS_PATH = 'stores/caller-leads.json';
const MARKETPLACE_PATH = 'stores/lead-marketplace.json';

const DEFAULT_SETTINGS = {
  sponsorshipTier1Price: 50,
  sponsorshipTier2Price: 89,
  marketplaceOwnerTag: 'link'
};

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
      ...DEFAULT_SETTINGS,
      ...(raw?.settings || {})
    },
    engagementByLeadId: raw?.engagementByLeadId && typeof raw.engagementByLeadId === 'object' ? raw.engagementByLeadId : {},
    soldByLeadId: raw?.soldByLeadId && typeof raw.soldByLeadId === 'object' ? raw.soldByLeadId : {},
    hiddenLeadKeys: raw?.hiddenLeadKeys && typeof raw.hiddenLeadKeys === 'object' ? raw.hiddenLeadKeys : {}
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
      state: clean(app?.state)
    };

    const dedupeKey = `${normalize(row.applicant)}|${normalize(row.email)}|${normalize(row.phone)}`;
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    list.push(row);
  }

  return list;
}

function isOlderThanDays(iso = '', days = 14) {
  const t = new Date(iso || 0).getTime();
  if (!t) return false;
  return Date.now() - t >= days * 24 * 60 * 60 * 1000;
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
  const settings = market?.settings || DEFAULT_SETTINGS;
  const engagement = market?.engagementByLeadId || {};
  const soldByLeadId = market?.soldByLeadId || {};
  const hiddenLeadKeys = market?.hiddenLeadKeys || {};

  return (rows || []).map((row) => {
    const key = leadKey(row);
    const replied = engagement[key] === 'replied' || autoEngagementByLeadId[key] === 'replied';
    const sold = soldByLeadId[key] || null;

    const tier = replied ? 'tier2' : 'tier1';
    const basePrice = tier === 'tier2' ? Number(settings.sponsorshipTier2Price || 89) : Number(settings.sponsorshipTier1Price || 50);
    const oldLeadDiscounted = tier === 'tier1' && isOlderThanDays(row.approvedAt, 14);
    const price = oldLeadDiscounted ? 25 : basePrice;

    return {
      ...row,
      key,
      tier,
      engagement: replied ? 'Replied' : 'No Reply',
      price,
      oldLeadDiscounted,
      sold,
      hidden: Boolean(hiddenLeadKeys[key])
    };
  }).filter((r) => !r.hidden);
}

export async function POST(req) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return Response.json({ ok: false, error: 'missing_stripe_secret_key' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const requestedLeadKey = clean(body?.leadKey);
  const buyerName = clean(body?.buyerName);
  const buyerEmail = clean(body?.buyerEmail).toLowerCase();
  const buyerRole = clean(body?.buyerRole || 'agent');

  if (!requestedLeadKey) {
    return Response.json({ ok: false, error: 'missing_lead_key' }, { status: 400 });
  }

  if (!buyerName) {
    return Response.json({ ok: false, error: 'missing_buyer_name' }, { status: 400 });
  }

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
  const row = rows.find((r) => r.key === requestedLeadKey);

  if (!row) {
    return Response.json({ ok: false, error: 'lead_not_found' }, { status: 404 });
  }

  if (row.sold) {
    return Response.json({ ok: false, error: 'lead_already_sold' }, { status: 409 });
  }

  const amount = Math.max(1, Math.round(Number(row.price || 0) * 100));
  const origin = clean(body?.origin) || clean(req.headers.get('origin') || '') || clean(process.env.NEXT_PUBLIC_APP_URL) || 'https://innercirclelink.com';

  const successUrl = `${origin}/lead-marketplace/offer?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/lead-marketplace?checkout=cancel`;

  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: buyerEmail || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amount,
          product_data: {
            name: 'Sponsorship Lead',
            description: `${row.state || 'Unknown State'} • ${row.engagement}`
          }
        }
      }
    ],
    metadata: {
      leadKey: row.key,
      buyerName,
      buyerEmail,
      buyerRole,
      tier: row.tier,
      state: clean(row.state || ''),
      amountUsd: String(row.price || ''),
      engagement: clean(row.engagement || ''),
      leadApplicant: clean(row.applicant || ''),
      leadPhone: clean(row.phone || ''),
      leadEmail: clean(row.email || '')
    }
  });

  return Response.json({ ok: true, url: session.url, sessionId: session.id });
}
