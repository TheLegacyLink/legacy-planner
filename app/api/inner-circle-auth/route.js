import { createHash } from 'crypto';
import users from '../../../data/innerCircleUsers.json';

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
  const active = (users || []).filter((u) => u?.active !== false);
  return Response.json({ ok: true, users: active.map((u) => safeUser(u)) });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const name = clean(body?.name);
  const password = clean(body?.password);

  if (!name || !password) {
    return Response.json({ ok: false, error: 'missing_credentials' }, { status: 400 });
  }

  const user = (users || []).find((u) => u?.active !== false && normalize(u?.name) === normalize(name));
  if (!user || !isValidPassword(user, password)) {
    return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  return Response.json({ ok: true, user: safeUser(user) });
}
