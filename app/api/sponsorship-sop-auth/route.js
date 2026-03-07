import { createHash } from 'crypto';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/sponsorship-sop-auth-users.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

function sha256(v = '') {
  return createHash('sha256').update(String(v)).digest('hex');
}

function getMasterPassword() {
  return clean(process.env.MASTER_LOGIN_PASSWORD || 'LegacyLink2026');
}

function safeUser(u) {
  return { name: clean(u?.name), email: clean(u?.email), role: clean(u?.role || 'agent') };
}

function isValidPassword(user = {}, password = '') {
  const pw = clean(password);
  if (!pw) return false;
  if (pw === getMasterPassword()) return true;
  if (clean(user?.password) && pw === clean(user.password)) return true;
  if (clean(user?.passwordHash) && sha256(pw) === clean(user.passwordHash)) return true;
  return false;
}

export async function GET() {
  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  return Response.json({ ok: true, users: list.filter((u) => u?.active !== false).map((u) => safeUser(u)) });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const mode = normalize(body?.mode || 'login');

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];

  if (mode === 'upsert') {
    const name = clean(body?.name);
    const email = clean(body?.email).toLowerCase();
    const role = clean(body?.role || 'agent');
    const password = clean(body?.password || '');
    if (!name || !email) return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });

    const idx = list.findIndex((u) => normalize(u?.email) === normalize(email));
    const next = {
      name,
      email,
      role,
      active: body?.active !== false,
      passwordHash: password ? sha256(password) : clean(list[idx]?.passwordHash || ''),
      updatedAt: new Date().toISOString(),
      createdAt: idx >= 0 ? clean(list[idx]?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };
    if (idx >= 0) list[idx] = { ...list[idx], ...next };
    else list.push(next);
    await saveJsonStore(STORE_PATH, list);
    return Response.json({ ok: true, user: safeUser(next) });
  }

  const name = clean(body?.name || '');
  const password = clean(body?.password || '');
  if (!name || !password) return Response.json({ ok: false, error: 'missing_credentials' }, { status: 400 });

  const user = list.find((u) => u?.active !== false && normalize(u?.name) === normalize(name));
  if (!user || !isValidPassword(user, password)) {
    return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  return Response.json({ ok: true, user: safeUser(user) });
}
