import { loadJsonFile, saveJsonFile } from '../../../../lib/blobJsonStore';

const STORE_PATH = 'stores/linkleads-profiles.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalizeEmail(v = '') {
  return clean(v).toLowerCase();
}

function safeObject(v, fallback = {}) {
  return v && typeof v === 'object' ? v : fallback;
}

function normalizeStore(raw = {}) {
  const next = safeObject(raw, {});
  return next;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const email = normalizeEmail(searchParams.get('email'));
  if (!email) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });

  const store = normalizeStore(await loadJsonFile(STORE_PATH, {}));
  const profile = safeObject(store[email], null);
  return Response.json({ ok: true, profile: profile || null });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);
  if (!email) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });

  const store = normalizeStore(await loadJsonFile(STORE_PATH, {}));
  const prev = safeObject(store[email], {});
  const now = new Date().toISOString();

  const setup = safeObject(body?.setup, prev.setup || {});
  const marketFilters = safeObject(body?.marketFilters, prev.marketFilters || {});
  const orderPrefs = safeObject(body?.orderPrefs, prev.orderPrefs || {});

  const next = {
    ...prev,
    email,
    setup,
    marketFilters,
    orderPrefs,
    updatedAt: now,
    createdAt: clean(prev.createdAt) || now
  };

  store[email] = next;
  await saveJsonFile(STORE_PATH, store);

  return Response.json({ ok: true, profile: next });
}
