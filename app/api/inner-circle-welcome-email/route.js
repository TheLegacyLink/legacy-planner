import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

function clean(v = '') { return String(v || '').trim(); }

function mailer() {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass || !from) return null;
  return { from, tx: nodemailer.createTransport({ service: 'gmail', auth: { user, pass } }) };
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml({ name, telegramUrl, hubUrl, tempPassword, playbookUrl }) {
  const safeName = escapeHtml(name || 'there');
  const safeTelegram = escapeHtml(telegramUrl);
  const safeHub = escapeHtml(hubUrl);
  const safePassword = escapeHtml(tempPassword);
  const safePlaybook = escapeHtml(playbookUrl);

  return `
  <div style="margin:0;padding:24px;background:#0B1020;font-family:Arial,Helvetica,sans-serif;color:#F8FAFC;">
    <div style="max-width:680px;margin:0 auto;border:1px solid #1D428A;border-radius:14px;overflow:hidden;background:#111A33;">
      <div style="padding:20px 22px;background:linear-gradient(120deg,#1D428A,#006BB6);">
        <div style="font-size:28px;font-weight:800;letter-spacing:.4px;line-height:1.1;">THE LEGACY LINK</div>
        <div style="margin-top:6px;font-size:14px;opacity:.9;">Inner Circle Welcome</div>
      </div>

      <div style="padding:22px;line-height:1.65;">
        <p style="margin:0 0 14px;">Hi ${safeName},</p>
        <p style="margin:0 0 14px;">Welcome to <strong>The Legacy Link Inner Circle</strong>. We’re excited to have you inside.</p>

        <div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">Your onboarding steps</div>
          <ol style="margin:0 0 0 18px;padding:0;">
            <li style="margin-bottom:10px;">Join the Telegram group:<br/><a href="${safeTelegram}" style="color:#F58426;text-decoration:none;font-weight:700;">${safeTelegram}</a></li>
            <li style="margin-bottom:10px;">Log in to your Inner Circle Hub:<br/><a href="${safeHub}" style="color:#F58426;text-decoration:none;font-weight:700;">${safeHub}</a></li>
            <li style="margin-bottom:10px;">Use your temporary password:<br/><span style="display:inline-block;background:#F58426;color:#0B1020;padding:6px 10px;border-radius:8px;font-weight:800;">${safePassword}</span></li>
            <li>After first login, update your password for security.</li>
          </ol>
        </div>

        <div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">What to do in your first 72 hours</div>
          <ul style="margin:0 0 0 18px;padding:0;">
            <li>Review Fast Start inside the hub</li>
            <li>Open Scripts and pick your primary call flow</li>
            <li>Log your first daily production activity in Tracker</li>
            <li>Drop a quick intro in Telegram</li>
          </ul>
        </div>

        <div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">Onboarding Playbook (PDF)</div>
          <p style="margin:0 0 10px;">This PDF is attached to this email. You can also download it after login in the Hub under <strong>My Links → Onboarding Playbook PDF</strong>.</p>
          <a href="${safePlaybook}" style="display:inline-block;background:#F58426;color:#0B1020;padding:10px 14px;border-radius:8px;font-weight:800;text-decoration:none;">Download Playbook PDF</a>
        </div>

        <p style="margin:0;">If you run into any access issue, reply to this email and we’ll get you handled fast.</p>
        <p style="margin:14px 0 0;"><strong>Welcome to the movement,</strong><br/>The Legacy Link Team</p>
      </div>
    </div>
  </div>`;
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const to = clean(body?.to || 'kimora@thelegacylink.com');
  const name = clean(body?.name || 'Kimora');
  const telegramUrl = clean(body?.telegramUrl || 'https://t.me/+9GyGIETNM1QxZWRh');
  const hubUrl = clean(body?.hubUrl || process.env.NEXT_PUBLIC_INNER_CIRCLE_HUB_URL || 'https://innercirclelink.com/inner-circle-hub');
  const tempPassword = clean(body?.tempPassword || 'LegacyLink!2026');
  const playbookUrl = clean(body?.playbookUrl || 'https://innercirclelink.com/docs/inner-circle/legacy-link-inner-circle-onboarding-playbook.pdf');

  if (!to || !telegramUrl || !hubUrl || !tempPassword || !playbookUrl) {
    return Response.json({ ok: false, error: 'missing_required_fields' }, { status: 400 });
  }

  const m = mailer();
  if (!m) return Response.json({ ok: false, error: 'mail_not_configured' }, { status: 500 });

  const subject = 'Welcome to The Legacy Link Inner Circle 🔗 — Your Access Details';
  const text = [
    `Hi ${name},`,
    '',
    'Welcome to The Legacy Link Inner Circle! Here is your onboarding access:',
    '',
    `Telegram Group: ${telegramUrl}`,
    `Inner Circle Hub: ${hubUrl}`,
    `Temporary Password: ${tempPassword}`,
    `Onboarding Playbook (PDF): ${playbookUrl}`,
    'Where to find it in the Hub: My Links → Onboarding Playbook PDF',
    '',
    'After first login, update your password for security.',
    '',
    'Welcome to the movement,',
    'The Legacy Link Team'
  ].join('\n');

  const html = buildHtml({ name, telegramUrl, hubUrl, tempPassword, playbookUrl });

  try {
    const playbookPath = path.join(process.cwd(), 'public', 'docs', 'inner-circle', 'legacy-link-inner-circle-onboarding-playbook.pdf');
    const attachments = fs.existsSync(playbookPath)
      ? [{ filename: 'Legacy-Link-Inner-Circle-Onboarding-Playbook.pdf', path: playbookPath }]
      : [{ filename: 'Legacy-Link-Inner-Circle-Onboarding-Playbook.pdf', path: playbookUrl }];

    const info = await m.tx.sendMail({
      from: m.from,
      to,
      subject,
      text,
      html,
      attachments
    });

    return Response.json({ ok: true, messageId: info?.messageId || '', accepted: info?.accepted || [] });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
