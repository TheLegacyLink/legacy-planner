import { loadJsonStore, saveJsonStore } from '../../../../../lib/blobJsonStore';
import { CODES_PATH, generateCode, nowIso, resolveLicensedProfile, sendCodeEmail, sha256 } from '../_lib';
import { clean } from '../../../../../lib/licensedAgentMatch';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = clean(body?.email).toLowerCase();
  const fullName = clean(body?.fullName);
  const phone = clean(body?.phone);

  if (!email) {
    return Response.json({ ok: false, error: 'email_required' }, { status: 400 });
  }

  const resolved = await resolveLicensedProfile({ email, fullName, phone });
  if (!resolved?.ok || !resolved?.profile) {
    const err = resolved?.error || 'not_licensed';
    const status = String(err).startsWith('pending_verification') ? 202 : 403;
    return Response.json({ ok: false, error: err, candidates: resolved?.candidates || [] }, { status });
  }

  const code = generateCode();
  const codeHash = sha256(code);
  const expiresAt = new Date(Date.now() + (10 * 60 * 1000)).toISOString();

  const rows = await loadJsonStore(CODES_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const next = [
    ...list.filter((r) => clean(r?.email).toLowerCase() !== email),
    {
      email,
      codeHash,
      profile: resolved.profile,
      via: resolved.via,
      createdAt: nowIso(),
      expiresAt,
      used: false
    }
  ];
  await saveJsonStore(CODES_PATH, next);

  const sent = await sendCodeEmail({ to: email, code });
  if (!sent?.ok) {
    return Response.json({ ok: false, error: sent?.error || 'email_send_failed' }, { status: 500 });
  }

  return Response.json({ ok: true, expiresAt, via: resolved.via });
}
