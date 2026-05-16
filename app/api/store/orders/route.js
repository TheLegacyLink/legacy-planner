import { loadJsonStore } from '../../../../lib/blobJsonStore';
import { getAdminSkeletonPasswords } from '../../../../lib/adminSkeletonAuth';

export const dynamic = 'force-dynamic';

const ORDERS_PATH = 'stores/store-orders.json';

function clean(v = '') { return String(v || '').trim(); }

export async function GET(req) {
  const h = clean(req.headers.get('x-admin-key') || req.headers.get('authorization')).replace(/^Bearer\s+/i, '');
  if (!getAdminSkeletonPasswords().includes(h)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const orders = await loadJsonStore(ORDERS_PATH, []);
  return Response.json({ ok: true, orders: [...orders].reverse() });
}
