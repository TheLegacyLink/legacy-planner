import { clean, sessionFromToken } from '../_lib';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  const auth = req.headers.get('authorization') || '';
  const token = clean(auth.replace(/^Bearer\s+/i, ''));
  if (!token) return Response.json({ ok: false, error: 'missing_token' }, { status: 401 });

  const profile = await sessionFromToken(token);
  if (!profile) return Response.json({ ok: false, error: 'invalid_or_expired_token' }, { status: 401 });

  return Response.json({ ok: true, profile });
}
