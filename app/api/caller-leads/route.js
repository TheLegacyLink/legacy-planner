import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/caller-leads.json';

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
  return clean(v);
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

  const assignedTo =
    normalizeOwner(
      candidate.assignedToName ||
        candidate.assigned_to_name ||
        candidate.assignedTo ||
        candidate.assigned_to ||
        body.assignedToName ||
        body.assigned_to_name
    ) || 'Unknown';

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
    stage: clean(candidate.stage || 'New') || 'New',
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
      const seeded = parseLeadPayload({
        ...candidate,
        source: clean(candidate.source || body.source || 'Activity Webhook') || 'Activity Webhook',
        assignedTo: clean(body?.owner || candidate?.owner || ''),
        assignedToName: clean(body?.owner || candidate?.owner || '')
      });
      store.push(seeded);
      targetIdx = store.length - 1;
    }

    const now = nowIso();
    const patch = { updatedAt: now };

    if (eventType.includes('called') || eventType === 'call') patch.calledAt = store[targetIdx].calledAt || now;
    if (eventType.includes('connect')) patch.connectedAt = store[targetIdx].connectedAt || now;
    if (eventType.includes('qualif')) patch.qualifiedAt = store[targetIdx].qualifiedAt || now;
    if (eventType.includes('form_sent') || eventType.includes('invite')) patch.formSentAt = store[targetIdx].formSentAt || now;
    if (eventType.includes('form_completed') || eventType.includes('submitted')) patch.formCompletedAt = store[targetIdx].formCompletedAt || now;

    if (body?.stage) patch.stage = clean(body.stage);
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
      id: store[idx].id,
      createdAt: store[idx].createdAt,
      updatedAt: nowIso()
    };
    await writeStore(store);
    return Response.json({ ok: true, row: store[idx], upsert: 'updated' });
  }

  store.push(incoming);
  await writeStore(store);
  return Response.json({ ok: true, row: incoming, upsert: 'inserted' });
}

export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  const id = clean(body?.id);
  if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const store = await getStore();
  const idx = store.findIndex((r) => r.id === id);
  if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  store[idx] = { ...store[idx], ...(body?.patch || {}), updatedAt: nowIso() };
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
