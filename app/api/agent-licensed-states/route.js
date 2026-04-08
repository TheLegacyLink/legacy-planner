import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import { sessionFromToken } from '../licensed-backoffice/auth/_lib';
import { clean } from '../../../lib/licensedAgentMatch';

const STORE_PATH = 'stores/agent-licensed-states.json';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = clean(searchParams.get('email') || '').toLowerCase();
    if (!email) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });

    const store = await loadJsonStore(STORE_PATH, {});
    const data = (store && typeof store === 'object' && !Array.isArray(store)) ? store : {};
    const states = Array.isArray(data[email]) ? data[email] : [];
    return Response.json({ ok: true, states });
  } catch (err) {
    return Response.json({ ok: false, error: String(err?.message || 'load_failed') }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = clean(body?.email || '').toLowerCase();
    const rawStates = Array.isArray(body?.states) ? body.states : [];
    const states = rawStates
      .map((s) => String(s || '').toUpperCase().trim())
      .filter((s) => s.length === 2);

    if (!email) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });

    // Verify session: Bearer token must match the email being saved
    const auth = clean(req.headers.get('authorization') || '');
    const token = auth.toLowerCase().startsWith('bearer ') ? clean(auth.slice(7)) : '';
    if (!token) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const profile = await sessionFromToken(token);
    if (!profile) return Response.json({ ok: false, error: 'invalid_session' }, { status: 401 });

    // Admin override or email must match session
    const isAdmin = String(profile?.role || '').toLowerCase() === 'admin';
    if (!isAdmin && profile.email !== email) {
      return Response.json({ ok: false, error: 'email_mismatch' }, { status: 403 });
    }

    const store = await loadJsonStore(STORE_PATH, {});
    const data = (store && typeof store === 'object' && !Array.isArray(store)) ? store : {};
    data[email] = states;
    await saveJsonStore(STORE_PATH, data);

    return Response.json({ ok: true, states });
  } catch (err) {
    return Response.json({ ok: false, error: String(err?.message || 'save_failed') }, { status: 500 });
  }
}
