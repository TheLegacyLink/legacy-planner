import { createHash } from 'crypto';
import users from '../../../data/innerCircleUsers.json';

function clean(v = '') {
  return String(v || '').trim();
}

function hashPassword(pw = '') {
  return createHash('sha256').update(String(pw)).digest('hex');
}

function safeUser(u) {
  return { name: u.name, email: u.email, role: u.role };
}

export async function GET() {
  const active = (users || []).filter((u) => u.active);
  return Response.json({
    ok: true,
    users: active.map((u) => ({ name: u.name, role: u.role }))
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const name = clean(body?.name);
  const password = clean(body?.password);

  if (!name || !password) {
    return Response.json({ ok: false, error: 'missing_credentials' }, { status: 400 });
  }

  const user = (users || []).find((u) => u.active && clean(u.name).toLowerCase() === name.toLowerCase());
  if (!user) {
    return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  const incomingHash = hashPassword(password);
  if (incomingHash !== user.passwordHash) {
    return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  return Response.json({ ok: true, user: safeUser(user) });
}
