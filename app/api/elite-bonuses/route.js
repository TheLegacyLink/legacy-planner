export const dynamic  = 'force-dynamic';
export const revalidate = 0;

// ─── Elite Bonuses API ───────────────────────────────────────────────────────
// Stores and retrieves Elite IC bonus events.
//
// GET  /api/elite-bonuses              → list all (filterable by agent / month / type)
// POST /api/elite-bonuses              → manually add a bonus entry
// PATCH /api/elite-bonuses             → update a bonus entry (mark paid, add notes, etc.)
//
// Auto-fired entries are created by lib/eliteBonus.js → called from
// sponsorship-applications route on new submission.
//
// Bonus types:
//   team_sponsorship_bonus  — $150 when downline member brings in a new sponsorship
//   policy_referral_bonus   — $1,000 when Elite IC member personally refers an FNG/NLG policy
//                             (computed in policy-payouts UI; manual entries logged here)
//   manual_bonus            — any admin-entered adjustment

import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/elite-bonuses.json';

function clean(v = '')  { return String(v || '').trim(); }
function norm(v = '')   { return clean(v).toLowerCase(); }
function nowIso()       { return new Date().toISOString(); }

async function getStore() {
  const raw = await loadJsonStore(STORE_PATH, []);
  return Array.isArray(raw) ? raw : [];
}

async function writeStore(rows) {
  return await saveJsonStore(STORE_PATH, rows);
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const filterAgent  = clean(searchParams.get('agent') || '');
  const filterMonth  = clean(searchParams.get('month') || '');  // YYYY-MM
  const filterType   = clean(searchParams.get('type') || '');
  const filterStatus = clean(searchParams.get('status') || '');

  let rows = await getStore();

  if (filterAgent)  rows = rows.filter((r) => norm(r?.agent) === norm(filterAgent));
  if (filterMonth)  rows = rows.filter((r) => (r?.eventDate || '').startsWith(filterMonth));
  if (filterType)   rows = rows.filter((r) => norm(r?.type)  === norm(filterType));
  if (filterStatus) rows = rows.filter((r) => norm(r?.status) === norm(filterStatus));

  rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const totalUnpaid = rows
    .filter((r) => norm(r?.status) !== 'paid')
    .reduce((s, r) => s + Number(r?.amount || 0), 0);
  const totalPaid = rows
    .filter((r) => norm(r?.status) === 'paid')
    .reduce((s, r) => s + Number(r?.amount || 0), 0);

  return Response.json({ ok: true, rows, totalUnpaid, totalPaid, count: rows.length });
}

// ─── POST ────────────────────────────────────────────────────────────────────
export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const bonus = {
    id:             clean(body?.id) || `eb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type:           clean(body?.type || 'manual_bonus') || 'manual_bonus',
    agent:          clean(body?.agent),
    agentEmail:     clean(body?.agentEmail || '').toLowerCase(),
    amount:         Number(body?.amount || 0) || 0,
    triggeredBy:    clean(body?.triggeredBy || ''),
    applicantName:  clean(body?.applicantName || ''),
    applicantEmail: clean(body?.applicantEmail || '').toLowerCase(),
    reason:         clean(body?.reason || ''),
    status:         clean(body?.status || 'Unpaid') || 'Unpaid',
    eventDate:      clean(body?.eventDate || nowIso()),
    notes:          clean(body?.notes || ''),
    createdAt:      nowIso(),
    updatedAt:      nowIso(),
  };

  if (!bonus.agent)   return Response.json({ ok: false, error: 'missing_agent' },  { status: 400 });
  if (!bonus.amount)  return Response.json({ ok: false, error: 'missing_amount' }, { status: 400 });

  const rows = await getStore();
  rows.unshift(bonus);
  await writeStore(rows);

  return Response.json({ ok: true, row: bonus });
}

// ─── PATCH ───────────────────────────────────────────────────────────────────
export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  const id = clean(body?.id);
  if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const rows = await getStore();
  const idx  = rows.findIndex((r) => clean(r?.id) === id);
  if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  const patch = body?.patch || {};
  const newStatus = patch.status != null ? clean(patch.status) : rows[idx].status;
  const becomingPaid = norm(rows[idx].status) !== 'paid' && norm(newStatus) === 'paid';

  rows[idx] = {
    ...rows[idx],
    status:    newStatus,
    paidAt:    becomingPaid ? nowIso() : (rows[idx].paidAt || ''),
    paidBy:    patch.paidBy  != null ? clean(patch.paidBy)  : (rows[idx].paidBy  || ''),
    notes:     patch.notes   != null ? clean(patch.notes)   : (rows[idx].notes   || ''),
    amount:    patch.amount  != null ? Number(patch.amount) : rows[idx].amount,
    updatedAt: nowIso(),
  };

  await writeStore(rows);
  return Response.json({ ok: true, row: rows[idx] });
}
