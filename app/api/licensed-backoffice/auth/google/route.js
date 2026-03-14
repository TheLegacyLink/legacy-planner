import { clean } from '../../../../../../lib/licensedAgentMatch';
import { issueSession, resolveLicensedProfile } from '../_lib';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const idToken = clean(body?.idToken);
  if (!idToken) return Response.json({ ok: false, error: 'missing_id_token' }, { status: 400 });

  const expectedAud = clean(process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  if (!expectedAud) return Response.json({ ok: false, error: 'google_not_configured' }, { status: 500 });

  let payload = null;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, { cache: 'no-store' });
    if (!res.ok) return Response.json({ ok: false, error: 'invalid_google_token' }, { status: 401 });
    payload = await res.json().catch(() => null);
  } catch {
    return Response.json({ ok: false, error: 'google_verification_failed' }, { status: 502 });
  }

  const aud = clean(payload?.aud);
  const email = clean(payload?.email).toLowerCase();
  const fullName = clean(payload?.name);
  const emailVerified = String(payload?.email_verified || '').toLowerCase() === 'true';

  if (!email || !emailVerified) return Response.json({ ok: false, error: 'google_email_not_verified' }, { status: 401 });
  if (aud !== expectedAud) return Response.json({ ok: false, error: 'google_audience_mismatch' }, { status: 401 });

  const resolved = await resolveLicensedProfile({ email, fullName, phone: '' });
  if (!resolved?.ok || !resolved?.profile) {
    const err = resolved?.error || 'not_licensed';
    const status = String(err).startsWith('pending_verification') ? 202 : 403;
    return Response.json({ ok: false, error: err, candidates: resolved?.candidates || [] }, { status });
  }

  const session = await issueSession(resolved.profile);
  return Response.json({
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    profile: resolved.profile,
    via: `google_${resolved.via || 'match'}`
  });
}
