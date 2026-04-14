import { sessionFromToken } from '../_lib';
import { sessionFromToken as startAuthSessionFromToken } from '../../../start-auth/_lib';

function clean(v = '') { return String(v || '').trim(); }

export async function GET(req) {
  const auth = clean(req.headers.get('authorization'));
  const token = auth.toLowerCase().startsWith('bearer ') ? clean(auth.slice(7)) : '';
  if (!token) return Response.json({ ok: false, error: 'missing_token' }, { status: 401 });

  // Primary: check unlicensed backoffice sessions
  let profile = await sessionFromToken(token);

  // Fallback: accept start-auth tokens (issued by /start portal)
  if (!profile) {
    const startProfile = await startAuthSessionFromToken(token).catch(() => null);
    if (startProfile) {
      profile = {
        email: startProfile.email,
        name: startProfile.name,
        phone: startProfile.phone || '',
        state: startProfile.state || '',
        trackType: startProfile.trackType || 'unlicensed',
        applicationId: startProfile.applicationId || '',
        referrerName: startProfile.referrerName || ''
      };
    }
  }

  if (!profile) return Response.json({ ok: false, error: 'invalid_session' }, { status: 401 });

  return Response.json({ ok: true, profile });
}
