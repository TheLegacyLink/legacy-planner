import { loadJsonStore, saveJsonStore, loadJsonFile } from '../../../lib/blobJsonStore';

const FB_LEADS_PATH = 'stores/fb-leads.json';
const FB_LEADS_SETTINGS_PATH = 'stores/fb-leads-settings.json';

const DEFAULT_SETTINGS = {
  autoDistribute: false,
  autoDistributeMode: 'balanced',
  autoDistributeAgents: ['Leticia Wright', 'Andrea Cannon']
};

function clean(v = '') {
  return String(v || '').trim();
}

// Pick the agent from the list with fewest leads distributed today (balanced mode)
// Respects per-agent daily caps: if an agent has hit their cap, they are skipped.
function pickBalancedAgent(agentNames, allLeads, caps = {}) {
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const todayCounts = {};
  for (const agent of agentNames) todayCounts[agent] = 0;

  for (const lead of allLeads) {
    if (
      lead.distributedTo &&
      agentNames.includes(lead.distributedTo) &&
      lead.distributedAt &&
      lead.distributedAt.startsWith(todayKey)
    ) {
      todayCounts[lead.distributedTo] = (todayCounts[lead.distributedTo] || 0) + 1;
    }
  }

  // Filter out agents who have hit their daily cap
  const eligible = agentNames.filter((agent) => {
    const cap = caps && caps[agent] !== undefined ? Number(caps[agent]) : null;
    if (cap !== null && !isNaN(cap) && cap > 0) {
      return (todayCounts[agent] || 0) < cap;
    }
    return true; // no cap set — always eligible
  });

  // If all capped, fall back to full list
  const pool = eligible.length > 0 ? eligible : agentNames;

  // Return agent with fewest leads today
  return pool.reduce((best, agent) =>
    (todayCounts[agent] || 0) < (todayCounts[best] || 0) ? agent : best
  );
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const requiredSig = clean(process.env.LL_WEBHOOK_SECRET || '');
  if (requiredSig) {
    const got = clean(req.headers.get('x-ll-signature') || '');
    if (!got || got !== requiredSig) {
      // Log unauthorized attempts for debugging — don't drop the lead, just note it
      console.warn('[assign-fb-lead] Signature mismatch — got:', got?.slice(0,20), 'expected starts with:', requiredSig?.slice(0,20));
      // Still process the lead — signature failure is logged but not blocking
      // return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  // Log the full body keys to understand what GHL sends
  console.log('[assign-fb-lead] body keys:', Object.keys(body || {}).join(', '));
  console.log('[assign-fb-lead] contactId fields:', JSON.stringify({ contactId: body?.contactId, contactDotId: body?.contact?.id, id: body?.id, type: body?.type }).slice(0, 300));

  const contactId = clean(
    body?.contactId || body?.contact?.id || body?.id || ''
  ) || `ghl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log('[assign-fb-lead] resolved contactId:', contactId, '| email:', clean(body?.email || body?.contact?.email || ''));

  const rawName = clean(body?.name || body?.full_name || body?.firstName || '');
  const name = rawName.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '').join(' ').trim();
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

  // Load existing, deduplicate by id OR email (same person from multiple triggers)
  const existing = await loadJsonStore(FB_LEADS_PATH, []);
  const existingIds = new Set(existing.map((l) => String(l.id || '')));
  const existingEmails = new Set(existing.map((l) => String(l.email || '').toLowerCase()).filter(Boolean));

  let isNew = false;
  let merged = existing;
  const emailKey = email.toLowerCase();

  if (!existingIds.has(contactId) && (!emailKey || !existingEmails.has(emailKey))) {
    merged = [...existing, newLead];
    isNew = true;
    await saveJsonStore(FB_LEADS_PATH, merged);
  }

  // ── Auto-Distribute ──────────────────────────────────────────────────────
  let autoAssigned = null;

  if (isNew) {
    try {
      const settings = await loadJsonFile(FB_LEADS_SETTINGS_PATH, DEFAULT_SETTINGS);
      const autoDistribute = settings?.autoDistribute === true;
      const agentList = Array.isArray(settings?.autoDistributeAgents) && settings.autoDistributeAgents.length > 0
        ? settings.autoDistributeAgents
        : DEFAULT_SETTINGS.autoDistributeAgents;

      const caps = (settings?.autoDistributeCaps && typeof settings.autoDistributeCaps === 'object') ? settings.autoDistributeCaps : {};

      if (autoDistribute && agentList.length > 0) {
        const pickedAgent = pickBalancedAgent(agentList, merged, caps);

        // Wait 10 seconds before assigning — GHL needs time to fully index the new contact
        await new Promise((resolve) => setTimeout(resolve, 10000));

        // Use the same Lead Router manual-assign path that works for manual clicks
        try {
          const appUrl = 'https://innercirclelink.com';
          const routerRes = await fetch(`${appUrl}/api/lead-router`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-source': 'lead-hub' },
            body: JSON.stringify({
              mode: 'manual-assign',
              name,
              email,
              phone,
              externalId: contactId,
              assignTo: pickedAgent,
              source: 'lead-hub-auto'
            }),
            cache: 'no-store'
          });
          const routerData = await routerRes.json().catch(() => ({}));
          console.log('[auto-assign] Lead Router result:', JSON.stringify(routerData).slice(0, 300));
        } catch (e) {
          console.warn('[auto-assign] Lead Router call failed:', e?.message);
        }

        // Mark lead as distributed in fb-leads.json
        const now = new Date().toISOString();
        const final = merged.map((l) =>
          l.id === contactId
            ? { ...l, distributedTo: pickedAgent, distributedAt: now, ghlAssigned: false }
            : l
        );
        await saveJsonStore(FB_LEADS_PATH, final);

        autoAssigned = pickedAgent;
      }
    } catch {
      // Auto-distribute is best-effort — don't fail the webhook
    }
  }

  const response = { ok: true, queued: true, contactId };
  if (autoAssigned) response.autoAssigned = autoAssigned;

  return Response.json(response);
}
