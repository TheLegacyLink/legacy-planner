import { sessionFromToken } from '../_lib';
import { sessionFromToken as startAuthSessionFromToken } from '../../../start-auth/_lib';
import { clean } from '../../../../../lib/licensedAgentMatch';

export async function GET(req) {
  const auth = clean(req.headers.get('authorization'));
  const token = auth.toLowerCase().startsWith('bearer ') ? clean(auth.slice(7)) : '';
  if (!token) return Response.json({ ok: false, error: 'missing_token' }, { status: 401 });

  // Primary: check licensed backoffice sessions
  let profile = await sessionFromToken(token);

  // Fallback: accept start-auth tokens (issued by /start portal)
  if (!profile) {
    const startProfile = await startAuthSessionFromToken(token).catch(() => null);
    if (startProfile) {
      profile = {
        email: startProfile.email,
        name: startProfile.name,
        agentId: startProfile.applicationId || '',
        homeState: startProfile.state || '',
        trackType: startProfile.trackType || 'licensed',
        carriersActive: []
      };
    }
  }

  if (!profile) return Response.json({ ok: false, error: 'invalid_session' }, { status: 401 });

  return Response.json({ ok: true, profile });
}
