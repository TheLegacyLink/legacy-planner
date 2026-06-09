import {
  verifySetupToken,
  consumeSetupToken,
  hashPassword,
  savePasswordRecord,
  issueSession,
  resolveUnlicensedProfile,
} from '../_lib';

export const dynamic = 'force-dynamic';

function clean(v = '') { return String(v || '').trim(); }

// GET — verify a setup token and return the associated email (used by the UI to pre-fill)
export async function GET(req) {
  const token = clean(new URL(req.url).searchParams.get('token') || '');
  if (!token) return Response.json({ ok: false, error: 'missing_token' }, { status: 400 });

  const email = await verifySetupToken(token);
  if (!email) return Response.json({ ok: false, error: 'invalid_or_expired_token' }, { status: 400 });

  return Response.json({ ok: true, email });
}

// POST — consume the setup token, save the password, and issue a session
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const token    = clean(body?.token || '');
  const password = clean(body?.password || '');

  if (!token)    return Response.json({ ok: false, error: 'missing_token' }, { status: 400 });
  if (!password) return Response.json({ ok: false, error: 'missing_password' }, { status: 400 });
  if (password.length < 8) return Response.json({ ok: false, error: 'password_too_short' }, { status: 400 });

  const email = await verifySetupToken(token);
  if (!email) return Response.json({ ok: false, error: 'invalid_or_expired_token' }, { status: 400 });

  // Hash and save the password
  const { hash, salt } = await hashPassword(password);
  await savePasswordRecord(email, hash, salt);

  // Mark token used
  await consumeSetupToken(token);

  // Resolve profile and issue a session so they're logged in immediately after setting password
  const resolved = await resolveUnlicensedProfile({ email });
  if (!resolved?.ok || !resolved?.profile) {
    // Password saved — just can't auto-login (shouldn't happen)
    return Response.json({ ok: true, autoLogin: false });
  }

  const session = await issueSession(resolved.profile);
  return Response.json({ ok: true, autoLogin: true, token: session.token, expiresAt: session.expiresAt, profile: resolved.profile });
}
