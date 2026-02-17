'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { loadRuntimeConfig } from '../../lib/runtimeConfig';
import { applyReferralCorrections, loadReferralCorrections } from '../../lib/referralCorrections';
import { currentMonthKey, loadMonthlyWinners, saveMonthlyWinners } from '../../lib/monthlyWinners';

const DEFAULTS = loadRuntimeConfig();
const POINTS = { referral: 1, app: 4 };

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

function byScope(obj, scope, aliases = []) {
  const prefix = scope === 'monthly' ? 'month' : scope === 'ytd' ? 'ytd' : 'all_time';
  for (const name of aliases) {
    const candidates = [
      `${name}_${prefix}`,
      `${name}${prefix === 'all_time' ? 'AllTime' : prefix === 'ytd' ? 'Ytd' : 'Month'}`,
      `${scope}_${name}`
    ];
    for (const key of candidates) {
      if (obj?.[key] != null) return Number(obj[key]) || 0;
    }
  }
  return null;
}

export default function ScoreboardPage() {
  const [config, setConfig] = useState(DEFAULTS);
  const [rows, setRows] = useState([]);
  const [revenueRows, setRevenueRows] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [scope, setScope] = useState('monthly');
  const [view, setView] = useState('leaderboard');
  const [winners, setWinners] = useState([]);
  const [winnerMsg, setWinnerMsg] = useState('');

  useEffect(() => {
    setConfig(loadRuntimeConfig());
    setCorrections(loadReferralCorrections());
    setWinners(loadMonthlyWinners());
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
        // silent fail
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
    const baseReferralsByAgent = {};

    config.agents.forEach((name) => {
      const match = rows.find((r) => cleanName(r.agent_name ?? r.agentName ?? r.name) === cleanName(name));
      const revenueMatch = revenueRows.find((r) => cleanName(r.agent_name ?? r.agentName ?? r.name) === cleanName(name));

      const scopedReferrals = byScope(match, scope, ['referral_count', 'referrals']);
      const defaultReferrals = Number(match?.referral_count ?? match?.referrals ?? 0) || 0;
      const referralsFromLeaderboard = scopedReferrals ?? defaultReferrals;
      const referralsFromApprovals = Number(revenueMatch?.activity_bonus ?? 0) || 0;
      baseReferralsByAgent[name] = Math.max(referralsFromLeaderboard, referralsFromApprovals);
    });

    const adjustedReferralsByAgent = applyReferralCorrections(baseReferralsByAgent, corrections);

    const list = config.agents.map((name) => {
      const match = rows.find((r) => cleanName(r.agent_name ?? r.agentName ?? r.name) === cleanName(name));
      const referrals = Number(adjustedReferralsByAgent[name] || 0);
      const scopedApps = byScope(match, scope, ['app_submitted_count', 'apps_submitted', 'apps']);
      const baseApps = Number(match?.app_submitted_count ?? match?.apps_submitted ?? match?.apps ?? 0) || 0;
      const apps = scopedApps ?? baseApps;
      const score = referrals * POINTS.referral + apps * POINTS.app;
      return { name, referrals, apps, score };
    });

    return list.sort((a, b) => b.score - a.score || b.apps - a.apps || b.referrals - a.referrals);
  }, [rows, revenueRows, config.agents, corrections, scope]);

  const leader = ranked[0];

  const closeCurrentMonth = () => {
    if (!leader) return;
    const month = currentMonthKey();
    const next = [
      {
        month,
        winner: leader.name,
        points: leader.score,
        referrals: leader.referrals,
        apps: leader.apps,
        createdAt: new Date().toISOString(),
        rewardModel: 'C'
      },
      ...winners.filter((w) => w.month !== month)
    ];
    setWinners(next);
    saveMonthlyWinners(next);
    setWinnerMsg(`Saved Agent of the Month for ${month}: ${leader.name}`);
  };

  return (
    <AppShell title="Scoreboard">
      <div className="panel">
        <div className="panelRow">
          <h3>Inner Circle Score System</h3>
          <span className="muted">Points: Referral = 1 • App Submitted = 4</span>
        </div>

        <div className="leaderboardTabs">
          <button className={view === 'leaderboard' ? 'active' : ''} onClick={() => setView('leaderboard')}>Leaderboard</button>
          <button className={view === 'hall' ? 'active' : ''} onClick={() => setView('hall')}>Hall of Fame</button>
        </div>

        {view === 'leaderboard' ? (
          <>
            <div className="leaderboardTabs">
              <button className={scope === 'monthly' ? 'active' : ''} onClick={() => setScope('monthly')}>Monthly</button>
              <button className={scope === 'ytd' ? 'active' : ''} onClick={() => setScope('ytd')}>YTD</button>
              <button className={scope === 'all_time' ? 'active' : ''} onClick={() => setScope('all_time')}>All-Time</button>
            </div>

            {leader ? (
              <p className="muted">👑 {scope === 'monthly' ? 'Agent of the Month' : 'Current Leader'}: <strong>{leader.name}</strong></p>
            ) : null}

            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Agent</th>
                  <th>Referrals</th>
                  <th>Apps</th>
                  <th>Points</th>
                  <th>Recognition</th>
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
                    <td>{scope === 'monthly' && index === 0 ? <span className="pill onpace">Agent of the Month</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="rowActions" style={{ marginTop: 10 }}>
              <button onClick={closeCurrentMonth}>Close Current Month Winner</button>
              {winnerMsg ? <span className="muted">{winnerMsg}</span> : null}
            </div>
          </>
        ) : (
          <>
            <p className="muted">Monthly winner ledger. Reward Model C: $300 + 7-day lead priority + spotlight.</p>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Winner</th>
                  <th>Points</th>
                  <th>Referrals</th>
                  <th>Apps</th>
                  <th>Reward Model</th>
                </tr>
              </thead>
              <tbody>
                {winners.length ? winners.map((w) => (
                  <tr key={w.month}>
                    <td>{w.month}</td>
                    <td>{w.winner}</td>
                    <td>{w.points}</td>
                    <td>{w.referrals}</td>
                    <td>{w.apps}</td>
                    <td>{w.rewardModel}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6}>No winners saved yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </AppShell>
  );
}
