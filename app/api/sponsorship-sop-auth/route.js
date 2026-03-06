import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

const AUTH_USERS_PATH = 'stores/sponsorship-sop-auth-users.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const name = clean(body?.name);
  const password = clean(body?.password);
  if (!name || !password) return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });

  const users = await loadJsonFile(AUTH_USERS_PATH, []);
  const rows = Array.isArray(users) ? users : [];

  const hit = rows.find((u) => normalize(u?.name) === normalize(name) && clean(u?.password) === password && u?.active !== false);
  if (!hit) return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });

  return Response.json({ ok: true, user: { name: hit.name, email: hit.email, role: hit.role || 'agent' } });
}

export async function GET() {
  const users = await loadJsonFile(AUTH_USERS_PATH, []);
  const rows = (Array.isArray(users) ? users : []).filter((u) => u?.active !== false);
  return Response.json({
    ok: true,
    users: rows.map((u) => ({ name: u.name, email: u.email, role: u.role || 'agent', createdAt: u.createdAt || '' }))
  });
}

export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  const action = normalize(body?.action || '');
  const email = clean(body?.email).toLowerCase();
  if (!email) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });

  const users = await loadJsonFile(AUTH_USERS_PATH, []);
  const rows = Array.isArray(users) ? users : [];
  const idx = rows.findIndex((u) => clean(u?.email).toLowerCase() === email);
  if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  if (action === 'set_active') {
    rows[idx] = { ...rows[idx], active: Boolean(body?.active), updatedAt: new Date().toISOString() };
  } else {
    return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
  }

  await saveJsonFile(AUTH_USERS_PATH, rows);
  return Response.json({ ok: true });
}
