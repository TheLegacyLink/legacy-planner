'use client';

import { useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'inner_circle_hub_member_v1';

function readSession() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

function firstNameFromMember(member = {}) {
  const full = String(member?.applicantName || member?.email || '').trim();
  return full.split(/\s+/)[0] || 'Member';
}

function onboardingState(member = {}) {
  const contract = Boolean(member?.contractSignedAt);
  const payment = Boolean(member?.paymentReceivedAt);
  const password = Boolean(member?.hasPassword);
  const active = Boolean(member?.active);
  const completed = [contract, payment, password].filter(Boolean).length;
  const pct = Math.round((completed / 3) * 100);
  return { contract, payment, password, active, pct };
}

function todayDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toNum(v = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function availableTabs(member = {}) {
  const modules = member?.modules || {};
  const all = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'faststart', label: 'Fast Start' },
    { key: 'scripts', label: 'Scripts' },
    { key: 'execution', label: 'Execution' },
    { key: 'vault', label: 'Vault' },
    { key: 'tracker', label: 'Tracker' }
  ];
  return all.filter((t) => modules?.[t.key] !== false);
}

export default function InnerCircleHubPage() {
  const [member, setMember] = useState(() => readSession());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [kpi, setKpi] = useState(null);

  const [tab, setTab] = useState('dashboard');
  const [dailyRows, setDailyRows] = useState([]);
  const [dailyTotals, setDailyTotals] = useState({ calls: 0, texts: 0, followUps: 0, bookings: 0, apps: 0 });
  const [tracker, setTracker] = useState({ dateKey: todayDateKey(), calls: 0, texts: 0, followUps: 0, bookings: 0, apps: 0, notes: '' });
  const [savingTracker, setSavingTracker] = useState(false);

  const gate = useMemo(() => onboardingState(member || {}), [member]);
  const unlocked = gate.active;
  const tabs = useMemo(() => availableTabs(member || {}), [member]);

  useEffect(() => {
    if (!member?.email && !member?.applicantName) return;
    let canceled = false;

    async function loadKpi() {
      try {
        const url = `/api/inner-circle-hub-kpi?name=${encodeURIComponent(member?.applicantName || '')}&email=${encodeURIComponent(member?.email || '')}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok || canceled) return;
        setKpi(data.kpi || null);
      } catch {
        if (!canceled) setKpi(null);
      }
    }

    async function loadDaily() {
      try {
        const url = `/api/inner-circle-hub-daily?memberId=${encodeURIComponent(member?.id || '')}&email=${encodeURIComponent(member?.email || '')}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok || canceled) return;
        setDailyRows(Array.isArray(data.rows) ? data.rows : []);
        setDailyTotals(data.totals || { calls: 0, texts: 0, followUps: 0, bookings: 0, apps: 0 });
      } catch {
        if (!canceled) {
          setDailyRows([]);
          setDailyTotals({ calls: 0, texts: 0, followUps: 0, bookings: 0, apps: 0 });
        }
      }
    }

    loadKpi();
    loadDaily();

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
        setError(reason === 'onboarding_locked'
          ? 'Your hub is not active yet. Complete contract + payment + password setup with your advisor.'
          : 'Invalid login. Check email/password.');
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
    setKpi(null);
    setDailyRows([]);
    localStorage.removeItem(SESSION_KEY);
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
          apps: toNum(tracker.apps),
          notes: tracker.notes || ''
        })
      });

      const url = `/api/inner-circle-hub-daily?memberId=${encodeURIComponent(member?.id || '')}&email=${encodeURIComponent(member?.email || '')}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setDailyRows(Array.isArray(data.rows) ? data.rows : []);
        setDailyTotals(data.totals || { calls: 0, texts: 0, followUps: 0, bookings: 0, apps: 0 });
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
            <label style={{ color: '#e2e8f0' }}>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@email.com" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} />
            </label>
            <label style={{ color: '#e2e8f0' }}>
              Password
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} />
            </label>
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
              <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#cbd5e1', display: 'grid', gap: 6 }}>
                <li>{gate.contract ? '✅' : '⬜️'} Contract signed</li>
                <li>{gate.payment ? '✅' : '⬜️'} Payment received</li>
                <li>{gate.password ? '✅' : '⬜️'} Password set</li>
              </ul>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
              {tabs.map((t) => (
                <button key={t.key} type="button" className={tab === t.key ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTab(t.key)}>{t.label}</button>
              ))}
            </div>

            {tab === 'dashboard' ? (
              <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#020617' }}>
                <strong style={{ color: '#fff', fontSize: 16 }}>KPI Dashboard (This Month)</strong>
                <div style={{ display: 'grid', gap: 10, marginTop: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
                  <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Leads Received</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{kpi?.leadsReceived ?? 0}</div></div>
                  <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Appointments Booked</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{kpi?.bookingsThisMonth ?? 0}</div></div>
                  <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Closes</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{kpi?.closesThisMonth ?? 0}</div><small className="muted">Close Rate: {kpi?.closeRate ?? 0}%</small></div>
                  <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Estimated Gross Earned</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>${kpi?.grossEarned ?? 0}</div></div>
                </div>
              </div>
            ) : null}

            {tab === 'faststart' ? (
              <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#020617' }}>
                <strong style={{ color: '#fff', fontSize: 16 }}>First 14 Days Fast Start</strong>
                <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#cbd5e1', display: 'grid', gap: 5 }}>
                  <li>Day 1–2: CRM, phone line, profile, and scripts setup</li>
                  <li>Day 3–5: 50+ outbound conversations started</li>
                  <li>Day 6–9: Book first appointments and run discovery calls</li>
                  <li>Day 10–14: Submit first applications and tighten follow-up rhythm</li>
                </ul>
              </div>
            ) : null}

            {tab === 'scripts' ? (
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}><strong style={{ color: '#fff' }}>Opener Script</strong><p className="muted" style={{ marginBottom: 0 }}>Hey [Name], quick question — are you open to making an extra $2k-$5k this month helping families with coverage?</p></div>
                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}><strong style={{ color: '#fff' }}>Follow-Up Script</strong><p className="muted" style={{ marginBottom: 0 }}>Wanted to circle back. I can show you exactly how our producers are booking and closing this week. Want details?</p></div>
                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}><strong style={{ color: '#fff' }}>Objection: I’m busy</strong><p className="muted" style={{ marginBottom: 0 }}>Totally get it. That’s exactly why this works — we run a simple repeatable system in small daily blocks.</p></div>
              </div>
            ) : null}

            {tab === 'execution' ? (
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}><strong style={{ color: '#fff' }}>Today’s Action Plan</strong><p className="muted" style={{ marginBottom: 0 }}>1) Work new leads • 2) Follow up warm leads • 3) Book at least 1 conversation</p></div>
                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}><strong style={{ color: '#fff' }}>Daily Production Checklist</strong><p className="muted" style={{ marginBottom: 0 }}>Calls/texts, follow-up count, one post, objection handling, CRM update.</p></div>
                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}><strong style={{ color: '#fff' }}>Scoreboard</strong><p className="muted" style={{ marginBottom: 0 }}>Track: leads worked, bookings, applications, paid bonuses, consistency streak.</p></div>
              </div>
            ) : null}

            {tab === 'vault' ? (
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}><strong style={{ color: '#fff' }}>Content Vault</strong><p className="muted" style={{ marginBottom: 0 }}>Daily post prompts, story templates, and CTA frameworks.</p></div>
                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}><strong style={{ color: '#fff' }}>Call Vault</strong><p className="muted" style={{ marginBottom: 0 }}>Discovery structure, objection rebuttals, and close transitions.</p></div>
                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}><strong style={{ color: '#fff' }}>Onboarding Vault</strong><p className="muted" style={{ marginBottom: 0 }}>CRM setup checklist, profile standards, and production SOP links.</p></div>
              </div>
            ) : null}

            {tab === 'tracker' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                  <strong style={{ color: '#fff' }}>Daily Production Tracker</strong>
                  <div style={{ display: 'grid', gap: 8, marginTop: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
                    <label>Date<input type="date" value={tracker.dateKey} onChange={(e) => setTracker((p) => ({ ...p, dateKey: e.target.value }))} /></label>
                    <label>Calls<input type="number" min="0" value={tracker.calls} onChange={(e) => setTracker((p) => ({ ...p, calls: e.target.value }))} /></label>
                    <label>Texts<input type="number" min="0" value={tracker.texts} onChange={(e) => setTracker((p) => ({ ...p, texts: e.target.value }))} /></label>
                    <label>Follow-Ups<input type="number" min="0" value={tracker.followUps} onChange={(e) => setTracker((p) => ({ ...p, followUps: e.target.value }))} /></label>
                    <label>Bookings<input type="number" min="0" value={tracker.bookings} onChange={(e) => setTracker((p) => ({ ...p, bookings: e.target.value }))} /></label>
                    <label>Apps<input type="number" min="0" value={tracker.apps} onChange={(e) => setTracker((p) => ({ ...p, apps: e.target.value }))} /></label>
                  </div>
                  <label style={{ marginTop: 8, display: 'block' }}>Notes<textarea rows={2} value={tracker.notes} onChange={(e) => setTracker((p) => ({ ...p, notes: e.target.value }))} /></label>
                  <button type="button" className="publicPrimaryBtn" onClick={saveTracker} disabled={savingTracker}>{savingTracker ? 'Saving...' : 'Save Daily Metrics'}</button>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                  <strong style={{ color: '#fff' }}>This Month Totals</strong>
                  <p className="muted" style={{ marginBottom: 8 }}>Calls: {dailyTotals.calls} • Texts: {dailyTotals.texts} • Follow-Ups: {dailyTotals.followUps} • Bookings: {dailyTotals.bookings} • Apps: {dailyTotals.apps}</p>
                  <small className="muted">Recent Entries: {dailyRows.length}</small>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
