import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const FB_LEADS_PATH = 'stores/fb-leads.json';

function clean(v = '') {
  return String(v || '').trim();
}

function safeJsonParse(raw, fallback = {}) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const requiredSig = clean(process.env.LL_WEBHOOK_SECRET || '');
  if (requiredSig) {
    const got = clean(req.headers.get('x-ll-signature') || '');
    if (!got || got !== requiredSig) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  const contactId = clean(
    body?.contactId || body?.contact?.id || body?.id || ''
  ) || `ghl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const name = clean(body?.name || body?.full_name || body?.firstName || '');
  const email = clean(body?.email || body?.contact?.email || '');
  const phone = clean(body?.phone || body?.phone_number || body?.contact?.phone || '');
  const state = clean(body?.state || body?.contact?.state || body?.customFields?.state || '');

  const newLead = {
    id: contactId,
    ghlContactId: contactId,
    created_time: new Date().toISOString(),
    full_name: name,
    email,
    phone_number: phone,
    state: state || '',
    platform: 'ghl',
    ad_name: clean(body?.adName || body?.ad_name || ''),
    form_name: clean(body?.formName || body?.form_name || ''),
    importedAt: new Date().toISOString(),
    distributedTo: '',
    distributedAt: ''
  };

  // Load existing, deduplicate by id (GHL contact ID)
  const existing = await loadJsonStore(FB_LEADS_PATH, []);
  const existingIds = new Set(existing.map((l) => String(l.id || '')));

  if (!existingIds.has(contactId)) {
    const merged = [...existing, newLead];
    await saveJsonStore(FB_LEADS_PATH, merged);
  }

  return Response.json({ ok: true, queued: true, contactId });
}
