'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/AppShell';

const GOLD = '#C8A96B';
const GOLD_LIGHT = '#E6D1A6';
const PANEL_BG = '#111827';
const PANEL_BORDER = '#1E2A45';
const PAGE_BG = '#0B1020';

function timeAgo(iso = '') {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Math.max(0, Date.now() - d.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function clean(v = '') {
  return String(v || '').trim();
}

const STATUS_META = {
  New:             { label: 'New',            color: '#22d3ee', icon: '🔵' },
  Assigned:        { label: 'Assigned',       color: '#a78bfa', icon: '🟣' },
  Contacted:       { label: 'Contacted',      color: '#f59e0b', icon: '🟡' },
  Booked:          { label: 'Booked',         color: '#86efac', icon: '🟢' },
  'No Answer':     { label: 'No Answer',      color: '#fb923c', icon: '🟠' },
  'No-Show':       { label: 'No-Show',        color: '#f87171', icon: '🔴' },
  'Not Interested':{ label: 'Not Interested', color: '#94a3b8', icon: '⚫' },
  Overflow:        { label: 'Overflow',       color: '#fbbf24', icon: '🟤' },
  Submitted:       { label: 'App Submitted',  color: GOLD,      icon: '✅' },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status || 'Unknown', color: '#94a3b8', icon: '•' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: `${meta.color}22`, color: meta.color,
      border: `1px solid ${meta.color}44`, whiteSpace: 'nowrap',
    }}>
      {meta.icon} {meta.label}
    </span>
  );
}

function StatCard({ label, value, color, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: active ? `rgba(200,169,107,0.08)` : PANEL_BG,
      border: `1px solid ${active ? GOLD : PANEL_BORDER}`,
      borderRadius: 14, padding: '18px 20px',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color 0.15s', minWidth: 0, flex: '1 1 130px',
    }}>
      <p style={{ margin: '0 0 6px', color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: color || '#f1f5f9' }}>{value}</h2>
    </div>
  );
}

export default function LeadHubPage() {
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [lastLoaded, setLastLoaded] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/lead-router', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rawLeads = Array.isArray(data?.calledLeadRows)
        ? data.calledLeadRows
        : Array.isArray(data?.leads)
          ? data.leads
          : [];
      setLeads(rawLeads);
      setAgents(Array.isArray(data?.agents) ? data.agents : []);
      setLastLoaded(new Date());
    } catch (e) {
      setError(String(e?.message || 'Failed to load leads'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const newToday    = leads.filter((l) => new Date(l.createdAt || l.importedAt || 0) >= todayStart).length;
    const assigned    = leads.filter((l) => clean(l.status) === 'Assigned' || clean(l.assignedTo || l.assignedAgentName)).length;
    const booked      = leads.filter((l) => ['Booked'].includes(clean(l.status))).length;
    const uncontacted = leads.filter((l) => ['New'].includes(clean(l.status))).length;
    const overflow    = leads.filter((l) => clean(l.status) === 'Overflow').length;
    const submitted   = leads.filter((l) => clean(l.status) === 'Submitted' || clean(l.appSubmitted) === 'true').length;
    const activeAgents = agents.filter((a) => a.active).length;
    return { total: leads.length, newToday, assigned, booked, uncontacted, overflow, submitted, activeAgents };
  }, [leads, agents]);

  const filtered = useMemo(() => leads.filter((l) => {
    if (statusFilter !== 'all' && clean(l.status) !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${l.name || ''} ${l.fullName || ''} ${l.email || ''} ${l.phone || ''} ${l.assignedTo || ''} ${l.assignedAgentName || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [leads, search, statusFilter]);

  const allStatuses = useMemo(() => {
    const seen = new Set(leads.map((l) => clean(l.status)).filter(Boolean));
    return ['all', ...Array.from(seen).sort()];
  }, [leads]);

  const todayNewCount = stats.newToday;

  return (
    <AppShell title="Lead Hub">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, background: PAGE_BG, minHeight: '100vh', padding: '0 0 60px' }}>

        {/* Quick Links */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { href: '/lead-router',                    label: '⚡ Lead Router' },
            { href: '/lead-claims',                    label: '📋 Lead Claims' },
            { href: '/lead-marketplace',               label: '🛒 Lead Marketplace' },
            { href: '/linkleads',                      label: '🔗 Link Leads' },
            { href: '/appointment-setter-backoffice',  label: '📞 Setter Board' },
            { href: '/lead-claims-manager',            label: '🗂 Claims Manager' },
          ].map(({ href, label }) => (
            <a key={href} href={href} style={{
              padding: '8px 16px', borderRadius: 999,
              border: `1px solid ${PANEL_BORDER}`, background: PANEL_BG,
              color: '#e2e8f0', textDecoration: 'none',
              fontSize: 13, fontWeight: 600,
            }}>{label}</a>
          ))}
          <button type="button" onClick={load} style={{
            marginLeft: 'auto', padding: '8px 16px', borderRadius: 999,
            border: `1px solid ${PANEL_BORDER}`, background: 'transparent',
            color: GOLD, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>↻ Refresh</button>
          {lastLoaded && (
            <span style={{ color: '#475569', fontSize: 12 }}>Updated {timeAgo(lastLoaded.toISOString())}</span>
          )}
        </div>

        {/* New Leads Today Banner */}
        {todayNewCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 20px', borderRadius: 12,
            background: `rgba(200,169,107,0.1)`, border: `1.5px solid ${GOLD}`,
          }}>
            <span style={{
              background: GOLD, color: '#0B1020', fontWeight: 900, fontSize: 22,
              minWidth: 40, height: 40, display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', borderRadius: '50%', flexShrink: 0,
            }}>{todayNewCount}</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: GOLD_LIGHT, fontSize: 15 }}>New leads came in today</p>
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                {todayNewCount} lead{todayNewCount !== 1 ? 's' : ''} arrived today — ready to distribute
              </p>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatCard label="Total Leads"    value={stats.total}        onClick={() => setStatusFilter('all')}          active={statusFilter === 'all'} />
          <StatCard label="New"            value={stats.uncontacted}  color="#22d3ee" onClick={() => setStatusFilter('New')}        active={statusFilter === 'New'} />
          <StatCard label="Assigned"       value={stats.assigned}     color="#a78bfa" onClick={() => setStatusFilter('Assigned')}   active={statusFilter === 'Assigned'} />
          <StatCard label="Booked"         value={stats.booked}       color="#86efac" onClick={() => setStatusFilter('Booked')}     active={statusFilter === 'Booked'} />
          <StatCard label="App Submitted"  value={stats.submitted}    color={GOLD}    onClick={() => setStatusFilter('Submitted')}  active={statusFilter === 'Submitted'} />
          <StatCard label="Overflow"       value={stats.overflow}     color="#fbbf24" onClick={() => setStatusFilter('Overflow')}   active={statusFilter === 'Overflow'} />
          <StatCard label="Active Agents"  value={stats.activeAgents} color="#38bdf8" />
        </div>

        {/* Search + Filter */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search by name, phone, email, agent…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '9px 14px', borderRadius: 8, border: `1px solid ${PANEL_BORDER}`,
              background: PANEL_BG, color: '#e2e8f0', fontSize: 13, minWidth: 260,
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '9px 12px', borderRadius: 8, border: `1px solid ${PANEL_BORDER}`,
              background: PANEL_BG, color: '#e2e8f0', fontSize: 13,
            }}
          >
            {allStatuses.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>
            ))}
          </select>
          <span style={{ color: '#64748b', fontSize: 13 }}>
            {filtered.length} lead{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid #ef444444', color: '#f87171', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Lead Table */}
        <div style={{ border: `1px solid ${PANEL_BORDER}`, borderRadius: 14, background: PANEL_BG, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, color: '#94a3b8', textAlign: 'center' }}>Loading leads…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, color: '#94a3b8', textAlign: 'center' }}>
              {leads.length === 0 ? 'No leads found. Check that the lead router is active.' : 'No leads match your filters.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: PAGE_BG, borderBottom: `1px solid ${PANEL_BORDER}` }}>
                  {['Name', 'Contact', 'Status', 'Assigned To', 'Source', 'State', 'Received'].map((h) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 150).map((lead, i) => {
                  const name = clean(lead.name || lead.fullName || lead.applicantName || '');
                  const phone = clean(lead.phone || lead.phoneNumber || lead.phone_number || '');
                  const email = clean(lead.email || '');
                  const assigned = clean(lead.assignedTo || lead.assignedAgentName || '');
                  const source = clean(lead.campaignSource || lead.source || lead.ad_name || '');
                  const state = clean(lead.state || lead.applicantState || '');
                  const received = lead.createdAt || lead.importedAt || lead.created_time || '';
                  return (
                    <tr key={lead.id || i} style={{ borderBottom: `1px solid ${PANEL_BORDER}22`, background: i % 2 === 0 ? 'transparent' : `${PANEL_BG}88` }}>
                      <td style={{ padding: '10px 14px', color: '#e2e8f0', fontWeight: 600 }}>{name || 'Unknown Lead'}</td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                        <div>{phone || '—'}</div>
                        {email && <div style={{ fontSize: 11, color: '#64748b' }}>{email}</div>}
                      </td>
                      <td style={{ padding: '10px 14px' }}><StatusBadge status={clean(lead.status)} /></td>
                      <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                        {assigned || <span style={{ color: '#475569' }}>Unassigned</span>}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{source || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{state || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{received ? timeAgo(received) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {filtered.length > 150 && (
            <div style={{ padding: '10px 16px', color: '#475569', fontSize: 12, borderTop: `1px solid ${PANEL_BORDER}` }}>
              Showing 150 of {filtered.length} leads — use filters to narrow down.
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
