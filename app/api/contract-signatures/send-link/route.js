import nodemailer from 'nodemailer';
import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';

const SENDS_PATH = 'stores/contract-signature-link-sends.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalizeEmail(v = '') {
  return clean(v).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function getDocusignUrl() {
  return clean(process.env.NEXT_PUBLIC_DOCUSIGN_ICA_URL || process.env.DOCUSIGN_ICA_URL || '');
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

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const email = normalizeEmail(searchParams.get('email') || '');
  if (!email) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });

  const rows = await loadJsonStore(SENDS_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const row = list.find((r) => normalizeEmail(r?.email) === email) || null;

  return Response.json({ ok: true, row });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const applicantName = clean(body?.applicantName || '');
  const applicantEmail = normalizeEmail(body?.applicantEmail || '');
  const applicantPhone = clean(body?.applicantPhone || '');
  const applicantState = clean(body?.applicantState || '');
  const requestedByName = clean(body?.requestedByName || '');
  const requestedByEmail = clean(body?.requestedByEmail || '');

  if (!applicantEmail || !applicantName) {
    return Response.json({ ok: false, error: 'missing_applicant_fields' }, { status: 400 });
  }

  const docusignUrl = getDocusignUrl();
  if (!docusignUrl) {
    return Response.json({ ok: false, error: 'missing_docusign_url' }, { status: 500 });
  }

  const mailer = smtp();
  if (!mailer) {
    return Response.json({ ok: false, error: 'missing_gmail_env' }, { status: 500 });
  }

  const subject = 'Action Required: Sign Your Independent Contractor Agreement';
  const text = [
    `Hi ${applicantName},`,
    '',
    'Before your policy application can be submitted, your Independent Contractor Agreement must be signed.',
    '',
    'Please sign here:',
    docusignUrl,
    '',
    `Use this same email to sign: ${applicantEmail}`,
    applicantPhone ? `Phone on file: ${applicantPhone}` : '',
    applicantState ? `State on file: ${applicantState}` : '',
    '',
    'If you need help, reply to this email.',
    '',
    '— The Legacy Link Team'
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;">
      <p>Hi <strong>${applicantName}</strong>,</p>
      <p>Before your policy application can be submitted, your <strong>Independent Contractor Agreement</strong> must be signed.</p>
      <p><a href="${docusignUrl}" target="_blank" rel="noreferrer" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;">Sign Agreement in DocuSign</a></p>
      <p><strong>Use this same email to sign:</strong> ${applicantEmail}</p>
      ${applicantPhone ? `<p><strong>Phone on file:</strong> ${applicantPhone}</p>` : ''}
      ${applicantState ? `<p><strong>State on file:</strong> ${applicantState}</p>` : ''}
      <p>If you need help, reply to this email.</p>
      <p>— The Legacy Link Team</p>
    </div>
  `;

  try {
    const info = await mailer.tx.sendMail({
      from: mailer.from,
      to: applicantEmail,
      cc: requestedByEmail || undefined,
      subject,
      text,
      html
    });

    const rows = await loadJsonStore(SENDS_PATH, []);
    const list = Array.isArray(rows) ? rows : [];
    const idx = list.findIndex((r) => normalizeEmail(r?.email) === applicantEmail);
    const sentAt = nowIso();
    const rec = {
      email: applicantEmail,
      applicantName,
      applicantPhone,
      applicantState,
      requestedByName,
      requestedByEmail,
      messageId: info?.messageId || '',
      sentAt,
      updatedAt: sentAt,
      createdAt: idx >= 0 ? clean(list[idx]?.createdAt || sentAt) : sentAt
    };
    if (idx >= 0) list[idx] = { ...list[idx], ...rec };
    else list.push(rec);
    await saveJsonStore(SENDS_PATH, list);

    return Response.json({
      ok: true,
      messageId: info?.messageId || '',
      accepted: info?.accepted || [],
      requestedByName,
      requestedByEmail,
      sentAt
    });
  } catch (error) {
    return Response.json({ ok: false, error: clean(error?.message || 'send_failed') }, { status: 502 });
  }
}
