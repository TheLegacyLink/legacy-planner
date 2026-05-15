import { loadJsonStoreDirect, saveJsonStoreDirect } from '../../../../../lib/blobJsonStore';
import { CODES_PATH, generateCode, nowIso, resolveUnlicensedProfile, sendCodeEmail, sha256 } from '../_lib';

function clean(v = '') { return String(v || '').trim(); }

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = clean(body?.email).toLowerCase();
  // fullName no longer required — email-only lookup
  if (!email) return Response.json({ ok: false, error: 'email_required' }, { status: 400 });

  const resolved = await resolveUnlicensedProfile({ email, fullName: '' });
  if (!resolved?.ok || !resolved?.profile) {
    return Response.json({ ok: false, error: 'not_found' }, { status: 403 });
  }

  const code = generateCode();
  const rows = await loadJsonStoreDirect(CODES_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const now = Date.now();

  const next = [
    ...list.filter((r) => clean(r?.email).toLowerCase() !== email && new Date(r?.expiresAt).getTime() > now),
    {
      email,
      codeHash: sha256(code),
      profile: resolved.profile,
      used: false,
      createdAt: nowIso(),
      expiresAt
    }
  ];
  await saveJsonStoreDirect(CODES_PATH, next);

  const sent = await sendCodeEmail({ to: email, code });
  if (!sent?.ok) return Response.json({ ok: false, error: sent?.error || 'send_failed' }, { status: 500 });

  return Response.json({ ok: true, expiresAt });
}
