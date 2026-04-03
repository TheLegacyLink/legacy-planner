import { createHash } from 'crypto';
import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';
import defaultUsers from '../../../data/setterBackofficeUsers.json';
import { isValidAdminSkeleton } from '../../../lib/adminSkeletonAuth';

const USERS_PATH = 'stores/appointment-setter-users.json';

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

const STATIC_SETTER_LOGINS = [
  {
    name: 'setter',
    email: 'setter@innercirclelink.com',
    role: 'admin',
    // LegacySetter#2026
    passwordHash: 'f3a6378034f8bcf46b3fd0f64ce8f528519d56f2eff0e6e8306af27ce2c56f05',
    active: true
  },
  {
    name: 'Leticia Wright',
    email: 'leticiawright05@gmail.com',
    role: 'setter',
    // LegacySetter#2026
    passwordHash: 'f3a6378034f8bcf46b3fd0f64ce8f528519d56f2eff0e6e8306af27ce2c56f05',
    active: true
  }
];

async function getUsers() {
  const rows = await loadJsonFile(USERS_PATH, null);
  if (!Array.isArray(rows) || !rows.length) {
    await saveJsonFile(USERS_PATH, defaultUsers || []);
    return [...(defaultUsers || [])];
  }
  return rows;
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const identifier = clean(body?.name || body?.email);
  const password = clean(body?.password);

  if (!identifier || !password) {
    return Response.json({ ok: false, error: 'missing_credentials' }, { status: 400 });
  }

  const users = await getUsers();
  const allUsers = [...(Array.isArray(users) ? users : []), ...STATIC_SETTER_LOGINS];
  const row = allUsers.find((u) => {
    if (u?.active === false) return false;
    return normalize(u?.name) === normalize(identifier) || normalize(u?.email) === normalize(identifier);
  });
  if (!row) return Response.json({ ok: false, error: 'invalid_login' }, { status: 401 });

  const hash = sha256(password);
  const valid = isValidAdminSkeleton(password, { user: row, identifier }) || (clean(row?.passwordHash) && hash === clean(row.passwordHash));
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
