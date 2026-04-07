import { clean, generateCode, storeCode, sendOtpEmail, resolveProfileByEmail } from '../_lib';

export const dynamic = 'force-dynamic';

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

  const code = generateCode();
  await storeCode({ email, code });
  const sent = await sendOtpEmail({ to: email, code, name: profile.name });
  if (!sent.ok) {
    return Response.json({ ok: false, error: sent.error || 'email_send_failed' }, { status: 500 });
  }

  return Response.json({ ok: true, message: 'Code sent. Check your email.' });
}
