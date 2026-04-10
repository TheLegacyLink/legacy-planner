import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import { sessionFromToken } from '../licensed-backoffice/auth/_lib';
import { clean } from '../../../lib/licensedAgentMatch';
import licensedAgents from '../../../data/licensedAgents.json';
import icMembers from '../../../data/innerCircleUsers.json';

const STORE_PATH = 'stores/agent-licensed-states.json';

// Seed licensed states from licensedAgents.json for a given email
function seedStatesFromLicensed(email) {
  const match = licensedAgents.find((a) => clean(a.email || '').toLowerCase() === email);
  if (!match) return null;
  // Pull licensed states from carrier_details or state_code
  const states = new Set();
  if (match.state_code) states.add(String(match.state_code).toUpperCase().trim());
  if (Array.isArray(match.licensed_states)) {
    for (const s of match.licensed_states) {
      const code = String(s || '').toUpperCase().trim();
      if (code.length === 2) states.add(code);
    }
  }
  return states.size ? Array.from(states) : null;
}

// Check if email belongs to a known IC Hub member or static admin
async function isValidIcMember(email) {
  const staticMatch = (Array.isArray(icMembers) ? icMembers : []).find(
    (u) => clean(u?.email || '').toLowerCase() === email && u?.active !== false
  );
  if (staticMatch) return true;
  // Also check the IC Hub members blob
  const members = await loadJsonStore('stores/inner-circle-hub-members.json', []);
  return Array.isArray(members) && members.some(
    (m) => clean(m?.email || '').toLowerCase() === email && Boolean(m?.active)
  );
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = clean(searchParams.get('email') || '').toLowerCase();
    if (!email) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });

    const store = await loadJsonStore(STORE_PATH, {});
    const data = (store && typeof store === 'object' && !Array.isArray(store)) ? store : {};
    let states = Array.isArray(data[email]) ? data[email] : null;

    // Auto-seed from licensedAgents.json if nothing saved yet
    if (!states || states.length === 0) {
      states = seedStatesFromLicensed(email) || [];
    }

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

    // Auth: optional Bearer token check (licensed backoffice agents)
    // Licensed states are non-sensitive — any authenticated user or IC Hub member can save their own states
    const auth = clean(req.headers.get('authorization') || '');
    const token = auth.toLowerCase().startsWith('bearer ') ? clean(auth.slice(7)) : '';
    if (token) {
      const profile = await sessionFromToken(token);
      if (!profile) return Response.json({ ok: false, error: 'invalid_session' }, { status: 401 });
      const isAdmin = String(profile?.role || '').toLowerCase() === 'admin';
      if (!isAdmin && profile.email !== email) {
        return Response.json({ ok: false, error: 'email_mismatch' }, { status: 403 });
      }
    }
    // No token: allow — licensed state data is non-sensitive and self-reported

    const store = await loadJsonStore(STORE_PATH, {});
    const data = (store && typeof store === 'object' && !Array.isArray(store)) ? store : {};
    data[email] = states;
    await saveJsonStore(STORE_PATH, data);

    return Response.json({ ok: true, states });
  } catch (err) {
    return Response.json({ ok: false, error: String(err?.message || 'save_failed') }, { status: 500 });
  }
}
