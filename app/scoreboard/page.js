'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { loadRuntimeConfig } from '../../lib/runtimeConfig';

const DEFAULTS = loadRuntimeConfig();

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
  const [config, setConfig] = useState(DEFAULTS);
  const [rows, setRows] = useState([]);
  const [revenueRows, setRevenueRows] = useState([]);

  useEffect(() => {
    setConfig(loadRuntimeConfig());
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [leaderboardRes, revenueRes] = await Promise.all([
          fetch(config.leaderboardUrl, { cache: 'no-store' }),
          fetch(config.revenueUrl, { cache: 'no-store' })
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
    const interval = setInterval(load, Math.max(15, Number(config.refreshIntervalSec || 60)) * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [config.leaderboardUrl, config.revenueUrl, config.refreshIntervalSec]);

  const ranked = useMemo(() => {
    const list = config.agents.map((name) => {
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
  }, [rows, revenueRows, config.agents]);

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
