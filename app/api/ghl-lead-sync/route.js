export const dynamic = 'force-dynamic';

import { loadJsonFile, saveJsonFile, loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const SYNC_STATE_PATH = 'stores/ghl-lead-sync-state.json';

function clean(v = '') { return String(v || '').trim(); }
function nowIso() { return new Date().toISOString(); }

// Try multiple GHL API endpoint formats to fetch recent contacts
async function fetchGhlContacts(sinceMs) {
  const token = clean(process.env.GHL_API_TOKEN || '');
  if (!token) return { ok: false, error: 'GHL_API_TOKEN not set', contacts: [] };

  const locationId = clean(process.env.GHL_LOCATION_ID || '');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  };

  const sinceIso = new Date(sinceMs).toISOString();
  const errors = [];

  // Attempt 1: GHL v2 API (services.leadconnectorhq.com)
  if (locationId) {
    try {
      const params = new URLSearchParams({
        locationId,
        limit: '100',
        startAfter: String(sinceMs),
      });
      const url = `https://services.leadconnectorhq.com/contacts/?${params}`;
      const res = await fetch(url, { headers, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const contacts = Array.isArray(data?.contacts) ? data.contacts : [];
        return { ok: true, contacts, source: 'v2' };
      }
      const text = await res.text().catch(() => '');
      errors.push(`v2: ${res.status} ${text.slice(0, 100)}`);
    } catch (e) {
      errors.push(`v2: ${e?.message || e}`);
    }
  }

  // Attempt 2: GHL v1 API (rest.gohighlevel.com) — pull latest 100, filter in code
  if (locationId) {
    try {
      const params = new URLSearchParams({ locationId, limit: '100', order: 'desc' });
      const url = `https://rest.gohighlevel.com/v1/contacts/?${params}`;
      const res = await fetch(url, { headers, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const all = Array.isArray(data?.contacts) ? data.contacts : [];
        // Filter to contacts created after sinceMs
        const contacts = all.filter((c) => {
          const t = new Date(c?.dateAdded || c?.createdAt || 0).getTime();
          return t > sinceMs;
        });
        return { ok: true, contacts, source: 'v1' };
      }
      const text = await res.text().catch(() => '');
      errors.push(`v1: ${res.status} ${text.slice(0, 100)}`);
    } catch (e) {
      errors.push(`v1: ${e?.message || e}`);
    }
  }

  // Attempt 3: v1 without locationId (some tokens are location-scoped)
  try {
    const params = new URLSearchParams({ limit: '100', order: 'desc' });
    if (locationId) params.set('locationId', locationId);
    const url = `https://rest.gohighlevel.com/v1/contacts/?${params}`;
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const all = Array.isArray(data?.contacts) ? data.contacts : [];
      const contacts = all.filter((c) => {
        const t = new Date(c?.dateAdded || c?.createdAt || 0).getTime();
        return t > sinceMs;
      });
      return { ok: true, contacts, source: 'v1-scoped' };
    }
    const text = await res.text().catch(() => '');
    errors.push(`v1-scoped: ${res.status} ${text.slice(0, 100)}`);
  } catch (e) {
    errors.push(`v1-scoped: ${e?.message || e}`);
  }

  return { ok: false, error: errors.join(' | '), contacts: [] };
}

async function runSync(host = 'innercirclelink.com') {
  const state = await loadJsonFile(SYNC_STATE_PATH, { lastSyncAt: null });
  const lastSyncAt = state?.lastSyncAt || null;

  // First run: go back 2 hours to catch any leads missed; otherwise use last sync time
  const sinceMs = lastSyncAt
    ? new Date(lastSyncAt).getTime()
    : Date.now() - 2 * 60 * 60 * 1000;

  // Always update lastSyncAt FIRST so parallel runs don't double-process
  const thisRunAt = nowIso();
  await saveJsonFile(SYNC_STATE_PATH, { lastSyncAt: thisRunAt, lastRunAt: thisRunAt });

  const ghlResult = await fetchGhlContacts(sinceMs);

  if (!ghlResult.ok) {
    // Restore last sync time so next run retries from same window
    await saveJsonFile(SYNC_STATE_PATH, { lastSyncAt, lastRunAt: thisRunAt, lastError: ghlResult.error });
    return { ok: false, error: ghlResult.error, found: 0, distributed: 0, skipped: 0 };
  }

  const contacts = ghlResult.contacts || [];

  // ——— Re-resolve pass ———
  // For any leads already stored as 'Unknown' / 'Unknown Lead', check if GHL now
  // has a real name (e.g. because the Facebook field mapping was delayed) and patch them.
  let reResolved = 0;
  try {
    const CALLER_PATH = 'stores/caller-leads.json';
    const storedLeads = await loadJsonStore(CALLER_PATH, []);
    let changed = false;
    for (const c of contacts) {
      const externalId = clean(c.id || '');
      if (!externalId) continue;
      const nameRaw = [clean(c.firstName || ''), clean(c.lastName || '')].filter(Boolean).join(' ')
        || clean(c.contactName || c.name || '');
      if (!nameRaw || nameRaw.toLowerCase() === 'unknown') continue; // GHL still has no name
      const idx = storedLeads.findIndex((r) => clean(r?.externalId || '') === externalId);
      if (idx < 0) continue;
      const stored = storedLeads[idx];
      const storedNameLower = clean(stored?.name || '').toLowerCase();
      if (storedNameLower && storedNameLower !== 'unknown' && storedNameLower !== 'unknown lead') continue;
      // GHL now has a real name — update the stored lead
      storedLeads[idx] = { ...stored, name: nameRaw, email: clean(c.email || '') || stored.email || '', phone: clean(c.phone || '') || stored.phone || '', updatedAt: nowIso() };
      changed = true;
      reResolved++;
    }
    if (changed) await saveJsonStore(CALLER_PATH, storedLeads);
  } catch { /* non-fatal */ }

  if (!contacts.length) {
    return { ok: true, found: 0, distributed: 0, skipped: 0, reResolved, source: ghlResult.source };
  }

  const intakeToken = clean(process.env.GHL_INTAKE_TOKEN || '');
  const baseUrl = `https://${host}`;
  const results = [];

  for (const c of contacts) {
    const externalId = clean(c.id || '');
    if (!externalId) continue;

    const email = clean(c.email || '');
    const phone = clean(c.phone || '');
    const nameRaw = [clean(c.firstName || ''), clean(c.lastName || '')].filter(Boolean).join(' ')
      || clean(c.contactName || c.name || '');
    // If GHL has no name, fall back to email prefix or phone so it never stores as 'Unknown'
    const name = nameRaw
      || (email.includes('@') ? email.split('@')[0] : '')
      || phone
      || 'Unknown';

    try {
      const res = await fetch(`${baseUrl}/api/lead-router`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-intake-token': intakeToken,
          'x-internal-source': 'ghl-lead-sync',
        },
        body: JSON.stringify({
          token: intakeToken,
          id: externalId,
          externalId,
          name,
          firstName: clean(c.firstName || ''),
          lastName: clean(c.lastName || ''),
          email,
          phone,
          source: clean(c.source || c.attributionSource?.medium || 'ghl-sync'),
        }),
        cache: 'no-store',
      });

      const data = await res.json().catch(() => ({}));
      const skipped = data?.error === 'duplicate' || data?.skipped === true;

      results.push({
        name,
        id: externalId,
        ok: !!(res.ok && data?.ok),
        assignedTo: data?.assignedTo || '',
        skipped,
        error: (res.ok && data?.ok) ? '' : (data?.error || `http_${res.status}`),
      });
    } catch (e) {
      results.push({ name, id: externalId, ok: false, error: String(e?.message || e) });
    }
  }

  const distributed = results.filter((r) => r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;

  return {
    ok: true,
    found: contacts.length,
    distributed,
    skipped,
    reResolved,
    source: ghlResult.source,
    results,
    checkedSince: new Date(sinceMs).toISOString(),
  };
}

export async function GET(req) {
  try {
    const host = req.headers.get('host') || 'innercirclelink.com';
    const result = await runSync(host);
    return Response.json(result);
  } catch (e) {
    return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req) {
  return GET(req);
}
