import { loadJsonStore, saveJsonStore, loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

const FB_LEADS_PATH = 'stores/fb-leads.json';
const FB_LEADS_SETTINGS_PATH = 'stores/fb-leads-settings.json';
const GHL_SYNC_STATE_PATH = 'stores/ghl-sync-state.json';

const GHL_BASE = 'https://rest.gohighlevel.com';
const GHL_API_VERSION = '2021-07-28';

const DEFAULT_SETTINGS = {
  autoDistribute: false,
  autoDistributeMode: 'balanced',
  autoDistributeAgents: ['Leticia Wright', 'Andrea Cannon']
};

const DEFAULT_SYNC_STATE = {
  lastSyncAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago on first run
  lastContactId: null
};

function getGhlHeaders() {
  const token = process.env.GHL_API_TOKEN || '';
  return {
    Authorization: `Bearer ${token}`,
    Version: GHL_API_VERSION,
    'Content-Type': 'application/json'
  };
}

function buildLeadFromContact(contact) {
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : '';
  const capName = (n) => n.split(' ').map(cap).join(' ').trim();
  const firstName = capName(String(contact.firstName || '').trim());
  const lastName = capName(String(contact.lastName || '').trim());
  const contactName = capName(String(contact.contactName || contact.name || '').trim());
  const fullName = contactName || [firstName, lastName].filter(Boolean).join(' ') || '';

  return {
    id: contact.id,
    ghlContactId: contact.id,
    created_time: contact.dateAdded || new Date().toISOString(),
    full_name: fullName,
    email: String(contact.email || '').trim(),
    phone_number: String(contact.phone || '').trim(),
    state: String(contact.state || '').trim(),
    platform: 'ghl',
    ad_name: '',
    form_name: '',
    importedAt: new Date().toISOString(),
    distributedTo: '',
    distributedAt: '',
    status: 'untouched'
  };
}

function pickBalancedAgent(agentNames, allLeads) {
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

  return agentNames.reduce((best, agent) =>
    (todayCounts[agent] || 0) < (todayCounts[best] || 0) ? agent : best
  );
}

async function runSync() {
  const ghlToken = process.env.GHL_API_TOKEN || '';
  const locationId = process.env.GHL_LOCATION_ID || 'I7bXOorPHk415nKgsFfa';

  if (!ghlToken) {
    return { ok: false, error: 'GHL_API_TOKEN not set', found: 0, added: 0, tagged: 0 };
  }

  // 1. Load last sync state
  const syncState = await loadJsonFile(GHL_SYNC_STATE_PATH, DEFAULT_SYNC_STATE);
  const lastSyncAt = syncState?.lastSyncAt || DEFAULT_SYNC_STATE.lastSyncAt;
  const lastSyncTime = new Date(lastSyncAt).getTime();

  // 2. Fetch contacts from GHL
  const url = `${GHL_BASE}/v1/contacts/?locationId=${locationId}&limit=100&order=desc`;
  let contacts = [];

  try {
    const res = await fetch(url, {
      headers: getGhlHeaders(),
      cache: 'no-store'
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[ghl-lead-sync] GHL API error:', res.status, errText);
      return { ok: false, error: `GHL API returned ${res.status}`, found: 0, added: 0, tagged: 0 };
    }

    const data = await res.json().catch(() => ({}));
    contacts = Array.isArray(data?.contacts) ? data.contacts : [];
  } catch (err) {
    console.error('[ghl-lead-sync] Fetch error:', err);
    return { ok: false, error: String(err?.message || 'fetch_failed'), found: 0, added: 0, tagged: 0 };
  }

  // 3. Filter to new contacts since last sync that don't have the "legacy" tag
  const newContacts = contacts.filter((c) => {
    const dateAdded = c.dateAdded ? new Date(c.dateAdded).getTime() : 0;
    if (dateAdded <= lastSyncTime) return false;
    const tags = Array.isArray(c.tags) ? c.tags.map((t) => String(t).toLowerCase()) : [];
    if (tags.includes('legacy')) return false;
    return true;
  });

  // 4. Load existing leads for deduplication
  const existingLeads = await loadJsonStore(FB_LEADS_PATH, []);
  const existingIds = new Set(existingLeads.map((l) => String(l.id || '')));

  // 5. Load settings for auto-distribute
  const settings = await loadJsonFile(FB_LEADS_SETTINGS_PATH, DEFAULT_SETTINGS);
  const autoDistribute = settings?.autoDistribute === true;
  const agentList = Array.isArray(settings?.autoDistributeAgents) && settings.autoDistributeAgents.length > 0
    ? settings.autoDistributeAgents
    : DEFAULT_SETTINGS.autoDistributeAgents;

  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || 'https://innercirclelink.com').replace(/\/$/, '');

  let added = 0;
  let tagged = 0;
  let mergedLeads = [...existingLeads];

  for (const contact of newContacts) {
    if (!contact.id) continue;

    // Skip duplicates
    if (existingIds.has(String(contact.id))) continue;

    const newLead = buildLeadFromContact(contact);

    // a. Add to leads array
    mergedLeads = [...mergedLeads, newLead];
    existingIds.add(String(contact.id));
    added++;

    // b. Tag contact in GHL with "legacy"
    try {
      const existingTags = Array.isArray(contact.tags) ? contact.tags : [];
      const updatedTags = existingTags.includes('legacy') ? existingTags : [...existingTags, 'legacy'];

      const tagRes = await fetch(`${GHL_BASE}/v1/contacts/${contact.id}`, {
        method: 'PUT',
        headers: getGhlHeaders(),
        body: JSON.stringify({ tags: updatedTags })
      });

      if (tagRes.ok) tagged++;
    } catch (err) {
      console.warn('[ghl-lead-sync] Failed to tag contact', contact.id, err?.message);
    }

    // c. Auto-distribute if enabled
    if (autoDistribute && agentList.length > 0) {
      try {
        const pickedAgent = pickBalancedAgent(agentList, mergedLeads);
        const now = new Date().toISOString();

        const routerRes = await fetch(`${appUrl}/api/lead-router`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-source': 'ghl-sync'
          },
          body: JSON.stringify({
            mode: 'manual-assign',
            name: newLead.full_name,
            email: newLead.email,
            phone: newLead.phone_number,
            externalId: contact.id,
            assignTo: pickedAgent,
            source: 'ghl-sync-auto'
          }),
          cache: 'no-store'
        }).catch(() => null);

        // Mark as distributed in merged leads
        mergedLeads = mergedLeads.map((l) =>
          l.id === contact.id
            ? { ...l, distributedTo: pickedAgent, distributedAt: now }
            : l
        );

        await routerRes?.json().catch(() => ({}));
      } catch (err) {
        console.warn('[ghl-lead-sync] Auto-distribute failed for', contact.id, err?.message);
      }
    }
  }

  // 6. Save updated leads
  if (added > 0) {
    await saveJsonStore(FB_LEADS_PATH, mergedLeads);
  }

  // 7. Update sync state
  await saveJsonFile(GHL_SYNC_STATE_PATH, {
    lastSyncAt: new Date().toISOString(),
    lastContactId: contacts.length > 0 ? contacts[0]?.id || null : syncState.lastContactId || null
  });

  return {
    ok: true,
    found: newContacts.length,
    added,
    tagged,
    checkedSince: lastSyncAt
  };
}

export async function GET() {
  try {
    const result = await runSync();
    return Response.json(result);
  } catch (err) {
    console.error('[ghl-lead-sync] Unhandled error:', err);
    return Response.json(
      { ok: false, error: String(err?.message || 'sync_failed'), found: 0, added: 0, tagged: 0 },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
