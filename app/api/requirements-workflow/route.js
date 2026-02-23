import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/requirements-workflow.json';

function clean(v = '') {
  return String(v || '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

export async function GET() {
  const rows = await loadJsonStore(STORE_PATH, {});
  return Response.json({ ok: true, rows: rows || {} });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const policyNumber = clean(body?.policyNumber).toUpperCase();
  const patch = body?.patch && typeof body.patch === 'object' ? body.patch : null;

  if (!policyNumber || !patch) {
    return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const store = await loadJsonStore(STORE_PATH, {});
  const prev = store[policyNumber] || {};

  const next = {
    ...prev,
    ...patch,
    policyNumber,
    updatedAt: nowIso()
  };

  store[policyNumber] = next;
  await saveJsonStore(STORE_PATH, store);

  return Response.json({ ok: true, row: next });
}
