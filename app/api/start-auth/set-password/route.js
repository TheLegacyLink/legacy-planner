import { clean, sessionFromToken, hashPassword, setPasswordRecord } from '../_lib';

export const dynamic = 'force-dynamic';

const MIN_LENGTH = 8;

export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = clean(authHeader.replace(/^Bearer\s+/i, ''));

  if (!token) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const session = await sessionFromToken(token);
  if (!session) {
    return Response.json({ ok: false, error: 'invalid_session' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const password = clean(body?.password || '');

  if (!password || password.length < MIN_LENGTH) {
    return Response.json(
      { ok: false, error: `password_too_short`, minLength: MIN_LENGTH },
      { status: 400 }
    );
  }

  const passwordHash = hashPassword(password);
  await setPasswordRecord(session.email, passwordHash);

  return Response.json({ ok: true });
}
