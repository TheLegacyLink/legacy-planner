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
  const [isDirty, setIsDirty] = useState(false);
  const [settings, setSettings] = useState(null);
  const [counts, setCounts] = useState({});
  const [recent, setRecent] = useState([]);

  async function load() {
    const res = await fetch('/api/lead-router', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      if (!isDirty) setSettings(data.settings);
      setCounts(data.counts || {});
      setRecent(data.recent || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
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
      setIsDirty(false);
    } finally {
      setSaving(false);
    }
  }

  const agentRows = useMemo(() => settings?.agents || [], [settings]);

  async function saveOutboundSettings() {
    await savePatch({
      outboundWebhookUrl: settings?.outboundWebhookUrl || '',
      outboundToken: settings?.outboundToken || '',
      outboundEnabled: Boolean(settings?.outboundEnabled)
    });
  }

  async function saveAgentLimits() {
    await savePatch({ agents: settings?.agents || [] });
  }

  const summary = useMemo(() => {
    const totalAssigned = (recent || []).length;
    const submitted = (recent || []).filter((r) => String(r?.sponsorshipStatus || '').trim() !== '').length;
    const approved = (recent || []).filter((r) => String(r?.sponsorshipStatus || '').toLowerCase().includes('approved')).length;
    const submitRate = totalAssigned ? Math.round((submitted / totalAssigned) * 100) : 0;
    const approveRate = totalAssigned ? Math.round((approved / totalAssigned) * 100) : 0;

    const byAgent = {};
    for (const r of recent || []) {
      const a = r?.assignedTo || 'Unassigned';
      byAgent[a] = (byAgent[a] || 0) + 1;
    }

    return { totalAssigned, submitted, approved, submitRate, approveRate, byAgent };
  }, [recent]);

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
          Default Day Cap
          <input
            type="number"
            value={settings.maxPerDay}
            min={0}
            onChange={(e) => {
              setSettings((s) => ({ ...s, maxPerDay: Number(e.target.value || 0) }));
              setIsDirty(true);
            }}
            onBlur={() => savePatch({ maxPerDay: Number(settings.maxPerDay || 0) })}
            style={{ marginLeft: 6, width: 80 }}
          />
        </label>

        <label>
          Default Week Cap
          <input
            type="number"
            value={settings.maxPerWeek}
            min={0}
            onChange={(e) => {
              setSettings((s) => ({ ...s, maxPerWeek: Number(e.target.value || 0) }));
              setIsDirty(true);
            }}
            onBlur={() => savePatch({ maxPerWeek: Number(settings.maxPerWeek || 0) })}
            style={{ marginLeft: 6, width: 90 }}
          />
        </label>

        <label>
          Default Month Cap
          <input
            type="number"
            value={settings.maxPerMonth}
            min={0}
            onChange={(e) => {
              setSettings((s) => ({ ...s, maxPerMonth: Number(e.target.value || 0) }));
              setIsDirty(true);
            }}
            onBlur={() => savePatch({ maxPerMonth: Number(settings.maxPerMonth || 0) })}
            style={{ marginLeft: 6, width: 100 }}
          />
        </label>

        <label>
          Overflow
          <select
            value={settings.overflowAgent}
            onChange={(e) => {
              const value = e.target.value;
              setSettings((s) => ({ ...s, overflowAgent: value }));
              setIsDirty(true);
              savePatch({ overflowAgent: value });
            }}
            style={{ marginLeft: 6 }}
          >
            {agentRows.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
          </select>
        </label>

        <button type="button" className="ghost" onClick={() => savePatch(settings)} disabled={saving}>
          Save All
        </button>
      </div>

      <div className="panel" style={{ marginBottom: 10 }}>
        <h3 style={{ marginTop: 0 }}>GHL Alert Webhook (Option A)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 120px auto', gap: 8, alignItems: 'center' }}>
          <input
            placeholder="Outbound webhook URL (to GHL workflow trigger)"
            value={settings.outboundWebhookUrl || ''}
            onChange={(e) => {
              setSettings((s) => ({ ...s, outboundWebhookUrl: e.target.value }));
              setIsDirty(true);
            }}
          />
          <input
            placeholder="x-router-token (optional)"
            value={settings.outboundToken || ''}
            onChange={(e) => {
              setSettings((s) => ({ ...s, outboundToken: e.target.value }));
              setIsDirty(true);
            }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={Boolean(settings.outboundEnabled)}
              onChange={(e) => {
                const value = e.target.checked;
                setSettings((s) => ({ ...s, outboundEnabled: value }));
                setIsDirty(true);
              }}
            />
            Alerts On
          </label>
          <button type="button" onClick={saveOutboundSettings} disabled={saving}>Save URL</button>
        </div>
        <small className="muted">After editing URL/token/toggle, click <strong>Save URL</strong>.</small>
      </div>

      <div className="panel">
        <div className="panelRow" style={{ marginBottom: 8 }}>
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>Agent Limits & Windows (CST)</h3>
          <button type="button" onClick={saveAgentLimits} disabled={saving}>Save Limits</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Today</th>
              <th>Week</th>
              <th>Month</th>
              <th>Paused</th>
              <th>Start</th>
              <th>End</th>
              <th>Day Cap</th>
              <th>Week Cap</th>
              <th>Month Cap</th>
            </tr>
          </thead>
          <tbody>
            {agentRows.map((a) => {
              const c = counts[a.name] || { today: 0, week: 0, month: 0 };
              return (
                <tr key={a.name}>
                  <td>{a.name}</td>
                  <td><span className="pill">{c.today}</span></td>
                  <td><span className="pill">{c.week}</span></td>
                  <td><span className="pill">{c.month}</span></td>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(a.paused)}
                      onChange={(e) => {
                        const agents = agentRows.map((x) => x.name === a.name ? { ...x, paused: e.target.checked } : x);
                        setSettings((s) => ({ ...s, agents }));
                        setIsDirty(true);
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
                        setIsDirty(true);
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
                        setIsDirty(true);
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
                        setIsDirty(true);
                      }}
                      style={{ width: 90 }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      placeholder="default"
                      value={a.capPerWeek ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const agents = agentRows.map((x) => x.name === a.name ? { ...x, capPerWeek: v === '' ? null : Number(v) } : x);
                        setSettings((s) => ({ ...s, agents }));
                        setIsDirty(true);
                      }}
                      style={{ width: 95 }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      placeholder="default"
                      value={a.capPerMonth ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const agents = agentRows.map((x) => x.name === a.name ? { ...x, capPerMonth: v === '' ? null : Number(v) } : x);
                        setSettings((s) => ({ ...s, agents }));
                        setIsDirty(true);
                      }}
                      style={{ width: 105 }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginBottom: 10 }}>
        <h3 style={{ marginTop: 0 }}>Lead Performance Snapshot</h3>
        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="pill">Total Assigned: {summary.totalAssigned}</span>
          <span className="pill">Form Submitted: {summary.submitted} ({summary.submitRate}%)</span>
          <span className="pill onpace">Approved: {summary.approved} ({summary.approveRate}%)</span>
        </div>
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
          {Object.entries(summary.byAgent).map(([name, qty]) => (
            <div key={name} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
              <div className="muted" style={{ fontSize: 12 }}>{name}</div>
              <strong>{qty} leads</strong>
            </div>
          ))}
        </div>
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
