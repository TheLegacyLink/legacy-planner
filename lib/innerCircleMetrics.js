import { loadJsonStore } from './blobJsonStore';
import users from '../data/innerCircleUsers.json';

const APPS_PATH = 'stores/sponsorship-applications.json';
const POLICY_PATH = 'stores/policy-submissions.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }

function currentMonthYear() {
  const now = new Date();
  return { month: now.getMonth(), year: now.getFullYear() };
}

function inScope(iso = '', scope = 'monthly') {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  if (scope === 'monthly') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (scope === 'ytd') return d.getFullYear() === now.getFullYear();
  return true;
}

function cleanName(value = '') {
  return normalize(String(value || '').replace(/^dr\.\s*/i, ''));
}

function defaultAgents() {
  return (users || [])
    .filter((u) => normalize(u?.role || '') !== 'admin' && clean(u?.name))
    .map((u) => clean(u.name));
}

function aliasCandidates(name = '') {
  const c = cleanName(name);
  if (!c) return [];
  return [...new Set([c, c.replace(/\./g, '')])];
}

function matchAgentFromReferrer(referrer = '', agents = []) {
  const ref = cleanName(referrer);
  if (!ref) return null;

  let best = null;
  let bestScore = 0;

  for (const agent of agents || []) {
    const a = cleanName(agent);
    if (!a) continue;
    if (ref.includes(a)) return agent;

    const parts = a.split(' ').filter((p) => p.length >= 3);
    const score = parts.reduce((acc, p) => (ref.includes(p) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      best = agent;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : null;
}

function mapApplicationToAgent(row = {}, agents = []) {
  const direct = row?.referralName || row?.referred_by || row?.referredBy || row?.referredByName || '';
  let mapped = matchAgentFromReferrer(direct, agents);
  if (mapped) return mapped;

  const refCode = String(row?.refCode || row?.referral_code || '').replace(/[_-]+/g, ' ');
  mapped = matchAgentFromReferrer(refCode, agents);
  if (mapped) return mapped;

  mapped = matchAgentFromReferrer(row?.submittedBy || row?.policyWriterName || row?.policy_writer_name || '', agents);
  return mapped || null;
}

function applicantKey(row = {}) {
  const email = clean(row?.email || row?.applicantEmail || row?.applicant_email || '').toLowerCase();
  const phone = clean(row?.phone || row?.applicantPhone || row?.applicant_phone || '').replace(/\D/g, '');
  const first = clean(row?.firstName || row?.first_name || '');
  const last = clean(row?.lastName || row?.last_name || '');
  const name = cleanName(row?.applicantName || row?.name || `${first} ${last}`).replace(/\s+/g, '');

  if (email) return `e:${email}`;
  if (phone) return `p:${phone}`;
  if (name) return `n:${name}`;
  return `id:${clean(row?.id || Math.random().toString(36).slice(2))}`;
}

function buildAgentRows(agents = []) {
  const out = {};
  for (const a of agents) {
    out[a] = {
      agent_name: a,
      referral_count_month: 0,
      referral_count_ytd: 0,
      referral_count_all_time: 0,
      app_submitted_count_month: 0,
      app_submitted_count_ytd: 0,
      app_submitted_count_all_time: 0,
      activity_bonus: 0,
      activity_bonus_month: 0,
      activity_bonus_ytd: 0,
      activity_bonus_all_time: 0
    };
  }
  return out;
}

export async function loadInnerCircleMetrics() {
  const agents = defaultAgents();
  const rows = buildAgentRows(agents);

  const [appsRaw, policyRaw] = await Promise.all([
    loadJsonStore(APPS_PATH, []),
    loadJsonStore(POLICY_PATH, [])
  ]);

  const apps = Array.isArray(appsRaw) ? appsRaw : [];
  const policies = Array.isArray(policyRaw) ? policyRaw : [];

  const seen = {
    referrals: { monthly: new Set(), ytd: new Set(), all_time: new Set() },
    apps: { monthly: new Set(), ytd: new Set(), all_time: new Set() }
  };

  for (const r of apps) {
    const mapped = mapApplicationToAgent(r, agents);
    if (!mapped || !rows[mapped]) continue;

    const submittedAt = r?.submitted_at || r?.submittedAt || r?.createdAt || r?.updatedAt || '';
    const key = `${mapped}|${applicantKey(r)}`;

    for (const scope of ['monthly', 'ytd', 'all_time']) {
      if (!inScope(submittedAt, scope)) continue;
      if (seen.referrals[scope].has(key)) continue;
      seen.referrals[scope].add(key);
      rows[mapped][`referral_count_${scope}`] += 1;
    }
  }

  for (const r of policies) {
    const mapped = mapApplicationToAgent(r, agents);
    if (!mapped || !rows[mapped]) continue;

    const submittedAt = r?.submittedAt || r?.createdAt || r?.updatedAt || '';
    const key = `${mapped}|${applicantKey(r)}`;

    for (const scope of ['monthly', 'ytd', 'all_time']) {
      if (!inScope(submittedAt, scope)) continue;
      if (seen.apps[scope].has(key)) continue;
      seen.apps[scope].add(key);
      rows[mapped][`app_submitted_count_${scope}`] += 1;
    }
  }

  for (const a of agents) {
    rows[a].activity_bonus_month = Number(rows[a].referral_count_month || 0);
    rows[a].activity_bonus_ytd = Number(rows[a].referral_count_ytd || 0);
    rows[a].activity_bonus_all_time = Number(rows[a].referral_count_all_time || 0);
    rows[a].activity_bonus = Number(rows[a].referral_count_all_time || 0);

    // Compatibility aliases used in some views
    rows[a].referral_count = Number(rows[a].referral_count_all_time || 0);
    rows[a].app_submitted_count = Number(rows[a].app_submitted_count_all_time || 0);
  }

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    agents,
    rows: agents.map((a) => rows[a])
  };
}
