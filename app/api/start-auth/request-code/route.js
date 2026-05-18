import { clean, generateCode, storeCode, sendOtpEmail, resolveProfileByEmail } from '../_lib';
import { loadJsonStore } from '../../../../lib/blobJsonStore';

export const dynamic = 'force-dynamic';

const ESIGN_PATH = 'stores/esign-contracts.json';
const START_INTAKE_PATH = 'stores/start-intake.json';

function norm(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }

async function hasSignedContract(email = '') {
  try {
    const rows = await loadJsonStore(ESIGN_PATH, []);
    const list = Array.isArray(rows) ? rows : [];
    return list.some((r) => norm(r?.email) === norm(email) && Boolean(r?.candidateSignedAt));
  } catch { return false; }
}

async function hasCompletedIntake(email = '') {
  try {
    const rows = await loadJsonStore(START_INTAKE_PATH, []);
    const list = Array.isArray(rows) ? rows : [];
    return list.some((r) => norm(r?.email) === norm(email));
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

  // Check if they already have a signed contract — flag for UI to show "welcome back" messaging
  const alreadySigned = await hasSignedContract(email);
  const alreadyInSystem = alreadySigned || await hasCompletedIntake(email);

  const code = generateCode();
  await storeCode({ email, code });
  const sent = await sendOtpEmail({ to: email, code, name: profile.name });
  if (!sent.ok) {
    return Response.json({ ok: false, error: sent.error || 'email_send_failed' }, { status: 500 });
  }

  return Response.json({
    ok: true,
    message: 'Code sent. Check your email.',
    alreadyRegistered: alreadyInSystem,
    trackType: profile.trackType || 'unlicensed'
  });
}
