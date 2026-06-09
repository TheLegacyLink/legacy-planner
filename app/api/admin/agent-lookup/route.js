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

const BAD_EMAIL_PATTERN = /\.(con|cmo|ocm|gmal|gmial|yaho|hotmial|outlok)$/i;

function flagBadEmail(email = '') {
  if (BAD_EMAIL_PATTERN.test(email)) return `Typo detected in email address ("${email}") — they will never receive emails or OTP codes. Correct it before anything else.`;
  return null;
}

function diagnose(row, canLogin, email) {
  const badEmail = flagBadEmail(email || '');
  if (badEmail) return badEmail;
  if (!row) return 'Agent not found in the system. They may have used a different email or haven\'t started the onboarding process yet.';
  const cs = norm(row?.contractStatus || '');
  const st = norm(row?.status || '');
  if (cs !== 'signed') {
    const extra = (st === 'intake_submitted' || st === 'contract_pending')
      ? ' They have been registered but have not completed the ICA signing step. They need to go to https://innercirclelink.com/start and sign the contract before back office access unlocks.'
      : '';
    return `ICA has NOT been signed yet (status: "${cs}").${extra}`;
  }
  const nonGmail = /@(yahoo|hotmail|aol|icloud|outlook|msn|live|att\.net|rocketmail|ymail|comcast)/i.test(email || '');
  if (canLogin) {
    const spamNote = nonGmail ? ' NOTE: This is a non-Gmail address (Yahoo/Hotmail/AOL/iCloud/etc.) — OTP codes frequently land in spam. Tell the agent to check spam immediately after requesting a code.' : '';
    return `Everything looks correct. Agent can log in at https://innercirclelink.com/unlicensed-backoffice — they enter their email, then check their inbox for a 6-digit code.${spamNote}`;
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
    badEmail: !!flagBadEmail(email),
    isNonGmailProvider: /@(yahoo|hotmail|aol|icloud|outlook|msn|live|att\.net|rocketmail|ymail|comcast)/i.test(email),
    diagnosis: diagnose(intake || app, canLogin, email),
  };

  return Response.json({ ok: true, result });
}
