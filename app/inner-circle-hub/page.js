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

  const [kpi, setKpi] = useState(null);
  const [scripts, setScripts] = useState([]);
  const [scriptFilter, setScriptFilter] = useState('all');
  const [vault, setVault] = useState({ content: [], calls: [], onboarding: [] });

  const [tab, setTab] = useState('dashboard');
  const [dailyRows, setDailyRows] = useState([]);
  const [dailyTotals, setDailyTotals] = useState({ calls: 0, texts: 0, followUps: 0, bookings: 0, sponsorshipApps: 0, fngSubmittedApps: 0, appsTotal: 0 });
  const [tracker, setTracker] = useState({
    dateKey: todayDateKey(),
    calls: 0,
    texts: 0,
    followUps: 0,
    bookings: 0,
    sponsorshipApps: 0,
    fngSubmittedApps: 0,
    notes: '',
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

  const sponsorshipLink = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_SPONSORSHIP_LINK_BASE || '/sponsorship-signup';
    const ref = encodeURIComponent(member?.email || member?.id || 'member');
    return base.includes('?') ? `${base}&ref=${ref}` : `${base}?ref=${ref}`;
  }, [member?.email, member?.id]);

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

        const [kpiRes, dailyRes, scriptsRes, vaultRes] = await Promise.all([
          fetch(kpiUrl, { cache: 'no-store' }),
          fetch(dailyUrl, { cache: 'no-store' }),
          fetch('/api/inner-circle-hub-scripts', { cache: 'no-store' }),
          fetch('/api/inner-circle-hub-vault', { cache: 'no-store' })
        ]);

        const kpiData = await kpiRes.json().catch(() => ({}));
        const dailyData = await dailyRes.json().catch(() => ({}));
        const scriptsData = await scriptsRes.json().catch(() => ({}));
        const vaultData = await vaultRes.json().catch(() => ({}));

        if (!canceled && kpiRes.ok && kpiData?.ok) setKpi(kpiData.kpi || null);
        if (!canceled && dailyRes.ok && dailyData?.ok) {
          const rows = Array.isArray(dailyData.rows) ? dailyData.rows : [];
          setDailyRows(rows);
          setDailyTotals(dailyData.totals || { calls: 0, texts: 0, followUps: 0, bookings: 0, sponsorshipApps: 0, fngSubmittedApps: 0, appsTotal: 0 });
          const today = rows.find((r) => clean(r?.dateKey) === todayDateKey());
          if (today) {
            setTracker((p) => ({
              ...p,
              dateKey: today.dateKey || p.dateKey,
              calls: today.calls ?? p.calls,
              texts: today.texts ?? p.texts,
              followUps: today.followUps ?? p.followUps,
              bookings: today.bookings ?? p.bookings,
              sponsorshipApps: today.sponsorshipApps ?? p.sponsorshipApps,
              fngSubmittedApps: today.fngSubmittedApps ?? p.fngSubmittedApps,
              notes: today.notes || p.notes,
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
          texts: toNum(tracker.texts),
          followUps: toNum(tracker.followUps),
          bookings: toNum(tracker.bookings),
          sponsorshipApps: toNum(tracker.sponsorshipApps),
          fngSubmittedApps: toNum(tracker.fngSubmittedApps),
          notes: tracker.notes || '',
          checklist: tracker.checklist || {}
        })
      });

      const dailyUrl = `/api/inner-circle-hub-daily?memberId=${encodeURIComponent(member?.id || '')}&email=${encodeURIComponent(member?.email || '')}`;
      const res = await fetch(dailyUrl, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setDailyRows(Array.isArray(data.rows) ? data.rows : []);
        setDailyTotals(data.totals || { calls: 0, texts: 0, followUps: 0, bookings: 0, sponsorshipApps: 0, fngSubmittedApps: 0, appsTotal: 0 });
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
          <form onSubmit={login} className="settingsGrid" style={{ rowGap: 12 }}>
            <label style={{ color: '#e2e8f0' }}>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} /></label>
            <label style={{ color: '#e2e8f0' }}>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} /></label>
            <button type="submit" className="publicPrimaryBtn" disabled={loading}>{loading ? 'Signing in...' : 'Enter Hub'}</button>
            {error ? <p className="red" style={{ marginTop: 4 }}>{error}</p> : null}
          </form>
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
              <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#020617' }}>
                <strong style={{ color: '#fff', fontSize: 16 }}>KPI Dashboard (This Month)</strong>
                <div style={{ display: 'grid', gap: 10, marginTop: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
                  <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Leads</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{kpi?.leadsReceived ?? 0}</div></div>
                  <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Bookings</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{kpi?.bookingsThisMonth ?? 0}</div></div>
                  <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Closes</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{kpi?.closesThisMonth ?? 0}</div><small className="muted">Close Rate: {kpi?.closeRate ?? 0}%</small></div>
                  <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Gross</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>${kpi?.grossEarned ?? 0}</div></div>
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
                  <strong style={{ color: '#fff', fontSize: 17 }}>Daily Production Tracker</strong>
                  <div style={{ display: 'grid', gap: 10, marginTop: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Date<input type="date" value={tracker.dateKey} onChange={(e) => setTracker((p) => ({ ...p, dateKey: e.target.value }))} /></label>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Calls<input type="number" min="0" value={tracker.calls} onChange={(e) => setTracker((p) => ({ ...p, calls: e.target.value }))} /></label>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Texts<input type="number" min="0" value={tracker.texts} onChange={(e) => setTracker((p) => ({ ...p, texts: e.target.value }))} /></label>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Follow-Ups<input type="number" min="0" value={tracker.followUps} onChange={(e) => setTracker((p) => ({ ...p, followUps: e.target.value }))} /></label>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Bookings<input type="number" min="0" value={tracker.bookings} onChange={(e) => setTracker((p) => ({ ...p, bookings: e.target.value }))} /></label>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Sponsorship Apps<input type="number" min="0" value={tracker.sponsorshipApps} onChange={(e) => setTracker((p) => ({ ...p, sponsorshipApps: e.target.value }))} /></label>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>FNG Submitted Apps<input type="number" min="0" value={tracker.fngSubmittedApps} onChange={(e) => setTracker((p) => ({ ...p, fngSubmittedApps: e.target.value }))} /></label>
                  </div>
                  <label style={{ marginTop: 10, display: 'block', color: '#dbeafe', fontWeight: 700, fontSize: 15 }}>Notes<textarea rows={2} value={tracker.notes} onChange={(e) => setTracker((p) => ({ ...p, notes: e.target.value }))} /></label>
                  <button type="button" className="publicPrimaryBtn" onClick={saveTracker} disabled={savingTracker}>{savingTracker ? 'Saving...' : 'Save Daily Metrics'}</button>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                  <strong style={{ color: '#fff' }}>This Month Totals</strong>
                  <p className="muted" style={{ marginBottom: 8 }}>
                    Calls: {dailyTotals.calls} • Texts: {dailyTotals.texts} • Follow-Ups: {dailyTotals.followUps} • Bookings: {dailyTotals.bookings}
                  </p>
                  <p className="muted" style={{ marginTop: 0 }}>
                    Sponsorship Apps: {dailyTotals.sponsorshipApps} • FNG Submitted Apps: {dailyTotals.fngSubmittedApps} • App Total: {dailyTotals.appsTotal}
                  </p>
                  <small className="muted">Recent Entries: {dailyRows.length}</small>
                </div>
              </div>
            ) : null}

            {tab === 'links' ? (
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
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
