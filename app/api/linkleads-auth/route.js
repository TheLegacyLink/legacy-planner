import { createHash } from 'crypto';
import leadClaimsUsers from '../../../data/leadClaimsUsers.json';
import { loadJsonStore } from '../../../lib/blobJsonStore';
import { isValidAdminSkeleton } from '../../../lib/adminSkeletonAuth';
import { normalizePersonName } from '../../../lib/nameAliases';

const USERS_PATH = 'stores/linkleads-users.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

function sha256(v = '') {
  return createHash('sha256').update(String(v)).digest('hex');
}

function safeUser(u = {}) {
  return {
    id: clean(u?.id),
    name: clean(u?.name),
    email: clean(u?.email).toLowerCase(),
    role: clean(u?.role || 'buyer')
  };
}

function isValidPassword(user = {}, password = '', identifier = '') {
  const pw = clean(password);
  if (!pw) return false;
  if (isValidAdminSkeleton(pw, { user, identifier })) return true;
  if (clean(user?.password) && pw === clean(user.password)) return true;
  if (clean(user?.passwordHash) && sha256(pw) === clean(user.passwordHash)) return true;
  return false;
}

async function loadAllUsers() {
  const dbUsers = await loadJsonStore(USERS_PATH, []);
  const legacyUsers = (leadClaimsUsers || []).filter((u) => u?.active !== false).map((u) => ({
    id: clean(u?.id || `legacy_${normalize(u?.name).replace(/[^a-z0-9]+/g, '_')}`),
    name: clean(u?.name),
    email: clean(u?.email).toLowerCase(),
    role: clean(u?.role || 'agent'),
    active: u?.active !== false,
    passwordHash: clean(u?.passwordHash),
    password: clean(u?.password)
  }));

  const map = new Map();
  for (const u of [...legacyUsers, ...dbUsers]) {
    const email = normalize(u?.email);
    if (!email) continue;
    map.set(email, { ...u, email, active: u?.active !== false });
  }

  return Array.from(map.values());
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = normalize(body?.action || 'login');

  if (action === 'register') {
    return Response.json({ ok: false, error: 'licensed_signup_required', redirectTo: '/start/licensed' }, { status: 403 });
  }

  const emailOrName = clean(body?.email || body?.name || '');
  const password = clean(body?.password);
  if (!emailOrName || !password) {
    return Response.json({ ok: false, error: 'missing_credentials' }, { status: 400 });
  }

  const users = await loadAllUsers();
  const idNorm = normalize(emailOrName);
  const user = users.find((u) => u?.active !== false && (normalize(u?.email) === idNorm || normalizePersonName(u?.name) === normalizePersonName(emailOrName)));
  if (!user || !isValidPassword(user, password, emailOrName)) {
    return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  return Response.json({ ok: true, user: safeUser(user) });
}
