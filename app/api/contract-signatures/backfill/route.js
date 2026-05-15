import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';

const ESIGN_PATH = 'stores/esign-contracts.json';
const CONTRACT_SIGS_PATH = 'stores/contract-signatures.json';

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function nowIso() { return new Date().toISOString(); }

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const adminToken = clean(body?.adminToken || '');
  const required = clean(process.env.CONTRACT_ADMIN_TOKEN || '');
  if (required && adminToken !== required) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const esignRows = await loadJsonStore(ESIGN_PATH, []);
  const sigRows = await loadJsonStore(CONTRACT_SIGS_PATH, []);

  const esignList = Array.isArray(esignRows) ? esignRows : [];
  const sigList = Array.isArray(sigRows) ? sigRows : [];

  let synced = 0;
  let skipped = 0;

  for (const row of esignList) {
    const email = norm(row?.email || '');
    const signedAt = clean(row?.candidateSignedAt || '');
    if (!email || !signedAt) { skipped++; continue; }

    const existing = sigList.find((r) => norm(r?.email) === email);
    if (existing?.signedAt) { skipped++; continue; } // already has a record

    const record = {
      email,
      name: clean(row?.name || ''),
      envelopeId: clean(row?.envelopeId || ''),
      signedAt,
      source: 'backfill_esign',
      updatedAt: nowIso(),
      createdAt: clean(row?.createdAt || signedAt)
    };

    const idx = sigList.findIndex((r) => norm(r?.email) === email);
    if (idx >= 0) sigList[idx] = record;
    else sigList.push(record);
    synced++;
  }

  await saveJsonStore(CONTRACT_SIGS_PATH, sigList);

  return Response.json({ ok: true, synced, skipped, total: sigList.length });
}
