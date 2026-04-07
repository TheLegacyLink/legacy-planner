'use client';

import { useEffect, useMemo, useState } from 'react';

const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','IA','ID','IL','IN','KS','KY','LA','MA','MD','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NJ','NM','NV','NY','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'];

function clean(v = '') { return String(v || '').trim(); }

export default function LicensedStartPage() {
  const [nextPath, setNextPath] = useState('/session/new?next=/lead-marketplace');
  const [source, setSource] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setNextPath(clean(params.get('next') || '/session/new?next=/lead-marketplace'));
    setSource(clean(params.get('source') || ''));
  }, []);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    homeState: '',
    npn: '',
    licensedStates: []
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedRow, setSavedRow] = useState(null);

  const canSubmit = useMemo(() => {
    return Boolean(
      clean(form.firstName) &&
      clean(form.lastName) &&
      clean(form.email).includes('@') &&
      clean(form.phone) &&
      clean(form.birthDate) &&
      clean(form.homeState).length === 2 &&
      /^\d{6,12}$/.test(clean(form.npn)) &&
      Array.isArray(form.licensedStates) && form.licensedStates.length > 0
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
        body: JSON.stringify({
          ...form,
          trackType: 'licensed',
          source: source || 'community_start_portal',
          intendedNext: nextPath
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Could not save intake right now.');
        return;
      }
      setSavedRow(data?.row || null);
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
          <h1 style={{ margin: '6px 0 0' }}>Licensed Intake Submitted</h1>
          <p style={{ color: '#94A3B8', marginBottom: 20 }}>Your profile is captured. Log in now to sign your ICA and access your back office. It takes about 5 minutes.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            <a
              href="/start"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg,#C8A96B 0%,#A78647 100%)',
                color: '#0B1020',
                fontWeight: 800,
                fontSize: 16,
                padding: '13px 26px',
                borderRadius: 12,
                textDecoration: 'none',
                border: '1px solid #D6BD8D'
              }}
            >
              Log In &amp; Sign Your ICA →
            </a>
          </div>
          <p style={{ color: '#64748B', fontSize: 13, margin: 0 }}>Use: <strong style={{ color: '#94A3B8' }}>{form.email}</strong></p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#020617', color: '#F8FAFC', padding: 16 }}>
      <div style={{ width: 'min(860px, 96vw)', margin: '24px auto', border: '1px solid #1F2A44', borderRadius: 16, background: '#0B1220', padding: 20 }}>
        <h1 style={{ marginTop: 0 }}>Licensed Intake</h1>
        <p style={{ color: '#94A3B8', marginTop: -4 }}>NPN and licensed states are required.</p>

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
          <label>Birthday*
            <input type="date" value={form.birthDate} onChange={(e) => update('birthDate', e.target.value)} style={inputStyle} max={new Date().toISOString().slice(0, 10)} />
          </label>
          <label>Home State*
            <select value={form.homeState} onChange={(e) => update('homeState', e.target.value)} style={inputStyle}>
              <option value="">Select</option>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>NPN (National Producer Number)*
            <input value={form.npn} onChange={(e) => update('npn', e.target.value.replace(/\D/g, ''))} style={inputStyle} />
          </label>

          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>States You're Licensed In*</div>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(66px,1fr))' }}>
              {STATES.map((s) => {
                const active = form.licensedStates.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setForm((p) => ({
                        ...p,
                        licensedStates: active ? p.licensedStates.filter((x) => x !== s) : [...p.licensedStates, s]
                      }));
                    }}
                    style={{ borderRadius: 10, border: active ? '1px solid #3B82F6' : '1px solid #334155', background: active ? '#1E3A8A' : '#0F172A', color: '#E5E7EB', padding: '8px 0' }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" disabled={!canSubmit || busy} style={primaryBtn}>{busy ? 'Creating Profile...' : 'Create Licensed Profile'}</button>
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
