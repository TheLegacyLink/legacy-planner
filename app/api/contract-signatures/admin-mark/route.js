import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';
import users from '../../../../data/innerCircleUsers.json';

const STORE_PATH = 'stores/contract-signatures.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function findUserByName(name = '') {
  const n = normalize(name);
  return (users || []).find((u) => u.active && normalize(u.name) === n) || null;
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const actorName = clean(body?.actorName || '');
  const applicantEmail = normalize(body?.email || body?.applicantEmail || '');
  const applicantName = clean(body?.name || body?.applicantName || '');

  if (!actorName || !applicantEmail) {
    return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const actor = findUserByName(actorName);
  if (!actor || normalize(actor.role) !== 'admin') {
    return Response.json({ ok: false, error: 'admin_only' }, { status: 403 });
  }

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => normalize(r?.email) === applicantEmail);

  const row = {
    email: applicantEmail,
    name: applicantName,
    envelopeId: clean(body?.envelopeId || ''),
    signedAt: clean(body?.signedAt || nowIso()),
    source: 'admin_manual_mark_signed',
    updatedAt: nowIso(),
    createdAt: idx >= 0 ? clean(list[idx]?.createdAt || nowIso()) : nowIso(),
    markedBy: actor.name
  };

  if (idx >= 0) list[idx] = { ...list[idx], ...row };
  else list.push(row);

  await saveJsonStore(STORE_PATH, list);
  return Response.json({ ok: true, row });
}
