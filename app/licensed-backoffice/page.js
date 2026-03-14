'use client';

import { useEffect, useMemo, useState } from 'react';
import licensedAgents from '../../data/licensedAgents.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function normalizePhone(v = '') { return clean(v).replace(/\D+/g, ''); }

function toDisplayName(raw = '') {
  const value = clean(raw);
  if (!value) return '';
  if (value.includes(',')) {
    const [last, first] = value.split(',').map((x) => clean(x));
    return clean(`${first} ${last}`)
      .toLowerCase()
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }
  return value.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

const COMP_LADDER = [
  { level: 1, title: 'Link Startup / Sponsorship', comp: 50, ap: 0 },
  { level: 2, title: 'Foundation Writer', comp: 55, ap: 2000 },
  { level: 3, title: 'Momentum Builder', comp: 60, ap: 3500 },
  { level: 4, title: 'Chainbreaker Producer', comp: 65, ap: 5000 },
  { level: 5, title: 'Legacy Closer', comp: 70, ap: 6500 },
  { level: 6, title: 'Wealth Driver', comp: 75, ap: 8000 },
  { level: 7, title: 'Dynasty Producer', comp: 80, ap: 10000 },
  { level: 8, title: 'Legacy Architect', comp: 85, ap: 12500 },
  { level: 9, title: 'Powerhouse Producer / Agency Owner', comp: 90, ap: 15000 },
  { level: 10, title: 'Blueprint Leader', comp: 95, ap: 18000 },
  { level: 11, title: 'Empire Producer', comp: 100, ap: 22000 },
  { level: 12, title: 'Pinnacle Builder', comp: 105, ap: 27000 },
  { level: 13, title: 'Legacy Icon', comp: 110, ap: 33000 },
  { level: 14, title: 'Legacy Titan', comp: 115, ap: 40000 }
];

function monthKey(ts = '') {
  const d = new Date(ts || 0);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function sum(values = []) { return values.reduce((a, b) => a + Number(b || 0), 0); }

export default function LicensedBackofficePage() {
  const [email, setEmail] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [session, setSession] = useState(null);
  const [authToken, setAuthToken] = useState('');
  const [tab, setTab] = useState('overview');
  const [policyRows, setPolicyRows] = useState([]);
  const [sponsorRows, setSponsorRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('licensed_backoffice_token') : '';
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/licensed-backoffice/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data?.ok && data?.profile) {
          setSession(data.profile);
          setAuthToken(token);
        }
      } catch {
        // ignore stale session
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function requestCode() {
    setError('');
    const e = clean(email).toLowerCase();
    const n = clean(loginName);
    const p = normalizePhone(loginPhone);
    if (!e) {
      setError('Email is required.');
      return;
    }

    try {
      const res = await fetch('/api/licensed-backoffice/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, fullName: n, phone: p })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error ? `Login blocked: ${data.error}` : 'Unable to send code right now.');
        return;
      }
      setCodeRequested(true);
    } catch {
      setError('Unable to send code right now.');
    }
  }

  async function verifyCode() {
    setError('');
    const e = clean(email).toLowerCase();
    const c = clean(code);
    if (!e || !c) {
      setError('Enter both email and code.');
      return;
    }

    try {
      const res = await fetch('/api/licensed-backoffice/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, code: c })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.token || !data?.profile) {
        setError(data?.error ? `Verification failed: ${data.error}` : 'Invalid code.');
        return;
      }
      if (typeof window !== 'undefined') window.localStorage.setItem('licensed_backoffice_token', data.token);
      setAuthToken(data.token);
      setSession(data.profile);
    } catch {
      setError('Verification failed.');
    }
  }

  async function logout() {
    try {
      if (authToken) {
        await fetch('/api/licensed-backoffice/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ token: authToken })
        });
      }
    } catch {}
    if (typeof window !== 'undefined') window.localStorage.removeItem('licensed_backoffice_token');
    setAuthToken('');
    setSession(null);
    setCode('');
    setCodeRequested(false);
  }

  useEffect(() => {
    if (!session?.email) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [pRes, sRes] = await Promise.all([
          fetch('/api/policy-submissions', { cache: 'no-store' }),
          fetch('/api/sponsorship-applications', { cache: 'no-store' })
        ]);
        const pData = await pRes.json().catch(() => ({}));
        const sData = await sRes.json().catch(() => ({}));
        if (!cancelled) {
          setPolicyRows(Array.isArray(pData?.rows) ? pData.rows : []);
          setSponsorRows(Array.isArray(sData?.rows) ? sData.rows : []);
        }
      } catch {
        if (!cancelled) setError('Could not load dashboard data yet.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [session?.email]);

  const metrics = useMemo(() => {
    if (!session) return null;
    const nameNorm = normalize(session.name);

    const myPolicies = policyRows.filter((r) => normalize(r?.policyWriterName || '') === nameNorm || normalize(r?.referredByName || '') === nameNorm);

    const approvedPolicies = myPolicies.filter((r) => normalize(r?.status || '').includes('approved'));

    const monthlyAp = sum(approvedPolicies.map((r) => Number(r?.monthlyPremium || 0) * 12));

    let currentTier = COMP_LADDER[0];
    let nextTier = COMP_LADDER[1] || null;
    for (let i = 0; i < COMP_LADDER.length; i += 1) {
      const t = COMP_LADDER[i];
      if (monthlyAp >= t.ap) {
        currentTier = t;
        nextTier = COMP_LADDER[i + 1] || null;
      }
    }

    const progress = nextTier
      ? Math.max(0, Math.min(100, ((monthlyAp - currentTier.ap) / Math.max(1, (nextTier.ap - currentTier.ap))) * 100))
      : 100;

    const mySponsors = sponsorRows.filter((r) => normalize(r?.referralName || '') === nameNorm);
    const approvedSponsors = mySponsors.filter((r) => normalize(r?.status || '').includes('approved'));
    const bookedSponsors = mySponsors.filter((r) => normalize(r?.status || '').includes('booked'));

    const byMonth = new Map();
    for (const r of approvedPolicies) {
      const key = monthKey(r?.submittedAt || r?.updatedAt || '');
      if (!key) continue;
      byMonth.set(key, (byMonth.get(key) || 0) + (Number(r?.monthlyPremium || 0) * 12));
    }

    const recentMonths = [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 3)
      .map(([month, ap]) => ({ month, ap }));

    return {
      myPolicies,
      approvedPolicies,
      monthlyAp,
      currentTier,
      nextTier,
      progress,
      mySponsors,
      approvedSponsors,
      bookedSponsors,
      recentMonths
    };
  }, [session, policyRows, sponsorRows]);

  if (!session) {
    return (
      <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #15213f 0%, #070b14 55%)', color: '#E5E7EB', display: 'grid', placeItems: 'center', padding: 24 }}>
        <section style={{ width: 'min(560px, 95vw)', border: '1px solid #2A3142', borderRadius: 16, background: 'rgba(17,24,39,0.92)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
          <div style={{ padding: '24px 26px', borderBottom: '1px solid #2A3142', background: 'linear-gradient(120deg, #1D428A, #006BB6)' }}>
            <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1 }}>THE LEGACY LINK</h1>
            <p style={{ margin: '8px 0 0', opacity: 0.95 }}>Licensed Agent Back Office (Exclusive Preview)</p>
          </div>
          <div style={{ padding: 24, display: 'grid', gap: 12 }}>
            <label style={{ fontSize: 14, color: '#9CA3AF' }}>Sign in (licensed-only)</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Licensed email (recommended)"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #374151', background: '#020617', color: '#fff' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="Full name (fallback)"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #374151', background: '#020617', color: '#fff' }}
              />
              <input
                value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)}
                placeholder="Phone (fallback)"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #374151', background: '#020617', color: '#fff' }}
              />
            </div>
            {!codeRequested ? (
              <button onClick={requestCode} style={{ padding: '12px 14px', borderRadius: 10, border: 0, background: '#C8A96B', color: '#0B1020', fontWeight: 800 }}>
                Send Login Code
              </button>
            ) : (
              <>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #374151', background: '#020617', color: '#fff' }}
                />
                <button onClick={verifyCode} style={{ padding: '12px 14px', borderRadius: 10, border: 0, background: '#C8A96B', color: '#0B1020', fontWeight: 800 }}>
                  Verify & Enter Back Office
                </button>
              </>
            )}
            <button type="button" disabled style={{ padding: '10px 14px', borderRadius: 10, border: '1px dashed #475569', background: '#0B1220', color: '#9CA3AF' }}>
              Google Sign-In (Enable when OAuth keys are added)
            </button>
            {error ? <small style={{ color: '#FCA5A5' }}>{error}</small> : <small style={{ color: '#9CA3AF' }}>Licensed-only access. Use email code, with name + phone matching support for alternate emails.</small>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#070b14', color: '#E5E7EB', padding: 22 }}>
      <section style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 14 }}>
        <header style={{ border: '1px solid #2A3142', borderRadius: 14, background: '#0F172A', padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 28 }}>Licensed Agent Back Office</h2>
              <p style={{ margin: '6px 0 0', color: '#9CA3AF' }}>{session.name} • {session.email} • {session.homeState || 'State Pending'}</p>
            </div>
            <button onClick={logout} style={{ borderRadius: 10, border: '1px solid #334155', padding: '8px 12px', background: '#111827', color: '#E5E7EB' }}>Sign Out</button>
          </div>
        </header>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            ['overview', 'Overview'],
            ['sponsorships', 'Sponsorships'],
            ['policies', 'Policies'],
            ['resources', 'Resources']
          ].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 14px', borderRadius: 999, border: '1px solid #334155', background: tab === k ? '#1D428A' : '#0B1220', color: '#E5E7EB' }}>{label}</button>
          ))}
        </div>

        {loading ? <div style={{ border: '1px solid #2A3142', borderRadius: 12, padding: 14, background: '#0F172A' }}>Loading dashboard…</div> : null}
        {error ? <div style={{ border: '1px solid #7F1D1D', borderRadius: 12, padding: 14, background: '#1F0A0A', color: '#FECACA' }}>{error}</div> : null}

        {metrics ? (
          <>
            {tab === 'overview' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
                <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
                  <div style={{ color: '#9CA3AF', fontSize: 12 }}>Current Tier</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>L{metrics.currentTier.level} • {metrics.currentTier.comp}%</div>
                  <div style={{ color: '#9CA3AF' }}>{metrics.currentTier.title}</div>
                </div>
                <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
                  <div style={{ color: '#9CA3AF', fontSize: 12 }}>Placed AP (approved policies)</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>${metrics.monthlyAp.toLocaleString()}</div>
                  <div style={{ color: '#9CA3AF' }}>Personal production basis</div>
                </div>
                <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
                  <div style={{ color: '#9CA3AF', fontSize: 12 }}>Sponsorships Brought In</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{metrics.mySponsors.length}</div>
                  <div style={{ color: '#9CA3AF' }}>Approved: {metrics.approvedSponsors.length} • Booked: {metrics.bookedSponsors.length}</div>
                </div>
                <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
                  <div style={{ color: '#9CA3AF', fontSize: 12 }}>Contracted Carriers</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{(session.carriersActive || []).length || 0}</div>
                  <div style={{ color: '#9CA3AF' }}>{(session.carriersActive || []).length ? session.carriersActive.join(' • ') : 'No active carriers mapped yet'}</div>
                </div>
                <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
                  <div style={{ color: '#9CA3AF', fontSize: 12 }}>Next Tier Progress</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{metrics.nextTier ? `L${metrics.nextTier.level} (${metrics.nextTier.comp}%)` : 'Top Tier'}</div>
                  <div style={{ marginTop: 8, height: 10, borderRadius: 999, background: '#1F2937', overflow: 'hidden' }}>
                    <div style={{ width: `${metrics.progress}%`, height: '100%', background: 'linear-gradient(90deg,#C8A96B,#F59E0B)' }} />
                  </div>
                  <div style={{ color: '#9CA3AF', marginTop: 6 }}>
                    {metrics.nextTier
                      ? `${Math.max(0, metrics.nextTier.ap - metrics.monthlyAp).toLocaleString()} AP to next level`
                      : 'You are at max level'}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'sponsorships' ? (
              <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
                <h3 style={{ marginTop: 0 }}>My Sponsorship Pipeline</h3>
                {!metrics.mySponsors.length ? <p style={{ color: '#9CA3AF' }}>No sponsorship records tied to your referral name yet.</p> : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {metrics.mySponsors.slice(0, 15).map((r) => (
                      <div key={r.id} style={{ border: '1px solid #2A3142', borderRadius: 10, padding: 10, background: '#020617' }}>
                        <strong>{clean(r.firstName)} {clean(r.lastName)}</strong>
                        <div style={{ color: '#9CA3AF' }}>{clean(r.state)} • {clean(r.status) || 'Pending'} • {clean(r.submitted_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {tab === 'policies' ? (
              <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
                <h3 style={{ marginTop: 0 }}>Policy Production</h3>
                {!metrics.myPolicies.length ? <p style={{ color: '#9CA3AF' }}>No policy records found yet under your writer/referrer name.</p> : (
                  <>
                    <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                      {metrics.recentMonths.map((m) => (
                        <div key={m.month} style={{ border: '1px solid #2A3142', borderRadius: 10, padding: 10, background: '#020617', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{m.month}</span><strong>${m.ap.toLocaleString()} AP</strong>
                        </div>
                      ))}
                    </div>
                    <div style={{ color: '#9CA3AF' }}>Approved policies: {metrics.approvedPolicies.length} of {metrics.myPolicies.length} total submissions.</div>
                  </>
                )}
              </div>
            ) : null}

            {tab === 'resources' ? (
              <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14, display: 'grid', gap: 8 }}>
                <h3 style={{ marginTop: 0 }}>Resources</h3>
                <a href="/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf" target="_blank" rel="noreferrer" style={{ color: '#93C5FD' }}>Licensed Onboarding Playbook</a>
                <a href="/docs/onboarding/legacy-link-comp-schedule-bonuses-v2.pdf" target="_blank" rel="noreferrer" style={{ color: '#93C5FD' }}>Comp Schedule + Bonuses + FAQ</a>
                <a href="/docs/onboarding/legacy-link-sponsorship-phone-application-sop.pdf" target="_blank" rel="noreferrer" style={{ color: '#93C5FD' }}>Sponsorship Application Call SOP</a>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
