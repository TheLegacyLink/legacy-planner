// lib/eliteBonus.js
// ─── Elite Inner Circle Bonus Logic ─────────────────────────────────────────
//
// Manages two bonus types for Elite IC members:
//
//  1. Policy Referral Bonus ($1,000)
//     Handled in policy-payouts/page.js via CIRCLE_ELITE_AGENTS set.
//     No server-side logic needed — UI tier calculation covers it.
//
//  2. Team Sponsorship Bonus ($150)
//     When any member of an Elite IC agent's downline brings in a new
//     sponsorship applicant → the Elite IC member earns $150.
//     Fired by sponsorship-applications route on each new submission.
//     Logged to stores/elite-bonuses.json.
//
// Effective dates are enforced per member. No retroactive bonuses.

import { loadJsonStore, saveJsonStore } from './blobJsonStore';

const TEAM_HIERARCHY_PATH = 'stores/team-hierarchy.json';
const ELITE_BONUSES_PATH  = 'stores/elite-bonuses.json';

// ─── Elite IC Member Config ──────────────────────────────────────────────────
// Add or update members here when their status changes.
// parentKey must match personKey(name, email) used in team-hierarchy:
//   email-based  → "em:<email_lowercase>"
//   name-based   → "nm:<normalized_name>"
const ELITE_IC_MEMBERS = [
  {
    name:                   'Leticia Wright',
    email:                  'Leticia@thelegacylink.com',
    parentKey:              'em:Leticia@thelegacylink.com',
    effectiveFrom:          '2026-06-01',   // paid / activated date
    teamSponsorshipBonus:   150,            // per new sponsorship from downline
    // policyReferralBonus handled in policy-payouts/page.js (CIRCLE_ELITE_AGENTS, $1,000)
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function norm(v = '') {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function nowIso() {
  return new Date().toISOString();
}

function isOnOrAfterDate(effectiveFrom = '', eventDate = '') {
  const eff = new Date(effectiveFrom);
  const evt = new Date(eventDate || Date.now());
  if (isNaN(eff.getTime()) || isNaN(evt.getTime())) return false;
  return evt >= eff;
}

// Returns a Set of all childKey values that are descendants of rootKey
function buildDescendantKeys(rows = [], rootKey = '') {
  const byParent = new Map();
  for (const r of rows) {
    const p = String(r?.parentKey || '');
    if (!p) continue;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(r);
  }

  const descendants = new Set();
  const queue = [...(byParent.get(rootKey) || [])];
  while (queue.length) {
    const node = queue.shift();
    const ck = String(node?.childKey || '');
    if (!ck || descendants.has(ck)) continue;
    descendants.add(ck);
    const children = byParent.get(ck) || [];
    queue.push(...children);
  }
  return descendants;
}

// Returns true if any hierarchy row with childName === sponsorName
// has a childKey that is in the descendant set
function sponsorIsDescendant(rows = [], sponsorName = '', descendantKeys = new Set()) {
  if (!sponsorName || !descendantKeys.size) return false;
  const sn = norm(sponsorName);
  return rows.some(
    (r) => norm(r?.childName || '') === sn && descendantKeys.has(String(r?.childKey || ''))
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
/**
 * Called on every new sponsorship submission.
 * For each active Elite IC member whose downline contains the sponsor,
 * logs a $150 team sponsorship bonus entry.
 *
 * @param {object} opts
 * @param {string} opts.sponsorName       Display name of the sponsor (referrer)
 * @param {string} opts.applicantName     Full name of the new applicant
 * @param {string} opts.applicantEmail    Email of the new applicant
 * @param {string} opts.submittedAt       ISO timestamp of the submission
 * @returns {Promise<{ok: boolean, bonusFired: Array, bonusSkipped: Array}>}
 */
export async function checkAndFireTeamSponsorshipBonuses({
  sponsorName = '',
  applicantName = '',
  applicantEmail = '',
  submittedAt = '',
  bonusType = 'team_policy_referral_bonus',  // override per call site for clarity
  bonusReason = '',                          // optional reason override
} = {}) {
  if (!sponsorName) return { ok: false, reason: 'no_sponsor', bonusFired: [], bonusSkipped: [] };

  const eventDate  = submittedAt || nowIso();
  const bonusFired   = [];
  const bonusSkipped = [];

  // Load hierarchy once for all member checks
  const rawHierarchy = await loadJsonStore(TEAM_HIERARCHY_PATH, []);
  const hierarchyRows = Array.isArray(rawHierarchy) ? rawHierarchy : [];

  // Load bonus ledger once
  const rawBonuses = await loadJsonStore(ELITE_BONUSES_PATH, []);
  const bonusRows  = Array.isArray(rawBonuses) ? rawBonuses : [];

  let ledgerDirty = false;

  for (const member of ELITE_IC_MEMBERS) {
    // Enforce effective date
    if (!isOnOrAfterDate(member.effectiveFrom, eventDate)) {
      bonusSkipped.push({ member: member.name, reason: 'before_effective_date' });
      continue;
    }

    // Elite member cannot earn a bonus off their own referral
    if (norm(sponsorName) === norm(member.name)) {
      bonusSkipped.push({ member: member.name, reason: 'self_referral' });
      continue;
    }

    // Build the full downline of this elite member
    const descendants = buildDescendantKeys(hierarchyRows, member.parentKey);

    // Check if the sponsor is in that downline
    if (!sponsorIsDescendant(hierarchyRows, sponsorName, descendants)) {
      bonusSkipped.push({ member: member.name, reason: 'sponsor_not_in_downline' });
      continue;
    }

    // All checks passed — log the bonus
    const bonus = {
      id:             `eb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type:           bonusType,
      agent:          member.name,
      agentEmail:     member.email,
      amount:         member.teamSponsorshipBonus,
      triggeredBy:    sponsorName,         // the downline member who brought in the applicant
      applicantName,
      applicantEmail,
      reason:         bonusReason || `Policy referred by ${sponsorName} approved (FNG/NLG)`,
      status:         'Unpaid',
      eventDate,
      createdAt:      nowIso(),
      updatedAt:      nowIso(),
    };

    bonusRows.unshift(bonus);
    ledgerDirty = true;

    bonusFired.push({ member: member.name, amount: member.teamSponsorshipBonus, bonusId: bonus.id });
  }

  if (ledgerDirty) {
    await saveJsonStore(ELITE_BONUSES_PATH, bonusRows);
  }

  return { ok: true, bonusFired, bonusSkipped };
}
