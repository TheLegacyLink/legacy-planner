import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { createHash, randomBytes } from 'crypto';
import { loadJsonStore, saveJsonStore, loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

function clean(v = '') { return String(v || '').trim(); }

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

function buildHtml({ name, telegramUrl, hubUrl, tempPassword, playbookUrl }) {
  const safeName = escapeHtml(name || 'there');
  const safeTelegram = escapeHtml(telegramUrl);
  const safeHub = escapeHtml(hubUrl);
  const safePassword = escapeHtml(tempPassword);
  const safePlaybook = escapeHtml(playbookUrl);

  return `
  <div style="margin:0;padding:24px;background:#0B1020;font-family:Arial,Helvetica,sans-serif;color:#F8FAFC;">
    <div style="max-width:680px;margin:0 auto;border:1px solid #1D428A;border-radius:14px;overflow:hidden;background:#111A33;">
      <div style="padding:20px 22px;background:linear-gradient(120deg,#1D428A,#006BB6);">
        <div style="font-size:28px;font-weight:800;letter-spacing:.4px;line-height:1.1;">THE LEGACY LINK</div>
        <div style="margin-top:6px;font-size:14px;opacity:.9;">Inner Circle Welcome</div>
      </div>

      <div style="padding:22px;line-height:1.65;">
        <p style="margin:0 0 14px;">Hi ${safeName},</p>
        <p style="margin:0 0 14px;">Welcome to <strong>The Legacy Link Inner Circle</strong>. We’re excited to have you inside.</p>

        <div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">Your onboarding steps</div>
          <ol style="margin:0 0 0 18px;padding:0;">
            <li style="margin-bottom:10px;">Log in to your Inner Circle Hub:<br/><a href="${safeHub}" style="color:#F58426;text-decoration:none;font-weight:700;">${safeHub}</a></li>
            <li style="margin-bottom:10px;"><strong>HUB Login Temporary Password:</strong><br/><span style="display:inline-block;background:#F58426;color:#0B1020;padding:6px 10px;border-radius:8px;font-weight:800;">${safePassword}</span></li>
            <li style="margin-bottom:10px;">To set your own password: log out → click <strong>Forgot Password</strong> on the login page → use the email reset link.</li>
            <li>Join the Telegram group:<br/><a href="${safeTelegram}" style="color:#F58426;text-decoration:none;font-weight:700;">${safeTelegram}</a></li>
          </ol>
        </div>

        <div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">What to do in your first 72 hours</div>
          <ul style="margin:0 0 0 18px;padding:0;">
            <li>Review Fast Start inside the hub</li>
            <li>Open Scripts and pick your primary call flow</li>
            <li>Log your first daily production activity in Tracker</li>
            <li>Drop a quick intro in Telegram</li>
          </ul>
        </div>

        <div style="margin:14px 0;padding:14px;border:1px solid #263859;border-radius:10px;background:#0D152B;">
          <div style="font-weight:700;margin-bottom:8px;color:#F58426;">Onboarding Playbook (PDF)</div>
          <p style="margin:0 0 10px;">This PDF is attached to this email. You can also download it after login from your Hub dashboard under <strong>Onboarding Playbook</strong>.</p>
          <a href="${safePlaybook}" style="display:inline-block;background:#F58426;color:#0B1020;padding:10px 14px;border-radius:8px;font-weight:800;text-decoration:none;">Download Playbook PDF</a>
        </div>

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
  const telegramUrl = clean(body?.telegramUrl || 'https://t.me/+9GyGIETNM1QxZWRh');
  const hubUrl = clean(body?.hubUrl || process.env.NEXT_PUBLIC_INNER_CIRCLE_HUB_URL || 'https://innercirclelink.com/inner-circle-hub');
  const requestedTempPassword = clean(body?.tempPassword || '');
  const tempPassword = requestedTempPassword || generateTempPassword();
  const playbookUrl = clean(body?.playbookUrl || 'https://innercirclelink.com/docs/inner-circle/legacy-link-inner-circle-onboarding-playbook-v2.pdf');
  const ghlUserId = clean(body?.ghlUserId || '');
  const autoWireOnWelcome = body?.autoWireOnWelcome !== false;

  if (!to || !telegramUrl || !hubUrl || !tempPassword || !playbookUrl) {
    return Response.json({ ok: false, error: 'missing_required_fields' }, { status: 400 });
  }

  const m = mailer();
  if (!m) return Response.json({ ok: false, error: 'mail_not_configured' }, { status: 500 });

  const subject = 'Welcome to The Legacy Link Inner Circle 🔗 — Your Access Details';
  const text = [
    `Hi ${name},`,
    '',
    'Welcome to The Legacy Link Inner Circle! Here is your onboarding access:',
    '',
    `Inner Circle Hub: ${hubUrl}`,
    `HUB Login Temporary Password: ${tempPassword}`,
    `Telegram Group: ${telegramUrl}`,
    `Onboarding Playbook (PDF): ${playbookUrl}`,
    'Where to find it in the Hub: Dashboard → Onboarding Playbook',
    'Note: The temporary password above is specifically for your HUB login.',
    '',
    'To set your own password: log out, click Forgot Password on the login page, then use the email reset link.',
    '',
    'Welcome to the movement,',
    'The Legacy Link Team'
  ].join('\n');

  const html = buildHtml({ name, telegramUrl, hubUrl, tempPassword, playbookUrl });

  try {
    const playbookPath = path.join(process.cwd(), 'public', 'docs', 'inner-circle', 'legacy-link-inner-circle-onboarding-playbook-v2.pdf');
    const attachments = fs.existsSync(playbookPath)
      ? [{ filename: 'Legacy-Link-Inner-Circle-Onboarding-Playbook.pdf', path: playbookPath }]
      : [{ filename: 'Legacy-Link-Inner-Circle-Onboarding-Playbook.pdf', path: playbookUrl }];

    const info = await m.tx.sendMail({
      from: m.from,
      to,
      subject,
      text,
      html,
      attachments
    });

    let autoWire = { ok: false, skipped: true, reason: 'disabled' };
    let hubAccess = { ok: false, skipped: true, reason: 'disabled' };
    if (autoWireOnWelcome) {
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
      autoWire,
      hubAccess
    });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
