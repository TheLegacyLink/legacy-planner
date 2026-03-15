import nodemailer from 'nodemailer';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/start-intake.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase(); }
function nowIso() { return new Date().toISOString(); }

function getEnv(name) { return String(process.env[name] || '').trim(); }

function escapeHtml(v = '') {
  return String(v || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function brandHeader() {
  return `<div style="background:#0047AB;padding:18px 18px;text-align:center;"><div style="color:#ffffff;font-weight:800;font-size:32px;letter-spacing:.8px;line-height:1;">THE LEGACY LINK</div></div>`;
}

function licensedWelcomeHtml({ firstName = 'Agent' } = {}) {
  const f = escapeHtml(firstName || 'Agent');
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;line-height:1.6;"><div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">${brandHeader()}<div style="padding:22px;"><h2 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Welcome to The Legacy Link</h2><p>Hi ${f},</p><p>Your <strong>licensed profile is now active</strong>. Welcome to The Legacy Link — we’re excited to have you with us.</p><p>Inside your portal, you’ll find:</p><ul style="padding-left:18px;margin:8px 0 14px;"><li>Your SOP and step-by-step onboarding path</li><li>Your financial dashboard to track commissions, pending, and payouts</li><li>Your personal referral link to share with friends and family</li><li>Your core tools to manage production and growth</li></ul><p><strong>Next step:</strong> Contact your upline directly.</p><p>If you do not know who your upline is, email:<br/><a href="mailto:support@thelegacylink.com" style="color:#1d4ed8;text-decoration:none;font-weight:700;">support@thelegacylink.com</a></p><p style="margin-top:16px;">We’re glad you’re here — let’s execute.</p><p style="margin:18px 0 0;color:#475569;">— The Legacy Link Team</p></div></div></div>`;
}

function unlicensedWelcomeHtml({ firstName = 'Agent', jamalEmail = '' } = {}) {
  const f = escapeHtml(firstName || 'Agent');
  const j = escapeHtml(jamalEmail || '');
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;line-height:1.6;"><div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">${brandHeader()}<div style="padding:22px;"><h2 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Welcome to The Legacy Link</h2><p>Hi ${f},</p><p>Welcome to <strong>The Legacy Link</strong> — we’re excited to have you here.</p><p>Your profile has been received. To begin your onboarding and confirm your next steps, please contact:</p><p style="margin:8px 0 14px;"><strong>Jamal</strong><br/><a href="mailto:${j}" style="color:#1d4ed8;text-decoration:none;font-weight:700;">${j}</a></p><p>He will guide you through where you are in the process and what to do next.</p><p style="margin-top:16px;">We’re glad you’re here — let’s execute.</p><p style="margin:18px 0 0;color:#475569;">— The Legacy Link Team</p></div></div></div>`;
}

async function sendWelcomeEmailByTrack(row = {}) {
  const user = getEnv('GMAIL_APP_USER');
  const pass = getEnv('GMAIL_APP_PASSWORD');
  const from = getEnv('GMAIL_FROM') || user;
  const to = clean(row?.email || '').toLowerCase();
  if (!to || !user || !pass || !from) return { ok: false, error: 'missing_mail_env_or_recipient' };

  const track = normalize(row?.trackType || '');
  const firstName = clean(row?.firstName || 'Agent');
  const jamalEmail = getEnv('SPONSORSHIP_UNLICENSED_COACH_EMAIL') || getEnv('JAMAL_EMAIL') || 'support@thelegacylink.com';

  const subject = track === 'licensed'
    ? 'Welcome to The Legacy Link — Your Licensed Profile Is Active'
    : 'Welcome to The Legacy Link — Let’s Get You Started';

  const text = track === 'licensed'
    ? [
        `Hi ${firstName},`,
        '',
        'Your licensed profile is now active.',
        'Inside your portal you will find your SOP, financial tracking, and your personal referral link.',
        '',
        'Next step: Contact your upline directly.',
        'If you do not know your upline, email support@thelegacylink.com.',
        '',
        '— The Legacy Link Team'
      ].join('\n')
    : [
        `Hi ${firstName},`,
        '',
        'Welcome to The Legacy Link.',
        'To begin onboarding and confirm your next steps, contact Jamal:',
        jamalEmail,
        '',
        '— The Legacy Link Team'
      ].join('\n');

  const html = track === 'licensed'
    ? licensedWelcomeHtml({ firstName })
    : unlicensedWelcomeHtml({ firstName, jamalEmail });

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const info = await tx.sendMail({ from, to, subject, text, html });
  return { ok: true, messageId: clean(info?.messageId || '') };
}

function normalizePhone(v = '') {
  const d = clean(v).replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  return d;
}

function parseStates(input) {
  const arr = Array.isArray(input)
    ? input
    : String(input || '').split(',');
  return [...new Set(arr.map((s) => clean(s).toUpperCase()).filter(Boolean))];
}

function validate(body = {}) {
  const trackType = normalize(body?.trackType || '');
  if (!['licensed', 'unlicensed'].includes(trackType)) return { ok: false, error: 'invalid_track_type' };

  const firstName = clean(body?.firstName || '');
  const lastName = clean(body?.lastName || '');
  const email = normalize(body?.email || '');
  const phone = normalizePhone(body?.phone || '');
  const homeState = clean(body?.homeState || '').toUpperCase();

  if (!firstName || !lastName) return { ok: false, error: 'missing_name' };
  if (!email || !email.includes('@')) return { ok: false, error: 'missing_valid_email' };
  if (!phone || phone.length < 10) return { ok: false, error: 'missing_valid_phone' };
  if (!homeState || homeState.length !== 2) return { ok: false, error: 'missing_home_state' };

  const npn = clean(body?.npn || '');
  const licensedStates = parseStates(body?.licensedStates || []);

  if (trackType === 'licensed') {
    if (!npn || !/^\d{6,12}$/.test(npn)) return { ok: false, error: 'missing_valid_npn' };
    if (!licensedStates.length) return { ok: false, error: 'missing_licensed_states' };
  }

  return {
    ok: true,
    value: {
      trackType,
      firstName,
      lastName,
      email,
      phone,
      homeState,
      npn: trackType === 'licensed' ? npn : '',
      licensedStates: trackType === 'licensed' ? licensedStates : []
    }
  };
}

export async function GET() {
  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  return Response.json({ ok: true, rows: list });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const check = validate(body);
  if (!check.ok) return Response.json({ ok: false, error: check.error }, { status: 400 });

  const data = check.value;
  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];

  const idx = list.findIndex((r) => normalize(r?.email) === data.email);
  const previous = idx >= 0 ? list[idx] : null;
  const ts = nowIso();

  const next = {
    id: clean(previous?.id || `intake_${Date.now()}`),
    ...data,
    source: clean(body?.source || 'community_start_portal') || 'community_start_portal',
    status: clean(previous?.status || 'intake_submitted') || 'intake_submitted',
    credentialsStatus: clean(previous?.credentialsStatus || 'pending') || 'pending',
    welcomeEmailStatus: clean(previous?.welcomeEmailStatus || 'pending') || 'pending',
    notes: clean(body?.notes || previous?.notes || ''),
    createdAt: clean(previous?.createdAt || ts),
    updatedAt: ts
  };

  // Auto-send welcome email after profile creation/update.
  const welcome = await sendWelcomeEmailByTrack(next).catch((e) => ({ ok: false, error: clean(e?.message || 'welcome_send_failed') }));
  const withWelcome = {
    ...next,
    welcomeEmailStatus: welcome?.ok ? 'sent' : 'failed',
    welcomeEmailSentAt: welcome?.ok ? nowIso() : clean(next?.welcomeEmailSentAt || ''),
    welcomeEmailError: welcome?.ok ? '' : clean(welcome?.error || ''),
    welcomeEmailMessageId: clean(welcome?.messageId || '')
  };

  if (idx >= 0) list[idx] = withWelcome;
  else list.unshift(withWelcome);

  await saveJsonStore(STORE_PATH, list);
  return Response.json({ ok: true, row: withWelcome, updatedExisting: idx >= 0, welcome });
}
