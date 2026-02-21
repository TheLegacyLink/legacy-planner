'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import {
  DEFAULT_CONFIG,
  loadRuntimeConfig,
  saveRuntimeConfig
} from '../../lib/runtimeConfig';
import {
  loadReferralCorrections,
  saveReferralCorrections
} from '../../lib/referralCorrections';

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

function parseGvizRows(text) {
  const match = String(text || '').match(/setResponse\((.*)\);/s);
  if (!match) return [];
  const payload = JSON.parse(match[1]);
  return payload?.table?.rows || [];
}

export default function SettingsPage() {
  const [timezone, setTimezone] = useState(DEFAULT_CONFIG.timezone);
  const [refreshInterval, setRefreshInterval] = useState(String(DEFAULT_CONFIG.refreshIntervalSec));
  const [onPaceThreshold, setOnPaceThreshold] = useState(String(DEFAULT_CONFIG.onPaceThreshold));
  const [leaderboardUrl, setLeaderboardUrl] = useState(DEFAULT_CONFIG.leaderboardUrl);
  const [revenueUrl, setRevenueUrl] = useState(DEFAULT_CONFIG.revenueUrl);
  const [sponsorshipTrackerUrl, setSponsorshipTrackerUrl] = useState(DEFAULT_CONFIG.sponsorshipTrackerUrl || '');
  const [policyRescueReadUrl, setPolicyRescueReadUrl] = useState(DEFAULT_CONFIG.policyRescue.readUrl);
  const [policyRescueWriteUrl, setPolicyRescueWriteUrl] = useState(DEFAULT_CONFIG.policyRescue.writeUrl);
  const [policyRescuePasscode, setPolicyRescuePasscode] = useState(DEFAULT_CONFIG.policyRescue.passcode);
  const [agents, setAgents] = useState(DEFAULT_CONFIG.agents);
  const [newAgent, setNewAgent] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const [healthLoading, setHealthLoading] = useState(false);
  const [healthUpdatedAt, setHealthUpdatedAt] = useState('');
  const [health, setHealth] = useState({
    leaderboard: { ok: false, status: 'Not checked', rows: 0 },
    revenue: { ok: false, status: 'Not checked', rows: 0 },
    sponsorship: { ok: false, status: 'Not checked', rows: 0 },
    mismatches: []
  });

  const [corrections, setCorrections] = useState([]);
  const [fromAgent, setFromAgent] = useState(DEFAULT_CONFIG.agents[0]);
  const [toAgent, setToAgent] = useState(DEFAULT_CONFIG.agents[1]);
  const [correctionCount, setCorrectionCount] = useState('1');
  const [correctionReason, setCorrectionReason] = useState('Referral owner corrected after approval review');

  useEffect(() => {
    const cfg = loadRuntimeConfig();
    setTimezone(cfg.timezone);
    setRefreshInterval(String(cfg.refreshIntervalSec));
    setOnPaceThreshold(String(cfg.onPaceThreshold));
    setLeaderboardUrl(cfg.leaderboardUrl);
    setRevenueUrl(cfg.revenueUrl);
    setSponsorshipTrackerUrl(cfg.sponsorshipTrackerUrl || DEFAULT_CONFIG.sponsorshipTrackerUrl || '');
    setPolicyRescueReadUrl(cfg.policyRescue?.readUrl || '');
    setPolicyRescueWriteUrl(cfg.policyRescue?.writeUrl || '');
    setPolicyRescuePasscode(cfg.policyRescue?.passcode || 'legacylink');
    setAgents(cfg.agents);
    setFromAgent(cfg.agents[0] || '');
    setToAgent(cfg.agents[1] || cfg.agents[0] || '');
    setCorrections(loadReferralCorrections());
  }, []);

  const currentConfig = {
    timezone,
    refreshIntervalSec: Number(refreshInterval || 60),
    onPaceThreshold: Number(onPaceThreshold || 1),
    leaderboardUrl,
    revenueUrl,
    sponsorshipTrackerUrl,
    agents,
    policyRescue: {
      readUrl: policyRescueReadUrl,
      writeUrl: policyRescueWriteUrl,
      passcode: policyRescuePasscode || 'legacylink'
    }
  };

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
    saveRuntimeConfig(currentConfig);
    setSaveMessage(`Saved at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`);
  };

  const addCorrection = (event) => {
    event.preventDefault();
    const count = Math.max(1, Number(correctionCount || 1));
    if (!fromAgent || !toAgent || fromAgent === toAgent) return;

    const next = [
      {
        id: `${Date.now()}-${fromAgent}-${toAgent}`,
        fromAgent,
        toAgent,
        count,
        reason: correctionReason || 'Referral ownership correction',
        createdAt: new Date().toISOString()
      },
      ...corrections
    ];

    setCorrections(next);
    saveReferralCorrections(next);
    setCorrectionCount('1');
  };

  const removeCorrection = (id) => {
    const next = corrections.filter((item) => item.id !== id);
    setCorrections(next);
    saveReferralCorrections(next);
  };

  const runHealthCheck = useCallback(async () => {
    setHealthLoading(true);

    try {
      const [leaderboardRes, revenueRes, sponsorshipRes] = await Promise.all([
        fetch(leaderboardUrl, { cache: 'no-store' }),
        fetch(revenueUrl, { cache: 'no-store' }),
        fetch(sponsorshipTrackerUrl, { cache: 'no-store' })
      ]);

      const leaderboardJson = leaderboardRes.ok ? await leaderboardRes.json() : null;
      const revenueJson = revenueRes.ok ? await revenueRes.json() : null;
      const sponsorshipText = sponsorshipRes.ok ? await sponsorshipRes.text() : '';

      const leaderboardRows = normalizeRows(leaderboardJson);
      const revenueRows = normalizeRows(revenueJson);
      const sponsorshipRows = sponsorshipRes.ok ? parseGvizRows(sponsorshipText) : [];

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
          status: `HTTP ${leaderboardRes.status}`,
          rows: leaderboardRows.length
        },
        revenue: {
          ok: revenueRes.ok,
          status: `HTTP ${revenueRes.status}`,
          rows: revenueRows.length
        },
        sponsorship: {
          ok: sponsorshipRes.ok,
          status: `HTTP ${sponsorshipRes.status}`,
          rows: sponsorshipRows.length
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
        revenue: { ...prev.revenue, ok: false, status: 'Request failed' },
        sponsorship: { ...prev.sponsorship, ok: false, status: 'Request failed' }
      }));
    } finally {
      setHealthLoading(false);
    }
  }, [agents, leaderboardUrl, revenueUrl, sponsorshipTrackerUrl]);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  useEffect(() => {
    if (!agents.includes(fromAgent)) setFromAgent(agents[0] || '');
    if (!agents.includes(toAgent)) setToAgent(agents[1] || agents[0] || '');
  }, [agents, fromAgent, toAgent]);

  const healthy = useMemo(() => health.leaderboard.ok && health.revenue.ok && health.sponsorship.ok, [health]);

  return (
    <AppShell title="Settings">
      <div className="split">
        <div className="panel">
          <div className="panelRow">
            <h3>Data Source Configuration</h3>
            <span className="muted">Persistent runtime config (saved locally)</span>
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
              Leaderboard Endpoint
              <input value={leaderboardUrl} onChange={(e) => setLeaderboardUrl(e.target.value)} />
            </label>

            <label>
              Revenue Endpoint
              <input value={revenueUrl} onChange={(e) => setRevenueUrl(e.target.value)} />
            </label>

            <label>
              Sponsorship Tracker Endpoint (Google Sheet gviz)
              <input value={sponsorshipTrackerUrl} onChange={(e) => setSponsorshipTrackerUrl(e.target.value)} />
            </label>

            <label>
              Policy Rescue Read URL (Google Sheet/API)
              <input value={policyRescueReadUrl} onChange={(e) => setPolicyRescueReadUrl(e.target.value)} />
            </label>

            <label>
              Policy Rescue Write URL (Apps Script/API)
              <input value={policyRescueWriteUrl} onChange={(e) => setPolicyRescueWriteUrl(e.target.value)} />
            </label>

            <label>
              Policy Rescue Passcode
              <input value={policyRescuePasscode} onChange={(e) => setPolicyRescuePasscode(e.target.value)} />
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
              <strong>Sponsorship Tracker</strong>
              <span className={`pill ${health.sponsorship.ok ? 'onpace' : 'offpace'}`}>{health.sponsorship.status}</span>
              <small>{health.sponsorship.rows} rows</small>
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
          <h3>Referral Attribution Corrections</h3>
          <span className="muted">Retroactive ownership fixes (audit-safe ledger)</span>
        </div>

        <form className="settingsGrid" onSubmit={addCorrection}>
          <label>
            Move From
            <select value={fromAgent} onChange={(e) => setFromAgent(e.target.value)}>
              {agents.map((agent) => (
                <option key={agent} value={agent}>{agent}</option>
              ))}
            </select>
          </label>

          <label>
            Move To
            <select value={toAgent} onChange={(e) => setToAgent(e.target.value)}>
              {agents.map((agent) => (
                <option key={agent} value={agent}>{agent}</option>
              ))}
            </select>
          </label>

          <label>
            Referral Count
            <input type="number" min="1" value={correctionCount} onChange={(e) => setCorrectionCount(e.target.value)} />
          </label>

          <label>
            Reason
            <input value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} />
          </label>

          <div className="rowActions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit">Add Correction</button>
          </div>
        </form>

        {corrections.length ? (
          <ul className="roster">
            {corrections.map((item) => (
              <li key={item.id}>
                <span>
                  {item.fromAgent} → {item.toAgent} ({item.count}) • {item.reason}
                </span>
                <button className="ghost" onClick={() => removeCorrection(item.id)}>Remove</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No corrections logged yet.</p>
        )}
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
