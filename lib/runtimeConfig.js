export const CONFIG_STORAGE_KEY = 'legacy-planner-runtime-config-v1';

export const DEFAULT_CONFIG = {
  timezone: 'America/Chicago',
  refreshIntervalSec: 60,
  onPaceThreshold: 1,
  leaderboardUrl:
    'https://legacylink.app/functions/innerCircleWebhookLeaderboardPublic?key=21689754egt41fadto56216ma444god',
  revenueUrl:
    'https://legacylink.app/functions/openClawRevenueData?key=21689754egt41fadto56216ma444god',
  sponsorshipTrackerUrl:
    'https://docs.google.com/spreadsheets/d/123FyOP10FMJtYYy2HE9M9RrY7ariQ5ayMsfPvEcaPVY/gviz/tq?tqx=out:json&gid=839080285',
  agents: [
    'Kimora Link',
    'Jamal Holmes',
    'Mahogany Burns',
    'Leticia Wright',
    'Kelin Brown',
    'Madalyn Adams',
    'Breanna James'
  ],
  policyRescue: {
    readUrl: '',
    writeUrl: '',
    passcode: 'legacylink'
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

export function loadRuntimeConfig() {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      agents: Array.isArray(parsed?.agents) && parsed.agents.length ? parsed.agents : DEFAULT_CONFIG.agents,
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
