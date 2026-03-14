import licensedAgents from '../../../../data/licensedAgents.json';

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function digits(v = '') { return clean(v).replace(/\D+/g, ''); }

function displayName(raw = '') {
  const value = clean(raw);
  if (!value) return '';
  if (value.includes(',')) {
    const [last, first] = value.split(',').map((x) => clean(x));
    return clean(`${first} ${last}`).toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
  }
  return value.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

function firstLastTokens(full = '') {
  const parts = norm(full).replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(Boolean);
  return {
    first: parts[0] || '',
    last: parts.length ? parts[parts.length - 1] : ''
  };
}

function scoreRow(row, input) {
  const rowEmail = norm(row?.email);
  const rowPhone = digits(row?.phone);
  const rowName = norm(displayName(row?.full_name || ''));

  const inEmail = norm(input.email);
  const inPhone = digits(input.phone);
  const inName = norm(input.fullName);

  let score = 0;
  if (inEmail && rowEmail && inEmail === rowEmail) score += 120;
  if (inPhone && rowPhone && (inPhone === rowPhone || inPhone.endsWith(rowPhone) || rowPhone.endsWith(inPhone))) score += 90;
  if (inName && rowName && inName === rowName) score += 100;

  const a = firstLastTokens(input.fullName);
  const b = firstLastTokens(displayName(row?.full_name || ''));
  if (a.first && b.first && a.first === b.first) score += 20;
  if (a.last && b.last && a.last === b.last) score += 35;

  return score;
}

function normalizeCarrierList(row = {}) {
  const actives = Array.isArray(row?.carriers_active) ? row.carriers_active.map(clean).filter(Boolean) : [];
  const all = Array.isArray(row?.carriers_all) ? row.carriers_all.map(clean).filter(Boolean) : [];
  const details = Array.isArray(row?.carrier_details)
    ? row.carrier_details.map((d) => ({
        carrier: clean(d?.carrier),
        status: clean(d?.contract_status),
        carrierAgentId: clean(d?.carrier_agent_id)
      }))
    : [];
  return { actives, all, details };
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const input = {
    fullName: clean(body?.fullName || `${clean(body?.firstName)} ${clean(body?.lastName)}`),
    email: clean(body?.email),
    phone: clean(body?.phone)
  };

  if (!input.fullName && !input.email && !input.phone) {
    return Response.json({ ok: false, error: 'missing_match_input' }, { status: 400 });
  }

  const rows = Array.isArray(licensedAgents) ? licensedAgents : [];
  const ranked = rows
    .map((r) => ({ row: r, score: scoreRow(r, input) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const candidates = ranked.slice(0, 5).map((x) => {
    const carriers = normalizeCarrierList(x.row);
    return {
      score: x.score,
      name: displayName(x.row?.full_name || ''),
      email: clean(x.row?.email),
      phone: clean(x.row?.phone),
      homeState: clean(x.row?.home_state),
      licenseStatus: clean(x.row?.license_status),
      agentId: clean(x.row?.agent_id),
      carriersActive: carriers.actives,
      carriersAll: carriers.all,
      carrierDetails: carriers.details
    };
  });

  if (!top) {
    return Response.json({ ok: true, matched: false, candidates: [] });
  }

  const carriers = normalizeCarrierList(top.row);
  const match = {
    score: top.score,
    name: displayName(top.row?.full_name || ''),
    email: clean(top.row?.email),
    phone: clean(top.row?.phone),
    homeState: clean(top.row?.home_state),
    licenseStatus: clean(top.row?.license_status),
    agentId: clean(top.row?.agent_id),
    carriersActive: carriers.actives,
    carriersAll: carriers.all,
    carrierDetails: carriers.details
  };

  return Response.json({ ok: true, matched: true, match, candidates });
}
