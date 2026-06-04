import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

export const dynamic = 'force-dynamic';

const STORE_PATH = 'card-settings/v1.json';

function clean(v = '') { return String(v || '').trim(); }
function normKey(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ''); }

async function loadAll() {
  const data = await loadJsonFile(STORE_PATH, {});
  return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
}

// GET ?ref=email — load settings for one agent
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ref = normKey(searchParams.get('ref') || '');
  if (!ref) return Response.json({ ok: false, error: 'missing_ref' }, { status: 400 });

  const all = await loadAll();
  return Response.json({ ok: true, settings: all[ref] || null });
}

// POST — save settings for one agent
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const ref = normKey(body?.ref || '');
  if (!ref) return Response.json({ ok: false, error: 'missing_ref' }, { status: 400 });

  const all = await loadAll();
  all[ref] = {
    ...(all[ref] || {}),
    cardName:  clean(body?.cardName  ?? all[ref]?.cardName  ?? ''),
    cardTitle: clean(body?.cardTitle ?? all[ref]?.cardTitle ?? 'Inner Circle Agent'),
    cardPhone: clean(body?.cardPhone ?? all[ref]?.cardPhone ?? ''),
    cardEmail: clean(body?.cardEmail ?? all[ref]?.cardEmail ?? ''),
    cardCity:  clean(body?.cardCity  ?? all[ref]?.cardCity  ?? ''),
    updatedAt: new Date().toISOString(),
  };

  await saveJsonFile(STORE_PATH, all);
  return Response.json({ ok: true, settings: all[ref] });
}
