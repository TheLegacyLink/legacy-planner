import licensedAgents from '../data/licensedAgents.json';

export const SPONSORSHIP_CREDITS_PER_POLICY = 4000;
export const SERVICE_CREDITS_PER_HOUR = 500;
export const SERVICE_CREDIT_CAP_HOURS_MONTH = 4;

// New monthly model requested:
// - Production bonus: 3% of monthly Net Placed AP, unlocked at 8 sponsorship policies (approved/issued)
// - Submission reward: $1 per policy submission
// - Sponsorship policy bonus tiers remain 5/10/15
export const PRODUCTION_PERCENT = 0.03;
export const PRODUCTION_UNLOCK_SPONSORSHIP_APPROVALS = 8;
export const POLICY_SUBMISSION_REWARD = 50;

export const SPONSORSHIP_BONUS_TIERS = [
  { threshold: 5, payout: 1000 },
  { threshold: 10, payout: 3000 },
  { threshold: 15, payout: 5000 }
];

export const QUARTER_TIERS = [
  { label: 'Bronze', ap: 40000, sponsorshipPolicies: 3, serviceHours: 6, payout: 1500 },
  { label: 'Silver', ap: 75000, sponsorshipPolicies: 5, serviceHours: 10, payout: 3500 },
  { label: 'Gold', ap: 120000, sponsorshipPolicies: 8, serviceHours: 12, payout: 7500 }
];

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }

function nameKey(v = '') {
  return normalize(v).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function firstLastKey(v = '') {
  const parts = nameKey(v).split(' ').filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function toTs(v = '') {
  const t = new Date(v || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function monthKey(ts = 0) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function quarterKey(ts = 0) {
  if (!ts) return '';
  const d = new Date(ts);
  const quarter = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${quarter}`;
}

function nowMonthKey() { return monthKey(Date.now()); }
function nowQuarterKey() { return quarterKey(Date.now()); }

function resolveAgentName(raw = '', canonicalAgents = []) {
  const rawKey = firstLastKey(raw);
  if (!rawKey) return '';

  for (const agent of canonicalAgents) {
    if (firstLastKey(agent) === rawKey) return agent;
  }

  const direct = canonicalAgents.find((a) => nameKey(a) === nameKey(raw));
  return direct || clean(raw);
}

function isPlacedAndPaid(row = {}) {
  const status = normalize(row?.status || '');
  const payout = normalize(row?.payoutStatus || '');

  if (payout.includes('reversed')) return false;

  const placedLike = status.includes('approved') || status.includes('issued') || status.includes('placed');
  const paidLike = payout.includes('paid') || status.includes('paid');
  return placedLike && paidLike;
}

function policyApprovedTs(row = {}) {
  return toTs(row?.approvedAt || row?.updatedAt || row?.submittedAt || row?.createdAt || '');
}

function policySubmittedTs(row = {}) {
  return toTs(row?.submittedAt || row?.createdAt || row?.updatedAt || '');
}

function serviceTs(row = {}) {
  return toTs(row?.createdAt || row?.updatedAt || '');
}

function policyNetPlacedAp(row = {}) {
  const raw = Number(row?.netPlacedAP ?? row?.netPlacedAp ?? row?.annualPremium ?? row?.premium ?? 0);
  return Number.isFinite(raw) ? Math.max(0, raw) : 0;
}

function isSponsorshipPolicy(row = {}) {
  const t = normalize(row?.policyType || row?.appType || '');
  if (t.includes('sponsorship')) return true;

  // Legacy fallback: older rows may have empty policyType/appType but still be sponsorship policies.
  // If a row has a referrer and no explicit type, treat it as sponsorship for bonus attribution.
  if (!t && clean(row?.referredByName || '')) return true;

  return false;
}

function isSponsorshipPolicyApprovedIssued(row = {}) {
  if (!isSponsorshipPolicy(row)) return false;
  const status = normalize(row?.status || '');
  const payout = normalize(row?.payoutStatus || '');
  if (payout.includes('reversed')) return false;
  return status.includes('approved') || status.includes('issued') || status.includes('placed');
}

function sponsorshipBonus(count = 0) {
  const eligible = SPONSORSHIP_BONUS_TIERS.filter((t) => count >= t.threshold);
  return eligible[eligible.length - 1] || null;
}

function communityImpactBonus(hours = 0) {
  if (hours >= 12) return { label: '12+ verified hours', threshold: 12, payout: 500 };
  if (hours >= 8) return { label: '8+ verified hours', threshold: 8, payout: 250 };
  if (hours >= 4) return { label: '4+ verified hours', threshold: 4, payout: 0 };
  return null;
}

function quarterTier(ap = 0, sponsorshipPolicies = 0, serviceHours = 0) {
  const eligible = QUARTER_TIERS.filter((t) => ap >= t.ap && sponsorshipPolicies >= t.sponsorshipPolicies && serviceHours >= t.serviceHours);
  return eligible[eligible.length - 1] || null;
}

function nextTierProgress(value = 0, tiersAsc = [], field = 'threshold') {
  const sorted = [...tiersAsc].sort((a, b) => Number(a[field] || 0) - Number(b[field] || 0));
  const next = sorted.find((t) => value < Number(t[field] || 0));
  const current = sorted.filter((t) => value >= Number(t[field] || 0)).slice(-1)[0] || null;
  if (!next) return { pct: 100, next: null, current };

  const prevValue = Number(current?.[field] || 0);
  const nextValue = Number(next[field] || 0);
  const denom = Math.max(1, nextValue - prevValue);
  const pct = Math.max(0, Math.min(100, ((value - prevValue) / denom) * 100));
  return { pct, next, current };
}

function isVerifiedCommunityRow(row = {}) {
  const photoCount = Array.isArray(row?.photo_urls) ? row.photo_urls.length : 0;
  const minutes = Number(row?.time_spent || 0);
  return photoCount > 0 && minutes >= 60;
}

export function computeChampionsCircle({ policyRows = [], communityRows = [], innerMembers = [], agents = [] } = {}) {
  const month = nowMonthKey();
  const quarter = nowQuarterKey();

  const canonicalAgents = Array.from(new Set([
    ...(agents || []),
    ...((licensedAgents || []).map((r) => clean(r?.full_name)).filter(Boolean)),
    ...((policyRows || []).flatMap((r) => [clean(r?.policyWriterName), clean(r?.referredByName)]).filter(Boolean)),
    ...((innerMembers || []).map((m) => clean(m?.applicantName || m?.name)).filter(Boolean))
  ])).filter(Boolean);

  const innerSet = new Set(
    (innerMembers || [])
      .filter((m) => Boolean(m?.active))
      .map((m) => firstLastKey(m?.applicantName || m?.name))
      .filter(Boolean)
  );

  const base = {};
  for (const agent of canonicalAgents) {
    base[agent] = {
      agent,
      group: innerSet.has(firstLastKey(agent)) ? 'inner' : 'licensed',
      monthProductionAp: 0,
      monthSponsorshipPolicies: 0, // sponsorship policies approved/issued (for payout tiers)
      monthSponsorshipSubmissions: 0,
      monthSponsorshipPlacedPaid: 0,
      monthPolicySubmissions: 0,
      monthServiceHours: 0,
      quarterProductionAp: 0,
      quarterSponsorshipPolicies: 0,
      quarterServiceHours: 0,
      lifetimeProductionAp: 0,
      lifetimeSponsorshipPolicies: 0,
      lifetimeServiceHours: 0
    };
  }

  for (const row of policyRows || []) {
    const writer = resolveAgentName(row?.policyWriterName, canonicalAgents);

    // $1 per policy submission (writer-side)
    const submitTs = policySubmittedTs(row);
    if (submitTs && writer && base[writer] && monthKey(submitTs) === month) {
      base[writer].monthPolicySubmissions += 1;
    }

    // Sponsorship policy count for bonus unlock/tiers: approved + issued style policy statuses.
    if (isSponsorshipPolicyApprovedIssued(row)) {
      const sponsorTs = policyApprovedTs(row) || submitTs;
      const referrer = resolveAgentName(row?.referredByName, canonicalAgents);
      if (sponsorTs && referrer && base[referrer]) {
        if (monthKey(sponsorTs) === month) base[referrer].monthSponsorshipPolicies += 1;
      }
    }

    // Placed + paid AP math
    const approvedTs = policyApprovedTs(row);
    if (!approvedTs || !isPlacedAndPaid(row)) continue;

    if (writer && base[writer]) {
      const ap = policyNetPlacedAp(row);
      base[writer].lifetimeProductionAp += ap;
      if (monthKey(approvedTs) === month) base[writer].monthProductionAp += ap;
      if (quarterKey(approvedTs) === quarter) base[writer].quarterProductionAp += ap;
    }

    if (isSponsorshipPolicy(row)) {
      const referrer = resolveAgentName(row?.referredByName, canonicalAgents);
      if (referrer && base[referrer]) {
        base[referrer].lifetimeSponsorshipPolicies += 1;
        if (monthKey(approvedTs) === month) {
          base[referrer].monthSponsorshipPlacedPaid += 1;
        }
        if (quarterKey(approvedTs) === quarter) {
          base[referrer].quarterSponsorshipPolicies += 1;
        }
      }
    }
  }

  for (const row of communityRows || []) {
    const ts = serviceTs(row);
    if (!isVerifiedCommunityRow(row)) continue;

    const member = resolveAgentName(row?.memberName, canonicalAgents);
    if (!member || !base[member]) continue;

    const hours = Number(row?.time_spent || 0) / 60;
    base[member].lifetimeServiceHours += hours;
    if (monthKey(ts) === month) base[member].monthServiceHours += hours;
    if (quarterKey(ts) === quarter) base[member].quarterServiceHours += hours;
  }

  const rows = Object.values(base)
    .map((r) => {
      const serviceCreditHours = Math.min(SERVICE_CREDIT_CAP_HOURS_MONTH, r.monthServiceHours);

      const productionCreditsMonth = r.monthProductionAp;
      const sponsorshipCreditsMonth = r.monthSponsorshipPlacedPaid * SPONSORSHIP_CREDITS_PER_POLICY;
      const serviceCreditsMonth = serviceCreditHours * SERVICE_CREDITS_PER_HOUR;
      const totalCreditsMonth = productionCreditsMonth + sponsorshipCreditsMonth + serviceCreditsMonth;

      const productionCreditsLifetime = r.lifetimeProductionAp;
      const sponsorshipCreditsLifetime = r.lifetimeSponsorshipPolicies * SPONSORSHIP_CREDITS_PER_POLICY;
      const serviceCreditsLifetime = r.lifetimeServiceHours * SERVICE_CREDITS_PER_HOUR;
      const totalCreditsLifetime = productionCreditsLifetime + sponsorshipCreditsLifetime + serviceCreditsLifetime;

      const sponsorshipBonusTier = sponsorshipBonus(r.monthSponsorshipPolicies);
      const communityBonusTier = communityImpactBonus(r.monthServiceHours);
      const quarterTierHit = quarterTier(r.quarterProductionAp, r.quarterSponsorshipPolicies, r.quarterServiceHours);

      const productionUnlocked = r.monthSponsorshipPolicies >= PRODUCTION_UNLOCK_SPONSORSHIP_APPROVALS;
      const productionPercentPayout = productionUnlocked ? (r.monthProductionAp * PRODUCTION_PERCENT) : 0;
      const productionBonusTier = {
        threshold: `${PRODUCTION_UNLOCK_SPONSORSHIP_APPROVALS} sponsorship policies (approved/issued)`,
        payout: Math.round(productionPercentPayout * 100) / 100,
        percent: PRODUCTION_PERCENT,
        unlocked: productionUnlocked
      };

      const submissionRewardPayout = r.monthPolicySubmissions * POLICY_SUBMISSION_REWARD;

      const sponsorshipProgress = nextTierProgress(r.monthSponsorshipPolicies, SPONSORSHIP_BONUS_TIERS, 'threshold');
      const communityProgress = nextTierProgress(r.monthServiceHours, [
        { threshold: 4, payout: 0 },
        { threshold: 8, payout: 250 },
        { threshold: 12, payout: 500 }
      ], 'threshold');

      const unlockPct = Math.max(0, Math.min(100, (r.monthSponsorshipPolicies / PRODUCTION_UNLOCK_SPONSORSHIP_APPROVALS) * 100));
      const productionProgress = {
        pct: productionUnlocked ? 100 : unlockPct,
        next: productionUnlocked ? null : { threshold: PRODUCTION_UNLOCK_SPONSORSHIP_APPROVALS },
        current: productionUnlocked ? { threshold: PRODUCTION_UNLOCK_SPONSORSHIP_APPROVALS } : null
      };

      const monthlyCashPayout =
        Number(productionBonusTier?.payout || 0)
        + Number(sponsorshipBonusTier?.payout || 0)
        + Number(communityBonusTier?.payout || 0)
        + Number(submissionRewardPayout || 0);

      return {
        ...r,
        productionCreditsMonth,
        sponsorshipCreditsMonth,
        serviceCreditsMonth,
        totalCreditsMonth,
        productionCreditsLifetime,
        sponsorshipCreditsLifetime,
        serviceCreditsLifetime,
        totalCreditsLifetime,
        productionBonusTier,
        sponsorshipBonusTier,
        communityBonusTier,
        submissionRewardPayout,
        quarterTierHit,
        productionProgress,
        sponsorshipProgress,
        communityProgress,
        monthlyCashPayout
      };
    })
    .filter((r) => r.totalCreditsLifetime > 0 || r.monthlyCashPayout > 0 || r.monthProductionAp > 0 || r.monthSponsorshipPolicies > 0 || r.monthServiceHours > 0 || r.monthPolicySubmissions > 0)
    .sort((a, b) => b.totalCreditsMonth - a.totalCreditsMonth || b.monthProductionAp - a.monthProductionAp);

  return {
    month,
    quarter,
    rows,
    licensed: rows.filter((r) => r.group === 'licensed'),
    inner: rows.filter((r) => r.group === 'inner')
  };
}

export function computeBonusHits(summary = {}) {
  const rows = Array.isArray(summary?.rows) ? summary.rows : [];
  const month = summary?.month || nowMonthKey();
  const quarter = summary?.quarter || nowQuarterKey();
  const hits = [];

  for (const r of rows) {
    if (r?.productionBonusTier?.unlocked && Number(r?.productionBonusTier?.payout || 0) > 0) {
      hits.push({
        key: `${month}|${r.agent}|production_percent|${PRODUCTION_UNLOCK_SPONSORSHIP_APPROVALS}`,
        period: month,
        agent: r.agent,
        group: r.group,
        category: `Production Bonus (${Math.round(PRODUCTION_PERCENT * 100)}%)`,
        threshold: `${PRODUCTION_UNLOCK_SPONSORSHIP_APPROVALS} sponsorship policies approved/issued unlock`,
        payout: Number(r.productionBonusTier.payout || 0)
      });
    }

    if (r?.sponsorshipBonusTier) {
      hits.push({
        key: `${month}|${r.agent}|sponsorship|${r.sponsorshipBonusTier.threshold}`,
        period: month,
        agent: r.agent,
        group: r.group,
        category: 'Sponsorship Bonus',
        threshold: r.sponsorshipBonusTier.threshold,
        payout: Number(r.sponsorshipBonusTier.payout || 0)
      });
    }

    if (r?.communityBonusTier && Number(r.communityBonusTier.payout || 0) > 0) {
      hits.push({
        key: `${month}|${r.agent}|community|${r.communityBonusTier.threshold}`,
        period: month,
        agent: r.agent,
        group: r.group,
        category: 'Community Impact Bonus',
        threshold: r.communityBonusTier.threshold,
        payout: Number(r.communityBonusTier.payout || 0)
      });
    }

    if (r?.quarterTierHit) {
      hits.push({
        key: `${quarter}|${r.agent}|quarter|${r.quarterTierHit.label}`,
        period: quarter,
        agent: r.agent,
        group: r.group,
        category: `${r.quarterTierHit.label} Quarterly Bonus`,
        threshold: `${r.quarterTierHit.ap}/${r.quarterTierHit.sponsorshipPolicies}/${r.quarterTierHit.serviceHours}`,
        payout: Number(r.quarterTierHit.payout || 0)
      });
    }
  }

  return hits;
}
