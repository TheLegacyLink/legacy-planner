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
  'Madalyn Adams',
  'Breanna James'
];

function cleanName(value = '') {
  return String(value).toLowerCase().replace('dr. ', '').trim();
}

function normalizeRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.leaders)) return payload.leaders;
  if (Array.isArray(payload.revenue_data)) return payload.revenue_data;
  return [];
}

export default function ScoreboardPage() {
  const [rows, setRows] = useState([]);
  const [revenueRows, setRevenueRows] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [leaderboardRes, revenueRes] = await Promise.all([
          fetch(LEADERBOARD_URL, { cache: 'no-store' }),
          fetch(REVENUE_URL, { cache: 'no-store' })
        ]);

        if (leaderboardRes.ok) {
          const data = await leaderboardRes.json();
          if (mounted) setRows(normalizeRows(data));
        }

        if (revenueRes.ok) {
          const data = await revenueRes.json();
          if (mounted) setRevenueRows(normalizeRows(data));
        }
      } catch {
        // silent fail for now
      }
    }

    load();
    const interval = setInterval(load, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const ranked = useMemo(() => {
    const list = AGENTS.map((name) => {
      const match = rows.find((r) => cleanName(r.agent_name ?? r.agentName ?? r.name) === cleanName(name));
      const revenueMatch = revenueRows.find((r) => cleanName(r.agent_name ?? r.agentName ?? r.name) === cleanName(name));

      const referralsFromLeaderboard = Number(match?.referral_count ?? match?.referrals ?? 0) || 0;
      const referralsFromApprovals = Number(revenueMatch?.activity_bonus ?? 0) || 0;
      const referrals = Math.max(referralsFromLeaderboard, referralsFromApprovals);

      const apps = Number(match?.app_submitted_count ?? match?.apps_submitted ?? match?.apps ?? 0) || 0;

      return {
        name,
        referrals,
        apps,
        score: referrals + apps
      };
    });

    return list.sort((a, b) => b.score - a.score);
  }, [rows, revenueRows]);

  return (
    <AppShell title="Scoreboard">
      <div className="panel">
        <div className="panelRow">
          <h3>Inner Circle Leaderboard</h3>
          <span className="muted">Score = referrals + apps submitted</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Agent</th>
              <th>Referrals</th>
              <th>Apps</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row, index) => (
              <tr key={row.name}>
                <td>#{index + 1}</td>
                <td>{row.name}</td>
                <td>{row.referrals}</td>
                <td>{row.apps}</td>
                <td><strong>{row.score}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
