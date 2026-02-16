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

function toChicagoTime(iso) {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function normalizeRows(payload) {
  // Supports both: [{agent_name, referral_count, app_submitted_count, last_activity}] and wrapped shapes.
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.leaders)) return payload.leaders;
  return [];
}

function getStatus(referrals, apps) {
  // Per user instruction: any activity = On Pace
  return referrals + apps >= 1 ? 'On Pace' : 'Off Pace';
}

export default function MissionControl() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(LEADERBOARD_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (!mounted) return;
        setRows(normalizeRows(json));
      } catch (err) {
        if (!mounted) return;
        setError(`Could not load Base44 leaderboard (${err.message}).`);
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

  const team = useMemo(() => {
    return AGENTS.map((agent) => {
      const match = rows.find(
        (r) =>
          r.agent_name === agent ||
          r.agentName === agent ||
          r.name === agent
      );

      const referrals = Number(
        match?.referral_count ?? match?.referrals ?? (match?.event_type === 'referral' ? 1 : 0) ?? 0
      ) || 0;

      const apps = Number(
        match?.app_submitted_count ?? match?.apps_submitted ?? match?.apps ?? (match?.event_type === 'app_submitted' ? 1 : 0) ?? 0
      ) || 0;

      const lastActivity =
        match?.last_activity ??
        match?.lastActivity ??
        match?.created_date ??
        match?.timestamp ??
        null;

      return {
        name: agent,
        referrals,
        apps,
        lastActivity,
        status: getStatus(referrals, apps)
      };
    });
  }, [rows]);

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
          <span className="pill onpace">Live from Base44</span>
        </div>
        <div className="card">
          <p>Apps Submitted (Today)</p>
          <h2>{totals.apps}</h2>
          <span className="pill onpace">Live from Base44</span>
        </div>
        <div className="card">
          <p>Agents Active Today</p>
          <h2>{totals.active}/{AGENTS.length}</h2>
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
                <td>{toChicagoTime(row.lastActivity)}</td>
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
