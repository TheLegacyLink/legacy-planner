'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

const ACCESS_KEY = 'caller_emani_access_v4';
const PASSCODE = 'EmaniCalls!2026';
const CALL_STATUS_OPTIONS = ['Called - Spoke', 'Voicemail Left', 'No Answer', 'Wrong Number', 'Booked Appointment'];

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

function updateKey(row = {}) {
  const id = clean(row.applicationId || row.id);
  if (id) return `id:${id}`;
  const email = clean(row.email).toLowerCase();
  if (email) return `e:${email}`;
  const phone = normalizePhone(row.phone);
  if (phone) return `p:${phone}`;
  return `n:${normalizeName(row.name || '')}`;
}

export default function CallerEmaniPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [apps, setApps] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [draftByKey, setDraftByKey] = useState({});
  const [savingKey, setSavingKey] = useState('');

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
      const [appsRes, bookingsRes, updatesRes] = await Promise.all([
        fetch('/api/sponsorship-applications', { cache: 'no-store' }),
        fetch('/api/sponsorship-bookings', { cache: 'no-store' }),
        fetch('/api/caller-emani-updates', { cache: 'no-store' })
      ]);

      const appsJson = await appsRes.json().catch(() => ({}));
      const bookingsJson = await bookingsRes.json().catch(() => ({}));
      const updatesJson = await updatesRes.json().catch(() => ({}));

      if (appsRes.ok && appsJson?.ok) setApps(Array.isArray(appsJson.rows) ? appsJson.rows : []);
      if (bookingsRes.ok && bookingsJson?.ok) setBookings(Array.isArray(bookingsJson.rows) ? bookingsJson.rows : []);
      if (updatesRes.ok && updatesJson?.ok) setUpdates(Array.isArray(updatesJson.rows) ? updatesJson.rows : []);
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

  const updatesMap = useMemo(() => {
    const map = new Map();
    for (const u of updates || []) map.set(clean(u.key), u);
    return map;
  }, [updates]);

  const rows = useMemo(() => {
    const bookingMap = new Map((bookings || []).map((b) => [bookingKey(b), b]));

    const approved = (apps || [])
      .filter((r) => normalizeName(String(r.status || '')).includes('APPROVED'))
      .map((r) => {
        const key = appKey(r);
        const booking = bookingMap.get(key);
        const update = updatesMap.get(key);
        return {
          key,
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
          bookedAt: booking?.created_at || booking?.updated_at || '',
          lastCallStatus: clean(update?.status || ''),
          lastCalledAt: clean(update?.lastCalledAt || ''),
          callCount: Number(update?.callCount || 0),
          callNotes: clean(update?.notes || ''),
          bookedByEmani: clean(update?.status).toLowerCase() === 'booked appointment'
        };
      });

    return approved.sort((a, b) => {
      if (a.booked !== b.booked) return a.booked ? 1 : -1;
      return new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime();
    });
  }, [apps, bookings, updatesMap]);

  const summary = useMemo(() => {
    const total = rows.length;
    const booked = rows.filter((r) => r.booked).length;
    const emaniBooked = rows.filter((r) => r.bookedByEmani).length;
    return { total, booked, notBooked: total - booked, emaniBooked };
  }, [rows]);

  async function saveCallUpdate(row) {
    const draft = draftByKey[row.key] || {};
    const status = clean(draft.status || row.lastCallStatus || 'Called - Spoke');
    const notes = clean(draft.notes || '');

    setSavingKey(row.key);
    try {
      const res = await fetch('/api/caller-emani-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'upsert',
          id: row.id,
          applicationId: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          status,
          notes,
          calledAt: new Date().toISOString()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        window.alert(`Update failed: ${data?.error || 'unknown_error'}`);
        return;
      }
      await load();
      setDraftByKey((prev) => ({ ...prev, [row.key]: { status, notes: '' } }));
    } finally {
      setSavingKey('');
    }
  }

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
        <span className="pill onpace">Booked by Emani: {summary.emaniBooked}</span>
      </div>

      <div className="panel">
        <div className="panelRow">
          <h3 style={{ margin: 0 }}>Approved But Not Booked Follow-Up Queue</h3>
          <small className="muted">Booked rows auto-highlight green. Use call update controls after each call.</small>
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
              <th>Call Update</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const draft = draftByKey[r.key] || {};
              const selectedStatus = draft.status || r.lastCallStatus || CALL_STATUS_OPTIONS[0];
              const notes = draft.notes || '';

              return (
                <tr key={r.id || `${r.name}-${r.email}`} style={r.booked ? { background: 'rgba(34,197,94,0.14)' } : undefined}>
                  <td>{r.name || '—'}</td>
                  <td>{r.email || '—'}</td>
                  <td>{r.phone || '—'}</td>
                  <td>{r.state || '—'}</td>
                  <td>{r.referredBy || '—'}</td>
                  <td>{r.age || '—'}</td>
                  <td>{r.score}</td>
                  <td style={{ minWidth: 280 }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <select
                        value={selectedStatus}
                        onChange={(e) => setDraftByKey((prev) => ({ ...prev, [r.key]: { ...(prev[r.key] || {}), status: e.target.value } }))}
                      >
                        {CALL_STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      <input
                        placeholder="Optional call note"
                        value={notes}
                        onChange={(e) => setDraftByKey((prev) => ({ ...prev, [r.key]: { ...(prev[r.key] || {}), notes: e.target.value } }))}
                      />
                      <button type="button" className="ghost" disabled={savingKey === r.key} onClick={() => saveCallUpdate(r)}>
                        {savingKey === r.key ? 'Saving...' : 'Log Call Update'}
                      </button>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <span className={`pill ${r.booked ? 'onpace' : 'atrisk'}`}>
                        {r.booked ? `Booked (${fmt(r.bookedAt)})` : 'Approved - Not Booked'}
                      </span>
                      {r.bookedByEmani ? <span className="pill onpace">✅ Emani booked this</span> : null}
                      {r.lastCallStatus ? <small>{r.lastCallStatus} • {r.lastCalledAt ? fmt(r.lastCalledAt) : '—'}</small> : <small>—</small>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && !loading ? (
              <tr><td colSpan={9} className="muted">No approved records found.</td></tr>
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
