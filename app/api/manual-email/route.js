import nodemailer from 'nodemailer';

function clean(v = '') {
  return String(v || '').trim();
}

function smtp() {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass || !from) return null;
  return {
    from,
    tx: nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  };
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const to = clean(body?.to);
  const cc = clean(body?.cc);
  const subject = clean(body?.subject);
  const text = clean(body?.text);
  const html = clean(body?.html);

  if (!to || !subject || (!text && !html)) {
    return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const mailer = smtp();
  if (!mailer) return Response.json({ ok: false, error: 'missing_gmail_env' }, { status: 500 });

  try {
    const info = await mailer.tx.sendMail({
      from: mailer.from,
      to,
      cc: cc || undefined,
      subject,
      text: text || undefined,
      html: html || undefined
    });

    return Response.json({ ok: true, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'send_failed' }, { status: 502 });
  }
}
