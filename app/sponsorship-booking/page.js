'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadRuntimeConfig } from '../../lib/runtimeConfig';
import { loadSponsorshipBookings, upsertSponsorshipBooking } from '../../lib/sponsorshipBookings';

const APPS_KEY = 'legacy-sponsorship-applications-v1';

function toTitle(value = '') {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

function inferredRefName(refCode = '') {
  if (!refCode) return 'Unknown';
  const core = String(refCode).split('_').slice(0, -1).join('_') || String(refCode);
  return toTitle(core);
}

function nextBookingDates(leadHours = 48, days = 21) {
  const out = [];
  const start = new Date();
  start.setHours(start.getHours() + Number(leadHours || 48));
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const day = d.getDay();
    if (day === 0) continue; // Sunday off
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

export default function SponsorshipBookingPage() {
  const [config, setConfig] = useState(loadRuntimeConfig());
  const [id, setId] = useState('');
  const [record, setRecord] = useState(null);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    date: '',
    time: '',
    state: '',
    notes: ''
  });

  useEffect(() => {
    setConfig(loadRuntimeConfig());
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const bookingId = sp.get('id') || '';
    setId(bookingId);

    try {
      const list = JSON.parse(localStorage.getItem(APPS_KEY) || '[]');
      const found = list.find((r) => r.id === bookingId) || null;
      setRecord(found);
      if (found?.state) setForm((prev) => ({ ...prev, state: found.state }));
    } catch {
      setRecord(null);
    }
  }, []);

  const dates = useMemo(
    () => nextBookingDates(config.booking?.leadTimeHours || 48, 21),
    [config.booking?.leadTimeHours]
  );
  const slots = useMemo(
    () => buildSlots(config.booking?.startHour || 9, config.booking?.endHour || 21),
    [config.booking?.startHour, config.booking?.endHour]
  );

  const referredBy = record?.refCode ? inferredRefName(record.refCode) : (record?.referralName || 'Unknown');
  const applicantState = (form.state || '').toUpperCase().trim();
  const licensingMap = config.booking?.licensingByState || {};
  const eligibleClosers = applicantState ? (licensingMap[applicantState] || []) : [];
  const fngEligibleClosers = eligibleClosers.filter((name) => !String(name).toLowerCase().includes('breanna'));

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const sendWebhook = async (payload) => {
    const url = config.booking?.webhookUrl;
    if (!url) return { ok: false, reason: 'No webhook configured' };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return { ok: res.ok, status: res.status };
    } catch {
      return { ok: false, reason: 'Network error' };
    }
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.date || !form.time || !form.state) {
      setError('Please select date, time, and state.');
      return;
    }

    const booking = {
      id: `book_${Date.now()}`,
      source_application_id: id || record?.id || '',
      applicant_name: `${record?.firstName || ''} ${record?.lastName || ''}`.trim() || 'Unknown',
      applicant_phone: record?.phone || '',
      applicant_state: applicantState,
      licensed_status: record?.isLicensed === 'yes' ? 'Licensed' : 'Unlicensed',
      referred_by: referredBy,
      referral_code: record?.refCode || '',
      requested_at_est: `${form.date} ${form.time}`,
      score: record?.application_score || 0,
      decision_bucket: record?.decision_bucket || '',
      eligible_closers: fngEligibleClosers,
      claimed_by: '',
      claim_status: 'Open',
      notes: form.notes || '',
      created_at: new Date().toISOString()
    };

    upsertSponsorshipBooking(booking);

    const telegramText = [
      'New Sponsorship Booking',
      `Referral: ${booking.referred_by}`,
      `Applicant: ${booking.applicant_name}`,
      `State: ${booking.applicant_state}`,
      `Licensed: ${booking.licensed_status}`,
      `Requested Time (EST): ${booking.requested_at_est}`,
      `Score: ${booking.score}`,
      `Eligible Closers: ${booking.eligible_closers.join(', ') || 'None mapped yet'}`,
      'Please claim in Mission Control.'
    ].join('\n');

    const webhookPayload = { ...booking, telegram_text: telegramText };
    const webhook = await sendWebhook(webhookPayload);

    setSaved(webhook.ok ? 'Booked. Telegram notification sent.' : 'Booked. Add webhook in Settings to auto-send Telegram alerts.');

    const tg = `https://t.me/share/url?url=&text=${encodeURIComponent(telegramText)}`;
    window.open(tg, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 860 }}>
        <h2 style={{ marginTop: 0 }}>Book Your Sponsorship Strategy Call</h2>
        <p className="muted">Monday–Saturday • 9:00 AM–9:00 PM EST • Minimum {config.booking?.leadTimeHours || 48} hours notice</p>

        <div style={{ border: '1px solid #bfdbfe', borderRadius: 12, background: '#eff6ff', padding: 12, marginBottom: 12 }}>
          <strong>Approved Benefits</strong>
          <ul style={{ marginBottom: 0 }}>
            <li>Sponsorship path with no upfront policy cost for onboarding</li>
            <li>Training assets, Skool community, tutorial videos, sales training, onboarding support</li>
            <li>{record?.isLicensed === 'yes' ? 'Licensed path: move into contracting and production launch.' : 'Unlicensed path: pre-licensing with Jamal before full activation.'}</li>
          </ul>
        </div>

        <form className="settingsGrid" onSubmit={submitBooking}>
          <label>
            Applicant
            <input value={`${record?.firstName || ''} ${record?.lastName || ''}`.trim()} disabled />
          </label>
          <label>
            Referral Credit
            <input value={referredBy} disabled />
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
              {slots.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            Notes (optional)
            <textarea rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </label>

          <div style={{ gridColumn: '1 / -1', border: '1px dashed #94a3b8', borderRadius: 10, padding: 10 }}>
            <strong>Licensed closers for {applicantState || 'state'}:</strong>
            <div className="muted">{fngEligibleClosers.length ? fngEligibleClosers.join(', ') : 'No state mapping found yet. Add in Settings → Licensing By State JSON.'}</div>
          </div>

          <div className="rowActions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit">Confirm Booking + Notify Telegram</button>
          </div>
          {error ? <p className="red" style={{ gridColumn: '1 / -1' }}>{error}</p> : null}
          {saved ? <p className="green" style={{ gridColumn: '1 / -1' }}>{saved}</p> : null}
        </form>
      </div>
    </main>
  );
}
