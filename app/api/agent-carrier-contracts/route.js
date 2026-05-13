import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

const STORE = 'stores/agent-carrier-contracts.json';

function clean(v) {
  return String(v || '').trim();
}

// GET /api/agent-carrier-contracts?email=...
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = clean(searchParams.get('email')).toLowerCase();
    if (!email) {
      return Response.json({ ok: false, error: 'email required' }, { status: 400 });
    }
    const store = await loadJsonFile(STORE, {});
    const contracts = (store[email] && typeof store[email] === 'object') ? store[email] : {};
    return Response.json({ ok: true, contracts });
  } catch (err) {
    console.error('[agent-carrier-contracts GET]', err);
    return Response.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

// POST /api/agent-carrier-contracts  { email, contracts: { fg: { contracted: true, agentId: '...' }, ... } }
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = clean(body?.email).toLowerCase();
    const contracts = (body?.contracts && typeof body.contracts === 'object') ? body.contracts : {};

    if (!email) {
      return Response.json({ ok: false, error: 'email required' }, { status: 400 });
    }

    // Sanitize: only keep known carrier keys and expected fields
    const ALLOWED_CARRIERS = ['fg', 'national_life', 'mutual_of_omaha'];
    const sanitized = {};
    for (const ck of ALLOWED_CARRIERS) {
      if (contracts[ck]) {
        sanitized[ck] = {
          contracted: Boolean(contracts[ck].contracted),
          agentId: clean(contracts[ck].agentId),
        };
      }
    }

    const store = await loadJsonFile(STORE, {});
    store[email] = sanitized;
    await saveJsonFile(STORE, store);

    return Response.json({ ok: true, contracts: sanitized });
  } catch (err) {
    console.error('[agent-carrier-contracts POST]', err);
    return Response.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
