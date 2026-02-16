'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

const LEADERBOARD_URL =
  'https://legacylink.app/functions/innerCircleWebhookLeaderboardPublic?key=21689754egt41fadto56216ma444god';
const REVENUE_URL =
  'https://legacylink.app/functions/openClawRevenueData?key=21689754egt41fadto56216ma444god';

const AGENTS = [
  'Kimora Link',
  'Jamal Holmes',
  'Mahogany Burns',
  'Leticia Wright',
  'Kelin Brown',
  'Madalyn Adams'
];

const BADGE_RULES = [
  { id: 'sponsor-5', label: 'Sponsorship Starter', metric: 'referrals', threshold: 5, tier: 'bronze' },
  { id: 'sponsor-15', label: 'Sponsorship Closer', metric: 'referrals', threshold: 15, tier: 'silver' },
  { id: 'sponsor-30', label: 'Sponsorship Elite', metric: 'referrals', threshold: 30, tier: 'gold' },
  { id: 'policy-5', label: 'Policy Producer', metric: 'apps', threshold: 5, tier: 'bronze' },
  { id: 'policy-20', label: 'Policy Performer', metric: 'apps', threshold: 20, tier: 'silver' },
  { id: 'policy-50', label: 'Policy Titan', metric: 'apps', threshold: 50, tier: 'gold' },
  { id: 'club-10', label: '$10K Club', metric: 'revenue', threshold: 10000, tier: 'silver' },
  { id: 'club-20', label: '$20K Club', metric: 'revenue', threshold: 20000, tier: 'gold' },
  { id: 'club-50', label: '$50K Club', metric: 'revenue', threshold: 50000, tier: 'black' },
  { id: 'club-100', label: 'Six-Figure Club', metric: 'revenue', threshold: 100000, tier: 'black' }
];

function normalizeRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
}

function resolveMetric(rule, stats) {
  if (rule.metric === 'referrals') return stats.referrals;
  if (rule.metric === 'apps') return stats.apps;
  if (rule.metric === 'revenue') return stats.revenue;
  return stats.score;
}

export default function BadgesPage() {
  const [rows, setRows] = useState([]);
  const [revenueRows, setRevenueRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const [leaderboardResponse, revenueResponse] = await Promise.all([
          fetch(LEADERBOARD_URL, { cache: 'no-store' }),
          fetch(REVENUE_URL, { cache: 'no-store' })
        ]);

        if (leaderboardResponse.ok) {
          const leaderboardData = await leaderboardResponse.json();
          if (mounted) setRows(normalizeRows(leaderboardData));
        }

        if (revenueResponse.ok) {
          const revenueData = await revenueResponse.json();
          if (mounted) setRevenueRows(normalizeRows(revenueData));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const members = useMemo(() => {
    return AGENTS.map((name) => {
      const activityMatch = rows.find((r) => r.agent_name === name || r.agentName === name || r.name === name);
      const revenueMatch = revenueRows.find((r) => r.agent_name === name || r.agentName === name || r.name === name);

      const referrals = Number(activityMatch?.referral_count ?? activityMatch?.referrals ?? 0) || 0;
      const apps = Number(activityMatch?.app_submitted_count ?? activityMatch?.apps_submitted ?? activityMatch?.apps ?? 0) || 0;
      const score = referrals + apps;

      const revenue =
        Number(
          revenueMatch?.revenue ??
            revenueMatch?.total_revenue ??
            revenueMatch?.commission ??
            revenueMatch?.amount ??
            revenueMatch?.premium ??
            0
        ) || 0;

      const badges = BADGE_RULES.map((rule) => {
        const current = resolveMetric(rule, { referrals, apps, score, revenue });
        const unlocked = current >= rule.threshold;
        return {
          ...rule,
          unlocked,
          progress: Math.min(100, Math.round((current / rule.threshold) * 100))
        };
      });

      return {
        name,
        referrals,
        apps,
        score,
        revenue,
        unlockedCount: badges.filter((b) => b.unlocked).length,
        badges
      };
    }).sort((a, b) => b.unlockedCount - a.unlockedCount || b.revenue - a.revenue || b.score - a.score);
  }, [rows, revenueRows]);

  return (
    <AppShell title="Badges">
      <div className="panel">
        <div className="panelRow">
          <h3>Badge Economy (Live)</h3>
          <span className="muted">Production + Revenue data connected</span>
        </div>
      </div>

      {loading ? <div className="panel"><p>Loading badge progress…</p></div> : null}

      <div className="badgeWall">
        {members.map((member) => (
          <div className="panel" key={member.name}>
            <div className="panelRow">
              <h3>{member.name}</h3>
              <span className="pill onpace">{member.unlockedCount} unlocked</span>
            </div>
            <p className="muted">
              Referrals: {member.referrals} • Apps: {member.apps} • Revenue: {money(member.revenue)}
            </p>

            <div className="badgeGrid">
              {member.badges.map((badge) => (
                <div key={`${member.name}-${badge.id}`} className={`badgeCard ${badge.unlocked ? 'unlocked' : 'locked'} tier-${badge.tier}`}>
                  <strong>{badge.label}</strong>
                  <small>
                    {badge.metric} ≥ {badge.metric === 'revenue' ? money(badge.threshold) : badge.threshold}
                  </small>
                  <div className="progressWrap">
                    <div className="progressBar" style={{ width: `${badge.progress}%` }} />
                  </div>
                  <span className="muted">{badge.unlocked ? 'Unlocked' : `${badge.progress}%`}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
