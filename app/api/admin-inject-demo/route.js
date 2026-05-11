import { loadJsonStoreDirect, saveJsonStoreDirect } from '../../../lib/blobJsonStore';

// ONE-TIME fast inject — uses direct blob read/write to avoid pagination timeout
const SECRET = process.env.RECOVERY_SECRET || 'legacy-recover-2026';
const APPS_PATH = 'stores/sponsorship-applications.json';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function clean(v = '') { return String(v || '').trim(); }
function nowIso() { return new Date().toISOString(); }
function rid() { return `demo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (clean(body?.secret) !== SECRET) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const records = body?.records;
  if (!Array.isArray(records) || !records.length) {
    return Response.json({ ok: false, error: 'no_records' });
  }

  // Use direct read to get newest version without paginating all 400+ versions
  const existing = await loadJsonStoreDirect(APPS_PATH, []);
  const existingEmails = new Set(existing.map(r => clean(r?.email || '').toLowerCase()));

  const toAdd = records
    .filter(r => {
      const email = clean(r?.email || '').toLowerCase();
      return email && !existingEmails.has(email);
    })
    .map(r => ({ ...r, id: rid(), createdAt: nowIso() }));

  if (!toAdd.length) {
    return Response.json({ ok: true, added: 0, total: existing.length, message: 'All records already exist.' });
  }

  const updated = [...existing, ...toAdd];
  await saveJsonStoreDirect(APPS_PATH, updated);

  return Response.json({ ok: true, added: toAdd.length, total: updated.length });
}
