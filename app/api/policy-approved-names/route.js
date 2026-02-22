import policies from '../../../data/fngPolicies.json';

function normalizeName(v = '') {
  return String(v || '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function GET() {
  const approved = new Set();

  for (const row of policies || []) {
    const status = String(row.policy_status || '').toLowerCase();
    if (!status) continue;
    const isApproved = ['active', 'issued', 'inforce', 'in force', 'pending lapse', 'lapsed'].some((k) => status.includes(k));
    if (!isApproved) continue;

    const name = normalizeName(row.owner_name || row.name || '');
    if (name) approved.add(name);
  }

  return Response.json({ ok: true, names: Array.from(approved) });
}
