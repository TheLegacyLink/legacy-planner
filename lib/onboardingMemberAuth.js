/**
 * resolveMemberSession
 * Validates a Bearer token against both session stores so Inner Circle Hub
 * members (licensed_backoffice_token) and /start members (start_portal_token)
 * can both access the onboarding agent APIs.
 */
import { createHash } from 'crypto';
import { loadJsonStore } from './blobJsonStore.js';

const START_AUTH_SESSIONS = 'stores/start-auth-sessions.json';
const LICENSED_SESSIONS   = 'stores/licensed-backoffice-sessions.json';

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

export async function resolveMemberSession(req) {
  const raw = extractToken(req);
  if (!raw) return null;
  const hash = sha256(raw);
  return (await findSession(START_AUTH_SESSIONS, hash)) ||
         (await findSession(LICENSED_SESSIONS, hash));
}
