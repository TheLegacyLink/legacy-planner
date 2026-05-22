export const dynamic = 'force-dynamic';

import { loadJsonStore } from '../../../../lib/blobJsonStore';
import { getAdminSkeletonPasswords } from '../../../../lib/adminSkeletonAuth';
import { PROTECTED_STORE_PREFIXES } from '../../../../lib/protectedStores';

function clean(v = '') { return String(v || '').trim(); }

function isAdmin(req) {
  const h = clean(req.headers.get('x-admin-key') || req.headers.get('authorization')).replace(/^Bearer\s+/i, '');
  return getAdminSkeletonPasswords().includes(h);
}

const CHECKS = [
  { path: 'stores/store-products.json',           label: 'Store Products',           check: d => ({ count: d?.products?.length ?? 0, ok: (d?.products?.length ?? 0) >= 5, detail: `${d?.products?.length ?? 0} products, version ${d?._version ?? 'none'}` }) },
  { path: 'stores/sponsorship-applications.json', label: 'Sponsorship Applications', check: d => ({ count: Array.isArray(d) ? d.length : 0, ok: true, detail: `${Array.isArray(d) ? d.length : 0} records` }) },
  { path: 'stores/policy-submissions.json',       label: 'Policy Submissions',       check: d => ({ count: Array.isArray(d) ? d.length : 0, ok: true, detail: `${Array.isArray(d) ? d.length : 0} records` }) },
  { path: 'stores/sponsorship-bookings.json',     label: 'Sponsorship Bookings',     check: d => ({ count: Array.isArray(d) ? d.length : 0, ok: true, detail: `${Array.isArray(d) ? d.length : 0} records` }) },
  { path: 'stores/inner-circle-hub-members.json', label: 'IC Hub Members',           check: d => ({ count: Array.isArray(d) ? d.length : 0, ok: (Array.isArray(d) ? d.length : 0) > 0, detail: `${Array.isArray(d) ? d.length : 0} members` }) },
  { path: 'stores/caller-leads.json',             label: 'Lead Router Leads',        check: d => ({ count: Array.isArray(d) ? d.length : 0, ok: true, detail: `${Array.isArray(d) ? d.length : 0} leads` }) },
  { path: 'stores/lead-router-settings.json',     label: 'Lead Router Settings',     check: d => ({ count: 1, ok: Boolean(d?.mode), detail: `mode=${d?.mode ?? 'none'}, ${(d?.agents||[]).filter(a=>a.active).length} active agents` }) },
  { path: 'stores/contract-signatures.json',      label: 'Contract Signatures',      check: d => ({ count: Array.isArray(d) ? d.length : 0, ok: true, detail: `${Array.isArray(d) ? d.length : 0} signatures` }) },
];

export async function GET(req) {
  if (!isAdmin(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const results = await Promise.all(CHECKS.map(async ({ path, label, check }) => {
    try {
      const data = await loadJsonStore(path, null);
      const { count, ok, detail } = check(data);
      return { label, path, ok, count, detail, protected: PROTECTED_STORE_PREFIXES.some(p => path.startsWith(p)) };
    } catch (err) {
      return { label, path, ok: false, count: 0, detail: `Error: ${err?.message || 'unknown'}`, protected: PROTECTED_STORE_PREFIXES.some(p => path.startsWith(p)) };
    }
  }));

  const allOk = results.every(r => r.ok);
  return Response.json({ ok: allOk, checkedAt: new Date().toISOString(), results });
}
