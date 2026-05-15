import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

export const dynamic = 'force-dynamic';

const SYNC_STATE_PATH = 'stores/ghl-lead-sync-state.json';

function clean(v = '') { return String(v || '').trim(); }

function nowIso() { return new Date().toISOString(); }

// Fetch contacts from GHL created after a given timestamp
async function fetchGhlContactsSince(sinceMs) {
  const token = clean(process.env.GHL_API_TOKEN || '');
  if (!token) return { ok: false, error: 'GHL_API_TOKEN not set', contacts: [] };

  const locationId = clean(process.env.GHL_LOCATION_ID || '');

  const bases = [
    clean(process.env.GHL_API_BASE_URL || ''),
    'https://services.leadconnectorhq.com',
    'https://rest.gohighlevel.com',
  ].filter(Boolean);

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  };

  let lastError = '';

  for (const base of bases) {
    try {
      // Use startAfter timestamp + location filter
      const params = new URLSearchParams({ limit: '100', order: 'desc' });
      if (locationId) params.set('locationId', locationId);
      if (sinceMs) params.set('startAfter', String(sinceMs));

      const url = `${base.replace(/\/$/, '')}/contacts/?${params}`;
      const res = await fetch(url, { headers, cache: 'no-store' });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const raw = Array.isArray(data?.contacts) ? data.contacts : [];
        // Filter to only contacts newer than sinceMs
        const contacts = raw.filter((c) => {
          const t = new Date(c?.dateAdded || c?.createdAt || 0).getTime();
          return t > sinceMs;
        });
        return { ok: true, contacts, source: base };
      }

      const errText = await res.text().catch(() => '');
      lastError = `${base} → ${res.status} ${errText.slice(0, 120)}`;
    } catch (e) {
      lastError = String(e?.message || e);
    }
  }

  return { ok: false, error: lastError, contacts: [] };
}

async function runSync(host = 'innercirclelink.com') {
  // Load last sync state
  const state = await loadJsonFile(SYNC_STATE_PATH, { lastSyncAt: null, lastRunAt: null });
  const lastSyncAt = state?.lastSyncAt || null;

  // Default: go back 30 minutes on first run to catch anything that was missed
  const sinceMs = lastSyncAt
    ? new Date(lastSyncAt).getTime()
    : Date.now() - 30 * 60 * 1000;

  const ghlResult = await fetchGhlContactsSince(sinceMs);

  // Always update lastSyncAt so next run picks up from now
  await saveJsonFile(SYNC_STATE_PATH, {
    lastSyncAt: nowIso(),
    lastRunAt: nowIso(),
    lastFound: ghlResult.contacts?.length || 0,
  });

  if (!ghlResult.ok) {
    return { ok: false, error: ghlResult.error, found: 0, distributed: 0, skipped: 0 };
  }

  const contacts = ghlResult.contacts || [];
  if (!contacts.length) {
    return { ok: true, found: 0, distributed: 0, skipped: 0, message: 'No new contacts since last sync' };
  }

  // Push each contact through the lead router
  const intakeToken = clean(process.env.GHL_INTAKE_TOKEN || '');
  const baseUrl = `https://${host}`;
  const results = [];

  for (const c of contacts) {
    const name = `${clean(c.firstName || '')} ${clean(c.lastName || '')}`.trim() || clean(c.name || c.contactName || '') || 'Unknown';
    const email = clean(c.email || '');
    const phone = clean(c.phone || '');
    const externalId = clean(c.id || '');

    if (!externalId) continue;

    try {
      const payload = {
        token: intakeToken,
        id: externalId,
        name,
        firstName: clean(c.firstName || name.split(' ')[0] || ''),
        lastName: clean(c.lastName || name.split(' ').slice(1).join(' ') || ''),
        email,
        phone,
        source: clean(c.source || c.attributionSource?.medium || 'ghl-lead-sync'),
        externalId,
      };

      const res = await fetch(`${baseUrl}/api/lead-router`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-intake-token': intakeToken,
          'x-internal-source': 'ghl-lead-sync',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });

      const data = await res.json().catch(() => ({}));

      results.push({
        name,
        id: externalId,
        ok: !!(res.ok && data?.ok),
        assignedTo: data?.assignedTo || '',
        skipped: data?.error === 'duplicate' || data?.skipped,
        error: data?.ok ? '' : (data?.error || `http_${res.status}`),
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
    return Response.json({ ok: false, error: String(e?.message || e), found: 0, distributed: 0 }, { status: 500 });
  }
}

export async function POST(req) {
  return GET(req);
}
