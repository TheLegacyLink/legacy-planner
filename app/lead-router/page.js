'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function secsToClock(sec = 0) {
  const n = Number(sec || 0) || 0;
  if (n <= 0) return '—';
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function displayLeadName(row = {}) {
  const name = String(row?.name || '').trim();
  if (name && name.toLowerCase() !== 'unknown lead') return name;
  const email = String(row?.email || '').trim();
  if (email.includes('@')) return email.split('@')[0];
  return 'Unknown Lead';
}

function cstDayKey(iso = '') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(d);
}

export default function LeadRouterPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [settings, setSettings] = useState(null);
  const [counts, setCounts] = useState({});
  const [recent, setRecent] = useState([]);
  const [tomorrowStartOrder, setTomorrowStartOrder] = useState([]);
  const [callMetrics, setCallMetrics] = useState({ totals: {}, byOwner: [] });
  const [calledLeadRows, setCalledLeadRows] = useState([]);
  const [callDrilldown, setCallDrilldown] = useState(null);

  async function load() {
    const res = await fetch('/api/lead-router', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      if (!isDirty) setSettings(data.settings);
      setCounts(data.counts || {});
      setRecent(data.recent || []);
      setTomorrowStartOrder(data.tomorrowStartOrder || []);
      setCallMetrics(data.callMetrics || { totals: {}, byOwner: [] });
      setCalledLeadRows(data.calledLeadRows || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000); // every 5 minutes
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

  async function saveSlaSettings() {
    await savePatch({
      slaEnabled: Boolean(settings?.slaEnabled),
      slaMinutes: Number(settings?.slaMinutes || 10),
      slaAction: settings?.slaAction || 'reassign'
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

  const callDrilldownRows = useMemo(() => {
    if (!callDrilldown?.owner) return [];
    const todayKey = cstDayKey(new Date().toISOString());
    return (calledLeadRows || []).filter((r) => {
      if (r.owner !== callDrilldown.owner) return false;
      if (callDrilldown.mode === 'today') return cstDayKey(r.calledAt) === todayKey;
      return true;
    });
  }, [callDrilldown, calledLeadRows]);

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

      <div className="panel" style={{ marginBottom: 10 }}>
        <h3 style={{ marginTop: 0 }}>Speed-to-Lead SLA</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 160px 180px auto', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={Boolean(settings.slaEnabled)}
              onChange={(e) => {
                setSettings((s) => ({ ...s, slaEnabled: e.target.checked }));
                setIsDirty(true);
              }}
            />
            SLA On
          </label>
          <label>
            SLA Minutes
            <input
              type="number"
              min={1}
              value={settings.slaMinutes ?? 10}
              onChange={(e) => {
                setSettings((s) => ({ ...s, slaMinutes: Number(e.target.value || 10) }));
                setIsDirty(true);
              }}
              style={{ marginLeft: 6, width: 70 }}
            />
          </label>
          <label>
            Action
            <select
              value={settings.slaAction || 'reassign'}
              onChange={(e) => {
                setSettings((s) => ({ ...s, slaAction: e.target.value }));
                setIsDirty(true);
              }}
              style={{ marginLeft: 6 }}
            >
              <option value="reassign">Auto Reassign</option>
              <option value="alert">Alert Only</option>
            </select>
          </label>
          <button type="button" onClick={saveSlaSettings} disabled={saving}>Save SLA</button>
        </div>
        <small className="muted">When a new lead arrives, stale uncalled leads older than SLA minutes can be reassigned automatically.</small>
      </div>

      <div className="panel" style={{ marginBottom: 10 }}>
        <h3 style={{ marginTop: 0 }}>Tomorrow Start Order (Fairness Preview)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 }}>
          {tomorrowStartOrder.map((r, idx) => (
            <div key={r.name} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
              <div className="muted" style={{ fontSize: 12 }}>#{idx + 1}</div>
              <strong>{r.name}</strong>
              <div className="muted" style={{ fontSize: 12 }}>Today: {r.today} • Yesterday: {r.yesterday}</div>
            </div>
          ))}
          {!tomorrowStartOrder.length ? <div className="muted">No active agents.</div> : null}
        </div>
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
        <h3 style={{ marginTop: 0 }}>Call Activity (Form-submitted leads excluded)</h3>
        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="pill">Callable: {callMetrics?.totals?.callable ?? 0}</span>
          <span className="pill">Called: {callMetrics?.totals?.called ?? 0}</span>
          <span className="pill">Call Rate: {callMetrics?.totals?.callRate ?? 0}%</span>
          <span className="pill">Called Today: {callMetrics?.totals?.calledToday ?? 0}</span>
          <span className="pill atrisk">Uncalled: {callMetrics?.totals?.uncalled ?? 0}</span>
          <span className="pill">Avg First Call: {callMetrics?.totals?.avgFirstCallMinutes ?? '—'} min</span>
          <span className="pill">Avg Wait (Uncalled): {callMetrics?.totals?.avgWaitMinutes ?? '—'} min</span>
        </div>
        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Callable</th>
              <th>Called</th>
              <th>Call Rate</th>
              <th>Called Today</th>
              <th>Uncalled</th>
              <th>Avg First Call (min)</th>
              <th>Avg Wait (min)</th>
            </tr>
          </thead>
          <tbody>
            {(callMetrics?.byOwner || []).map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{r.callable}</td>
                <td>
                  <button type="button" className="ghost" onClick={() => setCallDrilldown({ owner: r.name, mode: 'all' })}>
                    {r.called}
                  </button>
                </td>
                <td>{r.callRate}%</td>
                <td>
                  <button type="button" className="ghost" onClick={() => setCallDrilldown({ owner: r.name, mode: 'today' })}>
                    {r.calledToday}
                  </button>
                </td>
                <td>{r.uncalled}</td>
                <td>{r.avgFirstCallMinutes ?? '—'}</td>
                <td>{r.avgWaitMinutes ?? '—'}</td>
              </tr>
            ))}
            {!(callMetrics?.byOwner || []).length ? <tr><td colSpan={8} className="muted">No call metrics yet.</td></tr> : null}
          </tbody>
        </table>
      </div>

      {callDrilldown ? (
        <div className="panel" style={{ marginBottom: 10, borderColor: '#bfdbfe', background: '#f8fbff' }}>
          <div className="panelRow" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>
              {callDrilldown.mode === 'today' ? 'Called Today' : 'All Called'} — {callDrilldown.owner}
            </h3>
            <button type="button" className="ghost" onClick={() => setCallDrilldown(null)}>Close</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Phone</th>
                <th>Called At</th>
                <th>Duration</th>
                <th>Result</th>
                <th>Recording</th>
              </tr>
            </thead>
            <tbody>
              {callDrilldownRows.map((row) => (
                <tr key={`${row.id}-${row.calledAt}`}>
                  <td>
                    <div>{displayLeadName(row)}</div>
                    <small className="muted">{[row.email, row.stage].filter(Boolean).join(' • ') || '—'}</small>
                  </td>
                  <td>{row.phone || '—'}</td>
                  <td>{fmt(row.calledAt)}</td>
                  <td>{secsToClock(row.lastCallDurationSec)}</td>
                  <td>{row.callResult || '—'}</td>
                  <td>
                    {row.lastCallRecordingUrl ? (
                      <a href={row.lastCallRecordingUrl} target="_blank" rel="noreferrer">Open</a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
              {!callDrilldownRows.length ? <tr><td colSpan={6} className="muted">No called leads found in this view yet.</td></tr> : null}
            </tbody>
          </table>
          <small className="muted">Tip: recording links appear when the call source sends recordingUrl in activity events.</small>
        </div>
      ) : null}

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
