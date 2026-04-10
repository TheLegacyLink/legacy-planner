import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import { sessionFromToken } from '../licensed-backoffice/auth/_lib';
import licensedAgents from '../../../data/licensedAgents.json';

const STORE_PATH = 'stores/agent-carrier-contracts.json';

function clean(v = '') {
  return String(v || '').trim();
}

// Seed from licensedAgents.json if no custom record exists for this email
function seedFromLicensed(email) {
  const match = licensedAgents.find(
    (a) => clean(a.email || '').toLowerCase() === email
  );
  if (!match || !Array.isArray(match.carrier_details)) return null;

  const result = {};
  for (const detail of match.carrier_details) {
    const key = carrierKey(detail.carrier);
    if (!key) continue;
    result[key] = {
      contracted: String(detail.contract_status || '').toLowerCase().includes('active') ||
                  String(detail.contract_status || '').length > 0,
      agentId: clean(detail.carrier_agent_id || ''),
      status: clean(detail.contract_status || '')
    };
  }
  return Object.keys(result).length ? result : null;
}

function carrierKey(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('f&g') || n.includes('fidelity')) return 'fg';
  if (n.includes('mutual')) return 'mutual_of_omaha';
  if (n.includes('national life')) return 'national_life';
  return null;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = clean(searchParams.get('email') || '').toLowerCase();
    if (!email) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });

    const store = await loadJsonStore(STORE_PATH, {});
    const data = (store && typeof store === 'object' && !Array.isArray(store)) ? store : {};

    let contracts = data[email] || null;

    // Auto-seed from licensedAgents.json if nothing saved yet
    if (!contracts) {
      contracts = seedFromLicensed(email) || {};
    }

    return Response.json({ ok: true, contracts });
  } catch (err) {
    return Response.json({ ok: false, error: String(err?.message || 'load_failed') }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = clean(body?.email || '').toLowerCase();
    const contracts = body?.contracts || {};

    if (!email) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });

    // Auth: Bearer token (licensed backoffice session)
    const auth = clean(req.headers.get('authorization') || '');
    const token = auth.toLowerCase().startsWith('bearer ') ? clean(auth.slice(7)) : '';
    if (!token) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const profile = await sessionFromToken(token);
    if (!profile) return Response.json({ ok: false, error: 'invalid_session' }, { status: 401 });

    const isAdmin = String(profile?.role || '').toLowerCase() === 'admin';
    if (!isAdmin && profile.email !== email) {
      return Response.json({ ok: false, error: 'email_mismatch' }, { status: 403 });
    }

    // Sanitize: only allow known carrier keys and expected fields
    const ALLOWED_CARRIERS = ['fg', 'mutual_of_omaha', 'national_life'];
    const sanitized = {};
    for (const key of ALLOWED_CARRIERS) {
      if (contracts[key] !== undefined) {
        sanitized[key] = {
          contracted: Boolean(contracts[key]?.contracted),
          agentId: clean(contracts[key]?.agentId || ''),
          status: clean(contracts[key]?.status || '')
        };
      }
    }

    const store = await loadJsonStore(STORE_PATH, {});
    const data = (store && typeof store === 'object' && !Array.isArray(store)) ? store : {};
    data[email] = sanitized;
    await saveJsonStore(STORE_PATH, data);

    return Response.json({ ok: true, contracts: sanitized });
  } catch (err) {
    return Response.json({ ok: false, error: String(err?.message || 'save_failed') }, { status: 500 });
  }
}
