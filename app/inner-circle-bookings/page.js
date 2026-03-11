'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

function fmt(iso = '') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function clean(v = '') {
  return String(v || '').trim();
}

function parseRequestedAtEst(raw = '') {
  const m = clean(raw).match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  const [, dateKey, hRaw, minRaw, apRaw] = m;
  let h = Number(hRaw || 0);
  const mm = Number(minRaw || 0);
  const ap = String(apRaw || '').toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return { dateKey, minutes: h * 60 + mm };
}

function minutesTo12h(minutes = 0) {
  const m = Number(minutes || 0);
  const hh24 = ((Math.floor(m / 60) % 24) + 24) % 24;
  const mm = ((m % 60) + 60) % 60;
  const ap = hh24 >= 12 ? 'PM' : 'AM';
  const hh12 = hh24 % 12 === 0 ? 12 : hh24 % 12;
  return `${hh12}:${String(mm).padStart(2, '0')} ${ap}`;
}

function callTimeEtCt(raw = '') {
  const parsed = parseRequestedAtEst(raw);
  if (!parsed) return { et: raw || '—', ct: '—' };
  return {
    et: `${parsed.dateKey} ${minutesTo12h(parsed.minutes)} ET`,
    ct: `${parsed.dateKey} ${minutesTo12h(parsed.minutes - 60)} CT`
  };
}

function memberReady(member = {}) {
  return Boolean(member?.contractSignedAt) && Boolean(member?.paymentReceivedAt) && Boolean(member?.hasPassword);
}

export default function InnerCircleBookingsPage() {
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tab, setTab] = useState('overview');
  const [statusFilter, setStatusFilter] = useState('all');
  const [savingId, setSavingId] = useState('');
  const [sendingContractId, setSendingContractId] = useState('');
  const [sendingMeetingId, setSendingMeetingId] = useState('');
  const [hubMembers, setHubMembers] = useState([]);
  const [hubProgressRows, setHubProgressRows] = useState([]);
  const [hubProgressMonth, setHubProgressMonth] = useState('');
  const [savingHubId, setSavingHubId] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [appsRes, bookingsRes, hubRes, progressRes] = await Promise.all([
        fetch('/api/inner-circle-application', { cache: 'no-store' }),
        fetch('/api/inner-circle-bookings', { cache: 'no-store' }),
        fetch('/api/inner-circle-hub-members', { cache: 'no-store' }),
        fetch('/api/inner-circle-hub-progress', { cache: 'no-store' })
      ]);

      const appsData = await appsRes.json().catch(() => ({}));
      const bookingData = await bookingsRes.json().catch(() => ({}));
      const hubData = await hubRes.json().catch(() => ({}));
      const progressData = await progressRes.json().catch(() => ({}));

      if (appsRes.ok && appsData?.ok) setApps(Array.isArray(appsData.rows) ? appsData.rows : []);
      if (bookingsRes.ok && bookingData?.ok) setBookings(Array.isArray(bookingData.rows) ? bookingData.rows : []);
      if (hubRes.ok && hubData?.ok) setHubMembers(Array.isArray(hubData.rows) ? hubData.rows : []);
      if (progressRes.ok && progressData?.ok) {
        setHubProgressRows(Array.isArray(progressData.rows) ? progressData.rows : []);
        setHubProgressMonth(clean(progressData.month || ''));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const totalApps = apps.length;
    const qualifiedApps = apps.filter((a) => Boolean(a?.qualified)).length;
    const notQualifiedApps = totalApps - qualifiedApps;

    const totalBookings = bookings.length;
    const byStatus = bookings.reduce((acc, b) => {
      const s = clean(b?.booking_status || 'booked').toLowerCase();
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    return {
      totalApps,
      qualifiedApps,
      notQualifiedApps,
      totalBookings,
      booked: byStatus.booked || 0,
      confirmed: byStatus.confirmed || 0,
      completed: byStatus.completed || 0,
      no_show: byStatus.no_show || 0,
      rescheduled: byStatus.rescheduled || 0,
      canceled: byStatus.canceled || 0
    };
  }, [apps, bookings]);

  const filteredBookings = useMemo(() => {
    if (statusFilter === 'all') return bookings;
    return bookings.filter((b) => clean(b?.booking_status || 'booked').toLowerCase() === statusFilter);
  }, [bookings, statusFilter]);

  const memberByBookingId = useMemo(() => {
    const m = new Map();
    for (const row of (hubMembers || [])) {
      const key = clean(row?.bookingId || '');
      if (key) m.set(key, row);
    }
    return m;
  }, [hubMembers]);

  async function updateBookingStatus(id, bookingStatus, ownerNotes = '') {
    if (!id) return;
    setSavingId(id);
    try {
      const res = await fetch('/api/inner-circle-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'update_status', id, bookingStatus, ownerNotes })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) return;
      await load();
    } finally {
      setSavingId('');
    }
  }

  async function sendContractInvite(bookingId = '') {
    if (!bookingId) return;
    setSendingContractId(bookingId);
    try {
      const res = await fetch('/api/inner-circle-contract-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) return;
      await load();
    } finally {
      setSendingContractId('');
    }
  }

  async function sendMeetingEmail(bookingId = '') {
    if (!bookingId) return;
    setSendingMeetingId(bookingId);
    try {
      const res = await fetch('/api/inner-circle-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'send_attendee_confirmation', id: bookingId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) return;
      await load();
    } finally {
      setSendingMeetingId('');
    }
  }

  async function ensureHubMember(booking = {}) {
    const bookingId = clean(booking?.id || '');
    if (!bookingId) return;
    setSavingHubId(bookingId);
    try {
      await fetch('/api/inner-circle-hub-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert_from_booking',
          bookingId,
          applicantName: booking?.applicant_name || '',
          email: booking?.applicant_email || ''
        })
      });
      await load();
    } finally {
      setSavingHubId('');
    }
  }

  async function setHubPassword(memberId = '') {
    const pwd = typeof window !== 'undefined' ? window.prompt('Set temporary password for this member:') : '';
    if (!memberId || !clean(pwd)) return;
    setSavingHubId(memberId);
    try {
      await fetch('/api/inner-circle-hub-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_password', memberId, password: pwd })
      });
      await load();
    } finally {
      setSavingHubId('');
    }
  }

  async function setHubFlags(member = {}, patch = {}) {
    const memberId = clean(member?.id || '');
    if (!memberId) return;
    const contractSigned = 'contractSigned' in patch ? Boolean(patch.contractSigned) : Boolean(member?.contractSignedAt);
    const paymentReceived = 'paymentReceived' in patch ? Boolean(patch.paymentReceived) : Boolean(member?.paymentReceivedAt);
    const active = 'active' in patch ? Boolean(patch.active) : Boolean(member?.active);

    setSavingHubId(memberId);
    try {
      await fetch('/api/inner-circle-hub-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_flags', memberId, contractSigned, paymentReceived, active })
      });
      await load();
    } finally {
      setSavingHubId('');
    }
  }

  async function setHubModules(member = {}, modules = {}) {
    const memberId = clean(member?.id || '');
    if (!memberId) return;
    setSavingHubId(memberId);
    try {
      await fetch('/api/inner-circle-hub-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_modules', memberId, modules })
      });
      await load();
    } finally {
      setSavingHubId('');
    }
  }

  return (
    <AppShell title="Inner Circle Bookings">
      <div className="panel" style={{ marginBottom: 10 }}>
        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className={tab === 'overview' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTab('overview')}>Overview</button>
          <button type="button" className={tab === 'applications' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTab('applications')}>Applications ({stats.totalApps})</button>
          <button type="button" className={tab === 'bookings' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTab('bookings')}>Bookings ({stats.totalBookings})</button>
          <button type="button" className="ghost" onClick={load}>Refresh</button>
        </div>
      </div>

      {tab === 'overview' ? (
        <div className="panel" style={{ marginBottom: 10 }}>
          <h3 style={{ marginTop: 0 }}>Pipeline Snapshot</h3>
          {loading ? <p className="muted">Loading...</p> : null}
          <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="pill">Applications: {stats.totalApps}</span>
            <span className="pill onpace">Qualified: {stats.qualifiedApps}</span>
            <span className="pill atrisk">Not Qualified: {stats.notQualifiedApps}</span>
            <span className="pill">Bookings: {stats.totalBookings}</span>
            <span className="pill">Completed: {stats.completed}</span>
            <span className="pill atrisk">No Show: {stats.no_show}</span>
          </div>

          <div style={{ marginTop: 12 }}>
            <h4 style={{ marginBottom: 6 }}>Hub Progress Snapshot {hubProgressMonth ? `(${hubProgressMonth})` : ''}</h4>
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Hub Active</th>
                  <th>Leads</th>
                  <th>Bookings</th>
                  <th>Closes</th>
                  <th>Close Rate</th>
                  <th>Tracker Days</th>
                </tr>
              </thead>
              <tbody>
                {hubProgressRows.map((r) => (
                  <tr key={r.id || r.email}>
                    <td>{r.applicantName || '—'}<br /><small className="muted">{r.email || '—'}</small></td>
                    <td>{r.active ? 'Active' : 'Locked'}</td>
                    <td>{r?.kpi?.leadsReceived ?? 0}</td>
                    <td>{r?.kpi?.bookingsThisMonth ?? 0}</td>
                    <td>{r?.kpi?.closesThisMonth ?? 0}</td>
                    <td>{r?.kpi?.closeRate ?? 0}%</td>
                    <td>{r?.trackerDaysLogged ?? 0}</td>
                  </tr>
                ))}
                {!hubProgressRows.length ? <tr><td colSpan={7} className="muted">No hub members yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'applications' ? (
        <div className="panel" style={{ marginBottom: 10 }}>
          <h3 style={{ marginTop: 0 }}>Inner Circle Applications</h3>
          <table>
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Applicant</th>
                <th>Status</th>
                <th>Score</th>
                <th>Financial Readiness</th>
                <th>Goal (90d)</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id}>
                  <td>{fmt(a.submittedAt)}</td>
                  <td>
                    <div>{a.fullName || '—'}</div>
                    <small className="muted">{a.email || '—'} • {a.phone || '—'}</small>
                  </td>
                  <td>{a.qualified ? 'Qualified' : 'Not Qualified'}</td>
                  <td>{a.qualificationScore ?? '—'}</td>
                  <td>{a.financialReady || '—'}</td>
                  <td>{a.incomeGoal90 || '—'}</td>
                </tr>
              ))}
              {!apps.length ? <tr><td colSpan={6} className="muted">No applications yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'bookings' ? (
        <div className="panel" style={{ marginBottom: 10 }}>
          <div className="panelRow" style={{ marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>Inner Circle Call Bookings</h3>
            <label>
              Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ marginLeft: 6 }}>
                <option value="all">All</option>
                <option value="booked">Booked</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="no_show">No Show</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="canceled">Canceled</option>
              </select>
            </label>
          </div>

          <table>
            <thead>
              <tr>
                <th>Booked</th>
                <th>Applicant</th>
                <th>Call Time</th>
                <th>Status</th>
                <th>Contract</th>
                <th>Hub Access</th>
                <th>Owner Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((b) => (
                <tr key={b.id}>
                  <td>{fmt(b.created_at)}</td>
                  <td>
                    <div>{b.applicant_name || '—'}</div>
                    <small className="muted">{b.applicant_email || '—'} • {b.applicant_phone || '—'}</small>
                  </td>
                  <td>
                    {(() => {
                      const t = callTimeEtCt(b.requested_at_est || '');
                      return (
                        <div>
                          <div>{t.et || '—'}</div>
                          <small className="muted">{t.ct}</small>
                        </div>
                      );
                    })()}
                  </td>
                  <td>
                    <select
                      value={clean(b.booking_status || 'booked').toLowerCase()}
                      onChange={(e) => updateBookingStatus(b.id, e.target.value, b.owner_notes || '')}
                      disabled={savingId === b.id}
                    >
                      <option value="booked">Booked</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="no_show">No Show</option>
                      <option value="rescheduled">Rescheduled</option>
                      <option value="canceled">Canceled</option>
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <button
                        type="button"
                        className="ghost"
                        disabled={sendingMeetingId === b.id}
                        onClick={() => sendMeetingEmail(b.id)}
                      >
                        {sendingMeetingId === b.id ? 'Sending...' : 'Send Meeting Email'}
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        disabled={sendingContractId === b.id}
                        onClick={() => sendContractInvite(b.id)}
                      >
                        {sendingContractId === b.id ? 'Sending...' : 'Send Contract'}
                      </button>
                      <small className="muted">
                        Contract Sent: {b.contract_invite_count || 0}
                        {b.contract_invite_sent_at ? ` • ${fmt(b.contract_invite_sent_at)}` : ''}
                      </small>
                      <small className="muted">
                        Meeting Email: {b.meeting_email_sent_count || 0}
                        {b.meeting_email_sent_at ? ` • ${fmt(b.meeting_email_sent_at)}` : ''}
                      </small>
                    </div>
                  </td>
                  <td>
                    {(() => {
                      const member = memberByBookingId.get(clean(b.id));
                      if (!member) {
                        return (
                          <button
                            type="button"
                            className="ghost"
                            disabled={savingHubId === b.id}
                            onClick={() => ensureHubMember(b)}
                          >
                            {savingHubId === b.id ? 'Creating...' : 'Create Hub Member'}
                          </button>
                        );
                      }
                      const ready = memberReady(member);
                      return (
                        <div style={{ display: 'grid', gap: 6 }}>
                          <small className="muted">{member.email}</small>
                          <small className="muted">Ready to Activate: {ready ? 'Yes' : 'No'}</small>
                          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="checkbox"
                              checked={Boolean(member.contractSignedAt)}
                              onChange={(e) => setHubFlags(member, { contractSigned: e.target.checked })}
                            /> Contract Signed
                          </label>
                          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="checkbox"
                              checked={Boolean(member.paymentReceivedAt)}
                              onChange={(e) => setHubFlags(member, { paymentReceived: e.target.checked })}
                            /> Payment Received
                          </label>
                          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="checkbox"
                              checked={Boolean(member.active)}
                              disabled={!ready && !member.active}
                              onChange={(e) => setHubFlags(member, { active: e.target.checked })}
                            /> Hub Active
                          </label>
                          {!member?.hasPassword ? <small className="muted">Password not set yet.</small> : null}
                          <button
                            type="button"
                            className="ghost"
                            disabled={savingHubId === member.id}
                            onClick={() => setHubPassword(member.id)}
                          >
                            {member?.hasPassword ? 'Reset Password' : 'Set Password'}
                          </button>
                          <div style={{ display: 'grid', gap: 4 }}>
                            <small className="muted">Module Access</small>
                            {[
                              ['dashboard', 'Dashboard'],
                              ['faststart', 'Fast Start'],
                              ['scripts', 'Scripts'],
                              ['execution', 'Execution'],
                              ['vault', 'Vault'],
                              ['tracker', 'Tracker']
                            ].map(([key, label]) => (
                              <label key={key} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={member?.modules?.[key] !== false}
                                  onChange={(e) => setHubModules(member, { ...(member?.modules || {}), [key]: e.target.checked })}
                                /> {label}
                              </label>
                            ))}
                            <button
                              type="button"
                              className="ghost"
                              disabled={savingHubId === member.id}
                              onClick={() => setHubModules(member, { dashboard: true, faststart: true, scripts: true, execution: true, vault: true, tracker: true })}
                            >
                              Set Full Modules
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              disabled={savingHubId === member.id}
                              onClick={() => setHubModules(member, { dashboard: true, faststart: true, scripts: true, execution: true, vault: false, tracker: false })}
                            >
                              Set Core Modules
                            </button>
                          </div>
                          {!ready ? <small className="muted">Activation requires contract + payment + password.</small> : null}
                        </div>
                      );
                    })()}
                  </td>
                  <td>
                    <textarea
                      rows={2}
                      defaultValue={b.owner_notes || ''}
                      placeholder="Owner notes"
                      onBlur={(e) => updateBookingStatus(b.id, clean(b.booking_status || 'booked').toLowerCase(), e.target.value)}
                    />
                  </td>
                </tr>
              ))}
              {!filteredBookings.length ? <tr><td colSpan={7} className="muted">No bookings in this view.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </AppShell>
  );
}
