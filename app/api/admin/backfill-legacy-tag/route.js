/**
 * ONE-TIME backfill: apply the 'legacy' GHL tag to every lead in the local
 * caller-leads store that doesn't already have it.
 *
 * POST /api/admin/backfill-legacy-tag
 *   Body: { token: "<ADMIN_SKELETON_TOKEN>" }
 *   Optional: { dryRun: true }  — shows what WOULD be tagged without touching GHL
 *   Optional: { batchSize: 20 } — contacts processed per run (default 50)
 *   Optional: { offset: 0 }     — skip first N leads (for pagination if you need to re-run)
 */

import { loadJsonStore } from '../../../../lib/blobJsonStore';
import { getAdminSkeletonPasswords } from '../../../../lib/adminSkeletonAuth';

function isAuthorized(req, body = {}) {
  // Accept token via header OR body so it can be called from fetch or curl
  const headerToken = clean(req.headers.get('x-admin-key') || req.headers.get('authorization')).replace(/^Bearer\s+/i, '');
  const bodyToken   = clean(body?.token || '');
  const provided    = headerToken || bodyToken;
  if (!provided) return false;
  return getAdminSkeletonPasswords().includes(provided);
}

const CALLER_PATH = 'stores/caller-leads.json';

function clean(v = '') { return String(v || '').trim(); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getGhlContactTags(contactId, token) {
  const headers = { Authorization: `Bearer ${token}`, Version: '2021-07-28' };
  const bases = [
    clean(process.env.GHL_API_BASE_URL || ''),
    'https://services.leadconnectorhq.com',
    'https://rest.gohighlevel.com',
  ].filter(Boolean);
  const paths = [
    `/contacts/${encodeURIComponent(contactId)}`,
    `/v1/contacts/${encodeURIComponent(contactId)}`,
  ];
  for (const base of bases) {
    for (const path of paths) {
      try {
        const res = await fetch(`${base.replace(/\/$/, '')}${path}`, { headers, cache: 'no-store' });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const tags = data?.contact?.tags || data?.tags || [];
          return { ok: true, tags: Array.isArray(tags) ? tags.map(String) : [] };
        }
      } catch { /* try next */ }
    }
  }
  return { ok: false, tags: [] };
}

async function applyTag(contactId, token, legacyTag) {
  const { ok, tags: existingTags } = await getGhlContactTags(contactId, token);
  if (!ok) return { ok: false, reason: 'could_not_fetch_tags' };
  if (existingTags.includes(legacyTag)) return { ok: true, reason: 'already_tagged' };

  const mergedTags = [...existingTags, legacyTag];
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Version: '2021-07-28' };
  const bases = [
    clean(process.env.GHL_API_BASE_URL || ''),
    'https://services.leadconnectorhq.com',
    'https://rest.gohighlevel.com',
  ].filter(Boolean);
  const paths = [
    `/contacts/${encodeURIComponent(contactId)}`,
    `/v1/contacts/${encodeURIComponent(contactId)}`,
  ];
  for (const base of bases) {
    for (const path of paths) {
      try {
        const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ tags: mergedTags }),
          cache: 'no-store',
        });
        if (res.ok) return { ok: true, reason: 'tagged', tagCount: mergedTags.length };
        const txt = await res.text().catch(() => '');
        if (res.status === 429) return { ok: false, reason: 'rate_limited', detail: txt.slice(0, 100) };
      } catch (e) { /* try next */ }
    }
  }
  return { ok: false, reason: 'all_bases_failed' };
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  // Auth check
  if (!isAuthorized(req, body)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const dryRun   = body?.dryRun === true;
  const batchSize = Math.min(Math.max(Number(body?.batchSize || 50), 1), 100);
  const offset    = Math.max(Number(body?.offset || 0), 0);
  const token     = clean(process.env.GHL_API_TOKEN || '');
  const legacyTag = clean(process.env.GHL_LEAD_TAG || 'legacy');

  if (!token) return Response.json({ ok: false, error: 'GHL_API_TOKEN not set in environment' }, { status: 500 });

  // Load all leads from store
  const allLeads = await loadJsonStore(CALLER_PATH, []);
  const leads = Array.isArray(allLeads) ? allLeads : [];

  // Only process leads that have a GHL external ID
  const candidates = leads
    .filter((r) => clean(r?.externalId || ''))
    .slice(offset, offset + batchSize);

  const total     = leads.filter((r) => clean(r?.externalId || '')).length;
  const results   = [];
  let tagged      = 0;
  let alreadyHad  = 0;
  let failed      = 0;
  let skipped     = 0;

  for (const lead of candidates) {
    const contactId = clean(lead.externalId);

    if (dryRun) {
      results.push({ name: lead.name || lead.email || contactId, contactId, action: 'would_tag' });
      tagged += 1;
      continue;
    }

    const result = await applyTag(contactId, token, legacyTag);

    if (result.reason === 'already_tagged') {
      alreadyHad += 1;
      results.push({ name: lead.name || lead.email || contactId, contactId, action: 'already_tagged' });
    } else if (result.ok) {
      tagged += 1;
      results.push({ name: lead.name || lead.email || contactId, contactId, action: 'tagged' });
    } else if (result.reason === 'rate_limited') {
      skipped += 1;
      results.push({ name: lead.name || lead.email || contactId, contactId, action: 'rate_limited', detail: result.detail });
      // Stop batch on rate limit — caller can resume with offset
      break;
    } else {
      failed += 1;
      results.push({ name: lead.name || lead.email || contactId, contactId, action: 'failed', reason: result.reason });
    }

    // Polite delay — 200ms between requests to avoid GHL rate limits
    await sleep(200);
  }

  const nextOffset = offset + candidates.length;
  const hasMore    = nextOffset < total;

  return Response.json({
    ok: true,
    dryRun,
    legacyTag,
    totalLeadsWithGhlId: total,
    batchSize,
    offset,
    processed: candidates.length,
    tagged,
    alreadyHad,
    failed,
    skipped,
    hasMore,
    nextOffset: hasMore ? nextOffset : null,
    results,
  });
}
