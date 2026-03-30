import { createHash } from 'crypto';
import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';
import defaultUsers from '../../../data/setterBackofficeUsers.json';

const USERS_PATH = 'stores/appointment-setter-users.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase(); }
function sha256(v = '') { return createHash('sha256').update(String(v || '')).digest('hex'); }

function sanitizeRole(role = '') {
  const r = normalize(role);
  if (r === 'admin') return 'admin';
  if (r === 'manager') return 'manager';
  return 'setter';
}

async function getUsers() {
  const rows = await loadJsonFile(USERS_PATH, null);
  if (!Array.isArray(rows) || !rows.length) {
    await saveJsonFile(USERS_PATH, defaultUsers || []);
    return [...(defaultUsers || [])];
  }
  return rows;
}

function isAdminActor(actorName = '', actorRole = '') {
  if (sanitizeRole(actorRole) !== 'admin') return false;
  return Boolean(clean(actorName));
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const actorName = clean(searchParams.get('actorName'));
  const actorRole = clean(searchParams.get('actorRole'));
  if (!isAdminActor(actorName, actorRole)) {
    return Response.json({ ok: false, error: 'admin_only' }, { status: 403 });
  }

  const users = await getUsers();
  return Response.json({
    ok: true,
    rows: users.map((u) => ({
      name: clean(u?.name),
      email: clean(u?.email),
      role: sanitizeRole(u?.role),
      active: u?.active !== false
    }))
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const actorName = clean(body?.actorName);
  const actorRole = clean(body?.actorRole);
  if (!isAdminActor(actorName, actorRole)) {
    return Response.json({ ok: false, error: 'admin_only' }, { status: 403 });
  }

  const action = normalize(body?.action);
  const users = await getUsers();

  if (action === 'upsert') {
    const name = clean(body?.name);
    const email = clean(body?.email);
    const role = sanitizeRole(body?.role);
    const active = body?.active === undefined ? true : Boolean(body?.active);
    const password = clean(body?.password);

    if (!name || !password) return Response.json({ ok: false, error: 'name_and_password_required' }, { status: 400 });

    const idx = users.findIndex((u) => normalize(u?.name) === normalize(name));
    const row = {
      name,
      email,
      role,
      active,
      passwordHash: sha256(password)
    };

    if (idx >= 0) users[idx] = { ...users[idx], ...row };
    else users.push(row);

    await saveJsonFile(USERS_PATH, users);
    return Response.json({ ok: true });
  }

  if (action === 'set_active') {
    const name = clean(body?.name);
    const idx = users.findIndex((u) => normalize(u?.name) === normalize(name));
    if (idx < 0) return Response.json({ ok: false, error: 'user_not_found' }, { status: 404 });
    users[idx] = { ...users[idx], active: Boolean(body?.active) };
    await saveJsonFile(USERS_PATH, users);
    return Response.json({ ok: true });
  }

  if (action === 'reset_password') {
    const name = clean(body?.name);
    const password = clean(body?.password);
    if (!name || !password) return Response.json({ ok: false, error: 'name_and_password_required' }, { status: 400 });
    const idx = users.findIndex((u) => normalize(u?.name) === normalize(name));
    if (idx < 0) return Response.json({ ok: false, error: 'user_not_found' }, { status: 404 });
    users[idx] = { ...users[idx], passwordHash: sha256(password) };
    await saveJsonFile(USERS_PATH, users);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
}
