import { clean, verifyCode, resolveProfileByEmail, issueSession } from '../_lib';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = clean(body?.email || '').toLowerCase();
  const code = clean(body?.code || '');

  if (!email || !code) {
    return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const result = await verifyCode({ email, code });
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error || 'invalid_code' }, { status: 401 });
  }

  const profile = await resolveProfileByEmail(email);
  if (!profile) {
    return Response.json({ ok: false, error: 'profile_not_found' }, { status: 404 });
  }

  const { token, expiresAt } = await issueSession(profile);
  return Response.json({ ok: true, token, expiresAt, profile });
}
