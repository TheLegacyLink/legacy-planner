// 2026-06-12 — PAUSED: Token forwarding to LegacyLink Hub SSO disabled per Link.
// Re-enable by removing this block and the disabled handler below.

import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { resolveProfileByEmail, issueSession } from '../_lib';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clean(v = '') { return String(v || '').trim(); }

function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    str.length + (4 - (str.length % 4)) % 4, '='
  );
  return Buffer.from(padded, 'base64').toString('utf8');
}

function hmacSha256Hex(data, secret) {
  return createHmac('sha256', secret).update(data).digest('hex');
}

// ─── Token validation ─────────────────────────────────────────────────────────
// Token format: <base64url(payload_json)>.<hmac_hex>
// Payload: { email, role, exp, iat }

function validateSsoToken(token, secret) {
  if (!token || !secret) return { ok: false, error: 'missing_token_or_secret' };

  const lastDot = token.lastIndexOf('.');
  if (lastDot < 1) return { ok: false, error: 'invalid_token_format' };

  const payloadB64 = token.slice(0, lastDot);
  const sigReceived = token.slice(lastDot + 1).toLowerCase();

  // Verify HMAC
  const sigExpected = hmacSha256Hex(payloadB64, secret).toLowerCase();
  const sigExpBuf = Buffer.from(sigExpected, 'hex');
  const sigRecBuf = Buffer.from(sigReceived, 'hex');
  if (sigExpBuf.length !== sigRecBuf.length) return { ok: false, error: 'invalid_signature' };
  if (!timingSafeEqual(sigExpBuf, sigRecBuf)) return { ok: false, error: 'invalid_signature' };

  // Decode payload
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64));
  } catch {
    return { ok: false, error: 'invalid_payload' };
  }

  // Check expiry (exp is Unix seconds)
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) return { ok: false, error: 'token_expired' };

  // Validate required fields
  const email = clean(payload.email || '').toLowerCase();
  const role = clean(payload.role || '').toLowerCase();
  if (!email || !email.includes('@')) return { ok: false, error: 'invalid_email' };
  if (!['licensed', 'unlicensed'].includes(role)) return { ok: false, error: 'invalid_role' };

  return { ok: true, email, role };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

// SSO DISABLED — return to /start until re-enabled
export async function GET(request) {
  return NextResponse.redirect(new URL('/start', request.url));
}

export async function GET_disabled(request) {
  const { searchParams } = new URL(request.url);
  const token = clean(searchParams.get('token') || '');
  const secret = clean(process.env.SSO_SECRET || '');

  if (!secret) {
    console.error('[SSO] SSO_SECRET env var not set');
    return NextResponse.redirect(new URL('/start?error=sso_config', request.url));
  }

  if (!token) {
    return NextResponse.redirect(new URL('/start?error=no_token', request.url));
  }

  const validation = validateSsoToken(token, secret);
  if (!validation.ok) {
    console.warn('[SSO] Token validation failed:', validation.error);
    const base44Url = clean(process.env.NEXT_PUBLIC_BASE44_LOGIN_URL || '');
    const fallback = base44Url || '/start?error=invalid_token';
    return NextResponse.redirect(new URL(fallback, base44Url ? base44Url : request.url));
  }

  const { email, role } = validation;

  // Resolve or create profile
  let profile = await resolveProfileByEmail(email);

  // If no profile found in our system yet (new Base44 user), build a minimal one
  if (!profile) {
    profile = {
      email,
      name: '',
      phone: '',
      state: '',
      trackType: role === 'setter' ? 'setter' : role,
      applicationId: '',
      referrerName: ''
    };
  } else {
    // Honour the role passed from Base44 (Base44 is now the authority on role)
    profile.trackType = role === 'setter' ? 'setter' : role;
  }

  // Issue session (30-day)
  const { token: sessionToken } = await issueSession(profile);

  // Check if contract is signed
  let contractSigned = false;
  try {
    const { loadJsonStore } = await import('../../../../lib/blobJsonStore');
    const contracts = await loadJsonStore('stores/esign-contracts.json', []);
    const norm = (v = '') => String(v || '').trim().toLowerCase();
    const existing = (Array.isArray(contracts) ? contracts : []).find(
      r => norm(r?.email) === norm(email) && r?.candidateSigned
    );
    contractSigned = Boolean(existing);
  } catch {
    // If contract check fails, proceed to contract page
    contractSigned = false;
  }

  // Determine destination
  let destination;
  if (!contractSigned) {
    // Send to contract signing first, then back office
    destination = '/start?sso=1&next=' + encodeURIComponent(roleToBackoffice(role));
  } else {
    destination = roleToBackoffice(role);
  }

  // Build response — set session token in localStorage via client redirect page
  const redirectUrl = `/start/sso-landing?session=${encodeURIComponent(sessionToken)}&dest=${encodeURIComponent(destination)}`;
  return NextResponse.redirect(new URL(redirectUrl, request.url));
}

function roleToBackoffice(role) {
  if (role === 'licensed') return '/licensed-backoffice';
  return '/unlicensed-backoffice';
}
