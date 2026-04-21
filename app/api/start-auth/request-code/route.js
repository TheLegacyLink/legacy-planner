import { clean, generateCode, storeCode, sendOtpEmail, resolveProfileByEmail, CODES_PATH } from '../_lib';
import { loadJsonStore } from '../../../../lib/blobJsonStore';

export const dynamic = 'force-dynamic';

// How long an existing unexpired code must be before we allow a re-send (3 minutes)
const RESEND_COOLDOWN_MS = 3 * 60 * 1000;

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = clean(body?.email || '').toLowerCase();
  if (!email || !email.includes('@')) {
    return Response.json({ ok: false, error: 'valid_email_required' }, { status: 400 });
  }

  const profile = await resolveProfileByEmail(email);
  if (!profile) {
    return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  // Rate-limit: if an unexpired, unused code was issued within the cooldown window,
  // tell the user to check their email instead of issuing a new code (which would
  // invalidate the previous one and cause "invalid code" on the first attempt).
  const existing = await loadJsonStore(CODES_PATH, []);
  const prev = existing.find((r) => clean(r?.email).toLowerCase() === email && !r?.used);
  if (prev) {
    const expiresAt = new Date(prev?.expiresAt || 0).getTime();
    const createdAt = new Date(prev?.createdAt || 0).getTime();
    const ageMs = Date.now() - createdAt;
    if (expiresAt > Date.now() && ageMs < RESEND_COOLDOWN_MS) {
      // Code is still very fresh — tell them to check email rather than sending a new one
      return Response.json({
        ok: true,
        message: 'Code already sent. Please check your email (including spam). You can request a new code in a few minutes if needed.',
        rateLimited: true
      });
    }
  }

  const code = generateCode();
  await storeCode({ email, code });
  const sent = await sendOtpEmail({ to: email, code, name: profile.name });
  if (!sent.ok) {
    return Response.json({ ok: false, error: sent.error || 'email_send_failed' }, { status: 500 });
  }

  return Response.json({ ok: true, message: 'Code sent. Check your email.' });
}
