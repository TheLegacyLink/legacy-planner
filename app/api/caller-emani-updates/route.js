import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/caller-emani-updates.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

function normalizeName(v = '') {
  return clean(v).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizePhone(v = '') {
  return String(v || '').replace(/\D/g, '');
}

function recordKey(row = {}) {
  const id = clean(row.id || row.applicationId);
  if (id) return `id:${id}`;
  const email = clean(row.email).toLowerCase();
  if (email) return `e:${email}`;
  const phone = normalizePhone(row.phone);
  if (phone) return `p:${phone}`;
  return `n:${normalizeName(row.name || '')}`;
}

function nowIso() {
  return new Date().toISOString();
}

export async function GET() {
  const rows = await loadJsonStore(STORE_PATH, []);
  return Response.json({ ok: true, rows: Array.isArray(rows) ? rows : [] });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const mode = normalize(body?.mode || 'upsert');
  const rows = await loadJsonStore(STORE_PATH, []);

  if (mode !== 'upsert') {
    return Response.json({ ok: false, error: 'unsupported_mode' }, { status: 400 });
  }

  const status = clean(body?.status);
  if (!status) return Response.json({ ok: false, error: 'missing_status' }, { status: 400 });

  const key = recordKey({
    id: body?.id,
    applicationId: body?.applicationId,
    email: body?.email,
    phone: body?.phone,
    name: body?.name
  });

  if (!key || key === 'n:') {
    return Response.json({ ok: false, error: 'missing_identity' }, { status: 400 });
  }

  const idx = rows.findIndex((r) => clean(r.key) === key);
  const prev = idx >= 0 ? rows[idx] : null;
  const next = {
    ...(prev || {}),
    key,
    applicationId: clean(body?.applicationId || body?.id || prev?.applicationId),
    name: clean(body?.name || prev?.name),
    email: clean(body?.email || prev?.email),
    phone: clean(body?.phone || prev?.phone),
    status,
    notes: clean(body?.notes || ''),
    callCount: Number(prev?.callCount || 0) + 1,
    lastCalledAt: clean(body?.calledAt || nowIso()),
    updatedAt: nowIso()
  };

  if (idx >= 0) rows[idx] = next;
  else rows.unshift(next);

  await saveJsonStore(STORE_PATH, rows);
  return Response.json({ ok: true, row: next });
}
