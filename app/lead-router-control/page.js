'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

const GOLD = '#C8A96B';
const PANEL_BG = '#0f172a';
const PANEL_BORDER = '#1e2d42';

function clean(v = '') { return String(v || '').trim(); }

function cstDateKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function cstMonthKey(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit' }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  return `${y}-${m}`;
}

function timeAgo(iso = '') {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const AGENT_COLORS = {
  'Kimora Link': '#C8A96B',
  'Jamal Holmes': '#22d3ee',
  'Mahogany Burns': '#f472b6',
  'Leticia Wright': '#a78bfa',
  'Andrea Cannon': '#34d399',
  'Kelin Brown': '#fb923c',
  'Madalyn Adams': '#60a5fa',
  'Breanna James': '#e879f9',
  'Donyell Richardson': '#4ade80',
  'Shannon Maxwell': '#fbbf24',
  'Angelique Lassiter': '#f87171',
};

function agentColor(name = '') {
  return AGENT_COLORS[name] || '#94a3b8';
}

function shortName(full = '') {
  const parts = clean(full).split(' ');
  if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  return full;
}

function displayLeadName(row = {}) {
  const name = String(row?.name || '').trim();
  const nameLower = name.toLowerCase();
  const nameIsBlank = !name || nameLower === 'unknown lead' || nameLower === 'unknown';
  if (!nameIsBlank) return name;
  const email = String(row?.email || '').trim();
  if (email.includes('@')) return email.split('@')[0];
  const phone = String(row?.phone || '').trim();
  if (phone) return phone;
  return 'Unknown Lead';
}

export default function LeadRouterControlPage() {
  const [settings, setSettings] = useState(null);
  const [counts, setCounts] = useState({});
  const [leadRows, setLeadRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [catchUpResult, setCatchUpResult] = useState(null);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);
  const [drillDown, setDrillDown] = useState(null); // { agentName, period, leads }

  useEffect(() => {
    fetch('/api/lead-router', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.settings) setSettings(d.settings);
        else setError('Could not load settings.');
        if (d?.counts) setCounts(d.counts);
        if (Array.isArray(d?.calledLeadRows)) setLeadRows(d.calledLeadRows);
        if (Array.isArray(d?.recent)) setRecentEvents(d.recent);
      })
      .catch(() => setError('Failed to connect to lead router.'))
      .finally(() => setLoading(false));
  }, []);

  // Derive counts from actual lead rows — hooks must come before any early return
  const rowCounts = useMemo(() => {
    const now = new Date();
    const todayKey = cstDateKey(now);
    const monthKey = cstMonthKey(now);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const map = {};
    for (const row of leadRows) {
      const owner = String(row?.owner || row?.assignedTo || '').trim();
      if (!owner) continue;
      if (!map[owner]) map[owner] = { today: 0, week: 0, month: 0 };
      const created = row?.createdAt || '';
      if (!created) continue;
      const d = new Date(created);
      if (Number.isNaN(d.getTime())) continue;
      if (cstDateKey(d) === todayKey) map[owner].today += 1;
      if (d >= weekStart) map[owner].week += 1;
      if (cstMonthKey(d) === monthKey) map[owner].month += 1;
    }
    return map;
  }, [leadRows]);

  async function patch(updates) {
    setSaving(true);
    setSaved('');
    try {
      const res = await fetch('/api/lead-router', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch: updates }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d?.ok) {
        setSaved('Saved ✓');
        setTimeout(() => setSaved(''), 2500);
      } else {
        setError(d?.error || 'Save failed');
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  function updateAgent(name, field, value) {
    setSettings((s) => {
      const agents = (s?.agents || []).map((a) =>
        a.name === name ? { ...a, [field]: value } : a
      );
      return { ...s, agents };
    });
  }

  async function saveAgents() {
    setSaving(true);
    setSaved('');
    setCatchUpResult(null);
    try {
      const res = await fetch('/api/lead-router', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch: { agents: settings?.agents || [] } }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d?.ok) {
        setSaved('Saved ✓');
        setTimeout(() => setSaved(''), 3000);
        if (d?.catchUp?.distributed > 0) {
          setCatchUpResult(d.catchUp);
          // Reload counts after catch-up
          setTimeout(() => fetch('/api/lead-router', { cache: 'no-store' }).then((r) => r.json()).then((d2) => {
            if (d2?.counts) setCounts(d2.counts);
            if (Array.isArray(d2?.calledLeadRows)) setLeadRows(d2.calledLeadRows);
          }), 1200);
        }
      } else {
        setError(d?.error || 'Save failed');
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function syncToday() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/ghl-sync-today', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const d = await res.json().catch(() => ({}));
      setSyncResult(d);
      if (d?.ok) {
        // Reload counts after sync
        setTimeout(() => fetch('/api/lead-router', { cache: 'no-store' }).then((r) => r.json()).then((d2) => {
          if (d2?.counts) setCounts(d2.counts);
          if (Array.isArray(d2?.calledLeadRows)) setLeadRows(d2.calledLeadRows);
        }), 1500);
      }
    } catch (e) {
      setSyncResult({ ok: false, error: String(e?.message || e) });
    } finally {
      setSyncing(false);
    }
  }

  const ASSIGNMENT_TYPES = new Set(['assigned', 'delayed_release_assigned', 'reassigned_sla', 'manual_bulk_release_assigned']);

  function getPeriodLeads(agentName, period) {
    const now = new Date();
    const todayKey = cstDateKey(now);
    const monthKey = cstMonthKey(now);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    // Use assignment events — these exist for every lead assigned, called or not
    return recentEvents
      .filter((e) => {
        if (!ASSIGNMENT_TYPES.has(String(e?.type || ''))) return false;
        if (String(e?.assignedTo || '').trim() !== agentName) return false;
        if (period === 'today') return e?.dateKey === todayKey;
        if (period === 'week') {
          const d = e?.timestamp ? new Date(e.timestamp) : null;
          return d && !Number.isNaN(d.getTime()) && d >= weekStart;
        }
        if (period === 'month') return e?.monthKey === monthKey;
        return false;
      })
      .sort((a, b) => new Date(b?.timestamp || 0) - new Date(a?.timestamp || 0));
  }

  function openDrillDown(agentName, period) {
    const leads = getPeriodLeads(agentName, period);
    setDrillDown({ agentName, period, leads });
  }

  function getCount(agentName, period) {
    const fromEvents = counts[agentName]?.[period] || 0;
    const fromRows = rowCounts[agentName]?.[period] || 0;
    return Math.max(fromEvents, fromRows);
  }

  // Recent assignments for at-a-glance sidebar — built from events for accurate timestamps, excludes overflow
  const overflowAgentName = settings?.overflowAgent || 'Kimora Link';
  const recentAssignments = useMemo(() => {
    return recentEvents
      .filter((e) => e?.type === 'assigned' && e?.assignedTo && e.assignedTo !== overflowAgentName)
      .sort((a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime())
      .slice(0, 25)
      .map((e) => ({ id: e.leadId || e.id, name: e.name, owner: e.assignedTo, createdAt: e.timestamp }));
  }, [recentEvents, overflowAgentName]);

  if (loading) {
    return (
      <AppShell title="Lead Router Control">
        <p style={{ color: '#94a3b8' }}>Loading…</p>
      </AppShell>
    );
  }

  const agents = settings?.agents || [];
  const agentNames = agents.map((a) => a.name);

  return (
    <AppShell title="Lead Router Control">
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', maxWidth: 1240 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1, minWidth: 0 }}>

        {/* Sync Today Banner */}
        <div style={{ border: `1px solid ${GOLD}55`, borderRadius: 14, background: 'rgba(200,169,107,0.07)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: GOLD, fontWeight: 700, fontSize: 15 }}>⚡ Sync Today’s Leads from GHL</div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>Pulls contacts created today from GoHighLevel and routes them through the distribution system.</div>
          </div>
          <button
            type="button"
            onClick={syncToday}
            disabled={syncing}
            style={{ padding: '10px 24px', borderRadius: 999, background: syncing ? '#1e293b' : GOLD, color: syncing ? '#64748b' : '#0B1020', border: 'none', fontWeight: 800, fontSize: 14, cursor: syncing ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
          >
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
          {syncResult && (
            <div style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: syncResult.ok ? 'rgba(134,239,172,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${syncResult.ok ? '#86efac44' : '#ef444444'}`, color: syncResult.ok ? '#86efac' : '#f87171', fontSize: 13 }}>
              {syncResult.ok
                ? `✅ Found ${syncResult.found} leads — ${syncResult.skipped || 0} already in system — ${syncResult.distributed} newly distributed`
                : `❌ ${syncResult.error || 'Sync failed'}`}
              {syncResult.ok && syncResult.results?.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {syncResult.results.map((r, i) => (
                    <div key={i} style={{ fontSize: 12, color: r.ok ? '#86efac' : '#f87171' }}>
                      {r.ok ? '✓' : '✗'} {r.name} {r.assignedTo ? `→ ${r.assignedTo}` : ''} {r.error ? `(${r.error})` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {catchUpResult && catchUpResult.distributed > 0 && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(134,239,172,0.08)', border: '1px solid #86efac44', color: '#86efac', fontSize: 13 }}>
            ⚡ Catch-up complete — <strong>{catchUpResult.distributed}</strong> lead{catchUpResult.distributed !== 1 ? 's' : ''} redistributed and agents notified by email.
            <button type="button" onClick={() => setCatchUpResult(null)} style={{ marginLeft: 12, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>dismiss</button>
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid #ef444444', color: '#f87171', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Global Caps + Overflow */}
        <div style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 16, background: PANEL_BG, padding: '22px 24px' }}>
          <h3 style={{ margin: '0 0 4px', color: '#e2e8f0', fontSize: 16, fontWeight: 700 }}>Global Defaults</h3>
          <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 13 }}>Applies to all agents unless individually overridden below.</p>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Max Per Day</label>
              <input
                type="number" min="0"
                value={settings?.maxPerDay ?? ''}
                onChange={(e) => setSettings((s) => ({ ...s, maxPerDay: Number(e.target.value || 0) }))}
                onBlur={() => patch({ maxPerDay: settings?.maxPerDay })}
                style={{ width: 100, padding: '10px 12px', borderRadius: 8, border: `1px solid ${PANEL_BORDER}`, background: '#0b1220', color: '#e2e8f0', fontSize: 15, fontWeight: 700 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Max Per Week</label>
              <input
                type="number" min="0"
                value={settings?.maxPerWeek ?? ''}
                onChange={(e) => setSettings((s) => ({ ...s, maxPerWeek: Number(e.target.value || 0) }))}
                onBlur={() => patch({ maxPerWeek: settings?.maxPerWeek })}
                style={{ width: 100, padding: '10px 12px', borderRadius: 8, border: `1px solid ${PANEL_BORDER}`, background: '#0b1220', color: '#e2e8f0', fontSize: 15, fontWeight: 700 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Max Per Month</label>
              <input
                type="number" min="0"
                value={settings?.maxPerMonth ?? ''}
                onChange={(e) => setSettings((s) => ({ ...s, maxPerMonth: Number(e.target.value || 0) }))}
                onBlur={() => patch({ maxPerMonth: settings?.maxPerMonth })}
                style={{ width: 110, padding: '10px 12px', borderRadius: 8, border: `1px solid ${PANEL_BORDER}`, background: '#0b1220', color: '#e2e8f0', fontSize: 15, fontWeight: 700 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Overflow To</label>
              <select
                value={settings?.overflowAgent || ''}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, overflowAgent: e.target.value }));
                  patch({ overflowAgent: e.target.value });
                }}
                style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${PANEL_BORDER}`, background: '#0b1220', color: GOLD, fontSize: 14, fontWeight: 700 }}
              >
                <option value="Kimora Link">Kimora Link</option>
                {agentNames.filter((n) => n !== 'Kimora Link').map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Agent Toggles + Individual Caps */}
        <div style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 16, background: PANEL_BG, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: '0 0 4px', color: '#e2e8f0', fontSize: 16, fontWeight: 700 }}>Agents</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Toggle on/off and set individual caps. Leave cap blank to use global default.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {saved && <span style={{ color: '#86efac', fontSize: 13, fontWeight: 600 }}>{saved}</span>}
              <button
                type="button"
                onClick={saveAgents}
                disabled={saving}
                style={{
                  padding: '10px 22px', borderRadius: 999,
                  background: saving ? '#1e293b' : GOLD,
                  color: saving ? '#64748b' : '#0B1020',
                  border: 'none', fontWeight: 800, fontSize: 14, cursor: saving ? 'default' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Save Agents'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
            {agents.map((agent) => (
              <div key={agent.name} style={{
                display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                padding: '14px 18px', borderRadius: 12,
                border: `1px solid ${agent.active ? GOLD + '55' : PANEL_BORDER}`,
                background: agent.active ? 'rgba(200,169,107,0.06)' : '#0b1220',
                transition: 'all .15s',
              }}>
                {/* On/Off Toggle */}
                <button
                  type="button"
                  onClick={() => updateAgent(agent.name, 'active', !agent.active)}
                  style={{
                    padding: '6px 18px', borderRadius: 999, fontWeight: 700, fontSize: 13,
                    border: `1px solid ${agent.active ? '#86efac' : '#475569'}`,
                    background: agent.active ? 'rgba(134,239,172,0.15)' : 'transparent',
                    color: agent.active ? '#86efac' : '#64748b',
                    cursor: 'pointer', minWidth: 60, transition: 'all .15s',
                  }}
                >
                  {agent.active ? 'ON' : 'OFF'}
                </button>

                {/* Name + track badge */}
                <div style={{ flex: '1 1 140px', minWidth: 140, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ color: agent.active ? '#e2e8f0' : '#64748b', fontWeight: 700, fontSize: 15 }}>
                    {agent.name}
                  </span>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {agent.track === 'sponsorship' && (
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '1px solid #f9731655', letterSpacing: '.3px' }}>SPONSORSHIP</span>
                    )}
                    {agent.track === 'inner_circle' && (
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: 'rgba(200,169,107,0.15)', color: '#C8A96B', border: '1px solid #C8A96B55', letterSpacing: '.3px' }}>INNER CIRCLE</span>
                    )}
                    {agent.capTotal > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: getCount(agent.name, 'total') >= agent.capTotal ? '#ef4444' : '#64748b' }}>
                        {getCount(agent.name, 'total')}/{agent.capTotal} lifetime
                        {getCount(agent.name, 'total') >= agent.capTotal ? ' — CAPPED 🔒' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Track badge */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <label style={{ color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px' }}>Track</label>
                  <select
                    value={agent.track || ''}
                    onChange={(e) => updateAgent(agent.name, 'track', e.target.value || null)}
                    style={{ padding: '7px 8px', borderRadius: 8, border: `1px solid ${agent.track === 'sponsorship' ? '#f97316aa' : agent.track === 'inner_circle' ? '#C8A96Baa' : PANEL_BORDER}`, background: '#111827', color: agent.track === 'sponsorship' ? '#fb923c' : agent.track === 'inner_circle' ? '#C8A96B' : '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    <option value="">— None —</option>
                    <option value="sponsorship">Sponsorship</option>
                    <option value="inner_circle">Inner Circle</option>
                  </select>
                </div>

                {/* Caps */}
                {[['Day', 'capPerDay', 70], ['Week', 'capPerWeek', 70], ['Month', 'capPerMonth', 80]].map(([label, field, width]) => (
                  <div key={field} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <label style={{ color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label} Cap</label>
                    <input
                      type="number" min="0" placeholder="—"
                      value={agent[field] ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateAgent(agent.name, field, v === '' ? null : Number(v));
                      }}
                      style={{ width, padding: '7px 10px', borderRadius: 8, border: `1px solid ${PANEL_BORDER}`, background: '#111827', color: '#e2e8f0', fontSize: 14, textAlign: 'center' }}
                    />
                  </div>
                ))}

                {/* Total (lifetime) cap */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <label style={{ color: agent.track === 'sponsorship' ? '#fb923c' : '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: agent.track === 'sponsorship' ? 800 : 400 }}>Total Cap</label>
                  <input
                    type="number" min="0" placeholder="—"
                    value={agent.capTotal ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateAgent(agent.name, 'capTotal', v === '' ? null : Number(v));
                    }}
                    style={{ width: 70, padding: '7px 10px', borderRadius: 8, border: `1px solid ${agent.track === 'sponsorship' ? '#f97316aa' : PANEL_BORDER}`, background: '#111827', color: agent.track === 'sponsorship' ? '#fb923c' : '#e2e8f0', fontSize: 14, textAlign: 'center', fontWeight: agent.track === 'sponsorship' ? 800 : 400 }}
                  />
                </div>

                {/* Today's Counts — clickable drill-down */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginLeft: 'auto' }}>
                  {[['Today', 'today', '#22d3ee'], ['Week', 'week', '#a78bfa'], ['Month', 'month', GOLD]].map(([label, period, color]) => {
                    const cnt = getCount(agent.name, period);
                    return (
                      <div key={period} style={{ textAlign: 'center' }}>
                        <div style={{ color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
                        <button
                          type="button"
                          onClick={() => openDrillDown(agent.name, period)}
                          title={`View ${label.toLowerCase()} leads for ${agent.name}`}
                          style={{
                            background: 'none', border: 'none', padding: '2px 4px', borderRadius: 6,
                            color, fontWeight: 800, fontSize: 18, lineHeight: 1.1,
                            cursor: cnt > 0 ? 'pointer' : 'default',
                            textDecoration: cnt > 0 ? 'underline dotted' : 'none',
                            textUnderlineOffset: 3,
                          }}
                        >
                          {cnt}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Window */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {[['From', 'windowStart', '09:00'], ['To', 'windowEnd', '21:00']].map(([lbl, field, def], i) => (
                    <div key={field} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <label style={{ color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px' }}>{lbl}</label>
                      <input
                        type="time"
                        value={agent[field] || def}
                        onChange={(e) => updateAgent(agent.name, field, e.target.value)}
                        style={{ padding: '7px 8px', borderRadius: 8, border: `1px solid ${PANEL_BORDER}`, background: '#111827', color: '#94a3b8', fontSize: 13 }}
                      />
                    </div>
                  ))}
                </div>

              </div>
            ))}
          </div>
        </div>

        <p style={{ color: '#475569', fontSize: 12 }}>
          Global cap changes save on blur. Click <strong style={{ color: '#e2e8f0' }}>Save Agents</strong> to apply agent-level changes.
          Visit <a href="/lead-router" style={{ color: GOLD }}>Lead Router</a> for full routing controls and lead logs.
        </p>

      {/* Drill-down Modal */}
      {drillDown && (
        <div
          onClick={() => setDrillDown(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0f172a', border: `1px solid ${PANEL_BORDER}`,
              borderRadius: 18, width: '100%', maxWidth: 620,
              maxHeight: '80vh', display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: agentColor(drillDown.agentName), fontWeight: 800, fontSize: 16 }}>
                  {drillDown.agentName}
                </div>
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
                  {drillDown.period === 'today' ? "Today's" : drillDown.period === 'week' ? "This Week's" : "This Month's"} Leads
                  {' '}— <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{drillDown.leads.length}</span> total
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrillDown(null)}
                style={{ background: 'none', border: 'none', color: '#475569', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '4px 8px' }}
              >✕</button>
            </div>

            {/* Lead List */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {drillDown.leads.length === 0 ? (
                <div style={{ padding: '32px 24px', textAlign: 'center', color: '#475569', fontSize: 14 }}>
                  No leads found for this period.
                </div>
              ) : (
                drillDown.leads.map((row, i) => {
                  const name = displayLeadName(row);
                  const email = String(row?.email || '').trim();
                  const phone = String(row?.phone || '').trim();
                  const isUnknown = !String(row?.name || '').trim() || String(row?.name || '').toLowerCase() === 'unknown lead' || String(row?.name || '').toLowerCase() === 'unknown';
                  const ts = row?.timestamp || row?.createdAt || '';
                  const timeStr = ts
                    ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ts))
                    : '—';
                  return (
                    <div
                      key={row?.id || i}
                      style={{
                        padding: '14px 24px',
                        borderBottom: i < drillDown.leads.length - 1 ? `1px solid ${PANEL_BORDER}55` : 'none',
                        display: 'flex', alignItems: 'center', gap: 14,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ color: isUnknown ? '#64748b' : '#e2e8f0', fontWeight: 700, fontSize: 14 }}>
                            {name}
                          </span>
                          {isUnknown && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid #ef444444' }}>UNKNOWN</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                          {email && (
                            <span style={{ color: '#64748b', fontSize: 12 }}>✉ {email}</span>
                          )}
                          {phone && (
                            <span style={{ color: '#64748b', fontSize: 12 }}>📞 {phone}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ color: '#475569', fontSize: 11 }}>{timeStr}</div>
                        {row?.source && (
                          <div style={{ color: '#334155', fontSize: 10, marginTop: 2 }}>{row.source}</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 24px', borderTop: `1px solid ${PANEL_BORDER}`, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDrillDown(null)}
                style={{ padding: '9px 22px', borderRadius: 999, background: '#1e293b', border: `1px solid ${PANEL_BORDER}`, color: '#94a3b8', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      </div>{/* end main column */}

      {/* At a Glance Sidebar */}
      <div style={{ width: 230, flexShrink: 0, position: 'sticky', top: 20 }}>
        <div style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 16, background: PANEL_BG, overflow: 'hidden' }}>
          <div style={{ padding: '13px 15px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>At a Glance</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>Latest {recentAssignments.length}</span>
          </div>
          <div style={{ maxHeight: 540, overflowY: 'auto' }}>
            {recentAssignments.length === 0 ? (
              <p style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: '20px 14px', margin: 0 }}>No leads yet</p>
            ) : (
              recentAssignments.map((row, i) => {
                const leadName = displayLeadName(row);
                const agentName = clean(row?.owner || row?.assignedTo || '—');
                const color = agentColor(agentName);
                const agentObj = agents.find((a) => a.name === agentName);
                const agentTrack = agentObj?.track || '';
                return (
                  <div
                    key={row?.id || i}
                    style={{
                      padding: '9px 14px',
                      borderBottom: i < recentAssignments.length - 1 ? `1px solid ${PANEL_BORDER}55` : 'none',
                      display: 'flex', flexDirection: 'column', gap: 3,
                    }}
                  >
                    <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {leadName}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ color, fontSize: 11, fontWeight: 700 }}>→ {shortName(agentName)}</span>
                        {agentTrack === 'sponsorship' && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 999, background: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '1px solid #f9731644' }}>SP</span>}
                        {agentTrack === 'inner_circle' && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 999, background: 'rgba(200,169,107,0.15)', color: '#C8A96B', border: '1px solid #C8A96B44' }}>IC</span>}
                      </div>
                      <span style={{ color: '#334155', fontSize: 10 }}>{timeAgo(row?.createdAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      </div>{/* end outer flex row */}
    </AppShell>
  );
}
