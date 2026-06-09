import { loadJsonStore } from '../../../../lib/blobJsonStore';
import { getAdminSkeletonPasswords } from '../../../../lib/adminSkeletonAuth';

export const dynamic = 'force-dynamic';

const INTAKE_PATH   = 'stores/start-intake.json';
const APPS_PATH     = 'stores/sponsorship-applications.json';

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase(); }

function isAdmin(req, body = {}) {
  const h = clean(req.headers.get('x-admin-key') || req.headers.get('authorization')).replace(/^Bearer\s+/i, '');
  const b = clean(body?.adminToken || '');
  return getAdminSkeletonPasswords().includes(h || b);
}

function diagnose(row, canLogin) {
  if (!row) return 'Agent not found in the system. They may have used a different email or haven\'t started the onboarding process yet.';
  const cs = norm(row?.contractStatus || '');
  if (cs !== 'signed') {
    return `ICA has NOT been signed yet (status: "${cs}"). The agent needs to go to https://innercirclelink.com/start and complete the contract signing before they can access the back office.`;
  }
  if (canLogin) {
    return `Everything looks correct. Agent can log in at https://innercirclelink.com/unlicensed-backoffice — they enter their email, then check their inbox for a 6-digit code. Make sure they check spam if they don\'t see it within 2 minutes.`;
  }
  return 'ICA is signed but the login check is failing — this may be a data integrity issue. Check the start-intake blob record directly.';
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (!isAdmin(req, body)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const email = norm(body?.email || '');
  if (!email) return Response.json({ ok: false, error: 'email_required' }, { status: 400 });

  // Search start-intake
  const intakeRows = await loadJsonStore(INTAKE_PATH, []);
  const intake = (Array.isArray(intakeRows) ? intakeRows : []).find(r => norm(r?.email) === email) || null;

  // Search sponsorship-applications
  const appRows = await loadJsonStore(APPS_PATH, []);
  const app = (Array.isArray(appRows) ? appRows : []).find(r => norm(r?.email) === email) || null;

  const row = intake || app;
  const found = !!row;

  const icaSigned = norm(intake?.contractStatus || '') === 'signed';

  // Determine if the agent can currently receive a login code
  // (mirrors resolveFromSignedIntake logic in _lib.js)
  const canLogin = !!(
    intake &&
    norm(intake?.trackType) === 'unlicensed' &&
    norm(intake?.contractStatus) === 'signed'
  );

  const result = {
    foundInSystem: found,
    icaSigned,
    canLogin,
    email: clean(intake?.email || app?.email || '').toLowerCase(),
    name: intake
      ? clean(`${clean(intake?.firstName)} ${clean(intake?.lastName)}`)
      : clean(`${clean(app?.firstName)} ${clean(app?.lastName)}`),
    phone: clean(intake?.phone || app?.phone || ''),
    homeState: clean(intake?.homeState || app?.state || ''),
    trackType: clean(intake?.trackType || (app ? 'unlicensed' : '')),
    source: clean(intake?.source || ''),
    contractStatus: clean(intake?.contractStatus || 'not_in_intake'),
    contractSignedAt: clean(intake?.contractSignedAt || ''),
    status: clean(intake?.status || app?.status || ''),
    credentialsStatus: clean(intake?.credentialsStatus || ''),
    welcomeEmailStatus: clean(intake?.welcomeEmailStatus || ''),
    welcomeEmailSentAt: clean(intake?.welcomeEmailSentAt || ''),
    createdAt: clean(intake?.createdAt || app?.submitted_at || ''),
    referredBy: clean(intake?.referredBy || app?.referralName || app?.referredByName || ''),
    inSponsorshipApps: !!app,
    diagnosis: diagnose(intake || app, canLogin),
  };

  return Response.json({ ok: true, result });
}
