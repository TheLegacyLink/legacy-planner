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
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;line-height:1.6;"><div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><div style="background:${royalBlue};padding:18px;text-align:center;"><div style="color:#ffffff;font-weight:800;font-size:32px;letter-spacing:.8px;line-height:1;">THE LEGACY LINK</div></div><div style="padding:20px;"><h2 style="margin:0 0 12px;font-size:20px;color:#0f172a;">${title}</h2>${bodyHtml}<p style="margin:18px 0 0;color:#475569;">— The Legacy Link Support Team</p></div></div></div>`;
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
  if (!to) return Response.json({ ok: false, error: 'missing_to' }, { status: 400 });

  const standaloneLink = 'https://innercirclelink.com/caller-emani?standalone=1';
  const passcode = 'EmaniCalls!2026';

  const subject = 'Emani Follow-Up Workflow: Approved Not Booked (Start Today)';

  const text = [
    'Hi Emani,',
    '',
    'Starting now, please work this queue:',
    `Link: ${standaloneLink}`,
    `Passcode: ${passcode}`,
    '',
    'Your objective: call every approved-not-booked person and get them booked in 48 hours.',
    '',
    'After each call:',
    '1) Choose call status',
    '2) Add optional note',
    '3) Click Log Call Update',
    '',
    'If they need the booking link:',
    '- Click Send Booking Link',
    '- Confirm their email',
    '- Stay on the line until they book',
    '',
    'Call script (short):',
    '"Hey, this is Emani from The Legacy Link. Congratulations on your sponsorship approval. Your next step is onboarding. Do you have a specific time that works best for you this week? If so, I can send your booking link now — can you confirm your best email?"',
    '',
    'Thank you.'
  ].join('\n');

  const htmlBody = `
    <p>Hi <strong>Emani</strong>,</p>
    <p>Starting now, please work this queue:</p>
    <ul>
      <li><strong>Link:</strong> <a href="${standaloneLink}">${standaloneLink}</a></li>
      <li><strong>Passcode:</strong> ${passcode}</li>
    </ul>

    <p><strong>Your objective:</strong> call every approved-not-booked person and get them booked in 48 hours.</p>

    <p><strong>After each call:</strong></p>
    <ol>
      <li>Choose call status</li>
      <li>Add optional note</li>
      <li>Click <strong>Log Call Update</strong></li>
    </ol>

    <p><strong>If they need the booking link:</strong></p>
    <ul>
      <li>Click <strong>Send Booking Link</strong></li>
      <li>Confirm their email address</li>
      <li>Stay on the line until they complete booking</li>
    </ul>

    <p><strong>Call script (short):</strong><br/>
    “Hey, this is Emani from The Legacy Link. Congratulations on your sponsorship approval. Your next step is onboarding. Do you have a specific time that works best for you this week? If so, I can send your booking link now — can you confirm your best email?”</p>
  `;

  const out = await sendBrandedEmail({ to, subject, text, htmlBody });
  if (!out.ok) return Response.json({ ok: false, error: out.error }, { status: 502 });

  return Response.json({ ok: true, messageId: out.messageId });
}
