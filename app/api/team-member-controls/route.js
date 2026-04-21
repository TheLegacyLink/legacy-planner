export const dynamic = 'force-dynamic';

import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

const LICENSE_OVERRIDES_PATH = 'stores/team-license-overrides.json';
const HIERARCHY_PATH = 'stores/team-hierarchy.json';

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function nowIso() { return new Date().toISOString(); }

// Verify that actorEmail is an upline of targetEmail in the hierarchy
async function isInActorTree(actorEmail = '', targetEmail = '') {
  if (!actorEmail || !targetEmail) return false;
  const rows = await loadJsonStore(HIERARCHY_PATH, []);
  const actorNorm = norm(actorEmail);
  const targetNorm = norm(targetEmail);

  // BFS from target upward — does it reach actorEmail?
  const visited = new Set();
  let queue = [targetNorm];
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    // Find parent of current
    const row = rows.find((r) => norm(r?.childEmail || '') === current || norm(r?.childKey || '') === current);
    if (!row) continue;
    const parentEmail = norm(row?.parentEmail || '');
    if (parentEmail === actorNorm) return true;
    if (parentEmail) queue.push(parentEmail);
  }
  return false;
}

export async function GET(req) {
  const overrides = await loadJsonStore(LICENSE_OVERRIDES_PATH, []);
  return Response.json({ ok: true, overrides });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = clean(body?.action || '');
  const actorEmail = norm(body?.actorEmail || '');
  const targetEmail = norm(body?.targetEmail || '');
  const targetName = clean(body?.targetName || '');

  if (!actorEmail) return Response.json({ ok: false, error: 'missing_actor' }, { status: 400 });
  if (!targetEmail && action !== 'remove') return Response.json({ ok: false, error: 'missing_target' }, { status: 400 });

  // Admin bypass — Kimora can do anything
  const isAdmin = actorEmail === 'kimora@thelegacylink.com' || actorEmail === 'investalinkinsurance@gmail.com';

  // For non-admins, verify target is in actor's tree
  if (!isAdmin && targetEmail) {
    const inTree = await isInActorTree(actorEmail, targetEmail);
    if (!inTree) {
      return Response.json({ ok: false, error: 'target_not_in_tree' }, { status: 403 });
    }
  }

  // ── Set license override ─────────────────────────────────────────────────
  if (action === 'set_license') {
    const trackType = clean(body?.trackType || ''); // 'licensed' | 'unlicensed'
    if (!['licensed', 'unlicensed'].includes(trackType)) {
      return Response.json({ ok: false, error: 'invalid_track_type' }, { status: 400 });
    }

    const overrides = await loadJsonStore(LICENSE_OVERRIDES_PATH, []);
    const existing = overrides.findIndex((o) => norm(o?.email) === targetEmail);
    const record = {
      email: targetEmail,
      name: targetName,
      trackType,
      setBy: actorEmail,
      setAt: nowIso()
    };

    if (existing >= 0) overrides[existing] = record;
    else overrides.push(record);
    await saveJsonStore(LICENSE_OVERRIDES_PATH, overrides);

    return Response.json({ ok: true, record });
  }

  // ── Remove from hierarchy ────────────────────────────────────────────────
  if (action === 'remove') {
    const childKey = clean(body?.childKey || '');
    if (!childKey) return Response.json({ ok: false, error: 'missing_child_key' }, { status: 400 });

    const rows = await loadJsonStore(HIERARCHY_PATH, []);
    const idx = rows.findIndex((r) => clean(r?.childKey || '') === childKey);
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    if (!isAdmin) {
      const rowEmail = norm(rows[idx]?.childEmail || '');
      const inTree = await isInActorTree(actorEmail, rowEmail);
      if (!inTree) return Response.json({ ok: false, error: 'target_not_in_tree' }, { status: 403 });
    }

    rows.splice(idx, 1);
    await saveJsonStore(HIERARCHY_PATH, rows);
    return Response.json({ ok: true, removed: childKey });
  }

  // ── Reassign (change parent) ─────────────────────────────────────────────
  if (action === 'reassign') {
    const childKey = clean(body?.childKey || '');
    const newParentEmail = norm(body?.newParentEmail || '');
    const newParentName = clean(body?.newParentName || '');
    if (!childKey || !newParentEmail) return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });

    // Non-admins: new parent must also be in actor's tree (or be actor themselves)
    if (!isAdmin && newParentEmail !== actorEmail) {
      const parentInTree = await isInActorTree(actorEmail, newParentEmail);
      if (!parentInTree) return Response.json({ ok: false, error: 'new_parent_not_in_tree' }, { status: 403 });
    }

    const rows = await loadJsonStore(HIERARCHY_PATH, []);
    const idx = rows.findIndex((r) => clean(r?.childKey || '') === childKey);
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    rows[idx] = {
      ...rows[idx],
      parentEmail: newParentEmail,
      parentName: newParentName,
      parentLabel: newParentName,
      updatedAt: nowIso(),
      note: `reassigned_by:${actorEmail}:${nowIso()}`
    };
    await saveJsonStore(HIERARCHY_PATH, rows);
    return Response.json({ ok: true, updated: rows[idx] });
  }

  return Response.json({ ok: false, error: 'unknown_action' }, { status: 400 });
}
