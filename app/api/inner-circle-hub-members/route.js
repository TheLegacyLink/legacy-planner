import { createHash } from 'crypto';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import { sessionFromToken } from '../licensed-backoffice/auth/_lib';
import staticUsers from '../../../data/innerCircleUsers.json';

const STORE_PATH = 'stores/inner-circle-hub-members.json';
const INNER_CIRCLE_MASTER_PASSWORD = clean(process.env.INNER_CIRCLE_HUB_MASTER_PASSWORD || 'InnerCircle#2026');

function clean(v = '') { return String(v || '').trim(); }
function nowIso() { return new Date().toISOString(); }
function hashPassword(v = '') { return createHash('sha256').update(clean(v)).digest('hex'); }

function rowTs(row = {}) {
  const t = new Date(row?.updatedAt || row?.createdAt || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function matchingIndexesByEmail(rows = [], email = '') {
  const target = clean(email).toLowerCase();
  return (Array.isArray(rows) ? rows : [])
    .map((r, idx) => ({ r, idx }))
    .filter(({ r }) => clean(r?.email).toLowerCase() === target)
    .sort((a, b) => rowTs(b.r) - rowTs(a.r))
    .map((x) => x.idx);
}

function findStaticUserByEmail(email = '') {
  const target = clean(email).toLowerCase();
  return (Array.isArray(staticUsers) ? staticUsers : []).find((u) => clean(u?.email).toLowerCase() === target) || null;
}

function buildStaticMember(user = {}, fallback = {}) {
  return {
    id: clean(fallback?.id || `static_${clean(user?.email).toLowerCase()}`),
    bookingId: clean(fallback?.bookingId || ''),
    applicantName: clean(fallback?.applicantName || user?.name || ''),
    email: clean(fallback?.email || user?.email || ''),
    active: true,
    hasPassword: true,
    contractSignedAt: clean(fallback?.contractSignedAt || nowIso()),
    paymentReceivedAt: clean(fallback?.paymentReceivedAt || nowIso()),
    onboardingUnlockedAt: clean(fallback?.onboardingUnlockedAt || nowIso()),
    modules: normalizedModules(fallback?.modules || {})
  };
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

  if (action === 'authenticate_from_licensed') {
    const auth = clean(req.headers.get('authorization'));
    const token = auth.toLowerCase().startsWith('bearer ') ? clean(auth.slice(7)) : '';
    if (!token) return Response.json({ ok: false, error: 'missing_token' }, { status: 401 });

    const licensed = await sessionFromToken(token);
    if (!licensed?.email) return Response.json({ ok: false, error: 'invalid_session' }, { status: 401 });

    const idxs = matchingIndexesByEmail(rows, licensed.email);
    if (!idxs.length) return Response.json({ ok: false, error: 'inner_circle_not_found' }, { status: 404 });

    const active = idxs.map((i) => rows[i]).find((r) => Boolean(r?.active));
    if (!active) return Response.json({ ok: false, error: 'onboarding_locked' }, { status: 403 });

    const member = {
      ...safeMember(active),
      applicantName: clean(active?.applicantName || licensed?.name || active?.email)
    };
    return Response.json({ ok: true, member });
  }

  if (action === 'authenticate') {
    const email = clean(body?.email).toLowerCase();
    const password = clean(body?.password);

    const matchIdx = matchingIndexesByEmail(rows, email);
    const activeRows = matchIdx.map((i) => rows[i]).filter((r) => Boolean(r?.active));
    const hashed = hashPassword(password);

    const foundActive = activeRows.find((r) => clean(r?.passwordHash) === hashed);
    if (foundActive) return Response.json({ ok: true, member: { ...safeMember(foundActive) }, mustChangePassword: Boolean(foundActive?.forcePasswordChange) });

    const foundAny = matchIdx.map((i) => rows[i]).find((r) => clean(r?.passwordHash) === hashed);
    if (foundAny) return Response.json({ ok: true, member: { ...safeMember({ ...foundAny, active: true }) }, mustChangePassword: Boolean(foundAny?.forcePasswordChange) });

    const staticUser = findStaticUserByEmail(email);
    const primaryRow = matchIdx.length ? rows[matchIdx[0]] : {};
    const allowMasterForEmail = !matchIdx.length || matchIdx.some((i) => rows[i]?.forcePasswordChange !== false);

    if (staticUser && staticUser?.active !== false && password === INNER_CIRCLE_MASTER_PASSWORD && allowMasterForEmail) {
      const fallbackRow = activeRows[0] || primaryRow || {};
      return Response.json({ ok: true, member: buildStaticMember(staticUser, fallbackRow), mustChangePassword: true });
    }

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
        },
        mustChangePassword: false
      });
    }

    if (!activeRows.length) return Response.json({ ok: false, error: 'onboarding_locked' }, { status: 403 });
    if (staticUser && staticUser?.active !== false && password === INNER_CIRCLE_MASTER_PASSWORD && !allowMasterForEmail) {
      return Response.json({ ok: false, error: 'personal_password_required' }, { status: 401 });
    }
    return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
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
      forcePasswordChange: typeof base?.forcePasswordChange === 'boolean' ? base.forcePasswordChange : true,
      updatedAt: nowIso()
    };
    if (idx >= 0) rows[idx] = next;
    else rows.unshift(next);
    await saveJsonStore(STORE_PATH, rows);
    return Response.json({ ok: true, row: safeMember(next) });
  }


  if (action === 'set_access') {
    const memberId = clean(body?.memberId);
    const email = clean(body?.email).toLowerCase();
    const password = clean(body?.password);
    const contractSigned = body?.contractSigned !== false;
    const paymentReceived = body?.paymentReceived !== false;
    const wantsActive = body?.active !== false;

    let idx = -1;
    if (memberId) idx = rows.findIndex((r) => clean(r?.id) === memberId);
    if (idx < 0 && email) {
      const idxs = matchingIndexesByEmail(rows, email);
      idx = idxs.length ? idxs[0] : -1;
    }
    if (idx < 0) return Response.json({ ok: false, error: 'member_not_found' }, { status: 404 });

    const current = rows[idx] || {};
    const next = {
      ...current,
      passwordHash: password ? hashPassword(password) : clean(current?.passwordHash || ''),
      resetTokenHash: '',
      resetTokenExpiresAt: '',
      contractSignedAt: contractSigned ? (current.contractSignedAt || nowIso()) : '',
      paymentReceivedAt: paymentReceived ? (current.paymentReceivedAt || nowIso()) : '',
      modules: normalizedModules(current?.modules || {}),
      forcePasswordChange: false,
      updatedAt: nowIso()
    };

    const readyToUnlock = contractSigned && paymentReceived && Boolean(clean(next.passwordHash));
    next.active = wantsActive && readyToUnlock;
    next.onboardingUnlockedAt = next.active ? (current.onboardingUnlockedAt || nowIso()) : '';

    rows[idx] = next;
    await saveJsonStore(STORE_PATH, rows);
    return Response.json({ ok: true, row: safeMember(next), readyToUnlock, warning: wantsActive && !readyToUnlock ? 'requires_contract_payment_and_password' : '' });
  }

  if (action === 'set_password') {
    const memberId = clean(body?.memberId);
    const password = clean(body?.password);
    if (!memberId || !password) return Response.json({ ok: false, error: 'missing_member_or_password' }, { status: 400 });
    const idx = rows.findIndex((r) => clean(r?.id) === memberId);
    if (idx < 0) return Response.json({ ok: false, error: 'member_not_found' }, { status: 404 });
    rows[idx] = {
      ...rows[idx],
      passwordHash: hashPassword(password),
      resetTokenHash: '',
      resetTokenExpiresAt: '',
      forcePasswordChange: false,
      updatedAt: nowIso()
    };
    await saveJsonStore(STORE_PATH, rows);
    return Response.json({ ok: true, row: safeMember(rows[idx]) });
  }


  if (action === 'self_change_password') {
    const email = clean(body?.email).toLowerCase();
    const currentPassword = clean(body?.currentPassword);
    const newPassword = clean(body?.newPassword);
    if (!email || !currentPassword || !newPassword) return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    if (newPassword.length < 8) return Response.json({ ok: false, error: 'password_too_short' }, { status: 400 });

    const idxs = matchingIndexesByEmail(rows, email);
    const latestIdx = idxs.length ? idxs[0] : -1;
    const staticUser = findStaticUserByEmail(email);

    const currentHash = hashPassword(currentPassword);
    const hasCurrentMatch = idxs.some((i) => clean(rows[i]?.passwordHash) === currentHash);
    const canUseMaster = Boolean(staticUser && staticUser?.active !== false && currentPassword === INNER_CIRCLE_MASTER_PASSWORD);

    if (!hasCurrentMatch && !canUseMaster) {
      return Response.json({ ok: false, error: 'invalid_current_password' }, { status: 401 });
    }

    const base = latestIdx >= 0
      ? rows[latestIdx]
      : {
          id: `ich_${Date.now()}`,
          bookingId: `self_${Date.now()}`,
          applicantName: clean(staticUser?.name || ''),
          email,
          createdAt: nowIso(),
          modules: defaultModules()
        };

    const next = {
      ...base,
      email,
      passwordHash: hashPassword(newPassword),
      resetTokenHash: '',
      resetTokenExpiresAt: '',
      forcePasswordChange: false,
      active: true,
      contractSignedAt: clean(base?.contractSignedAt || nowIso()),
      paymentReceivedAt: clean(base?.paymentReceivedAt || nowIso()),
      onboardingUnlockedAt: clean(base?.onboardingUnlockedAt || nowIso()),
      modules: normalizedModules(base?.modules || {}),
      updatedAt: nowIso()
    };

    if (latestIdx >= 0) {
      for (const idx of idxs) {
        rows[idx] = {
          ...rows[idx],
          email,
          passwordHash: next.passwordHash,
          resetTokenHash: '',
          resetTokenExpiresAt: '',
          forcePasswordChange: false,
          active: true,
          contractSignedAt: clean(rows[idx]?.contractSignedAt || next.contractSignedAt),
          paymentReceivedAt: clean(rows[idx]?.paymentReceivedAt || next.paymentReceivedAt),
          onboardingUnlockedAt: clean(rows[idx]?.onboardingUnlockedAt || next.onboardingUnlockedAt),
          modules: normalizedModules(rows[idx]?.modules || next.modules),
          updatedAt: nowIso()
        };
      }
    } else {
      rows.unshift(next);
    }

    await saveJsonStore(STORE_PATH, rows);
    return Response.json({ ok: true, member: safeMember(next) });
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
      forcePasswordChange: typeof body?.forcePasswordChange === 'boolean' ? body.forcePasswordChange : current?.forcePasswordChange,
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


  if (action === 'set_flags_by_email') {
    const email = clean(body?.email).toLowerCase();
    if (!email) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });
    const idxs = matchingIndexesByEmail(rows, email);
    if (!idxs.length) return Response.json({ ok: false, error: 'member_not_found' }, { status: 404 });

    const contractSigned = Boolean(body?.contractSigned);
    const paymentReceived = Boolean(body?.paymentReceived);
    const wantsActive = Boolean(body?.active);
    const forcePasswordChange = typeof body?.forcePasswordChange === 'boolean' ? body.forcePasswordChange : undefined;

    for (const idx of idxs) {
      const current = rows[idx] || {};
      const readyToUnlock = contractSigned && paymentReceived && Boolean(clean(current?.passwordHash));
      const active = wantsActive && readyToUnlock;
      rows[idx] = {
        ...current,
        contractSignedAt: contractSigned ? (current.contractSignedAt || nowIso()) : '',
        paymentReceivedAt: paymentReceived ? (current.paymentReceivedAt || nowIso()) : '',
        active,
        onboardingUnlockedAt: active ? (current.onboardingUnlockedAt || nowIso()) : '',
        forcePasswordChange: typeof forcePasswordChange === 'boolean' ? forcePasswordChange : current?.forcePasswordChange,
        modules: normalizedModules(current?.modules || {}),
        updatedAt: nowIso()
      };
    }

    await saveJsonStore(STORE_PATH, rows);
    return Response.json({ ok: true, updated: idxs.length });
  }


  if (action === 'request_password_reset') {
    return Response.json({ ok: false, error: 'password_reset_disabled' }, { status: 403 });
  }


  if (action === 'reset_password') {
    return Response.json({ ok: false, error: 'password_reset_disabled' }, { status: 403 });
  }


  if (action === 'set_password_by_email') {
    const email = clean(body?.email).toLowerCase();
    const password = clean(body?.password);
    if (!email || !password) return Response.json({ ok: false, error: 'missing_email_or_password' }, { status: 400 });

    const idxs = matchingIndexesByEmail(rows, email);
    if (!idxs.length) return Response.json({ ok: false, error: 'member_not_found' }, { status: 404 });

    const hashed = hashPassword(password);
    for (const idx of idxs) {
      rows[idx] = {
        ...rows[idx],
        passwordHash: hashed,
        resetTokenHash: '',
        resetTokenExpiresAt: '',
        active: rows[idx]?.active === false ? true : rows[idx]?.active,
        onboardingUnlockedAt: rows[idx]?.onboardingUnlockedAt || nowIso(),
        forcePasswordChange: false,
        updatedAt: nowIso()
      };
    }

    await saveJsonStore(STORE_PATH, rows);
    return Response.json({ ok: true, updated: idxs.length });
  }
  // Proxy: save carrier contracts — auth via memberId + email
  if (action === 'save_carrier_contracts') {
    const memberId = clean(body?.memberId);
    const email = clean(body?.email || '').toLowerCase();
    const contracts = body?.contracts || {};
    if (!memberId || !email) return Response.json({ ok: false, error: 'missing_member_or_email' }, { status: 400 });
    const STATIC_ADMINS = ['kimora@thelegacylink.com', 'link@thelegacylink.com'];
    const isStaticAdmin = STATIC_ADMINS.includes(email);
    if (!isStaticAdmin) {
      const found = rows.find((r) => clean(r?.id) === memberId && clean(r?.email || '').toLowerCase() === email && Boolean(r?.active));
      if (!found) return Response.json({ ok: false, error: 'member_not_found' }, { status: 403 });
    }
    const ALLOWED = ['fg', 'mutual_of_omaha', 'national_life'];
    const sanitized = {};
    for (const k of ALLOWED) {
      if (contracts[k] !== undefined) sanitized[k] = { contracted: Boolean(contracts[k]?.contracted), agentId: clean(contracts[k]?.agentId || ''), status: clean(contracts[k]?.status || '') };
    }
    const cStore = await loadJsonStore('stores/agent-carrier-contracts.json', {});
    const cData = (cStore && typeof cStore === 'object' && !Array.isArray(cStore)) ? cStore : {};
    cData[email] = sanitized;
    await saveJsonStore('stores/agent-carrier-contracts.json', cData);
    return Response.json({ ok: true, contracts: sanitized });
  }

  // Proxy: save licensed states — auth via memberId + email (no bearer token needed)
  if (action === 'save_licensed_states') {
    const memberId = clean(body?.memberId);
    const email = clean(body?.email || '').toLowerCase();
    const rawStates = Array.isArray(body?.states) ? body.states : [];
    const states = rawStates.map((s) => String(s || '').toUpperCase().trim()).filter((s) => s.length === 2);

    if (!memberId || !email) return Response.json({ ok: false, error: 'missing_member_or_email' }, { status: 400 });

    // Validate: member must exist with matching id + email (or be a known static admin)
    const STATIC_ADMINS = ['kimora@thelegacylink.com', 'link@thelegacylink.com'];
    const isStaticAdmin = STATIC_ADMINS.includes(email);
    if (!isStaticAdmin) {
      const found = rows.find((r) => clean(r?.id) === memberId && clean(r?.email || '').toLowerCase() === email && Boolean(r?.active));
      if (!found) return Response.json({ ok: false, error: 'member_not_found' }, { status: 403 });
    }

    const statesStore = await loadJsonStore('stores/agent-licensed-states.json', {});
    const statesData = (statesStore && typeof statesStore === 'object' && !Array.isArray(statesStore)) ? statesStore : {};
    statesData[email] = states;
    await saveJsonStore('stores/agent-licensed-states.json', statesData);

    return Response.json({ ok: true, states });
  }

  return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
}
