'use client';

import { useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'inner_circle_hub_member_v1';

function clean(v = '') { return String(v || '').trim(); }
function readSession() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
function firstNameFromMember(member = {}) {
  return clean(member?.applicantName || member?.email).split(/\s+/)[0] || 'Member';
}
function onboardingState(member = {}) {
  const contract = Boolean(member?.contractSignedAt);
  const payment = Boolean(member?.paymentReceivedAt);
  const password = Boolean(member?.hasPassword);
  const active = Boolean(member?.active);
  const pct = Math.round(([contract, payment, password].filter(Boolean).length / 3) * 100);
  return { contract, payment, password, active, pct };
}
function todayDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function toNum(v = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}
function availableTabs(member = {}) {
  const modules = member?.modules || {};
  const all = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'faststart', label: 'Fast Track' },
    { key: 'scripts', label: 'Scripts' },
    { key: 'execution', label: 'Execution' },
    { key: 'vault', label: 'Vault' },
    { key: 'tracker', label: 'Tracker' },
    { key: 'rewards', label: 'Activity Rewards' },
    { key: 'links', label: 'My Links' }
  ];
  return all.filter((t) => modules?.[t.key] !== false);
}
function qrUrl(value = '') {
  const data = encodeURIComponent(value || '');
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${data}`;
}

export default function InnerCircleHubPage() {
  const [member, setMember] = useState(() => readSession());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetDone, setResetDone] = useState(false);

  const [kpi, setKpi] = useState(null);
  const [scripts, setScripts] = useState([]);
  const [scriptFilter, setScriptFilter] = useState('all');
  const [vault, setVault] = useState({ content: [], calls: [], onboarding: [] });

  const [tab, setTab] = useState('dashboard');
  const [dailyRows, setDailyRows] = useState([]);
  const [trackerPeriod, setTrackerPeriod] = useState('daily');
  const [activityType, setActivityType] = useState('all');
  const [activityRows, setActivityRows] = useState([]);
  const [activitySummary, setActivitySummary] = useState({ submitted: 0, approved: 0, declined: 0, booked: 0, fng: 0, completed: 0 });
  const [activityStats, setActivityStats] = useState({
    daily: { bookings: 0, sponsorshipSubmitted: 0, sponsorshipApproved: 0, fngSubmitted: 0 },
    weekly: { bookings: 0, sponsorshipSubmitted: 0, sponsorshipApproved: 0, fngSubmitted: 0 },
    monthly: { bookings: 0, sponsorshipSubmitted: 0, sponsorshipApproved: 0, fngSubmitted: 0 }
  });
  const [tracker, setTracker] = useState({
    dateKey: todayDateKey(),
    calls: 0,
    bookings: 0,
    sponsorshipApps: 0,
    fngSubmittedApps: 0,
    checklist: {
      workNewLeads: false,
      followUpWarmLeads: false,
      bookOneConversation: false,
      postContent: false,
      updateTracker: false
    }
  });
  const [savingTracker, setSavingTracker] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  const gate = useMemo(() => onboardingState(member || {}), [member]);
  const unlocked = gate.active;
  const tabs = useMemo(() => availableTabs(member || {}), [member]);

  const filteredScripts = useMemo(() => {
    if (scriptFilter === 'all') return scripts;
    return (scripts || []).filter((s) => clean(s?.category).toLowerCase() === scriptFilter);
  }, [scripts, scriptFilter]);

  const checklistDoneCount = useMemo(() => {
    const c = tracker?.checklist || {};
    return [c.workNewLeads, c.followUpWarmLeads, c.bookOneConversation, c.postContent, c.updateTracker].filter(Boolean).length;
  }, [tracker?.checklist]);

  const filteredActivityRows = useMemo(() => {
    if (activityType === 'all') return activityRows;
    if (activityType === 'decision') return (activityRows || []).filter((r) => clean(r?.type) === 'decision');
    return (activityRows || []).filter((r) => clean(r?.type) === activityType);
  }, [activityRows, activityType]);

  const periodTotals = useMemo(() => {
    const key = trackerPeriod === 'weekly' ? 'weekly' : trackerPeriod === 'monthly' ? 'monthly' : 'daily';
    const s = activityStats?.[key] || {};

    const now = new Date();
    const today = todayDateKey();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const calls = (Array.isArray(dailyRows) ? dailyRows : []).reduce((acc, r) => {
      const dk = clean(r?.dateKey);
      if (!dk) return acc;
      const d = new Date(`${dk}T00:00:00`);
      if (Number.isNaN(d.getTime())) return acc;
      if (key === 'daily' && dk !== today) return acc;
      if (key === 'weekly' && d < weekStart) return acc;
      if (key === 'monthly' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return acc;
      return acc + toNum(r?.calls);
    }, 0);

    return {
      calls,
      bookings: toNum(s?.bookings),
      sponsorshipApps: toNum(s?.sponsorshipSubmitted),
      sponsorshipApproved: toNum(s?.sponsorshipApproved),
      fngSubmittedApps: toNum(s?.fngSubmitted),
      appsTotal: toNum(s?.sponsorshipSubmitted) + toNum(s?.fngSubmitted)
    };
  }, [activityStats, trackerPeriod, dailyRows]);

  const sponsorshipLink = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_SPONSORSHIP_LINK_BASE || '/sponsorship-signup';
    const ref = encodeURIComponent(member?.email || member?.id || 'member');
    return base.includes('?') ? `${base}&ref=${ref}` : `${base}?ref=${ref}`;
  }, [member?.email, member?.id]);

  const onboardingPlaybookUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_INNER_CIRCLE_PLAYBOOK_URL || '/docs/inner-circle/legacy-link-inner-circle-onboarding-playbook-v2.pdf';
  }, []);

  const contractLinks = useMemo(() => {
    return [
      {
        name: 'Inner Circle Contract (IUL Agreement)',
        url: process.env.NEXT_PUBLIC_DOCUSIGN_IUL_ICA_URL || '/iul-agreement'
      },
      {
        name: 'Contract Agreement Page',
        url: '/contract-agreement'
      }
    ];
  }, []);

  useEffect(() => {
    if (!member?.email && !member?.applicantName) return;
    let canceled = false;

    async function loadAll() {
      try {
        const kpiUrl = `/api/inner-circle-hub-kpi?name=${encodeURIComponent(member?.applicantName || '')}&email=${encodeURIComponent(member?.email || '')}`;
        const dailyUrl = `/api/inner-circle-hub-daily?memberId=${encodeURIComponent(member?.id || '')}&email=${encodeURIComponent(member?.email || '')}`;

        const activityUrl = `/api/inner-circle-hub-activity?name=${encodeURIComponent(member?.applicantName || '')}&email=${encodeURIComponent(member?.email || '')}`;

        const [kpiRes, dailyRes, scriptsRes, vaultRes, activityRes] = await Promise.all([
          fetch(kpiUrl, { cache: 'no-store' }),
          fetch(dailyUrl, { cache: 'no-store' }),
          fetch('/api/inner-circle-hub-scripts', { cache: 'no-store' }),
          fetch('/api/inner-circle-hub-vault', { cache: 'no-store' }),
          fetch(activityUrl, { cache: 'no-store' })
        ]);

        const kpiData = await kpiRes.json().catch(() => ({}));
        const dailyData = await dailyRes.json().catch(() => ({}));
        const scriptsData = await scriptsRes.json().catch(() => ({}));
        const vaultData = await vaultRes.json().catch(() => ({}));
        const activityData = await activityRes.json().catch(() => ({}));

        if (!canceled && kpiRes.ok && kpiData?.ok) setKpi(kpiData.kpi || null);
        if (!canceled && dailyRes.ok && dailyData?.ok) {
          const rows = Array.isArray(dailyData.rows) ? dailyData.rows : [];
          setDailyRows(rows);
          const today = rows.find((r) => clean(r?.dateKey) === todayDateKey());
          if (today) {
            setTracker((p) => ({
              ...p,
              dateKey: today.dateKey || p.dateKey,
              calls: today.calls ?? p.calls,
              bookings: today.bookings ?? p.bookings,
              sponsorshipApps: today.sponsorshipApps ?? p.sponsorshipApps,
              fngSubmittedApps: today.fngSubmittedApps ?? p.fngSubmittedApps,
              checklist: {
                workNewLeads: Boolean(today?.checklist?.workNewLeads),
                followUpWarmLeads: Boolean(today?.checklist?.followUpWarmLeads),
                bookOneConversation: Boolean(today?.checklist?.bookOneConversation),
                postContent: Boolean(today?.checklist?.postContent),
                updateTracker: Boolean(today?.checklist?.updateTracker)
              }
            }));
          }
        }
        if (!canceled && scriptsRes.ok && scriptsData?.ok) setScripts(Array.isArray(scriptsData.rows) ? scriptsData.rows : []);
        if (!canceled && vaultRes.ok && vaultData?.ok) setVault(vaultData.vault || { content: [], calls: [], onboarding: [] });
        if (!canceled && activityRes.ok && activityData?.ok) {
          setActivityRows(Array.isArray(activityData.rows) ? activityData.rows : []);
          setActivitySummary(activityData.summary || { submitted: 0, approved: 0, declined: 0, booked: 0, fng: 0, completed: 0 });
          setActivityStats(activityData.stats || {
            daily: { bookings: 0, sponsorshipSubmitted: 0, sponsorshipApproved: 0, fngSubmitted: 0 },
            weekly: { bookings: 0, sponsorshipSubmitted: 0, sponsorshipApproved: 0, fngSubmitted: 0 },
            monthly: { bookings: 0, sponsorshipSubmitted: 0, sponsorshipApproved: 0, fngSubmitted: 0 }
          });
        }
      } catch {
        if (!canceled) {
          setKpi(null);
          setDailyRows([]);
          setScripts([]);
          setVault({ content: [], calls: [], onboarding: [] });
        }
      }
    }

    loadAll();
    return () => { canceled = true; };
  }, [member?.id, member?.email, member?.applicantName]);

  useEffect(() => {
    if (!tabs.find((t) => t.key === tab) && tabs[0]) setTab(tabs[0].key);
  }, [tabs, tab]);

  useEffect(() => {
    if (typeof window === 'undefined' || member) return;
    const params = new URLSearchParams(window.location.search || '');
    const token = clean(params.get('reset'));
    const mail = clean(params.get('email'));
    if (token) {
      setForgotMode(true);
      setResetToken(token);
      if (mail) setEmail(mail);
    }
  }, [member]);

  async function login(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/inner-circle-hub-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'authenticate', email, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        const reason = String(data?.error || '').toLowerCase();
        setError(reason === 'onboarding_locked' ? 'Your hub is not active yet. Complete contract + payment + password setup with your advisor.' : 'Invalid login. Check email/password.');
        return;
      }
      setMember(data.member);
      localStorage.setItem(SESSION_KEY, JSON.stringify(data.member));
    } finally {
      setLoading(false);
    }
  }

  async function requestPasswordReset(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setForgotSent(false);
    try {
      await fetch('/api/inner-circle-hub-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_password_reset', email, origin: window?.location?.origin || '' })
      });
      setForgotSent(true);
    } catch {
      setError('Could not send reset email right now. Try again in a minute.');
    } finally {
      setLoading(false);
    }
  }

  async function submitPasswordReset(e) {
    e.preventDefault();
    setError('');
    if (!newPassword || newPassword.length < 8) {
      setError('Use at least 8 characters for your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/inner-circle-hub-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_password', email, token: resetToken, password: newPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError('Reset link is invalid or expired. Tap Forgot Password to request a new one.');
        return;
      }
      setResetDone(true);
      setForgotMode(false);
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setMember(null);
    localStorage.removeItem(SESSION_KEY);
  }

  async function copyLink(value = '', key = '') {
    try {
      if (!value) return;
      await navigator.clipboard.writeText(value);
      setCopiedKey(key || value);
      setTimeout(() => setCopiedKey(''), 1500);
    } catch {
      setCopiedKey('');
    }
  }

  async function saveTracker() {
    if (!member?.email || !tracker.dateKey) return;
    setSavingTracker(true);
    try {
      await fetch('/api/inner-circle-hub-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          memberId: member?.id || '',
          email: member?.email || '',
          dateKey: tracker.dateKey,
          calls: toNum(tracker.calls),
          checklist: tracker.checklist || {}
        })
      });

      const dailyUrl = `/api/inner-circle-hub-daily?memberId=${encodeURIComponent(member?.id || '')}&email=${encodeURIComponent(member?.email || '')}`;
      const res = await fetch(dailyUrl, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setDailyRows(Array.isArray(data.rows) ? data.rows : []);
      }
    } finally {
      setSavingTracker(false);
    }
  }

  if (!member) {
    return (
      <main className="publicPage" style={{ minHeight: '100vh', background: 'radial-gradient(circle at top,#0b1326 0%,#020617 45%, #000 100%)', color: '#e5e7eb' }}>
        <div className="panel" style={{ maxWidth: 460, border: '1px solid #1f2937', background: '#020617' }}>
          <p style={{ margin: 0, color: '#93c5fd', fontWeight: 700 }}>THE LEGACY LINK</p>
          <h2 style={{ marginTop: 8, marginBottom: 6, color: '#fff' }}>Inner Circle Production Hub</h2>
          <p style={{ marginTop: 0, color: '#cbd5e1' }}>Member Login</p>
          {!forgotMode ? (
            <form onSubmit={login} className="settingsGrid" style={{ rowGap: 12 }}>
              <label style={{ color: '#e2e8f0' }}>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} /></label>
              <label style={{ color: '#e2e8f0' }}>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} /></label>
              <button type="submit" className="publicPrimaryBtn" disabled={loading}>{loading ? 'Signing in...' : 'Enter Hub'}</button>
              <button type="button" className="ghost" onClick={() => { setForgotMode(true); setError(''); setForgotSent(false); setResetDone(false); }}>
                Forgot Password?
              </button>
              {resetDone ? <p style={{ marginTop: 4, color: '#86efac' }}>Password updated. You can now sign in with your new password.</p> : null}
              {error ? <p className="red" style={{ marginTop: 4 }}>{error}</p> : null}
            </form>
          ) : (
            <form onSubmit={resetToken ? submitPasswordReset : requestPasswordReset} className="settingsGrid" style={{ rowGap: 12 }}>
              <label style={{ color: '#e2e8f0' }}>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} /></label>

              {resetToken ? (
                <>
                  <label style={{ color: '#e2e8f0' }}>New Password<input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} /></label>
                  <label style={{ color: '#e2e8f0' }}>Confirm Password<input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} /></label>
                  <button type="submit" className="publicPrimaryBtn" disabled={loading}>{loading ? 'Updating...' : 'Set New Password'}</button>
                </>
              ) : (
                <>
                  <button type="submit" className="publicPrimaryBtn" disabled={loading}>{loading ? 'Sending...' : 'Email Reset Link'}</button>
                  <p className="muted" style={{ marginTop: 4 }}>We’ll send a secure reset link to your email.</p>
                  {forgotSent ? <p style={{ marginTop: 4, color: '#86efac' }}>Check your inbox for the reset email.</p> : null}
                </>
              )}

              <button type="button" className="ghost" onClick={() => { setForgotMode(false); setResetToken(''); setError(''); }}>
                Back to Login
              </button>
              {error ? <p className="red" style={{ marginTop: 4 }}>{error}</p> : null}
            </form>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="publicPage" style={{ minHeight: '100vh', background: '#020617', color: '#e5e7eb' }}>
      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #1f2937', background: '#030a17' }}>
        <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, color: '#93c5fd', fontWeight: 700 }}>THE LEGACY LINK</p>
            <h2 style={{ marginTop: 6, color: '#fff' }}>Inner Circle Production Hub</h2>
            <p className="muted" style={{ marginTop: -8 }}>Welcome, {firstNameFromMember(member)}</p>
          </div>
          <button type="button" className="ghost" onClick={logout}>Logout</button>
        </div>

        {!unlocked ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="panel" style={{ borderColor: '#f59e0b', background: '#451a03' }}>
              <h3 style={{ marginTop: 0 }}>Onboarding Locked</h3>
              <p style={{ margin: 0 }}>Your hub unlocks after all setup items are complete.</p>
            </div>
            <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#020617' }}>
              <strong style={{ color: '#fff' }}>Unlock Checklist ({gate.pct}% complete)</strong>
              <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#dbeafe', display: 'grid', gap: 6 }}>
                <li>{gate.contract ? '✅' : '⬜️'} Contract signed</li>
                <li>{gate.payment ? '✅' : '⬜️'} Payment received</li>
                <li>{gate.password ? '✅' : '⬜️'} Password set</li>
              </ul>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
              {tabs.map((t) => <button key={t.key} type="button" className={tab === t.key ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTab(t.key)}>{t.label}</button>)}
            </div>

            {tab === 'dashboard' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#020617' }}>
                  <strong style={{ color: '#fff', fontSize: 16 }}>KPI Dashboard (This Month)</strong>
                  <div style={{ display: 'grid', gap: 10, marginTop: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
                    <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Leads</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{kpi?.leadsReceived ?? 0}</div></div>
                    <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Bookings</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{kpi?.bookingsThisMonth ?? 0}</div></div>
                    <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Closes</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{kpi?.closesThisMonth ?? 0}</div><small className="muted">Close Rate: {kpi?.closeRate ?? 0}%</small></div>
                    <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Potential</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>${kpi?.potentialEarned ?? kpi?.grossEarned ?? 0}</div></div>
                  </div>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#061126' }}>
                  <strong style={{ color: '#fff', fontSize: 16 }}>Onboarding Playbook</strong>
                  <p style={{ color: '#cbd5e1', marginTop: 8, marginBottom: 10 }}>Download your Inner Circle onboarding PDF anytime.</p>
                  <a
                    href={onboardingPlaybookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="publicPrimaryBtn"
                    style={{ display: 'inline-block', textDecoration: 'none' }}
                  >
                    Download Playbook PDF
                  </a>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#fff' }}>Activity Flow</strong>
                  </div>

                  <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <button type="button" className={activityType === 'all' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setActivityType('all')}>All</button>
                    <button type="button" className={activityType === 'booked' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setActivityType('booked')}>Booked ({activitySummary.booked || 0})</button>
                    <button type="button" className={activityType === 'decision' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setActivityType('decision')}>Sponsorship ({(activitySummary.approved || 0) + (activitySummary.declined || 0)})</button>
                    <button type="button" className={activityType === 'fng' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setActivityType('fng')}>FNG Submitted ({activitySummary.fng || 0})</button>
                    <button type="button" className={activityType === 'completed' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setActivityType('completed')}>Application Approved ({activitySummary.completed || 0})</button>
                  </div>

                  <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <small className="muted">Legend:</small>
                    <span className="pill onpace">Booked</span>
                    <span className="pill" style={{ background: '#1e3a8a', color: '#dbeafe', border: '1px solid #1d4ed8' }}>Sponsorship</span>
                    <span className="pill offpace">FNG Submitted</span>
                    <span className="pill onpace">Application Approved</span>
                  </div>

                  <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                    {(filteredActivityRows || []).map((row, idx) => {
                      const toneClass = row?.type === 'booked' || row?.type === 'completed'
                        ? 'onpace'
                        : row?.type === 'decision'
                          ? ''
                          : 'offpace';
                      const label = row?.type === 'booked'
                        ? 'Booked'
                        : row?.type === 'decision'
                          ? (row?.decision === 'declined' ? 'Declined' : 'Approved')
                          : row?.type === 'completed'
                            ? 'Application Approved'
                            : 'FNG Submitted';
                      const fngHref = `/inner-circle-app-submit?name=${encodeURIComponent(row?.name || '')}&email=${encodeURIComponent(row?.email || '')}&phone=${encodeURIComponent(row?.phone || '')}&referredBy=${encodeURIComponent(member?.applicantName || '')}`;
                      return (
                        <div key={`${row?.type}_${row?.name}_${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 8, border: row?.type === 'booked' ? '1px solid #22c55e' : '1px solid #1f2937', boxShadow: row?.type === 'booked' ? '0 0 0 1px rgba(34,197,94,0.25), 0 0 14px rgba(34,197,94,0.20)' : 'none', borderRadius: 8, padding: '8px 10px', background: '#030a17' }}>
                          {row?.type === 'decision' ? (
                            <span className="pill" style={{ background: '#1e3a8a', color: '#dbeafe', border: '1px solid #1d4ed8' }}>{label}</span>
                          ) : (
                            <span className={`pill ${toneClass}`}>{label}</span>
                          )}
                          <div style={{ color: '#e2e8f0', fontSize: 14, flex: 1 }}>{row?.name || 'Unknown'}</div>
                          {row?.showFngButton ? (
                            <a href={fngHref} className="ghost" style={{ textDecoration: 'none', marginLeft: 'auto', fontSize: 12 }}>Mark FNG Submitted</a>
                          ) : null}
                        </div>
                      );
                    })}
                    {!filteredActivityRows.length ? <small className="muted">No activity yet.</small> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'faststart' ? (
              <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 16, background: '#071022' }}>
                <strong style={{ color: '#fff', fontSize: 18 }}>First 14 Days Fast Track</strong>
                <p style={{ color: '#cbd5e1', marginTop: 8, marginBottom: 10, fontSize: 15 }}>Move in sequence. Execute daily. Keep momentum high.</p>
                <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#f1f5f9', display: 'grid', gap: 10, fontWeight: 600, lineHeight: 1.5, fontSize: 15 }}>
                  <li><span style={{ color: '#93c5fd' }}>Day 1–2:</span> CRM setup, profile setup, scripts setup</li>
                  <li><span style={{ color: '#93c5fd' }}>Day 3–5:</span> Start 50+ outbound conversations</li>
                  <li><span style={{ color: '#93c5fd' }}>Day 6–9:</span> Book discovery calls and run appointment flow</li>
                  <li><span style={{ color: '#93c5fd' }}>Day 10–14:</span> Submit first apps and tighten follow-up cadence</li>
                </ul>
              </div>
            ) : null}

            {tab === 'scripts' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <p style={{ color: '#cbd5e1', margin: 0 }}>Filter scripts by conversation type.</p>
                <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className={scriptFilter === 'all' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setScriptFilter('all')}>All</button>
                  <button type="button" className={scriptFilter === 'sponsorship' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setScriptFilter('sponsorship')}>Sponsorship</button>
                  <button type="button" className={scriptFilter === 'life-insurance' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setScriptFilter('life-insurance')}>Life Insurance</button>
                </div>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
                  {(filteredScripts || []).map((item) => (
                    <div key={item?.id} style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                      <strong style={{ color: '#fff' }}>{item?.title || 'Untitled'}</strong>
                      <small className="muted" style={{ display: 'block', textTransform: 'uppercase', marginTop: 4 }}>{item?.category || 'general'}</small>
                      <p className="muted" style={{ marginBottom: 0 }}>{item?.text || ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {tab === 'execution' ? (
              <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 14, background: '#071022' }}>
                <strong style={{ color: '#fff', fontSize: 17 }}>Today Action Checklist</strong>
                <p style={{ color: '#dbeafe', marginTop: 8, marginBottom: 6, fontSize: 15 }}>Date: {tracker.dateKey || todayDateKey()}</p>
                <p style={{ color: '#93c5fd', marginTop: 0, fontWeight: 700, fontSize: 15 }}>Progress: {checklistDoneCount}/5 complete</p>
                <div style={{ display: 'grid', gap: 8 }}>
                  {[
                    ['workNewLeads', 'Work new leads'],
                    ['followUpWarmLeads', 'Follow up warm leads'],
                    ['bookOneConversation', 'Book at least one conversation'],
                    ['postContent', 'Post content for lead generation'],
                    ['updateTracker', 'Update tracker before end of day']
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#f1f5f9', fontWeight: 600, fontSize: 15 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(tracker?.checklist?.[key])}
                        onChange={(e) => setTracker((p) => ({ ...p, checklist: { ...(p?.checklist || {}), [key]: e.target.checked } }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <button type="button" className="publicPrimaryBtn" onClick={saveTracker} disabled={savingTracker} style={{ marginTop: 10 }}>
                  {savingTracker ? 'Saving...' : 'Save Checklist'}
                </button>
              </div>
            ) : null}

            {tab === 'vault' ? (
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
                {[
                  ['Content Vault', vault?.content || []],
                  ['Call Vault', vault?.calls || []],
                  ['Onboarding Vault', vault?.onboarding || []]
                ].map(([title, items]) => (
                  <div key={title} style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                    <strong style={{ color: '#fff' }}>{title}</strong>
                    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                      {(items || []).map((item) => (
                        <div key={item?.id} style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}>
                          <div style={{ color: '#fff', fontWeight: 700 }}>{item?.title || 'Untitled'}</div>
                          <small className="muted" style={{ textTransform: 'uppercase' }}>{item?.tag || 'general'}</small>
                          <p className="muted" style={{ marginBottom: 0 }}>{item?.body || ''}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === 'tracker' ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#020617' }}>
                  <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <strong style={{ color: '#fff', fontSize: 17 }}>Production Tracker</strong>
                    <div className="panelRow" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" className={trackerPeriod === 'daily' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTrackerPeriod('daily')}>Daily</button>
                      <button type="button" className={trackerPeriod === 'weekly' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTrackerPeriod('weekly')}>Weekly</button>
                      <button type="button" className={trackerPeriod === 'monthly' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTrackerPeriod('monthly')}>Monthly</button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 10, marginTop: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Date<input type="date" value={tracker.dateKey} onChange={(e) => setTracker((p) => ({ ...p, dateKey: e.target.value }))} style={{ background: '#0b1220', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }} /></label>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Calls<input type="number" min="0" value={tracker.calls} onChange={(e) => setTracker((p) => ({ ...p, calls: e.target.value }))} style={{ background: '#0b1220', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }} /></label>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Bookings (Auto)<input type="number" min="0" value={periodTotals.bookings} disabled readOnly style={{ background: '#111827', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }} /></label>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Sponsorship Submitted (Auto)<input type="number" min="0" value={periodTotals.sponsorshipApps} disabled readOnly style={{ background: '#111827', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }} /></label>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Sponsorship Approved (Auto)<input type="number" min="0" value={periodTotals.sponsorshipApproved} disabled readOnly style={{ background: '#111827', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }} /></label>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>FNG Submitted (Auto)<input type="number" min="0" value={periodTotals.fngSubmittedApps} disabled readOnly style={{ background: '#111827', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }} /></label>
                  </div>
                  <button type="button" className="publicPrimaryBtn" onClick={saveTracker} disabled={savingTracker} style={{ marginTop: 10 }}>{savingTracker ? 'Saving...' : 'Save Daily Calls'}</button>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                  <strong style={{ color: '#fff' }}>{trackerPeriod === 'daily' ? 'Daily Totals' : trackerPeriod === 'weekly' ? 'Weekly Totals' : 'Monthly Totals'}</strong>
                  <p className="muted" style={{ marginBottom: 8 }}>
                    Calls: {periodTotals.calls} • Bookings: {periodTotals.bookings}
                  </p>
                  <p className="muted" style={{ marginTop: 0 }}>
                    Sponsorship Submitted: {periodTotals.sponsorshipApps} • Sponsorship Approved: {periodTotals.sponsorshipApproved} • FNG Submitted: {periodTotals.fngSubmittedApps} • App Total: {periodTotals.appsTotal}
                  </p>
                  <small className="muted">Entries Loaded: {dailyRows.length}</small>
                </div>
              </div>
            ) : null}

            {tab === 'rewards' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 12, background: '#071022' }}>
                  <strong style={{ color: '#fff' }}>Inner Circle Activity Rewards</strong>
                  <p style={{ color: '#cbd5e1', margin: '8px 0 0' }}>This is your live point system and leaderboard inside the Production Hub back office.</p>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, overflow: 'hidden', background: '#020617' }}>
                  <iframe
                    title="Inner Circle Activity Rewards"
                    src="/inner-circle-hub-rewards"
                    style={{ width: '100%', minHeight: '1200px', border: 0, background: '#020617' }}
                  />
                </div>
              </div>
            ) : null}

            {tab === 'links' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 12, background: '#071022' }}>
                  <strong style={{ color: '#fff' }}>Quick Access</strong>
                  <p style={{ color: '#cbd5e1', margin: '8px 0 0' }}>Use the links below to copy and share your key resources.</p>
                </div>

                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617', display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 8 }}>
                  <strong style={{ color: '#fff' }}>Personal Sponsorship Link</strong>
                  <img src={qrUrl(sponsorshipLink)} alt="Sponsorship QR" width={118} height={118} style={{ borderRadius: 8, border: '1px solid #334155', background: '#fff' }} />
                  <button type="button" className="ghost" onClick={() => copyLink(sponsorshipLink, 'sponsor')}>
                    {copiedKey === 'sponsor' ? 'Copied' : 'Copy Link'}
                  </button>
                </div>

                {contractLinks.map((item) => (
                  <div key={item.name} style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617', display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 8 }}>
                    <strong style={{ color: '#fff' }}>{item.name}</strong>
                    <img src={qrUrl(item.url)} alt={`${item.name} QR`} width={118} height={118} style={{ borderRadius: 8, border: '1px solid #334155', background: '#fff' }} />
                    <button type="button" className="ghost" onClick={() => copyLink(item.url, item.name)}>
                      {copiedKey === item.name ? 'Copied' : 'Copy Link'}
                    </button>
                  </div>
                ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
