'use client';

import { useMemo, useState } from 'react';

const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','IA','ID','IL','IN','KS','KY','LA','MA','MD','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NJ','NM','NV','NY','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'];

function clean(v = '') { return String(v || '').trim(); }

export default function UnlicensedStartPage() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    homeState: ''
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(
      clean(form.firstName) &&
      clean(form.lastName) &&
      clean(form.email).includes('@') &&
      clean(form.phone) &&
      clean(form.homeState).length === 2
    );
  }, [form]);

  function update(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/start-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, trackType: 'unlicensed', source: 'community_start_portal' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Could not save intake right now.');
        return;
      }
      setSaved(true);
    } catch {
      setError('Could not save intake right now.');
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <main style={{ minHeight: '100vh', background: '#020617', color: '#F8FAFC', padding: 16, display: 'grid', placeItems: 'center' }}>
        <div style={{ width: 'min(680px, 96vw)', border: '1px solid #334155', borderRadius: 16, background: '#0B1220', padding: 22, textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>✅</div>
          <h1 style={{ margin: '6px 0 0' }}>Unlicensed Intake Submitted</h1>
          <p style={{ color: '#94A3B8' }}>Your profile was captured successfully. We’ll send onboarding steps and credentials next.</p>
          <a href="/start" style={{ color: '#93C5FD' }}>Back to Start</a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#020617', color: '#F8FAFC', padding: 16 }}>
      <div style={{ width: 'min(760px, 96vw)', margin: '24px auto', border: '1px solid #1F2A44', borderRadius: 16, background: '#0B1220', padding: 20 }}>
        <h1 style={{ marginTop: 0 }}>Unlicensed Intake</h1>
        <p style={{ color: '#94A3B8', marginTop: -4 }}>Quick profile setup to begin onboarding.</p>

        <form onSubmit={submit} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <label>First Name*
            <input value={form.firstName} onChange={(e) => update('firstName', e.target.value)} style={inputStyle} />
          </label>
          <label>Last Name*
            <input value={form.lastName} onChange={(e) => update('lastName', e.target.value)} style={inputStyle} />
          </label>
          <label>Email*
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} style={inputStyle} />
          </label>
          <label>Phone*
            <input value={form.phone} onChange={(e) => update('phone', e.target.value)} style={inputStyle} />
          </label>
          <label>Home State*
            <select value={form.homeState} onChange={(e) => update('homeState', e.target.value)} style={inputStyle}>
              <option value="">Select</option>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" disabled={!canSubmit || busy} style={primaryBtn}>{busy ? 'Creating Profile...' : 'Create Unlicensed Profile'}</button>
            <a href="/start" style={{ color: '#93C5FD' }}>Back</a>
            {error ? <span style={{ color: '#FCA5A5' }}>{error}</span> : null}
          </div>
        </form>
      </div>
    </main>
  );
}

const inputStyle = {
  width: '100%',
  marginTop: 4,
  borderRadius: 12,
  border: '1px solid #334155',
  background: '#0F172A',
  color: '#F8FAFC',
  padding: '10px 12px'
};

const primaryBtn = {
  borderRadius: 12,
  border: '1px solid #D6BD8D',
  background: 'linear-gradient(135deg,#C8A96B 0%,#A78647 100%)',
  color: '#0B1020',
  padding: '10px 14px',
  fontWeight: 800
};
