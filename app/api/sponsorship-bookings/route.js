import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import users from '../../../data/innerCircleUsers.json';

const STORE_PATH = 'stores/sponsorship-bookings.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function nowIso() {
  return new Date().toISOString();
}

function isManager(role = '') {
  const r = normalize(role);
  return r === 'admin' || r === 'manager';
}

function findUser(name = '') {
  const needle = normalize(name);
  return (users || []).find((u) => u?.active && normalize(u.name) === needle) || null;
}

function isWithinPriorityWindow(row = {}) {
  if (!clean(row?.priority_agent)) return false;
  if (row?.priority_released) return false;
  const exp = new Date(row?.priority_expires_at || 0);
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() > Date.now();
}

function refreshExpired(rows = []) {
  const now = Date.now();
  let changed = false;
  const out = rows.map((row) => {
    const claimed = normalize(row?.claim_status).startsWith('claimed') || clean(row?.claimed_by);
    if (claimed) return row;
    if (!clean(row?.priority_agent) || row?.priority_released) return row;

    const exp = new Date(row?.priority_expires_at || 0);
    if (Number.isNaN(exp.getTime()) || exp.getTime() > now) return row;

    changed = true;
    return {
      ...row,
      priority_released: true,
      claim_status: 'Open',
      updated_at: nowIso()
    };
  });

  return { rows: out, changed };
}

async function getStore() {
  const loaded = await loadJsonStore(STORE_PATH, []);
  return refreshExpired(loaded);
}

async function writeStore(rows) {
  return await saveJsonStore(STORE_PATH, rows);
}

export async function GET() {
  const state = await getStore();
  const rows = state.rows;
  if (state.changed) await writeStore(rows);

  rows.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  return Response.json({ ok: true, rows });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const mode = normalize(body?.mode || 'upsert');
  const state = await getStore();
  const store = state.rows;

  if (mode === 'upsert') {
    const booking = body?.booking || {};
    const id = clean(booking?.id);
    if (!id) return Response.json({ ok: false, error: 'missing_booking_id' }, { status: 400 });

    const sourceId = clean(booking?.source_application_id);
    const applicantFirst = clean(booking?.applicant_first_name);
    const applicantLast = clean(booking?.applicant_last_name);
    const applicantName = clean(booking?.applicant_name);
    if (!sourceId || (!applicantFirst && !applicantLast) || applicantName.toLowerCase() === 'unknown') {
      return Response.json({ ok: false, error: 'invalid_booking_context' }, { status: 400 });
    }

    const idx = store.findIndex((r) => clean(r.id) === id);
    const next = {
      ...(idx >= 0 ? store[idx] : {}),
      ...booking,
      id,
      updated_at: nowIso()
    };

    if (idx >= 0) store[idx] = next;
    else store.unshift(next);

    await writeStore(store);
    return Response.json({ ok: true, row: next });
  }

  if (mode === 'claim') {
    const bookingId = clean(body?.bookingId);
    const claimedBy = clean(body?.claimedBy);
    if (!bookingId || !claimedBy) {
      return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }

    const actor = findUser(claimedBy) || { name: claimedBy, role: 'submitter' };

    const idx = store.findIndex((r) => clean(r.id) === bookingId);
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    const current = store[idx];
    if (clean(current?.claimed_by) && normalize(current?.claimed_by) !== normalize(claimedBy)) {
      return Response.json({ ok: false, error: 'already_claimed', claimedBy: current.claimed_by }, { status: 409 });
    }

    if (isWithinPriorityWindow(current) && normalize(current?.priority_agent) !== normalize(claimedBy) && !isManager(actor.role)) {
      return Response.json(
        {
          ok: false,
          error: 'priority_window_locked',
          priorityAgent: current.priority_agent,
          priorityExpiresAt: current.priority_expires_at
        },
        { status: 409 }
      );
    }

    store[idx] = {
      ...current,
      claim_status: 'Claimed',
      claimed_by: actor.name,
      claimed_at: nowIso(),
      priority_released: true,
      updated_at: nowIso()
    };

    await writeStore(store);
    return Response.json({ ok: true, row: store[idx] });
  }

  if (mode === 'override') {
    const bookingId = clean(body?.bookingId);
    const actorName = clean(body?.actorName);
    const targetName = clean(body?.targetName);
    const actor = findUser(actorName);
    const target = findUser(targetName);

    if (!bookingId || !actor || !target) {
      return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }

    if (!isManager(actor.role)) {
      return Response.json({ ok: false, error: 'manager_only' }, { status: 403 });
    }

    const idx = store.findIndex((r) => clean(r.id) === bookingId);
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    store[idx] = {
      ...store[idx],
      claim_status: 'Claimed',
      claimed_by: target.name,
      claimed_at: nowIso(),
      priority_released: true,
      override_by: actor.name,
      override_at: nowIso(),
      updated_at: nowIso()
    };

    await writeStore(store);
    return Response.json({ ok: true, row: store[idx] });
  }

  if (mode === 'invalidate') {
    const bookingId = clean(body?.bookingId);
    const reason = clean(body?.reason || 'Invalid booking context');
    if (!bookingId) return Response.json({ ok: false, error: 'missing_booking_id' }, { status: 400 });

    const idx = store.findIndex((r) => clean(r.id) === bookingId);
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    store[idx] = {
      ...store[idx],
      claim_status: 'Invalid',
      notes: [clean(store[idx]?.notes), reason].filter(Boolean).join(' | '),
      updated_at: nowIso()
    };

    await writeStore(store);
    return Response.json({ ok: true, row: store[idx] });
  }

  if (mode === 'delete') {
    const bookingId = clean(body?.bookingId);
    if (!bookingId) return Response.json({ ok: false, error: 'missing_booking_id' }, { status: 400 });

    const idx = store.findIndex((r) => clean(r.id) === bookingId);
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    const [removed] = store.splice(idx, 1);
    await writeStore(store);
    return Response.json({ ok: true, removed });
  }

  return Response.json({ ok: false, error: 'unsupported_mode' }, { status: 400 });
}
