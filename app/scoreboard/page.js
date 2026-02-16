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

function normalizeRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

export default function ScoreboardPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const response = await fetch(LEADERBOARD_URL, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (mounted) setRows(normalizeRows(data));
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
      const match = rows.find((r) => r.agent_name === name || r.agentName === name || r.name === name);
      const referrals = Number(match?.referral_count ?? match?.referrals ?? 0) || 0;
      const apps = Number(match?.app_submitted_count ?? match?.apps_submitted ?? match?.apps ?? 0) || 0;
      return {
        name,
        referrals,
        apps,
        score: referrals + apps
      };
    });

    return list.sort((a, b) => b.score - a.score);
  }, [rows]);

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
