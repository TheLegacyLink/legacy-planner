'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

const LEADERBOARD_URL =
  'https://legacylink.app/functions/innerCircleWebhookLeaderboardPublic?key=21689754egt41fadto56216ma444god';
const REVENUE_URL =
  'https://legacylink.app/functions/openClawRevenueData?key=21689754egt41fadto56216ma444god';

const defaultAgents = [
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

export default function SettingsPage() {
  const [timezone, setTimezone] = useState('America/Chicago');
  const [refreshInterval, setRefreshInterval] = useState('60');
  const [onPaceThreshold, setOnPaceThreshold] = useState('1');
  const [leaderboardUrl, setLeaderboardUrl] = useState(LEADERBOARD_URL);
  const [agents, setAgents] = useState(defaultAgents);
  const [newAgent, setNewAgent] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const [healthLoading, setHealthLoading] = useState(false);
  const [healthUpdatedAt, setHealthUpdatedAt] = useState('');
  const [health, setHealth] = useState({
    leaderboard: { ok: false, status: 'Not checked', rows: 0 },
    revenue: { ok: false, status: 'Not checked', rows: 0 },
    mismatches: []
  });

  const addAgent = (event) => {
    event.preventDefault();
    const name = newAgent.trim();
    if (!name || agents.includes(name)) return;
    setAgents((prev) => [...prev, name]);
    setNewAgent('');
  };

  const removeAgent = (name) => {
    setAgents((prev) => prev.filter((agent) => agent !== name));
  };

  const saveSettings = () => {
    setSaveMessage(`Saved at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`);
  };

  const runHealthCheck = async () => {
    setHealthLoading(true);

    try {
      const [leaderboardRes, revenueRes] = await Promise.all([
        fetch(leaderboardUrl, { cache: 'no-store' }),
        fetch(REVENUE_URL, { cache: 'no-store' })
      ]);

      const leaderboardJson = leaderboardRes.ok ? await leaderboardRes.json() : null;
      const revenueJson = revenueRes.ok ? await revenueRes.json() : null;

      const leaderboardRows = normalizeRows(leaderboardJson);
      const revenueRows = normalizeRows(revenueJson);

      const leaderboardNames = new Set(
        leaderboardRows.map((r) => cleanName(r.agent_name ?? r.agentName ?? r.name)).filter(Boolean)
      );
      const revenueNames = new Set(
        revenueRows.map((r) => cleanName(r.agent_name ?? r.agentName ?? r.name)).filter(Boolean)
      );

      const mismatches = agents.filter((agent) => {
        const key = cleanName(agent);
        return !leaderboardNames.has(key) && !revenueNames.has(key);
      });

      setHealth({
        leaderboard: {
          ok: leaderboardRes.ok,
          status: leaderboardRes.ok ? `HTTP ${leaderboardRes.status}` : `HTTP ${leaderboardRes.status}`,
          rows: leaderboardRows.length
        },
        revenue: {
          ok: revenueRes.ok,
          status: revenueRes.ok ? `HTTP ${revenueRes.status}` : `HTTP ${revenueRes.status}`,
          rows: revenueRows.length
        },
        mismatches
      });

      setHealthUpdatedAt(
        new Date().toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
      );
    } catch {
      setHealth((prev) => ({
        ...prev,
        leaderboard: { ...prev.leaderboard, ok: false, status: 'Request failed' },
        revenue: { ...prev.revenue, ok: false, status: 'Request failed' }
      }));
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  const healthy = useMemo(() => health.leaderboard.ok && health.revenue.ok, [health]);

  return (
    <AppShell title="Settings">
      <div className="split">
        <div className="panel">
          <div className="panelRow">
            <h3>Data Source Configuration</h3>
            <span className="muted">Controls for Mission Control and Scoreboard sync</span>
          </div>

          <div className="settingsGrid">
            <label>
              Timezone
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
              </select>
            </label>

            <label>
              Refresh Interval (seconds)
              <input
                type="number"
                min="15"
                step="15"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(e.target.value)}
              />
            </label>

            <label>
              On Pace Threshold (activity count)
              <input
                type="number"
                min="1"
                value={onPaceThreshold}
                onChange={(e) => setOnPaceThreshold(e.target.value)}
              />
            </label>

            <label>
              Base44 Leaderboard Endpoint
              <input value={leaderboardUrl} onChange={(e) => setLeaderboardUrl(e.target.value)} />
            </label>
          </div>

          <div className="rowActions">
            <button onClick={saveSettings}>Save Settings</button>
            <button className="ghost" onClick={runHealthCheck}>
              {healthLoading ? 'Running Health Check…' : 'Run Health Check'}
            </button>
          </div>
          {saveMessage ? <p className="muted">{saveMessage}</p> : null}
        </div>

        <div className="panel">
          <div className="panelRow">
            <h3>Data Health</h3>
            <span className={`pill ${healthy ? 'onpace' : 'offpace'}`}>{healthy ? 'Healthy' : 'Needs Attention'}</span>
          </div>

          <div className="healthGrid">
            <div className="healthRow">
              <strong>Leaderboard</strong>
              <span className={`pill ${health.leaderboard.ok ? 'onpace' : 'offpace'}`}>{health.leaderboard.status}</span>
              <small>{health.leaderboard.rows} rows</small>
            </div>
            <div className="healthRow">
              <strong>Revenue</strong>
              <span className={`pill ${health.revenue.ok ? 'onpace' : 'offpace'}`}>{health.revenue.status}</span>
              <small>{health.revenue.rows} rows</small>
            </div>
            <div className="healthRow">
              <strong>Roster Mismatches</strong>
              <span className={`pill ${health.mismatches.length ? 'offpace' : 'onpace'}`}>
                {health.mismatches.length ? `${health.mismatches.length} missing` : '0 missing'}
              </span>
              <small>{healthUpdatedAt ? `Last check: ${healthUpdatedAt}` : 'No checks yet'}</small>
            </div>
          </div>

          {health.mismatches.length ? (
            <ul className="checklist">
              {health.mismatches.map((name) => (
                <li key={name}>
                  <span>{name}</span>
                  <small>Not found in leaderboard or revenue feed</small>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="panel">
        <div className="panelRow">
          <h3>Status Rules</h3>
          <span className="pill onpace">Active Rule</span>
        </div>
        <ul className="checklist">
          <li>
            <span>On Pace</span>
            <small>Any activity today (referral or app submitted)</small>
          </li>
          <li>
            <span>Off Pace</span>
            <small>No activity today</small>
          </li>
        </ul>
      </div>

      <div className="panel">
        <div className="panelRow">
          <h3>Inner Circle Team Roster</h3>
          <span className="muted">These names drive Mission Control + Scoreboard filters</span>
        </div>

        <ul className="roster">
          {agents.map((agent) => (
            <li key={agent}>
              <span>{agent}</span>
              <button className="ghost" onClick={() => removeAgent(agent)}>
                Remove
              </button>
            </li>
          ))}
        </ul>

        <form className="inlineForm" onSubmit={addAgent}>
          <input
            placeholder="Add new agent"
            value={newAgent}
            onChange={(e) => setNewAgent(e.target.value)}
          />
          <button type="submit">Add Agent</button>
        </form>
      </div>
    </AppShell>
  );
}
