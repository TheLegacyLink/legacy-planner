import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/sponsorship-review-touches.json';

function clean(v = '') { return String(v || '').trim(); }
function nowIso() { return new Date().toISOString(); }

export async function GET() {
  const rows = await loadJsonStore(STORE_PATH, []);
  return Response.json({ ok: true, rows: Array.isArray(rows) ? rows : [] });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = clean(body?.action || '').toLowerCase();
  const key = clean(body?.key || '');
  const channel = clean(body?.channel || 'text').toLowerCase();

  if (!key) return Response.json({ ok: false, error: 'missing_key' }, { status: 400 });

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => clean(r?.key) === key);
  const current = idx >= 0 ? list[idx] : { key, textCount: 0, emailCount: 0, createdAt: nowIso() };
  const next = { ...current };

  if (action === 'increment') {
    if (channel === 'email') {
      next.emailCount = Number(next.emailCount || 0) + 1;
      next.lastEmailAt = nowIso();
    } else {
      next.textCount = Number(next.textCount || 0) + 1;
      next.lastTextAt = nowIso();
    }
  } else if (action === 'reset') {
    next.textCount = 0;
    next.emailCount = 0;
    next.lastTextAt = '';
    next.lastEmailAt = '';
  } else {
    return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
  }

  next.updatedAt = nowIso();

  if (idx >= 0) list[idx] = next;
  else list.unshift(next);

  await saveJsonStore(STORE_PATH, list);
  return Response.json({ ok: true, row: next });
}
