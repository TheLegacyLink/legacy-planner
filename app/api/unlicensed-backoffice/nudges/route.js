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
  const startMs = new Date(progress?.sprintStartedAt || 0).getTime();
  const deadlineDays = Number(progress?.bonusRule?.deadlineDays || 30);
  const deadlineMs = Number.isFinite(startMs) && startMs > 0 ? startMs + (deadlineDays * 24 * 60 * 60 * 1000) : 0;
  const now = Date.now();

  const ok = Boolean(
    steps?.licenseReceived
    && deadlineMs
    && now <= deadlineMs
  );

  return { ok, deadlineMs };
}



export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const progressRows = await loadJsonStore(PROGRESS_PATH, []);
  const apps = await loadJsonStore(APPS_PATH, []);
  const nudges = await loadJsonStore(NUDGES_PATH, []);

  const progressList = Array.isArray(progressRows) ? progressRows : [];
  const appList = Array.isArray(apps) ? apps : [];
  const nudgeList = Array.isArray(nudges) ? nudges : [];

  const flagged = [];
  const skipped = [];

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
    const elig = isEligible(p);

    if (checkpoint) {
      const key = `${email}:${checkpoint}`;
      const already = nudgeList.find((n) => clean(n?.key) === key);
      if (!already) {
        // Internal flag only — no email sent. Uplink sees stuck agents via back office tracker.
        nudgeList.push({ key, email, checkpoint, flaggedAt: new Date().toISOString(), referrerName, referrerEmail });
        flagged.push({ type: 'checkpoint', checkpoint, email, days, referrerName });
      }
    }

    if (elig.ok) {
      const key = `${email}:eligible`;
      const already = nudgeList.find((n) => clean(n?.key) === key);
      if (!already) {
        // Internal flag — bonus eligible. Uplink / admin reviews in back office.
        nudgeList.push({
          key, email, checkpoint: 'eligible', flaggedAt: new Date().toISOString(),
          agentBonus: Number(p?.bonusRule?.agentBonus || 250),
          referrerBonus: Number(p?.bonusRule?.referrerBonus || 250),
          referrerName
        });
        flagged.push({ type: 'eligible', email, agentBonus: Number(p?.bonusRule?.agentBonus || 250), referrerName });
      }
    }
  }

  await saveJsonStore(NUDGES_PATH, nudgeList);

  return Response.json({ ok: true, flagged, skipped, flaggedCount: flagged.length, skippedCount: skipped.length });
}
