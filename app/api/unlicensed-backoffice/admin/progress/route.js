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

  const mapped = list.map((r) => {
    const steps = r?.steps || {};
    const done = STAGES.filter((s) => Boolean(steps?.[s.key])).length;
    const pct = Math.round((done / STAGES.length) * 100);
    const stage = stageFromSteps(steps);
    return {
      email: clean(r?.email).toLowerCase(),
      name: clean(r?.name),
      stageKey: stage.key,
      stageLabel: stage.label,
      completionPct: pct,
      residentState: clean(r?.fields?.residentState),
      npn: clean(r?.fields?.npn),
      updatedAt: clean(r?.updatedAt)
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const stageCounts = mapped.reduce((acc, r) => {
    acc[r.stageLabel] = (acc[r.stageLabel] || 0) + 1;
    return acc;
  }, {});

  return Response.json({ ok: true, rows: mapped, stageCounts });
}
