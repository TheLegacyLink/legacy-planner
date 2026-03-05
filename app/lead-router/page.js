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
  const [releaseRun, setReleaseRun] = useState({});
  const [delayedQueue, setDelayedQueue] = useState([]);
  const [weekUnsubmittedLeads, setWeekUnsubmittedLeads] = useState([]);
  const [bulkTargetAgent, setBulkTargetAgent] = useState('');
  const [ghlSyncSummary, setGhlSyncSummary] = useState({ total: 0, success: 0, failed: 0, recentFailures: [] });

  async function load() {
    const res = await fetch('/api/lead-router?runRelease=1', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      if (!isDirty) setSettings(data.settings);
      setCounts(data.counts || {});
      setRecent(data.recent || []);
      setTomorrowStartOrder(data.tomorrowStartOrder || []);
      setCallMetrics(data.callMetrics || { totals: {}, byOwner: [] });
      setCalledLeadRows(data.calledLeadRows || []);
      setReleaseRun(data.releaseRun || {});
      setDelayedQueue(data.delayedQueue || []);
      setWeekUnsubmittedLeads(data.weekUnsubmittedLeads || []);
      setGhlSyncSummary(data.ghlSyncSummary || { total: 0, success: 0, failed: 0, recentFailures: [] });
      if (!bulkTargetAgent) setBulkTargetAgent((data.settings?.overflowAgent || data.settings?.agents?.[0]?.name || ''));
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

  async function saveRoutingSettings() {
    await savePatch({
      enabled: Boolean(settings?.enabled),
      routingMode: settings?.routingMode || 'live',
      delayedReleaseHours: Number(settings?.delayedReleaseHours || 24)
    });
  }

  async function saveAgentLimits() {
    await savePatch({ agents: settings?.agents || [] });
  }

  async function setManualHold(leadId, hold) {
    const res = await fetch('/api/lead-router', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'set-manual-hold', leadId, hold })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      alert(`Manual hold update failed: ${data?.error || 'unknown_error'}`);
      return;
    }
    await load();
  }

  async function bulkReleaseWeekUnsubmitted(strategy = 'auto') {
    const payload = {
      mode: 'bulk-release-week-unsubmitted',
      strategy
    };
    if (strategy === 'agent') payload.targetAgent = bulkTargetAgent;

    const res = await fetch('/api/lead-router', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      alert(`Bulk release failed: ${data?.error || 'unknown_error'}`);
      return;
    }

    alert(`Bulk release complete. Updated leads: ${data?.updated ?? 0}`);
    await load();
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
          Agent Routing
          <select
            value={settings.routingMode || 'live'}
            onChange={(e) => {
              setSettings((s) => ({ ...s, routingMode: e.target.value }));
              setIsDirty(true);
            }}
            style={{ marginLeft: 6 }}
          >
            <option value="live">Live (instant)</option>
            <option value="delayed24h">Delayed (hold before release)</option>
          </select>
        </label>

        {settings.routingMode === 'delayed24h' ? (
          <label>
            Hold Hours
            <input
              type="number"
              min={1}
              value={settings.delayedReleaseHours ?? 24}
              onChange={(e) => {
                setSettings((s) => ({ ...s, delayedReleaseHours: Number(e.target.value || 24) }));
                setIsDirty(true);
              }}
              style={{ marginLeft: 6, width: 80 }}
            />
          </label>
        ) : null}

        <button type="button" className="ghost" onClick={saveRoutingSettings} disabled={saving}>
          Save Routing
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
        <h3 style={{ marginTop: 0 }}>Delayed Release Monitor</h3>
        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="pill">Released now: {releaseRun?.released ?? 0}</span>
          <span className="pill">Waiting window: {releaseRun?.waitingWindow ?? 0}</span>
          <span className="pill">Waiting eligible agent: {releaseRun?.waitingEligibleAgent ?? 0}</span>
          <span className="pill">Manual hold: {releaseRun?.blockedManualHold ?? 0}</span>
          <span className="pill">Submitted/blocked: {releaseRun?.blockedSubmitted ?? 0}</span>
        </div>
        <small className="muted">Delayed mode rule: lead stays owner-only until hold window expires. At/after the hold time, if no form submission and not manual hold, it routes to the next eligible active agent.</small>
      </div>

      <div className="panel" style={{ marginBottom: 10 }}>
        <h3 style={{ marginTop: 0 }}>GHL Owner Sync Health</h3>
        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="pill">Total sync attempts: {ghlSyncSummary?.total ?? 0}</span>
          <span className="pill onpace">Success: {ghlSyncSummary?.success ?? 0}</span>
          <span className="pill atrisk">Failed: {ghlSyncSummary?.failed ?? 0}</span>
        </div>
        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Lead</th>
              <th>Assigned To</th>
              <th>Reason</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {(ghlSyncSummary?.recentFailures || []).map((f, idx) => (
              <tr key={`${f.timestamp}-${f.externalId || f.leadId || idx}`}>
                <td>{fmt(f.timestamp)}</td>
                <td>{f.externalId || f.leadId || '—'}</td>
                <td>{f.assignedTo || '—'}</td>
                <td>{f.reason || 'sync_failed'}</td>
                <td style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.detail || '—'}</td>
              </tr>
            ))}
            {!(ghlSyncSummary?.recentFailures || []).length ? <tr><td colSpan={5} className="muted">No recent GHL owner sync failures.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginBottom: 10 }}>
        <h3 style={{ marginTop: 0 }}>Delayed Queue (Pre-Release Leads)</h3>
        <table>
          <thead>
            <tr>
              <th>Lead</th>
              <th>Owner</th>
              <th>Release At</th>
              <th>Status</th>
              <th>Manual Hold</th>
            </tr>
          </thead>
          <tbody>
            {(delayedQueue || []).map((r) => (
              <tr key={r.id}>
                <td>
                  <div>{displayLeadName(r)}</div>
                  <small className="muted">{r.email || r.phone || '—'}</small>
                </td>
                <td>{r.owner || '—'}</td>
                <td>{fmt(r.releaseEligibleAt)}</td>
                <td>{r.releaseStatus || 'owner_window'}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(r.manualHold)}
                    onChange={(e) => setManualHold(r.id, e.target.checked)}
                  />
                </td>
              </tr>
            ))}
            {!(delayedQueue || []).length ? <tr><td colSpan={5} className="muted">No delayed leads waiting right now.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginBottom: 10 }}>
        <h3 style={{ marginTop: 0 }}>This Week: Unsubmitted Leads</h3>
        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <span className="pill">Unsubmitted this week: {weekUnsubmittedLeads.length}</span>
          <button type="button" onClick={() => bulkReleaseWeekUnsubmitted('auto')} disabled={!weekUnsubmittedLeads.length}>Auto-Assign Release (Balanced)</button>
          <label>
            Assign All To
            <select
              value={bulkTargetAgent}
              onChange={(e) => setBulkTargetAgent(e.target.value)}
              style={{ marginLeft: 6 }}
            >
              {(settings?.agents || []).map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
            </select>
          </label>
          <button type="button" className="ghost" onClick={() => bulkReleaseWeekUnsubmitted('agent')} disabled={!weekUnsubmittedLeads.length || !bulkTargetAgent}>Assign All To Selected Agent</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Lead</th>
              <th>Current Owner</th>
              <th>Created</th>
              <th>Stage</th>
              <th>Release Status</th>
              <th>Manual Hold</th>
            </tr>
          </thead>
          <tbody>
            {(weekUnsubmittedLeads || []).slice(0, 250).map((r) => (
              <tr key={r.id}>
                <td>
                  <div>{displayLeadName(r)}</div>
                  <small className="muted">{r.email || r.phone || '—'}</small>
                </td>
                <td>{r.owner || '—'}</td>
                <td>{fmt(r.createdAt)}</td>
                <td>{r.stage || 'New'}</td>
                <td>{r.releaseStatus || '—'}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(r.manualHold)}
                    onChange={(e) => setManualHold(r.id, e.target.checked)}
                  />
                </td>
              </tr>
            ))}
            {!(weekUnsubmittedLeads || []).length ? <tr><td colSpan={6} className="muted">No unsubmitted leads found this week.</td></tr> : null}
          </tbody>
        </table>
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
                        // Persist pause/unpause immediately so refresh cannot revert it.
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
        <h3 style={{ marginTop: 0 }}>Call Activity (Outbound • Inner Circle only)</h3>
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
        <div className="panel" style={{ marginBottom: 10, borderColor: '#bfdbfe', background: '#f8fbff', color: '#0f172a' }}>
          <div className="panelRow" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0, color: '#0f172a' }}>
              {callDrilldown.mode === 'today' ? 'Called Today' : 'All Called'} — {callDrilldown.owner}
            </h3>
            <button type="button" className="ghost" onClick={() => setCallDrilldown(null)}>Close</button>
          </div>
          <table style={{ color: '#0f172a' }}>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Phone</th>
                <th>Called At</th>
                <th>Time to First Call</th>
                <th>Duration</th>
                <th>Result</th>
                <th>Recording</th>
              </tr>
            </thead>
            <tbody>
              {callDrilldownRows.map((row) => (
                <tr key={`${row.id}-${row.calledAt}`}>
                  <td>
                    <div style={{ color: '#0f172a', fontWeight: 700 }}>{displayLeadName(row)}</div>
                    <small style={{ color: '#475569' }}>{[row.email, 'Called'].filter(Boolean).join(' • ') || '—'}</small>
                  </td>
                  <td>{row.phone || '—'}</td>
                  <td>{fmt(row.calledAt)}</td>
                  <td>{row.timeToFirstCallMin != null ? `${row.timeToFirstCallMin} min` : '—'}</td>
                  <td>{secsToClock(row.lastCallDurationSec)}</td>
                  <td>{row.callResult || '—'}</td>
                  <td>
                    {row.lastCallRecordingUrl ? (
                      <a href={row.lastCallRecordingUrl} target="_blank" rel="noreferrer">Open</a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
              {!callDrilldownRows.length ? <tr><td colSpan={7} className="muted">No called leads found in this view yet.</td></tr> : null}
            </tbody>
          </table>
          <small style={{ color: '#475569' }}>Tip: recording links appear when the call source sends recordingUrl in activity events.</small>
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
