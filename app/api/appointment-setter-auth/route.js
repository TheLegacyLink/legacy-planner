import { createHash } from 'crypto';
import users from '../../../data/setterBackofficeUsers.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

function sha256(v = '') {
  return createHash('sha256').update(String(v || '')).digest('hex');
}

function resolveRole(role = '') {
  const n = normalize(role);
  if (n === 'admin') return 'admin';
  if (n === 'manager') return 'manager';
  return 'setter';
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const name = clean(body?.name);
  const password = clean(body?.password);

  if (!name || !password) {
    return Response.json({ ok: false, error: 'missing_credentials' }, { status: 400 });
  }

  const row = (users || []).find((u) => normalize(u?.name) === normalize(name) && u?.active !== false);
  if (!row) return Response.json({ ok: false, error: 'invalid_login' }, { status: 401 });

  const hash = sha256(password);
  const valid = clean(row?.passwordHash) && hash === clean(row.passwordHash);
  if (!valid) return Response.json({ ok: false, error: 'invalid_login' }, { status: 401 });

  return Response.json({
    ok: true,
    user: {
      name: clean(row.name),
      email: clean(row.email),
      role: resolveRole(row.role)
    }
  });
}
