import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/start-intake.json';
const CONTRACT_SIGNATURES_PATH = 'stores/contract-signatures.json';
const DEFAULT_LICENSED_ONBOARDING_PLAYBOOK_RELATIVE_PATH = 'public/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf';
const DEFAULT_UNLICENSED_ONBOARDING_PLAYBOOK_RELATIVE_PATH = 'public/docs/onboarding/legacy-link-unlicensed-onboarding-playbook.pdf';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase(); }
function normalizeName(v = '') { return normalize(v).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
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
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#040B23;padding:24px;color:#E5E7EB;line-height:1.6;"><div style="max-width:860px;margin:0 auto;background:#0B1534;border:1px solid #1E3A8A;border-radius:18px;overflow:hidden;box-shadow:0 14px 34px rgba(0,0,0,0.35);"><div style="padding:18px 24px;background:#1651AE;text-align:center;"><div style="color:#FFFFFF;font-weight:800;font-size:42px;line-height:1;letter-spacing:1px;">THE LEGACY LINK</div></div><div style="padding:28px 30px;"><h2 style="margin:0 0 14px;font-size:34px;line-height:1.1;color:#F8FAFC;">Licensed Agent — Execute Your Next Steps</h2><p style="margin:0 0 8px;color:#E2E8F0;font-size:24px;">Hi ${f},</p><p style="margin:0 0 10px;color:#CBD5E1;font-size:19px;">Welcome to The Legacy Link.</p><p style="margin:0 0 14px;color:#CBD5E1;font-size:19px;">We’re excited to have you here and looking forward to helping you build. You’ve already taken an important step, and now it’s time to get everything in place so you can move with clarity, confidence, and speed.</p><p style="margin:0 0 14px;color:#E2E8F0;font-size:19px;font-weight:700;">Please complete the steps below so we can get you fully set up:</p><div style="background:#071235;border:1px solid #294B8D;border-radius:14px;padding:18px 20px;"><ol style="margin:0;padding-left:28px;color:#E2E8F0;font-size:21px;line-height:1.45;"><li style="margin-bottom:12px;"><strong>Back Office Access (Start Here):</strong><br/><a href="https://innercirclelink.com/start" target="_blank" rel="noopener noreferrer" style="color:#FB923C;text-decoration:underline;font-weight:700;">https://innercirclelink.com/start</a></li><li style="margin-bottom:12px;"><strong>Contracting:</strong><br/>See PDF attached:<br/><a href="https://innercirclelink.com/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf" target="_blank" rel="noopener noreferrer" style="color:#FB923C;text-decoration:underline;font-weight:700;">Licensed Agent Onboarding PDF</a></li><li style="margin-bottom:12px;"><strong>Skool Community:</strong><br/><a href="https://www.skool.com/legacylink/about" target="_blank" rel="noopener noreferrer" style="color:#FB923C;text-decoration:underline;font-weight:700;">https://www.skool.com/legacylink/about</a></li><li><strong>YouTube (Whatever It Takes):</strong><br/><a href="https://youtu.be/SVvU9SvCH9o?si=nzgjgEa7DfGQlxmX" target="_blank" rel="noopener noreferrer" style="color:#FB923C;text-decoration:underline;font-weight:700;">https://youtu.be/SVvU9SvCH9o?si=nzgjgEa7DfGQlxmX</a></li></ol></div></div></div></div>`;
}

function unlicensedWelcomeHtml({ firstName = 'Agent', jamalEmail = '' } = {}) {
  const f = escapeHtml(firstName || 'Agent');
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#040B23;padding:24px;color:#E5E7EB;line-height:1.6;"><div style="max-width:860px;margin:0 auto;background:#0B1534;border:1px solid #1E3A8A;border-radius:18px;overflow:hidden;box-shadow:0 14px 34px rgba(0,0,0,0.35);"><div style="padding:18px 24px;background:#1651AE;text-align:center;"><div style="color:#FFFFFF;font-weight:800;font-size:42px;line-height:1;letter-spacing:1px;">THE LEGACY LINK</div></div><div style="padding:28px 30px;"><h2 style="margin:0 0 14px;font-size:34px;line-height:1.1;color:#F8FAFC;">Unlicensed Agent — Execute Your Next Steps</h2><p style="margin:0 0 8px;color:#E2E8F0;font-size:24px;">Hi ${f},</p><p style="margin:0 0 10px;color:#CBD5E1;font-size:19px;">Welcome to The Legacy Link.</p><p style="margin:0 0 14px;color:#CBD5E1;font-size:19px;">We’re excited to have you here and looking forward to helping you build. You do not need to have everything figured out today — that’s what we’re here for. Our goal is to help you get started the right way, move quickly through the process, and put you in position to grow.</p><p style="margin:0 0 14px;color:#E2E8F0;font-size:19px;font-weight:700;">Please complete the steps below so we can get you started:</p><div style="background:#071235;border:1px solid #294B8D;border-radius:14px;padding:18px 20px;"><ol style="margin:0;padding-left:28px;color:#E2E8F0;font-size:21px;line-height:1.45;"><li style="margin-bottom:12px;"><strong>Back Office Access (Start Here):</strong><br/><a href="https://innercirclelink.com/start" target="_blank" rel="noopener noreferrer" style="color:#60A5FA;text-decoration:underline;font-weight:700;">https://innercirclelink.com/start</a></li><li style="margin-bottom:12px;"><strong>Skool Community:</strong><br/><a href="https://www.skool.com/legacylink/about" target="_blank" rel="noopener noreferrer" style="color:#60A5FA;text-decoration:underline;font-weight:700;">https://www.skool.com/legacylink/about</a></li><li><strong>YouTube (Whatever It Takes):</strong><br/><a href="https://youtu.be/SVvU9SvCH9o?si=nzgjgEa7DfGQlxmX" target="_blank" rel="noopener noreferrer" style="color:#60A5FA;text-decoration:underline;font-weight:700;">https://youtu.be/SVvU9SvCH9o?si=nzgjgEa7DfGQlxmX</a></li></ol></div></div></div></div>`;
}

function playbookMetaByTrack(track = '') {
  if (normalize(track) === 'licensed') {
    return {
      playbookUrl: 'https://innercirclelink.com/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf',
      staticPlaybookPath: path.join(process.cwd(), DEFAULT_LICENSED_ONBOARDING_PLAYBOOK_RELATIVE_PATH),
      filename: 'legacy-link-licensed-onboarding-playbook.pdf'
    };
  }

  return {
    playbookUrl: 'https://innercirclelink.com/docs/onboarding/legacy-link-unlicensed-onboarding-playbook.pdf',
    staticPlaybookPath: path.join(process.cwd(), DEFAULT_UNLICENSED_ONBOARDING_PLAYBOOK_RELATIVE_PATH),
    filename: 'legacy-link-unlicensed-onboarding-playbook.pdf'
  };
}

function buildPlaybookAttachments(track = '') {
  const meta = playbookMetaByTrack(track);
  if (!meta?.staticPlaybookPath || !fs.existsSync(meta.staticPlaybookPath)) return [];
  return [{ filename: meta.filename, path: meta.staticPlaybookPath }];
}

function contractRequiredHtml({ firstName = 'Agent', contractLink = '', track = 'unlicensed', jamalEmail = '' } = {}) {
  const f = escapeHtml(firstName || 'Agent');
  const link = escapeHtml(contractLink || '');
  const jamal = escapeHtml(jamalEmail || '');
  const contactLine = track === 'licensed'
    ? '<p style="margin-top:10px;">After signing, contact your upline. If you do not know your upline, email <a href="mailto:support@thelegacylink.com" style="color:#1d4ed8;text-decoration:none;font-weight:700;">support@thelegacylink.com</a>.</p>'
    : `<p style="margin-top:10px;">After signing, contact Jamal at <a href="mailto:${jamal}" style="color:#1d4ed8;text-decoration:none;font-weight:700;">${jamal}</a> for your onboarding next steps.</p>`;

  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;line-height:1.6;"><div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">${brandHeader()}<div style="padding:22px;"><h2 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Action Required: Sign Your Legacy Link Contract</h2><p>Hi ${f},</p><p>Welcome to The Legacy Link — before we can move your profile forward, please sign the contract below.</p><p><a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;">Sign Contract</a></p>${contactLine}<p style="margin-top:16px;">Once complete, we’ll mark your status as signed and continue activation.</p><p style="margin:18px 0 0;color:#475569;">— The Legacy Link Team</p></div></div></div>`;
}

async function resolveContractStatus({ email = '', firstName = '', lastName = '' } = {}) {
  const rows = await loadJsonStore(CONTRACT_SIGNATURES_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const e = normalize(email);
  const n = normalizeName(`${firstName} ${lastName}`);

  let row = null;
  let matchedBy = '';
  if (e) {
    row = list.find((r) => normalize(r?.email || '') === e) || null;
    if (row) matchedBy = 'email';
  }
  if (!row && n) {
    row = list.find((r) => normalizeName(r?.name || '') === n) || null;
    if (row) matchedBy = 'name';
  }

  const signedAt = clean(row?.signedAt || row?.signed_at || row?.completedAt || row?.completed_at || '');
  return {
    signed: Boolean(signedAt),
    signedAt,
    matchedBy,
    envelopeId: clean(row?.envelopeId || ''),
    contractRowName: clean(row?.name || '')
  };
}


async function sendWelcomeEmailByTrack(row = {}, options = {}) {
  const user = getEnv('GMAIL_APP_USER');
  const pass = getEnv('GMAIL_APP_PASSWORD');
  const from = getEnv('GMAIL_FROM') || user;
  const to = clean(row?.email || '').toLowerCase();
  if (!to || !user || !pass || !from) return { ok: false, error: 'missing_mail_env_or_recipient' };

  const track = normalize(row?.trackType || '');
  const firstName = clean(row?.firstName || 'Agent');
  const jamalEmail = getEnv('SPONSORSHIP_UNLICENSED_COACH_EMAIL') || getEnv('JAMAL_EMAIL') || 'support@thelegacylink.com';
  const contractLink = getEnv('NEXT_PUBLIC_DOCUSIGN_ICA_URL') || getEnv('DOCUSIGN_ICA_URL') || 'https://thelegacylink.com/contract-agreement';
  const contractRequired = options?.contractRequired === true;
  const playbookMeta = playbookMetaByTrack(track);
  const attachments = buildPlaybookAttachments(track);

  const subject = contractRequired
    ? 'Action Required: Sign Your Legacy Link Contract'
    : (track === 'licensed' ? 'Licensed Agent — Execute Your Next Steps' : 'Unlicensed Agent — Execute Your Next Steps');

  const text = contractRequired
    ? [
        `Hi ${firstName},`,
        '',
        'Welcome to The Legacy Link.',
        'Before we can move your profile forward, please sign your contract:',
        contractLink,
        '',
        (track === 'licensed'
          ? 'After signing, contact your upline. If unknown, email support@thelegacylink.com.'
          : `After signing, contact Jamal: ${jamalEmail}`),
        '',
        `Onboarding PDF (also attached): ${playbookMeta.playbookUrl}`,
        '',
        '— The Legacy Link Team'
      ].join('\n')
    : (track === 'licensed'
      ? [
          `Hi ${firstName},`,
          '',
          'Welcome to The Legacy Link.',
          '',
          'We’re excited to have you here and looking forward to helping you build. You’ve already taken an important step, and now it’s time to get everything in place so you can move with clarity, confidence, and speed.',
          '',
          'Please complete the steps below so we can get you fully set up:',
          '',
          '1) Back Office Access: https://innercirclelink.com/start',
          '2) Contracting: See PDF attached',
          '3) Skool Community: https://www.skool.com/legacylink/about',
          '4) YouTube (Whatever It Takes): https://youtu.be/SVvU9SvCH9o?si=nzgjgEa7DfGQlxmX',
          '',
          `Onboarding PDF (also attached): ${playbookMeta.playbookUrl}`,
          '',
          '— The Legacy Link Team'
        ].join('\n')
      : [
          `Hi ${firstName},`,
          '',
          'Welcome to The Legacy Link.',
          '',
          'We’re excited to have you here and looking forward to helping you build. You do not need to have everything figured out today — that’s what we’re here for. Our goal is to help you get started the right way, move quickly through the process, and put you in position to grow.',
          '',
          'Please complete the steps below so we can get you started:',
          '',
          '1) Back Office Access: https://innercirclelink.com/start',
          '2) Skool Community: https://www.skool.com/legacylink/about',
          '3) YouTube (Whatever It Takes): https://youtu.be/SVvU9SvCH9o?si=nzgjgEa7DfGQlxmX',
          '',
          `Onboarding PDF (also attached): ${playbookMeta.playbookUrl}`,
          '',
          '— The Legacy Link Team'
        ].join('\n'));

  const html = contractRequired
    ? contractRequiredHtml({ firstName, contractLink, track, jamalEmail })
    : (track === 'licensed' ? licensedWelcomeHtml({ firstName }) : unlicensedWelcomeHtml({ firstName, jamalEmail }));

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const info = await tx.sendMail({ from, to, subject, text, html, attachments });
  return { ok: true, messageId: clean(info?.messageId || ''), subject };
}

function normalizePhone(v = '') {
  const d = clean(v).replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  return d;
}

function normalizeBirthDate(v = '') {
  const raw = clean(v);
  if (!raw) return '';
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const dt = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return '';
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (dt.getTime() > todayUtc.getTime()) return '';
  return `${m[1]}-${m[2]}-${m[3]}`;
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
  const birthDate = normalizeBirthDate(body?.birthDate || body?.birthday || body?.dob || '');
  const homeState = clean(body?.homeState || '').toUpperCase();

  if (!firstName || !lastName) return { ok: false, error: 'missing_name' };
  if (!email || !email.includes('@')) return { ok: false, error: 'missing_valid_email' };
  if (!phone || phone.length < 10) return { ok: false, error: 'missing_valid_phone' };
  if (!birthDate) return { ok: false, error: 'missing_valid_birth_date' };
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
      birthDate,
      homeState,
      npn: trackType === 'licensed' ? npn : '',
      licensedStates: trackType === 'licensed' ? licensedStates : []
    }
  };
}

export async function GET() {
  const [rows, sigRows] = await Promise.all([
    loadJsonStore(STORE_PATH, []),
    loadJsonStore(CONTRACT_SIGNATURES_PATH, [])
  ]);
  const list = Array.isArray(rows) ? rows : [];
  const sigList = Array.isArray(sigRows) ? sigRows : [];

  const sigByEmail = new Map();
  const sigByName = new Map();
  for (const s of sigList) {
    const em = normalize(s?.email || '');
    const nm = normalizeName(s?.name || '');
    if (em) sigByEmail.set(em, s);
    if (nm) sigByName.set(nm, s);
  }

  let patched = 0;
  for (let i = 0; i < list.length; i += 1) {
    const r = list[i] || {};
    if (clean(r?.contractStatus || '').toLowerCase() === 'signed') continue;

    const em = normalize(r?.email || '');
    const nm = normalizeName(`${r?.firstName || ''} ${r?.lastName || ''}`);
    const hit = (em && sigByEmail.get(em)) || (nm && sigByName.get(nm));
    if (!hit) continue;

    list[i] = {
      ...r,
      contractStatus: 'signed',
      contractSignedAt: clean(hit?.signedAt || nowIso()),
      contractMatchedBy: em && sigByEmail.get(em) ? 'email' : 'name',
      status: 'contract_complete',
      credentialsStatus: clean(r?.credentialsStatus || 'pending') === 'blocked_contract' ? 'pending' : clean(r?.credentialsStatus || 'pending'),
      updatedAt: nowIso()
    };
    patched += 1;
  }

  if (patched > 0) await saveJsonStore(STORE_PATH, list);

  list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  return Response.json({ ok: true, rows: list, patched });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = normalize(body?.action || 'submit');

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];

  if (action === 'admin_mark_contract') {
    const actorEmail = normalize(body?.actorEmail || '');
    if (actorEmail !== 'kimora@thelegacylink.com') {
      return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const id = clean(body?.id || '');
    const email = normalize(body?.email || '');
    const signed = Boolean(body?.signed);

    const idx = list.findIndex((r) => (id && clean(r?.id) === id) || (email && normalize(r?.email) === email));
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    const current = list[idx] || {};
    const ts = nowIso();

    let next = {
      ...current,
      contractStatus: signed ? 'signed' : 'pending',
      contractSignedAt: signed ? (clean(current?.contractSignedAt || ts)) : '',
      contractMatchedBy: signed ? 'manual_override' : '',
      status: signed ? 'contract_complete' : 'contract_pending',
      credentialsStatus: signed ? clean(current?.credentialsStatus || 'pending') : 'blocked_contract',
      contractOverrideBy: actorEmail,
      contractOverrideAt: ts,
      updatedAt: ts
    };

    let welcome = { ok: false, skipped: true };
    if (signed) {
      welcome = await sendWelcomeEmailByTrack(next, { contractRequired: false }).catch((e) => ({ ok: false, error: clean(e?.message || 'welcome_send_failed') }));
      next = {
        ...next,
        welcomeEmailStatus: welcome?.ok ? 'sent' : 'failed',
        welcomeEmailSentAt: welcome?.ok ? ts : clean(next?.welcomeEmailSentAt || ''),
        welcomeEmailError: welcome?.ok ? '' : clean(welcome?.error || ''),
        welcomeEmailMessageId: clean(welcome?.messageId || ''),
        lastEmailTemplate: 'welcome'
      };
    }

    list[idx] = next;
    await saveJsonStore(STORE_PATH, list);
    return Response.json({ ok: true, row: next, welcome, updatedExisting: true });
  }

  const check = validate(body);
  if (!check.ok) return Response.json({ ok: false, error: check.error }, { status: 400 });

  const data = check.value;

  const idx = list.findIndex((r) => normalize(r?.email) === data.email);
  const previous = idx >= 0 ? list[idx] : null;
  const ts = nowIso();

  const next = {
    id: clean(previous?.id || `intake_${Date.now()}`),
    ...data,
    source: clean(body?.source || 'community_start_portal') || 'community_start_portal',
    status: clean(previous?.status || 'intake_submitted') || 'intake_submitted',
    credentialsStatus: clean(previous?.credentialsStatus || 'pending') || 'pending',
    contractStatus: clean(previous?.contractStatus || 'pending') || 'pending',
    contractSignedAt: clean(previous?.contractSignedAt || ''),
    contractMatchedBy: clean(previous?.contractMatchedBy || ''),
    welcomeEmailStatus: clean(previous?.welcomeEmailStatus || 'pending') || 'pending',
    notes: clean(body?.notes || previous?.notes || ''),
    createdAt: clean(previous?.createdAt || ts),
    updatedAt: ts
  };

  const contract = await resolveContractStatus({ email: next.email, firstName: next.firstName, lastName: next.lastName });
  // Initial onboarding emails should always use the track-specific “Execute Your Next Steps” template.
  const contractRequired = false;

  const patched = {
    ...next,
    contractStatus: contract.signed ? 'signed' : 'pending',
    contractSignedAt: clean(contract.signedAt || ''),
    contractMatchedBy: clean(contract.matchedBy || ''),
    status: contract.signed ? 'contract_complete' : 'contract_pending',
    credentialsStatus: contract.signed ? clean(next?.credentialsStatus || 'pending') : 'blocked_contract'
  };

  // Auto-send email after profile creation/update (contract-required email if unsigned, welcome email if signed).
  const welcome = await sendWelcomeEmailByTrack(patched, { contractRequired }).catch((e) => ({ ok: false, error: clean(e?.message || 'welcome_send_failed') }));
  const withWelcome = {
    ...patched,
    welcomeEmailStatus: welcome?.ok ? 'sent' : 'failed',
    welcomeEmailSentAt: welcome?.ok ? nowIso() : clean(next?.welcomeEmailSentAt || ''),
    welcomeEmailError: welcome?.ok ? '' : clean(welcome?.error || ''),
    welcomeEmailMessageId: clean(welcome?.messageId || ''),
    lastEmailTemplate: contractRequired ? 'contract_required' : 'welcome'
  };

  if (idx >= 0) list[idx] = withWelcome;
  else list.unshift(withWelcome);

  await saveJsonStore(STORE_PATH, list);
  return Response.json({ ok: true, row: withWelcome, updatedExisting: idx >= 0, welcome });
}
