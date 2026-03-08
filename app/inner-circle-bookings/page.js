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

export default function InnerCircleBookingsPage() {
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tab, setTab] = useState('overview');
  const [statusFilter, setStatusFilter] = useState('all');
  const [savingId, setSavingId] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [appsRes, bookingsRes] = await Promise.all([
        fetch('/api/inner-circle-application', { cache: 'no-store' }),
        fetch('/api/inner-circle-bookings', { cache: 'no-store' })
      ]);

      const appsData = await appsRes.json().catch(() => ({}));
      const bookingData = await bookingsRes.json().catch(() => ({}));

      if (appsRes.ok && appsData?.ok) setApps(Array.isArray(appsData.rows) ? appsData.rows : []);
      if (bookingsRes.ok && bookingData?.ok) setBookings(Array.isArray(bookingData.rows) ? bookingData.rows : []);
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
                  <td>{b.requested_at_est || '—'}</td>
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
                    <textarea
                      rows={2}
                      defaultValue={b.owner_notes || ''}
                      placeholder="Owner notes"
                      onBlur={(e) => updateBookingStatus(b.id, clean(b.booking_status || 'booked').toLowerCase(), e.target.value)}
                    />
                  </td>
                </tr>
              ))}
              {!filteredBookings.length ? <tr><td colSpan={5} className="muted">No bookings in this view.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </AppShell>
  );
}
