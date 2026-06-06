'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const C = {
  gold: '#B28147',
  goldBright: '#D4A24A',
  goldLight: '#E6C97F',
  goldDark: '#8A6234',
  ink: '#0A0A0A',
  inkSoft: '#1A1410',
  cream: '#FAF8F2',
  paper: '#FFFFFF',
  line: '#E5DFCF',
  lineSoft: '#F0EADB',
  text: '#1A1410',
  textMuted: '#6B6357',
  textFaint: '#9C9486',
  success: '#437A22',
  successBg: '#ECF5E0',
  overdue: '#A12C7B',
  overdueBg: '#FBE9F3',
};

const TOKEN_KEY = 'start_portal_token_v1';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function daysSince(isoDate) {
  if (!isoDate) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24)));
}

const STATUS_LABELS = {
  new: 'New',
  on_track: 'On Track',
  stuck: 'Stuck',
  ready_upgrade: 'Ready to Upgrade',
  fully_producing: 'Fully Producing'
};

const STATUS_COLORS = {
  new: { bg: '#DCE9F2', color: '#1B4F72' },
  on_track: { bg: C.successBg, color: C.success },
  stuck: { bg: C.overdueBg, color: C.overdue },
  ready_upgrade: { bg: '#FFF4D6', color: '#7A5A0C' },
  fully_producing: { bg: '#ECF5E0', color: C.success }
};

const OWNER_LABEL = {
  'YOU DO': 'Your action',
  'WE DO': 'We handle it',
  'WE GUIDE': 'We guide you',
  'WE PAY': 'We pay you',
  'CARRIER': 'Carrier action',
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminOnboardingPage() {
  const [pageState, setPageState] = useState('loading');
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [drawer, setDrawer] = useState(null); // { agent } or null
  const [drawerDetail, setDrawerDetail] = useState(null); // full detail
  const [addModal, setAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Add agent form
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', tier: 'inner_circle', paid_in_full: false, start_date: new Date().toISOString().slice(0, 10) });

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { setPageState('auth'); return; }
    try {
      const res = await fetch('/api/admin/onboarding/agents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) { setPageState('auth'); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAgents(data.agents || []);
      setPageState('ok');
    } catch {
      setPageState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openDrawer(agent) {
    setDrawer({ agent });
    setDrawerDetail(null);
    const token = getToken();
    try {
      const res = await fetch(`/api/admin/onboarding/agents/${agent.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setDrawerDetail(data);
    } catch {
      // ignore
    }
  }

  async function adminCheck(agentId, itemId, checked) {
    const token = getToken();
    setSaving(true);
    try {
      await fetch('/api/admin/onboarding/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ agent_id: agentId, item_id: itemId, checked })
      });
      showToast(checked ? 'Marked complete' : 'Unmarked');
      // Refresh detail
      const res = await fetch(`/api/admin/onboarding/agents/${agentId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDrawerDetail(data);
      // Refresh main list
      await load();
    } catch {
      showToast('Error saving', 'error');
    }
    setSaving(false);
  }

  async function upgradeAgent(agentId) {
    const token = getToken();
    setSaving(true);
    try {
      await fetch('/api/admin/onboarding/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ agent_id: agentId })
      });
      showToast('Agent upgraded to Elite ✓');
      setDrawer(null);
      await load();
    } catch {
      showToast('Error upgrading', 'error');
    }
    setSaving(false);
  }

  async function sendNudge(agentId) {
    const token = getToken();
    try {
      await fetch('/api/admin/onboarding/nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ agent_id: agentId })
      });
      showToast('Nudge sent (Phase 2)');
    } catch {
      showToast('Error', 'error');
    }
  }

  async function addAgent() {
    if (!form.first_name || !form.last_name || !form.email) {
      showToast('First name, last name, and email are required', 'error');
      return;
    }
    const token = getToken();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/onboarding/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      showToast(`${form.first_name} added ✓`);
      setAddModal(false);
      setForm({ first_name: '', last_name: '', email: '', tier: 'inner_circle', paid_in_full: false, start_date: new Date().toISOString().slice(0, 10) });
      await load();
    } catch (err) {
      showToast('Error adding agent: ' + err.message, 'error');
    }
    setSaving(false);
  }

  // ─── Filter + sort agents ──────────────────────────────────────────────────
  const filtered = agents
    .filter(a => {
      const name = `${a.first_name} ${a.last_name} ${a.email}`.toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      if (tierFilter !== 'all' && a.tier !== tierFilter) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return `${a.first_name}${a.last_name}`.localeCompare(`${b.first_name}${b.last_name}`);
      if (sortBy === 'progress') return (b.progress?.pct || 0) - (a.progress?.pct || 0);
      if (sortBy === 'day') return (b.daysSinceStart || 0) - (a.daysSinceStart || 0);
      return 0;
    });

  // ─── KPI strip ────────────────────────────────────────────────────────────
  const activeCount = agents.filter(a => a.status === 'active').length;
  const avgProgress = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + (a.progress?.pct || 0), 0) / agents.length)
    : 0;
  const stuckCount = agents.filter(a => a.status_computed === 'stuck' || a.status === 'stuck').length;
  const readyCount = agents.filter(a => a.status === 'ready_upgrade').length;

  // ─── Page states ───────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.textMuted, fontFamily: 'Inter, sans-serif' }}>Loading dashboard…</div>
      </div>
    );
  }

  if (pageState === 'auth') {
    return (
      <div style={{ minHeight: '100vh', background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', color: C.cream, fontFamily: 'Inter, sans-serif' }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 22, fontWeight: 700, color: C.goldBright, marginBottom: 12 }}>Access Denied</div>
          <p style={{ color: C.textFaint }}>Admin access required. <a href="/start" style={{ color: C.gold }}>Sign in</a></p>
        </div>
      </div>
    );
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

      <div style={{ minHeight: '100vh', background: C.cream, fontFamily: 'Inter, -apple-system, sans-serif', color: C.text }}>

        {/* ─── Topbar ─── */}
        <div style={{ background: C.ink, borderBottom: `2px solid ${C.gold}` }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/onboarding-logo.png" alt="Legacy Link" style={{ width: 40, height: 40, objectFit: 'contain' }} />
              <div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 16, color: C.goldBright }}>The Legacy Link</div>
                <div style={{ fontSize: 11, color: C.textFaint, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Manager Dashboard</div>
              </div>
            </div>
            <button
              onClick={() => setAddModal(true)}
              style={{ padding: '10px 20px', background: C.gold, color: C.ink, border: 0, borderRadius: 8, fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.02em' }}
            >
              + Add Agent
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 80px' }}>

          {/* ─── KPI Strip ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'Active Agents', value: activeCount, sub: `${agents.filter(a => a.tier === 'elite').length} Elite · ${agents.filter(a => a.tier === 'inner_circle').length} IC` },
              { label: 'Avg. Progress', value: `${avgProgress}%`, sub: 'Across all active agents' },
              { label: 'Stuck (7+ days)', value: stuckCount, sub: 'Needs your attention', accent: stuckCount > 0 ? C.overdue : null },
              { label: 'Ready to Upgrade', value: readyCount, sub: 'IC agents at 70%+ / Day 60+', accent: readyCount > 0 ? C.goldDark : null }
            ].map(kpi => (
              <div key={kpi.label} style={{
                background: C.paper,
                border: `1px solid ${kpi.accent ? kpi.accent : C.line}`,
                borderLeft: `4px solid ${kpi.accent || C.gold}`,
                borderRadius: 10,
                padding: '18px 20px',
                boxShadow: '0 2px 8px rgba(10,10,10,0.04)'
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: kpi.accent || C.textMuted, marginBottom: 6 }}>{kpi.label}</div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 32, fontWeight: 700, color: C.ink, lineHeight: 1 }}>{kpi.value}</div>
                <div style={{ fontSize: 12, color: C.textFaint, marginTop: 4 }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* ─── Filters ─── */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search agents…"
              style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.line}`, background: C.paper, fontSize: 14, fontFamily: 'Inter, sans-serif', color: C.text, minWidth: 200 }}
            />
            <select
              value={tierFilter}
              onChange={e => setTierFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.line}`, background: C.paper, fontSize: 13, fontFamily: 'Inter, sans-serif', color: C.text }}
            >
              <option value="all">All Tiers</option>
              <option value="elite">Elite</option>
              <option value="inner_circle">Inner Circle</option>
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.line}`, background: C.paper, fontSize: 13, fontFamily: 'Inter, sans-serif', color: C.text }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="new">New</option>
              <option value="stuck">Stuck</option>
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.line}`, background: C.paper, fontSize: 13, fontFamily: 'Inter, sans-serif', color: C.text }}
            >
              <option value="name">Sort: Name</option>
              <option value="progress">Sort: Progress</option>
              <option value="day">Sort: Day</option>
            </select>
          </div>

          {/* ─── Agent Table ─── */}
          <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(10,10,10,0.04)' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 80px 1fr 120px 100px 32px', gap: 0, padding: '12px 16px', borderBottom: `1px solid ${C.line}`, background: C.cream }}>
              {['Agent', 'Tier', 'Day', 'Progress', 'Last Move', 'Status', ''].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textFaint }}>{h}</div>
              ))}
            </div>

            {filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: C.textFaint, fontSize: 14 }}>
                No agents found.
              </div>
            )}

            {filtered.map((agent, idx) => {
              const sc = STATUS_COLORS[agent.status] || STATUS_COLORS.on_track;
              return (
                <div
                  key={agent.id}
                  onClick={() => openDrawer(agent)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 100px 80px 1fr 120px 100px 32px',
                    gap: 0,
                    padding: '14px 16px',
                    borderBottom: idx < filtered.length - 1 ? `1px solid ${C.lineSoft}` : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    alignItems: 'center'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.cream}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Name + email */}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{agent.first_name} {agent.last_name}</div>
                    <div style={{ fontSize: 12, color: C.textFaint }}>{agent.email}</div>
                  </div>

                  {/* Tier */}
                  <div>
                    <span style={{
                      fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 700,
                      padding: '3px 8px', borderRadius: 99, letterSpacing: '0.06em', textTransform: 'uppercase',
                      background: agent.tier === 'elite' ? `linear-gradient(135deg, ${C.goldBright}, ${C.goldLight})` : C.cream,
                      color: agent.tier === 'elite' ? C.ink : C.textMuted,
                      border: `1px solid ${agent.tier === 'elite' ? C.gold : C.line}`
                    }}>
                      {agent.tier === 'elite' ? 'Elite' : 'IC'}
                    </span>
                  </div>

                  {/* Day */}
                  <div style={{ fontSize: 13, color: C.textMuted }}>Day {agent.daysSinceStart || 0}</div>

                  {/* Progress bar + % */}
                  <div style={{ paddingRight: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: C.lineSoft, borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: `${agent.progress?.pct || 0}%`, height: '100%', background: `linear-gradient(90deg, ${C.goldDark}, ${C.goldBright})`, borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.goldDark, minWidth: 30 }}>{agent.progress?.pct || 0}%</span>
                    </div>
                  </div>

                  {/* Last move */}
                  <div style={{ fontSize: 12, color: C.textFaint }}>{agent.lastMoveAt ? fmtDate(agent.lastMoveAt) : '—'}</div>

                  {/* Status */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: sc.bg, color: sc.color }}>
                      {STATUS_LABELS[agent.status] || agent.status}
                    </span>
                  </div>

                  {/* Chevron */}
                  <div style={{ color: C.textFaint, fontSize: 18, textAlign: 'right' }}>›</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Agent Detail Drawer ─── */}
      {drawer && (
        <AgentDrawer
          agent={drawer.agent}
          detail={drawerDetail}
          saving={saving}
          onClose={() => { setDrawer(null); setDrawerDetail(null); }}
          onCheck={adminCheck}
          onUpgrade={upgradeAgent}
          onNudge={sendNudge}
        />
      )}

      {/* ─── Add Agent Modal ─── */}
      {addModal && (
        <AddAgentModal
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={() => setAddModal(false)}
          onSubmit={addAgent}
        />
      )}

      {/* ─── Toast ─── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? C.overdue : C.ink,
          color: toast.type === 'error' ? '#fff' : C.goldBright,
          padding: '12px 24px', borderRadius: 8,
          fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14,
          boxShadow: '0 8px 24px rgba(10,10,10,0.2)', zIndex: 999, pointerEvents: 'none'
        }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}

// ─── Agent Detail Drawer ──────────────────────────────────────────────────────
function AgentDrawer({ agent, detail, saving, onClose, onCheck, onUpgrade, onNudge }) {
  const [tab, setTab] = useState('checklist'); // 'checklist' | 'activity'

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const checklist = detail?.checklist || [];
  const activityLog = detail?.activityLog || [];
  const isIC = agent.tier === 'inner_circle';

  const visibleEntries = checklist.filter(e => e.visible || e.checked);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,10,0.45)' }} />
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 520,
        background: C.paper, boxShadow: '0 12px 32px rgba(10,10,10,0.15)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.28s cubic-bezier(0.4,0,0.2,1)'
      }}>
        <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Header */}
        <div style={{ background: C.ink, padding: '20px 24px', borderBottom: `2px solid ${C.gold}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 16, background: 'transparent', border: 0, fontSize: 26, color: C.textFaint, cursor: 'pointer' }}>×</button>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 20, fontWeight: 700, color: C.cream }}>
            {agent.first_name} {agent.last_name}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: C.textFaint }}>{agent.email}</span>
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: agent.tier === 'elite' ? C.goldBright : C.inkSoft, color: agent.tier === 'elite' ? C.ink : C.textFaint, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {agent.tier === 'elite' ? 'Elite' : 'Inner Circle'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 13 }}>
            <span style={{ color: C.textFaint }}>Day {agent.daysSinceStart || 0}</span>
            <span style={{ color: C.goldBright, fontWeight: 700 }}>{agent.progress?.pct || 0}% complete</span>
            <span style={{ color: C.textFaint }}>Started {fmtDate(agent.start_date)}</span>
          </div>
        </div>

        {/* Action bar */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
          <button
            onClick={() => onNudge(agent.id)}
            style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.line}`, background: C.cream, color: C.text, fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Send Nudge
          </button>
          {isIC && (
            <button
              onClick={() => onUpgrade(agent.id)}
              disabled={saving}
              style={{ padding: '8px 14px', borderRadius: 8, border: 0, background: C.gold, color: C.ink, fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Upgrade to Elite
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
          {[{ key: 'checklist', label: 'Checklist' }, { key: 'activity', label: 'Activity' }].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '12px 0', background: 'transparent',
                border: 0, borderBottom: `2px solid ${tab === t.key ? C.gold : 'transparent'}`,
                color: tab === t.key ? C.ink : C.textMuted,
                fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {tab === 'checklist' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!detail ? (
                <div style={{ color: C.textFaint, fontSize: 13, textAlign: 'center', padding: 24 }}>Loading checklist…</div>
              ) : visibleEntries.map(entry => {
                const { item, checked, checked_at, is_overdue } = entry;
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      background: checked ? C.successBg : (is_overdue ? C.overdueBg : C.cream),
                      border: `1px solid ${checked ? '#C5DEAF' : (is_overdue ? C.overdue : C.line)}`,
                      borderRadius: 8, fontSize: 14
                    }}
                  >
                    {/* Num */}
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 700, color: checked ? C.success : C.goldDark, background: checked ? 'rgba(67,122,34,0.12)' : 'rgba(178,129,71,0.10)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
                      {String(item.id).padStart(2, '0')}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: checked ? '#2F5817' : C.text, fontSize: 13, textDecoration: checked ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 11, color: C.textFaint }}>
                        {OWNER_LABEL[item.owner] || item.owner}
                        {checked && checked_at ? ` · ${fmtDate(checked_at)}` : ''}
                        {is_overdue ? <span style={{ color: C.overdue, marginLeft: 6, fontWeight: 700 }}>OVERDUE</span> : ''}
                      </div>
                    </div>
                    {/* Check button */}
                    <button
                      onClick={() => onCheck(agent.id, item.id, !checked)}
                      disabled={saving}
                      style={{
                        padding: '4px 10px', borderRadius: 6,
                        border: `1px solid ${checked ? '#C5DEAF' : C.line}`,
                        background: checked ? '#D4F0B8' : C.paper,
                        color: checked ? '#2F5817' : C.textMuted,
                        fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      {checked ? 'Undo' : 'Check'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'activity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activityLog.length === 0 ? (
                <div style={{ color: C.textFaint, fontSize: 13, textAlign: 'center', padding: 24 }}>No activity yet.</div>
              ) : activityLog.map((entry, idx) => (
                <div key={idx} style={{ padding: '10px 14px', background: C.cream, border: `1px solid ${C.line}`, borderRadius: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{entry.item_title}</div>
                  <div style={{ fontSize: 12, color: C.textFaint, marginTop: 3 }}>
                    {fmtDateTime(entry.checked_at)} · {entry.checked_by || 'unknown'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Agent Modal ──────────────────────────────────────────────────────────
function AddAgentModal({ form, setForm, saving, onClose, onSubmit }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const field = (label, key, type = 'text', opts = null) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>{label}</label>
      {opts ? (
        <select
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value }))}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.line}`, background: C.paper, fontSize: 14, fontFamily: 'Inter, sans-serif', color: C.text }}
        >
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.line}`, background: C.paper, fontSize: 14, fontFamily: 'Inter, sans-serif', color: C.text, boxSizing: 'border-box' }}
        />
      )}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,10,0.5)' }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '100%', maxWidth: 480, background: C.paper, borderRadius: 12, padding: 32,
        boxShadow: '0 20px 60px rgba(10,10,10,0.2)'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 0, fontSize: 26, color: C.textFaint, cursor: 'pointer' }}>×</button>
        <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 20, fontWeight: 700, color: C.ink, margin: '0 0 24px' }}>Add New Agent</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div>{field('First Name', 'first_name')}</div>
          <div>{field('Last Name', 'last_name')}</div>
        </div>
        {field('Email', 'email', 'email')}
        {field('Tier', 'tier', 'text', [
          { value: 'inner_circle', label: 'Inner Circle' },
          { value: 'elite', label: 'Inner Circle Elite' }
        ])}
        {field('Paid In Full?', 'paid_in_full', 'text', [
          { value: 'false', label: 'No' },
          { value: 'true', label: 'Yes' }
        ])}
        {field('Start Date', 'start_date', 'date')}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '12px 0', borderRadius: 8, border: `1px solid ${C.line}`, background: C.cream, color: C.text, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            style={{ flex: 2, padding: '12px 0', borderRadius: 8, border: 0, background: C.ink, color: C.goldBright, fontFamily: 'DM Sans, sans-serif', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Adding…' : 'Add Agent + Init Checklist'}
          </button>
        </div>
      </div>
    </div>
  );
}
