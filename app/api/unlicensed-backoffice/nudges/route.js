import nodemailer from 'nodemailer';
import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';
import innerCircleUsers from '../../../../data/innerCircleUsers.json';
import leadClaimsUsers from '../../../../data/leadClaimsUsers.json';

const PROGRESS_PATH = 'stores/unlicensed-backoffice-progress.json';
const APPS_PATH = 'stores/sponsorship-applications.json';
const NUDGES_PATH = 'stores/unlicensed-backoffice-nudges.json';

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }

function resolveReferrerEmail(referrerName = '') {
  const n = norm(referrerName);
  if (!n) return '';
  const all = [...(Array.isArray(innerCircleUsers) ? innerCircleUsers : []), ...(Array.isArray(leadClaimsUsers) ? leadClaimsUsers : [])];
  const hit = all.find((r) => norm(r?.name || r?.fullName || `${clean(r?.firstName)} ${clean(r?.lastName)}`) === n);
  return clean(hit?.email).toLowerCase();
}

function checkpointForDays(days = 0) {
  if (days >= 21) return 'd21';
  if (days >= 14) return 'd14';
  if (days >= 7) return 'd7';
  return '';
}

function isEligible(progress = {}) {
  const steps = progress?.steps || {};
  const fields = progress?.fields || {};
  const startMs = new Date(progress?.sprintStartedAt || 0).getTime();
  const deadlineDays = Number(progress?.bonusRule?.deadlineDays || 30);
  const deadlineMs = Number.isFinite(startMs) && startMs > 0 ? startMs + (deadlineDays * 24 * 60 * 60 * 1000) : 0;
  const now = Date.now();

  const ok = Boolean(
    steps?.examPassed
    && steps?.residentLicenseObtained
    && steps?.licenseDetailsSubmitted
    && clean(fields?.npn)
    && deadlineMs
    && now <= deadlineMs
  );

  return { ok, deadlineMs };
}

async function getMailer() {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass) return null;
  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return { tx, from };
}

async function sendMail({ to = '', cc = '', subject = '', text = '', html = '' } = {}) {
  const mailer = await getMailer();
  if (!mailer) return { ok: false, error: 'missing_gmail_env' };
  const info = await mailer.tx.sendMail({ from: mailer.from, to, cc: cc || undefined, subject, text, html: html || undefined });
  return { ok: true, messageId: info?.messageId || '' };
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;

  const progressRows = await loadJsonStore(PROGRESS_PATH, []);
  const apps = await loadJsonStore(APPS_PATH, []);
  const nudges = await loadJsonStore(NUDGES_PATH, []);

  const progressList = Array.isArray(progressRows) ? progressRows : [];
  const appList = Array.isArray(apps) ? apps : [];
  const nudgeList = Array.isArray(nudges) ? nudges : [];

  const sent = [];
  const skipped = [];

  const adminEmail = clean(process.env.ADMIN_PAYOUT_NOTIFY_EMAIL || 'investalinkagency@gmail.com').toLowerCase();

  for (const p of progressList) {
    const email = clean(p?.email).toLowerCase();
    if (!email) continue;

    const startMs = new Date(p?.sprintStartedAt || p?.createdAt || p?.updatedAt || 0).getTime();
    if (!Number.isFinite(startMs) || startMs <= 0) {
      skipped.push({ email, reason: 'missing_sprint_start' });
      continue;
    }

    const days = Math.floor((Date.now() - startMs) / (24 * 60 * 60 * 1000));
    const checkpoint = checkpointForDays(days);

    const app = appList.find((a) => clean(a?.id) === clean(p?.applicationId) || clean(a?.email).toLowerCase() === email);
    const referrerName = clean(p?.referrerName || app?.referralName || app?.referredBy || '');
    const referrerEmail = resolveReferrerEmail(referrerName);

    if (checkpoint) {
      const key = `${email}:${checkpoint}`;
      const already = nudgeList.find((n) => clean(n?.key) === key && n?.sent === true);
      if (!already) {
        const subject = `Unlicensed Sprint Follow-Up (${checkpoint.toUpperCase()}): ${clean(p?.name) || email}`;
        const text = [
          `Hi ${referrerName || 'Team'},`,
          '',
          `${clean(p?.name) || email} is currently in the Unlicensed License Sprint.`,
          `Checkpoint: Day ${checkpoint.replace('d', '')}`,
          `Please support follow-through on pre-licensing, exam pass, resident license, and NPN submission.`,
          '',
          'Legacy Link Operations'
        ].join('\n');

        if (!dryRun && referrerEmail) {
          const out = await sendMail({ to: referrerEmail, subject, text });
          if (out?.ok) {
            nudgeList.push({ key, email, checkpoint, sent: true, sentAt: new Date().toISOString(), messageId: out.messageId });
            sent.push({ type: 'checkpoint', checkpoint, email, referrerEmail, messageId: out.messageId });
          } else {
            skipped.push({ type: 'checkpoint', checkpoint, email, reason: out?.error || 'send_failed' });
          }
        } else {
          sent.push({ type: 'checkpoint', checkpoint, email, referrerEmail: referrerEmail || '(missing)', dryRun: true });
        }
      }
    }

    const elig = isEligible(p);
    if (elig.ok) {
      const key = `${email}:eligible`;
      const already = nudgeList.find((n) => clean(n?.key) === key && n?.sent === true);
      if (!already) {
        const subject = `Bonus Eligible: ${clean(p?.name) || email} (Unlicensed 30-Day Sprint)`;
        const text = [
          'Bonus eligibility reached.',
          '',
          `Agent: ${clean(p?.name) || email}`,
          `Agent Bonus: $${Number(p?.bonusRule?.agentBonus || 100)}`,
          `Referrer Bonus: $${Number(p?.bonusRule?.referrerBonus || 100)}`,
          `Referrer: ${referrerName || 'Pending Mapping'}`,
          '',
          'Please review and include in payout workflow.',
          'Legacy Link Operations'
        ].join('\n');

        if (!dryRun) {
          const to = [referrerEmail].filter(Boolean).join(',');
          const out = await sendMail({ to, subject, text });
          if (out?.ok) {
            nudgeList.push({ key, email, checkpoint: 'eligible', sent: true, sentAt: new Date().toISOString(), messageId: out.messageId });
            sent.push({ type: 'eligible', email, to, messageId: out.messageId });
          } else {
            skipped.push({ type: 'eligible', email, reason: out?.error || 'send_failed' });
          }
        } else {
          sent.push({ type: 'eligible', email, to: [adminEmail, referrerEmail].filter(Boolean), dryRun: true });
        }
      }
    }
  }

  if (!dryRun) await saveJsonStore(NUDGES_PATH, nudgeList);

  return Response.json({ ok: true, dryRun, sent, skipped, sentCount: sent.length, skippedCount: skipped.length });
}
