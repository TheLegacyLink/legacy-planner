import {
  resolveUnlicensedProfile,
  getPasswordRecord,
  verifyPassword,
  issueSession,
} from '../_lib';

export const dynamic = 'force-dynamic';

function clean(v = '') { return String(v || '').trim(); }

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email    = clean(body?.email || '').toLowerCase();
  const password = clean(body?.password || '');

  if (!email || !password) {
    return Response.json({ ok: false, error: 'email_and_password_required' }, { status: 400 });
  }

  // Check agent exists in system
  const resolved = await resolveUnlicensedProfile({ email });
  if (!resolved?.ok || !resolved?.profile) {
    return Response.json({ ok: false, error: 'not_found' }, { status: 403 });
  }

  // Check they have a password set
  const pwRecord = await getPasswordRecord(email);
  if (!pwRecord) {
    return Response.json({ ok: false, error: 'no_password_set' }, { status: 403 });
  }

  // Verify password
  const valid = await verifyPassword(password, pwRecord.passwordHash, pwRecord.salt);
  if (!valid) {
    return Response.json({ ok: false, error: 'invalid_password' }, { status: 401 });
  }

  const session = await issueSession(resolved.profile);
  return Response.json({ ok: true, token: session.token, expiresAt: session.expiresAt, profile: resolved.profile });
}
