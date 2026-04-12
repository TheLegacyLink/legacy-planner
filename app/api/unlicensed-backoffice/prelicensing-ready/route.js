import nodemailer from 'nodemailer';
import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';
import { sessionFromToken } from '../auth/_lib';

const STORE_PATH = 'stores/unlicensed-backoffice-progress.json';

function clean(v = '') { return String(v || '').trim(); }

const DEFAULT_STEPS = {
  prelicensingStarted: false,
  examPassed: false,
  residentLicenseObtained: false,
  licenseDetailsSubmitted: false,
  readyForContracting: false,
};

function getTransport() {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  if (!user || !pass) return null;
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
}

async function sendAgentConfirmationEmail({ member = {}, address = {} } = {}) {
  const tx = getTransport();
  if (!tx) return { ok: false, error: 'missing_gmail_env' };

  const firstName = clean(member?.name || '').split(' ')[0] || 'Agent';
  const from = `"The Legacy Link Pre-Licensing" <${clean(process.env.GMAIL_FROM) || clean(process.env.GMAIL_APP_USER)}>`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#070b14;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#070b14;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0F172A;border-radius:16px;border:1px solid #1e293b;overflow:hidden;">
        
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a2b4a 0%,#0d1b36 100%);padding:28px 32px;border-bottom:2px solid #C8A96B;">
            <p style="margin:0;font-size:12px;letter-spacing:2px;color:#C8A96B;text-transform:uppercase;">The Legacy Link</p>
            <h1 style="margin:8px 0 0;font-size:26px;color:#F8FAFC;">You're All Set — Pre-Licensing<br/>Credentials Coming Soon</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:16px;color:#E2E8F0;line-height:1.7;">Hi ${firstName},</p>
            <p style="margin:0 0 20px;font-size:16px;color:#E2E8F0;line-height:1.7;">You're officially on your way.</p>
            <p style="margin:0 0 20px;font-size:16px;color:#E2E8F0;line-height:1.7;">
              We've received your pre-licensing request and your course credentials will be delivered 
              to this email within <strong style="color:#C8A96B;">24 hours</strong> — no cost to you.
            </p>
            <p style="margin:0 0 20px;font-size:16px;color:#E2E8F0;line-height:1.7;">
              Once you receive your login, head straight to the course and start studying. 
              The sooner you complete it, the sooner you can sit for your exam and start earning.
            </p>
            <p style="margin:0 0 32px;font-size:16px;color:#E2E8F0;line-height:1.7;">
              If you have any questions in the meantime, reply to this email.
            </p>
            <p style="margin:0;font-size:16px;color:#E2E8F0;line-height:1.7;">
              Let's execute.<br/>
              <strong style="color:#C8A96B;">— The Legacy Link Team</strong>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #1e293b;">
            <p style="margin:0;font-size:12px;color:#475569;text-align:center;">
              The Legacy Link &nbsp;|&nbsp; Support: support@thelegacylink.com
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const info = await tx.sendMail({
    from,
    to: clean(member?.email),
    replyTo: 'prelicensing@thelegacylink.com',
    subject: "You're All Set — Pre-Licensing Credentials Coming Soon",
    html,
  });
  return { ok: true, messageId: info?.messageId || '' };
}

async function sendTriggerEmail({ member = {}, address = {} } = {}) {
  const tx = getTransport();
  if (!tx) return { ok: false, error: 'missing_gmail_env' };

  const from = `"Legacy Link System" <${clean(process.env.GMAIL_FROM) || clean(process.env.GMAIL_APP_USER)}>`;
  const firstName = clean(member?.name || '').split(' ')[0] || '';
  const lastName = clean(member?.name || '').split(' ').slice(1).join(' ') || '';

  const text = [
    `PRE-LICENSING REQUEST`,
    `First Name: ${firstName || '—'}`,
    `Last Name: ${lastName || '—'}`,
    `Email: ${clean(member?.email) || '—'}`,
    `Phone: ${clean(member?.phone) || '—'}`,
    `Home State: ${clean(member?.state) || '—'}`,
    `Street Address: ${clean(address?.street) || '—'}`,
    `City: ${clean(address?.city) || '—'}`,
    `State: ${clean(address?.state) || '—'}`,
    `Zip: ${clean(address?.zip) || '—'}`,
    `Referrer: ${clean(member?.referrerName) || '—'}`,
    `Requested At: ${new Date().toISOString()}`,
  ].join('\n');

  const info = await tx.sendMail({
    from,
    to: 'prelicensing@thelegacylink.com',
    subject: `Pre-Licensing Request: ${clean(member?.name) || 'Unknown Agent'}`,
    text,
  });
  return { ok: true, messageId: info?.messageId || '' };
}

export async function POST(req) {
  const auth = clean(req.headers.get('authorization'));
  const token = auth.toLowerCase().startsWith('bearer ') ? clean(auth.slice(7)) : '';
  const profile = await sessionFromToken(token);
  if (!profile) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const force = body?.force === true;
  const address = {
    street: clean(body?.street || ''),
    city: clean(body?.city || ''),
    state: clean(body?.state || ''),
    zip: clean(body?.zip || ''),
  };

  // Validate address fields
  if (!address.street || !address.city || !address.state || !address.zip) {
    return Response.json({ ok: false, error: 'All address fields are required.' }, { status: 400 });
  }

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => clean(r?.email).toLowerCase() === clean(profile?.email).toLowerCase());

  const base = idx >= 0 ? list[idx] : {
    email: clean(profile?.email).toLowerCase(),
    name: clean(profile?.name),
    referrerName: clean(profile?.referrerName),
    phone: clean(profile?.phone),
    sprintStartedAt: new Date().toISOString(),
    steps: { ...DEFAULT_STEPS },
    fields: {
      examPassDate: '',
      residentState: clean(profile?.state),
      residentLicenseNumber: '',
      residentLicenseActiveDate: '',
      npn: ''
    },
    bonusRule: { agentBonus: 100, referrerBonus: 100, deadlineDays: 30 }
  };

  const fields = { ...(base.fields || {}) };
  if (fields.prelicensingReadyRequestedAt && !force) {
    return Response.json({ ok: true, alreadyRequested: true, progress: base });
  }

  // Fire both emails
  const [agentResult, triggerResult] = await Promise.allSettled([
    sendAgentConfirmationEmail({ member: { ...profile, phone: clean(profile?.phone || base?.phone || '') }, address }),
    sendTriggerEmail({ member: { ...profile, phone: clean(profile?.phone || base?.phone || '') }, address }),
  ]);

  const agentOk = agentResult.status === 'fulfilled' && agentResult.value?.ok;
  const triggerOk = triggerResult.status === 'fulfilled' && triggerResult.value?.ok;

  if (!agentOk && !triggerOk) {
    return Response.json({ ok: false, error: 'email_failed' }, { status: 500 });
  }

  const now = new Date().toISOString();
  const next = {
    ...base,
    steps: { ...DEFAULT_STEPS, ...(base.steps || {}), prelicensingStarted: true },
    fields: {
      ...fields,
      prelicensingMailingAddress: address,
      prelicensingReadyRequestedAt: now,
      prelicensingAgentEmailSent: agentOk,
      prelicensingTriggerEmailSent: triggerOk,
    },
    updatedAt: now,
  };

  if (idx >= 0) list[idx] = next;
  else list.push(next);
  await saveJsonStore(STORE_PATH, list);

  return Response.json({ ok: true, notified: true, progress: next });
}
