import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';
import { sessionFromToken } from '../auth/_lib';

const STORE_PATH = 'stores/unlicensed-backoffice-progress.json';

function clean(v = '') { return String(v || '').trim(); }

const DEFAULT_STEPS = {
  prelicensingStarted: false,
  examPassed: false,
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
      residentState: clean(profile?.state),
      residentLicenseNumber: '',
      residentLicenseActiveDate: '',
      npn: ''
    },
    bonusRule: { agentBonus: 100, referrerBonus: 100, deadlineDays: 30 },
    updatedAt: ''
  };

  const progress = idx >= 0 ? { ...fallback, ...(list[idx] || {}), steps: { ...DEFAULT_STEPS, ...((list[idx] || {}).steps || {}) }, fields: { ...fallback.fields, ...((list[idx] || {}).fields || {}) } } : fallback;

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
      residentState: clean(profile?.state),
      residentLicenseNumber: '',
      residentLicenseActiveDate: '',
      npn: ''
    },
    bonusRule: { agentBonus: 100, referrerBonus: 100, deadlineDays: 30 }
  };

  const next = {
    ...base,
    bonusRule: { agentBonus: 100, referrerBonus: 100, deadlineDays: 30, ...(base.bonusRule || {}) },
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
  if (next.steps.residentLicenseObtained) {
    if (!clean(next.fields.residentState) || !clean(next.fields.residentLicenseNumber)) {
      return Response.json({ ok: false, error: 'resident_license_fields_required' }, { status: 400 });
    }
  }
  if (next.steps.licenseDetailsSubmitted && !clean(next.fields.npn)) {
    return Response.json({ ok: false, error: 'npn_required' }, { status: 400 });
  }

  if (idx >= 0) list[idx] = next;
  else list.push(next);
  await saveJsonStore(STORE_PATH, list);

  return Response.json({ ok: true, progress: next });
}
