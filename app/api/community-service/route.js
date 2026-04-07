export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/community-service-submissions.json';

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase(); }
function nowIso() { return new Date().toISOString(); }

function monthKeyNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function safeFilePart(v = '') {
  return clean(v).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}

function parseDataUrl(dataUrl = '') {
  const m = String(dataUrl || '').match(/^data:([^;,]+)?;base64,(.+)$/);
  if (!m) return null;
  return {
    contentType: clean(m[1] || 'image/jpeg') || 'image/jpeg',
    buffer: Buffer.from(m[2], 'base64')
  };
}

async function uploadImage({ dataUrl = '', filename = '', contentType = '' } = {}) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed?.buffer) return { ok: false, error: 'invalid_data_url' };

  try {
    const blob = await import('@vercel/blob');
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const ext = (clean(contentType || parsed.contentType).split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
      const path = `community-service/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeFilePart(filename || 'proof')}.${ext}`;
      const out = await blob.put(path, parsed.buffer, {
        access: 'public',
        contentType: clean(contentType || parsed.contentType) || parsed.contentType,
        addRandomSuffix: false,
        allowOverwrite: false
      });
      return { ok: true, url: clean(out?.url || '') };
    }
  } catch {
    // fallback below
  }

  // Local/dev fallback when blob token is not configured.
  return { ok: true, url: String(dataUrl || '') };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const email = norm(searchParams.get('email') || '');
  const name = norm(searchParams.get('name') || '');

  const rowsRaw = await loadJsonStore(STORE_PATH, []);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : [];

  const filtered = rows
    .filter((r) => {
      const re = norm(r?.memberEmail || '');
      const rn = norm(r?.memberName || '');
      if (email && re) return email === re;
      if (name && rn) return name === rn;
      return true;
    })
    .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());

  return Response.json({ ok: true, rows: filtered });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = norm(body?.action || 'create');

  if (action === 'upload_photos') {
    const files = Array.isArray(body?.files) ? body.files : [];
    if (!files.length) return Response.json({ ok: false, error: 'missing_files' }, { status: 400 });

    const urls = [];
    for (const f of files.slice(0, 8)) {
      const up = await uploadImage({
        dataUrl: String(f?.dataUrl || ''),
        filename: clean(f?.filename || 'proof.jpg'),
        contentType: clean(f?.contentType || '')
      });
      if (!up?.ok || !up?.url) {
        return Response.json({ ok: false, error: up?.error || 'upload_failed' }, { status: 400 });
      }
      urls.push(up.url);
    }

    return Response.json({ ok: true, urls });
  }

  if (action !== 'create') {
    return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
  }

  const memberName = clean(body?.memberName || '');
  const memberEmail = norm(body?.memberEmail || '');
  const month = clean(body?.month || monthKeyNow());
  const category = clean(body?.category || '');
  const activityTitle = clean(body?.activity_title || body?.activityTitle || '');
  const description = clean(body?.description || '');
  const timeSpent = Math.max(0, Number(body?.time_spent || body?.timeSpent || 0));
  const locationOrganization = clean(body?.location_organization || body?.locationOrganization || '');
  const photoUrls = (Array.isArray(body?.photo_urls) ? body.photo_urls : []).map((x) => clean(x)).filter(Boolean);

  if (!memberName && !memberEmail) return Response.json({ ok: false, error: 'missing_member' }, { status: 400 });
  if (!category) return Response.json({ ok: false, error: 'missing_category' }, { status: 400 });
  if (!description) return Response.json({ ok: false, error: 'missing_description' }, { status: 400 });
  if (timeSpent < 60) return Response.json({ ok: false, error: 'minimum_60_minutes' }, { status: 400 });
  if (!photoUrls.length) return Response.json({ ok: false, error: 'missing_photo_proof' }, { status: 400 });

  const rowsRaw = await loadJsonStore(STORE_PATH, []);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : [];

  const row = {
    id: `csr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    month,
    memberName,
    memberEmail,
    category,
    activity_title: activityTitle || null,
    description,
    time_spent: timeSpent,
    location_organization: locationOrganization,
    photo_urls: photoUrls,
    status: 'Logged',
    admin_notes: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  rows.unshift(row);
  await saveJsonStore(STORE_PATH, rows);

  return Response.json({ ok: true, row });
}
