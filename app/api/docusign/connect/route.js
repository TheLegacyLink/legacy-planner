import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';

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

function extractCompletedRecords(payload = {}) {
  // Expected when DocuSign Connect is configured for JSON payloads.
  // We support a minimal envelope schema; unknown shapes are ignored.
  const envelopeStatus = clean(payload?.envelopeStatus || payload?.status || '').toLowerCase();
  if (envelopeStatus !== 'completed') return [];

  const envelopeId = clean(payload?.envelopeId || payload?.envelope_id || '');
  const completedAt = clean(payload?.completedDateTime || payload?.completed_at || nowIso());

  const recipients = payload?.recipients?.signers || payload?.recipients || [];
  const list = Array.isArray(recipients) ? recipients : [];

  return list
    .map((s) => ({
      email: normalizeEmail(s?.email || s?.emailAddress || ''),
      name: clean(s?.name || ''),
      signedAt: clean(s?.signedDateTime || completedAt),
      envelopeId
    }))
    .filter((r) => r.email);
}

export async function POST(req) {
  const secret = clean(process.env.DOCUSIGN_CONNECT_SECRET || '');
  if (secret) {
    const incoming = clean(req.headers.get('x-contract-secret') || req.headers.get('x-docusign-secret') || '');
    if (!incoming || incoming !== secret) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  const payload = await req.json().catch(() => ({}));
  const records = extractCompletedRecords(payload);
  if (!records.length) return Response.json({ ok: true, skipped: true, reason: 'no_completed_records' });

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];

  for (const rec of records) {
    const idx = list.findIndex((r) => normalizeEmail(r?.email) === rec.email);
    const next = {
      email: rec.email,
      name: rec.name,
      envelopeId: rec.envelopeId,
      signedAt: rec.signedAt,
      source: 'docusign_connect',
      updatedAt: nowIso(),
      createdAt: idx >= 0 ? clean(list[idx]?.createdAt || nowIso()) : nowIso()
    };
    if (idx >= 0) list[idx] = { ...list[idx], ...next };
    else list.push(next);
  }

  await saveJsonStore(STORE_PATH, list);
  return Response.json({ ok: true, updated: records.length });
}
