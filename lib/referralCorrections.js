export const REFERRAL_CORRECTIONS_KEY = 'legacy-planner-referral-corrections-v1';

export function loadReferralCorrections() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REFERRAL_CORRECTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReferralCorrections(corrections) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REFERRAL_CORRECTIONS_KEY, JSON.stringify(corrections));
}

export function applyReferralCorrections(baseReferralsByAgent, corrections) {
  const next = { ...baseReferralsByAgent };

  for (const correction of corrections || []) {
    if (!correction?.fromAgent || !correction?.toAgent) continue;
    const count = Math.max(0, Number(correction.count || 0));
    if (count <= 0) continue;

    next[correction.fromAgent] = Math.max(0, Number(next[correction.fromAgent] || 0) - count);
    next[correction.toAgent] = Number(next[correction.toAgent] || 0) + count;
  }

  return next;
}
