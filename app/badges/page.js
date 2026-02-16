'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

const LEADERBOARD_URL =
  'https://legacylink.app/functions/innerCircleWebhookLeaderboardPublic?key=21689754egt41fadto56216ma444god';

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
  { id: 'club-10', label: '$10K Club', metric: 'score', threshold: 10, tier: 'silver' },
  { id: 'club-20', label: '$20K Club', metric: 'score', threshold: 20, tier: 'gold' },
  { id: 'club-50', label: '$50K Club', metric: 'score', threshold: 50, tier: 'black' },
  { id: 'club-100', label: 'Six-Figure Club', metric: 'score', threshold: 100, tier: 'black' }
];

function normalizeRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function resolveMetric(rule, stats) {
  if (rule.metric === 'referrals') return stats.referrals;
  if (rule.metric === 'apps') return stats.apps;
  return stats.score;
}

export default function BadgesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch(LEADERBOARD_URL, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (mounted) setRows(normalizeRows(data));
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
      const match = rows.find((r) => r.agent_name === name || r.agentName === name || r.name === name);
      const referrals = Number(match?.referral_count ?? match?.referrals ?? 0) || 0;
      const apps = Number(match?.app_submitted_count ?? match?.apps_submitted ?? match?.apps ?? 0) || 0;
      const score = referrals + apps;

      const badges = BADGE_RULES.map((rule) => {
        const current = resolveMetric(rule, { referrals, apps, score });
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
        unlockedCount: badges.filter((b) => b.unlocked).length,
        badges
      };
    }).sort((a, b) => b.unlockedCount - a.unlockedCount || b.score - a.score);
  }, [rows]);

  return (
    <AppShell title="Badges">
      <div className="panel">
        <div className="panelRow">
          <h3>Badge Economy (Live Prototype)</h3>
          <span className="muted">Using current Base44 leaderboard data</span>
        </div>
        <p className="muted">
          Revenue club badges are currently mapped to total activity score until payout data is wired.
        </p>
      </div>

      {loading ? <div className="panel"><p>Loading badge progress…</p></div> : null}

      <div className="badgeWall">
        {members.map((member) => (
          <div className="panel" key={member.name}>
            <div className="panelRow">
              <h3>{member.name}</h3>
              <span className="pill onpace">{member.unlockedCount} unlocked</span>
            </div>
            <p className="muted">Referrals: {member.referrals} • Apps: {member.apps} • Score: {member.score}</p>

            <div className="badgeGrid">
              {member.badges.map((badge) => (
                <div key={`${member.name}-${badge.id}`} className={`badgeCard ${badge.unlocked ? 'unlocked' : 'locked'} tier-${badge.tier}`}>
                  <strong>{badge.label}</strong>
                  <small>{badge.metric} ≥ {badge.threshold}</small>
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
