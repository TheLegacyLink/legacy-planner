'use client';

import { useEffect, useMemo, useState } from 'react';
import ICAContractGate from '../../components/ICAContractGate';
import PodcastPopup from '../../components/PodcastPopup';
import { CardEditor } from '../../components/DigitalCard';

function clean(v = '') { return String(v || '').trim(); }
function pct(done = 0, total = 1) { return Math.round((done / Math.max(1, total)) * 100); }

function referralCodeFromName(name = '') {
  const n = clean(name).toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).map((x) => x.trim()).filter(Boolean);
  if (n.length >= 2) return `${n[0]}.${n[n.length - 1]}`;
  return n[0] || 'member';
}

function sponsorshipLinkForProfile(profile = {}) {
  const ref = referralCodeFromName(profile?.name || '');
  return ref ? `/sponsorship-signup?ref=${encodeURIComponent(ref)}` : '/sponsorship-signup';
}

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
  { key: 'communitySkool', title: 'Step 2 — Join Skool Community (Training)', note: 'Join our training community: https://www.skool.com/legacylink/about — stay active and complete assigned tasks.' },
  { key: 'jamalContacted', title: 'Step 3 — Jamal Reached Out (Pre-Licensing)', note: 'Jamal runs pre-licensing for all unlicensed agents. He will contact you within 1–3 business days. Mark this once he has reached out.' },
  { key: 'prelicensingStarted', title: 'Step 4 — Pre-Licensing Course Started', note: "Enrolled in your pre-licensing course. Hit ‘I’m Ready’ to notify Jamal you’re set to begin.", useReadyButton: true },
  { key: 'examScheduled', title: 'Step 5 — State Exam Scheduled', note: 'Schedule your state insurance licensing exam. Speed matters — this is your 30-Day Sprint.' },
  { key: 'examPassed', title: 'Step 6 — State Exam Passed', note: 'Passed your exam? Mark it here and enter your exam pass date.' },
  { key: 'licenseReceived', title: 'Step 7 — License Received', note: 'Official license in hand. This completes your 30-Day Sprint and triggers your $250 bonus!' },
  { key: 'watchedWhateverItTakes', title: 'Step 8 — Watch "Whatever It Takes"', note: 'Watch https://youtu.be/SVvU9SvCH9o?si=nzgjgEa7DfGQlxmX and leave a comment to confirm completion.' },
];

export default function UnlicensedBackofficePage() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  // Phone removed: unlicensed login requires full name + email exact match.
  const [code, setCode] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [showDemoSelect, setShowDemoSelect] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [onboardingData, setOnboardingData] = useState(null); // { agent, checklist }
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingSaving, setOnboardingSaving] = useState(false);

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
  const [tab, setTab] = useState('onboarding');
  const [uplineSending, setUplineSending] = useState(false);
  const [uplineNotice, setUplineNotice] = useState('');
  const [copiedReferral, setCopiedReferral] = useState(false);

  const personalSponsorshipLink = useMemo(() => sponsorshipLinkForProfile(profile || {}), [profile]);

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
        // Show Whatever It Takes video popup once per session
        if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem('wit_modal_shown')) {
          setShowVideoModal(true);
          sessionStorage.setItem('wit_modal_shown', '1');
        }
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

  // Onboarding tracker data — load + poll every 30s
  const loadOnboarding = async (tok) => {
    if (!tok) return;
    try {
      const res = await fetch('/api/onboarding/me', { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.ok) setOnboardingData(data);
      } else if (res.status === 404) {
        setOnboardingData(null); // not enrolled in IC/Elite tracker
      }
    } catch {}
  };

  useEffect(() => {
    if (!token) return;
    loadOnboarding(token);
    const interval = setInterval(() => loadOnboarding(token), 30000);
    return () => clearInterval(interval);
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
          ? 'No account found for that email. If you just signed your contract, wait 1\u20132 minutes and try again \u2014 it takes a moment to activate. Make sure you\'re using the same email from your application.'
          : 'Unable to send code right now. Please try again or email support@thelegacylink.com');
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
                <div style={{ background: '#0f2a1a', border: '1px solid #16a34a', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ margin: 0, color: '#86efac', fontSize: 13, fontWeight: 600 }}>&#10003; Code sent to {email}</p>
                  <p style={{ margin: '4px 0 0', color: '#4ade80', fontSize: 12 }}>&#128276; <strong>Check your spam/junk folder</strong> if you don&apos;t see it within 2 minutes. The email comes from <strong>info@thelegacylink.com</strong></p>
                </div>
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

  const WIT_VIDEO_ID = 'SVvU9SvCH9o';

  return (
    <>
      {/* Whatever It Takes — sign-in video popup */}
      {showVideoModal && (
        <div
          onClick={() => setShowVideoModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, borderRadius: 16, overflow: 'hidden', background: '#0B1220', border: '1px solid #1e3a5f', boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #1e3a5f' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#F8FAFC' }}>Whatever It Takes</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Watch the full video &mdash; leave a comment when done</div>
              </div>
              <button onClick={() => setShowVideoModal(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '4px 8px' }}>&#x2715;</button>
            </div>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <iframe
                src={`https://www.youtube.com/embed/${WIT_VIDEO_ID}?autoplay=1&rel=0`}
                title="Whatever It Takes"
                allow="autoplay; encrypted-media"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
              />
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowVideoModal(false)} style={{ padding: '10px 22px', borderRadius: 8, background: '#1651AE', border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Got it — Close</button>
            </div>
          </div>
        </div>
      )}

      {profile && token && !icaSigned && !profile?.skipIca && (
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

        {/* Referral Link Card */}
        <div style={{ border: '2px solid #C8A96B', borderRadius: 14, background: 'linear-gradient(160deg,#1a1200,#0d0a00)', padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#FCD34D' }}>🔗 Your Referral Link</div>
              <div style={{ color: '#FEF3C7', fontSize: 13, marginTop: 4 }}>Share this with anyone in your network you feel this opportunity could benefit.</div>
            </div>
            <span style={{ border: '1px solid #92400E', background: '#1a1200', color: '#FCD34D', borderRadius: 999, padding: '3px 12px', fontSize: 11, fontWeight: 800 }}>UNLICENSED</span>
          </div>
          <div style={{ color: '#FCD34D', fontWeight: 700, fontSize: 14 }}>Every referral you make right now builds your account. Your bonus is held and released the moment you get licensed — start stacking before you even pass your exam.</div>
          <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #92400E', background: '#020617', color: '#FCD34D', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, wordBreak: 'break-all' }}>
            {`${typeof window !== 'undefined' ? window.location.origin : 'https://innercirclelink.com'}${personalSponsorshipLink}`}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={personalSponsorshipLink} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button type="button" style={{ padding: '11px 18px', borderRadius: 10, border: 0, background: '#C8A96B', color: '#0B1020', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Open My Referral Page →</button>
            </a>
            <button type="button" onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}${personalSponsorshipLink}`);
              setCopiedReferral(true);
              setTimeout(() => setCopiedReferral(false), 1600);
            }} style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid #92400E', background: '#1a1200', color: '#FCD34D', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              {copiedReferral ? '✅ Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['card', '🪦 Virtual Card'], ['onboarding', '🗺️ Onboarding'], ['podcast', '🎥 Whatever It Takes']].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 16px', borderRadius: 999, border: '1px solid #334155', background: tab === k ? '#1D428A' : '#0B1220', color: '#E5E7EB', cursor: 'pointer', fontWeight: 700, fontSize: 14, transition: 'all .18s ease', boxShadow: '0 4px 14px rgba(2,6,23,.25)' }}>{label}</button>
          ))}
        </div>

        {tab === 'podcast' ? (
          <div style={{ border: '1px solid #C8A96B44', borderRadius: 16, background: 'linear-gradient(160deg,#0f172a,#0b1020)', padding: '24px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <span style={{ fontSize: 30 }}>&#127909;</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#f1f5f9' }}>Whatever It Takes</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Watch the full video &mdash; leave a comment when done. This is a required step.</p>
              </div>
            </div>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 12, overflow: 'hidden' }}>
              <iframe
                src={`https://www.youtube.com/embed/${WIT_VIDEO_ID}?rel=0`}
                title="Whatever It Takes"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
              />
            </div>
          </div>
        ) : null}

        {tab === 'onboarding' ? (
          <div style={{ display: 'grid', gap: 16 }}>
            {onboardingLoading && !onboardingData && (
              <p style={{ color: '#94A3B8', textAlign: 'center', padding: 32 }}>Loading your onboarding tracker…</p>
            )}
            {!onboardingLoading && onboardingData === null && (
              <div style={{ border: '1px solid #1e3a5f', borderRadius: 14, background: '#0B1220', padding: '28px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                <p style={{ color: '#94A3B8', margin: 0 }}>Your onboarding tracker isn&apos;t set up yet. Contact <a href="mailto:support@thelegacylink.com" style={{ color: '#60A5FA' }}>support@thelegacylink.com</a> to get enrolled.</p>
              </div>
            )}
            {onboardingData && (() => {
              const { agent, checklist = [] } = onboardingData;
              const coreItems = checklist.filter(r => r.visible && !r.item?.recurring);
              const recurringItems = checklist.filter(r => r.visible && r.item?.recurring);
              const doneCount = coreItems.filter(r => r.checked).length;
              const totalCount = coreItems.length;
              const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
              const daysSince = agent?.start_date ? Math.floor((Date.now() - new Date(agent.start_date)) / 86400000) : 0;
              const AGENT_CAN_CHECK = new Set(['YOU DO', 'WE GUIDE']);

              const handleCheck = async (itemId, checked) => {
                setOnboardingSaving(true);
                try {
                  await fetch('/api/onboarding/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ item_id: itemId, checked })
                  });
                  await loadOnboarding(token);
                } catch {} finally { setOnboardingSaving(false); }
              };

              const renderItem = (row) => {
                const item = row.item || {};
                const canCheck = AGENT_CAN_CHECK.has(item.owner);
                const ownerColors = { 'YOU DO': '#D4A24A', 'WE GUIDE': '#D4A24A', 'WE DO': '#64748b', 'CARRIER': '#64748b', 'WE PAY': '#64748b' };
                return (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
                    background: row.checked ? 'rgba(67,122,34,0.08)' : row.is_overdue ? 'rgba(161,44,123,0.07)' : '#0f172a',
                    border: `1px solid ${row.checked ? '#3d6b1a' : row.is_overdue ? '#7c1a5e' : '#1e3a5f'}`,
                    borderRadius: 10
                  }}>
                    <button
                      onClick={() => canCheck && handleCheck(item.id, !row.checked)}
                      disabled={!canCheck || onboardingSaving}
                      style={{
                        width: 26, height: 26, borderRadius: 6, flexShrink: 0, border: `2px solid ${row.checked ? '#437a22' : '#334155'}`,
                        background: row.checked ? '#437a22' : '#0b1220', color: '#fff', cursor: canCheck ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14
                      }}
                    >
                      {row.checked ? '✓' : !canCheck ? '🔒' : ''}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: row.checked ? '#86efac' : '#f1f5f9', textDecoration: row.checked ? 'line-through' : 'none', lineHeight: 1.3 }}>
                        <span style={{ color: '#B28147', marginRight: 8, fontSize: 12 }}>{String(item.id).padStart(2,'0')}</span>
                        {(item.title || '').replace(/ \(Elite\)$| \(Paid In Full Only\)$/, '')}
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: ownerColors[item.owner] || '#94A3B8', fontWeight: 600 }}>{item.owner}</span>
                        {!item.recurring && <span style={{ fontSize: 11, color: '#475569' }}>Days {item.target_day_start}–{item.target_day_end}</span>}
                        {item.recurring && <span style={{ fontSize: 11, color: '#475569' }}>Every {item.target_day_end === 7 ? 'week' : 'month'}</span>}
                        {row.is_overdue && <span style={{ fontSize: 11, color: '#e879b0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overdue</span>}
                        {item.elite_only && <span style={{ fontSize: 10, background: '#D4A24A', color: '#0A0A0A', padding: '2px 6px', borderRadius: 3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Elite</span>}
                        {row.checked && row.checked_at && <span style={{ fontSize: 11, color: '#64748b' }}>Done {new Date(row.checked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <>
                  {/* Header */}
                  <div style={{ border: '1px solid #1e3a5f', borderRadius: 14, background: '#0B1220', padding: '20px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B28147', marginBottom: 4 }}>Your Onboarding Path</div>
                        <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 22, color: '#F8FAFC' }}>Welcome, {(agent.first_name || '').split(' ')[0]}.</div>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                          {agent.tier === 'elite' ? 'Inner Circle Elite' : 'Inner Circle'} &mdash; Day {daysSince}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 20 }}>
                        {[['Complete', doneCount], ['Remaining', totalCount - doneCount], ['Day', daysSince]].map(([l,v]) => (
                          <div key={l} style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 26, fontWeight: 700, color: '#F8FAFC', lineHeight: 1 }}>{v}</div>
                            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ height: 8, background: '#1e3a5f', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #8A6234, #D4A24A)', borderRadius: 99, transition: 'width 0.6s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                      <span style={{ color: '#B28147', fontWeight: 700 }}>{pct}% Complete</span>
                      <span style={{ color: '#64748b' }}>{pct < 30 ? 'Foundation phase. Keep moving.' : pct < 70 ? 'Momentum building. Stay disciplined.' : pct < 100 ? 'Almost fully producing. Finish strong.' : 'Fully producing. Lead by example.'}</span>
                    </div>
                  </div>

                  {/* Core items */}
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: -8 }}>Core Onboarding</div>
                  {coreItems.map(renderItem)}

                  {recurringItems.length > 0 && (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#B28147', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: -8, marginTop: 8 }}>Recurring Discipline</div>
                      {recurringItems.map(renderItem)}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        ) : null}

        {tab === 'card' ? (
          <div style={{ background: '#0a0c10', borderRadius: 18, padding: 24 }}>
            <CardEditor
              refCode={referralCodeFromName(profile?.name || '')}
              profile={profile}
            />
          </div>
        ) : null}
      </section>
    </main>
    <PodcastPopup />
    </>
  );
}
