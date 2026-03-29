import nodemailer from 'nodemailer';
import innerCircleUsers from '../../../../data/innerCircleUsers.json';
import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';
import { sessionFromToken } from '../auth/_lib';

const STORE_PATH = 'stores/unlicensed-backoffice-progress.json';

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }

const DEFAULT_STEPS = {
  prelicensingStarted: false,
  examPassed: false,
  residentLicenseObtained: false,
  licenseDetailsSubmitted: false,
  readyForContracting: false,
};

function resolveJamalEmail() {
  const fromEnv = clean(process.env.SPONSORSHIP_UNLICENSED_COACH_EMAIL || process.env.SPONSORSHIP_JAMAL_EMAIL || '');
  if (fromEnv) return fromEnv.toLowerCase();
  const hit = (Array.isArray(innerCircleUsers) ? innerCircleUsers : []).find((u) => norm(u?.name || u?.fullName || '') === 'jamal holmes');
  return clean(hit?.email || 'support@thelegacylink.com').toLowerCase();
}

async function sendReadyEmail({ member = {}, jamalEmail = '' } = {}) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass) return { ok: false, error: 'missing_gmail_env' };

  const subject = `Unlicensed Back Office: Ready to Start Pre-Licensing — ${clean(member?.name) || 'Agent'}`;
  const text = [
    'Hi Jamal,',
    '',
    `${clean(member?.name) || 'An unlicensed agent'} clicked \"I\'m Ready\" in the Unlicensed Back Office and is ready to start pre-licensing.`,
    '',
    `Name: ${clean(member?.name) || '—'}`,
    `Email: ${clean(member?.email) || '—'}`,
    `State: ${clean(member?.state) || '—'}`,
    `Referrer: ${clean(member?.referrerName) || '—'}`,
    '',
    'Please help this person get started within the next 48 hours.',
    '',
    'Thank you,',
    'The Legacy Link Support Team'
  ].join('\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.6;">
      <p>Hi Jamal,</p>
      <p><strong>${clean(member?.name) || 'An unlicensed agent'}</strong> clicked <strong>"I\'m Ready"</strong> in the Unlicensed Back Office and is ready to start pre-licensing.</p>
      <ul>
        <li><strong>Name:</strong> ${clean(member?.name) || '—'}</li>
        <li><strong>Email:</strong> ${clean(member?.email) || '—'}</li>
        <li><strong>State:</strong> ${clean(member?.state) || '—'}</li>
        <li><strong>Referrer:</strong> ${clean(member?.referrerName) || '—'}</li>
      </ul>
      <p><strong>Please help this person get started within the next 48 hours.</strong></p>
      <p>Thank you,<br/>Legacy Link Support Team</p>
    </div>`;

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const info = await tx.sendMail({ from, to: jamalEmail, subject, text, html });
  return { ok: true, messageId: info?.messageId || '' };
}

export async function POST(req) {
  const auth = clean(req.headers.get('authorization'));
  const token = auth.toLowerCase().startsWith('bearer ') ? clean(auth.slice(7)) : '';
  const profile = await sessionFromToken(token);
  if (!profile) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const force = body?.force === true;

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => clean(r?.email).toLowerCase() === clean(profile?.email).toLowerCase());

  const base = idx >= 0 ? list[idx] : {
    email: clean(profile?.email).toLowerCase(),
    name: clean(profile?.name),
    referrerName: clean(profile?.referrerName),
    sprintStartedAt: clean(profile?.sessionCreatedAt) || new Date().toISOString(),
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

  const jamalEmail = resolveJamalEmail();
  const emailResult = await sendReadyEmail({ member: profile, jamalEmail }).catch((e) => ({ ok: false, error: clean(e?.message || 'email_failed') }));
  if (!emailResult?.ok) {
    return Response.json({ ok: false, error: emailResult?.error || 'email_failed' }, { status: 500 });
  }

  const now = new Date().toISOString();
  const next = {
    ...base,
    steps: {
      ...DEFAULT_STEPS,
      ...(base.steps || {}),
      prelicensingStarted: true,
    },
    fields: {
      ...fields,
      prelicensingReadyRequestedAt: now,
      prelicensingReadyEmailTo: jamalEmail,
      prelicensingReadyEmailMessageId: clean(emailResult?.messageId || ''),
    },
    updatedAt: now,
  };

  if (idx >= 0) list[idx] = next;
  else list.push(next);
  await saveJsonStore(STORE_PATH, list);

  return Response.json({ ok: true, notified: true, jamalEmail, progress: next });
}
