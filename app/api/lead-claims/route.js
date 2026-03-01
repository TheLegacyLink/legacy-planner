import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import users from '../../../data/innerCircleUsers.json';
import licensedAgents from '../../../data/licensedAgents.json';

const STORE_PATH = 'stores/sponsorship-bookings.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function normalizeKey(v = '') {
  return clean(v).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function nowIso() {
  return new Date().toISOString();
}

function parseFullName(lastFirst = '') {
  const raw = clean(lastFirst);
  if (!raw) return '';
  if (!raw.includes(',')) return raw;
  const [last, first] = raw.split(',').map((x) => clean(x));
  return clean(`${first} ${last}`);
}

function activeUsers() {
  return (users || []).filter((u) => u?.active);
}

function findUserByName(name = '') {
  const needle = normalize(name);
  if (!needle) return null;
  return activeUsers().find((u) => normalize(u.name) === needle) || null;
}

function isManagerRole(role = '') {
  const r = normalize(role);
  return r === 'admin' || r === 'manager';
}

function licensedStatesFor(name = '') {
  const key = normalizeKey(name);
  if (!key) return [];

  const states = new Set();
  for (const row of licensedAgents || []) {
    const rowName = parseFullName(row?.full_name || row?.name || '');
    if (normalizeKey(rowName) !== key) continue;

    const status = normalize(row?.license_status || 'active');
    if (status && !(status.includes('active') || status.includes('licensed'))) continue;

    const stateCode = clean(row?.state_code || row?.home_state || '').toUpperCase().slice(0, 2);
    if (stateCode) states.add(stateCode);
  }

  return [...states].sort();
}

function isWithinPriorityWindow(booking = {}) {
  if (!clean(booking?.priority_agent)) return false;
  if (booking?.priority_released) return false;
  const exp = new Date(booking?.priority_expires_at || 0);
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() > Date.now();
}

function maskName(value = '') {
  const parts = clean(value).split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Private';
  return parts.map((p) => `${p[0]}${'*'.repeat(Math.max(2, p.length - 1))}`).join(' ');
}

function maskEmail(value = '') {
  const email = clean(value);
  if (!email.includes('@')) return 'hidden@private';
  const [left, right] = email.split('@');
  if (!left) return `hidden@${right || 'private'}`;
  return `${left.slice(0, 1)}***@${right || 'private'}`;
}

function maskPhone(value = '') {
  const digits = clean(value).replace(/\D/g, '');
  if (!digits) return '(***) ***-****';
  const tail = digits.slice(-2).padStart(2, '*');
  return `(***) ***-**${tail}`;
}

function refreshExpiredPriority(rows = []) {
  let changed = false;
  const now = Date.now();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || {};
    const claimed = normalize(row?.claim_status).startsWith('claimed') || clean(row?.claimed_by);
    if (claimed) continue;
    if (row?.priority_released) continue;
    if (!clean(row?.priority_agent)) continue;

    const exp = new Date(row?.priority_expires_at || 0);
    if (Number.isNaN(exp.getTime())) continue;

    if (exp.getTime() <= now) {
      rows[i] = {
        ...row,
        priority_released: true,
        claim_status: 'Open',
        updated_at: nowIso()
      };
      changed = true;
    }
  }

  return { rows, changed };
}

function canViewerSeeFull(row = {}, viewerName = '', viewerRole = '') {
  if (isManagerRole(viewerRole)) return true;
  if (!clean(viewerName)) return false;
  return normalize(row?.claimed_by) === normalize(viewerName);
}

function toPortalRow(row = {}, viewerName = '', viewerRole = '') {
  const full = canViewerSeeFull(row, viewerName, viewerRole);
  const withinPriority = isWithinPriorityWindow(row);
  const claimed = normalize(row?.claim_status).startsWith('claimed') || clean(row?.claimed_by);

  const canClaim = !claimed && (!withinPriority || normalize(viewerName) === normalize(row?.priority_agent) || isManagerRole(viewerRole));

  return {
    ...row,
    visibility: full ? 'full' : 'partial',
    applicant_name: full ? clean(row?.applicant_name) : maskName(row?.applicant_name),
    applicant_email: full ? clean(row?.applicant_email) : maskEmail(row?.applicant_email),
    applicant_phone: full ? clean(row?.applicant_phone) : maskPhone(row?.applicant_phone),
    notes: full ? clean(row?.notes) : '',
    is_priority_window_open: withinPriority,
    can_claim: canClaim
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const viewerName = clean(searchParams.get('viewer'));
  const viewer = findUserByName(viewerName);
  const viewerRole = clean(viewer?.role || 'guest');

  const store = await loadJsonStore(STORE_PATH, []);
  const { rows, changed } = refreshExpiredPriority(store);
  if (changed) await saveJsonStore(STORE_PATH, rows);

  const sorted = [...rows].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  return Response.json({
    ok: true,
    viewer: viewer ? { name: viewer.name, role: viewer.role } : null,
    rows: sorted.map((r) => toPortalRow(r, viewer?.name || '', viewerRole)),
    roster: activeUsers().map((u) => ({
      name: u.name,
      role: u.role,
      licensedStates: licensedStatesFor(u.name)
    }))
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = normalize(body?.action || '');
  const actorName = clean(body?.actorName);
  const actor = findUserByName(actorName);

  if (!actor) return Response.json({ ok: false, error: 'invalid_actor' }, { status: 401 });

  const store = await loadJsonStore(STORE_PATH, []);
  const refreshed = refreshExpiredPriority(store);
  const rows = refreshed.rows;

  const bookingId = clean(body?.bookingId);
  const idx = rows.findIndex((r) => clean(r.id) === bookingId);
  if (idx < 0) return Response.json({ ok: false, error: 'booking_not_found' }, { status: 404 });

  const row = rows[idx];

  if (action === 'claim') {
    const alreadyClaimedBy = clean(row?.claimed_by);
    if (alreadyClaimedBy && normalize(alreadyClaimedBy) !== normalize(actor.name)) {
      return Response.json({ ok: false, error: 'already_claimed', claimedBy: alreadyClaimedBy }, { status: 409 });
    }

    if (isWithinPriorityWindow(row) && normalize(row?.priority_agent) !== normalize(actor.name) && !isManagerRole(actor.role)) {
      return Response.json(
        {
          ok: false,
          error: 'priority_window_locked',
          priorityAgent: row.priority_agent,
          priorityExpiresAt: row.priority_expires_at
        },
        { status: 409 }
      );
    }

    rows[idx] = {
      ...row,
      claim_status: 'Claimed',
      claimed_by: actor.name,
      claimed_at: nowIso(),
      priority_released: true,
      updated_at: nowIso()
    };

    await saveJsonStore(STORE_PATH, rows);
    return Response.json({ ok: true, row: toPortalRow(rows[idx], actor.name, actor.role) });
  }

  if (action === 'override') {
    if (!isManagerRole(actor.role)) {
      return Response.json({ ok: false, error: 'manager_only' }, { status: 403 });
    }

    const targetName = clean(body?.targetName);
    const target = findUserByName(targetName);
    if (!target) return Response.json({ ok: false, error: 'invalid_target' }, { status: 400 });

    rows[idx] = {
      ...row,
      claim_status: 'Claimed',
      claimed_by: target.name,
      claimed_at: nowIso(),
      priority_released: true,
      override_by: actor.name,
      override_at: nowIso(),
      override_note: clean(body?.note || ''),
      updated_at: nowIso()
    };

    await saveJsonStore(STORE_PATH, rows);
    return Response.json({ ok: true, row: toPortalRow(rows[idx], actor.name, actor.role) });
  }

  if (action === 'release') {
    if (!isManagerRole(actor.role)) {
      return Response.json({ ok: false, error: 'manager_only' }, { status: 403 });
    }

    rows[idx] = {
      ...row,
      priority_released: true,
      claim_status: clean(row?.claimed_by) ? row?.claim_status || 'Claimed' : 'Open',
      updated_at: nowIso()
    };

    await saveJsonStore(STORE_PATH, rows);
    return Response.json({ ok: true, row: toPortalRow(rows[idx], actor.name, actor.role) });
  }

  return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
}
