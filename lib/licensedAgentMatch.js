import licensedAgents from '../data/licensedAgents.json';

export function clean(v = '') { return String(v || '').trim(); }
export function norm(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
export function digits(v = '') { return clean(v).replace(/\D+/g, ''); }

export function displayName(raw = '') {
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
  const rowName = norm(displayName(row?.full_name || row?.name || ''));

  const inEmail = norm(input.email);
  const inPhone = digits(input.phone);
  const inName = norm(input.fullName);

  let score = 0;
  if (inEmail && rowEmail && inEmail === rowEmail) score += 120;
  if (inPhone && rowPhone && (inPhone === rowPhone || inPhone.endsWith(rowPhone) || rowPhone.endsWith(inPhone))) score += 90;
  if (inName && rowName && inName === rowName) score += 100;

  const a = firstLastTokens(input.fullName);
  const b = firstLastTokens(displayName(row?.full_name || row?.name || ''));
  if (a.first && b.first && a.first === b.first) score += 20;
  if (a.last && b.last && a.last === b.last) score += 35;

  return score;
}

export function normalizeCarrierList(row = {}) {
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

export function normalizeProfile(row = {}, score = 0) {
  const carriers = normalizeCarrierList(row);
  return {
    score,
    name: displayName(row?.full_name || row?.name || ''),
    email: clean(row?.email),
    phone: clean(row?.phone),
    homeState: clean(row?.home_state),
    licenseStatus: clean(row?.license_status),
    agentId: clean(row?.agent_id),
    carriersActive: carriers.actives,
    carriersAll: carriers.all,
    carrierDetails: carriers.details
  };
}

export function findLicensedByEmail(email = '') {
  const e = norm(email);
  if (!e) return null;
  const row = (Array.isArray(licensedAgents) ? licensedAgents : []).find((r) => norm(r?.email) === e);
  return row ? normalizeProfile(row, 999) : null;
}

export function matchLicensedAgent(input = {}) {
  const payload = {
    fullName: clean(input?.fullName || `${clean(input?.firstName)} ${clean(input?.lastName)}`),
    email: clean(input?.email),
    phone: clean(input?.phone)
  };

  if (!payload.fullName && !payload.email && !payload.phone) {
    return { matched: false, candidates: [] };
  }

  const rows = Array.isArray(licensedAgents) ? licensedAgents : [];
  const ranked = rows
    .map((r) => ({ row: r, score: scoreRow(r, payload) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const candidates = ranked.slice(0, 5).map((x) => normalizeProfile(x.row, x.score));
  const top = candidates[0] || null;

  return {
    matched: Boolean(top),
    match: top,
    candidates
  };
}

export function isStrongAliasMatch(input = {}, profile = null) {
  if (!profile) return false;
  const inPhone = digits(input?.phone || '');
  const pPhone = digits(profile?.phone || '');
  const phoneStrong = Boolean(inPhone && pPhone && (inPhone === pPhone || inPhone.endsWith(pPhone) || pPhone.endsWith(inPhone)));

  const a = firstLastTokens(input?.fullName || '');
  const b = firstLastTokens(profile?.name || '');
  const nameStrong = Boolean(a.first && b.first && a.first === b.first && a.last && b.last && a.last === b.last);

  return phoneStrong && nameStrong;
}
