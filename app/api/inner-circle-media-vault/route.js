export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const ITEMS_PATH = 'stores/inner-circle-media-items.json';
const PROGRESS_PATH = 'stores/inner-circle-media-progress.json';

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase(); }
function nowIso() { return new Date().toISOString(); }

function isKimora(email = '') {
  return norm(email) === 'kimora@thelegacylink.com';
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const memberEmail = norm(searchParams.get('email') || '');
  const memberName = norm(searchParams.get('name') || '');

  const [itemRows, progressRows] = await Promise.all([
    loadJsonStore(ITEMS_PATH, []),
    loadJsonStore(PROGRESS_PATH, [])
  ]);

  const items = (Array.isArray(itemRows) ? itemRows : [])
    .filter((r) => r?.active !== false)
    .sort((a, b) => {
      const af = Boolean(a?.featured) ? 1 : 0;
      const bf = Boolean(b?.featured) ? 1 : 0;
      if (bf !== af) return bf - af;
      const ao = Number(a?.sortOrder ?? 1000);
      const bo = Number(b?.sortOrder ?? 1000);
      if (ao !== bo) return ao - bo;
      return new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();
    });

  const progress = Array.isArray(progressRows) ? progressRows : [];
  const my = progress.filter((r) => {
    const e = norm(r?.memberEmail || '');
    const n = norm(r?.memberName || '');
    if (memberEmail && e) return memberEmail === e;
    if (memberName && n) return memberName === n;
    return false;
  });

  const myProgress = {};
  for (const r of my) {
    const itemId = clean(r?.itemId || '');
    if (!itemId) continue;
    myProgress[itemId] = {
      completed: Boolean(r?.completed),
      comment: clean(r?.comment || ''),
      updatedAt: clean(r?.updatedAt || '')
    };
  }

  return Response.json({ ok: true, items, myProgress });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = norm(body?.action || '');

  if (action === 'admin_upsert_item') {
    const actorEmail = norm(body?.actorEmail || '');
    if (!isKimora(actorEmail)) return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });

    const id = clean(body?.id || '');
    const type = norm(body?.type || 'video');
    const title = clean(body?.title || '');
    const description = clean(body?.description || '');
    const url = clean(body?.url || '');
    const tag = clean(body?.tag || 'inner-circle');
    const featured = Boolean(body?.featured);
    const required = Boolean(body?.required);
    const sortOrder = Number(body?.sortOrder ?? 100);

    if (!title) return Response.json({ ok: false, error: 'missing_title' }, { status: 400 });
    if (!url) return Response.json({ ok: false, error: 'missing_url' }, { status: 400 });

    const rows = await loadJsonStore(ITEMS_PATH, []);
    const list = Array.isArray(rows) ? rows : [];
    const idx = list.findIndex((r) => clean(r?.id || '') === id);

    const base = {
      id: id || `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: ['video', 'audio', 'reading'].includes(type) ? type : 'video',
      title,
      description,
      url,
      tag,
      featured,
      required,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 100,
      active: true,
      updatedAt: nowIso()
    };

    if (idx >= 0) {
      list[idx] = { ...list[idx], ...base };
    } else {
      list.unshift({ ...base, createdAt: nowIso() });
    }

    await saveJsonStore(ITEMS_PATH, list);
    return Response.json({ ok: true, row: idx >= 0 ? list[idx] : list[0] });
  }

  if (action === 'admin_delete_item') {
    const actorEmail = norm(body?.actorEmail || '');
    if (!isKimora(actorEmail)) return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });

    const id = clean(body?.id || '');
    if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

    const rows = await loadJsonStore(ITEMS_PATH, []);
    const list = Array.isArray(rows) ? rows : [];
    const idx = list.findIndex((r) => clean(r?.id || '') === id);
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    list[idx] = { ...list[idx], active: false, updatedAt: nowIso() };
    await saveJsonStore(ITEMS_PATH, list);
    return Response.json({ ok: true });
  }

  if (action === 'set_progress') {
    const itemId = clean(body?.itemId || '');
    const memberName = clean(body?.memberName || '');
    const memberEmail = norm(body?.memberEmail || '');
    const completed = Boolean(body?.completed);
    const comment = clean(body?.comment || '');

    if (!itemId) return Response.json({ ok: false, error: 'missing_item_id' }, { status: 400 });
    if (!memberName && !memberEmail) return Response.json({ ok: false, error: 'missing_member' }, { status: 400 });

    const rows = await loadJsonStore(PROGRESS_PATH, []);
    const list = Array.isArray(rows) ? rows : [];

    const idx = list.findIndex((r) => clean(r?.itemId || '') === itemId && ((memberEmail && norm(r?.memberEmail || '') === memberEmail) || (!memberEmail && norm(r?.memberName || '') === norm(memberName))));

    const next = {
      itemId,
      memberName,
      memberEmail,
      completed,
      comment,
      updatedAt: nowIso()
    };

    if (idx >= 0) list[idx] = { ...list[idx], ...next };
    else list.unshift({ id: `mp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: nowIso(), ...next });

    await saveJsonStore(PROGRESS_PATH, list);
    return Response.json({ ok: true, row: idx >= 0 ? list[idx] : list[0] });
  }

  return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
}
