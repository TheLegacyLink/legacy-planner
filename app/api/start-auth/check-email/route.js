import { clean, resolveProfileByEmail, getPasswordRecord } from '../_lib';
import { loadJsonStore } from '../../../../lib/blobJsonStore';

export const dynamic = 'force-dynamic';

const ESIGN_PATH = 'stores/esign-contracts.json';
const START_INTAKE_PATH = 'stores/start-intake.json';

function norm(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }

async function hasSignedContract(email = '') {
  try {
    const rows = await loadJsonStore(ESIGN_PATH, []);
    return (Array.isArray(rows) ? rows : []).some(
      (r) => norm(r?.email) === norm(email) && Boolean(r?.candidateSignedAt)
    );
  } catch { return false; }
}

async function hasCompletedIntake(email = '') {
  try {
    const rows = await loadJsonStore(START_INTAKE_PATH, []);
    return (Array.isArray(rows) ? rows : []).some((r) => norm(r?.email) === norm(email));
  } catch { return false; }
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = clean(body?.email || '').toLowerCase();

  if (!email || !email.includes('@')) {
    return Response.json({ ok: false, error: 'valid_email_required' }, { status: 400 });
  }

  const profile = await resolveProfileByEmail(email);
  if (!profile) {
    return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const pwRecord = await getPasswordRecord(email);
  const hasPassword = Boolean(pwRecord?.passwordHash);

  const alreadySigned = await hasSignedContract(email);
  const alreadyRegistered = alreadySigned || await hasCompletedIntake(email);

  return Response.json({
    ok: true,
    hasPassword,
    alreadyRegistered,
    trackType: profile.trackType || 'unlicensed'
  });
}
