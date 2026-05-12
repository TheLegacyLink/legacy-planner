import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/sponsorship-analytics.json';

async function getStore() {
  return await loadJsonStore(STORE_PATH, []);
}

async function writeStore(rows) {
  return await saveJsonStore(STORE_PATH, rows);
}

function clean(v = '') {
  return String(v || '').trim();
}

const TZ = 'America/Chicago';

function nowIso() {
  return new Date().toISOString();
}

function chicagoDateLabel(isoOrDate) {
  return new Date(isoOrDate).toLocaleDateString('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric'
  });
}

function chicagoMidnightIso(daysAgo = 0) {
  const label = new Date(Date.now() - daysAgo * 86400000)
    .toLocaleDateString('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const [m, d, y] = label.split('/');
  const chicagoMidnight = new Date(`${y}-${m}-${d}T00:00:00`);
  const utcOffset = new Date(chicagoMidnight.toLocaleString('en-US', { timeZone: TZ })).getTime() - chicagoMidnight.getTime();
  return new Date(chicagoMidnight.getTime() - utcOffset).toISOString();
}

function normalizeRef(ref = '') {
  const cleaned = clean(ref).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (cleaned === 'latricia_wright') return 'leticia_wright';
  return cleaned || 'kimora_link';
}

function refToName(ref = '') {
  const map = {
    kimora_link: 'Kimora Link',
    jamal_holmes: 'Jamal Holmes',
    mahogany_burns: 'Mahogany Burns',
    madalyn_adams: 'Madalyn Adams',
    kelin_brown: 'Kelin Brown',
    leticia_wright: 'Leticia Wright',
    letitia_wright: 'Leticia Wright',
    breanna_james: 'Breanna James',
    shannon_maxwell: 'Shannon Maxwell',
    donyell_richardson: 'Donyell Richardson',
    dr_brianna: 'Dr. Breanna James'
  };
  const key = normalizeRef(ref);
  return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// GET — return aggregated stats
export async function GET(req) {
  try {
    const rows = await getStore();
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const since = chicagoMidnightIso(days);
    const filtered = rows.filter((r) => r.timestamp >= since);

    // Aggregate by refCode
    const byRef = {};

    for (const evt of filtered) {
      const ref = normalizeRef(evt.refCode || '');
      if (!byRef[ref]) {
        byRef[ref] = {
          refCode: ref,
          agentName: refToName(ref),
          pageViews: 0,
          formStarts: 0,
          submissions: 0,
          lastActivity: null
        };
      }
      if (evt.event === 'page_view') byRef[ref].pageViews += 1;
      if (evt.event === 'form_start') byRef[ref].formStarts += 1;
      if (evt.event === 'form_submit') byRef[ref].submissions += 1;
      if (!byRef[ref].lastActivity || evt.timestamp > byRef[ref].lastActivity) {
        byRef[ref].lastActivity = evt.timestamp;
      }
    }

    const agentStats = Object.values(byRef).sort((a, b) => b.pageViews - a.pageViews);

    // Daily trend (last 14 days, capped)
    const trendDays = Math.min(days, 14);
    const trend = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const dayStartIso = chicagoMidnightIso(i);
      const dayEndIso = chicagoMidnightIso(i - 1);
      const label = chicagoDateLabel(dayStartIso);
      const dayEvts = filtered.filter((r) => r.timestamp >= dayStartIso && r.timestamp < dayEndIso);
      trend.push({
        label,
        pageViews: dayEvts.filter((e) => e.event === 'page_view').length,
        formStarts: dayEvts.filter((e) => e.event === 'form_start').length,
        submissions: dayEvts.filter((e) => e.event === 'form_submit').length
      });
    }

    const totals = {
      pageViews: filtered.filter((e) => e.event === 'page_view').length,
      formStarts: filtered.filter((e) => e.event === 'form_start').length,
      submissions: filtered.filter((e) => e.event === 'form_submit').length
    };

    return Response.json({ ok: true, totals, agentStats, trend, days, totalEvents: filtered.length });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// POST — record an event
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const event = clean(body.event || '');
    const validEvents = ['page_view', 'form_start', 'form_submit'];
    if (!validEvents.includes(event)) {
      return Response.json({ ok: false, error: 'invalid_event' }, { status: 400 });
    }

    const record = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      event,
      refCode: normalizeRef(body.refCode || ''),
      page: clean(body.page || ''),
      timestamp: nowIso()
    };

    const rows = await getStore();
    rows.push(record);

    // Keep last 10,000 events max
    const trimmed = rows.length > 10000 ? rows.slice(-10000) : rows;
    await writeStore(trimmed);

    return Response.json({ ok: true, id: record.id });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
