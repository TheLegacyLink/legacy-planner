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

function clean(v = '') {
  return String(v || '').trim();
}

export default function LeadRouterPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
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
  const [weekReplyFilter, setWeekReplyFilter] = useState('all');
  const [distributionMonthScope, setDistributionMonthScope] = useState('current');
  const [distributionMonthKey, setDistributionMonthKey] = useState('');
  const [bulkTargetAgent, setBulkTargetAgent] = useState('');
  const [selectedWeekLeadIds, setSelectedWeekLeadIds] = useState([]);
  const [innerCircleNames, setInnerCircleNames] = useState([]);
  const [onboardingRows, setOnboardingRows] = useState([]);
  const [newAgent, setNewAgent] = useState({
    name: '',
    email: '',
    phone: '',
    ghlUserId: '',
    leadConnectorEmail: '',
    leadConnectorPassword: '',
    group: 'general',
    active: true,
    paused: false,
    delayedReleaseEnabled: true,
    capPerDay: '',
    capPerWeek: '',
    capPerMonth: ''
  });
  const [ghlSyncSummary, setGhlSyncSummary] = useState({ total: 0, success: 0, failed: 0, recentAttempts: [], recentFailures: [] });

  async function load() {
    const res = await fetch(`/api/lead-router?runRelease=1&distributionMonthScope=${encodeURIComponent(distributionMonthScope)}`, { cache: 'no-store' });
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
      const weekRows = data.weekUnsubmittedLeads || [];
      setWeekUnsubmittedLeads(weekRows);
      setDistributionMonthKey(String(data.distributionMonthKey || ''));
      if (data.distributionMonthScope) setDistributionMonthScope(data.distributionMonthScope);
      setSelectedWeekLeadIds((prev) => {
        const valid = new Set(weekRows.map((r) => r.id));
        return prev.filter((id) => valid.has(id));
      });
      setGhlSyncSummary(data.ghlSyncSummary || { total: 0, success: 0, failed: 0, recentAttempts: [], recentFailures: [] });
      if (!bulkTargetAgent) setBulkTargetAgent((data.settings?.overflowAgent || data.settings?.agents?.[0]?.name || ''));
    }

    const onboardRes = await fetch('/api/agent-onboarding', { cache: 'no-store' });
    const onboardData = await onboardRes.json().catch(() => ({}));
    if (onboardRes.ok && onboardData?.ok) {
      const rows = onboardData.rows || [];
      setOnboardingRows(rows);
      const innerNamesFromOnboarding = rows
        .filter((r) => String(r?.group || '').toLowerCase() === 'inner')
        .map((r) => String(r?.name || '').trim())
        .filter(Boolean);

      // Fallback: if onboarding data is incomplete, use router agent roster
      // so Inner Circle assignment controls still show the full team.
      const fallbackFromSettings = (data?.settings?.agents || [])
        .map((a) => String(a?.name || '').trim())
        .filter(Boolean);

      const merged = Array.from(new Set([...(innerNamesFromOnboarding || []), ...(fallbackFromSettings || [])]));
      setInnerCircleNames(merged);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000); // every 5 minutes
    return () => clearInterval(id);
  }, [distributionMonthScope]);

  async function savePatch(patch) {
    setSaving(true);
    setSaveMessage('Saving...');
    try {
      const res = await fetch('/api/lead-router', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        const msg = `Save failed: ${data?.error || 'unknown_error'}`;
        setSaveMessage(msg);
        alert(msg);
        return;
      }
      setSettings(data.settings);
      setIsDirty(false);
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(''), 1800);
    } finally {
      setSaving(false);
    }
  }

  const agentRows = useMemo(() => settings?.agents || [], [settings]);

  const innerCircleSet = useMemo(() => new Set((innerCircleNames || []).map((n) => String(n || '').trim().toLowerCase())), [innerCircleNames]);
  const innerCircleAgentRows = useMemo(() => agentRows.filter((a) => innerCircleSet.has(String(a?.name || '').trim().toLowerCase())), [agentRows, innerCircleSet]);
  const nonInnerCircleAgentRows = useMemo(() => agentRows.filter((a) => !innerCircleSet.has(String(a?.name || '').trim().toLowerCase())), [agentRows, innerCircleSet]);

  const tinyBtn = { padding: '5px 10px', fontSize: 12, lineHeight: 1.2, borderRadius: 8 };

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
      delayedReleaseEnabled: Boolean(settings?.delayedReleaseEnabled),
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

  async function setLeadReleaseMode(leadId, releaseMode) {
    const res = await fetch('/api/lead-router', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'set-lead-release-mode', leadId, releaseMode, holdHours: Number(settings?.delayedReleaseHours || 24) })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      alert(`Release mode update failed: ${data?.error || 'unknown_error'}`);
      return;
    }
    await load();
  }

  async function bulkReleaseWeekUnsubmitted(strategy = 'auto', onlySelected = false) {
    const payload = {
      mode: 'bulk-release-week-unsubmitted',
      strategy,
      distributionMonthScope
    };
    if (strategy === 'agent') payload.targetAgent = bulkTargetAgent;
    if (onlySelected) payload.leadIds = selectedWeekLeadIds;

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
    setSelectedWeekLeadIds([]);
    await load();
  }

  function toggleWeekLeadSelection(id) {
    setSelectedWeekLeadIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function selectAllWeekLeads() {
    const ids = (filteredWeekUnsubmittedLeads || []).slice(0, 250).map((r) => r.id).filter(Boolean);
    setSelectedWeekLeadIds(ids);
  }

  function clearWeekLeadSelection() {
    setSelectedWeekLeadIds([]);
  }

  async function saveNewAgent() {
    if (!newAgent.name.trim()) {
      alert('Agent name is required.');
      return;
    }

    const payload = {
      mode: 'upsert',
      ...newAgent
    };

    const res = await fetch('/api/agent-onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      alert(`Agent onboarding save failed: ${data?.error || 'unknown_error'}`);
      return;
    }

    setNewAgent((s) => ({ ...s, name: '', email: '', phone: '', ghlUserId: '', leadConnectorEmail: '', leadConnectorPassword: '' }));
    await load();
  }

  async function removeOnboardingAgent(name = '') {
    if (!name) return;
    if (!confirm(`Remove onboarding profile for ${name}?`)) return;

    const res = await fetch('/api/agent-onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'remove', name })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      alert(`Remove failed: ${data?.error || 'unknown_error'}`);
      return;
    }
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

  const distributionEligibleLeads = useMemo(() => {
    return (weekUnsubmittedLeads || []).filter((r) => {
      const owner = clean(r?.owner || '').toLowerCase();
      const isUnknownOwner = !owner || owner === 'unknown' || owner.includes('unknown');
      const isKimoraOwner = owner === 'kimora link';
      return !isUnknownOwner && isKimoraOwner;
    });
  }, [weekUnsubmittedLeads]);

  const weekReplyCounts = useMemo(() => {
    const all = weekUnsubmittedLeads || [];
    const replied = all.filter((r) => Boolean(r?.responded)).length;
    const submitted = all.filter((r) => Boolean(r?.submitted)).length;
    const booked = all.filter((r) => Boolean(r?.booked)).length;
    const prioritySponsorshipNotBooked = all.filter((r) => Boolean(r?.prioritySponsorshipNotBooked)).length;
    const unknownOwner = all.filter((r) => {
      const owner = clean(r?.owner || '').toLowerCase();
      return !owner || owner === 'unknown' || owner.includes('unknown');
    }).length;
    const nonKimoraOwner = all.filter((r) => {
      const owner = clean(r?.owner || '').toLowerCase();
      return owner && owner !== 'kimora link' && !owner.includes('unknown');
    }).length;
    return {
      total: all.length,
      replied,
      notReplied: all.length - replied,
      submitted,
      booked,
      prioritySponsorshipNotBooked,
      unknownOwner,
      nonKimoraOwner,
      eligible: distributionEligibleLeads.length
    };
  }, [weekUnsubmittedLeads, distributionEligibleLeads]);

  const filteredWeekUnsubmittedLeads = useMemo(() => {
    if (weekReplyFilter === 'not_replied') return distributionEligibleLeads.filter((r) => !Boolean(r?.responded));
    if (weekReplyFilter === 'priority_sponsorship_not_booked') return distributionEligibleLeads.filter((r) => Boolean(r?.prioritySponsorshipNotBooked));
    return distributionEligibleLeads;
  }, [distributionEligibleLeads, weekReplyFilter]);

  useEffect(() => {
    const valid = new Set((filteredWeekUnsubmittedLeads || []).map((r) => r.id));
    setSelectedWeekLeadIds((prev) => prev.filter((id) => valid.has(id)));
  }, [filteredWeekUnsubmittedLeads]);

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
          Instant Routing: {settings.enabled ? 'ON' : 'OFF'}
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
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={Boolean(settings.delayedReleaseEnabled)}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, delayedReleaseEnabled: e.target.checked }));
                  setIsDirty(true);
                }}
              />
              24h Auto-Release Active
            </label>
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
          </>
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

        <span className="muted" style={{ minWidth: 120 }}>{saving ? 'Saving...' : (saveMessage || (isDirty ? 'Unsaved changes' : ''))}</span>
      </div>

      <div className="panel" style={{ marginBottom: 10 }}>
        <h3 style={{ marginTop: 0 }}>New Agent Setup (Scale)</h3>
        <small className="muted">Use this once per new agent (inner circle or everyone else). It syncs into Lead Router automatically.</small>
        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <input placeholder="Full name" value={newAgent.name} onChange={(e) => setNewAgent((s) => ({ ...s, name: e.target.value }))} />
          <input placeholder="Email" value={newAgent.email} onChange={(e) => setNewAgent((s) => ({ ...s, email: e.target.value }))} />
          <input placeholder="Phone" value={newAgent.phone} onChange={(e) => setNewAgent((s) => ({ ...s, phone: e.target.value }))} />
          <input placeholder="GHL User ID" value={newAgent.ghlUserId} onChange={(e) => setNewAgent((s) => ({ ...s, ghlUserId: e.target.value }))} />
          <input placeholder="Lead Connector Email" value={newAgent.leadConnectorEmail} onChange={(e) => setNewAgent((s) => ({ ...s, leadConnectorEmail: e.target.value }))} />
          <input placeholder="Lead Connector Temp Password" value={newAgent.leadConnectorPassword} onChange={(e) => setNewAgent((s) => ({ ...s, leadConnectorPassword: e.target.value }))} />
          <label>
            Group
            <select value={newAgent.group} onChange={(e) => setNewAgent((s) => ({ ...s, group: e.target.value }))} style={{ marginLeft: 6 }}>
              <option value="inner">Inner Circle</option>
              <option value="general">Everyone Else</option>
            </select>
          </label>
          <button type="button" onClick={saveNewAgent}>Save Agent</button>
        </div>

        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Group</th>
              <th>Email</th>
              <th>GHL User ID</th>
              <th>Connector Login</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(onboardingRows || []).slice(0, 100).map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{r.group === 'inner' ? 'Inner Circle' : 'Everyone Else'}</td>
                <td>{r.email || '—'}</td>
                <td>{r.ghlUserId || '—'}</td>
                <td>{r.leadConnectorEmail || '—'}</td>
                <td><button type="button" className="ghost" onClick={() => removeOnboardingAgent(r.name)}>Remove</button></td>
              </tr>
            ))}
            {!(onboardingRows || []).length ? <tr><td colSpan={6} className="muted">No onboarding profiles yet.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginBottom: 10 }}>
        <h3 style={{ marginTop: 0 }}>Delayed Release Monitor</h3>
        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="pill">Released now: {releaseRun?.released ?? 0}</span>
          <span className="pill">Waiting window: {releaseRun?.waitingWindow ?? 0}</span>
          <span className="pill">Waiting eligible agent: {releaseRun?.waitingEligibleAgent ?? 0}</span>
          <span className="pill">Manual hold: {releaseRun?.blockedManualHold ?? 0}</span>
          <span className="pill">Submitted/blocked: {releaseRun?.blockedSubmitted ?? 0}</span>
          <span className="pill">Responded/in-house: {releaseRun?.blockedResponded ?? 0}</span>
        </div>
        <small className="muted">Delayed mode rule: lead stays owner-only until hold window expires. At/after hold time, if no form submission, no prospect response, and not manual hold, it routes to the next eligible active (unpaused) agent. Responded leads are held in-house. This 24h auto-release runs independently from Instant Routing ON/OFF.</small>
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
              <th>Status</th>
              <th>Reason</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {(ghlSyncSummary?.recentAttempts || []).map((f, idx) => (
              <tr key={`${f.timestamp}-${f.externalId || f.leadId || idx}`}>
                <td>{fmt(f.timestamp)}</td>
                <td>
                  <div>{f.leadName || f.externalId || f.leadId || '—'}</div>
                  <small className="muted">{f.leadEmail || f.leadPhone || '—'}</small>
                </td>
                <td>{f.assignedTo || '—'}</td>
                <td>{f.ok ? 'Success' : 'Failed'}</td>
                <td>{f.reason || (f.ok ? 'ok' : 'sync_failed')}</td>
                <td style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.detail || '—'}</td>
              </tr>
            ))}
            {!(ghlSyncSummary?.recentAttempts || []).length ? <tr><td colSpan={6} className="muted">No recent GHL owner sync attempts yet.</td></tr> : null}
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
              <th>Responded</th>
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
                <td>{r.responded ? 'Yes (in-house)' : 'No'}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(r.manualHold)}
                    onChange={(e) => setManualHold(r.id, e.target.checked)}
                  />
                </td>
              </tr>
            ))}
            {!(delayedQueue || []).length ? <tr><td colSpan={6} className="muted">No delayed leads waiting right now.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginBottom: 10 }}>
        <h3 style={{ marginTop: 0 }}>Distribution Leads</h3>
        <small className="muted" style={{ display: 'block', marginBottom: 8 }}>View current or previous month. Rows tagged <strong>Sponsorship Submitted • Not Booked</strong> are priority focus leads.</small>
        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <button
            type="button"
            className="ghost"
            style={{ ...tinyBtn, background: distributionMonthScope === 'current' ? '#0f766e' : undefined, color: distributionMonthScope === 'current' ? '#fff' : undefined }}
            onClick={() => {
              setDistributionMonthScope('current');
              setSelectedWeekLeadIds([]);
            }}
          >
            Current Month
          </button>
          <button
            type="button"
            className="ghost"
            style={{ ...tinyBtn, background: distributionMonthScope === 'previous' ? '#0f766e' : undefined, color: distributionMonthScope === 'previous' ? '#fff' : undefined }}
            onClick={() => {
              setDistributionMonthScope('previous');
              setSelectedWeekLeadIds([]);
            }}
          >
            Previous Month
          </button>
          <span className="pill">Scope: {distributionMonthKey || '—'}</span>
          <span className="pill">Total in scope: {weekReplyCounts.total}</span>
          <span className="pill">Kimora-owned in scope: {weekReplyCounts.eligible}</span>
          <span className="pill onpace">Priority (Submitted, Not Booked): {weekReplyCounts.prioritySponsorshipNotBooked}</span>
          <span className="pill">Submitted: {weekReplyCounts.submitted}</span>
          <span className="pill">Booked: {weekReplyCounts.booked}</span>
          <span className="pill">Replied: {weekReplyCounts.replied}</span>
          <span className="pill">Unknown owner: {weekReplyCounts.unknownOwner}</span>
          <span className="pill">Not Kimora owner: {weekReplyCounts.nonKimoraOwner}</span>
          <span className="pill">Selected: {selectedWeekLeadIds.length}</span>
          <button type="button" className="ghost" style={tinyBtn} onClick={selectAllWeekLeads} disabled={!filteredWeekUnsubmittedLeads.length}>Select Visible</button>
          <button type="button" className="ghost" style={tinyBtn} onClick={clearWeekLeadSelection} disabled={!selectedWeekLeadIds.length}>Clear Selection</button>
          <label>
            Reply Filter
            <select value={weekReplyFilter} onChange={(e) => setWeekReplyFilter(e.target.value)} style={{ marginLeft: 6 }}>
              <option value="all">All Kimora-owned (scope)</option>
              <option value="priority_sponsorship_not_booked">Priority: Sponsorship submitted, not booked</option>
              <option value="not_replied">Not replied</option>
            </select>
          </label>
          <button type="button" style={tinyBtn} onClick={() => bulkReleaseWeekUnsubmitted('auto')} disabled={!filteredWeekUnsubmittedLeads.length}>Auto-Assign ALL</button>
          <button type="button" style={tinyBtn} onClick={() => bulkReleaseWeekUnsubmitted('auto', true)} disabled={!selectedWeekLeadIds.length}>Auto-Assign SELECTED</button>
          <label>
            Target Agent
            <select
              value={bulkTargetAgent}
              onChange={(e) => setBulkTargetAgent(e.target.value)}
              style={{ marginLeft: 6 }}
            >
              <optgroup label="Inner Circle">
                {innerCircleAgentRows.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
              </optgroup>
              <optgroup label="Everyone Else">
                {nonInnerCircleAgentRows.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
              </optgroup>
            </select>
          </label>
          <button type="button" className="ghost" style={tinyBtn} onClick={() => bulkReleaseWeekUnsubmitted('agent')} disabled={!filteredWeekUnsubmittedLeads.length || !bulkTargetAgent}>Assign ALL To Target</button>
          <button type="button" className="ghost" style={tinyBtn} onClick={() => bulkReleaseWeekUnsubmitted('agent', true)} disabled={!selectedWeekLeadIds.length || !bulkTargetAgent}>Assign SELECTED To Target</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Lead</th>
              <th>Current Owner</th>
              <th>Created</th>
              <th>Stage</th>
              <th>Priority</th>
              <th>Submitted</th>
              <th>Booked</th>
              <th>Release Status</th>
              <th>Responded</th>
              <th>Manual Hold</th>
            </tr>
          </thead>
          <tbody>
            {(filteredWeekUnsubmittedLeads || []).slice(0, 250).map((r) => (
              <tr key={r.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedWeekLeadIds.includes(r.id)}
                    onChange={() => toggleWeekLeadSelection(r.id)}
                  />
                </td>
                <td>
                  <div>{displayLeadName(r)}</div>
                  <small className="muted">{r.email || r.phone || '—'}</small>
                </td>
                <td>{r.owner || '—'}</td>
                <td>{fmt(r.createdAt)}</td>
                <td>{r.stage || 'New'}</td>
                <td>
                  {r.prioritySponsorshipNotBooked ? (
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: 999,
                      border: '1px solid rgba(245,158,11,.9)',
                      boxShadow: '0 0 10px rgba(245,158,11,.35)',
                      color: 'inherit'
                    }}>
                      Sponsorship Submitted • Not Booked
                    </span>
                  ) : '—'}
                </td>
                <td>{r.submitted ? 'Yes' : 'No'}</td>
                <td>{r.booked ? 'Yes' : 'No'}</td>
                <td>{r.releaseStatus || '—'}</td>
                <td>{r.responded ? 'Yes (in-house)' : 'No'}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(r.manualHold)}
                    onChange={(e) => setManualHold(r.id, e.target.checked)}
                  />
                </td>
              </tr>
            ))}
            {!(filteredWeekUnsubmittedLeads || []).length ? <tr><td colSpan={11} className="muted">No eligible distribution leads right now.</td></tr> : null}
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
        <small className="muted" style={{ display: 'block', marginBottom: 8 }}>Paused controls immediate/live assignment. 24h Auto controls which agents can receive delayed auto-release leads.</small>
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Today</th>
              <th>Week</th>
              <th>Month</th>
              <th>Paused (Instant)</th>
              <th>24h Auto</th>
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
                      type="checkbox"
                      checked={Boolean(a.delayedReleaseEnabled)}
                      onChange={(e) => {
                        const agents = agentRows.map((x) => x.name === a.name ? { ...x, delayedReleaseEnabled: e.target.checked } : x);
                        setSettings((s) => ({ ...s, agents }));
                        setIsDirty(true);
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
                      onBlur={() => savePatch({ agents: settings?.agents || [] })}
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
                      onBlur={() => savePatch({ agents: settings?.agents || [] })}
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
