import { sessionFromToken } from '../_lib';
import { clean } from '../../../../../../lib/licensedAgentMatch';

export async function GET(req) {
  const auth = clean(req.headers.get('authorization'));
  const token = auth.toLowerCase().startsWith('bearer ') ? clean(auth.slice(7)) : '';
  if (!token) return Response.json({ ok: false, error: 'missing_token' }, { status: 401 });

  const profile = await sessionFromToken(token);
  if (!profile) return Response.json({ ok: false, error: 'invalid_session' }, { status: 401 });

  return Response.json({ ok: true, profile });
}
