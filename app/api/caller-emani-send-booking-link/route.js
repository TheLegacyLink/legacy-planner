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

function brandFrame(title = '', bodyHtml = '') {
  const royalBlue = '#0047AB';
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;line-height:1.6;"><div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><div style="background:${royalBlue};padding:18px 18px;text-align:center;"><div style="color:#ffffff;font-weight:800;font-size:32px;letter-spacing:.8px;line-height:1;">THE LEGACY LINK</div></div><div style="padding:20px;"><h2 style="margin:0 0 12px;font-size:20px;color:#0f172a;">${title}</h2>${bodyHtml}<p style="margin:18px 0 0;color:#475569;">— The Legacy Link Support Team</p></div></div></div>`;
}

async function sendBrandedEmail({ to = '', subject = '', text = '', htmlBody = '' }) {
  const mailer = smtp();
  if (!mailer) return { ok: false, error: 'missing_gmail_env' };

  const html = brandFrame(subject, htmlBody || `<p style="white-space:pre-line;">${clean(text).replace(/\n/g, '<br/>')}</p>`);
  try {
    const info = await mailer.tx.sendMail({
      from: mailer.from,
      to,
      cc: 'support@thelegacylink.com',
      subject,
      text,
      html
    });
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    return { ok: false, error: error?.message || 'send_failed' };
  }
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const to = clean(body?.to);
  const applicantName = clean(body?.applicantName || 'there');
  const bookingLink = clean(body?.bookingLink);

  if (!to || !bookingLink) {
    return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const subject = 'Your Sponsorship Booking Link (Legacy Link)';

  const text = [
    `Hi ${applicantName},`,
    '',
    'Here is your booking link to lock in your sponsorship call:',
    bookingLink,
    '',
    'Please select a time within the next 5 days.',
    '',
    'If you need support, reply to this email and our team will help you.',
    '',
    '- The Legacy Link Team'
  ].join('\n');

  const htmlBody = `
    <p>Hi <strong>${applicantName}</strong>,</p>
    <p>Here is your booking link to lock in your sponsorship call:</p>
    <p><a href="${bookingLink}">${bookingLink}</a></p>
    <p>Please select a time within the next <strong>5 days</strong>.</p>
    <p>If you need support, reply to this email and our team will help you.</p>
  `;

  const out = await sendBrandedEmail({ to, subject, text, htmlBody });
  if (!out.ok) return Response.json({ ok: false, error: out.error }, { status: 502 });

  return Response.json({ ok: true, messageId: out.messageId });
}
