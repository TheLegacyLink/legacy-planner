import nodemailer from 'nodemailer';

function getEnv(name) {
  return String(process.env[name] || '').trim();
}

export async function POST(req) {
  try {
    const body = await req.json();
    const to = String(body?.to || '').trim();
    const subject = String(body?.subject || '').trim();
    const text = String(body?.text || '').trim();

    if (!to || !subject || !text) {
      return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }

    const user = getEnv('GMAIL_APP_USER');
    const pass = getEnv('GMAIL_APP_PASSWORD');
    const from = getEnv('GMAIL_FROM') || user;

    if (!user || !pass || !from) {
      return Response.json({ ok: false, error: 'missing_gmail_env' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text
    });

    return Response.json({ ok: true, messageId: info.messageId });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'send_failed' }, { status: 500 });
  }
}
