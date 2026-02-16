'use client';

import { useState } from 'react';
import AppShell from '../../components/AppShell';

const defaultAgents = [
  'Kimora Link',
  'Jamal Holmes',
  'Mahogany Burns',
  'Leticia Wright',
  'Kelin Brown',
  'Madalyn Adams'
];

export default function SettingsPage() {
  const [timezone, setTimezone] = useState('America/Chicago');
  const [refreshInterval, setRefreshInterval] = useState('60');
  const [onPaceThreshold, setOnPaceThreshold] = useState('1');
  const [leaderboardUrl, setLeaderboardUrl] = useState(
    'https://legacylink.app/functions/innerCircleWebhookLeaderboardPublic?key=••••••••••••'
  );
  const [agents, setAgents] = useState(defaultAgents);
  const [newAgent, setNewAgent] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

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
    // UI save state only for now (next pass can persist in DB/env config)
    setSaveMessage(`Saved at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`);
  };

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
            <button className="ghost">Test Connection</button>
          </div>
          {saveMessage ? <p className="muted">{saveMessage}</p> : null}
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
