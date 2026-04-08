import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STORE_PATH = 'stores/contract-signatures.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalizeEmail(v = '') {
  return clean(v).toLowerCase();
}

function normalizeName(v = '') {
  return clean(v).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function nowIso() {
  return new Date().toISOString();
}

const ESIGN_STORE_PATH = 'stores/esign-contracts.json';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const email = normalizeEmail(searchParams.get('email') || '');
  const name = normalizeName(searchParams.get('name') || '');
  if (!email && !name) return Response.json({ ok: false, error: 'missing_email_or_name' }, { status: 400 });

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];

  let row = null;
  let matchedBy = '';

  if (email) {
    row = list.find((r) => normalizeEmail(r?.email) === email) || null;
    if (row) matchedBy = 'email';
  }

  if (!row && name) {
    row = list.find((r) => normalizeName(r?.name) === name) || null;
    if (row) matchedBy = 'name';
  }

  const signedAt = clean(row?.signedAt || row?.signed_at || row?.completedAt || row?.completed_at || '');

  // If not found in the legacy DocuSign-backed store, also check the internal esign store
  // (populated by ICAContractGate.js via /api/esign-contract)
  if (!signedAt && email) {
    try {
      const esignRows = await loadJsonStore(ESIGN_STORE_PATH, []);
      const esignList = Array.isArray(esignRows) ? esignRows : [];
      const esignRow = esignList.find((r) => normalizeEmail(r?.email) === email) || null;
      const esignSignedAt = clean(esignRow?.candidateSignedAt || '');
      if (esignSignedAt) {
        return Response.json({
          ok: true,
          signed: true,
          row: { email, name: clean(esignRow?.name || ''), signedAt: esignSignedAt, source: 'esign_internal' },
          matchedBy: 'esign_email'
        });
      }
    } catch {
      // non-fatal: fall through to return unsigned
    }
  }

  return Response.json({ ok: true, signed: Boolean(signedAt), row: row ? { ...row, signedAt } : null, matchedBy });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const token = clean(body?.adminToken || '');
  const mode = clean(body?.mode || 'upsert').toLowerCase();
  const required = clean(process.env.CONTRACT_ADMIN_TOKEN || '');
  if (!required || token !== required) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];

  if (mode === 'bulk_upsert') {
    const incoming = Array.isArray(body?.rows) ? body.rows : [];
    if (!incoming.length) return Response.json({ ok: false, error: 'missing_rows' }, { status: 400 });

    let upserted = 0;
    for (const item of incoming) {
      const email = normalizeEmail(item?.email || '');
      if (!email) continue;
      const idx = list.findIndex((r) => normalizeEmail(r?.email) === email);
      const row = {
        email,
        name: clean(item?.name || ''),
        envelopeId: clean(item?.envelopeId || ''),
        signedAt: clean(item?.signedAt || nowIso()),
        source: clean(item?.source || body?.source || 'manual_admin_bulk'),
        updatedAt: nowIso(),
        createdAt: idx >= 0 ? clean(list[idx]?.createdAt || nowIso()) : nowIso()
      };
      if (idx >= 0) list[idx] = row;
      else list.push(row);
      upserted += 1;
    }

    await saveJsonStore(STORE_PATH, list);
    return Response.json({ ok: true, upserted, total: list.length });
  }

  const email = normalizeEmail(body?.email || '');
  if (!email) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });

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
