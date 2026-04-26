'use client';

import { useEffect, useMemo, useState } from 'react';

function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(iso = '') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Math.max(0, Date.now() - d.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function displayLeadName(row = {}) {
  const name = String(row?.name || '').trim();
  if (name && name.toLowerCase() !== 'unknown lead') return name;
  const email = String(row?.email || '').trim();
  if (email.includes('@')) return email.split('@')[0];
  return 'Unknown Lead';
}

function clean(v = '') {
  return String(v || '').trim();
}

const AGENT_NAME_MAP = {
  kimora_link: 'Kimora Link', kimora: 'Kimora Link',
  jamal_holmes: 'Jamal Holmes', jamal: 'Jamal Holmes',
  mahogany_burns: 'Mahogany Burns', mahogany: 'Mahogany Burns',
  madalyn_adams: 'Madalyn Adams', madeline_adams: 'Madalyn Adams', madalyn: 'Madalyn Adams',
  kelin_brown: 'Kelin Brown', kelin: 'Kelin Brown', kellen_brown: 'Kelin Brown',
  leticia_wright: 'Leticia Wright', latricia_wright: 'Leticia Wright', letitia_wright: 'Leticia Wright', leticia: 'Leticia Wright',
  breanna_james: 'Breanna James', dr_brianna: 'Breanna James', dr_breanna: 'Breanna James', breanna: 'Breanna James',
  shannon_maxwell: 'Shannon Maxwell', shannon: 'Shannon Maxwell',
  donyell_richardson: 'Donyell Richardson', danielle_richardson: 'Donyell Richardson', donyell: 'Donyell Richardson', danielle: 'Donyell Richardson',
  andrea_cannon: 'Andrea Cannon', andrea: 'Andrea Cannon',
  angelique_lassiter: 'Angelique Lassiter', angelic_lassiter: 'Angelique Lassiter', angelique: 'Angelique Lassiter', angelic: 'Angelique Lassiter',
};

function resolveAgentName(raw = '') {
  const s = clean(raw);
  if (!s || s.toLowerCase() === 'unknown') return 'Kimora Link';
  // Try slug lookup first
  const slug = s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (AGENT_NAME_MAP[slug]) return AGENT_NAME_MAP[slug];
  // Try direct name match (already a proper name)
  const lower = s.toLowerCase();
  for (const val of Object.values(AGENT_NAME_MAP)) {
    if (val.toLowerCase() === lower) return val;
  }
  return s || 'Kimora Link';
}

const FALLBACK_AGENTS = [
  'Andrea Cannon',
  'Kimora Link',
  'Jamal',
  'Mahogany',
  'Letitia Wright',
  'Kelin',
  'Madeline',
  'Breanna',
  'Danielle',
  'Shannon',
  'Angelic',
];

export default function SetterViewPage() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [agentNames, setAgentNames] = useState(FALLBACK_AGENTS);
  const [monthScope, setMonthScope] = useState('current');
  const [assignTarget, setAssignTarget] = useState({});
  const [assigning, setAssigning] = useState({});
  const [assignMsg, setAssignMsg] = useState({});
  const [search, setSearch] = useState('');
  const [filterSubmitted, setFilterSubmitted] = useState('all');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/lead-router?runRelease=0&distributionMonthScope=${encodeURIComponent(monthScope)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.ok) {
        const allLeads = data.weekUnsubmittedLeads || [];
        setLeads(allLeads);

        // Pull agent names from API; fall back to hardcoded list
        const onboardRes = await fetch('/api/agent-onboarding', { cache: 'no-store' });
        const onboardData = await onboardRes.json().catch(() => ({}));
        if (onboardRes.ok && onboardData?.ok) {
          const rows = onboardData.rows || [];
          const innerNames = rows
            .filter((r) => String(r?.group || '').toLowerCase() === 'inner')
            .map((r) => String(r?.name || '').trim())
            .filter(Boolean);
          const fallback = (data.settings?.agents || [])
            .map((a) => String(a?.name || '').trim())
            .filter(Boolean);
          const merged = Array.from(new Set([...innerNames, ...fallback]));
          if (merged.length) setAgentNames(merged);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [monthScope]);

  async function assignLead(leadId) {
    const target = assignTarget[leadId];
    if (!target) return;
    setAssigning((prev) => ({ ...prev, [leadId]: true }));
    setAssignMsg((prev) => ({ ...prev, [leadId]: '' }));

    try {
      const res = await fetch('/api/lead-router', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'bulk-release-week-unsubmitted',
          strategy: 'agent',
          targetAgent: target,
          leadIds: [leadId],
          distributionMonthScope: monthScope,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setAssignMsg((prev) => ({ ...prev, [leadId]: `Failed: ${data?.error || 'error'}` }));
        return;
      }
      setAssignMsg((prev) => ({ ...prev, [leadId]: `✓ Assigned to ${target}` }));
      setTimeout(() => setAssignMsg((prev) => ({ ...prev, [leadId]: '' })), 2500);
      await load();
    } finally {
      setAssigning((prev) => ({ ...prev, [leadId]: false }));
    }
  }

  const filteredLeads = useMemo(() => {
    let rows = leads;

    if (filterSubmitted === 'submitted') rows = rows.filter((r) => Boolean(r?.submitted));
    if (filterSubmitted === 'not_submitted') rows = rows.filter((r) => !Boolean(r?.submitted));

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) =>
        displayLeadName(r).toLowerCase().includes(q) ||
        clean(r?.email).toLowerCase().includes(q) ||
        clean(r?.phone).toLowerCase().includes(q) ||
        clean(r?.owner).toLowerCase().includes(q)
      );
    }

    return rows;
  }, [leads, search, filterSubmitted]);

  const stats = useMemo(() => {
    const total = leads.length;
    const submitted = leads.filter((r) => Boolean(r?.submitted)).length;
    const notSubmitted = total - submitted;
    return { total, submitted, notSubmitted };
  }, [leads]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#94a3b8' }}>Loading leads…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9' }}>

      {/* Header */}
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: 0.5 }}>The Legacy Link — Setter View</span>
      </div>

      <div style={{ padding: '24px' }}>

      {/* Month scope toggle */}
      <div className="panelRow" style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="ghost"
          style={{
            padding: '6px 14px',
            fontSize: 13,
            borderRadius: 8,
            background: monthScope === 'current' ? '#0f766e' : undefined,
            color: monthScope === 'current' ? '#fff' : undefined,
          }}
          onClick={() => setMonthScope('current')}
        >
          Current Month
        </button>
        <button
          type="button"
          className="ghost"
          style={{
            padding: '6px 14px',
            fontSize: 13,
            borderRadius: 8,
            background: monthScope === 'previous' ? '#0f766e' : undefined,
            color: monthScope === 'previous' ? '#fff' : undefined,
          }}
          onClick={() => setMonthScope('previous')}
        >
          Previous Month
        </button>
        <button
          type="button"
          className="ghost"
          style={{ padding: '6px 14px', fontSize: 13, borderRadius: 8 }}
          onClick={load}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div className="panelRow" style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <span className="pill">Total Leads: {stats.total}</span>
        <span className="pill onpace">Form Submitted: {stats.submitted}</span>
        <span className="pill atrisk">Not Submitted: {stats.notSubmitted}</span>
      </div>

      {/* Filters */}
      <div className="panelRow" style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <input
          placeholder="Search by name, email, phone, or agent…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 260, padding: '6px 10px', borderRadius: 8, fontSize: 13 }}
        />
        <select
          value={filterSubmitted}
          onChange={(e) => setFilterSubmitted(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, fontSize: 13 }}
        >
          <option value="all">All Leads</option>
          <option value="submitted">Form Submitted</option>
          <option value="not_submitted">Not Submitted</option>
        </select>
        {(search || filterSubmitted !== 'all') && (
          <button
            type="button"
            className="ghost"
            style={{ padding: '6px 12px', fontSize: 13, borderRadius: 8 }}
            onClick={() => { setSearch(''); setFilterSubmitted('all'); }}
          >
            Clear
          </button>
        )}
        <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>
          Showing {filteredLeads.length} of {leads.length}
        </span>
      </div>

      {/* Leads table */}
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 780 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 180 }}>Lead</th>
              <th style={{ minWidth: 110 }}>Date In</th>
              <th style={{ minWidth: 90 }}>Time Since</th>
              <th style={{ minWidth: 110 }}>Form Submitted</th>
              <th style={{ minWidth: 140 }}>Assigned To</th>
              <th style={{ minWidth: 260 }}>Reassign</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.slice(0, 500).map((r) => {
              const submitted = Boolean(r?.submitted);
              const booked = Boolean(r?.booked);
              const bookedAt = r?.bookedAt || '';
              const leadId = r?.id;
              const currentOwner = resolveAgentName(r?.owner || r?.assignedTo || '');
              const dateIn = r?.createdAt || r?.timestamp || '';
              const isAssigning = Boolean(assigning[leadId]);
              const msg = assignMsg[leadId] || '';

              return (
                <tr key={leadId} style={booked ? { background: 'rgba(234,179,8,0.08)', boxShadow: 'inset 0 0 0 1px rgba(234,179,8,0.3)' } : {}}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{displayLeadName(r)}</div>
                    <small className="muted">{r?.email || r?.phone || '—'}</small>
                  </td>
                  <td style={{ fontSize: 13 }}>{fmt(dateIn)}</td>
                  <td style={{ fontSize: 13 }}>{timeAgo(dateIn)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        background: submitted ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.12)',
                        color: submitted ? '#059669' : '#dc2626',
                        border: submitted ? '1px solid rgba(16,185,129,.4)' : '1px solid rgba(239,68,68,.3)',
                      }}>
                        {submitted ? 'Yes' : 'No'}
                      </span>
                      {booked && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: 'rgba(234,179,8,0.18)',
                            color: '#a16207',
                            border: '1px solid rgba(234,179,8,0.5)',
                            letterSpacing: 0.3,
                          }}>Booked</span>
                          {bookedAt && (
                            <span style={{ fontSize: 10, color: '#a16207', paddingLeft: 2 }}>
                              {new Date(bookedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>{currentOwner || '—'}</td>
                  <td>
                    {booked ? (
                      <span style={{ fontSize: 12, color: '#a16207', fontStyle: 'italic' }}>Appointment scheduled</span>
                    ) : (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        value={assignTarget[leadId] || ''}
                        onChange={(e) => setAssignTarget((prev) => ({ ...prev, [leadId]: e.target.value }))}
                        style={{ padding: '4px 8px', borderRadius: 6, fontSize: 12 }}
                        disabled={isAssigning}
                      >
                        <option value="">— Select agent —</option>
                        {agentNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        style={{
                          padding: '4px 12px',
                          fontSize: 12,
                          borderRadius: 6,
                          opacity: (!assignTarget[leadId] || isAssigning) ? 0.5 : 1,
                        }}
                        onClick={() => assignLead(leadId)}
                        disabled={!assignTarget[leadId] || isAssigning}
                      >
                        {isAssigning ? 'Saving…' : 'Assign'}
                      </button>
                      {msg && (
                        <span style={{ fontSize: 11, color: msg.startsWith('✓') ? '#059669' : '#dc2626' }}>
                          {msg}
                        </span>
                      )}
                    </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!filteredLeads.length && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                  No leads found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      </div>{/* end padding */}
    </div>
  );
}
