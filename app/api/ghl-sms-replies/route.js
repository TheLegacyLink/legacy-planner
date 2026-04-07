import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const REPLIES_STORE_PATH = 'stores/ghl-sms-replies.json';
const CALLER_LEADS_STORE_PATH = 'stores/caller-leads.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalizePhone(v = '') {
  return String(v || '').replace(/\D/g, '');
}

function nowIso() {
  return new Date().toISOString();
}

function authorized(req, body = {}) {
  const required = clean(process.env.GHL_SMS_REPLY_TOKEN || process.env.GHL_INTAKE_TOKEN || '');
  if (!required) return true;

  const bearer = clean(req.headers.get('authorization')).replace(/^Bearer\s+/i, '');
  const header = clean(req.headers.get('x-ghl-reply-token') || req.headers.get('x-intake-token') || req.headers.get('x-ghl-token'));
  const bodyToken = clean(body?.token || body?.secret || body?.apiKey);
  const token = bearer || header || bodyToken;
  return Boolean(token && token === required);
}

function pickFirst(...vals) {
  for (const v of vals) {
    const c = clean(v);
    if (c) return c;
  }
  return '';
}

function parseInbound(body = {}) {
  const contact = body?.contact || {};
  const messageObj = body?.message || body?.conversation || {};

  const contactId = pickFirst(
    body?.contactId,
    body?.contact_id,
    contact?.id,
    contact?.contactId,
    body?.externalId
  );

  const firstName = pickFirst(body?.firstName, body?.first_name, contact?.firstName, contact?.first_name);
  const lastName = pickFirst(body?.lastName, body?.last_name, contact?.lastName, contact?.last_name);
  const name = pickFirst(body?.name, contact?.name, `${firstName} ${lastName}`);
  const email = pickFirst(body?.email, contact?.email);
  const phone = pickFirst(body?.phone, body?.from, contact?.phone, contact?.phoneNumber, contact?.phone_number);

  const directionRaw = pickFirst(
    body?.direction,
    body?.messageDirection,
    body?.message_direction,
    messageObj?.direction,
    messageObj?.messageDirection,
    messageObj?.message_direction,
    body?.type,
    body?.event
  ).toLowerCase();

  const inboundByDirection = directionRaw.includes('inbound') || directionRaw.includes('incoming') || directionRaw.includes('received');

  const eventRaw = pickFirst(body?.event, body?.type).toLowerCase();
  const inboundByEvent = eventRaw.includes('inbound') || eventRaw.includes('reply') || eventRaw.includes('sms_received') || eventRaw.includes('message_received');

  const text = pickFirst(
    body?.message,
    body?.text,
    body?.body,
    messageObj?.message,
    messageObj?.text,
    messageObj?.body,
    messageObj?.content
  );

  return {
    contactId,
    firstName,
    lastName,
    name,
    email,
    phone,
    phoneDigits: normalizePhone(phone),
    text,
    isInbound: Boolean(inboundByDirection || inboundByEvent),
    event: eventRaw || directionRaw || 'sms_reply'
  };
}

async function upsertCallerLeadInbound(parsed) {
  const store = await loadJsonStore(CALLER_LEADS_STORE_PATH, []);

  const idx = store.findIndex((r) => {
    if (parsed.contactId && clean(r.externalId) === parsed.contactId) return true;
    if (parsed.email && clean(r.email).toLowerCase() === parsed.email.toLowerCase()) return true;
    if (parsed.phoneDigits && normalizePhone(r.phone) === parsed.phoneDigits) return true;
    if (parsed.name && clean(r.name).toLowerCase() === parsed.name.toLowerCase()) return true;
    return false;
  });

  const now = nowIso();
  const base = {
    externalId: parsed.contactId,
    name: parsed.name || 'Unknown Lead',
    email: parsed.email,
    phone: parsed.phone,
    source: 'GHL SMS Reply',
    owner: 'Unknown',
    stage: 'New',
    createdAt: now,
    updatedAt: now
  };

  const patch = {
    respondedAt: now,
    lastResponseAt: now,
    lastInboundAt: now,
    lastInboundMessage: parsed.text,
    lastMessageDirection: 'inbound',
    lastContactDirection: 'inbound',
    unreadInbound: true,
    updatedAt: now
  };

  if (idx >= 0) {
    store[idx] = { ...store[idx], ...patch };
  } else {
    store.unshift({
      id: `ghl-reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      licensedStatus: 'Unknown',
      notes: '',
      callResult: '',
      callAttempts: 0,
      lastCallAttemptAt: '',
      callDirection: 'inbound',
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
      stageUpdatedAt: now,
      stageUpdatedBy: 'SMS Reply Webhook',
      ...base,
      ...patch
    });
  }

  await saveJsonStore(CALLER_LEADS_STORE_PATH, store);
}

export async function GET() {
  const rows = await loadJsonStore(REPLIES_STORE_PATH, []);
  const sorted = [...rows].sort((a, b) => new Date(b.receivedAt || 0).getTime() - new Date(a.receivedAt || 0).getTime());
  return Response.json({ ok: true, rows: sorted.slice(0, 500) });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (!authorized(req, body)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const parsed = parseInbound(body);
  if (!parsed.isInbound) {
    return Response.json({ ok: true, ignored: 'not_inbound' });
  }

  if (!parsed.text) {
    return Response.json({ ok: true, ignored: 'no_message_text' });
  }

  const receivedAt = nowIso();
  const row = {
    id: `smsr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    receivedAt,
    event: parsed.event,
    contactId: parsed.contactId,
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    phoneDigits: parsed.phoneDigits,
    text: parsed.text
  };

  const store = await loadJsonStore(REPLIES_STORE_PATH, []);
  store.unshift(row);
  await saveJsonStore(REPLIES_STORE_PATH, store.slice(0, 2000));

  await upsertCallerLeadInbound(parsed);

  return Response.json({ ok: true, row });
}
