import { loadJsonStore } from '../../../../lib/blobJsonStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STORE_PATH = 'stores/esign-contracts.json';

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const adminToken = clean(searchParams.get('adminToken') || '');
  const required = clean(process.env.CONTRACT_ADMIN_TOKEN || '');
  if (!required || adminToken !== required) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = (Array.isArray(rows) ? rows : []).sort((a, b) => {
    return String(b?.createdAt || '').localeCompare(String(a?.createdAt || ''));
  });

  const filter = clean(searchParams.get('filter') || 'all');
  const filtered = list.filter((r) => {
    if (filter === 'pending_countersign') return r?.candidateSignedAt && !r?.kimuraSignedAt;
    if (filter === 'finalized') return Boolean(r?.finalizedAt);
    return true;
  });

  return Response.json({ ok: true, rows: filtered, total: filtered.length });
}
