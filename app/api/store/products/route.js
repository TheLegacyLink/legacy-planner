import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';
import { STORE_SEED } from '../../../../lib/storeSeed';
import { getAdminSkeletonPasswords } from '../../../../lib/adminSkeletonAuth';

export const dynamic = 'force-dynamic';

const PRODUCTS_PATH = 'stores/store-products.json';

function clean(v = '') { return String(v || '').trim(); }

function isAdmin(req, body = {}) {
  const h = clean(req.headers.get('x-admin-key') || req.headers.get('authorization')).replace(/^Bearer\s+/i, '');
  const b = clean(body?.adminToken || '');
  return getAdminSkeletonPasswords().includes(h || b);
}

async function loadCatalog() {
  const stored = await loadJsonStore(PRODUCTS_PATH, null);
  if (stored?._version === STORE_SEED._version && stored?.products?.length) return stored;
  await saveJsonStore(PRODUCTS_PATH, STORE_SEED);
  return STORE_SEED;
}

export async function GET() {
  const catalog = await loadCatalog();
  return Response.json({ ok: true, ...catalog });
}

export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  if (!isAdmin(req, body)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const catalog = await loadCatalog();
  const { action, sku, patch, hero } = body;

  if (action === 'update_product' && sku) {
    const idx = catalog.products.findIndex(p => p.sku === sku);
    if (idx < 0) return Response.json({ ok: false, error: 'sku_not_found' }, { status: 404 });
    catalog.products[idx] = { ...catalog.products[idx], ...patch };
    await saveJsonStore(PRODUCTS_PATH, catalog);
    return Response.json({ ok: true, product: catalog.products[idx] });
  }

  if (action === 'update_hero' && hero) {
    catalog.hero = { ...catalog.hero, ...hero };
    await saveJsonStore(PRODUCTS_PATH, catalog);
    return Response.json({ ok: true, hero: catalog.hero });
  }

  if (action === 'reset') {
    await saveJsonStore(PRODUCTS_PATH, STORE_SEED);
    return Response.json({ ok: true, message: 'Reset to seed data' });
  }

  return Response.json({ ok: false, error: 'unknown_action' }, { status: 400 });
}
