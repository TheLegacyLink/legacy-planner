import { loadJsonStore, saveJsonStore } from '../../../../../lib/blobJsonStore';
import { CODES_PATH, generateCode, nowIso, resolveUnlicensedProfile, sendCodeEmail, sha256 } from '../_lib';

function clean(v = '') { return String(v || '').trim(); }

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = clean(body?.email).toLowerCase();
  const fullName = clean(body?.fullName);
  const phone = clean(body?.phone);
  if (!email) return Response.json({ ok: false, error: 'email_required' }, { status: 400 });

  const resolved = await resolveUnlicensedProfile({ email, fullName, phone });
  if (!resolved?.ok || !resolved?.profile) return Response.json({ ok: false, error: 'not_unlicensed_match' }, { status: 403 });

  const code = generateCode();
  const rows = await loadJsonStore(CODES_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const next = [
    ...list.filter((r) => clean(r?.email).toLowerCase() !== email),
    {
      email,
      codeHash: sha256(code),
      profile: resolved.profile,
      used: false,
      createdAt: nowIso(),
      expiresAt
    }
  ];
  await saveJsonStore(CODES_PATH, next);

  const sent = await sendCodeEmail({ to: email, code });
  if (!sent?.ok) return Response.json({ ok: false, error: sent?.error || 'send_failed' }, { status: 500 });

  return Response.json({ ok: true, expiresAt });
}
