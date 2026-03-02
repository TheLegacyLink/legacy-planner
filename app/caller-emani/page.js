'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

const ACCESS_KEY = 'caller_emani_access_v3';
const PASSCODE = 'EmaniCalls!2026';

function clean(v = '') {
  return String(v || '').trim();
}

function normalizeName(v = '') {
  return clean(v).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizePhone(v = '') {
  return String(v || '').replace(/\D/g, '');
}

function fmt(iso = '') {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function referredBy(row = {}) {
  return clean(row.referralName || row.referred_by || row.referredBy || row.referredByName || row.refCode || '—');
}

function appKey(row = {}) {
  const id = clean(row.id);
  if (id) return `id:${id}`;
  const email = clean(row.email).toLowerCase();
  const phone = normalizePhone(row.phone);
  const name = normalizeName(`${row.firstName || ''} ${row.lastName || ''}`);
  if (email) return `e:${email}`;
  if (phone) return `p:${phone}`;
  return `n:${name}`;
}

function bookingKey(row = {}) {
  const src = clean(row.source_application_id);
  if (src) return `id:${src}`;
  const email = clean(row.applicant_email).toLowerCase();
  const phone = normalizePhone(row.applicant_phone);
  const name = normalizeName(row.applicant_name || '');
  if (email) return `e:${email}`;
  if (phone) return `p:${phone}`;
  return `n:${name}`;
}

export default function CallerEmaniPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [apps, setApps] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(ACCESS_KEY) === 'ok') setUnlocked(true);
      const sp = new URLSearchParams(window.location.search || '');
      setStandalone(sp.get('standalone') === '1');
    } catch {
      // ignore
    }
  }, []);

  async function load() {
    try {
      const [appsRes, bookingsRes] = await Promise.all([
        fetch('/api/sponsorship-applications', { cache: 'no-store' }),
        fetch('/api/sponsorship-bookings', { cache: 'no-store' })
      ]);

      const appsJson = await appsRes.json().catch(() => ({}));
      const bookingsJson = await bookingsRes.json().catch(() => ({}));

      if (appsRes.ok && appsJson?.ok) setApps(Array.isArray(appsJson.rows) ? appsJson.rows : []);
      if (bookingsRes.ok && bookingsJson?.ok) setBookings(Array.isArray(bookingsJson.rows) ? bookingsJson.rows : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!unlocked) return;
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [unlocked]);

  const rows = useMemo(() => {
    const bookingMap = new Map((bookings || []).map((b) => [bookingKey(b), b]));

    const approved = (apps || [])
      .filter((r) => normalizeName(String(r.status || '')).includes('APPROVED'))
      .map((r) => {
        const key = appKey(r);
        const booking = bookingMap.get(key);
        return {
          id: clean(r.id),
          name: clean(`${r.firstName || ''} ${r.lastName || ''}`),
          email: clean(r.email),
          phone: clean(r.phone),
          state: clean(r.state),
          referredBy: referredBy(r),
          age: clean(r.age),
          score: r.application_score ?? '—',
          submittedAt: r.submitted_at || r.createdAt || '',
          booked: Boolean(booking),
          bookedAt: booking?.created_at || booking?.updated_at || ''
        };
      });

    return approved.sort((a, b) => {
      if (a.booked !== b.booked) return a.booked ? 1 : -1;
      return new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime();
    });
  }, [apps, bookings]);

  const summary = useMemo(() => {
    const total = rows.length;
    const booked = rows.filter((r) => r.booked).length;
    return { total, booked, notBooked: total - booked };
  }, [rows]);

  function unlock() {
    if (passcode.trim() !== PASSCODE) {
      setError('Incorrect passcode.');
      return;
    }
    localStorage.setItem(ACCESS_KEY, 'ok');
    setUnlocked(true);
    setError('');
  }

  const content = (
    <>
      <div className="panelRow" style={{ marginBottom: 10 }}>
        <span className="pill onpace">Approved Total: {summary.total}</span>
        <span className="pill atrisk">Not Booked: {summary.notBooked}</span>
        <span className="pill onpace">Booked: {summary.booked}</span>
      </div>

      <div className="panel">
        <div className="panelRow">
          <h3 style={{ margin: 0 }}>Approved But Not Booked Follow-Up Queue</h3>
          <small className="muted">Booked rows are highlighted so Emani can stop calling.</small>
        </div>

        {loading ? <p className="muted">Loading...</p> : null}

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>State (Current)</th>
              <th>Referred By</th>
              <th>Age</th>
              <th>Score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id || `${r.name}-${r.email}`} style={r.booked ? { background: 'rgba(34,197,94,0.14)' } : undefined}>
                <td>{r.name || '—'}</td>
                <td>{r.email || '—'}</td>
                <td>{r.phone || '—'}</td>
                <td>{r.state || '—'}</td>
                <td>{r.referredBy || '—'}</td>
                <td>{r.age || '—'}</td>
                <td>{r.score}</td>
                <td>{r.booked ? `Booked (${fmt(r.bookedAt)})` : 'Approved - Not Booked'}</td>
              </tr>
            ))}
            {!rows.length && !loading ? (
              <tr><td colSpan={8} className="muted">No approved records found.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );

  if (!unlocked) {
    const gate = (
      <div className="panel" style={{ maxWidth: 420, margin: '40px auto' }}>
        <h3 style={{ marginTop: 0 }}>Caller - Emani Access</h3>
        <p className="muted">Enter passcode to continue.</p>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Enter passcode"
          onKeyDown={(e) => e.key === 'Enter' && unlock()}
        />
        <div style={{ marginTop: 10 }}>
          <button type="button" onClick={unlock}>Unlock</button>
        </div>
        {error ? <p className="red" style={{ marginTop: 10 }}>{error}</p> : null}
      </div>
    );

    if (standalone) return <main style={{ padding: 12 }}>{gate}</main>;
    return <AppShell title="Caller - Emani">{gate}</AppShell>;
  }

  if (standalone) return <main style={{ padding: 12 }}>{content}</main>;
  return <AppShell title="Caller - Emani">{content}</AppShell>;
}
