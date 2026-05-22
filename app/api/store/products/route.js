import { loadJsonFile, saveJsonFile } from '../../../../lib/blobJsonStore';
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
  // MUST use loadJsonFile — products are stored as an object {products:[...], _version, hero}.
  // loadJsonStore only returns arrays and was returning null every time, causing constant reseeds.
  const stored = await loadJsonFile(PRODUCTS_PATH, null);

  // Never auto-reset — only seed once when store is completely empty.
  if (stored?.products?.length >= 1) return stored;

  await saveJsonFile(PRODUCTS_PATH, STORE_SEED);
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
    await saveJsonFile(PRODUCTS_PATH, catalog);
    return Response.json({ ok: true, product: catalog.products[idx] });
  }

  if (action === 'update_hero' && hero) {
    catalog.hero = { ...catalog.hero, ...hero };
    await saveJsonFile(PRODUCTS_PATH, catalog);
    return Response.json({ ok: true, hero: catalog.hero });
  }

  if (action === 'reset') {
    await saveJsonFile(PRODUCTS_PATH, STORE_SEED);
    return Response.json({ ok: true, message: 'Reset to seed data' });
  }

  // Sync: merge new seed products in without removing existing customizations.
  // Adds any SKUs from seed that don’t exist yet; never overwrites existing products.
  if (action === 'sync_new_products') {
    const catalog = await loadCatalog();
    const existingSkus = new Set((catalog.products || []).map(p => p.sku));
    const newProducts = (STORE_SEED.products || []).filter(p => !existingSkus.has(p.sku));
    if (newProducts.length > 0) {
      catalog.products = [...(catalog.products || []), ...newProducts];
      await saveJsonFile(PRODUCTS_PATH, catalog);
    }
    return Response.json({ ok: true, added: newProducts.length, message: `Added ${newProducts.length} new product(s)` });
  }

  return Response.json({ ok: false, error: 'unknown_action' }, { status: 400 });
}
