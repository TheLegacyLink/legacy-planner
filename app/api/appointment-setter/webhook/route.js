import { loadJsonFile, saveJsonFile } from '../../../../lib/blobJsonStore';

const STORE_PATH = 'stores/appointment-setter-backoffice.json';

function clean(v = '') { return String(v || '').trim(); }

function stateCodeFromAny(v = '') {
  const raw = clean(v).toUpperCase();
  if (!raw) return '';
  if (raw.length === 2) return raw;
  const map = {
    CALIFORNIA: 'CA', TEXAS: 'TX', GEORGIA: 'GA', FLORIDA: 'FL', NEWJERSEY: 'NJ', 'NEW JERSEY': 'NJ', NEWYORK: 'NY', 'NEW YORK': 'NY'
  };
  return map[raw] || raw.slice(0, 2);
}

function id(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePhone(v = '') {
  return clean(v).replace(/\D/g, '');
}

function pushTimeline(lead = {}, event = '') {
  const row = { id: id('tl'), at: new Date().toISOString(), event: clean(event) };
  const history = Array.isArray(lead?.timeline) ? lead.timeline : [];
  return [row, ...history].slice(0, 80);
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const expected = clean(process.env.APPOINTMENT_SETTER_WEBHOOK_SECRET);
  const incoming = clean(req.headers.get('x-webhook-secret') || body?.secret || '');
  if (expected && incoming !== expected) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const store = await loadJsonFile(STORE_PATH, null);
  if (!store || typeof store !== 'object') {
    return Response.json({ ok: false, error: 'store_not_ready' }, { status: 500 });
  }

  const leads = Array.isArray(store?.leads) ? [...store.leads] : [];

  const fullName = clean(body?.fullName || body?.name || `${clean(body?.firstName)} ${clean(body?.lastName)}`.trim() || 'Unknown Lead');
  const phone = clean(body?.phone || body?.phoneNumber);
  const email = clean(body?.email);
  const state = stateCodeFromAny(body?.state || body?.region || '');
  const campaignSource = clean(body?.campaignSource || body?.source || 'Webhook');
  const productType = clean(body?.productType || body?.campaign || 'General');

  const phoneDigits = normalizePhone(phone);
  const emailKey = clean(email).toLowerCase();
  const existing = leads.find((l) => {
    const samePhone = phoneDigits && normalizePhone(l?.phone) === phoneDigits;
    const sameEmail = emailKey && clean(l?.email).toLowerCase() === emailKey;
    return samePhone || sameEmail;
  });

  if (existing) {
    const idx = leads.findIndex((l) => clean(l.id) === clean(existing.id));
    leads[idx] = {
      ...existing,
      campaignSource: clean(existing?.campaignSource || campaignSource),
      productType: clean(existing?.productType || productType),
      updatedAt: new Date().toISOString(),
      timeline: pushTimeline(existing, 'Duplicate webhook event received')
    };
    await saveJsonFile(STORE_PATH, { ...store, leads });
    return Response.json({ ok: true, duplicate: true, leadId: existing.id });
  }

  const lead = {
    id: id('lead'),
    fullName,
    phone,
    email,
    state,
    campaignSource,
    productType,
    createdAt: new Date().toISOString(),
    status: 'New',
    priority: 'Urgent',
    attempts: [],
    voicemailLeft: false,
    notes: [],
    assignedSetter: '',
    appointment: null,
    assignedAgentId: '',
    assignmentLog: [],
    followUpAt: '',
    timeline: [{ id: id('tl'), at: new Date().toISOString(), event: 'Lead ingested from webhook' }]
  };

  leads.unshift(lead);
  await saveJsonFile(STORE_PATH, { ...store, leads });

  return Response.json({ ok: true, leadId: lead.id });
}
