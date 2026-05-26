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

const MOBILE_STYLES = `
  @media only screen and (max-width:620px) {
    .ll-outer { padding: 8px !important; }
    .ll-card { border-radius: 10px !important; }
    .ll-header { padding: 16px !important; }
    .ll-header-title { font-size: 22px !important; }
    .ll-body { padding: 16px !important; }
    .ll-btn { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; margin: 0 0 8px 0 !important; }
    .ll-mono { font-size: 12px !important; }
    .ll-h2 { font-size: 18px !important; }
  }
`;

function mobileWrap(innerHtml = '') {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><meta http-equiv="X-UA-Compatible" content="IE=edge"/><style>${MOBILE_STYLES}</style></head><body style="margin:0;padding:0;background:#f8fafc;">${innerHtml}</body></html>`;
}

function brandHeader() {
  const royalBlue = '#0047AB';
  return `<div class="ll-header" style="background:${royalBlue};padding:18px 22px;text-align:center;"><div class="ll-header-title" style="color:#ffffff;font-weight:800;font-size:28px;letter-spacing:.8px;line-height:1;">THE LEGACY LINK</div></div>`;
}

function defaultBrandedHtml({ subject = '', text = '' } = {}) {
  const safeSubject = escapeHtml(subject);
  const bodyHtml = escapeHtml(text).replace(/\n/g, '<br/>');
  const inner = `<div class="ll-outer" style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:16px;color:#0f172a;line-height:1.6;"><div class="ll-card" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;width:100%;">${brandHeader()}<div class="ll-body" style="padding:22px;"><h2 class="ll-h2" style="margin:0 0 12px;font-size:20px;color:#0f172a;">${safeSubject}</h2><div style="font-size:15px;line-height:1.7;">${bodyHtml}</div><p style="margin:18px 0 0;color:#475569;">— The Legacy Link Support Team</p></div></div></div>`;
  return mobileWrap(inner);
}

function ensureBrandedHtml({ subject = '', text = '', html = '' } = {}) {
  const raw = String(html || '').trim();
  if (!raw) return defaultBrandedHtml({ subject, text });

  // Already a full document — inject mobile styles into head if missing
  if (raw.startsWith('<!DOCTYPE') || raw.startsWith('<html')) {
    if (raw.includes('ll-outer') || raw.includes('@media')) return raw;
    return raw.replace('</head>', `<style>${MOBILE_STYLES}</style></head>`);
  }

  // Bare branded div — wrap it
  if (raw.includes('THE LEGACY LINK')) {
    return mobileWrap(raw.replace('<div style="margin:0;padding:24px;', '<div class="ll-outer" style="margin:0;padding:16px;').replace('max-width:680px;', 'max-width:640px;width:100%;'));
  }

  const safeSubject = escapeHtml(subject);
  const inner = `<div class="ll-outer" style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:16px;color:#0f172a;line-height:1.6;"><div class="ll-card" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;width:100%;">${brandHeader()}<div class="ll-body" style="padding:22px;"><h2 class="ll-h2" style="margin:0 0 12px;font-size:20px;color:#0f172a;">${safeSubject}</h2><div style="font-size:15px;line-height:1.7;">${raw}</div><p style="margin:18px 0 0;color:#475569;">— The Legacy Link Support Team</p></div></div></div>`;
  return mobileWrap(inner);
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
