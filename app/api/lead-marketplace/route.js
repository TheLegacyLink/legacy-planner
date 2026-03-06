import { loadJsonFile, loadJsonStore, saveJsonFile } from '../../../lib/blobJsonStore';

const APPLICATIONS_PATH = 'stores/sponsorship-applications.json';
const BOOKINGS_PATH = 'stores/sponsorship-bookings.json';
const MARKETPLACE_PATH = 'stores/lead-marketplace.json';

const DEFAULT_SETTINGS = {
  sponsorshipTier1Price: 50,
  sponsorshipTier2Price: 89,
  termLifeTier1Price: '',
  termLifeTier2Price: ''
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
    engagementByLeadId: raw?.engagementByLeadId && typeof raw.engagementByLeadId === 'object' ? raw.engagementByLeadId : {}
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
      state: clean(app?.state),
      approvedAt: clean(app?.reviewedAt || app?.updatedAt || app?.submitted_at || ''),
      referredBy: clean(app?.referralName || app?.referred_by || app?.refCode || '')
    };

    const dedupeKey = `${normalize(row.applicant)}|${normalize(row.email)}|${normalize(row.phone)}`;
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    list.push(row);
  }

  return list.sort((a, b) => new Date(b.approvedAt || 0).getTime() - new Date(a.approvedAt || 0).getTime());
}

function withTier(rows = [], market = {}) {
  const settings = market?.settings || DEFAULT_SETTINGS;
  const engagement = market?.engagementByLeadId || {};

  return (rows || []).map((row) => {
    const key = leadKey(row);
    const replied = engagement[key] === 'replied';
    return {
      ...row,
      key,
      engagement: replied ? 'Replied' : 'No Reply',
      tier: replied ? 'tier2' : 'tier1',
      price: replied ? Number(settings.sponsorshipTier2Price || 89) : Number(settings.sponsorshipTier1Price || 50)
    };
  });
}

export async function GET() {
  const [apps, bookings, rawMarket] = await Promise.all([
    loadJsonStore(APPLICATIONS_PATH, []),
    loadJsonStore(BOOKINGS_PATH, []),
    loadJsonFile(MARKETPLACE_PATH, {})
  ]);

  const market = normalizeStore(rawMarket);
  const baseRows = buildApprovedNotBooked(apps, bookings);
  const rows = withTier(baseRows, market);

  return Response.json({
    ok: true,
    settings: market.settings,
    inventory: {
      total: rows.length,
      tier1: rows.filter((r) => r.tier === 'tier1').length,
      tier2: rows.filter((r) => r.tier === 'tier2').length
    },
    adminRows: rows,
    agentRows: rows.map((r) => ({
      key: r.key,
      state: clean(r.state || '—'),
      engagement: r.engagement,
      tier: r.tier,
      price: r.price,
      approvedAt: r.approvedAt,
      applicant: maskName(r.applicant),
      email: maskEmail(r.email),
      phone: maskPhone(r.phone)
    }))
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

  return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
}
