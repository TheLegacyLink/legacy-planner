export const MONTHLY_WINNERS_KEY = 'legacy-planner-monthly-winners-v1';

export function loadMonthlyWinners() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MONTHLY_WINNERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMonthlyWinners(items) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MONTHLY_WINNERS_KEY, JSON.stringify(items));
}

export function currentMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
