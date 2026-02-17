export const COMP_ENGINE_KEY = 'legacy-planner-competition-engine-v1';

export function loadCompetitionState() {
  if (typeof window === 'undefined') return { weeklyWinners: [], monthlyMostImproved: [], monthSnapshots: {} };
  try {
    const raw = localStorage.getItem(COMP_ENGINE_KEY);
    if (!raw) return { weeklyWinners: [], monthlyMostImproved: [], monthSnapshots: {} };
    const parsed = JSON.parse(raw);
    return {
      weeklyWinners: Array.isArray(parsed?.weeklyWinners) ? parsed.weeklyWinners : [],
      monthlyMostImproved: Array.isArray(parsed?.monthlyMostImproved) ? parsed.monthlyMostImproved : [],
      monthSnapshots: parsed?.monthSnapshots && typeof parsed.monthSnapshots === 'object' ? parsed.monthSnapshots : {}
    };
  } catch {
    return { weeklyWinners: [], monthlyMostImproved: [], monthSnapshots: {} };
  }
}

export function saveCompetitionState(state) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COMP_ENGINE_KEY, JSON.stringify(state));
}

export function weekKey(date = new Date()) {
  const d = new Date(date);
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const diff = d - firstThursday;
  const week = 1 + Math.round(diff / 604800000);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function monthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
