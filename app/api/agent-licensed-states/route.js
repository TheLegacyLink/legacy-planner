import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

const STORE = 'stores/agent-licensed-states.json';

function clean(v) {
  return String(v || '').trim();
}

// GET /api/agent-licensed-states?email=...
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = clean(searchParams.get('email')).toLowerCase();
    if (!email) {
      return Response.json({ ok: false, error: 'email required' }, { status: 400 });
    }
    const store = await loadJsonFile(STORE, {});
    const states = Array.isArray(store[email]) ? store[email] : [];
    return Response.json({ ok: true, states });
  } catch (err) {
    console.error('[agent-licensed-states GET]', err);
    return Response.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

// POST /api/agent-licensed-states  { email, states: [...] }
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = clean(body?.email).toLowerCase();
    const states = Array.isArray(body?.states) ? body.states.map(clean).filter(Boolean) : [];

    if (!email) {
      return Response.json({ ok: false, error: 'email required' }, { status: 400 });
    }

    const store = await loadJsonFile(STORE, {});
    store[email] = states;
    await saveJsonFile(STORE, store);

    return Response.json({ ok: true, states });
  } catch (err) {
    console.error('[agent-licensed-states POST]', err);
    return Response.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
