import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

export const dynamic = 'force-dynamic';

const ORDERS_PATH = 'card-orders/v1.json';

function clean(v = '') { return String(v || '').trim(); }

async function loadOrders() {
  const raw = await loadJsonFile(ORDERS_PATH, []);
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.orders)) return raw.orders;
  return [];
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const ref = clean(body?.ref || body?.name || '').toLowerCase().replace(/\s+/g, '_');
  const name = clean(body?.name || '');
  const qty = clean(body?.qty || '500');
  const submitMode = clean(body?.submitMode || 'email');
  const photoEmail = clean(body?.photoEmail || '');
  const photoUrl = clean(body?.photoUrl || '');
  const hasPhoto = !!body?.hasPhoto;

  if (!ref) return Response.json({ ok: false, error: 'missing_ref' }, { status: 400 });

  const orders = await loadOrders();
  const existing = orders.findIndex(o => clean(o?.ref) === ref);

  const record = {
    ref,
    name,
    qty,
    submitMode,
    photoEmail,
    photoUrl,
    hasPhoto: hasPhoto || !!photoUrl,
    submittedAt: existing >= 0 ? (orders[existing].submittedAt || new Date().toISOString()) : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: existing >= 0 ? orders[existing].status : 'pending',
  };

  if (existing >= 0) {
    orders[existing] = { ...orders[existing], ...record };
  } else {
    orders.unshift(record);
  }

  await saveJsonFile(ORDERS_PATH, orders);
  return Response.json({ ok: true, order: record });
}
