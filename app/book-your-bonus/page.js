'use client';

import { useMemo, useState } from 'react';

const STORAGE_KEY = 'legacy-bonus-bookings-v1';

function nextBookingDates(leadHours = 24, days = 21) {
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

function buildSlots(startHour = 9, endHour = 21) {
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

export default function BookYourBonusPage() {
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    state: '',
    date: '',
    time: '',
    notes: ''
  });

  const dates = useMemo(() => nextBookingDates(24, 21), []);
  const slots = useMemo(() => buildSlots(9, 21), []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(e) {
    e.preventDefault();
    setSaved('');
    setError('');

    if (!form.name || !form.state || !form.date || !form.time) {
      setError('Please fill name, state, date, and time.');
      return;
    }

    const booking = {
      id: `bonus_${Date.now()}`,
      name: form.name.trim(),
      state: form.state.trim().toUpperCase(),
      requested_at_est: `${form.date} ${to12Hour(form.time)}`,
      notes: form.notes.trim(),
      created_at: new Date().toISOString()
    };

    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      localStorage.setItem(STORAGE_KEY, JSON.stringify([booking, ...list]));
    } catch {
      // keep going
    }

    const alertText = [
      'New Bonus Call Booking',
      `Booking ID: ${booking.id}`,
      `Name: ${booking.name}`,
      `State: ${booking.state}`,
      `Date/Time (EST): ${booking.requested_at_est}`,
      `Notes: ${booking.notes || '—'}`
    ].join('\n');

    try {
      await fetch('/api/booking-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking, alertText })
      });
    } catch {
      // non-blocking
    }

    setSaved('Bonus call booked successfully.');
    setForm({ name: '', state: '', date: '', time: '', notes: '' });
  }

  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 860 }}>
        <h2 style={{ marginTop: 0 }}>Book Your Bonus Call</h2>
        <p className="muted">Monday–Saturday • 9:00 AM–9:00 PM EST • Please be on time for the Zoom call.</p>

        <div style={{ border: '1px solid #bfdbfe', borderRadius: 12, background: '#eff6ff', padding: 12, marginBottom: 12 }}>
          <strong>Bonus Qualification</strong>
          <p style={{ margin: '8px 0 0 0' }}>
            If you are a licensed agent, you will receive a <strong>$250 bonus</strong> after we complete the bonus policy the company is covering.
          </p>
        </div>

        <form className="settingsGrid" onSubmit={submit}>
          <label>
            Name
            <input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Full name" />
          </label>

          <label>
            State
            <input value={form.state} onChange={(e) => update('state', e.target.value.toUpperCase())} placeholder="VA" maxLength={2} />
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
            Notes
            <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={4} placeholder="Any context or notes" />
          </label>

          <div className="rowActions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit">Book Bonus Call</button>
          </div>
        </form>

        {error ? <p className="red">{error}</p> : null}
        {saved ? <p className="green">{saved}</p> : null}
      </div>
    </main>
  );
}
