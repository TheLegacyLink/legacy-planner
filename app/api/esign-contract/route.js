import { createHash, randomBytes } from 'crypto';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import { sessionFromToken as startAuthSession } from '../start-auth/_lib';
import { sessionFromToken as unlicensedSession } from '../unlicensed-backoffice/auth/_lib';
import { sessionFromToken as licensedSession } from '../licensed-backoffice/auth/_lib';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STORE_PATH = 'stores/esign-contracts.json';

function clean(v = '') { return String(v || '').trim(); }

// Resolve a session token across all back office session stores
async function resolveSession(token = '') {
  if (!token) return null;
  // Try each store in order — whichever issued the token
  const profile =
    (await startAuthSession(token).catch(() => null)) ||
    (await unlicensedSession(token).catch(() => null)) ||
    (await licensedSession(token).catch(() => null));
  return profile || null;
}
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

  const profile = await resolveSession(token);
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

  const profile = await resolveSession(token);
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

    // Sync to contract-signatures store so licensed back office policy submit gate works
    try {
      const CONTRACT_SIGS_PATH = 'stores/contract-signatures.json';
      const sigRows = await loadJsonStore(CONTRACT_SIGS_PATH, []);
      const sigList = Array.isArray(sigRows) ? sigRows : [];
      const sigIdx = sigList.findIndex((r) => norm(r?.email) === norm(profile.email));
      const sigRecord = {
        email: norm(profile.email),
        name: clean(profile.name),
        envelopeId,
        signedAt,
        source: 'esign_contract_sync',
        updatedAt: signedAt,
        createdAt: sigIdx >= 0 ? clean(sigList[sigIdx]?.createdAt || signedAt) : signedAt
      };
      if (sigIdx >= 0) sigList[sigIdx] = sigRecord;
      else sigList.push(sigRecord);
      await saveJsonStore(CONTRACT_SIGS_PATH, sigList);
    } catch { /* non-fatal — ICA still saved above */ }

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
          `Suitable: ${suitable === null ? 'N/A' : suitable ? 'Yes' : 'No'}`,
          `Policy Opt-In: ${optInPolicy ? 'Yes' : 'No'}`,
          `Upline: ${upline || '—'}`,
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

    // Send "Back Office Ready" email to the agent
    try {
      const nodemailer2 = (await import('nodemailer')).default;
      const gmailUser2 = clean(process.env.GMAIL_APP_USER || '');
      const gmailPass2 = clean(process.env.GMAIL_APP_PASSWORD || '');
      const agentEmail = clean(record?.email || '');
      const agentFirst = clean((record?.name || '').split(' ')[0] || 'there');
      const isUnlicensedTrack = (clean(record?.trackType || '').toLowerCase() === 'unlicensed');
      if (gmailUser2 && gmailPass2 && agentEmail && isUnlicensedTrack) {
        // Generate a setup token for password creation
        let setupLink = 'https://innercirclelink.com/unlicensed-backoffice';
        try {
          const { generateSetupToken } = await import('../unlicensed-backoffice/auth/_lib');
          const setupToken = await generateSetupToken(agentEmail);
          setupLink = `https://innercirclelink.com/unlicensed-backoffice/set-password?token=${setupToken}`;
        } catch { /* non-fatal — fall back to back office URL */ }
        const tx2 = nodemailer2.createTransport({ service: 'gmail', auth: { user: gmailUser2, pass: gmailPass2 } });
        const boHtml = `
<div style="font-family:Arial,Helvetica,sans-serif;background:#040B23;padding:24px;color:#E5E7EB;line-height:1.6;">
  <div style="max-width:640px;margin:0 auto;background:#0B1534;border:1px solid #1E3A8A;border-radius:18px;overflow:hidden;">
    <div style="padding:16px 24px;background:#1651AE;text-align:center;">
      <div style="color:#fff;font-weight:800;font-size:36px;letter-spacing:1px;">THE LEGACY LINK</div>
    </div>
    <div style="padding:28px 30px;">
      <h2 style="margin:0 0 12px;font-size:26px;color:#F8FAFC;">Your Back Office is Ready ✅</h2>
      <p style="color:#CBD5E1;font-size:16px;">Hi ${agentFirst},</p>
      <p style="color:#CBD5E1;font-size:16px;">Your ICA has been received. Your back office is now active and ready for you.</p>
      <p style="color:#CBD5E1;font-size:16px;">Click the button below to create your password and access your back office — no codes, no confusion.</p>
      <div style="text-align:center;margin:22px 0;">
        <a href="${setupLink}" style="display:inline-block;background:#C8A96B;color:#0B1020;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:800;font-size:16px;">Create My Password &amp; Log In →</a>
      </div>
      <div style="background:#071235;border:1px solid #294B8D;border-radius:12px;padding:14px 18px;margin:18px 0;font-size:13px;color:#94a3b8;">
        <strong style="color:#CBD5E1;">Link expires in 48 hours.</strong> If it expires, go to <a href="https://innercirclelink.com/unlicensed-backoffice" style="color:#60A5FA;">innercirclelink.com/unlicensed-backoffice</a> and use &ldquo;Send a one-time code&rdquo; to get in.
      </div>
      <p style="color:#CBD5E1;font-size:15px;">Questions? <a href="mailto:support@thelegacylink.com" style="color:#60A5FA;">support@thelegacylink.com</a></p>
      <p style="margin:18px 0 0;color:#E2E8F0;">— The Legacy Link Team</p>
    </div>
  </div>
</div>`;
        await tx2.sendMail({
          from: gmailUser2,
          to: agentEmail,
          subject: 'Your Legacy Link Back Office is Ready — Here is How to Log In',
          html: boHtml,
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
