'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

function fmtDate(iso = '') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function parseRequested(value = '') {
  const m = String(value || '').match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  const [, date, hrRaw, mm, ap] = m;
  let hr = Number(hrRaw);
  const apu = ap.toUpperCase();
  if (apu === 'PM' && hr !== 12) hr += 12;
  if (apu === 'AM' && hr === 12) hr = 0;
  return new Date(`${date}T${String(hr).padStart(2, '0')}:${mm}:00-05:00`);
}

function urgencyLabel(dateObj) {
  if (!dateObj || Number.isNaN(dateObj.getTime())) return 'Scheduled';
  const diff = dateObj.getTime() - Date.now();
  if (diff < 0) return 'Past Due';
  if (diff <= 24 * 60 * 60 * 1000) return 'Today';
  if (diff <= 7 * 24 * 60 * 60 * 1000) return 'This Week';
  return 'Upcoming';
}

export default function BonusBookingsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/bonus-bookings', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) setRows(Array.isArray(data.rows) ? data.rows : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id, status) {
    await fetch('/api/bonus-bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, patch: { status } })
    }).catch(() => null);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const statusOk = statusFilter === 'all' || String(r.status || '').toLowerCase() === statusFilter;
      if (!statusOk) return false;
      if (!term) return true;
      const hay = `${r.name || ''} ${r.state || ''} ${r.requested_at_est || ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [rows, statusFilter, q]);

  const total = filtered.length;
  const booked = filtered.filter((r) => String(r.status || '').toLowerCase() === 'booked').length;
  const completed = filtered.filter((r) => String(r.status || '').toLowerCase() === 'completed').length;

  return (
    <AppShell title="Bonus Bookings">
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Who Has Booked (Bonus Calls)</h3>
        <div className="settingsGrid" style={{ marginTop: 8 }}>
          <label>
            Search
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, state, time..." />
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="booked">Booked</option>
              <option value="completed">Completed</option>
              <option value="no_show">No_Show</option>
            </select>
          </label>
        </div>

        <div className="grid4" style={{ marginTop: 10 }}>
          <div className="card"><p>Total</p><h2>{total}</h2></div>
          <div className="card"><p>Booked</p><h2>{booked}</h2></div>
          <div className="card"><p>Completed</p><h2>{completed}</h2></div>
          <div className="card"><p>Pending</p><h2>{Math.max(0, total - completed)}</h2></div>
        </div>
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        {loading ? <p className="muted">Loading...</p> : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>State</th>
                <th>Booked Time (EST)</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const d = parseRequested(r.requested_at_est);
                return (
                  <tr key={r.id}>
                    <td>{r.name || '—'}</td>
                    <td>{r.state || '—'}</td>
                    <td>{r.requested_at_est || '—'}</td>
                    <td>{urgencyLabel(d)}</td>
                    <td>
                      <select value={r.status || 'Booked'} onChange={(e) => setStatus(r.id, e.target.value)}>
                        <option value="Booked">Booked</option>
                        <option value="Completed">Completed</option>
                        <option value="No_Show">No_Show</option>
                      </select>
                    </td>
                    <td>{r.notes || '—'}</td>
                    <td>{fmtDate(r.created_at)}</td>
                  </tr>
                );
              })}
              {!filtered.length ? <tr><td colSpan={7} className="muted">No bonus bookings yet.</td></tr> : null}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
