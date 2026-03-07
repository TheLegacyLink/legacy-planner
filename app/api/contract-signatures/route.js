import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/contract-signatures.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalizeEmail(v = '') {
  return clean(v).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const email = normalizeEmail(searchParams.get('email') || '');
  if (!email) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const row = list.find((r) => normalizeEmail(r?.email) === email) || null;

  return Response.json({ ok: true, signed: Boolean(row?.signedAt), row });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const token = clean(body?.adminToken || '');
  const required = clean(process.env.CONTRACT_ADMIN_TOKEN || '');
  if (!required || token !== required) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const email = normalizeEmail(body?.email || '');
  if (!email) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => normalizeEmail(r?.email) === email);

  const row = {
    email,
    name: clean(body?.name || ''),
    envelopeId: clean(body?.envelopeId || ''),
    signedAt: clean(body?.signedAt || nowIso()),
    source: clean(body?.source || 'manual_admin'),
    updatedAt: nowIso(),
    createdAt: idx >= 0 ? clean(list[idx]?.createdAt || nowIso()) : nowIso()
  };

  if (idx >= 0) list[idx] = row;
  else list.push(row);

  await saveJsonStore(STORE_PATH, list);
  return Response.json({ ok: true, row });
}
