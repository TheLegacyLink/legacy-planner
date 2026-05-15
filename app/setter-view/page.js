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

function ctDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function bookingDateKeyFromRequested(value = '') {
  const m = String(value || '').match(/(\d{4}-\d{2}-\d{2})/);
  return m?.[1] || '';
}

function bookingDayTag(requestedAt = '') {
  const dateKey = bookingDateKeyFromRequested(requestedAt);
  if (!dateKey) return '';
  const todayKey = ctDateKey(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = ctDateKey(tomorrow);
  if (dateKey === todayKey) return 'today';
  if (dateKey === tomorrowKey) return 'tomorrow';
  return '';
}

function isWithinPriorityWindow(booking) {
  if (!booking?.priority_agent || booking?.priority_released) return false;
  if (!booking?.priority_expires_at) return false;
  const exp = new Date(booking.priority_expires_at);
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() > Date.now();
}

const TZ_ZONES = [
  { label: 'ET', tz: 'America/New_York' },
  { label: 'CT', tz: 'America/Chicago' },
  { label: 'MT', tz: 'America/Denver' },
  { label: 'PT', tz: 'America/Los_Angeles' },
];

function fmtApptInZone(dt, tz) {
  return dt.toLocaleString('en-US', {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function parseApptDate(requestedAtEst) {
  if (!requestedAtEst) return null;
  // Try direct parse first
  let dt = new Date(requestedAtEst);
  if (!Number.isNaN(dt.getTime())) return dt;
  // Try stripping natural language like "Apr 28, 2026 at 2:00 PM"
  const cleaned = String(requestedAtEst).replace(' at ', ' ');
  dt = new Date(cleaned);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function buildAppSubmitPrefillUrl(booking = {}) {
  const qp = new URLSearchParams();
  const push = (k, v) => { const val = String(v || '').trim(); if (val) qp.set(k, val); };
  push('ref', booking?.referral_code || '');
  push('firstName', booking?.applicant_first_name || '');
  push('lastName', booking?.applicant_last_name || '');
  push('name', booking?.applicant_name || '');
  push('email', booking?.applicant_email || '');
  push('phone', booking?.applicant_phone || '');
  push('state', booking?.applicant_state || '');
  push('licensed', booking?.licensed_status || '');
  push('referredBy', booking?.referred_by || '');
  return `/inner-circle-app-submit?${qp.toString()}`;
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
  const [sortBy, setSortBy] = useState('dateIn');
  const [sortDir, setSortDir] = useState('desc');

  function toggleSort(field) {
    if (sortBy === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  }
  const [bookingQueue, setBookingQueue] = useState([]);
  const [bookingLoading, setBookingLoading] = useState(true);

  async function loadBookings() {
    try {
      const res = await fetch('/api/sponsorship-bookings', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        const sorted = rows
          .filter((r) => r?.requested_at_est)
          .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        setBookingQueue(sorted);
      }
    } catch {
      // ignore
    } finally {
      setBookingLoading(false);
    }
  }

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
    loadBookings();
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

    // Sort
    rows = [...rows].sort((a, b) => {
      let valA = '', valB = '';
      if (sortBy === 'agent') {
        valA = resolveAgentName(a?.owner || a?.assignedTo || '').toLowerCase();
        valB = resolveAgentName(b?.owner || b?.assignedTo || '').toLowerCase();
      } else if (sortBy === 'name') {
        valA = displayLeadName(a).toLowerCase();
        valB = displayLeadName(b).toLowerCase();
      } else {
        // default: dateIn
        valA = a?.createdAt || a?.timestamp || '';
        valB = b?.createdAt || b?.timestamp || '';
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  }, [leads, search, filterSubmitted, sortBy, sortDir]);

  // Build a lookup map from booking queue: email → booking, normalized name → booking
  const bookedLookup = useMemo(() => {
    const byEmail = new Map();
    const byName = new Map();
    for (const b of bookingQueue) {
      const email = String(b?.applicant_email || '').trim().toLowerCase();
      const name = String(b?.applicant_name || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (email) byEmail.set(email, b);
      if (name) byName.set(name, b);
    }
    return { byEmail, byName };
  }, [bookingQueue]);

  function findBooking(lead) {
    const email = String(lead?.email || '').trim().toLowerCase();
    const name = String(lead?.name || displayLeadName(lead) || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (email && bookedLookup.byEmail.has(email)) return bookedLookup.byEmail.get(email);
    if (name && bookedLookup.byName.has(name)) return bookedLookup.byName.get(name);
    return null;
  }

  const bookingQueueDeduped = useMemo(() => {
    return Array.from(new Map((bookingQueue || []).map((b) => {
      const key = `${clean(b?.applicant_name || '')}|${String(b?.requested_at_est || '').trim()}|${String(b?.source_application_id || '').trim()}`;
      return [key, b];
    })).values());
  }, [bookingQueue]);

  const bookingQueueDaySummary = useMemo(() => {
    let today = 0;
    let tomorrow = 0;
    for (const b of bookingQueueDeduped) {
      const tag = bookingDayTag(b?.requested_at_est || '');
      if (tag === 'today') today += 1;
      if (tag === 'tomorrow') tomorrow += 1;
    }
    return { today, tomorrow };
  }, [bookingQueueDeduped]);

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
              <th style={{ minWidth: 160, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('name')}>
                Lead {sortBy === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : <span style={{ color: '#475569', fontSize: 11 }}>↕</span>}
              </th>
              <th style={{ minWidth: 80 }}>State</th>
              <th style={{ minWidth: 200 }}>Booked</th>
              <th style={{ minWidth: 110 }}>Date In</th>
              <th style={{ minWidth: 90 }}>Time Since</th>
              <th style={{ minWidth: 110 }}>Form Submitted</th>
              <th style={{ minWidth: 140, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('agent')}>
                Assigned To {sortBy === 'agent' ? (sortDir === 'asc' ? '↑' : '↓') : <span style={{ color: '#475569', fontSize: 11 }}>↕</span>}
              </th>
              <th style={{ minWidth: 260 }}>Reassign</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.slice(0, 500).map((r) => {
              const submitted = Boolean(r?.submitted);
              const matchedBooking = findBooking(r);
              const booked = Boolean(matchedBooking) || Boolean(r?.booked);
              const bookedAt = matchedBooking?.created_at || matchedBooking?.requested_at_est || r?.bookedAt || '';
              const leadId = r?.id;
              const currentOwner = resolveAgentName(r?.owner || r?.assignedTo || '');
              const dateIn = r?.createdAt || r?.timestamp || '';
              const isAssigning = Boolean(assigning[leadId]);
              const msg = assignMsg[leadId] || '';

              return (
                <tr key={leadId} style={booked ? { background: 'rgba(234,179,8,0.13)', boxShadow: 'inset 3px 0 0 #f59e0b', borderLeft: '3px solid #f59e0b' } : {}}>
                  <td>
                    <div style={{ fontWeight: 600, color: booked ? '#fbbf24' : undefined }}>{displayLeadName(r)}</div>
                    <small className="muted">{r?.email || r?.phone || '—'}</small>
                  </td>
                  <td style={{ fontSize: 13, color: '#94a3b8' }}>
                    {matchedBooking?.applicant_state || r?.state || '—'}
                  </td>
                  <td>
                    {booked ? (() => {
                      const apptRaw = matchedBooking?.requested_at_est || '';
                      const apptTz = matchedBooking?.booking_timezone || '';
                      const apptDt = parseApptDate(apptRaw);
                      // Determine which zone label matches their timezone string
                      const theirZone = TZ_ZONES.find((z) => apptTz.toUpperCase().includes(z.label)) || TZ_ZONES[0];
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            background: '#f59e0b',
                            color: '#000',
                            letterSpacing: 0.4,
                            width: 'fit-content',
                          }}>📅 BOOKED</span>
                          {apptDt ? (
                            <>
                              <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>
                                {fmtApptInZone(apptDt, theirZone.tz)} {theirZone.label}
                              </span>
                              <span style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
                                {TZ_ZONES.filter((z) => z.label !== theirZone.label).map((z) => (
                                  <span key={z.label} style={{ marginRight: 6 }}>
                                    <span style={{ color: '#64748b' }}>{z.label}:</span> {new Date(apptDt).toLocaleString('en-US', { timeZone: z.tz, hour: 'numeric', minute: '2-digit', hour12: true })}
                                  </span>
                                ))}
                              </span>
                            </>
                          ) : apptRaw ? (
                            <span style={{ fontSize: 11, color: '#fbbf24' }}>{apptRaw}{apptTz ? ` (${apptTz})` : ''}</span>
                          ) : null}
                        </div>
                      );
                    })() : (
                      <span style={{ fontSize: 12, color: '#475569' }}>—</span>
                    )}
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

      {/* Sponsorship Booking Queue */}
      <div className="panel" style={{ marginTop: 24 }}>
        <div className="panelRow" style={{ gap: '1rem', flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Sponsorship Booking Queue</h3>
            <span className="muted" style={{ fontSize: 13 }}>Booked applicants and assigned policy writer</span>
          </div>
          <button type="button" className="ghost" style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: 13, borderRadius: 8 }} onClick={loadBookings}>↻ Refresh</button>
        </div>

        {bookingLoading ? (
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading bookings…</p>
        ) : !bookingQueueDeduped.length ? (
          <p className="muted">No bookings yet.</p>
        ) : (
          <>
            <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap', margin: '8px 0 14px' }}>
              <div className="card" style={{ minWidth: 120, padding: '10px 16px' }}><p style={{ margin: 0, fontSize: 12 }}>Today</p><h2 style={{ margin: '4px 0 0' }}>{bookingQueueDaySummary.today}</h2></div>
              <div className="card" style={{ minWidth: 120, padding: '10px 16px' }}><p style={{ margin: 0, fontSize: 12 }}>Tomorrow</p><h2 style={{ margin: '4px 0 0' }}>{bookingQueueDaySummary.tomorrow}</h2></div>
              <div className="card" style={{ minWidth: 120, padding: '10px 16px' }}><p style={{ margin: 0, fontSize: 12 }}>Total in Queue</p><h2 style={{ margin: '4px 0 0' }}>{bookingQueueDeduped.length}</h2></div>
              <div className="card" style={{ minWidth: 120, padding: '10px 16px' }}><p style={{ margin: 0, fontSize: 12 }}>Open (Unclaimed)</p><h2 style={{ margin: '4px 0 0' }}>{bookingQueueDeduped.filter((b) => String(b?.claim_status || '').toLowerCase() !== 'claimed').length}</h2></div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 780 }}>
                <thead>
                  <tr>
                    <th>Referral</th>
                    <th>Applicant</th>
                    <th>State</th>
                    <th>Booked At</th>
                    <th>Assigned Policy Writer</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingQueueDeduped.map((b) => {
                    const withinPriority = isWithinPriorityWindow(b);
                    const assignedTo = b.claimed_by || b.priority_agent || 'Unassigned';
                    const dayTag = bookingDayTag(b.requested_at_est || '');
                    return (
                      <tr key={b.id}>
                        <td style={{ fontSize: 13 }}>{b.referred_by || '—'}</td>
                        <td style={{ fontSize: 13, fontWeight: 600 }}>{b.applicant_name || '—'}</td>
                        <td style={{ fontSize: 13 }}>{b.applicant_state || '—'}</td>
                        <td style={{ fontSize: 13 }}>
                          {b.requested_at_est || '—'}{b.booking_timezone ? ` (${b.booking_timezone})` : ''}
                          {dayTag === 'today' ? <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#f59e0b', color: '#fff' }}>TODAY</span> : null}
                          {dayTag === 'tomorrow' ? <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#2563eb', color: '#fff' }}>TOMORROW</span> : null}
                        </td>
                        <td style={{ fontSize: 13 }}>{assignedTo}</td>
                        <td>
                          {b.claim_status === 'Claimed' ? (
                            <span className="pill onpace">✅ Booked + Assigned</span>
                          ) : withinPriority ? (
                            <span className="pill atrisk">✅ Booked • Locked (24h)</span>
                          ) : (
                            <span className="pill atrisk">✅ Booked • Unassigned</span>
                          )}
                        </td>
                        <td>
                          <a href={buildAppSubmitPrefillUrl(b)}>
                            <button type="button" className="ghost" style={{ fontSize: 12, padding: '4px 12px' }}>Submit App</button>
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      </div>{/* end padding */}
    </div>
  );
}
