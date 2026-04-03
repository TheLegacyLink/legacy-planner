import { loadJsonFile, saveJsonFile } from '../../../../lib/blobJsonStore';

const STORE_PATH = 'stores/appointment-setter-backoffice.json';

function clean(v = '') { return String(v || '').trim(); }

function stateCodeFromAny(v = '') {
  const raw = clean(v).toUpperCase();
  if (!raw) return '';
  if (raw.length === 2) return raw;
  const map = {
    ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA', COLORADO: 'CO',
    CONNECTICUT: 'CT', DELAWARE: 'DE', FLORIDA: 'FL', GEORGIA: 'GA', HAWAII: 'HI', IDAHO: 'ID',
    ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS', KENTUCKY: 'KY', LOUISIANA: 'LA',
    MAINE: 'ME', MARYLAND: 'MD', MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN', MISSISSIPPI: 'MS',
    MISSOURI: 'MO', MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
    'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', OHIO: 'OH',
    OKLAHOMA: 'OK', OREGON: 'OR', PENNSYLVANIA: 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT', VERMONT: 'VT', VIRGINIA: 'VA',
    WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV', WISCONSIN: 'WI', WYOMING: 'WY', 'DISTRICT OF COLUMBIA': 'DC'
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

function pick(...vals) {
  for (const v of vals) {
    const c = clean(v);
    if (c) return c;
  }
  return '';
}

function customFieldMap(body = {}) {
  const out = {};
  const arr = body?.customFields || body?.custom_fields || body?.contact?.customFields || body?.contact?.custom_fields || [];
  if (!Array.isArray(arr)) return out;

  for (const row of arr) {
    const key = clean(row?.key || row?.name || row?.field || row?.id).toLowerCase();
    const value = pick(row?.value, row?.field_value, row?.text, row?.stringValue, row?.numberValue);
    if (key && value) out[key] = value;
  }
  return out;
}

function parseIncoming(body = {}) {
  const c = body?.contact || {};
  const cf = customFieldMap(body);

  const firstName = pick(body?.firstName, body?.first_name, c?.firstName, c?.first_name, cf.firstname, cf.first_name);
  const lastName = pick(body?.lastName, body?.last_name, c?.lastName, c?.last_name, cf.lastname, cf.last_name);
  const fullName = pick(
    body?.fullName,
    body?.full_name,
    body?.name,
    c?.name,
    `${firstName} ${lastName}`.trim(),
    `${pick(c?.firstName, c?.first_name)} ${pick(c?.lastName, c?.last_name)}`.trim()
  ) || 'Unknown Lead';

  const phone = pick(body?.phone, body?.phoneNumber, body?.phone_number, c?.phone, c?.phoneNumber, cf.phone, cf.phone_number);
  const email = pick(body?.email, c?.email, cf.email);
  const state = stateCodeFromAny(pick(
    body?.state,
    body?.region,
    body?.stateCode,
    body?.state_code,
    c?.state,
    c?.region,
    c?.address1_state,
    c?.address?.state,
    cf.state,
    cf.state_code,
    cf.region
  ));

  const campaignSource = pick(
    body?.campaignSource,
    body?.campaign_source,
    body?.source,
    body?.trigger,
    body?.workflow,
    c?.source,
    cf.campaign,
    cf.campaign_source,
    cf.source,
    'GHL / Lead Connector'
  );

  const productType = pick(
    body?.productType,
    body?.product_type,
    body?.campaign,
    body?.funnel,
    cf.product,
    cf.product_type,
    cf.campaign,
    'General'
  );

  return {
    fullName,
    phone,
    email,
    state,
    campaignSource,
    productType,
    contactId: pick(body?.contactId, body?.contact_id, body?.id, c?.id, cf.contactid, cf.contact_id)
  };
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
  const parsed = parseIncoming(body);

  const phoneDigits = normalizePhone(parsed.phone);
  const emailKey = clean(parsed.email).toLowerCase();
  const existing = leads.find((l) => {
    const samePhone = phoneDigits && normalizePhone(l?.phone) === phoneDigits;
    const sameEmail = emailKey && clean(l?.email).toLowerCase() === emailKey;
    return samePhone || sameEmail;
  });

  if (existing) {
    const idx = leads.findIndex((l) => clean(l.id) === clean(existing.id));
    leads[idx] = {
      ...existing,
      contactId: clean(existing?.contactId || parsed.contactId),
      campaignSource: clean(existing?.campaignSource || parsed.campaignSource),
      productType: clean(existing?.productType || parsed.productType),
      updatedAt: new Date().toISOString(),
      timeline: pushTimeline(existing, 'Duplicate webhook event received')
    };
    await saveJsonFile(STORE_PATH, { ...store, leads });
    return Response.json({ ok: true, duplicate: true, leadId: existing.id });
  }

  const lead = {
    id: id('lead'),
    fullName: parsed.fullName,
    phone: parsed.phone,
    email: parsed.email,
    contactId: parsed.contactId,
    state: parsed.state,
    campaignSource: parsed.campaignSource,
    productType: parsed.productType,
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

  return Response.json({ ok: true, leadId: lead.id, normalized: parsed });
}
