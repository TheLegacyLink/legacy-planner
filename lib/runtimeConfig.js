export const CONFIG_STORAGE_KEY = 'legacy-planner-runtime-config-v1';

export const DEFAULT_CONFIG = {
  timezone: 'America/Chicago',
  refreshIntervalSec: 60,
  onPaceThreshold: 1,
  leaderboardUrl: '/api/metrics/inner-circle-leaderboard',
  revenueUrl: '/api/metrics/revenue',
  sponsorshipTrackerUrl:
    'https://docs.google.com/spreadsheets/d/123FyOP10FMJtYYy2HE9M9RrY7ariQ5ayMsfPvEcaPVY/gviz/tq?tqx=out:json&gid=839080285',
  agents: [
    'Kimora Link',
    'Jamal Holmes',
    'Mahogany Burns',
    'Leticia Wright',
    'Kelin Brown',
    'Madalyn Adams',
    'Breanna James',
    'Donyell Richardson',
    'Shannon Maxwell',
    'Angelique Lassiter'
  ],
  policyRescue: {
    readUrl: '',
    writeUrl: '',
    passcode: 'LegacyLink216'
  },
  booking: {
    timezone: 'America/New_York',
    leadTimeHours: 48,
    startHour: 9,
    endHour: 21,
    webhookUrl: '',
    licensingByState: {}
  }
};

function normalizeAgents(agents = []) {
  const aliasMap = {
    'latricia wright': 'Leticia Wright',
    'leticia wright': 'Leticia Wright',
    'letitia wright': 'Leticia Wright',
    'dr breanna james': 'Breanna James',
    'dr. breanna james': 'Breanna James',
    'brianna james': 'Breanna James',
    'kellen brown': 'Kelin Brown',
    'madeline adams': 'Madalyn Adams',
    'danielle': 'Donyell Richardson',
    'danielle richardson': 'Donyell Richardson',
    'donyell': 'Donyell Richardson',
    'angelica lassiter': 'Angelique Lassiter',
    'angelic lassiter': 'Angelique Lassiter'
  };

  const seen = new Set();
  const out = [];

  for (const raw of agents) {
    const key = String(raw || '').trim();
    if (!key) continue;
    const normalized = aliasMap[key.toLowerCase()] || key;
    if (normalized.toLowerCase() === 'andrea cannon') continue;
    if (seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    out.push(normalized);
  }

  return out;
}

export function loadRuntimeConfig() {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);

    // Migrate away from legacy cloud function endpoints that can hard-fail and blank dashboards.
    if (String(parsed?.leaderboardUrl || '').includes('innerCircleWebhookLeaderboardPublic')) {
      parsed.leaderboardUrl = DEFAULT_CONFIG.leaderboardUrl;
    }
    if (String(parsed?.revenueUrl || '').includes('openClawRevenueData')) {
      parsed.revenueUrl = DEFAULT_CONFIG.revenueUrl;
    }

    const parsedAgents = Array.isArray(parsed?.agents) && parsed.agents.length ? parsed.agents : [];
    const mergedAgents = normalizeAgents([...DEFAULT_CONFIG.agents, ...parsedAgents]);

    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      agents: mergedAgents,
      policyRescue: {
        ...DEFAULT_CONFIG.policyRescue,
        ...(parsed?.policyRescue || {})
      },
      booking: {
        ...DEFAULT_CONFIG.booking,
        ...(parsed?.booking || {})
      }
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveRuntimeConfig(config) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}
