import { loadJsonFile } from '../../../lib/blobJsonStore';

export const dynamic = 'force-dynamic';

const STORE_PATH = 'qr-scan-log/v1.json';

function clean(v = '') { return String(v || '').trim(); }

// Build all possible ref variants for a given email or refCode
// so scans logged under old formats still count
function refVariants(ref = '') {
  const r = clean(ref).toLowerCase();
  if (!r) return new Set();
  const variants = new Set([r]);
  // stripped email variant (old broken format): kimora@thelegacylink.com → kimorathelegacylinkcom
  variants.add(r.replace(/[^a-z0-9]/g, ''));
  // underscore ref: kimora@thelegacylink.com → kimora_thelegacylink_com (not typical but add anyway)
  variants.add(r.replace(/[@.]/g, '_'));
  return variants;
}

function startOfWeek() {
  const now = new Date();
  const sow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay()));
  return sow.getTime();
}

function startOfMonth() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ref      = clean(searchParams.get('ref') || '');
  const refCode  = clean(searchParams.get('refCode') || '');

  const scans = await loadJsonFile(STORE_PATH, []);
  const list  = Array.isArray(scans) ? scans : [];

  const weekMs  = startOfWeek();
  const monthMs = startOfMonth();

  if (ref || refCode) {
    // Build a combined set of all variants to match against
    const matchSet = new Set([
      ...refVariants(ref),
      ...refVariants(refCode),
    ]);

    const filtered = list.filter(s => matchSet.has(clean(s?.ref).toLowerCase()));
    const total     = filtered.length;
    const thisWeek  = filtered.filter(s => new Date(s?.ts || 0).getTime() >= weekMs).length;
    const thisMonth = filtered.filter(s => new Date(s?.ts || 0).getTime() >= monthMs).length;

    return Response.json({
      ok: true, ref, refCode,
      total, thisWeek, thisMonth,
      recent: filtered.slice(0, 50).map(s => ({ ts: s.ts, device: s.device })),
    });
  }

  // No ref — aggregate by ref
  const counts = {};
  for (const s of list) {
    const r = clean(s?.ref).toLowerCase();
    if (!r) continue;
    if (!counts[r]) counts[r] = { total: 0, thisWeek: 0, thisMonth: 0 };
    counts[r].total++;
    const t = new Date(s?.ts || 0).getTime();
    if (t >= weekMs)  counts[r].thisWeek++;
    if (t >= monthMs) counts[r].thisMonth++;
  }
  return Response.json({ ok: true, totalScans: list.length, counts });
}
