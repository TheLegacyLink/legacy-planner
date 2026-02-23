import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/fng-program-overrides.json';
const THRESHOLD_DEFAULT = 500;

function clean(v = '') {
  return String(v || '').trim();
}

function sanitizeOverrides(input = {}) {
  const out = {};
  for (const [policy, type] of Object.entries(input || {})) {
    const key = clean(policy);
    const val = clean(type).toLowerCase();
    if (!key) continue;
    if (['regular', 'sponsorship', 'jumpstart'].includes(val)) {
      out[key] = val;
    }
  }
  return out;
}

export async function GET() {
  const data = await loadJsonStore(STORE_PATH, {
    threshold: THRESHOLD_DEFAULT,
    overrides: {}
  });

  return Response.json({
    ok: true,
    threshold: Number(data?.threshold || THRESHOLD_DEFAULT),
    overrides: sanitizeOverrides(data?.overrides || {}),
    updatedAt: data?.updatedAt || null
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const threshold = Number(body?.threshold || THRESHOLD_DEFAULT);
  const overrides = sanitizeOverrides(body?.overrides || {});

  const next = {
    threshold: Number.isFinite(threshold) ? threshold : THRESHOLD_DEFAULT,
    overrides,
    updatedAt: new Date().toISOString()
  };

  await saveJsonStore(STORE_PATH, next);
  return Response.json({ ok: true, ...next });
}
