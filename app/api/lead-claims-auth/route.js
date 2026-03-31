import { createHash } from 'crypto';
import users from '../../../data/leadClaimsUsers.json';
import { isValidAdminSkeleton } from '../../../lib/adminSkeletonAuth';
import { normalizePersonName } from '../../../lib/nameAliases';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

function sha256(v = '') {
  return createHash('sha256').update(String(v)).digest('hex');
}

function safeUser(u) {
  return { name: clean(u?.name), email: clean(u?.email), role: clean(u?.role || 'agent') };
}

function isValidPassword(user = {}, password = '', identifier = '') {
  const pw = clean(password);
  if (!pw) return false;
  if (isValidAdminSkeleton(pw, { user, identifier })) return true;
  if (clean(user?.password) && pw === clean(user.password)) return true;
  if (clean(user?.passwordHash) && sha256(pw) === clean(user.passwordHash)) return true;
  return false;
}

export async function GET() {
  const active = (users || []).filter((u) => u?.active !== false);
  return Response.json({ ok: true, users: active.map((u) => ({ name: clean(u?.name), role: clean(u?.role || 'agent') })) });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const name = clean(body?.name);
  const password = clean(body?.password);

  if (!name || !password) {
    return Response.json({ ok: false, error: 'missing_credentials' }, { status: 400 });
  }

  const user = (users || []).find((u) => u?.active !== false && normalizePersonName(u?.name) === normalizePersonName(name));
  if (!user || !isValidPassword(user, password, name)) {
    return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  return Response.json({ ok: true, user: safeUser(user) });
}
