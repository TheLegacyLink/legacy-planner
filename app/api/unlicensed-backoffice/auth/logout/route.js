import { loadJsonStore, saveJsonStore } from '../../../../../lib/blobJsonStore';
import { SESSIONS_PATH, sha256 } from '../_lib';

function clean(v = '') { return String(v || '').trim(); }

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const auth = clean(req.headers.get('authorization'));
  const token = (auth.toLowerCase().startsWith('bearer ') ? clean(auth.slice(7)) : '') || clean(body?.token);
  if (!token) return Response.json({ ok: false, error: 'missing_token' }, { status: 400 });

  const rows = await loadJsonStore(SESSIONS_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const hash = sha256(token);
  const next = list.map((r) => clean(r?.tokenHash) === hash ? { ...r, active: false, endedAt: new Date().toISOString() } : r);
  await saveJsonStore(SESSIONS_PATH, next);
  return Response.json({ ok: true });
}
