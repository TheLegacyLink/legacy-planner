import { loadAliases, saveAliases, loadAliasReviewRows, saveAliasReviewRows } from '../../licensed-backoffice/auth/_lib';
import { clean, matchLicensedAgent } from '../../../../lib/licensedAgentMatch';
import { loadJsonStore } from '../../../../lib/blobJsonStore';

function isAuthorized(req) {
  const expected = clean(process.env.BACKOFFICE_ADMIN_KEY);
  if (!expected) return false;
  const incoming = clean(req.headers.get('x-admin-key') || req.headers.get('authorization')).replace(/^Bearer\s+/i, '');
  return incoming && incoming === expected;
}

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!isAuthorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const reviewRows = await loadAliasReviewRows();
  const pending = reviewRows.filter((r) => clean(r?.status || 'pending') === 'pending');
  const aliases = await loadAliases();
  const now = new Date().toISOString();

  const results = { approved: [], skipped: [], errors: [] };

  for (const row of pending) {
    try {
      const aliasEmail = clean(row?.email).toLowerCase();

      // Try to find a matching licensed agent
      const m = matchLicensedAgent({ fullName: row?.fullName || '', phone: row?.phone || '', email: aliasEmail });
      const candidate = m?.match || row?.candidates?.[0] || null;

      if (!candidate?.email) {
        // No roster match — check for signed ICA
        const icaRows = await loadJsonStore('stores/esign-contracts.json', []);
        const icaHit = (Array.isArray(icaRows) ? icaRows : []).find(
          (r) => clean(r?.email).toLowerCase() === aliasEmail && r?.candidateSignedAt
        );
        if (!icaHit) {
          results.skipped.push({ email: aliasEmail, reason: 'no_match_no_ica' });
          continue;
        }
        // ICA signed — mark approved, no alias needed (ICA fallback handles login)
        const idx = reviewRows.findIndex((r) => clean(r?.id) === clean(row?.id));
        if (idx >= 0) reviewRows[idx] = { ...reviewRows[idx], status: 'approved', reviewedAt: now, reviewedBy: 'auto_sweep_ica' };
        results.approved.push({ email: aliasEmail, via: 'ica_signed' });
        continue;
      }

      const primaryEmail = clean(candidate.email).toLowerCase();
      const activeForPrimary = aliases.filter((a) => clean(a?.primaryEmail).toLowerCase() === primaryEmail && a?.active !== false);
      const distinct = [...new Set(activeForPrimary.map((a) => clean(a?.aliasEmail).toLowerCase()).filter(Boolean))];
      const already = distinct.includes(aliasEmail);

      if (!already && distinct.length >= 2) {
        results.skipped.push({ email: aliasEmail, reason: 'alias_limit_reached' });
        continue;
      }

      if (!already) {
        const i = aliases.findIndex((a) => clean(a?.aliasEmail).toLowerCase() === aliasEmail);
        const newAlias = {
          aliasEmail,
          primaryEmail,
          name: clean(candidate.name || row?.fullName || ''),
          phone: clean(candidate.phone || row?.phone || ''),
          agentId: clean(candidate.agentId || ''),
          active: true,
          linkedAt: now,
          linkedBy: 'auto_sweep'
        };
        if (i >= 0) aliases[i] = { ...aliases[i], ...newAlias };
        else aliases.push(newAlias);
      }

      const idx = reviewRows.findIndex((r) => clean(r?.id) === clean(row?.id));
      if (idx >= 0) reviewRows[idx] = { ...reviewRows[idx], status: 'approved', reviewedAt: now, reviewedBy: 'auto_sweep', primaryEmail };
      results.approved.push({ email: aliasEmail, primaryEmail, via: 'roster_match' });

    } catch (err) {
      results.errors.push({ email: row?.email, error: String(err?.message || err) });
    }
  }

  await saveAliases(aliases);
  await saveAliasReviewRows(reviewRows);

  return Response.json({ ok: true, results, summary: { approved: results.approved.length, skipped: results.skipped.length, errors: results.errors.length } });
}
