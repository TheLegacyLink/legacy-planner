'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { loadRuntimeConfig } from '../../lib/runtimeConfig';

const DEFAULTS = loadRuntimeConfig();

function cleanName(value = '') {
  return String(value).toLowerCase().replace('dr. ', '').trim();
}

function toLocalTime(iso, timezone) {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
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

function getStatus(referrals, apps) {
  return referrals + apps >= 1 ? 'On Pace' : 'Off Pace';
}

export default function MissionControl() {
  const [config, setConfig] = useState(DEFAULTS);
  const [rows, setRows] = useState([]);
  const [revenueRows, setRevenueRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setConfig(loadRuntimeConfig());
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [leaderboardRes, revenueRes] = await Promise.all([
          fetch(config.leaderboardUrl, { cache: 'no-store' }),
          fetch(config.revenueUrl, { cache: 'no-store' })
        ]);

        if (!leaderboardRes.ok) throw new Error(`Leaderboard HTTP ${leaderboardRes.status}`);

        const leaderboardJson = await leaderboardRes.json();
        const revenueJson = revenueRes.ok ? await revenueRes.json() : null;

        if (!mounted) return;
        setRows(normalizeRows(leaderboardJson));
        setRevenueRows(normalizeRows(revenueJson));
      } catch (err) {
        if (!mounted) return;
        setError(`Could not load sync data (${err.message}).`);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, Math.max(15, Number(config.refreshIntervalSec || 60)) * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [config.leaderboardUrl, config.revenueUrl, config.refreshIntervalSec]);

  const team = useMemo(() => {
    return config.agents.map((agent) => {
      const match = rows.find((r) => cleanName(r.agent_name ?? r.agentName ?? r.name) === cleanName(agent));
      const revenueMatch = revenueRows.find((r) => cleanName(r.agent_name ?? r.agentName ?? r.name) === cleanName(agent));

      const leaderboardReferrals =
        Number(match?.referral_count ?? match?.referrals ?? (match?.event_type === 'referral' ? 1 : 0) ?? 0) || 0;
      const fallbackReferrals = Number(revenueMatch?.activity_bonus ?? 0) || 0;
      const referrals = Math.max(leaderboardReferrals, fallbackReferrals);

      const apps =
        Number(match?.app_submitted_count ?? match?.apps_submitted ?? match?.apps ?? (match?.event_type === 'app_submitted' ? 1 : 0) ?? 0) || 0;

      const lastActivity = match?.last_activity ?? match?.lastActivity ?? match?.created_date ?? match?.timestamp ?? null;

      return {
        name: agent,
        referrals,
        apps,
        lastActivity,
        status: getStatus(referrals, apps)
      };
    });
  }, [rows, revenueRows, config.agents]);

  const totals = useMemo(
    () =>
      team.reduce(
        (acc, row) => ({
          referrals: acc.referrals + row.referrals,
          apps: acc.apps + row.apps,
          active: acc.active + (row.referrals + row.apps >= 1 ? 1 : 0)
        }),
        { referrals: 0, apps: 0, active: 0 }
      ),
    [team]
  );

  return (
    <AppShell title="Mission Control">
      <div className="grid4">
        <div className="card">
          <p>Sponsorship Referrals (Today)</p>
          <h2>{totals.referrals}</h2>
          <span className="pill onpace">Live sync (Leaderboard + approvals fallback)</span>
        </div>
        <div className="card">
          <p>Apps Submitted (Today)</p>
          <h2>{totals.apps}</h2>
          <span className="pill onpace">Live from Base44</span>
        </div>
        <div className="card">
          <p>Agents Active Today</p>
          <h2>{totals.active}/{config.agents.length}</h2>
          <span className={`pill ${totals.active >= 1 ? 'onpace' : 'offpace'}`}>{totals.active >= 1 ? 'On Pace' : 'Off Pace'}</span>
        </div>
        <div className="card">
          <p>Data Refresh</p>
          <h2>{loading ? 'Syncing…' : 'Live'}</h2>
          <span className={`pill ${error ? 'offpace' : 'onpace'}`}>{error ? 'Attention' : 'Connected'}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panelRow">
          <h3>Inner Circle Scoreboard</h3>
          <span className="muted">Status rule: any activity today = On Pace</span>
        </div>

        {error ? <p className="red">{error}</p> : null}

        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Referrals</th>
              <th>Apps Submitted</th>
              <th>Last Activity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {team.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.referrals}</td>
                <td>{row.apps}</td>
                <td>{toLocalTime(row.lastActivity, config.timezone)}</td>
                <td>
                  <span className={`pill ${row.status === 'On Pace' ? 'onpace' : 'offpace'}`}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
