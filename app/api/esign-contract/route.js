import { createHash, randomBytes } from 'crypto';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import { sessionFromToken as sessionFromStartAuth } from '../start-auth/_lib';

const UNLICENSED_SESSIONS_PATH = 'stores/unlicensed-backoffice-sessions.json';
const LICENSED_SESSIONS_PATH = 'stores/licensed-backoffice-sessions.json';

async function sessionFromToken(token = '') {
  // Try start-auth sessions first
  const profile = await sessionFromStartAuth(token);
  if (profile) return profile;

  // Try unlicensed back office sessions
  const t = String(token || '').trim();
  if (!t) return null;
  const hash = createHash('sha256').update(t).digest('hex');

  for (const [path, defaultTrack] of [[UNLICENSED_SESSIONS_PATH, 'unlicensed'], [LICENSED_SESSIONS_PATH, 'licensed']]) {
    try {
      const rows = await loadJsonStore(path, []);
      const hit = (Array.isArray(rows) ? rows : []).find((r) => String(r?.tokenHash || '') === hash && r?.active !== false);
      if (hit) {
        const exp = new Date(hit?.expiresAt || 0).getTime();
        if (Number.isFinite(exp) && exp > Date.now()) {
          return {
            email: String(hit?.email || '').toLowerCase().trim(),
            name: String(hit?.name || '').trim(),
            phone: String(hit?.phone || '').trim(),
            state: String(hit?.state || '').trim(),
            trackType: String(hit?.trackType || defaultTrack).trim(),
            applicationId: String(hit?.applicationId || '').trim(),
            referrerName: String(hit?.referrerName || '').trim(),
          };
        }
      }
    } catch { /* skip */ }
  }
  return null;
}

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

    const suitabilityAnswers = body?.suitabilityAnswers || {};
    const suitable = body?.suitable !== undefined ? Boolean(body.suitable) : null;
    const optInPolicy = Boolean(body?.optInPolicy);
    const upline = clean(body?.upline || profile.referrerName || '');

    const record = {
      envelopeId,
      email: norm(profile.email),
      name: clean(profile.name),
      phone: clean(profile.phone || ''),
      state: clean(profile.state || ''),
      trackType: clean(profile.trackType || 'unlicensed'),
      applicationId: clean(profile.applicationId || ''),
      referrerName: upline,
      signatureType,
      typedName: typedName || clean(profile.name),
      signatureDataHash: signatureData ? sha256(signatureData) : '',
      candidateSignedAt: signedAt,
      ipAddress,
      userAgent,
      suitabilityAnswers,
      suitable,
      optInPolicy,
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
        const signerFirstName = (record.name || '').trim().split(/\s+/)[0] || '—';
        const uplineNorm = (upline || '').trim();
        const uplineDisplay = uplineNorm.toLowerCase() === 'kimora link'
          ? 'Link'
          : (uplineNorm.split(/\s+/)[0] || '—');
        const msg = [
          '✍️ ICA Signed',
          `Name: ${signerFirstName}`,
          `Track: ${record.trackType || '—'}`,
          `Suitable: ${suitable === null ? 'N/A' : suitable ? 'Yes' : 'No'}`,
          `Policy Opt-In: ${optInPolicy ? 'Yes' : 'No'}`,
          `Upline: ${uplineDisplay}`,
          'Congratulations — keep up the good work! 🏆',
        ].join('\n');
        await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tgChat, text: msg, disable_web_page_preview: true }),
        }).catch(() => {});
      }
    } catch { /* non-fatal */ }

    // Email notification to Kimora + upline
    try {
      const nodemailer = (await import('nodemailer')).default;
      const gmailUser = clean(process.env.GMAIL_APP_USER || '');
      const gmailPass = clean(process.env.GMAIL_APP_PASSWORD || '');
      if (gmailUser && gmailPass) {
        const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });
        const suitStr = suitable === null ? 'N/A' : suitable ? '✅ Suitable' : '❌ Not Suitable';
        const policyStr = optInPolicy ? '✅ Opted In' : '❌ Opted Out';
        const html = `
          <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;">
            <h2 style="margin:0 0 8px;">✍️ ICA Signed — Review Required</h2>
            <p><strong>Name:</strong> ${record.name}</p>
            <p><strong>Email:</strong> ${record.email}</p>
            <p><strong>Track:</strong> ${record.trackType}</p>
            <p><strong>Upline:</strong> ${upline || '—'}</p>
            <p><strong>Suitability:</strong> ${suitStr}</p>
            <p><strong>Company Policy Election:</strong> ${policyStr}</p>
            <p><strong>Envelope ID:</strong> ${record.envelopeId}</p>
            <p><strong>Signed At:</strong> ${record.candidateSignedAt}</p>
            <hr/>
            <p style="color:#64748b;font-size:13px;">This agent requires your countersignature to finalize their ICA. Please review and sign off.</p>
          </div>`;
        const recipients = ['link@thelegacylink.com'];
        if (upline && upline.includes('@')) recipients.push(upline);
        await transporter.sendMail({
          from: gmailUser,
          to: recipients.join(', '),
          subject: `ICA Signed — ${record.name} (${suitStr} | ${policyStr})`,
          html,
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
    createdAt: clean(r?.createdAt),
    suitable: r?.suitable ?? null,
    optInPolicy: Boolean(r?.optInPolicy),
    referrerName: clean(r?.referrerName)
  };
}
