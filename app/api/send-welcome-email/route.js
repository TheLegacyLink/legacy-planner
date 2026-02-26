import nodemailer from 'nodemailer';

function getEnv(name) {
  return String(process.env[name] || '').trim();
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function defaultBrandedHtml({ subject = '', text = '' } = {}) {
  const safeSubject = escapeHtml(subject);
  const bodyHtml = escapeHtml(text).replace(/\n/g, '<br/>');
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;line-height:1.6;"><div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><div style="background:#0b3b8f;color:#ffffff;padding:14px 18px;font-weight:700;">The Legacy Link</div><div style="padding:20px;"><h2 style="margin:0 0 12px;font-size:20px;color:#0f172a;">${safeSubject}</h2><div style="font-size:15px;">${bodyHtml}</div><p style="margin:18px 0 0;color:#475569;">— The Legacy Link Team</p></div></div></div>`;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const to = String(body?.to || '').trim();
    const subject = String(body?.subject || '').trim();
    const text = String(body?.text || '').trim();
    const html = String(body?.html || '').trim();

    if (!to || !subject || (!text && !html)) {
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
      text: text || undefined,
      html: html || (text ? defaultBrandedHtml({ subject, text }) : undefined)
    });

    return Response.json({ ok: true, messageId: info.messageId });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'send_failed' }, { status: 500 });
  }
}
