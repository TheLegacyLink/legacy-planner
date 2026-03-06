import { loadJsonFile, loadJsonStore } from '../../../../lib/blobJsonStore';

const APPLICATIONS_PATH = 'stores/sponsorship-applications.json';
const BOOKINGS_PATH = 'stores/sponsorship-bookings.json';
const MARKETPLACE_PATH = 'stores/lead-marketplace.json';

const DEFAULT_SETTINGS = {
  sponsorshipTier1Price: 50,
  sponsorshipTier2Price: 89
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
    soldByLeadId: raw?.soldByLeadId && typeof raw.soldByLeadId === 'object' ? raw.soldByLeadId : {}
  };
}

function buildApprovedNotBooked(apps = [], bookings = []) {
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

function withTier(rows = [], market = {}) {
  const settings = market?.settings || DEFAULT_SETTINGS;
  const engagement = market?.engagementByLeadId || {};
  const soldByLeadId = market?.soldByLeadId || {};

  return (rows || []).map((row) => {
    const key = leadKey(row);
    const replied = engagement[key] === 'replied';
    const sold = soldByLeadId[key] || null;

    return {
      ...row,
      key,
      tier: replied ? 'tier2' : 'tier1',
      engagement: replied ? 'Replied' : 'No Reply',
      price: replied ? Number(settings.sponsorshipTier2Price || 89) : Number(settings.sponsorshipTier1Price || 50),
      sold
    };
  });
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

  const [apps, bookings, rawMarket] = await Promise.all([
    loadJsonStore(APPLICATIONS_PATH, []),
    loadJsonStore(BOOKINGS_PATH, []),
    loadJsonFile(MARKETPLACE_PATH, {})
  ]);

  const market = normalizeStore(rawMarket);
  const rows = withTier(buildApprovedNotBooked(apps, bookings), market);
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
