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
    { key: 'dashboard', label: 'The Lounge' },
    { key: 'faststart', label: 'Fast Start' },
    { key: 'scripts', label: 'Script Vault' },
    { key: 'execution', label: 'Daily Execution' },
    { key: 'vault', label: 'Resource Vault' },
    { key: 'tracker', label: 'KPI Tracker' },
    { key: 'production', label: 'My Production' },
    { key: 'rewards', label: 'VIP Rewards' },
    { key: 'links', label: 'My VIP Links' }
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
  const [leaderboard, setLeaderboard] = useState({ month: '', rows: [] });

  const [tab, setTab] = useState('dashboard');
  const [dailyRows, setDailyRows] = useState([]);
  const [trackerPeriod, setTrackerPeriod] = useState('daily');
  const [activityType, setActivityType] = useState('all');
  const [activityRows, setActivityRows] = useState([]);
  const [policyRows, setPolicyRows] = useState([]);
  const [productionFilter, setProductionFilter] = useState('all');
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

  const vipTier = useMemo(() => {
    const closes = toNum(kpi?.closesThisMonth);
    const bookings = toNum(kpi?.bookingsThisMonth);
    if (closes >= 5) return 'Chairman Elite';
    if (closes >= 2 || bookings >= 8) return 'Momentum Pro';
    return 'Founding Member';
  }, [kpi?.closesThisMonth, kpi?.bookingsThisMonth]);

  const monthlyTopPerformers = useMemo(() => {
    const rows = Array.isArray(leaderboard?.rows) ? leaderboard.rows : [];
    const scoredRaw = rows
      .filter((r) => Boolean(r?.inInnerCircle) && clean(r?.applicantName))
      .map((r) => {
        const leads = toNum(r?.kpi?.leadsReceived);
        const bookings = toNum(r?.kpi?.bookingsThisMonth);
        const submitted = toNum(r?.trackerTotals?.sponsorshipApps);
        const approved = toNum(r?.kpi?.sponsorshipApprovedThisMonth);
        const fng = toNum(r?.trackerTotals?.fngSubmittedApps);
        const completed = toNum(r?.kpi?.closesThisMonth);
        return {
          name: clean(r?.applicantName),
          leads,
          bookings,
          submitted,
          approved,
          fng,
          completed
        };
      })
      .filter((r) => (r.leads + r.bookings + r.submitted + r.approved + r.fng + r.completed) > 0);

    const deduped = new Map();
    for (const row of scoredRaw) {
      const key = clean(row?.name).toLowerCase();
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, { ...row });
        continue;
      }
      deduped.set(key, {
        ...existing,
        leads: Math.max(existing.leads, row.leads),
        bookings: Math.max(existing.bookings, row.bookings),
        submitted: Math.max(existing.submitted, row.submitted),
        approved: Math.max(existing.approved, row.approved),
        fng: Math.max(existing.fng, row.fng),
        completed: Math.max(existing.completed, row.completed)
      });
    }

    const scored = Array.from(deduped.values())
      .map((r) => {
        const points = (r.submitted * 1) + (r.bookings * 3) + (r.fng * 10) + (r.completed * 500);
        return {
          ...r,
          points,
          dollars: points
        };
      })
      .sort((a, b) => b.points - a.points || b.completed - a.completed || b.fng - a.fng || b.bookings - a.bookings || a.name.localeCompare(b.name));

    return scored.slice(0, 5);
  }, [leaderboard]);

  const topThreePerformers = monthlyTopPerformers.slice(0, 3);

  const filteredActivityRows = useMemo(() => {
    if (activityType === 'all') return activityRows;
    if (activityType === 'decision') return (activityRows || []).filter((r) => clean(r?.type) === 'decision');
    return (activityRows || []).filter((r) => clean(r?.type) === activityType);
  }, [activityRows, activityType]);

  const personalProduction = useMemo(() => {
    const myName = clean(member?.applicantName || '').toLowerCase();

    const mine = (policyRows || []).filter((r) => {
      const writer = clean(r?.policyWriterName || r?.assignedInnerCircleAgent || '').toLowerCase();
      const submittedBy = clean(r?.submittedBy || '').toLowerCase();
      const owner = writer || submittedBy;
      return myName && owner === myName;
    });

    const byType = {
      sponsorship: 0,
      bonus: 0,
      innerCircle: 0,
      regular: 0,
      juvenile: 0
    };

    let totalPoints = 0;
    let advanceTotal = 0;

    for (const row of mine) {
      const t = clean(row?.policyType || row?.appType || '').toLowerCase();
      if (t.includes('sponsorship')) byType.sponsorship += 1;
      else if (t.includes('bonus')) byType.bonus += 1;
      else if (t.includes('inner circle')) byType.innerCircle += 1;
      else if (t.includes('regular')) byType.regular += 1;
      else if (t.includes('juvenile')) byType.juvenile += 1;
      totalPoints += Number(row?.pointsEarned || 0) || 0;
      advanceTotal += Number(row?.advancePayout || row?.payoutAmount || 0) || 0;
    }

    const sorted = [...mine].sort((a, b) => new Date(b?.submittedAt || 0).getTime() - new Date(a?.submittedAt || 0).getTime());

    return {
      rows: sorted,
      byType,
      totalPoints,
      advanceTotal
    };
  }, [policyRows, member?.applicantName]);

  const filteredProductionRows = useMemo(() => {
    if (productionFilter === 'all') return personalProduction.rows;
    return (personalProduction.rows || []).filter((row) => {
      const t = clean(row?.policyType || row?.appType || '').toLowerCase();
      return t.includes(productionFilter);
    });
  }, [personalProduction.rows, productionFilter]);

  const productionStats = useMemo(() => {
    const rows = filteredProductionRows || [];
    const approved = rows.filter((r) => clean(r?.status).toLowerCase() === 'approved').length;
    const approvalRate = rows.length ? Math.round((approved / rows.length) * 100) : 0;

    const totals = rows.reduce((acc, row) => ({
      points: acc.points + (Number(row?.pointsEarned || 0) || 0),
      advance: acc.advance + (Number(row?.advancePayout || row?.payoutAmount || 0) || 0),
      remaining: acc.remaining + (Number(row?.remainingBalance || 0) || 0)
    }), { points: 0, advance: 0, remaining: 0 });

    return { ...totals, count: rows.length, approved, approvalRate };
  }, [filteredProductionRows]);

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

  const siteBase = useMemo(() => {
    const envBase = clean(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '');
    if (envBase) return envBase.replace(/\/$/, '');
    if (typeof window !== 'undefined' && window?.location?.origin) return window.location.origin.replace(/\/$/, '');
    return 'https://innercirclelink.com';
  }, []);

  function toAbsoluteLink(value = '') {
    const v = clean(value);
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    return `${siteBase}${v.startsWith('/') ? '' : '/'}${v}`;
  }

  const sponsorshipLink = useMemo(() => {
    const base = toAbsoluteLink(process.env.NEXT_PUBLIC_SPONSORSHIP_LINK_BASE || '/sponsorship-signup');
    const ref = encodeURIComponent(member?.email || member?.id || 'member');
    return base.includes('?') ? `${base}&ref=${ref}` : `${base}?ref=${ref}`;
  }, [member?.email, member?.id, siteBase, toAbsoluteLink]);

  const onboardingPlaybookUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_INNER_CIRCLE_PLAYBOOK_URL || '/docs/inner-circle/legacy-link-inner-circle-onboarding-playbook-v3.pdf';
  }, []);

  const onboardingLibraryLinks = useMemo(() => {
    return [
      {
        name: 'Inner Circle Playbook (VIP)',
        url: process.env.NEXT_PUBLIC_INNER_CIRCLE_PLAYBOOK_URL || '/docs/inner-circle/legacy-link-inner-circle-onboarding-playbook-v3.pdf'
      },
      {
        name: 'Licensed Agent Playbook',
        url: '/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf'
      },
      {
        name: 'Unlicensed Agent Playbook',
        url: '/docs/onboarding/legacy-link-unlicensed-onboarding-playbook.pdf'
      }
    ].map((item) => ({ ...item, url: toAbsoluteLink(item.url) }));
  }, [toAbsoluteLink]);

  const contractLinks = useMemo(() => {
    return [
      {
        name: 'Inner Circle Contract (IUL Agreement)',
        url: toAbsoluteLink(process.env.NEXT_PUBLIC_DOCUSIGN_IUL_ICA_URL || '/iul-agreement')
      },
      {
        name: 'Contract Agreement Page',
        url: toAbsoluteLink('/contract-agreement')
      }
    ];
  }, [siteBase, toAbsoluteLink]);

  useEffect(() => {
    if (!member?.email && !member?.applicantName) return;
    let canceled = false;

    async function loadAll() {
      try {
        const kpiUrl = `/api/inner-circle-hub-kpi?name=${encodeURIComponent(member?.applicantName || '')}&email=${encodeURIComponent(member?.email || '')}`;
        const dailyUrl = `/api/inner-circle-hub-daily?memberId=${encodeURIComponent(member?.id || '')}&email=${encodeURIComponent(member?.email || '')}`;

        const activityUrl = `/api/inner-circle-hub-activity?name=${encodeURIComponent(member?.applicantName || '')}&email=${encodeURIComponent(member?.email || '')}`;

        const [kpiRes, dailyRes, scriptsRes, vaultRes, activityRes, progressRes, policiesRes] = await Promise.all([
          fetch(kpiUrl, { cache: 'no-store' }),
          fetch(dailyUrl, { cache: 'no-store' }),
          fetch('/api/inner-circle-hub-scripts', { cache: 'no-store' }),
          fetch('/api/inner-circle-hub-vault', { cache: 'no-store' }),
          fetch(activityUrl, { cache: 'no-store' }),
          fetch('/api/inner-circle-hub-progress', { cache: 'no-store' }),
          fetch('/api/policy-submissions', { cache: 'no-store' })
        ]);

        const kpiData = await kpiRes.json().catch(() => ({}));
        const dailyData = await dailyRes.json().catch(() => ({}));
        const scriptsData = await scriptsRes.json().catch(() => ({}));
        const vaultData = await vaultRes.json().catch(() => ({}));
        const activityData = await activityRes.json().catch(() => ({}));
        const progressData = await progressRes.json().catch(() => ({}));
        const policiesData = await policiesRes.json().catch(() => ({}));

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
        if (!canceled && progressRes.ok && progressData?.ok) {
          setLeaderboard({ month: clean(progressData?.month), rows: Array.isArray(progressData?.rows) ? progressData.rows : [] });
        }
        if (!canceled && policiesRes.ok && policiesData?.ok) {
          setPolicyRows(Array.isArray(policiesData?.rows) ? policiesData.rows : []);
        }
      } catch {
        if (!canceled) {
          setKpi(null);
          setDailyRows([]);
          setScripts([]);
          setVault({ content: [], calls: [], onboarding: [] });
          setLeaderboard({ month: '', rows: [] });
          setPolicyRows([]);
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
      <main className="publicPage" style={{ minHeight: '100vh', background: 'radial-gradient(circle at top,#17120a 0%,#0b1020 42%, #05070f 100%)', color: '#e5e7eb' }}>
        <div className="panel" style={{ maxWidth: 460, border: '1px solid #3a2f1a', background: 'linear-gradient(180deg,#111827 0%, #0b1020 100%)', boxShadow: '0 20px 80px rgba(0,0,0,0.45)' }}>
          <p style={{ margin: 0, color: '#c8a96b', fontWeight: 700, letterSpacing: '.06em' }}>THE LEGACY LINK</p>
          <h2 style={{ marginTop: 8, marginBottom: 6, color: '#fff' }}>Inner Circle — VIP Lounge</h2>
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
    <main className="publicPage" style={{ minHeight: '100vh', background: 'radial-gradient(circle at top,#17120a 0%,#0b1020 42%, #05070f 100%)', color: '#e5e7eb' }}>
      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #3a2f1a', background: 'linear-gradient(180deg,#0f172a 0%, #0b1020 100%)', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>
        <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, color: '#c8a96b', fontWeight: 700, letterSpacing: '.06em' }}>THE LEGACY LINK</p>
            <h2 style={{ marginTop: 6, color: '#fff' }}>Inner Circle VIP Lounge</h2>
            <p className="muted" style={{ marginTop: -8 }}>Welcome back, {firstNameFromMember(member)} • Premium Member Access</p>
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
                <div style={{ border: '1px solid #5f4a23', borderRadius: 14, padding: 16, background: 'linear-gradient(135deg,#1f2937 0%,#0b1020 55%,#111827 100%)' }}>
                  <small style={{ color: '#c8a96b', letterSpacing: '.06em', fontWeight: 700 }}>WELCOME TO THE INNER CIRCLE</small>
                  <h3 style={{ color: '#fff', margin: '6px 0 8px' }}>Private access. Elite strategy. Real execution.</h3>
                  <p style={{ color: '#d1d5db', margin: 0 }}>Your next move is simple: execute today’s priorities, stay coachable, and stack momentum.</p>
                </div>

                <div style={{ border: '1px solid #3a2f1a', borderRadius: 12, padding: 14, background: '#0b1020' }}>
                  <strong style={{ color: '#fff', fontSize: 16 }}>Today’s Priority</strong>
                  <div style={{ display: 'grid', gap: 10, marginTop: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
                    <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' }}><small style={{ color: '#c8a96b', fontWeight: 700 }}>WATCH THIS</small><div style={{ color: '#e5e7eb', marginTop: 6 }}>Review one script and run a live rep today.</div></div>
                    <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' }}><small style={{ color: '#c8a96b', fontWeight: 700 }}>DO THIS</small><div style={{ color: '#e5e7eb', marginTop: 6 }}>Book at least one conversation before end of day.</div></div>
                    <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' }}><small style={{ color: '#c8a96b', fontWeight: 700 }}>POST THIS</small><div style={{ color: '#e5e7eb', marginTop: 6 }}>Publish one authority post to generate new leads.</div></div>
                  </div>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#020617' }}>
                  <strong style={{ color: '#fff', fontSize: 16 }}>KPI Dashboard (This Month)</strong>
                  <div style={{ display: 'grid', gap: 10, marginTop: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
                    <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Leads</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{kpi?.leadsReceived ?? 0}</div></div>
                    <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Bookings</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{kpi?.bookingsThisMonth ?? 0}</div></div>
                    <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Closes</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{kpi?.closesThisMonth ?? 0}</div><small className="muted">Close Rate: {kpi?.closeRate ?? 0}%</small></div>
                    <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Potential</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>${kpi?.potentialEarned ?? kpi?.grossEarned ?? 0}</div></div>
                  </div>
                </div>

                <div style={{ border: '1px solid #3a2f1a', borderRadius: 12, padding: 14, background: '#0f172a' }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#fff', fontSize: 16 }}>Member Status</strong>
                    <span className="pill" style={{ background: '#3a2f1a', color: '#f3e8d1', border: '1px solid #5f4a23' }}>{vipTier}</span>
                  </div>
                  <p style={{ color: '#d1d5db', margin: '8px 0 10px' }}>You’re in the room. Keep stacking daily actions and your badge climbs automatically with performance.</p>
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
                    <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' }}><small className="muted">Current Tier</small><div style={{ color: '#fff', fontWeight: 800 }}>{vipTier}</div></div>
                    <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' }}><small className="muted">Checklist Progress</small><div style={{ color: '#fff', fontWeight: 800 }}>{checklistDoneCount}/5 today</div></div>
                    <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' }}><small className="muted">Tracker Days</small><div style={{ color: '#fff', fontWeight: 800 }}>{dailyRows.length}</div></div>
                  </div>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#061126' }}>
                  <strong style={{ color: '#fff', fontSize: 16 }}>Onboarding Playbooks Library</strong>
                  <p style={{ color: '#cbd5e1', marginTop: 8, marginBottom: 10 }}>Your back office has all onboarding PDFs in one place.</p>
                  <a
                    href={onboardingPlaybookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="publicPrimaryBtn"
                    style={{ display: 'inline-block', textDecoration: 'none', marginBottom: 10 }}
                  >
                    Open VIP Playbook
                  </a>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {onboardingLibraryLinks.map((link) => (
                      <a
                        key={link.name}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ghost"
                        style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'left' }}
                      >
                        {link.name}
                      </a>
                    ))}
                  </div>
                </div>

                <div style={{ border: '1px solid #5f4a23', borderRadius: 12, padding: 14, background: '#111827' }}>
                  <strong style={{ color: '#fff', fontSize: 16 }}>Concierge Desk</strong>
                  <p style={{ color: '#d1d5db', margin: '8px 0 0' }}>Need support? Message your advisor or coach for your next best move. Premium members move faster with quick feedback loops.</p>
                </div>

                <div style={{ border: '1px solid #7a5d25', borderRadius: 12, padding: 14, background: 'linear-gradient(135deg,#2b2110 0%,#111827 55%,#1f2937 100%)' }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#fff' }}>Top 3 Performers of the Month</strong>
                    <span className="pill" style={{ background: '#c8a96b', color: '#0b1020', border: '1px solid #e6d1a6', fontWeight: 800 }}>Monthly Spotlight</span>
                  </div>
                  {topThreePerformers.length ? (
                    <div style={{ display: 'grid', gap: 8, marginTop: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))' }}>
                      {topThreePerformers.map((row, idx) => (
                        <div key={`top3_${idx}_${row?.name || 'member'}`} style={{ border: '1px solid #5f4a23', borderRadius: 10, padding: 10, background: '#0f172a' }}>
                          <div style={{ color: '#c8a96b', fontWeight: 800 }}>#{idx + 1}</div>
                          <div style={{ color: '#f8fafc', fontWeight: 800, marginTop: 2 }}>{row?.name || 'Member'}</div>
                          <div style={{ marginTop: 4, color: '#f3e8d1', fontWeight: 700 }}>{row.points} points • ${row.dollars}</div>
                          <div style={{ color: '#d1d5db', fontSize: 12, marginTop: 6 }}>Sponsorship Submitted {row.submitted} • Booked {row.bookings} • F&G Submitted {row.fng} • F&G Approved {row.completed} • Sponsorship Approved {row.approved}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <small className="muted">No top performers yet this month.</small>
                  )}
                </div>

                <div style={{ border: '1px solid #3a2f1a', borderRadius: 12, padding: 12, background: '#0f172a' }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#fff' }}>Monthly Leaderboard</strong>
                    <small className="muted">Top 5 Inner Circle • {leaderboard?.month || 'Current Month'}</small>
                  </div>
                  <small className="muted">Scoring: Sponsorship Submitted (1) • Booked (3) • F&G Submitted (10) • F&G Approved (500). Sponsorship Approved and Leads are tracked but not scored.</small>
                  <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                    {monthlyTopPerformers.map((row, idx) => (
                      <div key={`leader_${idx}_${row?.name || 'unknown'}`} style={{ border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', background: '#111827', color: '#e5e7eb' }}>
                        <span style={{ color: '#c8a96b', fontWeight: 800, marginRight: 8 }}>#{idx + 1}</span>
                        <strong style={{ color: '#f8fafc', fontWeight: 800 }}>{row?.name || 'Member'}</strong>
                        <span style={{ color: '#e2e8f0', fontWeight: 700 }}> • {row.points} pts • ${row.dollars}</span>
                        <div style={{ color: '#cbd5e1', fontSize: 12, marginTop: 4 }}>Sponsorship Submitted {row.submitted} • Booked {row.bookings} • F&G Submitted {row.fng} • F&G Approved {row.completed} • Sponsorship Approved {row.approved}</div>
                      </div>
                    ))}
                    {!monthlyTopPerformers.length ? <small className="muted">No qualifying performance yet this month.</small> : null}
                  </div>
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
                            <a href={fngHref} className="ghost" style={{ textDecoration: 'none', marginLeft: 'auto', fontSize: 12 }}>Submit App</a>
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
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ border: '1px solid #5f4a23', borderRadius: 12, padding: 16, background: '#111827' }}>
                  <strong style={{ color: '#fff', fontSize: 18 }}>VIP First 7 Days</strong>
                  <p style={{ color: '#e5e7eb', marginTop: 8, marginBottom: 10, fontSize: 15 }}>Your premium onboarding sprint. Keep this simple and complete one block per day.</p>
                  <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#f1f5f9', display: 'grid', gap: 10, fontWeight: 600, lineHeight: 1.5, fontSize: 15 }}>
                    <li><span style={{ color: '#c8a96b' }}>Day 1:</span> Login, set environment, review scripts, save tracker baseline</li>
                    <li><span style={{ color: '#c8a96b' }}>Day 2:</span> Start 25+ outbound conversations</li>
                    <li><span style={{ color: '#c8a96b' }}>Day 3:</span> Book your first conversation and tighten follow-up</li>
                    <li><span style={{ color: '#c8a96b' }}>Day 4:</span> Run discovery flow + objection handling reps</li>
                    <li><span style={{ color: '#c8a96b' }}>Day 5:</span> Push for sponsorship submit and FNG action</li>
                    <li><span style={{ color: '#c8a96b' }}>Day 6:</span> Fill pipeline gaps and post authority content</li>
                    <li><span style={{ color: '#c8a96b' }}>Day 7:</span> Review KPI, plan week two, set stretch target</li>
                  </ul>
                </div>

                <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 16, background: '#071022' }}>
                  <strong style={{ color: '#fff', fontSize: 18 }}>Days 8–14 Fast Track</strong>
                  <p style={{ color: '#cbd5e1', marginTop: 8, marginBottom: 10, fontSize: 15 }}>Move in sequence. Execute daily. Keep momentum high.</p>
                  <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#f1f5f9', display: 'grid', gap: 10, fontWeight: 600, lineHeight: 1.5, fontSize: 15 }}>
                    <li><span style={{ color: '#93c5fd' }}>Day 8–10:</span> Scale outbound and stack booked calls</li>
                    <li><span style={{ color: '#93c5fd' }}>Day 11–12:</span> Submit additional apps and recover warm leads</li>
                    <li><span style={{ color: '#93c5fd' }}>Day 13–14:</span> Tighten close rate, lock in consistency</li>
                  </ul>
                </div>
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

            {tab === 'production' ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ border: '1px solid #5f4a23', borderRadius: 12, padding: 14, background: 'linear-gradient(135deg,#1f2937 0%,#0b1020 55%,#111827 100%)' }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <strong style={{ color: '#fff', fontSize: 17 }}>My Production Back Office</strong>
                    <small className="muted">Private view • only your personal production</small>
                  </div>
                  <p style={{ color: '#cbd5e1', margin: '8px 0 0' }}>Filter by policy type to quickly see flat-rate vs commission-based production.</p>
                </div>

                <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className={productionFilter === 'all' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setProductionFilter('all')}>All Policies</button>
                  <button type="button" className={productionFilter === 'sponsorship' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setProductionFilter('sponsorship')}>Sponsorship</button>
                  <button type="button" className={productionFilter === 'bonus' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setProductionFilter('bonus')}>Bonus</button>
                  <button type="button" className={productionFilter === 'regular' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setProductionFilter('regular')}>Regular</button>
                  <button type="button" className={productionFilter === 'inner circle' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setProductionFilter('inner circle')}>Inner Circle</button>
                  <button type="button" className={productionFilter === 'juvenile' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setProductionFilter('juvenile')}>Juvenile</button>
                </div>

                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
                  <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 12, background: '#111827' }}><small className="muted">Total Policies</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{productionStats.count}</div></div>
                  <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 12, background: '#111827' }}><small className="muted">Points Earned</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{productionStats.points.toFixed(2)}</div></div>
                  <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 12, background: '#111827' }}><small className="muted">Advance Payout</small><div style={{ color: '#86efac', fontWeight: 800, fontSize: 24 }}>${productionStats.advance.toFixed(2)}</div></div>
                  <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 12, background: '#111827' }}><small className="muted">Deferred Balance</small><div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 24 }}>${productionStats.remaining.toFixed(2)}</div></div>
                  <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 12, background: '#111827' }}><small className="muted">Approval Rate</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{productionStats.approvalRate}%</div></div>
                </div>

                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1.2fr 1fr' }}>
                  <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                    <strong style={{ color: '#fff' }}>Policy Type Breakdown</strong>
                    <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                      <div style={{ border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', background: '#0b1220', color: '#e2e8f0' }}>Sponsorship Policies: <strong style={{ color: '#f8fafc' }}>{personalProduction.byType.sponsorship}</strong> <small className="muted">(flat 500 pts to referrer)</small></div>
                      <div style={{ border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', background: '#0b1220', color: '#e2e8f0' }}>Bonus Policies: <strong style={{ color: '#f8fafc' }}>{personalProduction.byType.bonus}</strong> <small className="muted">(flat 500 pts licensed only)</small></div>
                      <div style={{ border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', background: '#0b1220', color: '#e2e8f0' }}>Inner Circle Policies: <strong style={{ color: '#f8fafc' }}>{personalProduction.byType.innerCircle}</strong> <small className="muted">(flat 1,200 pts / $1,200)</small></div>
                      <div style={{ border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', background: '#0b1220', color: '#e2e8f0' }}>Regular Policies: <strong style={{ color: '#f8fafc' }}>{personalProduction.byType.regular}</strong> <small className="muted">(70% commission model)</small></div>
                      <div style={{ border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', background: '#0b1220', color: '#e2e8f0' }}>Juvenile Policies: <strong style={{ color: '#f8fafc' }}>{personalProduction.byType.juvenile}</strong> <small className="muted">(50% commission model)</small></div>
                    </div>
                  </div>

                  <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                    <strong style={{ color: '#fff' }}>Payout Structure Snapshot</strong>
                    <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                      <div style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 8, padding: 10 }}>
                        <small className="muted">Advance (75%)</small>
                        <div style={{ height: 10, background: '#1f2937', borderRadius: 8, marginTop: 6 }}><div style={{ width: '75%', height: '100%', background: 'linear-gradient(90deg,#22c55e,#16a34a)', borderRadius: 8 }} /></div>
                      </div>
                      <div style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 8, padding: 10 }}>
                        <small className="muted">Deferred (Months 10/11/12)</small>
                        <div style={{ height: 10, background: '#1f2937', borderRadius: 8, marginTop: 6 }}><div style={{ width: '25%', height: '100%', background: 'linear-gradient(90deg,#c8a96b,#a78647)', borderRadius: 8 }} /></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                  <strong style={{ color: '#fff' }}>Policy Activity Table</strong>
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {filteredProductionRows.slice(0, 30).map((row) => (
                      <div key={row?.id} style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#0b1220' }}>
                        <div style={{ color: '#f8fafc', fontWeight: 700 }}>
                          {row?.applicantName || 'Applicant'} • {row?.policyType || row?.appType || 'Policy'}
                          {clean(row?.policyType || row?.appType || '').toLowerCase().includes('inner circle') ? (
                            <span className="pill" style={{ marginLeft: 8, background: '#3a2f1a', color: '#f3e8d1', border: '1px solid #c8a96b' }}>Inner Circle</span>
                          ) : null}
                        </div>
                        <div style={{ color: '#cbd5e1', fontSize: 12, marginTop: 4 }}>
                          Commission: {Math.round((Number(row?.commissionRate || 0) || 0) * 100)}% • Points: {Number(row?.pointsEarned || 0).toFixed(2)} • Advance: ${Number(row?.advancePayout || row?.payoutAmount || 0).toFixed(2)} • Status: {row?.status || 'Submitted'}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                          Remaining: ${Number(row?.remainingBalance || 0).toFixed(2)} • M10: ${Number(row?.month10Payout || 0).toFixed(2)} • M11: ${Number(row?.month11Payout || 0).toFixed(2)} • M12: ${Number(row?.month12Payout || 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                    {!filteredProductionRows.length ? <small className="muted">No personal production records for this filter yet.</small> : null}
                  </div>
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
      <style jsx global>{`
        .publicPrimaryBtn {
          background: linear-gradient(135deg, #c8a96b 0%, #a78647 100%) !important;
          color: #0b1020 !important;
          border: 1px solid #d6bd8d !important;
          font-weight: 700;
        }
        .publicPrimaryBtn:hover {
          filter: brightness(1.05);
        }
        .ghost {
          border-color: #5f4a23 !important;
          color: #f3e8d1 !important;
          background: rgba(17, 24, 39, 0.55) !important;
        }
      `}</style>
    </main>
  );
}
