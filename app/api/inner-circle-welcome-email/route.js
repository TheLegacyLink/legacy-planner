import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { createHash, randomBytes } from 'crypto';
import { loadJsonStore, saveJsonStore, loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

function clean(v = '') { return String(v || '').trim(); }
const execFileAsync = promisify(execFile);
const YOUTUBE_WHATEVER_IT_TAKES = 'https://youtu.be/SVvU9SvCH9o?si=nzgjgEa7DfGQlxmX';

function safeFilePart(v = '') {
  return clean(v)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'agent';
}

function buildSponsorshipUrl(base = '', ref = '') {
  const b = clean(base);
  if (!b) return '';
  const encoded = encodeURIComponent(clean(ref) || 'member');
  return b.includes('?') ? `${b}&ref=${encoded}` : `${b}?ref=${encoded}`;
}

function pdfEscape(line = '') {
  return String(line || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function generateFallbackPersonalizedPdf({ outPath = '', roleKey = '', roleLabel = '', name = '', email = '', tempPassword = '', coachName = '', hubUrl = '', appUrl = '', skoolUrl = '', contractLink = '', telegramUrl = '', playbookUrl = '', compScheduleUrl = '', sponsorshipUrl = '' } = {}) {
  if (!outPath) return null;

  const isInner = clean(roleKey) === 'inner-circle';
  const lines = [
    `THE LEGACY LINK - ${clean(roleLabel) || 'Agent'} Elite Quickstart`,
    '',
    `Agent Name: ${clean(name) || 'Not provided'}`,
    `Login Email: ${clean(email) || 'Not provided'}`,
    ...(isInner ? [`Hub Login Password: ${clean(tempPassword) || 'Not provided'}`] : []),
    `Coach Name: ${clean(coachName) || 'Legacy Link Coach'}`,
    '',
    'Step Order (Do in this order):',
    `1) Log in and sign your ICA (required first): ${clean(contractLink)}`,
    `2) Join Legacy Link App (CRM): ${clean(appUrl)}`,
    ...(isInner
      ? [
          `3) Join Telegram: ${clean(telegramUrl)}`,
          `4) Open Inner Circle Hub: ${clean(hubUrl)}`,
          '5) Complete your first 72-hour sprint'
        ]
      : [
          ...(clean(roleKey) === 'licensed' ? [`3) Join Skool Community: ${clean(skoolUrl)}`] : []),
          '3) Complete onboarding playbook + comp schedule'
        ]),
    '',
    `Playbook: ${clean(playbookUrl)}`,
    ...(isInner ? [] : [`Comp Schedule: ${clean(compScheduleUrl)}`]),
    `Your personal sponsor link to share: ${clean(sponsorshipUrl)}`,
  ];

  const content = [
    'BT',
    '/F1 11 Tf',
    '1 0 0 1 48 760 Tm',
    '14 TL',
    ...lines.flatMap((line, idx) => idx === 0
      ? [`(${pdfEscape(line)}) Tj`]
      : ['T*', `(${pdfEscape(line)}) Tj`]),
    'ET'
  ].join('\n');

  const objects = [];
  const addObj = (s) => { objects.push(s); return objects.length; };

  const fontObj = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const contentObj = addObj(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);
  const pageObj = addObj(`<< /Type /Page /Parent 4 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObj} 0 R >> >> /Contents ${contentObj} 0 R >>`);
  const pagesObj = addObj(`<< /Type /Pages /Kids [${pageObj} 0 R] /Count 1 >>`);
  const catalogObj = addObj(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);

  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(body, 'utf8');
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  body += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  fs.writeFileSync(outPath, body, 'utf8');
  return outPath;
}

function buildRefCode({ name = '', email = '' } = {}) {
  const n = clean(name).toLowerCase();
  const parts = n
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]}.${parts[parts.length - 1]}`;
  }

  const local = clean(email).toLowerCase().split('@')[0] || '';
  if (local) return local.replace(/[^a-z0-9._-]/g, '');

  return 'member';
}

const ROLE_CONFIG = {
  'inner-circle': {
    label: 'Inner Circle',
    playbookUrl: 'https://innercirclelink.com/docs/inner-circle/legacy-link-inner-circle-onboarding-playbook-v3.pdf',
    staticPlaybookPath: path.join(process.cwd(), 'public', 'docs', 'inner-circle', 'legacy-link-inner-circle-onboarding-playbook-v3.pdf'),
    fileLabel: 'Legacy-Link-Inner-Circle-Onboarding-Playbook'
  },
  licensed: {
    label: 'Licensed Agent',
    playbookUrl: 'https://innercirclelink.com/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf',
    staticPlaybookPath: path.join(process.cwd(), 'public', 'docs', 'onboarding', 'legacy-link-licensed-onboarding-playbook.pdf'),
    fileLabel: 'Legacy-Link-Licensed-Onboarding-Playbook'
  },
  unlicensed: {
    label: 'Unlicensed Agent',
    playbookUrl: 'https://innercirclelink.com/docs/onboarding/legacy-link-unlicensed-onboarding-playbook.pdf',
    staticPlaybookPath: path.join(process.cwd(), 'public', 'docs', 'onboarding', 'legacy-link-unlicensed-onboarding-playbook.pdf'),
    fileLabel: 'Legacy-Link-Unlicensed-Onboarding-Playbook'
  }
};

function normalizeRole(input = '') {
  const raw = clean(input).toLowerCase();
  // Safety default: non-inner role unless explicitly marked inner.
  if (!raw) return 'unlicensed';
  if (raw.includes('inner')) return 'inner-circle';
  if (raw.includes('unlicensed')) return 'unlicensed';
  if (raw.includes('licensed')) return 'licensed';
  return 'unlicensed';
}

function resolveRoleConfig(input = '') {
  const roleKey = normalizeRole(input);
  return { roleKey, ...(ROLE_CONFIG[roleKey] || ROLE_CONFIG.unlicensed) };
}

async function generatePersonalizedVipPdf({ roleKey, roleLabel, name, email, tempPassword, coachName, hubUrl, appUrl, skoolUrl, contractLink, telegramUrl, playbookUrl, compScheduleUrl, sponsorshipUrl }) {
  const scriptPath = path.join(process.cwd(), 'scripts', 'generate_personalized_inner_circle_playbook.py');
  if (!fs.existsSync(scriptPath)) return null;

  const outDir = path.join(os.tmpdir(), 'legacy-link-vip-playbooks');
  fs.mkdirSync(outDir, { recursive: true });

  const outFile = `${Date.now()}-${safeFilePart(name || email || 'agent')}.pdf`;
  const outPath = path.join(outDir, outFile);

  const args = [
    scriptPath,
    '--output', outPath,
    '--role', clean(roleKey || roleLabel),
    '--name', clean(name),
    '--email', clean(email),
    '--password', clean(tempPassword),
    '--coach', clean(coachName),
    '--hub', clean(hubUrl),
    '--app', clean(appUrl),
    '--skool', clean(skoolUrl),
    '--contract', clean(contractLink),
    '--telegram', clean(telegramUrl),
    '--playbook', clean(playbookUrl),
    '--comp', clean(compScheduleUrl),
    '--sponsorship', clean(sponsorshipUrl)
  ];

  try {
    await execFileAsync('python3', args, { timeout: 20000, maxBuffer: 1024 * 1024 });
    if (!fs.existsSync(outPath)) return null;
    return outPath;
  } catch {
    // Never fall back to plain-text style PDFs.
    // Returning null will trigger premium static attachment fallback in caller.
    return null;
  }
}

function mailer() {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass || !from) return null;
  return { from, tx: nodemailer.createTransport({ service: 'gmail', auth: { user, pass } }) };
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


const ONBOARDING_PATH = 'stores/agent-onboarding.json';
const LEAD_ROUTER_SETTINGS_PATH = 'stores/lead-router-settings.json';
const HUB_MEMBERS_PATH = 'stores/inner-circle-hub-members.json';

function hashPassword(v = '') { return createHash('sha256').update(clean(v)).digest('hex'); }
function nowIso() { return new Date().toISOString(); }

function defaultHubModules() {
  return {
    dashboard: true,
    faststart: true,
    scripts: true,
    execution: true,
    vault: true,
    tracker: true,
    links: true
  };
}

function normalizedHubModules(raw = {}) {
  const base = defaultHubModules();
  return {
    dashboard: raw?.dashboard !== false && base.dashboard,
    faststart: raw?.faststart !== false && base.faststart,
    scripts: raw?.scripts !== false && base.scripts,
    execution: raw?.execution !== false && base.execution,
    vault: raw?.vault !== false && base.vault,
    tracker: raw?.tracker !== false && base.tracker,
    links: raw?.links !== false && base.links
  };
}

function generateTempPassword() {
  return `LL-${randomBytes(6).toString('base64url')}!`;
}


function normalize(v = '') { return clean(v).toLowerCase(); }

async function wireInnerCircleAgentOnWelcome({ name = '', email = '', ghlUserId = '' } = {}) {
  const agentName = clean(name);
  const agentEmail = clean(email).toLowerCase();
  const agentGhlId = clean(ghlUserId);
  if (!agentName) return { ok: false, skipped: true, reason: 'missing_name' };

  const rows = await loadJsonStore(ONBOARDING_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => normalize(r?.name) === normalize(agentName));
  const now = new Date().toISOString();

  const next = {
    ...(idx >= 0 ? list[idx] : {}),
    name: agentName,
    email: agentEmail || clean(list[idx]?.email || '').toLowerCase(),
    ghlUserId: agentGhlId || clean(list[idx]?.ghlUserId || ''),
    group: 'inner',
    active: true,
    paused: false,
    delayedReleaseEnabled: true,
    capPerDay: idx >= 0 ? list[idx]?.capPerDay ?? null : null,
    capPerWeek: idx >= 0 ? list[idx]?.capPerWeek ?? null : null,
    capPerMonth: idx >= 0 ? list[idx]?.capPerMonth ?? null : null,
    updatedAt: now,
    createdAt: idx >= 0 ? clean(list[idx]?.createdAt || now) : now
  };

  if (idx >= 0) list[idx] = next;
  else list.push(next);
  await saveJsonStore(ONBOARDING_PATH, list);

  const settings = await loadJsonFile(LEAD_ROUTER_SETTINGS_PATH, {});
  const agents = Array.isArray(settings?.agents) ? settings.agents : [];
  const aIdx = agents.findIndex((a) => normalize(a?.name) === normalize(agentName));

  const syncedAgent = {
    ...(aIdx >= 0 ? agents[aIdx] : {}),
    name: agentName,
    active: true,
    paused: false,
    delayedReleaseEnabled: true,
    windowStart: clean(agents[aIdx]?.windowStart || '09:00') || '09:00',
    windowEnd: clean(agents[aIdx]?.windowEnd || '21:00') || '21:00',
    capPerDay: next.capPerDay,
    capPerWeek: next.capPerWeek,
    capPerMonth: next.capPerMonth
  };

  if (aIdx >= 0) agents[aIdx] = syncedAgent;
  else agents.push(syncedAgent);

  await saveJsonFile(LEAD_ROUTER_SETTINGS_PATH, { ...settings, agents });
  return { ok: true, wired: { name: agentName, email: next.email, hasGhlUserId: Boolean(next.ghlUserId) } };
}


async function upsertHubMemberAccessOnWelcome({ name = '', email = '', tempPassword = '' } = {}) {
  const applicantName = clean(name);
  const memberEmail = clean(email).toLowerCase();
  const password = clean(tempPassword);
  if (!memberEmail || !password) return { ok: false, skipped: true, reason: 'missing_email_or_password' };

  const rows = await loadJsonStore(HUB_MEMBERS_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => clean(r?.email).toLowerCase() === memberEmail);
  const base = idx >= 0 ? list[idx] : { id: `ich_${Date.now()}`, createdAt: nowIso() };

  const next = {
    ...base,
    bookingId: clean(base?.bookingId || `welcome_${Date.now()}`),
    applicantName: applicantName || clean(base?.applicantName || ''),
    email: memberEmail,
    passwordHash: hashPassword(password),
    active: true,
    contractSignedAt: clean(base?.contractSignedAt || nowIso()),
    paymentReceivedAt: clean(base?.paymentReceivedAt || nowIso()),
    onboardingUnlockedAt: clean(base?.onboardingUnlockedAt || nowIso()),
    modules: normalizedHubModules(base?.modules || {}),
    updatedAt: nowIso()
  };

  if (idx >= 0) list[idx] = next;
  else list.unshift(next);

  await saveJsonStore(HUB_MEMBERS_PATH, list);
  return { ok: true, memberId: clean(next.id), email: memberEmail };
}

function buildHtml({ roleKey, roleLabel, isInnerCircle, name, email, coachName, telegramUrl, appUrl, skoolUrl, hubUrl, tempPassword, playbookUrl, compScheduleUrl, contractLink, sponsorshipUrl }) {
  const safeRole = escapeHtml(roleLabel || 'Agent');
  const safeName = escapeHtml(name || 'there');
  const safeEmail = escapeHtml(email || '');
  const safeCoach = escapeHtml(coachName || 'Legacy Link Coach');
  const safeTelegram = escapeHtml(telegramUrl || '');
  const safeApp = escapeHtml(appUrl);
  const safeSkool = escapeHtml(skoolUrl || '');
  const safeHub = escapeHtml(hubUrl || '');
  const safePassword = escapeHtml(tempPassword || '');
  const safePlaybook = escapeHtml(playbookUrl);
  const safeCompSchedule = escapeHtml(compScheduleUrl || '');
  const safeContract = escapeHtml(contractLink || '');
  const safeSponsorship = escapeHtml(sponsorshipUrl || '');

  const onboardingRows = [
    `<li style="margin-bottom:10px;"><strong>Log in and sign your ICA first (required):</strong><br/><a href="${safeContract}" style="color:#F58426;text-decoration:none;font-weight:700;">Sign In &amp; Sign Your ICA &rarr;</a></li>`
  ];

  if (isInnerCircle) {
    onboardingRows.push(`<li style="margin-bottom:10px;"><strong>Join the Telegram group and send a quick intro message:</strong><br/><a href="${safeTelegram}" style="color:#F58426;text-decoration:none;font-weight:700;">${safeTelegram}</a></li>`);
    onboardingRows.push(`<li style="margin-bottom:10px;">Then log in to your Inner Circle Hub:<br/><a href="${safeHub}" style="color:#F58426;text-decoration:none;font-weight:700;">${safeHub}</a></li>`);
    if (safeSponsorship) onboardingRows.push(`<li style="margin-bottom:10px;"><strong>Your personal sponsor link to share:</strong><br/><a href="${safeSponsorship}" style="color:#F58426;text-decoration:none;font-weight:700;">${safeSponsorship}</a></li>`);
    onboardingRows.push(`<li style="margin-bottom:10px;"><strong>HUB Login Email:</strong> ${safeEmail}</li>`);
    onboardingRows.push(`<li style="margin-bottom:10px;"><strong>HUB Login Password (save this):</strong><br/><span style="display:inline-block;background:#F58426;color:#0B1020;padding:6px 10px;border-radius:8px;font-weight:800;">${safePassword}</span></li>`);
    onboardingRows.push('<li>Now move through your first 72-hour execution plan in the Hub.</li>');
  } else {
    onboardingRows.push(`<li style="margin-bottom:10px;"><strong>Open your Legacy Link Back Office:</strong><br/><a href="${safeApp}" style="color:#F58426;text-decoration:none;font-weight:700;">${safeApp}</a></li>`);
    if (safeSponsorship) onboardingRows.push(`<li style="margin-bottom:10px;"><strong>Your personal sponsor link to share:</strong><br/><a href="${safeSponsorship}" style="color:#F58426;text-decoration:none;font-weight:700;">${safeSponsorship}</a></li>`);
    if (roleKey === 'licensed' && safeSkool) onboardingRows.push(`<li style="margin-bottom:10px;"><strong>Join Skool Community (Training):</strong><br/><a href="${safeSkool}" style="color:#F58426;text-decoration:none;font-weight:700;">${safeSkool}</a></li>`);
    onboardingRows.push(`<li style="margin-bottom:10px;"><strong>Watch “Whatever It Takes” + leave a comment:</strong><br/><a href="${YOUTUBE_WHATEVER_IT_TAKES}" style="color:#F58426;text-decoration:none;font-weight:700;">${YOUTUBE_WHATEVER_IT_TAKES}</a></li>`);
    onboardingRows.push('<li>Complete the attached onboarding playbook + comp/bonus schedule and follow your coach instructions.</li>');
  }

  const first72 = isInnerCircle
    ? `<li>Review Fast Start inside the hub</li>
            <li>Open Scripts and pick your primary call flow</li>
            <li>Log your first daily production activity in Tracker</li>
            <li>Drop a quick intro in Telegram</li>`
    : `<li>Review the attached role-specific onboarding playbook</li>
            <li>Complete account setup in Legacy Link Back Office</li>
            <li>Run your first daily activity block and tracker update</li>
            <li>Connect with your coach for next production targets</li>`;

  const roleNote = isInnerCircle
    ? 'Inner Circle members also have their own back office links and resources.'
    : '';

  const roleSpecialNotice = roleKey === 'unlicensed'
    ? `<div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">Pre-Licensing Onboarding (Important)</div>
          <p style="margin:0;">Jamal leads all pre-licensing onboarding. Regardless of referral/upline, Jamal will reach out within <strong>1–3 business days</strong> to start your pre-licensing process.</p>
        </div>`
    : (roleKey === 'licensed'
      ? `<div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">Lead Activation Requirement</div>
          <p style="margin:0 0 10px;">Licensed agents begin receiving leads after full onboarding is complete and after finishing their first hour of community service.</p>
          ${safeSkool ? `<p style="margin:0 0 10px;"><strong>Skool Community:</strong> <a href="${safeSkool}" style="color:#F58426;text-decoration:none;font-weight:700;">${safeSkool}</a></p>` : ''}
          <p style="margin:0 0 6px;"><strong>Favorite carrier partners (sample):</strong></p>
          <ul style="margin:0 0 0 18px;padding:0;">
            <li>F&G</li>
            <li>Foresters</li>
            <li>Mutual of Omaha</li>
            <li>National Life Group</li>
            <li>Transamerica</li>
          </ul>
        </div>`
      : '');

  return `
  <div style="margin:0;padding:24px;background:#0B1020;font-family:Arial,Helvetica,sans-serif;color:#F8FAFC;">
    <div style="max-width:680px;margin:0 auto;border:1px solid #1D428A;border-radius:14px;overflow:hidden;background:#111A33;">
      <div style="padding:20px 22px;background:linear-gradient(120deg,#1D428A,#006BB6);">
        <div style="font-size:28px;font-weight:800;letter-spacing:.4px;line-height:1.1;">THE LEGACY LINK</div>
        <div style="margin-top:6px;font-size:14px;opacity:.9;">${safeRole} Welcome</div>
      </div>

      <div style="padding:22px;line-height:1.65;">
        <p style="margin:0 0 14px;">Hi ${safeName},</p>
        <p style="margin:0 0 14px;">Welcome to <strong>The Legacy Link ${safeRole}</strong>. We’re excited to have you inside.</p>
        <p style="margin:0 0 14px;"><strong>Your coach:</strong> ${safeCoach}</p>

        <div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">Your onboarding steps</div>
          <ol style="margin:0 0 0 18px;padding:0;">
            ${onboardingRows.join('\n')}
          </ol>
        </div>

        <div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">What to do in your first 72 hours</div>
          <ul style="margin:0 0 0 18px;padding:0;">
            ${first72}
          </ul>
        </div>

        <div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">Onboarding Documents (PDF)</div>
          <p style="margin:0 0 10px;">Your role-specific onboarding documents are attached to this email.</p>
          <a href="${safePlaybook}" style="display:inline-block;background:#F58426;color:#0B1020;padding:10px 14px;border-radius:8px;font-weight:800;text-decoration:none;margin-right:8px;">Onboarding Playbook</a>
          ${!isInnerCircle && safeCompSchedule ? `<a href="${safeCompSchedule}" style="display:inline-block;background:#C8A96B;color:#0B1020;padding:10px 14px;border-radius:8px;font-weight:800;text-decoration:none;">Comp + Bonus Schedule</a>` : ''}
          ${roleNote ? `<p style="margin:10px 0 0;color:#C9D1E1;font-size:12px;">${roleNote}</p>` : ''}
        </div>

        ${roleSpecialNotice}

        <p style="margin:0;">If you run into any access issue, reply to this email and we’ll get you handled fast.</p>
        <p style="margin:14px 0 0;"><strong>Welcome to the movement,</strong><br/>The Legacy Link Team</p>
      </div>
    </div>
  </div>`;
}


export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const to = clean(body?.to || 'kimora@thelegacylink.com');
  const name = clean(body?.name || 'Kimora');
  const roleInput = clean(body?.role || body?.agentType || body?.agentRole || (body?.licensed === true ? 'licensed' : (body?.licensed === false ? 'unlicensed' : '')));
  const roleConfig = resolveRoleConfig(roleInput);
  const isInnerCircle = roleConfig.roleKey === 'inner-circle';
  const defaultLicensedBackofficeUrl = clean(process.env.NEXT_PUBLIC_LICENSED_BACKOFFICE_URL || 'https://innercirclelink.com/licensed-backoffice');
  const defaultUnlicensedBackofficeUrl = clean(process.env.NEXT_PUBLIC_UNLICENSED_BACKOFFICE_URL || 'https://innercirclelink.com/unlicensed-backoffice');
  const defaultInnerAppUrl = clean(process.env.INNER_CIRCLE_APP_URL || 'https://legacylink.app/');
  const defaultNonInnerUrl = roleConfig.roleKey === 'unlicensed' ? defaultUnlicensedBackofficeUrl : defaultLicensedBackofficeUrl;
  const appUrl = clean(body?.appUrl || body?.customLinks?.app || (isInnerCircle ? defaultInnerAppUrl : defaultNonInnerUrl));
  const skoolUrl = clean(body?.skoolUrl || body?.customLinks?.skool || process.env.SPONSORSHIP_SKOOL_URL || 'https://www.skool.com/legacylink/about');
  const requestedTempPassword = clean(body?.tempPassword || '');
  const tempPassword = isInnerCircle ? (requestedTempPassword || generateTempPassword()) : '';
  const telegramUrl = isInnerCircle ? clean(body?.telegramUrl || body?.customLinks?.telegram || 'https://t.me/+9GyGIETNM1QxZWRh') : '';
  const hubUrl = isInnerCircle ? clean(body?.hubUrl || body?.customLinks?.hub || process.env.NEXT_PUBLIC_INNER_CIRCLE_HUB_URL || 'https://innercirclelink.com/inner-circle-hub') : '';
  const explicitPlaybookUrl = clean(body?.playbookUrl || body?.customLinks?.playbook || '');
  const playbookUrl = explicitPlaybookUrl || roleConfig.playbookUrl;
  const compScheduleUrl = clean(body?.compScheduleUrl || body?.customLinks?.compSchedule || 'https://innercirclelink.com/docs/onboarding/legacy-link-comp-schedule-bonuses-v2.pdf');
  const compSchedulePath = path.join(process.cwd(), 'public', 'docs', 'onboarding', 'legacy-link-comp-schedule-bonuses-v2.pdf');
  const contractLink = 'https://innercirclelink.com/start';
  const referredBy = clean(body?.referredBy || body?.customLinks?.referredBy || '');
  // Current chain-of-command rule: coach defaults to the referrer unless explicitly overridden.
  const coachName = clean(body?.coachName || body?.customLinks?.coachName || referredBy || 'Legacy Link Coach');
  const sponsorshipBase = clean(body?.sponsorshipUrl || body?.customLinks?.sponsorship || process.env.NEXT_PUBLIC_SPONSORSHIP_LINK_BASE || 'https://innercirclelink.com/sponsorship-signup');
  const sponsorshipRefCode = buildRefCode({ name, email: to });
  const sponsorshipUrl = buildSponsorshipUrl(sponsorshipBase, sponsorshipRefCode);
  const ghlUserId = clean(body?.ghlUserId || '');
  const autoWireOnWelcome = body?.autoWireOnWelcome !== false;

  if (!to || !playbookUrl || !contractLink || (!isInnerCircle && !appUrl) || (isInnerCircle && (!telegramUrl || !hubUrl || !tempPassword))) {
    return Response.json({ ok: false, error: 'missing_required_fields' }, { status: 400 });
  }

  const m = mailer();
  if (!m) return Response.json({ ok: false, error: 'mail_not_configured' }, { status: 500 });

  const subject = `Welcome to The Legacy Link ${roleConfig.label} 🔗 — Your Access Details`;
  const textLines = [
    `Hi ${name},`,
    '',
    `Welcome to The Legacy Link ${roleConfig.label}! Here is your onboarding access:`,
    '',
    `Step 1 (Required First): Log in and sign your ICA: ${contractLink}`
  ];

  if (isInnerCircle) {
    textLines.push(`Step 2: Join Telegram and send a quick intro message: ${telegramUrl}`);
    textLines.push(`Step 3: Inner Circle Hub: ${hubUrl}`);
    textLines.push(`HUB Login Email: ${to}`);
    textLines.push(`HUB Login Password (save this): ${tempPassword}`);
    textLines.push('Step 4: Run your first 72-hour execution plan in the Hub');
  } else if (roleConfig.roleKey === 'licensed') {
    textLines.push(`Step 2: Open your Legacy Link Back Office: ${appUrl}`);
    textLines.push(`Step 3: Join Skool Community (Training): ${skoolUrl}`);
    textLines.push(`Step 4: Watch "Whatever It Takes" and leave a comment: ${YOUTUBE_WHATEVER_IT_TAKES}`);
    textLines.push('Step 5: Complete your attached role-based onboarding playbook');
  } else {
    textLines.push(`Step 2: Open your Legacy Link Back Office: ${appUrl}`);
    textLines.push(`Step 3: Watch "Whatever It Takes" and leave a comment: ${YOUTUBE_WHATEVER_IT_TAKES}`);
    textLines.push('Step 4: Complete your attached role-based onboarding playbook');
  }

  textLines.push(`Coach: ${coachName}`);
  textLines.push(`Your Personal Sponsor Link to Share: ${sponsorshipUrl}`);
  textLines.push(`Onboarding Playbook (PDF): ${playbookUrl}`);
  if (!isInnerCircle) {
    textLines.push(`Comp + Bonus Schedule (PDF): ${compScheduleUrl}`);
  }
  if (roleConfig.roleKey === 'unlicensed') {
    textLines.push(`Required video task: Watch "Whatever It Takes" and leave a comment: ${YOUTUBE_WHATEVER_IT_TAKES}`);
    textLines.push('Pre-licensing onboarding note: Jamal leads this process for all unlicensed agents, regardless of referral/upline.');
    textLines.push('Jamal will reach out within 1–3 business days to get pre-licensing started.');
  }
  if (roleConfig.roleKey === 'licensed') {
    textLines.push(`Skool Community (Training): ${skoolUrl}`);
    textLines.push(`Required video task: Watch "Whatever It Takes" and leave a comment: ${YOUTUBE_WHATEVER_IT_TAKES}`);
    textLines.push('Lead activation note: Licensed agents start receiving leads after full onboarding is complete and after first hour of community service is completed.');
    textLines.push('Favorite carrier partners (sample): F&G, Foresters, Mutual of Omaha, National Life Group, Transamerica.');
  }
  if (isInnerCircle) {
    textLines.push('Where to find all PDFs: Inner Circle back office resource links');
  }
  textLines.push('');
  textLines.push('Welcome to the movement,');
  textLines.push('The Legacy Link Team');

  const text = textLines.join('\n');

  const html = buildHtml({ roleKey: roleConfig.roleKey, roleLabel: roleConfig.label, isInnerCircle, name, email: to, coachName, telegramUrl, appUrl, skoolUrl, hubUrl, tempPassword, playbookUrl, compScheduleUrl, contractLink, sponsorshipUrl });

  let personalizedPdfPath = '';
  try {
    const staticPlaybookPath = roleConfig.staticPlaybookPath;
    // Keep premium static template for consistency; avoid plain-text/personalized variants.
    personalizedPdfPath = '';

    let attachments = personalizedPdfPath
      ? [{ filename: `Legacy-Link-VIP-Playbook-${safeFilePart(name || to)}.pdf`, path: personalizedPdfPath }]
      : (fs.existsSync(staticPlaybookPath)
        ? [{ filename: `${roleConfig.fileLabel}.pdf`, path: staticPlaybookPath }]
        : [{ filename: `${roleConfig.fileLabel}.pdf`, path: playbookUrl }]);

    if (!isInnerCircle) {
      const compAttachment = fs.existsSync(compSchedulePath)
        ? { filename: 'Legacy-Link-Comp-Schedule-Bonuses.pdf', path: compSchedulePath }
        : { filename: 'Legacy-Link-Comp-Schedule-Bonuses.pdf', path: compScheduleUrl };
      attachments = [...attachments, compAttachment];
    }

    const info = await m.tx.sendMail({
      from: m.from,
      to,
      subject,
      text,
      html,
      attachments
    });

    let autoWire = { ok: false, skipped: true, reason: isInnerCircle ? 'disabled' : 'role_not_inner_circle' };
    let hubAccess = { ok: false, skipped: true, reason: isInnerCircle ? 'disabled' : 'role_not_inner_circle' };
    if (autoWireOnWelcome && isInnerCircle) {
      try {
        autoWire = await wireInnerCircleAgentOnWelcome({ name, email: to, ghlUserId });
      } catch (wireErr) {
        autoWire = { ok: false, error: String(wireErr?.message || wireErr) };
      }

      try {
        hubAccess = await upsertHubMemberAccessOnWelcome({ name, email: to, tempPassword });
      } catch (hubErr) {
        hubAccess = { ok: false, error: String(hubErr?.message || hubErr) };
      }
    }

    return Response.json({
      ok: true,
      messageId: info?.messageId || '',
      accepted: info?.accepted || [],
      role: roleConfig.roleKey,
      roleLabel: roleConfig.label,
      autoWire,
      hubAccess,
      personalizedPlaybookAttached: Boolean(personalizedPdfPath),
      compScheduleAttached: !isInnerCircle
    });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  } finally {
    if (personalizedPdfPath && personalizedPdfPath.includes(path.join(os.tmpdir(), 'legacy-link-vip-playbooks'))) {
      try { fs.unlinkSync(personalizedPdfPath); } catch {}
    }
  }
}
