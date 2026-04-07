import { createHash, randomBytes } from 'crypto';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import { sessionFromToken } from '../start-auth/_lib';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STORE_PATH = 'stores/esign-contracts.json';

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function nowIso() { return new Date().toISOString(); }
function sha256(v = '') { return createHash('sha256').update(String(v || '')).digest('hex'); }

function getToken(req) {
  const auth = req.headers.get('authorization') || '';
  return clean(auth.replace(/^Bearer\s+/i, ''));
}

// GET — check if session holder has signed
export async function GET(req) {
  const token = getToken(req);
  if (!token) return Response.json({ ok: false, error: 'missing_token' }, { status: 401 });

  const profile = await sessionFromToken(token);
  if (!profile) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const row = list.find((r) => norm(r?.email) === norm(profile.email)) || null;

  return Response.json({
    ok: true,
    signed: Boolean(row?.candidateSignedAt),
    countersigned: Boolean(row?.kimuraSignedAt),
    record: row ? sanitize(row) : null
  });
}

// POST — candidate submits signature
export async function POST(req) {
  const token = getToken(req);
  if (!token) return Response.json({ ok: false, error: 'missing_token' }, { status: 401 });

  const profile = await sessionFromToken(token);
  if (!profile) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = clean(body?.action || 'candidate_sign');

  if (action === 'candidate_sign') {
    const signatureData = clean(body?.signatureData || ''); // base64 drawn sig or typed name
    const signatureType = clean(body?.signatureType || 'typed'); // 'typed' | 'drawn'
    const typedName = clean(body?.typedName || '');
    const ipAddress = clean(req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '');
    const userAgent = clean(req.headers.get('user-agent') || '');

    if (!typedName && !signatureData) {
      return Response.json({ ok: false, error: 'signature_required' }, { status: 400 });
    }

    const rows = await loadJsonStore(STORE_PATH, []);
    const list = Array.isArray(rows) ? rows : [];
    const idx = list.findIndex((r) => norm(r?.email) === norm(profile.email));

    const envelopeId = `LL-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const signedAt = nowIso();

    const record = {
      envelopeId,
      email: norm(profile.email),
      name: clean(profile.name),
      phone: clean(profile.phone || ''),
      state: clean(profile.state || ''),
      trackType: clean(profile.trackType || 'unlicensed'),
      applicationId: clean(profile.applicationId || ''),
      referrerName: clean(profile.referrerName || ''),
      signatureType,
      typedName: typedName || clean(profile.name),
      signatureDataHash: signatureData ? sha256(signatureData) : '',
      candidateSignedAt: signedAt,
      ipAddress,
      userAgent,
      kimuraSignedAt: '',
      kimuraNote: '',
      finalizedAt: '',
      source: 'start_portal_esign',
      createdAt: idx >= 0 ? clean(list[idx]?.createdAt || signedAt) : signedAt,
      updatedAt: signedAt
    };

    if (idx >= 0) list[idx] = { ...list[idx], ...record };
    else list.push(record);

    await saveJsonStore(STORE_PATH, list);

    // Telegram notification
    try {
      const tgToken = clean(process.env.TELEGRAM_BOT_TOKEN || '');
      const tgChat = clean(process.env.TELEGRAM_CHAT_ID || '');
      if (tgToken && tgChat) {
        const msg = [
          '✍️ ICA Signed',
          `Name: ${record.name || '—'}`,
          `Email: ${record.email || '—'}`,
          `Track: ${record.trackType || '—'}`,
          `Time: ${record.candidateSignedAt || '—'}`,
          `Envelope: ${record.envelopeId || '—'}`,
        ].join('\n');
        await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tgChat, text: msg, disable_web_page_preview: true }),
        }).catch(() => {});
      }
    } catch { /* non-fatal */ }

    return Response.json({ ok: true, envelopeId, signedAt, record: sanitize(record) });
  }

  if (action === 'kimora_countersign') {
    // Kimora-only action — verify admin token
    const adminToken = clean(body?.adminToken || '');
    const required = clean(process.env.CONTRACT_ADMIN_TOKEN || '');
    if (!required || adminToken !== required) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const targetEmail = norm(body?.email || '');
    if (!targetEmail) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });

    const rows = await loadJsonStore(STORE_PATH, []);
    const list = Array.isArray(rows) ? rows : [];
    const idx = list.findIndex((r) => norm(r?.email) === targetEmail);
    if (idx < 0) return Response.json({ ok: false, error: 'record_not_found' }, { status: 404 });

    const now = nowIso();
    list[idx] = {
      ...list[idx],
      kimuraSignedAt: now,
      kimuraNote: clean(body?.note || ''),
      finalizedAt: now,
      updatedAt: now
    };
    await saveJsonStore(STORE_PATH, list);
    return Response.json({ ok: true, finalizedAt: now, record: sanitize(list[idx]) });
  }

  return Response.json({ ok: false, error: 'unknown_action' }, { status: 400 });
}

function sanitize(r = {}) {
  return {
    envelopeId: clean(r?.envelopeId),
    email: clean(r?.email),
    name: clean(r?.name),
    trackType: clean(r?.trackType),
    signatureType: clean(r?.signatureType),
    typedName: clean(r?.typedName),
    candidateSignedAt: clean(r?.candidateSignedAt),
    kimuraSignedAt: clean(r?.kimuraSignedAt),
    finalizedAt: clean(r?.finalizedAt),
    source: clean(r?.source),
    createdAt: clean(r?.createdAt)
  };
}
