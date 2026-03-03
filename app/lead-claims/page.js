'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'legacy_lead_claim_portal_user_v1';
const WEEKLY_LIMIT_DEFAULT = 15;
const MONTHLY_LIMIT_DEFAULT = 30;

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

function fmtDate(iso = '') {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function isThisWeek(iso = '') {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - diffToMonday);
  return d >= monday;
}

function isThisMonth(iso = '') {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function sourceLabel(row = {}) {
  if (clean(row.source)) return clean(row.source);
  if (clean(row.source_type) === 'bonus') return 'Bonus Booking';
  if (clean(row.source_type) === 'sponsorship') return 'Sponsorship';
  return 'CSV Import';
}

export default function LeadClaimsPortalPage() {
  const [auth, setAuth] = useState({ name: '', role: '' });
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');

  const isManager = useMemo(() => ['admin', 'manager'].includes(normalize(auth.role)), [auth.role]);

  const loadRows = useCallback(async (silent = false) => {
    if (!auth.name) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/lead-claims?viewer=${encodeURIComponent(auth.name)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load leads');
      setRows(Array.isArray(data.rows) ? data.rows : []);
      if (data?.viewer?.name && data?.viewer?.role) {
        setAuth({ name: data.viewer.name, role: data.viewer.role });
      }
    } catch (err) {
      setMessage(err?.message || 'Load failed');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [auth.name]);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      if (saved?.name) setAuth({ name: saved.name, role: saved.role || '' });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!auth.name) return;
    loadRows();
    const timer = setInterval(() => loadRows(true), 15000);
    return () => clearInterval(timer);
  }, [auth.name, loadRows]);

  const login = async () => {
    setLoginError('');
    setMessage('');
    const name = clean(loginName);
    if (!name || !password) {
      setLoginError('Enter your name and password.');
      return;
    }

    const res = await fetch('/api/inner-circle-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setLoginError('Invalid login.');
      return;
    }

    const next = { name: data.user.name, role: data.user.role };
    setAuth(next);
    setPassword('');
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  };

  const claimLead = async (leadId) => {
    if (!auth.name || !leadId) return;
    setSavingId(leadId);
    setMessage('');

    const prior = rows;
    setRows((prev) => prev.filter((r) => clean(r.id) !== clean(leadId)));

    try {
      const res = await fetch('/api/lead-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim', bookingId: leadId, actorName: auth.name })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setRows(prior);
        const text = data?.error === 'priority_window_locked'
          ? `Claim locked by ${data?.priorityAgent || 'referrer'} until ${fmtDate(data?.priorityExpiresAt)}`
          : data?.error || 'Claim failed';
        setMessage(text);
        return;
      }

      setMessage('Lead claimed successfully. Open your CRM pipeline to continue follow-up.');
      setTimeout(() => {
        if (typeof window !== 'undefined') window.location.assign('/pipeline');
      }, 2000);
    } finally {
      setSavingId('');
    }
  };

  const availableRows = useMemo(() => rows.filter((r) => !clean(r.claimed_by)), [rows]);

  const filteredRows = useMemo(() => {
    const q = normalize(query);
    if (!q) return availableRows;
    return availableRows.filter((r) => {
      const blob = [r.applicant_name, r.applicant_state, r.referred_by, sourceLabel(r)].map((x) => normalize(x)).join(' ');
      return blob.includes(q);
    });
  }, [availableRows, query]);

  const myClaims = useMemo(() => rows.filter((r) => normalize(r.claimed_by) === normalize(auth.name)), [rows, auth.name]);
  const weeklyClaims = useMemo(() => myClaims.filter((r) => isThisWeek(r.claimed_at)).length, [myClaims]);
  const monthlyClaims = useMemo(() => myClaims.filter((r) => isThisMonth(r.claimed_at)).length, [myClaims]);
  const lifetimeClaims = myClaims.length;

  if (!auth.name) {
    return (
      <main className="claimsPortal claimsPortalMarketplace">
        <section className="claimsAuthCard">
          <h2 className="claimsWordmark">The Legacy Link</h2>
          <p className="claimsQuote">Lead Marketplace Access</p>
          <input placeholder="Full name" value={loginName} onChange={(e) => setLoginName(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} />
          <button type="button" className="publicPrimaryBtn" onClick={login}>Enter Marketplace</button>
          {loginError ? <small className="errorCheck">{loginError}</small> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="claimsPortal claimsPortalMarketplace">
      <section className="claimsHeader marketplaceHeader">
        <div>
          <h1>Lead Marketplace</h1>
          <p>Claim qualified leads fast. {auth.name} • {auth.role}</p>
        </div>
        <button type="button" className="ghost" onClick={() => loadRows()}>Refresh</button>
      </section>

      {isManager ? (
        <section className="claimsMessage" style={{ background: '#fff8e1', borderColor: '#fde68a', color: '#854d0e' }}>
          Debug: total={rows.length} • available={availableRows.length}
        </section>
      ) : null}

      {message ? <section className="claimsMessage">{message}</section> : null}

      <section className="claimsRoster marketplaceStats">
        <div className="claimsTopStats">
          <div className="claimsStatBox"><strong>{weeklyClaims}</strong><span>Weekly Claims / {WEEKLY_LIMIT_DEFAULT}</span></div>
          <div className="claimsStatBox"><strong>{monthlyClaims}</strong><span>Monthly Claims / {MONTHLY_LIMIT_DEFAULT}</span></div>
          <div className="claimsStatBox"><strong>{lifetimeClaims}</strong><span>Lifetime Claims / ∞</span></div>
        </div>
      </section>

      <section className="claimsRoster">
        <div className="claimsQuickTools">
          <input placeholder="Search leads..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </section>

      <section className="claimsCards">
        {loading ? <p>Loading...</p> : null}

        {!filteredRows.length && !loading ? (
          <div className="claimsEmptyState">
            <div className="icon">🛍️</div>
            <h3>No available leads</h3>
            <p className="muted">{isManager ? 'Add new leads in admin tools to populate the marketplace.' : 'Check back soon for fresh leads.'}</p>
          </div>
        ) : null}

        <div className="claimsLeadGrid marketplaceGrid">
          {filteredRows.map((row) => {
            const inPriority = Boolean(row.is_priority_window_open && !row.claimed_by);
            const canClaim = Boolean(row.can_claim);
            const maskedPhone = clean(row.applicant_phone || '123-***-****');
            const maskedEmail = clean(row.applicant_email || 'j***@***.com');
            const isVip = Boolean(row.is_vip);

            return (
              <article key={row.id} className="claimCard claimCardV2 marketplaceCard">
                <div className="claimTop">
                  <div>
                    <h3>{row.applicant_name || 'Lead'}</h3>
                    <p className="muted">{sourceLabel(row)}</p>
                  </div>
                  {isVip ? <span className="pill" style={{ background: '#f59e0b', color: '#fff' }}>VIP</span> : null}
                </div>

                <p className="muted" style={{ margin: '6px 0 0' }}>{row.applicant_state || '—'} • {clean(row.requested_at_est) || 'No booking time yet'}</p>

                <div className="claimPrivate" style={{ marginTop: 10 }}>
                  <p><strong>Phone:</strong> {maskedPhone}</p>
                  <p><strong>Email:</strong> {maskedEmail}</p>
                </div>

                {clean(row.notes) ? <p className="muted" style={{ margin: '8px 0 0', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>{row.notes}</p> : null}

                <p className="claimPrivateHint">Full contact details revealed after claiming.</p>

                <button
                  type="button"
                  className="publicPrimaryBtn publicBtnBlock"
                  disabled={!canClaim || savingId === row.id}
                  onClick={() => claimLead(row.id)}
                >
                  {savingId === row.id ? 'Claiming...' : canClaim ? 'Claim Lead' : inPriority ? 'Claim Locked' : 'Unavailable'}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
