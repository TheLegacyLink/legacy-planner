/**
 * resolveAdminSession
 * Validates the Bearer token against BOTH session stores directly.
 * No transitive imports — reads blob stores inline so nothing can silently fail.
 */
import { createHash } from 'crypto';
import { loadJsonStore } from './blobJsonStore.js';

const START_AUTH_SESSIONS   = 'stores/start-auth-sessions.json';
const LICENSED_SESSIONS     = 'stores/licensed-backoffice-sessions.json';

const ADMIN_EMAILS = new Set([
  'kimora@thelegacylink.com',
  'link@thelegacylink.com',
  'investalinkinsurance@gmail.com',
]);

function sha256(v) {
  return createHash('sha256').update(String(v || '')).digest('hex');
}

function extractToken(req) {
  const auth = req.headers.get('authorization') || '';
  return auth.replace(/^Bearer\s+/i, '').trim();
}

async function findSession(storePath, tokenHash) {
  try {
    const rows = await loadJsonStore(storePath, []);
    const list = Array.isArray(rows) ? rows : [];
    const row = list.find(s => s?.tokenHash === tokenHash && s?.active !== false);
    if (!row) return null;
    const exp = new Date(row.expiresAt || 0);
    if (isNaN(exp.getTime()) || exp.getTime() <= Date.now()) return null;
    return { email: String(row.email || '').toLowerCase().trim(), name: String(row.name || '') };
  } catch {
    return null;
  }
}

export async function resolveAdminSession(req) {
  const raw = extractToken(req);
  if (!raw) return null;

  const hash = sha256(raw);

  // Try start-auth sessions first, then licensed back office sessions
  const session =
    (await findSession(START_AUTH_SESSIONS, hash)) ||
    (await findSession(LICENSED_SESSIONS, hash));

  if (!session?.email) return null;
  if (!ADMIN_EMAILS.has(session.email)) return null;

  return session;
}
