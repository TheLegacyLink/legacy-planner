import { loadJsonStore } from '../../../../../lib/blobJsonStore';

const STORE_PATH = 'stores/unlicensed-backoffice-progress.json';

function clean(v = '') { return String(v || '').trim(); }

const STAGES = [
  { key: 'prelicensingStarted', label: 'Pre-Licensing Started' },
  { key: 'examPassed', label: 'Exam Passed' },
  { key: 'residentLicenseObtained', label: 'Resident License Obtained' },
  { key: 'licenseDetailsSubmitted', label: 'License + NPN Submitted' },
  { key: 'readyForContracting', label: 'Ready for Contracting' }
];

function stageFromSteps(steps = {}) {
  for (let i = STAGES.length - 1; i >= 0; i -= 1) {
    if (steps?.[STAGES[i].key]) return STAGES[i];
  }
  return { key: 'notStarted', label: 'Not Started' };
}

export async function GET() {
  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const nowMs = Date.now();

  const mapped = list.map((r) => {
    const steps = r?.steps || {};
    const fields = r?.fields || {};
    const done = STAGES.filter((s) => Boolean(steps?.[s.key])).length;
    const pct = Math.round((done / STAGES.length) * 100);
    const stage = stageFromSteps(steps);

    const startMs = new Date(r?.sprintStartedAt || r?.createdAt || r?.updatedAt || 0).getTime();
    const deadlineDays = Number(r?.bonusRule?.deadlineDays || 30);
    const deadlineMs = Number.isFinite(startMs) && startMs > 0 ? startMs + (deadlineDays * 24 * 60 * 60 * 1000) : 0;
    const daysLeft = deadlineMs ? Math.ceil((deadlineMs - nowMs) / (24 * 60 * 60 * 1000)) : null;

    const fullyEligible = Boolean(
      steps?.examPassed
      && steps?.residentLicenseObtained
      && steps?.licenseDetailsSubmitted
      && clean(fields?.npn)
      && deadlineMs
      && nowMs <= deadlineMs
    );

    const bonusStatus = fullyEligible
      ? 'Eligible'
      : (deadlineMs && nowMs > deadlineMs ? 'Expired' : 'In Progress');

    return {
      email: clean(r?.email).toLowerCase(),
      name: clean(r?.name),
      referrerName: clean(r?.referrerName),
      stageKey: stage.key,
      stageLabel: stage.label,
      completionPct: pct,
      residentState: clean(fields?.residentState),
      npn: clean(fields?.npn),
      sprintStartedAt: clean(r?.sprintStartedAt),
      deadlineAt: deadlineMs ? new Date(deadlineMs).toISOString() : '',
      daysLeft,
      bonusStatus,
      agentBonus: Number(r?.bonusRule?.agentBonus || 100),
      referrerBonus: Number(r?.bonusRule?.referrerBonus || 100),
      nudge7Due: Number.isFinite(startMs) && startMs > 0 ? new Date(startMs + (7 * 24 * 60 * 60 * 1000)).toISOString() : '',
      nudge14Due: Number.isFinite(startMs) && startMs > 0 ? new Date(startMs + (14 * 24 * 60 * 60 * 1000)).toISOString() : '',
      nudge21Due: Number.isFinite(startMs) && startMs > 0 ? new Date(startMs + (21 * 24 * 60 * 60 * 1000)).toISOString() : '',
      updatedAt: clean(r?.updatedAt)
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const stageCounts = mapped.reduce((acc, r) => {
    acc[r.stageLabel] = (acc[r.stageLabel] || 0) + 1;
    return acc;
  }, {});

  const bonusCounts = mapped.reduce((acc, r) => {
    acc[r.bonusStatus] = (acc[r.bonusStatus] || 0) + 1;
    return acc;
  }, {});

  return Response.json({ ok: true, rows: mapped, stageCounts, bonusCounts });
}
