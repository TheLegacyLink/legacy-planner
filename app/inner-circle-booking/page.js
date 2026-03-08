'use client';

import { useEffect, useMemo, useState } from 'react';

function nextBookingDates(leadHours = 24, days = 10) {
  const out = [];
  const start = new Date();
  start.setHours(start.getHours() + Number(leadHours || 24));
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const day = d.getDay();
    if (day === 0) continue;
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function buildSlots(startHour = 9, endHour = 20) {
  const slots = [];
  for (let h = Number(startHour); h < Number(endHour); h += 1) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
}

function to12Hour(time24 = '') {
  const [hRaw = '0', m = '00'] = String(time24 || '').split(':');
  const h = Number(hRaw);
  if (Number.isNaN(h)) return String(time24 || '');
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${m} ${suffix}`;
}

export default function InnerCircleBookingPage() {
  const [appId, setAppId] = useState('');
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({ date: '', time: '', state: '', notes: '' });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const id = sp.get('id') || '';
    setAppId(id);

    async function load() {
      setLoading(true);
      try {
        if (!id) {
          setApp(null);
          return;
        }
        const res = await fetch(`/api/inner-circle-application?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok || !data?.row) {
          setApp(null);
          return;
        }
        setApp(data.row);
        setForm((prev) => ({ ...prev, state: (data.row?.state || '').toUpperCase() }));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const update = (key, value) => setForm((s) => ({ ...s, [key]: value }));

  const dates = useMemo(() => nextBookingDates(24, 10), []);
  const slots = useMemo(() => buildSlots(9, 20), []);

  async function submitBooking(e) {
    e.preventDefault();
    setError('');
    setSaved('');

    if (!app || !appId) {
      setError('Invalid booking link. Please use the booking link from your qualified application result.');
      return;
    }

    if (!app?.qualified) {
      setError('This booking page is only for qualified Inner Circle applications.');
      return;
    }

    if (!form.date || !form.time || !form.state) {
      setError('Please select date, time, and state.');
      return;
    }

    if (!dates.includes(form.date)) {
      setError('Please choose a booking date within the next 10 days.');
      return;
    }

    const requestedAt12 = `${form.date} ${to12Hour(form.time)}`;

    const booking = {
      id: `icbook_${Date.now()}`,
      source_application_id: appId,
      applicant_name: app.fullName || 'Unknown',
      applicant_phone: app.phone || '',
      applicant_email: app.email || '',
      applicant_state: String(form.state || '').toUpperCase(),
      requested_at_est: requestedAt12,
      notes: form.notes || '',
      booking_type: 'inner_circle',
      created_at: new Date().toISOString()
    };

    try {
      const res = await fetch('/api/inner-circle-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'upsert', booking })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Could not save booking. Please retry.');
        return;
      }

      setSaved('Inner Circle strategy call booked successfully. Kimora has been notified by email.');
      setForm((s) => ({ ...s, notes: '' }));
    } catch {
      setError('Could not save booking right now. Please retry.');
    }
  }

  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 860 }}>
        <h2 style={{ marginTop: 0 }}>Book Your Inner Circle Strategy Call</h2>
        <p className="muted">Inner Circle strategy call • Monday–Saturday • 9:00 AM–8:00 PM EST</p>

        <div style={{ border: '1px solid #bfdbfe', borderRadius: 12, background: '#eff6ff', padding: 12, marginBottom: 12 }}>
          <strong>Before You Book</strong>
          <ul style={{ marginBottom: 0 }}>
            <li>This call is for qualified applicants ready to execute.</li>
            <li>Have your schedule, goals, and next-90-day target ready.</li>
            <li>This is your Inner Circle one-on-one strategy call.</li>
          </ul>
        </div>

        {loading ? <p className="muted">Loading booking context...</p> : null}
        {!loading && !app ? (
          <p className="red" style={{ marginTop: 8 }}>
            Invalid booking context. Please use the booking link from your qualified Inner Circle application.
          </p>
        ) : null}

        {!loading && app && !app.qualified ? (
          <p className="red" style={{ marginTop: 8 }}>
            This application is currently not qualified for one-on-one booking.
          </p>
        ) : null}

        <form className="settingsGrid" onSubmit={submitBooking}>
          <label>
            Applicant
            <input value={app?.fullName || ''} disabled />
          </label>
          <label>
            Email
            <input value={app?.email || ''} disabled />
          </label>
          <label>
            Phone
            <input value={app?.phone || ''} disabled />
          </label>
          <label>
            State
            <input value={form.state} onChange={(e) => update('state', e.target.value.toUpperCase())} placeholder="TX" maxLength={2} />
          </label>

          <label>
            Date (EST)
            <select value={form.date} onChange={(e) => update('date', e.target.value)}>
              <option value="">Select date</option>
              {dates.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label>
            Time (EST)
            <select value={form.time} onChange={(e) => update('time', e.target.value)}>
              <option value="">Select time</option>
              {slots.map((t) => <option key={t} value={t}>{to12Hour(t)}</option>)}
            </select>
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            Notes (optional)
            <textarea rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </label>

          <div className="rowActions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" disabled={!app || !app.qualified}>Confirm Inner Circle Booking</button>
          </div>

          {error ? <p className="red" style={{ gridColumn: '1 / -1' }}>{error}</p> : null}
          {saved ? <p className="green" style={{ gridColumn: '1 / -1' }}>{saved}</p> : null}
        </form>
      </div>
    </main>
  );
}
