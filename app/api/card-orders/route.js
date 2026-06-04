import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';
import { getAdminSkeletonPasswords } from '../../../lib/adminSkeletonAuth';

export const dynamic = 'force-dynamic';

const ORDERS_PATH = 'card-orders/v1.json';

function clean(v = '') { return String(v || '').trim(); }

function isAdmin(req, body = {}) {
  const h = clean(req.headers.get('x-admin-key') || req.headers.get('authorization')).replace(/^Bearer\s+/i, '');
  const b = clean(body?.adminToken || '');
  return getAdminSkeletonPasswords().includes(h || b);
}

async function loadOrders() {
  const raw = await loadJsonFile(ORDERS_PATH, []);
  // Handle both array and wrapped formats
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.orders)) return raw.orders;
  return [];
}

async function saveOrders(orders) {
  await saveJsonFile(ORDERS_PATH, orders);
}

// GET — list all orders (admin only)
export async function GET(req) {
  if (!isAdmin(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const orders = await loadOrders();
  const sorted = [...orders].sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
  return Response.json({ ok: true, orders: sorted });
}

// PATCH — update status on an order
export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  if (!isAdmin(req, body)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const { ref, status, notes } = body;
  if (!ref) return Response.json({ ok: false, error: 'missing_ref' }, { status: 400 });

  const VALID = ['pending', 'in_progress', 'fulfilled', 'on_hold'];
  if (status && !VALID.includes(status)) {
    return Response.json({ ok: false, error: 'invalid_status' }, { status: 400 });
  }

  const orders = await loadOrders();
  const idx = orders.findIndex(o => clean(o?.ref) === clean(ref));
  if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  const now = new Date().toISOString();
  const updated = { ...orders[idx] };
  if (status) updated.status = status;
  if (notes !== undefined) updated.notes = notes;
  updated.updatedAt = now;
  if (status === 'fulfilled' && !updated.fulfilledAt) updated.fulfilledAt = now;

  orders[idx] = updated;
  await saveOrders(orders);
  return Response.json({ ok: true, order: updated });
}
