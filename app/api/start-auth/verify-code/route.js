import { clean, verifyCode, resolveProfileByEmail, issueSession } from '../_lib';

export const dynamic = 'force-dynamic';

async function maybeSendWelcomeEmail(profile) {
  try {
    // Send welcome email if account was created within the last 48 hours (new agent first login)
    const createdAt = profile?.createdAt ? new Date(profile.createdAt) : null;
    const isNew = createdAt && (Date.now() - createdAt.getTime()) < 48 * 60 * 60 * 1000;
    if (!isNew) return;

    const { default: nodemailer } = await import('nodemailer');
    const gmailUser = String(process.env.GMAIL_APP_USER || '').trim();
    const gmailPass = String(process.env.GMAIL_APP_PASSWORD || '').trim();
    const gmailFrom = String(process.env.GMAIL_FROM || gmailUser).trim();
    if (!gmailUser || !gmailPass) return;

    const firstName = String(profile?.firstName || profile?.name || 'there').split(' ')[0];
    const toEmail = String(profile?.email || '').trim();
    if (!toEmail) return;

    const tx = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });
    await tx.sendMail({
      from: gmailFrom,
      to: toEmail,
      subject: "You're officially in. Welcome to The Legacy Link. 🏆",
      html: `
        <div style="background:#0B1020;padding:48px 0;min-height:100vh;font-family:Arial,sans-serif;">
          <div style="max-width:560px;margin:0 auto;background:#111827;border-radius:12px;overflow:hidden;border:1px solid #2A3142;">
            <div style="background:linear-gradient(135deg,#C8A96B,#E6D1A6);padding:8px 24px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;color:#0B1020;">THE LEGACY LINK</p>
            </div>
            <div style="padding:40px 32px;">
              <h1 style="color:#E6D1A6;font-size:28px;margin:0 0 16px;font-weight:800;">Welcome to the Family. 🏆</h1>
              <p style="color:#cbd5e1;font-size:16px;line-height:1.6;margin:0 0 24px;">Hey ${firstName},</p>
              <p style="color:#cbd5e1;font-size:16px;line-height:1.6;margin:0 0 24px;">You just took a step most people only talk about. We're glad you're here. Watch this short message from our Founder — it'll take less than 3 minutes.</p>
              <div style="text-align:center;margin:32px 0;">
                <a href="https://innercirclelink.com/welcome" style="display:inline-block;background:linear-gradient(135deg,#C8A96B,#a0783a);color:#0B1020;text-decoration:none;padding:16px 36px;border-radius:8px;font-weight:800;font-size:16px;letter-spacing:0.5px;">Watch Your Welcome Message &rarr;</a>
              </div>
              <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 8px;">Your onboarding materials are on the way. Access your back office at <a href="https://innercirclelink.com/start" style="color:#C8A96B;">innercirclelink.com/start</a> to get started.</p>
            </div>
            <div style="padding:20px 32px;border-top:1px solid #2A3142;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">&mdash; Kimora Link, The Legacy Link</p>
            </div>
          </div>
        </div>`
    });
  } catch (err) {
    console.warn('[verify-code] welcome email failed:', err?.message);
  }
}

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

  // Fire welcome email for new agents (non-blocking)
  maybeSendWelcomeEmail(profile).catch(() => {});

  const { token, expiresAt } = await issueSession(profile);
  return Response.json({ ok: true, token, expiresAt, profile });
}
