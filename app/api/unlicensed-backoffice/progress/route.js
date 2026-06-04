import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';
import { sessionFromToken } from '../auth/_lib';

const STORE_PATH = 'stores/unlicensed-backoffice-progress.json';

function clean(v = '') { return String(v || '').trim(); }

const DEFAULT_STEPS = {
  backOfficeAccess: false,
  communitySkool: false,
  jamalContacted: false,
  prelicensingStarted: false,
  examScheduled: false,
  examPassed: false,
  licenseReceived: false,
  watchedWhateverItTakes: false,
  // legacy keys kept for backward compat
  residentLicenseObtained: false,
  licenseDetailsSubmitted: false,
  readyForContracting: false,
};

export async function GET(req) {
  const auth = clean(req.headers.get('authorization'));
  const token = auth.toLowerCase().startsWith('bearer ') ? clean(auth.slice(7)) : '';
  const profile = await sessionFromToken(token);
  if (!profile) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => clean(r?.email).toLowerCase() === clean(profile?.email).toLowerCase());

  const fallback = {
    email: clean(profile?.email).toLowerCase(),
    name: clean(profile?.name),
    referrerName: clean(profile?.referrerName),
    sprintStartedAt: clean(profile?.sessionCreatedAt) || new Date().toISOString(),
    steps: { ...DEFAULT_STEPS },
    fields: {
      examPassDate: '',
      examScheduledDate: '',
      residentState: clean(profile?.state),
      residentLicenseNumber: '',
      residentLicenseActiveDate: '',
      npn: '',
      licenseNumber: '',
      licenseReceivedDate: ''
    },
    bonusRule: { agentBonus: 250, referrerBonus: 250, deadlineDays: 30 },
    updatedAt: ''
  };

  const progress = idx >= 0 ? { ...fallback, ...(list[idx] || {}), steps: { ...DEFAULT_STEPS, ...((list[idx] || {}).steps || {}) }, fields: { ...fallback.fields, ...((list[idx] || {}).fields || {}) }, bonusRule: { agentBonus: 250, referrerBonus: 250, deadlineDays: 30 } } : fallback;

  if (idx < 0) {
    await saveJsonStore(STORE_PATH, [...list, progress]);
  }

  return Response.json({ ok: true, profile, progress });
}

export async function POST(req) {
  const auth = clean(req.headers.get('authorization'));
  const token = auth.toLowerCase().startsWith('bearer ') ? clean(auth.slice(7)) : '';
  const profile = await sessionFromToken(token);
  if (!profile) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const stepsIn = body?.steps || {};
  const fieldsIn = body?.fields || {};

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
      examScheduledDate: '',
      residentState: clean(profile?.state),
      residentLicenseNumber: '',
      residentLicenseActiveDate: '',
      npn: '',
      licenseNumber: '',
      licenseReceivedDate: ''
    },
    bonusRule: { agentBonus: 250, referrerBonus: 250, deadlineDays: 30 }
  };

  const next = {
    ...base,
    bonusRule: { agentBonus: 250, referrerBonus: 250, deadlineDays: 30 },
    steps: {
      ...DEFAULT_STEPS,
      ...(base.steps || {}),
      ...(typeof stepsIn === 'object' ? stepsIn : {})
    },
    fields: {
      ...(base.fields || {}),
      ...(typeof fieldsIn === 'object' ? fieldsIn : {})
    },
    updatedAt: new Date().toISOString()
  };

  if (next.steps.examPassed && !clean(next.fields.examPassDate)) {
    return Response.json({ ok: false, error: 'exam_pass_date_required' }, { status: 400 });
  }
  if (next.steps.licenseReceived && !clean(next.fields.licenseReceivedDate)) {
    return Response.json({ ok: false, error: 'license_received_date_required' }, { status: 400 });
  }

  if (idx >= 0) list[idx] = next;
  else list.push(next);
  await saveJsonStore(STORE_PATH, list);

  return Response.json({ ok: true, progress: next });
}
