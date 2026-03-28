import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function clean(v = '') {
  return String(v || '').trim();
}

function escapeHtml(v = '') {
  return String(v || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mailer() {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass || !from) return null;
  return { from, tx: nodemailer.createTransport({ service: 'gmail', auth: { user, pass } }) };
}

function subjectLine() {
  return 'Your Legacy Link Onboarding Path Is Ready 🔗';
}

function buildText({ name = 'there', startUrl = 'https://innercirclelink.com/start', supportEmail = 'support@thelegacylink.com' } = {}) {
  return [
    `Hi ${name},`,
    '',
    'Welcome to The Legacy Link.',
    '',
    'Your onboarding path is ready. Use the secure link below to choose your route:',
    startUrl,
    '',
    'Choose one path:',
    '- Licensed Route: For currently licensed agents',
    '- Unlicensed Route: For those starting the licensing path',
    '',
    'What to expect next:',
    '1) Complete your intake profile',
    '2) Receive your role-based onboarding steps',
    '3) Get access instructions and next actions',
    '',
    `Questions? Reply to this email or contact ${supportEmail}`,
    '',
    'The Legacy Link Support Team'
  ].join('\n');
}

function buildHtml({ name = 'there', startUrl = 'https://innercirclelink.com/start', supportEmail = 'support@thelegacylink.com' } = {}) {
  const safeName = escapeHtml(name);
  const safeStart = escapeHtml(startUrl);
  const safeSupport = escapeHtml(supportEmail);

  return `
  <div style="margin:0;padding:24px;background:#0B1020;font-family:Arial,Helvetica,sans-serif;color:#F8FAFC;">
    <div style="max-width:700px;margin:0 auto;border:1px solid #1D428A;border-radius:14px;overflow:hidden;background:#111A33;">
      <div style="padding:20px 22px;background:linear-gradient(120deg,#1D428A,#006BB6);">
        <div style="font-size:32px;font-weight:800;letter-spacing:.7px;line-height:1;">THE LEGACY LINK</div>
        <div style="margin-top:8px;font-size:14px;opacity:.92;">Build Your Legacy With Intention.</div>
      </div>

      <div style="padding:24px;line-height:1.65;">
        <p style="margin:0 0 14px;">Hi ${safeName},</p>

        <p style="margin:0 0 14px;">
          Your onboarding access is ready. You can start now by selecting the correct onboarding path below.
        </p>

        <div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">Start Here</div>
          <a href="${safeStart}" style="display:inline-block;background:#F58426;color:#0B1020;padding:11px 16px;border-radius:8px;font-weight:800;text-decoration:none;white-space:nowrap;">Choose Your Onboarding&nbsp;Path</a>
        </div>

        <div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">Path Options</div>
          <ul style="margin:0 0 0 18px;padding:0;">
            <li><strong>Licensed Route</strong> — for agents who are currently licensed</li>
            <li><strong>Unlicensed Route</strong> — for agents beginning the licensing path</li>
          </ul>
        </div>

        <div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">What Happens Next</div>
          <ol style="margin:0 0 0 18px;padding:0;">
            <li style="margin-bottom:8px;">Complete your intake profile</li>
            <li style="margin-bottom:8px;">Receive role-based onboarding instructions</li>
            <li>Get your access steps and next actions</li>
          </ol>
        </div>

        <p style="margin:0 0 8px;">If you need help, reply to this email or contact <a href="mailto:${safeSupport}" style="color:#F58426;text-decoration:none;font-weight:700;">${safeSupport}</a>.</p>
        <p style="margin:12px 0 0;"><strong>The Legacy Link Support Team</strong></p>
      </div>
    </div>
  </div>`;
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const to = clean(body?.to);
  const name = clean(body?.name || 'there');
  const startUrl = clean(body?.startUrl || 'https://innercirclelink.com/start');
  const supportEmail = clean(body?.supportEmail || 'support@thelegacylink.com');
  const dryRun = Boolean(body?.dryRun);

  if (!to && !dryRun) {
    return Response.json({ ok: false, error: 'missing_to' }, { status: 400 });
  }

  const subject = subjectLine();
  const text = buildText({ name, startUrl, supportEmail });
  const html = buildHtml({ name, startUrl, supportEmail });

  if (dryRun) {
    return Response.json({
      ok: true,
      templateKey: 'onboarding_without_sponsorship',
      templateName: 'Onboarding Without Sponsorship',
      subject,
      text,
      html,
      startUrl
    });
  }

  const m = mailer();
  if (!m) return Response.json({ ok: false, error: 'mail_not_configured' }, { status: 500 });

  try {
    const info = await m.tx.sendMail({
      from: m.from,
      to,
      subject,
      text,
      html
    });

    return Response.json({
      ok: true,
      templateKey: 'onboarding_without_sponsorship',
      templateName: 'Onboarding Without Sponsorship',
      to,
      messageId: clean(info?.messageId || ''),
      accepted: info?.accepted || []
    });
  } catch (error) {
    return Response.json({ ok: false, error: clean(error?.message || 'send_failed') || 'send_failed' }, { status: 500 });
  }
}
