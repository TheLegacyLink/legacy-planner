import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import ownerOverrides from '../../../data/callerOwnerOverrides.json';

const STORE_PATH = 'stores/caller-leads.json';
const LEAD_ROUTER_EVENTS_PATH = 'stores/lead-router-events.json';

async function getStore() {
  return await loadJsonStore(STORE_PATH, []);
}

async function writeStore(rows) {
  return await saveJsonStore(STORE_PATH, rows);
}

function nowIso() {
  return new Date().toISOString();
}

function clean(v = '') {
  return String(v || '').trim();
}

function normalizeName(v = '') {
  return clean(v).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizePhone(v = '') {
  return String(v || '').replace(/\D/g, '');
}

function normalizeOwner(v = '') {
  const s = clean(v).toLowerCase();
  if (!s) return '';
  if (s.includes('kimora')) return 'Kimora Link';
  if (s.includes('jamal')) return 'Jamal Holmes';
  if (s.includes('leticia') || s.includes('latricia')) return 'Leticia Wright';
  if (s.includes('kelin')) return 'Kelin Brown';
  if (s.includes('mahogany')) return 'Mahogany Burns';
  if (s.includes('madalyn')) return 'Madalyn Adams';
  if (s.includes('breanna') || s.includes('brianna')) return 'Breanna James';
  return clean(v);
}

function isUnknownOwner(v = '') {
  const s = clean(v).toLowerCase();
  return !s || s === 'unknown' || s === 'unassigned';
}

function ownerOverrideForLead(lead = {}) {
  const nameKey = normalizeName(lead?.name || `${lead?.firstName || ''} ${lead?.lastName || ''}`);
  const emailKey = clean(lead?.email || '').toLowerCase();
  const phoneKey = normalizePhone(lead?.phone || '');

  const hit = (ownerOverrides || []).find((r) => {
    const byName = normalizeName(r?.name || '');
    const byEmail = clean(r?.email || '').toLowerCase();
    const byPhone = normalizePhone(r?.phone || '');

    return (byName && nameKey && byName === nameKey) || (byEmail && emailKey && byEmail === emailKey) || (byPhone && phoneKey && byPhone === phoneKey);
  });

  return normalizeOwner(hit?.owner || '');
}

function ownerFromEventsForLead(lead = {}, events = []) {
  const ext = clean(lead.externalId || '');
  const em = clean(lead.email || '').toLowerCase();
  const ph = normalizePhone(lead.phone || '');
  const nm = normalizeName(lead.name || '');

  const sorted = [...(events || [])].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  const hit = sorted.find((e) => {
    const owner = normalizeOwner(e?.assignedTo || e?.owner || '');
    if (isUnknownOwner(owner)) return false;

    const eExt = clean(e?.externalId || '');
    const eEm = clean(e?.email || '').toLowerCase();
    const ePh = normalizePhone(e?.phone || '');
    const eNm = normalizeName(e?.name || '');

    return (ext && eExt && ext === eExt) || (em && eEm && em === eEm) || (ph && ePh && ph === ePh) || (nm && eNm && nm === eNm);
  });

  return normalizeOwner(hit?.assignedTo || hit?.owner || '');
}

const CALL_RESULT_VALUES = new Set([
  'missed call',
  'voicemail left',
  'do not disturb',
  'no answer',
  'wrong number',
  'spoke - follow-up',
  'spoke - booked'
]);

function isCallResultValue(v = '') {
  return CALL_RESULT_VALUES.has(clean(v).toLowerCase());
}

function withStageAudit(prevStage = 'New', nextStage = 'New', actor = 'System') {
  const from = clean(prevStage || 'New') || 'New';
  const to = clean(nextStage || from) || from;
  if (from === to) return {};
  return {
    stage: to,
    stageUpdatedAt: nowIso(),
    stageUpdatedBy: clean(actor || 'System') || 'System'
  };
}

function parseLeadPayload(body = {}) {
  const candidate = body?.lead || body?.contact || body || {};

  const id =
    clean(candidate.id) ||
    clean(candidate.contactId) ||
    clean(candidate.contact_id) ||
    clean(candidate.leadId) ||
    `ghl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const first = clean(candidate.firstName || candidate.first_name);
  const last = clean(candidate.lastName || candidate.last_name);
  const fullName = clean(candidate.name) || clean(`${first} ${last}`) || 'Unknown Lead';

  const ownerHint = normalizeOwner(
    candidate.assignedToName ||
      candidate.assigned_to_name ||
      candidate.assignedTo ||
      candidate.assigned_to ||
      body.assignedToName ||
      body.assigned_to_name
  );

  const overrideOwner = ownerOverrideForLead({
    name: fullName,
    email: clean(candidate.email),
    phone: clean(candidate.phone || candidate.phoneNumber || candidate.phone_number)
  });

  const assignedTo = isUnknownOwner(ownerHint) ? (overrideOwner || 'Unknown') : ownerHint;

  return {
    id,
    externalId: clean(candidate.id || candidate.contactId || candidate.contact_id || ''),
    name: fullName,
    email: clean(candidate.email),
    phone: clean(candidate.phone || candidate.phoneNumber || candidate.phone_number),
    licensedStatus: clean(candidate.licensedStatus || candidate.licensed_status || body.licensedStatus || body.licensed_status || 'Unknown') || 'Unknown',
    source: clean(candidate.source || body.source || 'GHL Webhook'),
    notes: clean(candidate.notes || body.notes || ''),
    callResult: clean(candidate.callResult || candidate.call_result || body.callResult || body.call_result || ''),
    callAttempts: Number(candidate.callAttempts || candidate.call_attempts || body.callAttempts || body.call_attempts || 0) || 0,
    lastCallAttemptAt: clean(candidate.lastCallAttemptAt || candidate.last_call_attempt_at || body.lastCallAttemptAt || body.last_call_attempt_at || ''),
    stage: 'New',
    owner: assignedTo,
    calledAt: '',
    connectedAt: '',
    qualifiedAt: '',
    formSentAt: '',
    inviteSentAt: '',
    formCompletedAt: '',
    policyStartedAt: '',
    approvedAt: '',
    onboardingStartedAt: '',
    movedForwardAt: '',
    lastCallDurationSec: Number(candidate.lastCallDurationSec || candidate.callDurationSec || candidate.call_duration_sec || candidate.duration || body.lastCallDurationSec || body.callDurationSec || body.call_duration_sec || body.duration || 0) || 0,
    lastCallRecordingUrl: clean(candidate.lastCallRecordingUrl || candidate.recordingUrl || candidate.recording_url || body.lastCallRecordingUrl || body.recordingUrl || body.recording_url || ''),
    stageUpdatedAt: clean(candidate.stageUpdatedAt || candidate.stage_updated_at || ''),
    stageUpdatedBy: clean(candidate.stageUpdatedBy || candidate.stage_updated_by || body.stageUpdatedBy || body.stage_updated_by || ''),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

function validateToken(req, body = {}) {
  const required = process.env.GHL_INTAKE_TOKEN || '';
  if (!required) return true;
  const headerToken = req.headers.get('x-intake-token') || req.headers.get('x-ghl-token') || '';
  const bodyToken = clean(body?.token);
  return headerToken === required || bodyToken === required;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const owner = clean(searchParams.get('owner'));
  const store = await getStore();

  const out = owner
    ? store.filter((r) => normalizeOwner(r.owner) === normalizeOwner(owner))
    : store;

  out.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return Response.json({ ok: true, rows: out });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const store = await getStore();
  const mode = clean(body?.mode || 'upsert').toLowerCase();

  if (mode === 'repair-unknown-owners') {
    const events = await loadJsonStore(LEAD_ROUTER_EVENTS_PATH, []);
    let updated = 0;

    for (const row of store) {
      if (!isUnknownOwner(row?.owner)) continue;

      const overrideOwner = ownerOverrideForLead(row);
      const inferred = overrideOwner || ownerFromEventsForLead(row, events);
      if (isUnknownOwner(inferred)) continue;
      row.owner = inferred;
      row.updatedAt = nowIso();
      row.stageUpdatedBy = clean(row.stageUpdatedBy || 'System Repair');
      updated += 1;
    }

    if (updated > 0) await writeStore(store);
    return Response.json({ ok: true, updated, total: store.length });
  }

  if (mode === 'create-manual') {
    const row = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      externalId: '',
      name: clean(body?.name),
      email: clean(body?.email),
      phone: clean(body?.phone),
      licensedStatus: clean(body?.licensedStatus || 'Unknown') || 'Unknown',
      source: clean(body?.source || 'Manual'),
      notes: clean(body?.notes || ''),
      callResult: clean(body?.callResult || ''),
      callAttempts: Number(body?.callAttempts || 0) || 0,
      lastCallAttemptAt: clean(body?.lastCallAttemptAt || ''),
      stage: clean(body?.stage || 'New') || 'New',
      owner: normalizeOwner(body?.owner || 'Kimora Link') || 'Kimora Link',
      calledAt: '',
      connectedAt: '',
      qualifiedAt: '',
      formSentAt: '',
      inviteSentAt: '',
      formCompletedAt: '',
      policyStartedAt: '',
      approvedAt: '',
      onboardingStartedAt: '',
      movedForwardAt: '',
      lastCallDurationSec: 0,
      lastCallRecordingUrl: '',
      stageUpdatedAt: nowIso(),
      stageUpdatedBy: 'Manual Create',
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    if (!row.name) {
      return Response.json({ ok: false, error: 'missing_name' }, { status: 400 });
    }

    store.push(row);
    await writeStore(store);
    return Response.json({ ok: true, row });
  }

  if (mode === 'activity') {
    const candidate = body?.lead || body?.contact || body || {};
    const externalId = clean(candidate.externalId || candidate.id || candidate.contactId || candidate.contact_id);
    const email = clean(candidate.email).toLowerCase();
    const phone = normalizePhone(candidate.phone || candidate.phoneNumber || candidate.phone_number);
    const name = normalizeName(candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`);
    const eventType = clean(body?.event || candidate?.event || '').toLowerCase();

    const idx = store.findIndex((r) => {
      if (externalId && r.externalId && clean(r.externalId) === externalId) return true;
      if (email && clean(r.email).toLowerCase() === email) return true;
      if (phone && normalizePhone(r.phone) === phone) return true;
      if (name && normalizeName(r.name) === name) return true;
      return false;
    });

    let targetIdx = idx;
    if (targetIdx < 0) {
      const inferredOwner =
        clean(body?.owner || '') ||
        clean(candidate?.owner || '') ||
        clean(candidate?.assignedToName || candidate?.assigned_to_name || '') ||
        clean(candidate?.assignedTo || candidate?.assigned_to || '');

      const seeded = parseLeadPayload({
        ...candidate,
        source: clean(candidate.source || body.source || 'Activity Webhook') || 'Activity Webhook',
        assignedTo: inferredOwner,
        assignedToName: inferredOwner
      });
      store.push(seeded);
      targetIdx = store.length - 1;
    }

    const now = nowIso();
    const patch = { updatedAt: now };
    const actor = clean(body?.actor || 'System Activity');

    const durationSec = Number(body?.callDurationSec || body?.duration || candidate?.callDurationSec || candidate?.duration || 0) || 0;
    const recordingUrl = clean(body?.recordingUrl || body?.recording_url || candidate?.recordingUrl || candidate?.recording_url || '');

    if (eventType.includes('called') || eventType === 'call') patch.calledAt = store[targetIdx].calledAt || now;
    if (eventType.includes('connect')) patch.connectedAt = store[targetIdx].connectedAt || now;
    if (eventType.includes('qualif')) patch.qualifiedAt = store[targetIdx].qualifiedAt || now;
    if (eventType.includes('form_sent') || eventType.includes('invite')) patch.formSentAt = store[targetIdx].formSentAt || now;
    if (eventType.includes('form_completed') || eventType.includes('submitted')) patch.formCompletedAt = store[targetIdx].formCompletedAt || now;

    if (durationSec > 0) patch.lastCallDurationSec = durationSec;
    if (recordingUrl) patch.lastCallRecordingUrl = recordingUrl;

    if (body?.stage) {
      Object.assign(patch, withStageAudit(store[targetIdx]?.stage, clean(body.stage), actor));
    }
    if (body?.owner) patch.owner = normalizeOwner(body.owner);

    store[targetIdx] = { ...store[targetIdx], ...patch };
    await writeStore(store);
    return Response.json({ ok: true, row: store[targetIdx], upsert: idx < 0 ? 'activity_seeded' : 'activity' });
  }

  if (!validateToken(req, body)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const incoming = parseLeadPayload(body);
  const idx = store.findIndex((r) => r.externalId && r.externalId === incoming.externalId);
  if (idx >= 0) {
    store[idx] = {
      ...store[idx],
      ...incoming,
      owner: isUnknownOwner(incoming.owner) ? store[idx].owner : incoming.owner,
      stage: store[idx].stage || 'New',
      id: store[idx].id,
      createdAt: store[idx].createdAt,
      updatedAt: nowIso()
    };
    await writeStore(store);
    return Response.json({ ok: true, row: store[idx], upsert: 'updated' });
  }

  const inserted = {
    ...incoming,
    stage: clean(incoming.stage || 'New') || 'New',
    stageUpdatedAt: incoming.stageUpdatedAt || nowIso(),
    stageUpdatedBy: incoming.stageUpdatedBy || 'System Intake'
  };

  store.push(inserted);
  await writeStore(store);
  return Response.json({ ok: true, row: inserted, upsert: 'inserted' });
}

export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  const id = clean(body?.id);
  if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const store = await getStore();
  const idx = store.findIndex((r) => r.id === id);
  if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  const patch = { ...(body?.patch || {}) };
  const actor = clean(body?.actor || 'Manual Update') || 'Manual Update';

  // Safety rail: logging a call result (no answer/voicemail/DND/etc.) should never auto-jump stages.
  if (isCallResultValue(patch.callResult)) {
    const currentStage = clean(store[idx]?.stage || 'New') || 'New';
    const requestedStage = clean(patch.stage);
    if (requestedStage && requestedStage !== 'Called' && requestedStage !== currentStage) {
      patch.stage = currentStage;
    }
  }

  const currentStage = clean(store[idx]?.stage || 'New') || 'New';
  const requestedStage = clean(patch.stage || currentStage) || currentStage;
  const stageAudit = withStageAudit(currentStage, requestedStage, actor);

  store[idx] = {
    ...store[idx],
    ...patch,
    ...stageAudit,
    updatedAt: nowIso()
  };
  await writeStore(store);
  return Response.json({ ok: true, row: store[idx] });
}

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const id = clean(searchParams.get('id'));
  if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const store = await getStore();
  const idx = store.findIndex((r) => r.id === id);
  if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  const [removed] = store.splice(idx, 1);
  await writeStore(store);
  return Response.json({ ok: true, removed });
}
