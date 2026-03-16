export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/team-hierarchy.json';

function clean(v = '') {
  return String(v || '').trim();
}

function norm(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function personKey(name = '', email = '') {
  const em = norm(email);
  if (em) return `em:${em}`;
  const nm = norm(name).replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, '_');
  return nm ? `nm:${nm}` : '';
}

function nowIso() {
  return new Date().toISOString();
}

function toTree(rows = [], rootKey = '') {
  const byParent = new Map();
  for (const r of rows) {
    const p = clean(r?.parentKey);
    if (!p) continue;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(r);
  }

  const direct = byParent.get(rootKey) || [];
  const descendants = [];
  const queue = [...direct];
  while (queue.length) {
    const node = queue.shift();
    descendants.push(node);
    const kids = byParent.get(clean(node?.childKey)) || [];
    queue.push(...kids);
  }

  return { direct, descendants };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const viewerName = clean(searchParams.get('viewerName') || searchParams.get('name') || '');
  const viewerEmail = clean(searchParams.get('viewerEmail') || searchParams.get('email') || '').toLowerCase();
  const rowsRaw = await loadJsonStore(STORE_PATH, []);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : [];

  const rootKey = personKey(viewerName, viewerEmail);
  const tree = rootKey ? toTree(rows, rootKey) : { direct: [], descendants: [] };

  return Response.json({ ok: true, rootKey, rows, direct: tree.direct, descendants: tree.descendants });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const parentName = clean(body?.parentName || body?.referredByName || '');
  const parentEmail = clean(body?.parentEmail || body?.referredByEmail || '').toLowerCase();
  const childName = clean(body?.childName || body?.applicantName || '');
  const childEmail = clean(body?.childEmail || body?.applicantEmail || '').toLowerCase();
  const source = clean(body?.source || 'manual') || 'manual';
  const lastAppType = clean(body?.lastAppType || body?.policyType || body?.appType || '');
  const eventAt = clean(body?.eventAt || body?.submittedAt || nowIso());

  if (!parentName && !parentEmail) return Response.json({ ok: false, error: 'missing_parent' }, { status: 400 });
  if (!childName && !childEmail) return Response.json({ ok: false, error: 'missing_child' }, { status: 400 });

  const parentKey = personKey(parentName, parentEmail);
  const childKey = personKey(childName, childEmail);
  if (!parentKey || !childKey) return Response.json({ ok: false, error: 'invalid_identity' }, { status: 400 });
  if (parentKey === childKey) return Response.json({ ok: false, error: 'self_parent_not_allowed' }, { status: 400 });

  const rowsRaw = await loadJsonStore(STORE_PATH, []);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : [];

  const idx = rows.findIndex((r) => clean(r?.childKey) === childKey);
  const stamp = nowIso();

  const next = {
    id: idx >= 0 ? clean(rows[idx]?.id) : `th_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    parentKey,
    parentName: parentName || clean(rows[idx]?.parentName || ''),
    parentEmail: parentEmail || clean(rows[idx]?.parentEmail || ''),
    childKey,
    childName: childName || clean(rows[idx]?.childName || ''),
    childEmail: childEmail || clean(rows[idx]?.childEmail || ''),
    source,
    rating: Number(body?.rating ?? (idx >= 0 ? rows[idx]?.rating : 0)) || 0,
    note: clean(body?.note ?? (idx >= 0 ? rows[idx]?.note : '')),
    lastAppType: lastAppType || clean(rows[idx]?.lastAppType || ''),
    lastEventAt: eventAt || clean(rows[idx]?.lastEventAt || stamp),
    createdAt: idx >= 0 ? clean(rows[idx]?.createdAt || stamp) : stamp,
    updatedAt: stamp
  };

  if (idx >= 0) rows[idx] = next;
  else rows.unshift(next);

  await saveJsonStore(STORE_PATH, rows);
  return Response.json({ ok: true, row: next });
}

export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  const id = clean(body?.id || '');
  if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const rowsRaw = await loadJsonStore(STORE_PATH, []);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : [];
  const idx = rows.findIndex((r) => clean(r?.id) === id);
  if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  rows[idx] = {
    ...rows[idx],
    rating: Number((body?.rating ?? rows[idx]?.rating ?? 0)) || 0,
    note: clean((body?.note ?? rows[idx]?.note) || ''),
    updatedAt: nowIso()
  };

  await saveJsonStore(STORE_PATH, rows);
  return Response.json({ ok: true, row: rows[idx] });
}
