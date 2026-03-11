import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/inner-circle-hub-daily.json';

function clean(v = '') { return String(v || '').trim(); }
function nowIso() { return new Date().toISOString(); }
function toNum(v = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}
function toBool(v) { return Boolean(v); }

function rowAppTotal(r = {}) {
  const sponsorshipApps = toNum(r?.sponsorshipApps);
  const fngSubmittedApps = toNum(r?.fngSubmittedApps);
  const legacyApps = toNum(r?.apps);
  return sponsorshipApps + fngSubmittedApps + legacyApps;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const memberId = clean(searchParams.get('memberId') || '');
  const email = clean(searchParams.get('email') || '').toLowerCase();

  if (!memberId && !email) {
    return Response.json({ ok: false, error: 'missing_member_id_or_email' }, { status: 400 });
  }

  const rows = await loadJsonStore(STORE_PATH, []);
  const filtered = (rows || [])
    .filter((r) => {
      const rMember = clean(r?.memberId);
      const rEmail = clean(r?.email).toLowerCase();
      return (memberId && rMember === memberId) || (email && rEmail === email);
    })
    .sort((a, b) => clean(b?.dateKey).localeCompare(clean(a?.dateKey)) || clean(b?.updatedAt).localeCompare(clean(a?.updatedAt)));

  const totals = filtered.reduce((acc, r) => ({
    calls: acc.calls + toNum(r?.calls),
    texts: acc.texts + toNum(r?.texts),
    followUps: acc.followUps + toNum(r?.followUps),
    bookings: acc.bookings + toNum(r?.bookings),
    sponsorshipApps: acc.sponsorshipApps + toNum(r?.sponsorshipApps),
    fngSubmittedApps: acc.fngSubmittedApps + toNum(r?.fngSubmittedApps),
    appsTotal: acc.appsTotal + rowAppTotal(r)
  }), { calls: 0, texts: 0, followUps: 0, bookings: 0, sponsorshipApps: 0, fngSubmittedApps: 0, appsTotal: 0 });

  return Response.json({ ok: true, rows: filtered.slice(0, 31), totals });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = clean(body?.action || 'upsert').toLowerCase();
  if (action !== 'upsert') {
    return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
  }

  const memberId = clean(body?.memberId || '');
  const email = clean(body?.email || '').toLowerCase();
  const dateKey = clean(body?.dateKey || '');

  if ((!memberId && !email) || !dateKey) {
    return Response.json({ ok: false, error: 'missing_required_fields' }, { status: 400 });
  }

  const rows = await loadJsonStore(STORE_PATH, []);
  const idx = rows.findIndex((r) => clean(r?.dateKey) === dateKey && (
    (memberId && clean(r?.memberId) === memberId) ||
    (email && clean(r?.email).toLowerCase() === email)
  ));

  const base = idx >= 0 ? rows[idx] : { id: `icd_${Date.now()}`, createdAt: nowIso() };
  const next = {
    ...base,
    memberId: memberId || clean(base?.memberId),
    email: email || clean(base?.email).toLowerCase(),
    dateKey,
    calls: toNum(body?.calls),
    texts: toNum(body?.texts),
    followUps: toNum(body?.followUps),
    bookings: toNum(body?.bookings),
    sponsorshipApps: toNum(body?.sponsorshipApps),
    fngSubmittedApps: toNum(body?.fngSubmittedApps),
    notes: clean(body?.notes),
    checklist: {
      workNewLeads: toBool(body?.checklist?.workNewLeads),
      followUpWarmLeads: toBool(body?.checklist?.followUpWarmLeads),
      bookOneConversation: toBool(body?.checklist?.bookOneConversation),
      postContent: toBool(body?.checklist?.postContent),
      updateTracker: toBool(body?.checklist?.updateTracker)
    },
    updatedAt: nowIso()
  };

  if (idx >= 0) rows[idx] = next;
  else rows.unshift(next);
  await saveJsonStore(STORE_PATH, rows);

  return Response.json({ ok: true, row: next });
}
