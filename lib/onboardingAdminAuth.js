/**
 * resolveAdminSession — tries both start-auth and licensed-backoffice token stores.
 * Returns { email } if the token belongs to an admin email, otherwise null.
 */
import { sessionFromToken as startAuthSession } from '../app/api/start-auth/_lib.js';
import { sessionFromToken as licensedSession } from '../app/api/licensed-backoffice/auth/_lib.js';

const ADMIN_EMAILS = new Set(['kimora@thelegacylink.com', 'link@thelegacylink.com', 'investalinkinsurance@gmail.com']);

function extractToken(req) {
  const auth = req.headers.get('authorization') || '';
  return auth.replace(/^Bearer\s+/i, '').trim();
}

export async function resolveAdminSession(req) {
  const token = extractToken(req);
  if (!token) return null;

  // Try start-auth first, then licensed back office
  let session = await startAuthSession(token).catch(() => null);
  if (!session) session = await licensedSession(token).catch(() => null);
  if (!session?.email) return null;

  const email = session.email.toLowerCase().trim();
  if (!ADMIN_EMAILS.has(email)) return null;

  return { email, name: session.name || '' };
}
