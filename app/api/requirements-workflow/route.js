import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/requirements-workflow.json';

function clean(v = '') {
  return String(v || '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

export async function GET() {
  const rows = await loadJsonFile(STORE_PATH, {});
  return Response.json({ ok: true, rows: rows && typeof rows === 'object' && !Array.isArray(rows) ? rows : {} });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const policyNumber = clean(body?.policyNumber).toUpperCase();
  const patch = body?.patch && typeof body.patch === 'object' ? body.patch : null;

  if (!policyNumber || !patch) {
    return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const loaded = await loadJsonFile(STORE_PATH, {});
  const store = loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? loaded : {};
  const prev = store[policyNumber] || {};

  const next = {
    ...prev,
    ...patch,
    policyNumber,
    updatedAt: nowIso()
  };

  store[policyNumber] = next;
  await saveJsonFile(STORE_PATH, store);

  return Response.json({ ok: true, row: next });
}
