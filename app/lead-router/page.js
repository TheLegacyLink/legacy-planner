'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function LeadRouterPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [counts, setCounts] = useState({});
  const [recent, setRecent] = useState([]);

  async function load() {
    const res = await fetch('/api/lead-router', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      setSettings(data.settings);
      setCounts(data.counts || {});
      setRecent(data.recent || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  async function savePatch(patch) {
    setSaving(true);
    try {
      const res = await fetch('/api/lead-router', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        alert(`Save failed: ${data?.error || 'unknown_error'}`);
        return;
      }
      setSettings(data.settings);
    } finally {
      setSaving(false);
    }
  }

  const agentRows = useMemo(() => settings?.agents || [], [settings]);

  if (loading || !settings) {
    return <AppShell title="Lead Router Control"><p className="muted">Loading router control…</p></AppShell>;
  }

  return (
    <AppShell title="Lead Router Control">
      <div className="panelRow" style={{ marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          style={settings.enabled ? { background: '#166534', color: '#fff' } : { background: '#7f1d1d', color: '#fff' }}
          onClick={() => savePatch({ enabled: !settings.enabled })}
          disabled={saving}
        >
          Router: {settings.enabled ? 'ON' : 'OFF'}
        </button>
        <label>
          Max/day
          <input
            type="number"
            value={settings.maxPerDay}
            min={0}
            onChange={(e) => setSettings((s) => ({ ...s, maxPerDay: Number(e.target.value || 0) }))}
            onBlur={() => savePatch({ maxPerDay: Number(settings.maxPerDay || 0) })}
            style={{ marginLeft: 6, width: 80 }}
          />
        </label>
        <label>
          Overflow
          <select
            value={settings.overflowAgent}
            onChange={(e) => {
              const value = e.target.value;
              setSettings((s) => ({ ...s, overflowAgent: value }));
              savePatch({ overflowAgent: value });
            }}
            style={{ marginLeft: 6 }}
          >
            {agentRows.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
          </select>
        </label>
        <span className="muted">Reset: 12:00 AM CST • Mode: Random</span>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Agent Limits & Windows (CST)</h3>
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Today</th>
              <th>Paused</th>
              <th>Start</th>
              <th>End</th>
              <th>Cap Override</th>
            </tr>
          </thead>
          <tbody>
            {agentRows.map((a) => (
              <tr key={a.name}>
                <td>{a.name}</td>
                <td><span className="pill">{counts[a.name] || 0}</span></td>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(a.paused)}
                    onChange={(e) => {
                      const agents = agentRows.map((x) => x.name === a.name ? { ...x, paused: e.target.checked } : x);
                      setSettings((s) => ({ ...s, agents }));
                      savePatch({ agents });
                    }}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    value={a.windowStart || '09:00'}
                    onChange={(e) => {
                      const agents = agentRows.map((x) => x.name === a.name ? { ...x, windowStart: e.target.value } : x);
                      setSettings((s) => ({ ...s, agents }));
                      savePatch({ agents });
                    }}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    value={a.windowEnd || '21:00'}
                    onChange={(e) => {
                      const agents = agentRows.map((x) => x.name === a.name ? { ...x, windowEnd: e.target.value } : x);
                      setSettings((s) => ({ ...s, agents }));
                      savePatch({ agents });
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    placeholder="default"
                    value={a.capPerDay ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const agents = agentRows.map((x) => x.name === a.name ? { ...x, capPerDay: v === '' ? null : Number(v) } : x);
                      setSettings((s) => ({ ...s, agents }));
                      savePatch({ agents });
                    }}
                    style={{ width: 90 }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Inbound Leads + Assignment Log</h3>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Lead</th>
              <th>Assigned To</th>
              <th>Reason</th>
              <th>Sponsorship</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id}>
                <td>{fmt(r.timestamp)}</td>
                <td>
                  <div>{r.name || '—'}</div>
                  <small className="muted">{r.email || r.phone || '—'}</small>
                </td>
                <td>{r.assignedTo || '—'}</td>
                <td>{r.reason || '—'}</td>
                <td>{r.sponsorshipStatus || '—'}</td>
              </tr>
            ))}
            {!recent.length ? <tr><td colSpan={5} className="muted">No assignments yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
