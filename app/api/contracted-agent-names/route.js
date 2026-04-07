import licensedAgents from '../../../data/licensedAgents.json';

function clean(v = '') {
  return String(v || '').trim();
}

function toDisplayName(raw = '') {
  const v = clean(raw);
  if (!v) return '';
  if (!v.includes(',')) return v;
  const parts = v.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return v;
  const last = parts[0];
  const first = parts.slice(1).join(' ').trim();
  return `${first} ${last}`.trim();
}

function isContracted(row = {}) {
  const activeCarriers = Array.isArray(row?.carriers_active) ? row.carriers_active.filter(Boolean) : [];
  if (activeCarriers.length) return true;

  const details = Array.isArray(row?.carrier_details) ? row.carrier_details : [];
  return details.some((d) => String(d?.contract_status || '').toLowerCase().includes('active'));
}

export async function GET() {
  const seen = new Set();
  const names = [];

  for (const row of Array.isArray(licensedAgents) ? licensedAgents : []) {
    const baseName = toDisplayName(row?.full_name || row?.name || '');
    if (!baseName || !isContracted(row)) continue;
    const key = baseName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(baseName);
  }

  names.sort((a, b) => a.localeCompare(b));
  return Response.json({ ok: true, names });
}
