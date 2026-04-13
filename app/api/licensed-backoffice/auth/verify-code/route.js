import { loadJsonStore, saveJsonStore } from '../../../../../lib/blobJsonStore';
import { CODES_PATH, issueSession, resolveLicensedProfile, sha256 } from '../_lib';
import { clean } from '../../../../../lib/licensedAgentMatch';

// Training bypass accounts — fixed password login for demo/training sessions
const TRAINING_BYPASS_ACCOUNTS = [
  {
    email: 'leticiawright05@gmail.com',
    name: 'Leticia Wright',
    bypassHash: '7e1295b01b621ea3c70fe5f5f474c89216a6f4b5eb7e3e323e80e927f530be9e',
    active: true
  },
  {
    email: 'drboss637@gmail.com',
    name: 'Breanna James',
    bypassHash: '0ee34ec74b95a2bcc3b08b21e92fcad72503d95a98baa8b04b5a18a3ce53b823',
    active: true
  }
];

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = clean(body?.email).toLowerCase();
  const code = clean(body?.code);
  if (!email || !code) {
    return Response.json({ ok: false, error: 'email_and_code_required' }, { status: 400 });
  }

  // Training bypass check — if password matches, issue training-mode session (no OTP needed)
  const bypass = TRAINING_BYPASS_ACCOUNTS.find((e) => e.active && clean(e.email).toLowerCase() === email);
  if (bypass && sha256(code) === bypass.bypassHash) {
    const resolved = await resolveLicensedProfile({ email });
    const profile = resolved?.profile || { email, name: bypass.name };
    const session = await issueSession(profile, { trainingMode: true });
    return Response.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      profile: { ...profile, trainingMode: true }
    });
  }

  const rows = await loadJsonStore(CODES_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => clean(r?.email).toLowerCase() === email && r?.used !== true);
  if (idx < 0) return Response.json({ ok: false, error: 'code_not_found' }, { status: 400 });

  const row = list[idx];
  const exp = new Date(row?.expiresAt || 0);
  if (Number.isNaN(exp.getTime()) || exp.getTime() <= Date.now()) {
    return Response.json({ ok: false, error: 'code_expired' }, { status: 400 });
  }

  if (sha256(code) !== clean(row?.codeHash)) {
    return Response.json({ ok: false, error: 'invalid_code' }, { status: 400 });
  }

  list[idx] = { ...row, used: true, usedAt: new Date().toISOString() };
  await saveJsonStore(CODES_PATH, list);

  const profile = row?.profile || {};
  const session = await issueSession(profile);

  return Response.json({
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    profile
  });
}
