import {
  clean,
  verifyPasswordHash,
  getPasswordRecord,
  resolveProfileByEmail,
  issueSession
} from '../_lib';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = clean(body?.email || '').toLowerCase();
  const password = clean(body?.password || '');

  if (!email || !password) {
    return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const pwRecord = await getPasswordRecord(email);
  if (!pwRecord?.passwordHash) {
    return Response.json({ ok: false, error: 'no_password_set' }, { status: 401 });
  }

  const valid = verifyPasswordHash(password, pwRecord.passwordHash);
  if (!valid) {
    return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  const profile = await resolveProfileByEmail(email);
  if (!profile) {
    return Response.json({ ok: false, error: 'profile_not_found' }, { status: 404 });
  }

  const { token, expiresAt } = await issueSession(profile);
  return Response.json({ ok: true, token, expiresAt, profile });
}
