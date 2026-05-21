'use client';

import { useEffect, useMemo, useState } from 'react';
import ICAContractGate from '../../components/ICAContractGate';
import PodcastPopup from '../../components/PodcastPopup';

function clean(v = '') { return String(v || '').trim(); }
function pct(done = 0, total = 1) { return Math.round((done / Math.max(1, total)) * 100); }

const US_STATE_OPTIONS = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['FL', 'Florida'], ['GA', 'Georgia'],
  ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'],
  ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'],
  ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
  ['DC', 'District of Columbia']
];

const STEP_META = [
  { key: 'backOfficeAccess', title: 'Step 1 — Back Office Access + Welcome Instructions', note: 'Open your welcome email, save your links, and confirm your back office access is active.' },
  { key: 'communitySkool', title: 'Step 2 — Community + Skool (Training)', note: 'Join Skool and complete assigned onboarding/training tasks.' },
  { key: 'prelicensingStarted', title: 'Step 3 — Pre-Licensing Onboarding (Jamal Leads This)', note: 'Jamal leads this process for all unlicensed agents. Tap “I’m Ready” so Jamal is notified.' },
  { key: 'watchedWhateverItTakes', title: 'Step 4 — Required YouTube Task', note: 'Watch https://youtu.be/SVvU9SvCH9o?si=nzgjgEa7DfGQlxmX and leave a comment to confirm completion.' },
];

export default function UnlicensedBackofficePage() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  // Phone removed: unlicensed login requires full name + email exact match.
  const [code, setCode] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [showDemoSelect, setShowDemoSelect] = useState(false);

  const DEMO_EMAILS = ['leticiawright05@gmail.com'];
  const [token, setToken] = useState('');
  const [icaSigned, setIcaSigned] = useState(false);
  const [profile, setProfile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [saving, setSaving] = useState(false);
  const [readySubmitting, setReadySubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [uplineSupport, setUplineSupport] = useState({ loading: false, error: '', upline: null, rows: [], unreadForViewer: 0 });
  const [uplineDraft, setUplineDraft] = useState('');
  const [tab, setTab] = useState('steps');
  const [uplineSending, setUplineSending] = useState(false);
  const [uplineNotice, setUplineNotice] = useState('');

  useEffect(() => {
    // Read token from localStorage first, fall back to cookie
    let t = typeof window !== 'undefined' ? window.localStorage.getItem('unlicensed_backoffice_token') : '';
    if (!t && typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|;\s*)unlicensed_bo_token=([^;]+)/);
      if (match) { t = match[1]; try { window.localStorage.setItem('unlicensed_backoffice_token', t); } catch {} }
    }
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

  useEffect(() => {
    if (!profile?.email) return;
    let mounted = true;
    (async () => {
      setUplineSupport((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const qs = new URLSearchParams({
          name: clean(profile?.name || ''),
          email: clean(profile?.email || '').toLowerCase(),
          profileType: 'unlicensed'
        });
        const res = await fetch(`/api/upline-support?${qs.toString()}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (!res.ok || !data?.ok) {
          setUplineSupport({ loading: false, error: 'Could not load support thread.', upline: null, rows: [], unreadForViewer: 0 });
          return;
        }
        setUplineSupport({
          loading: false,
          error: '',
          upline: data?.upline || null,
          rows: Array.isArray(data?.rows) ? data.rows : [],
          unreadForViewer: Number(data?.unreadForViewer || 0)
        });
      } catch {
        if (mounted) setUplineSupport({ loading: false, error: 'Could not load support thread.', upline: null, rows: [], unreadForViewer: 0 });
      }
    })();
    return () => { mounted = false; };
  }, [profile?.email, profile?.name]);

  async function sendUplineMessage() {
    if (!profile?.email) return;
    const message = clean(uplineDraft);
    if (!message) {
      setUplineNotice('Type a message first.');
      return;
    }
    setUplineSending(true);
    setUplineNotice('');
    try {
      const res = await fetch('/api/upline-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          viewerName: clean(profile?.name || ''),
          viewerEmail: clean(profile?.email || '').toLowerCase(),
          profileType: 'unlicensed',
          message
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setUplineNotice('Could not send message right now.');
        return;
      }
      setUplineDraft('');
      setUplineNotice('Message sent. Jamal will be notified.');
      setUplineSupport((prev) => ({ ...prev, rows: [...(Array.isArray(prev?.rows) ? prev.rows : []), data?.row].filter(Boolean) }));
    } catch {
      setUplineNotice('Could not send message right now.');
    } finally {
      setUplineSending(false);
    }
  }

  async function requestCode() {
    setError('');
    const cleanEmail = clean(email).toLowerCase();
    // Demo users get a back office selector before we send any code
    if (DEMO_EMAILS.includes(cleanEmail) && !showDemoSelect) {
      setShowDemoSelect(true);
      return;
    }
    try {
      const res = await fetch('/api/unlicensed-backoffice/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error === 'not_found'
          ? 'No account found for that email. Contact your upline to confirm your info is on file.'
          : (data?.error ? `Access blocked: ${data.error}` : 'Unable to send code. Try again.'));
        return;
      }
      setCodeRequested(true);
    } catch {
      setError('Unable to send code. Try again.');
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
        setError(data?.error ? `Verify failed: ${data.error}` : 'Invalid code/password');
        return;
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('unlicensed_backoffice_token', data.token);
        // Also write to cookie so progress persists through localStorage clears
        try { document.cookie = `unlicensed_bo_token=${data.token};path=/;max-age=2592000;SameSite=Lax`; } catch {}
      }
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
    setNotice('');
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
      setNotice('✓ Progress saved to your account — accessible from any browser after sign-in.');
      setTimeout(() => setNotice(''), 4000);
    } finally {
      setSaving(false);
    }
  }

  async function notifyPrelicensingReady() {
    if (!token) return;
    setReadySubmitting(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/unlicensed-backoffice/prelicensing-ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error ? `Request failed: ${data.error}` : 'Unable to notify Jamal right now');
        return;
      }
      if (data?.progress) setProgress(data.progress);
      if (data?.alreadyRequested) {
        setNotice('Already sent. Jamal was already notified to help you get started.');
      } else {
        setNotice('Perfect — Jamal has been notified. He will help you get started within 48 hours.');
      }
    } catch {
      setError('Unable to notify Jamal right now');
    } finally {
      setReadySubmitting(false);
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
          <div style={{ padding: 24, display: 'grid', gap: 12 }}>
            {showDemoSelect ? (
              <>
                <p style={{ margin: 0, color: '#CBD5E1', fontSize: 14, textAlign: 'center' }}>Which back office would you like to access?</p>
                <button
                  onClick={requestCode}
                  style={{ padding: '14px', borderRadius: 10, border: 0, background: '#1651AE', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}
                >
                  Unlicensed Agent Back Office
                </button>
                <a
                  href="/licensed-backoffice"
                  style={{ display: 'block', padding: '14px', borderRadius: 10, border: '1px solid #C8A96B', background: 'transparent', color: '#C8A96B', fontWeight: 800, fontSize: 15, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}
                >
                  Licensed Agent Back Office
                </a>
                <button
                  onClick={() => { setShowDemoSelect(false); setError(''); }}
                  style={{ padding: '10px', borderRadius: 10, border: '1px solid #374151', background: 'transparent', color: '#9CA3AF', fontSize: 13, cursor: 'pointer' }}
                >
                  ← Use a different email
                </button>
                {error && <small style={{ color: '#FCA5A5' }}>{error}</small>}
              </>
            ) : !codeRequested ? (
              <>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && requestCode()}
                  placeholder="Your email address"
                  type="email"
                  autoFocus
                  style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid #374151', background: '#020617', color: '#fff', fontSize: 15 }}
                />
                <button
                  onClick={requestCode}
                  style={{ padding: '14px', borderRadius: 10, border: 0, background: '#C8A96B', color: '#0B1020', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}
                >
                  Send Login Code
                </button>
                {error
                  ? <small style={{ color: '#FCA5A5' }}>{error}</small>
                  : <small style={{ color: '#9CA3AF' }}>Enter the email address on file from your application.</small>
                }
              </>
            ) : (
              <>
                <p style={{ margin: 0, color: '#CBD5E1', fontSize: 14 }}>A 6-digit code was sent to <strong>{email}</strong>. Enter it below.</p>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
                  placeholder="6-digit code"
                  autoFocus
                  style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid #374151', background: '#020617', color: '#fff', fontSize: 20, letterSpacing: 4, textAlign: 'center' }}
                />
                <button
                  onClick={verifyCode}
                  style={{ padding: '14px', borderRadius: 10, border: 0, background: '#C8A96B', color: '#0B1020', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}
                >
                  Verify & Enter
                </button>
                <button
                  onClick={() => { setCodeRequested(false); setCode(''); setError(''); }}
                  style={{ padding: '10px', borderRadius: 10, border: '1px solid #374151', background: 'transparent', color: '#9CA3AF', fontSize: 13, cursor: 'pointer' }}
                >
                  Use a different email
                </button>
                {error && <small style={{ color: '#FCA5A5' }}>{error}</small>}
              </>
            )}
          </div>
        </section>
      </main>
    );
  }

  const steps = progress?.steps || {};
  const fields = progress?.fields || {};

  return (
    <>
      {profile && token && !icaSigned && (
        <ICAContractGate token={token} session={profile} onSigned={() => setIcaSigned(true)} />
      )}
    <main style={{ minHeight: '100vh', background: '#070b14', color: '#E5E7EB', padding: 22 }}>
      <section style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 12 }}>
        <header style={{ border: '1px solid #2A3142', borderRadius: 14, background: '#0F172A', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ margin: 0 }}>Unlicensed License Sprint</h2>
              <p style={{ margin: '6px 0 0', color: '#9CA3AF' }}>{profile.name} • {profile.email} • {profile.state || 'State Pending'}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  if (typeof document !== 'undefined') {
                    document.getElementById('upline-help-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                style={{ borderRadius: 10, border: '1px solid #FCA5A5', padding: '8px 12px', background: '#B91C1C', color: '#fff', fontWeight: 800 }}
              >
                Help
              </button>
              <a href="/community-service?home=/unlicensed-backoffice" className="ghost" style={{ textDecoration: 'none', borderRadius: 10, border: '1px solid #334155', padding: '8px 12px', background: '#111827', color: '#E5E7EB' }}>Community Service</a>
              {DEMO_EMAILS.includes(clean(profile?.email || '').toLowerCase()) && (
                <a
                  href="/licensed-backoffice"
                  style={{ borderRadius: 10, border: '1px solid #C8A96B', padding: '8px 14px', background: 'rgba(200,169,107,.12)', color: '#C8A96B', fontWeight: 800, fontSize: 13, textDecoration: 'none', display: 'inline-block' }}
                >
                  🎟️ Preview Licensed Demo
                </a>
              )}
              <button onClick={logout} style={{ borderRadius: 10, border: '1px solid #334155', padding: '8px 12px', background: '#111827', color: '#E5E7EB' }}>Sign Out</button>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ color: '#9CA3AF', fontSize: 12 }}>Completion: {completion.done}/{completion.total}</div>
            <div style={{ marginTop: 6, height: 10, borderRadius: 999, background: '#1F2937', overflow: 'hidden' }}>
              <div style={{ width: `${completion.pct}%`, height: '100%', background: 'linear-gradient(90deg,#34D399,#10B981)' }} />
            </div>
            {notice ? <div style={{ marginTop: 8, color: '#86EFAC', fontSize: 13 }}>{notice}</div> : null}
            {error ? <div style={{ marginTop: 8, color: '#FCA5A5', fontSize: 13 }}>{error}</div> : null}
          </div>
        </header>

        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['steps', '📋 Steps'], ['podcast', '🎤 Podcast']].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 16px', borderRadius: 999, border: '1px solid #334155', background: tab === k ? '#1D428A' : '#0B1220', color: '#E5E7EB', cursor: 'pointer', fontWeight: 700, fontSize: 14, transition: 'all .18s ease', boxShadow: '0 4px 14px rgba(2,6,23,.25)' }}>{label}</button>
          ))}
        </div>

        {tab === 'podcast' ? (
          <div style={{ border: '1px solid #C8A96B44', borderRadius: 16, background: 'linear-gradient(160deg,#0f172a,#0b1020)', padding: '24px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <span style={{ fontSize: 30 }}>🎤</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#f1f5f9' }}>The Legacy Link Podcast</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Hosted by Kimora Link &mdash; on iHeart Radio</p>
              </div>
            </div>
            <iframe allow="autoplay" width="100%" height="352" src="https://www.iheart.com/podcast/334111550/?embed=true" frameBorder="0" style={{ borderRadius: 12, display: 'block', border: 0 }} title="The Legacy Link Podcast" />
          </div>
        ) : null}

        {tab === 'steps' ? (
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
                  {s.key === 'prelicensingStarted' ? (
                    <button
                      type="button"
                      onClick={notifyPrelicensingReady}
                      disabled={readySubmitting || saving}
                      style={{ borderRadius: 999, border: '1px solid #334155', padding: '8px 12px', background: steps[s.key] ? '#065F46' : '#1D4ED8', color: '#E5E7EB', fontWeight: 700 }}
                    >
                      {readySubmitting ? 'Sending…' : steps[s.key] ? '✅ Request Sent' : "I'm Ready"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => save({ steps: { ...steps, [s.key]: !steps[s.key] }, fields })}
                      disabled={saving || readySubmitting}
                      style={{ borderRadius: 999, border: '1px solid #334155', padding: '8px 12px', background: steps[s.key] ? '#065F46' : '#111827', color: '#E5E7EB', fontWeight: 700 }}
                    >
                      {steps[s.key] ? '✅ Complete' : 'Mark Complete'}
                    </button>
                  )}
                </div>

                {s.key === 'prelicensingStarted' && fields.prelicensingReadyRequestedAt ? (
                  <div style={{ marginTop: 8, color: '#93C5FD', fontSize: 12 }}>
                    Request sent: {new Date(fields.prelicensingReadyRequestedAt).toLocaleString()}
                  </div>
                ) : null}

                {s.key === 'examPassed' ? (
                  <label style={{ display: 'grid', gap: 4, marginTop: 8, color: '#9CA3AF' }}>
                    <span>Exam pass date</span>
                    <input
                      type="date"
                      value={fields.examPassDate || ''}
                      onChange={(e) => save({ steps, fields: { ...fields, examPassDate: e.target.value } })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #374151', background: '#0B1220', color: '#fff' }}
                    />
                  </label>
                ) : null}

                {s.key === 'residentLicenseObtained' ? (
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <label style={{ display: 'grid', gap: 4, color: '#9CA3AF' }}>
                      <span>Resident state</span>
                      <select
                        value={fields.residentState || ''}
                        onChange={(e) => save({ steps, fields: { ...fields, residentState: e.target.value } })}
                        style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #374151', background: '#0B1220', color: '#fff' }}
                      >
                        <option value="">Select state</option>
                        {US_STATE_OPTIONS.map(([code, label]) => (
                          <option key={code} value={code}>{code} — {label}</option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'grid', gap: 4, color: '#9CA3AF' }}>
                      <span>Resident license #</span>
                      <input value={fields.residentLicenseNumber || ''} onChange={(e) => save({ steps, fields: { ...fields, residentLicenseNumber: e.target.value } })} placeholder="License #" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #374151', background: '#0B1220', color: '#fff' }} />
                    </label>
                    <label style={{ display: 'grid', gap: 4, color: '#9CA3AF' }}>
                      <span>License active date</span>
                      <input type="date" value={fields.residentLicenseActiveDate || ''} onChange={(e) => save({ steps, fields: { ...fields, residentLicenseActiveDate: e.target.value } })} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #374151', background: '#0B1220', color: '#fff' }} />
                    </label>
                  </div>
                ) : null}

                {s.key === 'licenseDetailsSubmitted' ? (
                  <input value={fields.npn || ''} onChange={(e) => save({ steps, fields: { ...fields, npn: e.target.value } })} placeholder="NPN" style={{ marginTop: 8, width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #374151', background: '#0B1220', color: '#fff' }} />
                ) : null}
              </div>
            ))}
          </div>
        </div>
        ) : null}

        <div id="upline-help-section" style={{ border: '1px solid #7F1D1D', borderRadius: 12, background: '#0F172A', padding: 14, display: 'grid', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Upline Support</h3>
          <p style={{ color: '#9CA3AF', margin: 0 }}>For now, all unlicensed support messages route to <strong style={{ color: '#E5E7EB' }}>Jamal Holmes</strong>.</p>
          {uplineSupport?.upline ? (
            <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#020617', padding: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>{clean(uplineSupport.upline.name || 'Jamal Holmes')}</strong>
                <span style={{ border: '1px solid #334155', borderRadius: 999, padding: '2px 8px', fontSize: 12, color: '#CBD5E1' }}>{clean(uplineSupport.upline.role || 'Regional Director')}</span>
                {uplineSupport.upline.email ? <span style={{ color: '#93C5FD', fontSize: 13 }}>{uplineSupport.upline.email}</span> : null}
              </div>
            </div>
          ) : null}

          {uplineSupport?.loading ? <div style={{ color: '#9CA3AF' }}>Loading thread…</div> : null}
          {uplineSupport?.error ? <div style={{ color: '#FCA5A5' }}>{uplineSupport.error}</div> : null}

          <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflow: 'auto' }}>
            {!uplineSupport?.rows?.length ? (
              <div style={{ border: '1px dashed #334155', borderRadius: 10, padding: 10, color: '#9CA3AF' }}>No support messages yet.</div>
            ) : (
              uplineSupport.rows.slice(-20).map((msg, idx) => {
                const mine = clean(msg?.fromRole) === 'agent';
                return (
                  <div key={msg?.id || `${idx}-${msg?.createdAt || 'na'}`} style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: mine ? '#13203A' : '#111827' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <strong>{mine ? 'You' : clean(msg?.fromName || 'Jamal')}</strong>
                      <span style={{ color: '#9CA3AF', fontSize: 12 }}>{clean(msg?.createdAt) ? new Date(msg.createdAt).toLocaleString() : '—'}</span>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{clean(msg?.body || '')}</div>
                  </div>
                );
              })
            )}
          </div>

          <textarea
            value={uplineDraft}
            onChange={(e) => setUplineDraft(e.target.value)}
            rows={3}
            placeholder="Message Jamal..."
            style={{ width: '100%', borderRadius: 10, border: '1px solid #374151', background: '#0B1220', color: '#fff', padding: '10px 12px' }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={sendUplineMessage} disabled={uplineSending} style={{ padding: '10px 14px', borderRadius: 10, border: 0, background: '#1D4ED8', color: '#fff', fontWeight: 800 }}>
              {uplineSending ? 'Sending…' : 'Send Support Message'}
            </button>
            {uplineNotice ? <span style={{ color: uplineNotice.toLowerCase().includes('could not') ? '#FCA5A5' : '#86EFAC' }}>{uplineNotice}</span> : null}
          </div>
        </div>
      </section>
    </main>
    <PodcastPopup />
    </>
  );
}
