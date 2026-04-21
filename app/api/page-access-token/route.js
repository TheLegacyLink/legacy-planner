import { createHmac } from 'crypto';

// Token TTL: 7 days (in seconds)
const TOKEN_TTL_SEC = 7 * 24 * 60 * 60;

function getSecret() {
  return process.env.PAGE_ACCESS_TOKEN_SECRET || 'legacy-link-page-gate-secret-2026';
}

function generateToken(context = 'choose-your-next-level') {
  const ts = Math.floor(Date.now() / 1000);
  const payload = `${context}:${ts}`;
  const sig = createHmac('sha256', getSecret()).update(payload).digest('hex').slice(0, 32);
  const raw = `${Buffer.from(payload).toString('base64url')}.${sig}`;
  return raw;
}

function validateToken(token = '') {
  try {
    const [b64, sig] = token.split('.');
    if (!b64 || !sig) return { ok: false, reason: 'malformed' };

    const payload = Buffer.from(b64, 'base64url').toString('utf8');
    const expectedSig = createHmac('sha256', getSecret()).update(payload).digest('hex').slice(0, 32);

    if (sig !== expectedSig) return { ok: false, reason: 'invalid_signature' };

    const [, tsStr] = payload.split(':');
    const ts = parseInt(tsStr, 10);
    const age = Math.floor(Date.now() / 1000) - ts;
    if (age > TOKEN_TTL_SEC) return { ok: false, reason: 'expired' };

    return { ok: true, age };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

// CORS headers — allow thelegacylink.com to call this from the browser
function corsHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = ['https://thelegacylink.com', 'https://www.thelegacylink.com'];
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

// GET ?token=xxx — validate a token (called from GHL page JS)
export async function GET(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const result = validateToken(token);
  return Response.json(result, { headers: corsHeaders(req) });
}

// POST — generate a new token (called server-side after form submission)
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const context = String(body?.context || 'choose-your-next-level').slice(0, 64);
  const token = generateToken(context);
  return Response.json({ ok: true, token }, { headers: corsHeaders(req) });
}
