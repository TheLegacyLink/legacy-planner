import { loadJsonStore, saveJsonStore } from '../../../../../lib/blobJsonStore';
import { CODES_PATH, issueSession, sha256 } from '../_lib';
import { clean } from '../../../../../lib/licensedAgentMatch';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = clean(body?.email).toLowerCase();
  const code = clean(body?.code);
  if (!email || !code) {
    return Response.json({ ok: false, error: 'email_and_code_required' }, { status: 400 });
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
