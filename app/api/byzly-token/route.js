import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';

const MERCHANT_ID = 'e0fb9f09-ca68-47a5-8e2c-782476d02730';

function base64urlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateJWT(secret) {
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64urlEncode(JSON.stringify({
    merchant_id: MERCHANT_ID,
    created_at: new Date().toISOString()
  }));
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `${header}.${payload}.${signature}`;
}

export async function GET() {
  const secret = process.env.BYZLY_SECRET_KEY;
  if (!secret) {
    return Response.json({ ok: false, error: 'not_configured' }, { status: 500 });
  }
  const token = generateJWT(secret);
  return Response.json({ ok: true, token, merchantId: MERCHANT_ID });
}
