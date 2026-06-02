import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

// GET /api/card-settings?ref=xxx
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const ref = String(sp.get('ref') || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (!ref) return Response.json({ error: 'ref required' }, { status: 400 });

  const settings = await loadJsonFile(`card-settings/${ref}.json`, null);
  return Response.json(settings || {});
}

// POST /api/card-settings — save customizations for a ref code
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const ref = String(body.ref || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (!ref) return Response.json({ error: 'ref required' }, { status: 400 });

  const allowed = ['firstName', 'lastName', 'title', 'phone', 'email', 'city', 'state', 'photoUrl', 'photoRequested'];
  const settings = {};
  allowed.forEach((k) => { if (body[k] !== undefined) settings[k] = body[k]; });

  await saveJsonFile(`card-settings/${ref}.json`, { ref, ...settings, updatedAt: new Date().toISOString() });
  return Response.json({ ok: true });
}
