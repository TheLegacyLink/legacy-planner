import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

const EVENTS_PATH = 'stores/lead-router-events.json';
const CALLER_PATH = 'stores/caller-leads.json';
const SETTINGS_PATH = 'stores/lead-router-settings.json';

function clean(v = '') { return String(v || '').trim(); }

function cstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

// Fetch contacts created today from GHL
async function fetchGhlContactsToday() {
  const token = clean(process.env.GHL_API_TOKEN || '');
  if (!token) return { ok: false, error: 'GHL_API_TOKEN not set' };

  const locationId = clean(process.env.GHL_LOCATION_ID || '');

  // Get start of today in UTC
  const now = new Date();
  const todayCST = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  todayCST.setHours(0, 0, 0, 0);
  const startOfDay = new Date(now.getTime() - (now - todayCST));

  const startTimestamp = startOfDay.getTime();

  const bases = [
    clean(process.env.GHL_API_BASE_URL || ''),
    'https://services.leadconnectorhq.com',
    'https://rest.gohighlevel.com'
  ].filter(Boolean);

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28'
  };

  let contacts = [];
  let lastError = '';

  for (const base of bases) {
    try {
      // Try v2 search endpoint
      const searchUrl = `${base.replace(/\/$/, '')}/contacts/?startAfter=${startTimestamp}&startAfterId=&limit=100`;
      const res = await fetch(searchUrl, { headers, cache: 'no-store' });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const raw = data?.contacts || data?.data || [];
        contacts = raw.filter((c) => {
          const created = new Date(c?.dateAdded || c?.createdAt || c?.date_added || 0).getTime();
          return created >= startTimestamp;
        });
        return { ok: true, contacts, source: base };
      }

      lastError = `${base} → ${res.status}`;
    } catch (e) {
      lastError = String(e?.message || e);
    }
  }

  return { ok: false, error: lastError, contacts: [] };
}

export async function GET(req) {

  const ghlResult = await fetchGhlContactsToday();
  if (!ghlResult.ok) {
    return Response.json({ ok: false, error: ghlResult.error });
  }

  return Response.json({
    ok: true,
    found: ghlResult.contacts.length,
    contacts: ghlResult.contacts.map((c) => ({
      id: c.id || c.contactId,
      name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name || 'Unknown',
      email: c.email || '',
      phone: c.phone || c.phoneNumber || '',
      source: c.source || c.attributionSource?.medium || '',
      createdAt: c.dateAdded || c.createdAt || '',
    }))
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  // Fetch today's contacts from GHL
  const ghlResult = await fetchGhlContactsToday();
  if (!ghlResult.ok) {
    return Response.json({ ok: false, error: `GHL fetch failed: ${ghlResult.error}` });
  }

  const contacts = ghlResult.contacts;
  if (!contacts.length) {
    return Response.json({ ok: true, message: 'No new contacts found today in GHL', pushed: 0 });
  }

  // Load existing leads to check for duplicates
  const existingLeads = await loadJsonStore(CALLER_PATH, []);
  const existingExternalIds = new Set(existingLeads.map((r) => clean(r?.externalId || '')).filter(Boolean));

  const newContacts = contacts.filter((c) => {
    const id = clean(c.id || c.contactId || '');
    return id && !existingExternalIds.has(id);
  });

  if (!newContacts.length) {
    return Response.json({ ok: true, message: 'All contacts already in router', pushed: 0, skipped: contacts.length });
  }

  // Push each new contact through the lead router
  const intakeToken = clean(process.env.GHL_INTAKE_TOKEN || '');
  const baseUrl = `https://${req.headers.get('host') || 'innercirclelink.com'}`;
  const results = [];

  for (const contact of newContacts) {
    try {
      const payload = {
        token: intakeToken,
        id: contact.id || contact.contactId,
        firstName: (contact.name || '').split(' ')[0] || '',
        lastName: (contact.name || '').split(' ').slice(1).join(' ') || '',
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        source: contact.source || 'ghl-sync',
      };

      const res = await fetch(`${baseUrl}/api/lead-router`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-intake-token': intakeToken,
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });

      const data = await res.json().catch(() => ({}));
      results.push({
        name: contact.name,
        id: contact.id,
        ok: res.ok && data?.ok,
        assignedTo: data?.assignedTo || data?.owner || '',
        error: data?.error || '',
      });
    } catch (e) {
      results.push({ name: contact.name, id: contact.id, ok: false, error: String(e?.message || e) });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return Response.json({
    ok: true,
    found: contacts.length,
    skipped: contacts.length - newContacts.length,
    pushed: newContacts.length,
    distributed: succeeded,
    results,
  });
}
