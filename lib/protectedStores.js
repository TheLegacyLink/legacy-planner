/**
 * PROTECTED STORES — DO NOT PURGE
 *
 * These blob store paths contain revenue-critical or customer-facing data.
 * ANY blob cleanup script MUST check this list and skip these paths.
 *
 * Purging these stores will directly impact:
 *   - Store products being wiped → customers can't buy → lost revenue
 *   - Sponsorship applications being lost → lost agent data
 *   - Policy submissions being lost → lost commission records
 *   - Inner Circle members being lost → broken logins
 */
export const PROTECTED_STORE_PREFIXES = [
  'stores/store-products.json',           // REVENUE — legacy link store products
  'stores/sponsorship-applications.json', // REVENUE — agent sponsorship apps
  'stores/policy-submissions.json',       // REVENUE — insurance policy records
  'stores/sponsorship-bookings.json',     // REVENUE — booking records
  'stores/inner-circle-hub-members.json', // AUTH — member accounts
  'stores/agent-onboarding.json',         // AGENT DATA — onboarding records
  'stores/unlicensed-backoffice-progress.json', // AGENT DATA — onboarding steps
  'stores/licensed-onboarding-tracker.json',    // AGENT DATA — tracker progress
  'stores/contract-signatures.json',      // LEGAL — signed contracts
];

/**
 * Check if a blob pathname is protected.
 * @param {string} pathname
 * @returns {boolean}
 */
export function isProtectedStore(pathname = '') {
  return PROTECTED_STORE_PREFIXES.some(prefix => String(pathname || '').startsWith(prefix));
}
