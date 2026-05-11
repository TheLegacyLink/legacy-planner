import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const SECRET = process.env.RECOVERY_SECRET || 'legacy-recover-2026';
const APPS_PATH = 'stores/sponsorship-applications.json';

export const dynamic = 'force-dynamic';

function clean(v = '') { return String(v || '').trim(); }
function nowIso() { return new Date().toISOString(); }

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (clean(body?.secret) !== SECRET) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const records = body?.records;
  if (!Array.isArray(records) || !records.length) {
    return Response.json({ ok: false, error: 'no_records' });
  }

  const existing = await loadJsonStore(APPS_PATH, []);
  const existingEmails = new Set(existing.map(r => clean(r?.email || '').toLowerCase()));

  const toAdd = [];
  for (const r of records) {
    const email = clean(r?.email || '').toLowerCase();
    if (!email || existingEmails.has(email)) continue;
    toAdd.push({ ...r, id: `demo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, createdAt: nowIso() });
  }

  const updated = [...existing, ...toAdd];
  await saveJsonStore(APPS_PATH, updated);

  return Response.json({ ok: true, added: toAdd.length, total: updated.length });
}
