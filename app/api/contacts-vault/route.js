import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/contacts-vault.json';

function clean(v = '') {
  return String(v || '').trim();
}

function summarize(rows = []) {
  const total = rows.length;
  const withEmail = rows.filter((r) => clean(r.email || r.Email || r.email_address)).length;
  return {
    total,
    withEmail,
    withoutEmail: Math.max(0, total - withEmail)
  };
}

export async function GET() {
  const payload = await loadJsonFile(STORE_PATH, { rows: [], updatedAt: '' });
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  return Response.json({ ok: true, rows, updatedAt: payload?.updatedAt || '', summary: summarize(rows) });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  const next = {
    rows,
    source: clean(body?.source || 'CSV Upload'),
    updatedAt: new Date().toISOString()
  };
  await saveJsonFile(STORE_PATH, next);
  return Response.json({ ok: true, updatedAt: next.updatedAt, summary: summarize(rows) });
}
