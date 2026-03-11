import { createHash, randomBytes } from 'crypto';
import nodemailer from 'nodemailer';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/inner-circle-hub-members.json';

function clean(v = '') { return String(v || '').trim(); }
function nowIso() { return new Date().toISOString(); }
function hashPassword(v = '') { return createHash('sha256').update(clean(v)).digest('hex'); }

function mailer() {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass || !from) return null;
  return { from, tx: nodemailer.createTransport({ service: 'gmail', auth: { user, pass } }) };
}

function generateResetToken() {
  return randomBytes(24).toString('base64url');
}

async function sendPasswordResetEmail({ to = '', applicantName = '', resetLink = '' } = {}) {
  const m = mailer();
  if (!m) return { ok: false, error: 'mail_not_configured' };
  const safeName = clean(applicantName) || 'there';
  const subject = 'Inner Circle Hub — Reset Your Password';
  const text = [
    `Hi ${safeName},`,
    '',
    'Reset your Inner Circle Hub password using the secure link below:',
    resetLink,
    '',
    'This link expires in 30 minutes.',
    'If you did not request this, you can ignore this email.',
    '',
    '— The Legacy Link Team'
  ].join('
');

  const html = `
    <div style="margin:0;padding:20px;background:#0B1020;font-family:Arial,Helvetica,sans-serif;color:#F8FAFC;">
      <div style="max-width:640px;margin:0 auto;border:1px solid #1D428A;border-radius:12px;background:#111A33;padding:18px;">
        <h2 style="margin:0 0 10px;color:#fff;">Inner Circle Hub Password Reset</h2>
        <p style="margin:0 0 12px;">Hi ${safeName},</p>
        <p style="margin:0 0 14px;">Use the button below to reset your password.</p>
        <a href="${resetLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;">Reset Password</a>
        <p style="margin:14px 0 0;color:#cbd5e1;">This link expires in 30 minutes.</p>
      </div>
    </div>`;

  const info = await m.tx.sendMail({ from: m.from, to, subject, text, html });
  return { ok: true, messageId: info?.messageId || '' };
}

function defaultModules() {
  return {
    dashboard: true,
    faststart: true,
    scripts: true,
    execution: true,
    vault: true,
    tracker: true,
    links: true
  };
}

function normalizedModules(raw = {}) {
  const base = defaultModules();
  return {
    dashboard: raw?.dashboard !== false && base.dashboard,
    faststart: raw?.faststart !== false && base.faststart,
    scripts: raw?.scripts !== false && base.scripts,
    execution: raw?.execution !== false && base.execution,
    vault: raw?.vault !== false && base.vault,
    tracker: raw?.tracker !== false && base.tracker,
    links: raw?.links !== false && base.links
  };
}

function safeMember(row = {}) {
  return {
    id: clean(row?.id),
    bookingId: clean(row?.bookingId),
    applicantName: clean(row?.applicantName),
    email: clean(row?.email),
    active: Boolean(row?.active),
    hasPassword: Boolean(clean(row?.passwordHash)),
    contractSignedAt: clean(row?.contractSignedAt),
    paymentReceivedAt: clean(row?.paymentReceivedAt),
    onboardingUnlockedAt: clean(row?.onboardingUnlockedAt),
    modules: normalizedModules(row?.modules || {}),
    createdAt: clean(row?.createdAt),
    updatedAt: clean(row?.updatedAt)
  };
}

export async function GET() {
  const rows = await loadJsonStore(STORE_PATH, []);
  const safeRows = Array.isArray(rows) ? rows.map((r) => safeMember(r)) : [];
  return Response.json({ ok: true, rows: safeRows });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = clean(body?.action || '').toLowerCase();
  const rows = await loadJsonStore(STORE_PATH, []);

  if (action === 'authenticate') {
    const email = clean(body?.email).toLowerCase();
    const password = clean(body?.password);

    // Emergency fallback for owner preview access.
    const ownerEmail = 'kimora@thelegacylink.com';
    const ownerPass = clean(process.env.INNER_CIRCLE_HUB_OWNER_PASSWORD || '');
    if (ownerPass && email === ownerEmail && password === ownerPass) {
      return Response.json({
        ok: true,
        member: {
          id: 'owner_preview',
          applicantName: 'Kimora Link',
          email: ownerEmail,
          active: true,
          hasPassword: true,
          contractSignedAt: nowIso(),
          paymentReceivedAt: nowIso(),
          onboardingUnlockedAt: nowIso(),
          modules: defaultModules()
        }
      });
    }

    const found = rows.find((r) => clean(r?.email).toLowerCase() === email);
    if (!found) return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
    if (!found?.active) return Response.json({ ok: false, error: 'onboarding_locked' }, { status: 403 });
    if (clean(found?.passwordHash) !== hashPassword(password)) return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });

    return Response.json({ ok: true, member: { ...safeMember(found) } });
  }

  if (action === 'upsert_from_booking') {
    const bookingId = clean(body?.bookingId);
    const applicantName = clean(body?.applicantName);
    const email = clean(body?.email).toLowerCase();
    if (!bookingId || !email) return Response.json({ ok: false, error: 'missing_booking_or_email' }, { status: 400 });

    const idx = rows.findIndex((r) => clean(r?.bookingId) === bookingId || clean(r?.email).toLowerCase() === email);
    const base = idx >= 0 ? rows[idx] : { id: `ich_${Date.now()}`, createdAt: nowIso(), active: false, modules: defaultModules() };
    const next = {
      ...base,
      bookingId,
      applicantName: applicantName || base.applicantName || '',
      email,
      modules: normalizedModules(base?.modules || {}),
      updatedAt: nowIso()
    };
    if (idx >= 0) rows[idx] = next;
    else rows.unshift(next);
    await saveJsonStore(STORE_PATH, rows);
    return Response.json({ ok: true, row: safeMember(next) });
  }

  if (action === 'set_password') {
    const memberId = clean(body?.memberId);
    const password = clean(body?.password);
    if (!memberId || !password) return Response.json({ ok: false, error: 'missing_member_or_password' }, { status: 400 });
    const idx = rows.findIndex((r) => clean(r?.id) === memberId);
    if (idx < 0) return Response.json({ ok: false, error: 'member_not_found' }, { status: 404 });
    rows[idx] = { ...rows[idx], passwordHash: hashPassword(password), updatedAt: nowIso() };
    await saveJsonStore(STORE_PATH, rows);
    return Response.json({ ok: true, row: safeMember(rows[idx]) });
  }

  if (action === 'set_modules') {
    const memberId = clean(body?.memberId);
    if (!memberId) return Response.json({ ok: false, error: 'missing_member_id' }, { status: 400 });
    const idx = rows.findIndex((r) => clean(r?.id) === memberId);
    if (idx < 0) return Response.json({ ok: false, error: 'member_not_found' }, { status: 404 });

    const current = rows[idx] || {};
    const next = {
      ...current,
      modules: normalizedModules(body?.modules || current?.modules || {}),
      updatedAt: nowIso()
    };

    rows[idx] = next;
    await saveJsonStore(STORE_PATH, rows);
    return Response.json({ ok: true, row: safeMember(next) });
  }

  if (action === 'set_flags') {
    const memberId = clean(body?.memberId);
    if (!memberId) return Response.json({ ok: false, error: 'missing_member_id' }, { status: 400 });
    const idx = rows.findIndex((r) => clean(r?.id) === memberId);
    if (idx < 0) return Response.json({ ok: false, error: 'member_not_found' }, { status: 404 });

    const current = rows[idx] || {};
    const contractSigned = Boolean(body?.contractSigned);
    const paymentReceived = Boolean(body?.paymentReceived);
    const wantsActive = Boolean(body?.active);
    const readyToUnlock = contractSigned && paymentReceived && Boolean(clean(current?.passwordHash));
    const active = wantsActive && readyToUnlock;

    const next = {
      ...current,
      contractSignedAt: contractSigned ? (current.contractSignedAt || nowIso()) : '',
      paymentReceivedAt: paymentReceived ? (current.paymentReceivedAt || nowIso()) : '',
      active,
      onboardingUnlockedAt: active ? (current.onboardingUnlockedAt || nowIso()) : '',
      modules: normalizedModules(current?.modules || {}),
      updatedAt: nowIso()
    };

    rows[idx] = next;
    await saveJsonStore(STORE_PATH, rows);

    return Response.json({
      ok: true,
      row: safeMember(next),
      readyToUnlock,
      warning: wantsActive && !readyToUnlock ? 'requires_contract_payment_and_password' : ''
    });
  }



  if (action === 'request_password_reset') {
    const email = clean(body?.email).toLowerCase();
    if (!email) return Response.json({ ok: true });

    const idx = rows.findIndex((r) => clean(r?.email).toLowerCase() === email);
    if (idx < 0) return Response.json({ ok: true });

    const token = generateResetToken();
    const tokenHash = hashPassword(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    rows[idx] = {
      ...rows[idx],
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: expiresAt,
      updatedAt: nowIso()
    };
    await saveJsonStore(STORE_PATH, rows);

    const origin = clean(body?.origin || process.env.NEXT_PUBLIC_APP_URL || 'https://innercirclelink.com').replace(/\/$/, '');
    const resetLink = `${origin}/inner-circle-hub?reset=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    try {
      await sendPasswordResetEmail({ to: email, applicantName: rows[idx]?.applicantName || '', resetLink });
    } catch {
      // keep response generic for safety
    }

    return Response.json({ ok: true });
  }

  if (action === 'reset_password') {
    const email = clean(body?.email).toLowerCase();
    const token = clean(body?.token);
    const password = clean(body?.password);
    if (!email || !token || !password) return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });

    const idx = rows.findIndex((r) => clean(r?.email).toLowerCase() === email);
    if (idx < 0) return Response.json({ ok: false, error: 'invalid_or_expired_token' }, { status: 400 });

    const row = rows[idx] || {};
    const expires = new Date(row?.resetTokenExpiresAt || 0).getTime();
    const valid = clean(row?.resetTokenHash) && clean(row?.resetTokenHash) === hashPassword(token) && Number.isFinite(expires) && expires > Date.now();
    if (!valid) return Response.json({ ok: false, error: 'invalid_or_expired_token' }, { status: 400 });

    rows[idx] = {
      ...row,
      passwordHash: hashPassword(password),
      resetTokenHash: '',
      resetTokenExpiresAt: '',
      updatedAt: nowIso()
    };
    await saveJsonStore(STORE_PATH, rows);
    return Response.json({ ok: true });
  }
  return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
}
