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

function brandHeader() {
  const royalBlue = '#0047AB';
  return `<div style="background:${royalBlue};padding:18px 18px;text-align:center;"><div style="color:#ffffff;font-weight:800;font-size:32px;letter-spacing:.8px;line-height:1;">THE LEGACY LINK</div></div>`;
}

function defaultBrandedHtml({ subject = '', text = '' } = {}) {
  const safeSubject = escapeHtml(subject);
  const bodyHtml = escapeHtml(text).replace(/\n/g, '<br/>');
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;line-height:1.6;"><div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">${brandHeader()}<div style="padding:20px;"><h2 style="margin:0 0 12px;font-size:20px;color:#0f172a;">${safeSubject}</h2><div style="font-size:15px;">${bodyHtml}</div><p style="margin:18px 0 0;color:#475569;">— The Legacy Link Support Team</p></div></div></div>`;
}

function ensureBrandedHtml({ subject = '', text = '', html = '' } = {}) {
  const raw = String(html || '').trim();
  if (!raw) return defaultBrandedHtml({ subject, text });

  if (raw.includes('THE LEGACY LINK') && raw.includes('#0047AB')) return raw;

  const safeSubject = escapeHtml(subject);
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;line-height:1.6;"><div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">${brandHeader()}<div style="padding:20px;"><h2 style="margin:0 0 12px;font-size:20px;color:#0f172a;">${safeSubject}</h2><div style="font-size:15px;">${raw}</div><p style="margin:18px 0 0;color:#475569;">— The Legacy Link Support Team</p></div></div></div>`;
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

    const generatedHtml = ensureBrandedHtml({ subject, text, html });

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: text || undefined,
      html: generatedHtml
    });

    return Response.json({ ok: true, messageId: info.messageId });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'send_failed' }, { status: 500 });
  }
}
