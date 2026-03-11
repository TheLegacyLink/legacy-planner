import { createHash } from 'crypto';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/inner-circle-hub-members.json';

function clean(v = '') { return String(v || '').trim(); }
function nowIso() { return new Date().toISOString(); }
function hashPassword(v = '') { return createHash('sha256').update(clean(v)).digest('hex'); }

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
    const ownerPass = clean(process.env.INNER_CIRCLE_HUB_OWNER_PASSWORD || 'KimoraHub2026');
    if (email === ownerEmail && password === ownerPass) {
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
          onboardingUnlockedAt: nowIso()
        }
      });
    }

    const found = rows.find((r) => clean(r?.email).toLowerCase() === email);
    if (!found) return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
    if (!found?.active) return Response.json({ ok: false, error: 'onboarding_locked' }, { status: 403 });
    if (clean(found?.passwordHash) !== hashPassword(password)) return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });

    return Response.json({
      ok: true,
      member: {
        ...safeMember(found)
      }
    });
  }

  if (action === 'upsert_from_booking') {
    const bookingId = clean(body?.bookingId);
    const applicantName = clean(body?.applicantName);
    const email = clean(body?.email).toLowerCase();
    if (!bookingId || !email) return Response.json({ ok: false, error: 'missing_booking_or_email' }, { status: 400 });

    const idx = rows.findIndex((r) => clean(r?.bookingId) === bookingId || clean(r?.email).toLowerCase() === email);
    const base = idx >= 0 ? rows[idx] : { id: `ich_${Date.now()}`, createdAt: nowIso(), active: false };
    const next = {
      ...base,
      bookingId,
      applicantName: applicantName || base.applicantName || '',
      email,
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

  return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
}
