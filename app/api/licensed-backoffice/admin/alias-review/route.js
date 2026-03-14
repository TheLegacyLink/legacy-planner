import { loadAliases, saveAliases, loadAliasReviewRows, saveAliasReviewRows } from '../../auth/_lib';
import { clean } from '../../../../../lib/licensedAgentMatch';

function isAuthorized(req) {
  const expected = clean(process.env.BACKOFFICE_ADMIN_KEY);
  if (!expected) return false;
  const incoming = clean(req.headers.get('x-admin-key') || req.headers.get('authorization')).replace(/^Bearer\s+/i, '');
  return incoming && incoming === expected;
}

export async function GET(req) {
  if (!isAuthorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const rows = await loadAliasReviewRows();
  return Response.json({ ok: true, rows });
}

export async function POST(req) {
  if (!isAuthorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = clean(body?.action).toLowerCase();
  const id = clean(body?.id);
  if (!action || !id) return Response.json({ ok: false, error: 'missing_action_or_id' }, { status: 400 });

  const reviewRows = await loadAliasReviewRows();
  const idx = reviewRows.findIndex((r) => clean(r?.id) === id);
  if (idx < 0) return Response.json({ ok: false, error: 'review_row_not_found' }, { status: 404 });

  const row = reviewRows[idx];
  if (action === 'reject') {
    reviewRows[idx] = { ...row, status: 'rejected', reviewedAt: new Date().toISOString(), reviewedBy: clean(body?.reviewedBy) || 'admin' };
    await saveAliasReviewRows(reviewRows);
    return Response.json({ ok: true, row: reviewRows[idx] });
  }

  if (action !== 'approve') return Response.json({ ok: false, error: 'invalid_action' }, { status: 400 });

  const primaryEmail = clean(body?.primaryEmail || row?.candidates?.[0]?.email).toLowerCase();
  if (!primaryEmail) return Response.json({ ok: false, error: 'missing_primary_email' }, { status: 400 });

  const aliases = await loadAliases();
  const aliasEmail = clean(row?.email).toLowerCase();
  const activeForPrimary = aliases.filter((a) => clean(a?.primaryEmail).toLowerCase() === primaryEmail && a?.active !== false);
  const distinct = [...new Set(activeForPrimary.map((a) => clean(a?.aliasEmail).toLowerCase()).filter(Boolean))];
  const already = distinct.includes(aliasEmail);
  if (!already && distinct.length >= 2) {
    return Response.json({ ok: false, error: 'alias_limit_reached' }, { status: 400 });
  }

  const i = aliases.findIndex((a) => clean(a?.aliasEmail).toLowerCase() === aliasEmail);
  const nextAliasRow = {
    aliasEmail,
    primaryEmail,
    name: clean(body?.name || row?.fullName || row?.candidates?.[0]?.name),
    phone: clean(body?.phone || row?.phone || row?.candidates?.[0]?.phone),
    agentId: clean(body?.agentId || row?.candidates?.[0]?.agentId),
    active: true,
    linkedAt: new Date().toISOString(),
    linkedBy: clean(body?.reviewedBy) || 'admin_approved'
  };
  if (i >= 0) aliases[i] = { ...aliases[i], ...nextAliasRow };
  else aliases.push(nextAliasRow);
  await saveAliases(aliases);

  reviewRows[idx] = { ...row, status: 'approved', reviewedAt: new Date().toISOString(), reviewedBy: clean(body?.reviewedBy) || 'admin', primaryEmail };
  await saveAliasReviewRows(reviewRows);

  return Response.json({ ok: true, row: reviewRows[idx], alias: nextAliasRow });
}
