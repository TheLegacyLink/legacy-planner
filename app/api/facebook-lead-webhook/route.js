import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const FB_LEADS_PATH = 'stores/fb-leads.json';

// Field name variants Facebook may return
function extractField(fieldData = [], ...names) {
  for (const name of names) {
    const entry = fieldData.find((f) => String(f?.name || '').toLowerCase() === name.toLowerCase());
    if (entry) {
      const val = Array.isArray(entry.values) ? entry.values[0] : entry.values;
      if (val != null && val !== '') return String(val).trim();
    }
  }
  return '';
}

// ─── GET: Facebook webhook verification ─────────────────────────────────────
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = String(process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || '').trim();

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return new Response('Verification failed', { status: 403 });
}

// ─── POST: Receive Facebook lead gen events ──────────────────────────────────
export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || body.object !== 'page') {
      return Response.json({ ok: true }); // Ack non-lead events silently
    }

    const accessToken = String(process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '').trim();
    const newLeads = [];

    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change.field !== 'leadgen') continue;
        const value = change.value || {};
        const leadgenId = String(value.leadgen_id || '').trim();
        if (!leadgenId) continue;

        // Fetch full lead data from Facebook Graph API
        let fbLead = null;
        if (accessToken) {
          try {
            const graphRes = await fetch(
              `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${encodeURIComponent(accessToken)}`,
              { method: 'GET' }
            );
            if (graphRes.ok) {
              fbLead = await graphRes.json();
            }
          } catch {
            // Graph API fetch failed — use what we have from the event
          }
        }

        const fieldData = Array.isArray(fbLead?.field_data) ? fbLead.field_data : [];

        // Map Facebook field variants to our schema
        const fullName = extractField(fieldData, 'full_name', 'name', 'first_name');
        const email = extractField(fieldData, 'email');
        const phone = extractField(fieldData, 'phone_number', 'phone', 'mobile_number');
        const state = extractField(fieldData, 'state', 'what_state_do_you_live_in', 'state_of_residence');

        const createdTimestamp = Number(value.created_time || fbLead?.created_time || 0);
        const createdIso = createdTimestamp
          ? new Date(createdTimestamp * 1000).toISOString()
          : new Date().toISOString();

        // Check if Facebook/GHL sent a contact_id directly (store as ghlContactId)
        const fbGhlContactId = String(value.contact_id || fbLead?.contact_id || '').trim();

        newLeads.push({
          id: leadgenId,
          full_name: fullName || '',
          email: email || '',
          phone_number: phone || '',
          state: state || '',
          platform: 'fb',
          ad_id: String(value.ad_id || fbLead?.ad_id || ''),
          ad_name: String(fbLead?.ad_name || ''),
          form_id: String(value.form_id || fbLead?.form_id || ''),
          page_id: String(value.page_id || fbLead?.page_id || ''),
          adset_id: String(fbLead?.adset_id || ''),
          adset_name: String(fbLead?.adset_name || ''),
          campaign_id: String(fbLead?.campaign_id || ''),
          campaign_name: String(fbLead?.campaign_name || ''),
          created_time: createdIso,
          importedAt: new Date().toISOString(),
          source: 'facebook_webhook',
          ghlContactId: fbGhlContactId || ''
        });
      }
    }

    if (!newLeads.length) {
      return Response.json({ ok: true });
    }

    // Load existing leads and deduplicate by id
    const existing = await loadJsonStore(FB_LEADS_PATH, []);
    const existingIds = new Set(existing.map((l) => String(l.id || '')));

    const toAdd = newLeads.filter((l) => l.id && !existingIds.has(l.id));

    // Eagerly look up GHL contact IDs for new leads that don't have one yet
    const ghlToken = String(process.env.GHL_API_TOKEN || '').trim();
    if (ghlToken && toAdd.length) {
      const ghlHeaders = {
        Authorization: `Bearer ${ghlToken}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28'
      };
      const ghlBases = [
        String(process.env.GHL_API_BASE_URL || '').replace(/\/$/, ''),
        'https://services.leadconnectorhq.com',
        'https://rest.gohighlevel.com'
      ].filter(Boolean);

      const ghlSearch = async (query) => {
        for (const base of ghlBases) {
          for (const prefix of ['/contacts', '/v1/contacts']) {
            try {
              const res = await fetch(`${base}${prefix}${query}`, { method: 'GET', headers: ghlHeaders, cache: 'no-store' });
              if (res.ok) {
                const data = await res.json().catch(() => ({}));
                const id = String(data?.contacts?.[0]?.id || '').trim();
                if (id) return id;
              }
            } catch { /* try next */ }
          }
        }
        return '';
      };

      await Promise.allSettled(toAdd.map(async (lead) => {
        if (lead.ghlContactId) return; // already have it
        const email = String(lead.email || '').trim();
        const phone = String(lead.phone_number || '').replace(/\D/g, '').slice(-10);
        let ghlContactId = '';
        if (email) ghlContactId = await ghlSearch(`/?email=${encodeURIComponent(email)}`);
        if (!ghlContactId && phone) ghlContactId = await ghlSearch(`/?phone=${encodeURIComponent(phone)}`);
        if (ghlContactId) lead.ghlContactId = ghlContactId;
      }));
    }

    if (toAdd.length) {
      const merged = [...existing, ...toAdd];
      await saveJsonStore(FB_LEADS_PATH, merged);
    }

    return Response.json({ ok: true, received: newLeads.length, added: toAdd.length });
  } catch (err) {
    // Always return 200 to Facebook even on errors (prevents retry storms)
    console.error('[facebook-lead-webhook] error:', err?.message || err);
    return Response.json({ ok: true });
  }
}
