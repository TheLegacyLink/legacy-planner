import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

// ONE-TIME recovery endpoint — unions ALL blob versions of a store to recover missing records
// Secured by secret key. Remove after use.

const SECRET = process.env.RECOVERY_SECRET || 'legacy-recover-2026';

export const dynamic = 'force-dynamic';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }

function recordKey(r = {}) {
  const email = normalize(r?.email || '');
  const id = clean(r?.id || '');
  const phone = clean(r?.phone || '').replace(/\D/g, '');
  const name = normalize(`${r?.firstName || ''} ${r?.lastName || ''}`.trim());
  if (id) return `id:${id}`;
  if (email) return `e:${email}`;
  if (phone && phone.length >= 10) return `p:${phone}`;
  if (name) return `n:${name}`;
  return `raw:${JSON.stringify(r).slice(0, 80)}`;
}

async function getAllBlobVersions(blob, prefix) {
  const all = [];
  let cursor;
  let hasMore = true;
  while (hasMore) {
    const page = await blob.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
    all.push(...(page?.blobs || []));
    hasMore = Boolean(page?.hasMore);
    cursor = page?.cursor;
    if (all.length > 20000) break;
  }
  return all;
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (clean(body?.secret) !== SECRET) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const storePath = clean(body?.store || 'stores/sponsorship-applications.json');
  const topN = Number(body?.topN || 200); // read top N newest versions

  let blob;
  try {
    blob = await import('@vercel/blob');
  } catch {
    return Response.json({ ok: false, error: 'blob_unavailable' });
  }

  const versionPrefix = `${storePath}__v/`;
  const allVersionBlobs = await getAllBlobVersions(blob, versionPrefix);

  // Sort newest first
  const sorted = allVersionBlobs.sort((a, b) => String(b.pathname || '').localeCompare(String(a.pathname || '')));
  const toRead = sorted.slice(0, topN);

  // Read all versions and union records
  const seen = new Map();
  let versionsRead = 0;
  let errors = 0;

  for (const blobObj of toRead) {
    try {
      const res = await fetch(blobObj.url, { cache: 'no-store' });
      if (!res.ok) { errors++; continue; }
      const records = await res.json().catch(() => []);
      if (!Array.isArray(records)) continue;
      for (const r of records) {
        const k = recordKey(r);
        if (!seen.has(k)) {
          seen.set(k, r);
        } else {
          // Keep the record with the latest timestamp
          const existing = seen.get(k);
          const existTs = new Date(existing?.submittedAt || existing?.submitted_at || existing?.createdAt || 0).getTime();
          const newTs = new Date(r?.submittedAt || r?.submitted_at || r?.createdAt || 0).getTime();
          if (newTs > existTs) seen.set(k, r);
        }
      }
      versionsRead++;
    } catch {
      errors++;
    }
  }

  const consolidated = Array.from(seen.values());

  // Sort by submitted date ascending
  consolidated.sort((a, b) => {
    const ta = new Date(a?.submittedAt || a?.submitted_at || a?.createdAt || 0).getTime();
    const tb = new Date(b?.submittedAt || b?.submitted_at || b?.createdAt || 0).getTime();
    return ta - tb;
  });

  // Save consolidated result
  await saveJsonStore(storePath, consolidated);

  return Response.json({
    ok: true,
    store: storePath,
    totalVersionsFound: allVersionBlobs.length,
    versionsRead,
    errors,
    recordsBefore: toRead.length > 0 ? 'see versionsRead' : 0,
    recordsAfter: consolidated.length,
    message: `Recovered ${consolidated.length} unique records from ${versionsRead} blob versions.`
  });
}
