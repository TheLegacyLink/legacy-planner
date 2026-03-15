'use client';

import { useEffect, useMemo, useState } from 'react';

function clean(v = '') { return String(v || '').trim(); }
function pct(done = 0, total = 1) { return Math.round((done / Math.max(1, total)) * 100); }

const STEP_META = [
  { key: 'prelicensingStarted', title: 'Start Pre-Licensing', note: 'Enroll and begin your pre-licensing course.' },
  { key: 'examPassed', title: 'Pass State Exam', note: 'Mark complete after passing your resident state exam.' },
  { key: 'residentLicenseObtained', title: 'Obtain Resident License', note: 'Resident state + license number required before complete.' },
  { key: 'licenseDetailsSubmitted', title: 'Submit License Details + NPN', note: 'Submit NPN and licensing details.' },
  { key: 'readyForContracting', title: 'Ready for Contracting', note: 'Final checkpoint before contracting + onboarding.' },
];

export default function UnlicensedBackofficePage() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [token, setToken] = useState('');
  const [profile, setProfile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('unlicensed_backoffice_token') : '';
    if (!t) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/unlicensed-backoffice/auth/me', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!mounted || !res.ok || !data?.ok) return;
        setToken(t);
        setProfile(data.profile || null);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/unlicensed-backoffice/progress', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!mounted || !res.ok || !data?.ok) return;
        setProfile(data.profile || profile);
        setProgress(data.progress || null);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [token]);

  async function requestCode() {
    setError('');
    try {
      const res = await fetch('/api/unlicensed-backoffice/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName, phone })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error ? `Access blocked: ${data.error}` : 'Unable to send code');
        return;
      }
      setCodeRequested(true);
    } catch {
      setError('Unable to send code');
    }
  }

  async function verifyCode() {
    setError('');
    try {
      const res = await fetch('/api/unlicensed-backoffice/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.token) {
        setError(data?.error ? `Verify failed: ${data.error}` : 'Invalid code');
        return;
      }
      if (typeof window !== 'undefined') window.localStorage.setItem('unlicensed_backoffice_token', data.token);
      setToken(data.token);
      setProfile(data.profile || null);
    } catch {
      setError('Verify failed');
    }
  }

  async function logout() {
    try {
      if (token) {
        await fetch('/api/unlicensed-backoffice/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ token })
        });
      }
    } catch {}
    if (typeof window !== 'undefined') window.localStorage.removeItem('unlicensed_backoffice_token');
    setToken('');
    setProfile(null);
    setProgress(null);
    setCodeRequested(false);
    setCode('');
  }

  async function save(next) {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/unlicensed-backoffice/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(next)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error ? `Save failed: ${data.error}` : 'Save failed');
        return;
      }
      setProgress(data.progress || progress);
    } finally {
      setSaving(false);
    }
  }

  const completion = useMemo(() => {
    const steps = progress?.steps || {};
    const done = STEP_META.filter((s) => Boolean(steps[s.key])).length;
    return { done, total: STEP_META.length, pct: pct(done, STEP_META.length) };
  }, [progress]);

  if (!token || !profile) {
    return (
      <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #15213f 0%, #070b14 55%)', color: '#E5E7EB', display: 'grid', placeItems: 'center', padding: 24 }}>
        <section style={{ width: 'min(600px, 95vw)', border: '1px solid #2A3142', borderRadius: 16, background: 'rgba(17,24,39,0.92)' }}>
          <div style={{ padding: '24px 26px', borderBottom: '1px solid #2A3142', background: 'linear-gradient(120deg, #1D428A, #006BB6)' }}>
            <h1 style={{ margin: 0, fontSize: 30 }}>THE LEGACY LINK</h1>
            <p style={{ margin: '8px 0 0', opacity: 0.95 }}>Unlicensed Back Office • License Sprint</p>
          </div>
          <div style={{ padding: 24, display: 'grid', gap: 10 }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #374151', background: '#020617', color: '#fff' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #374151', background: '#020617', color: '#fff' }} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #374151', background: '#020617', color: '#fff' }} />
            </div>
            {!codeRequested ? (
              <button onClick={requestCode} style={{ padding: '12px 14px', borderRadius: 10, border: 0, background: '#C8A96B', color: '#0B1020', fontWeight: 800 }}>Send Login Code</button>
            ) : (
              <>
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #374151', background: '#020617', color: '#fff' }} />
                <button onClick={verifyCode} style={{ padding: '12px 14px', borderRadius: 10, border: 0, background: '#C8A96B', color: '#0B1020', fontWeight: 800 }}>Verify & Enter</button>
              </>
            )}
            {error ? <small style={{ color: '#FCA5A5' }}>{error}</small> : <small style={{ color: '#9CA3AF' }}>This lane is focused on pre-licensing → exam → resident license → NPN.</small>}
          </div>
        </section>
      </main>
    );
  }

  const steps = progress?.steps || {};
  const fields = progress?.fields || {};

  return (
    <main style={{ minHeight: '100vh', background: '#070b14', color: '#E5E7EB', padding: 22 }}>
      <section style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 12 }}>
        <header style={{ border: '1px solid #2A3142', borderRadius: 14, background: '#0F172A', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ margin: 0 }}>Unlicensed License Sprint</h2>
              <p style={{ margin: '6px 0 0', color: '#9CA3AF' }}>{profile.name} • {profile.email} • {profile.state || 'State Pending'}</p>
            </div>
            <button onClick={logout} style={{ borderRadius: 10, border: '1px solid #334155', padding: '8px 12px', background: '#111827', color: '#E5E7EB' }}>Sign Out</button>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ color: '#9CA3AF', fontSize: 12 }}>Completion: {completion.done}/{completion.total}</div>
            <div style={{ marginTop: 6, height: 10, borderRadius: 999, background: '#1F2937', overflow: 'hidden' }}>
              <div style={{ width: `${completion.pct}%`, height: '100%', background: 'linear-gradient(90deg,#34D399,#10B981)' }} />
            </div>
          </div>
        </header>

        <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Required Steps</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {STEP_META.map((s) => (
              <div key={s.key} style={{ border: '1px solid #2A3142', borderRadius: 10, background: '#020617', padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <div>
                    <strong>{s.title}</strong>
                    <div style={{ color: '#9CA3AF', marginTop: 4 }}>{s.note}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => save({ steps: { ...steps, [s.key]: !steps[s.key] }, fields })}
                    disabled={saving}
                    style={{ borderRadius: 999, border: '1px solid #334155', padding: '8px 12px', background: steps[s.key] ? '#065F46' : '#111827', color: '#E5E7EB', fontWeight: 700 }}
                  >
                    {steps[s.key] ? '✅ Complete' : 'Mark Complete'}
                  </button>
                </div>

                {s.key === 'examPassed' ? (
                  <input
                    value={fields.examPassDate || ''}
                    onChange={(e) => save({ steps, fields: { ...fields, examPassDate: e.target.value } })}
                    placeholder="Exam pass date (YYYY-MM-DD)"
                    style={{ marginTop: 8, width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #374151', background: '#0B1220', color: '#fff' }}
                  />
                ) : null}

                {s.key === 'residentLicenseObtained' ? (
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <input value={fields.residentState || ''} onChange={(e) => save({ steps, fields: { ...fields, residentState: e.target.value } })} placeholder="Resident state" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #374151', background: '#0B1220', color: '#fff' }} />
                    <input value={fields.residentLicenseNumber || ''} onChange={(e) => save({ steps, fields: { ...fields, residentLicenseNumber: e.target.value } })} placeholder="License #" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #374151', background: '#0B1220', color: '#fff' }} />
                    <input value={fields.residentLicenseActiveDate || ''} onChange={(e) => save({ steps, fields: { ...fields, residentLicenseActiveDate: e.target.value } })} placeholder="Active date" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #374151', background: '#0B1220', color: '#fff' }} />
                  </div>
                ) : null}

                {s.key === 'licenseDetailsSubmitted' ? (
                  <input value={fields.npn || ''} onChange={(e) => save({ steps, fields: { ...fields, npn: e.target.value } })} placeholder="NPN" style={{ marginTop: 8, width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #374151', background: '#0B1220', color: '#fff' }} />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
