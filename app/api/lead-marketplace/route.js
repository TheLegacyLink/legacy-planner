import { loadJsonFile, loadJsonStore, saveJsonFile } from '../../../lib/blobJsonStore';

const APPLICATIONS_PATH = 'stores/sponsorship-applications.json';
const BOOKINGS_PATH = 'stores/sponsorship-bookings.json';
const MARKETPLACE_PATH = 'stores/lead-marketplace.json';

const DEFAULT_SETTINGS = {
  sponsorshipTier1Price: 50,
  sponsorshipTier2Price: 89,
  termLifeTier1Price: '',
  termLifeTier2Price: '',
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

function maskName(value = '') {
  const parts = clean(value).split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Private Lead';
  return parts.map((p) => `${p[0]}${'*'.repeat(Math.max(2, p.length - 1))}`).join(' ');
}

function maskEmail(value = '') {
  const email = clean(value).toLowerCase();
  if (!email.includes('@')) return 'p***@***.com';
  const [left, right] = email.split('@');
  const first = left?.[0] || 'p';
  const domainParts = String(right || '***.com').split('.');
  const tld = domainParts.length > 1 ? domainParts[domainParts.length - 1] : 'com';
  return `${first}***@***.${tld}`;
}

function maskPhone(value = '') {
  const digits = clean(value).replace(/\D/g, '');
  if (!digits) return '***-***-****';
  return `${digits.slice(0, 3).padEnd(3, '*')}-***-****`;
}

function normalizeStore(raw = {}) {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(raw?.settings || {})
  };

  return {
    settings,
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

function isOlderThanDays(iso = '', days = 14) {
  const t = new Date(iso || 0).getTime();
  if (!t) return false;
  return Date.now() - t >= days * 24 * 60 * 60 * 1000;
}

function withTier(rows = [], market = {}) {
  const settings = market?.settings || DEFAULT_SETTINGS;
  const engagement = market?.engagementByLeadId || {};
  const soldByLeadId = market?.soldByLeadId || {};
  const hiddenLeadKeys = market?.hiddenLeadKeys || {};

  return (rows || []).map((row) => {
    const key = leadKey(row);
    const replied = engagement[key] === 'replied';
    const sold = soldByLeadId[key] || null;

    const tier = replied ? 'tier2' : 'tier1';
    const basePrice = tier === 'tier2' ? Number(settings.sponsorshipTier2Price || 89) : Number(settings.sponsorshipTier1Price || 50);
    const oldLeadDiscounted = tier === 'tier1' && isOlderThanDays(row.approvedAt, 14);
    const price = oldLeadDiscounted ? 25 : basePrice;

    return {
      ...row,
      key,
      engagement: replied ? 'Replied' : 'No Reply',
      tier,
      price,
      oldLeadDiscounted,
      sold,
      hidden: Boolean(hiddenLeadKeys[key])
    };
  }).filter((r) => !r.hidden);
}

function soldBelongsToViewer(sold = {}, viewer = {}) {
  if (!sold) return false;
  const buyerEmail = normalize(sold?.buyerEmail || '');
  const buyerName = normalize(sold?.buyerName || '');
  const viewerEmail = normalize(viewer?.email || '');
  const viewerName = normalize(viewer?.name || '');

  return (buyerEmail && viewerEmail && buyerEmail === viewerEmail) || (buyerName && viewerName && buyerName === viewerName);
}

function projectAgentRow(row = {}, viewer = {}) {
  const sold = row?.sold || null;
  const hasSoldRecord = Boolean(sold);

  const soldToViewer = hasSoldRecord && soldBelongsToViewer(sold, viewer);

  const soldToOther = hasSoldRecord && !soldToViewer;
  const unlocked = soldToViewer;

  const base = {
    key: row.key,
    state: clean(row.state || '—'),
    engagement: row.engagement,
    tier: row.tier,
    price: row.price,
    approvedAt: row.approvedAt,
    sold: hasSoldRecord,
    soldAt: sold?.paidAt || sold?.createdAt || '',
    soldToViewer,
    soldToOther,
    soldLabel: soldToViewer ? 'Purchased' : soldToOther ? 'Sold' : 'Available',
    canPurchase: !hasSoldRecord,
    unlocked
  };

  if (unlocked) {
    return {
      ...base,
      applicant: row.applicant,
      email: row.email,
      phone: row.phone
    };
  }

  return {
    ...base,
    applicant: maskName(row.applicant),
    email: maskEmail(row.email),
    phone: maskPhone(row.phone),
    unlocked: false
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const viewer = {
    name: clean(searchParams.get('viewerName') || ''),
    email: clean(searchParams.get('viewerEmail') || ''),
    role: clean(searchParams.get('viewerRole') || '')
  };

  const [apps, bookings, rawMarket] = await Promise.all([
    loadJsonStore(APPLICATIONS_PATH, []),
    loadJsonStore(BOOKINGS_PATH, []),
    loadJsonFile(MARKETPLACE_PATH, {})
  ]);

  const market = normalizeStore(rawMarket);
  const baseRows = buildApprovedNotBooked(apps, bookings, market?.settings?.marketplaceOwnerTag || 'link');
  const rows = withTier(baseRows, market);

  const agentRowsBase = rows
    .map((r) => projectAgentRow(r, viewer))
    .filter((r) => !r.soldToOther);

  const existingKeys = new Set(agentRowsBase.map((r) => r.key));
  const purchasedRowsFromStore = Object.entries(market?.soldByLeadId || {})
    .filter(([leadKey, sold]) => !existingKeys.has(leadKey) && soldBelongsToViewer(sold, viewer))
    .map(([leadKey, sold]) => ({
      key: leadKey,
      state: clean(sold?.state || '—'),
      engagement: clean(sold?.engagement || 'No Reply'),
      tier: clean(sold?.tier || 'tier1'),
      price: Number(sold?.amountTotalUsd || 0) || Number((market?.settings?.sponsorshipTier1Price || 50)),
      approvedAt: clean(sold?.paidAt || sold?.createdAt || ''),
      sold: true,
      soldAt: clean(sold?.paidAt || sold?.createdAt || ''),
      soldToViewer: true,
      soldToOther: false,
      soldLabel: 'Purchased',
      canPurchase: false,
      unlocked: true,
      applicant: clean(sold?.leadApplicant || 'Purchased Lead'),
      email: clean(sold?.leadEmail || 'N/A'),
      phone: clean(sold?.leadPhone || 'N/A')
    }));

  const agentRows = [...agentRowsBase, ...purchasedRowsFromStore];

  return Response.json({
    ok: true,
    settings: market.settings,
    inventory: {
      total: rows.length,
      tier1: rows.filter((r) => r.tier === 'tier1').length,
      tier2: rows.filter((r) => r.tier === 'tier2').length,
      sold: rows.filter((r) => r.sold).length,
      available: rows.filter((r) => !r.sold).length
    },
    adminRows: rows,
    agentRows
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = normalize(body?.action || '');

  const rawMarket = await loadJsonFile(MARKETPLACE_PATH, {});
  const market = normalizeStore(rawMarket);

  if (action === 'set_settings') {
    const next = normalizeStore({
      ...market,
      settings: {
        ...market.settings,
        ...(body?.settings || {})
      }
    });

    await saveJsonFile(MARKETPLACE_PATH, next);
    return Response.json({ ok: true, settings: next.settings });
  }

  if (action === 'set_engagement') {
    const key = clean(body?.leadKey);
    const value = normalize(body?.engagement) === 'replied' ? 'replied' : 'no_reply';
    if (!key) return Response.json({ ok: false, error: 'missing_lead_key' }, { status: 400 });

    const next = {
      ...market,
      engagementByLeadId: {
        ...(market.engagementByLeadId || {}),
        [key]: value
      }
    };

    await saveJsonFile(MARKETPLACE_PATH, next);
    return Response.json({ ok: true, engagementByLeadId: next.engagementByLeadId });
  }

  if (action === 'hide_lead') {
    const key = clean(body?.leadKey);
    if (!key) return Response.json({ ok: false, error: 'missing_lead_key' }, { status: 400 });

    const next = {
      ...market,
      hiddenLeadKeys: {
        ...(market.hiddenLeadKeys || {}),
        [key]: {
          hiddenAt: new Date().toISOString(),
          hiddenBy: clean(body?.actorName || 'Admin')
        }
      }
    };

    await saveJsonFile(MARKETPLACE_PATH, next);
    return Response.json({ ok: true, hiddenLeadKeys: next.hiddenLeadKeys });
  }

  return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
}
