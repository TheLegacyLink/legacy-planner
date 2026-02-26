import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/bonus-bookings.json';

function clean(v = '') {
  return String(v || '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

async function getStore() {
  return await loadJsonStore(STORE_PATH, []);
}

async function writeStore(rows) {
  return await saveJsonStore(STORE_PATH, rows);
}

export async function GET() {
  const rows = await getStore();
  rows.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  return Response.json({ ok: true, rows });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const booking = body?.booking || body || {};
  const id = clean(booking?.id) || `bonus_${Date.now()}`;

  const next = {
    id,
    name: clean(booking?.name),
    state: clean(booking?.state).toUpperCase(),
    requested_at_est: clean(booking?.requested_at_est),
    notes: clean(booking?.notes),
    status: clean(booking?.status || 'Booked') || 'Booked',
    created_at: clean(booking?.created_at || nowIso())
  };

  const store = await getStore();
  const idx = store.findIndex((r) => clean(r.id) === id);
  if (idx >= 0) store[idx] = { ...store[idx], ...next };
  else store.unshift(next);

  await writeStore(store);
  return Response.json({ ok: true, row: next });
}

export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  const id = clean(body?.id);
  if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const store = await getStore();
  const idx = store.findIndex((r) => clean(r.id) === id);
  if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  const patch = body?.patch || {};
  store[idx] = {
    ...store[idx],
    status: patch.status != null ? clean(patch.status) : store[idx].status,
    notes: patch.notes != null ? clean(patch.notes) : store[idx].notes
  };

  await writeStore(store);
  return Response.json({ ok: true, row: store[idx] });
}
