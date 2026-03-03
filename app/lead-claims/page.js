'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'legacy_lead_claim_portal_user_v1';

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

function isToday(iso = '') {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function sourceLabel(row = {}) {
  if (clean(row.source)) return clean(row.source);
  if (clean(row.source_type) === 'bonus') return 'Bonus Booking';
  if (clean(row.source_type) === 'sponsorship') return 'Sponsorship';
  return 'CSV Import';
}

function maskPhone(v = '') {
  const digits = clean(v).replace(/\D/g, '');
  if (!digits) return '123-***-****';
  return `${digits.slice(0, 3).padEnd(3, '*')}-***-****`;
}

function maskEmail(v = '') {
  const email = clean(v).toLowerCase();
  if (!email.includes('@')) return 'j***@***.com';
  const [left, right] = email.split('@');
  const first = left?.[0] || 'j';
  const domainParts = String(right || '***.com').split('.');
  const tld = domainParts.length > 1 ? domainParts[domainParts.length - 1] : 'com';
  return `${first}***@***.${tld}`;
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
  const [view, setView] = useState('available');

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
  const monthlyClaims = useMemo(() => myClaims.filter((r) => isToday(r.claimed_at)).length, [myClaims]);
  const lifetimeClaims = myClaims.length;

  const displayedRows = view === 'claimed' ? myClaims : filteredRows;

  if (!auth.name) {
    return (
      <main className="claimsPortal claimsPortalMarketplace">
        <section className="claimsAuthCard">
          <h2 className="claimsWordmark">The Legacy Link</h2>
          <p className="claimsQuote">Booked Application Claim Queue</p>
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
          <h1>Booked Appointment Queue</h1>
          <p>These are booked appointments waiting for an agent to complete the sponsorship application through F&G. {auth.name} • {auth.role}</p>
        </div>
        <button type="button" className="ghost" onClick={() => loadRows()}>Refresh</button>
      </section>

      {isManager ? (
        <section className="claimsMessage" style={{ background: '#fff8e1', borderColor: '#fde68a', color: '#854d0e' }}>
          Debug: total={rows.length} • available={availableRows.length}
        </section>
      ) : null}

      {message ? <section className="claimsMessage">{message}</section> : null}

      

      <section className="claimsRoster">
        <div className="claimsQuickTools" style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={view === 'available' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setView('available')}>
              Available to Claim ({filteredRows.length})
            </button>
            <button type="button" className={view === 'claimed' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setView('claimed')}>
              My Claimed Leads ({myClaims.length})
            </button>
          </div>
          {myClaims.length ? (
            <div className="claimsMiniClaimed">
              <strong>Claimed by you today:</strong> {myClaims.filter((r) => isToday(r.claimed_at)).slice(0, 3).map((r) => clean(r.applicant_name)).filter(Boolean).join(' • ')}
            </div>
          ) : null}
          <input placeholder="Search leads..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </section>

      <section className="claimsCards">
        {loading ? <p>Loading...</p> : null}

        {!displayedRows.length && !loading ? (
          <div className="claimsEmptyState">
            <div className="icon">🛍️</div>
            <h3>{view === 'claimed' ? 'No claimed leads yet' : 'No available leads'}</h3>
            <p className="muted">{view === 'claimed' ? 'Once you claim leads, they will show here.' : (isManager ? 'Add new leads in admin tools to populate the queue.' : 'Check back soon for fresh booked appointments.')}</p>
          </div>
        ) : null}

        <div className="claimsLeadGrid marketplaceGrid">
          {displayedRows.map((row) => {
            const inPriority = Boolean(row.is_priority_window_open && !row.claimed_by);
            const canClaim = Boolean(row.can_claim);
            const isClaimedView = view === 'claimed';
            const maskedPhone = isClaimedView ? clean(row.applicant_phone || '—') : maskPhone(row.applicant_phone);
            const maskedEmail = isClaimedView ? clean(row.applicant_email || '—') : maskEmail(row.applicant_email);
            const isVip = Boolean(row.is_vip);
            const referredBy = clean(row.referred_by || '—');
            const myName = normalize(auth.name);
            const refNorm = normalize(referredBy);
            const isMyReferral = Boolean(
              referredBy && (
                refNorm === myName ||
                (myName && refNorm.includes(myName)) ||
                (myName && myName.includes(refNorm)) ||
                (myName.includes('kimora') && (refNorm === 'link' || refNorm.includes('kimora link') || refNorm.includes('kimora_link')))
              )
            );

            return (
              <article key={row.id} className={`claimCard claimCardV2 marketplaceCard ${isMyReferral ? 'myReferral' : ''}`}>
                <div className="claimTop">
                  <div>
                    <h3>{row.applicant_name || 'Lead'}</h3>
                    <p className="muted">{sourceLabel(row)} — Referred by {referredBy}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {isMyReferral ? <span className="pill myReferralPill">⭐ Your Referral</span> : null}
                    {isVip ? <span className="pill" style={{ background: '#f59e0b', color: '#fff' }}>VIP</span> : null}
                  </div>
                </div>

                <p className="muted" style={{ margin: '6px 0 0' }}>{row.applicant_state || '—'} • {clean(row.requested_at_est) || 'No booking time yet'}</p>
                {inPriority && isMyReferral ? <p className="muted" style={{ margin: '4px 0 0', color: '#92400e' }}>24h priority lock is active for your referral.</p> : null}
                {isClaimedView ? <p className="muted" style={{ margin: '4px 0 0' }}>Claimed at: {fmtDate(row.claimed_at)}</p> : null}

                <div className="claimPrivate" style={{ marginTop: 10 }}>
                  <p><strong>Phone:</strong> {maskedPhone}</p>
                  <p><strong>Email:</strong> {maskedEmail}</p>
                </div>


                {!isClaimedView ? <p className="claimPrivateHint">Full contact details revealed after claiming.</p> : null}

                {!isClaimedView ? (
                  <button
                    type="button"
                    className="publicPrimaryBtn publicBtnBlock"
                    disabled={!canClaim || savingId === row.id}
                    onClick={() => claimLead(row.id)}
                  >
                    {savingId === row.id ? 'Claiming...' : canClaim ? 'Claim Appointment' : inPriority ? 'Claim Locked' : 'Unavailable'}
                  </button>
                ) : (
                  <button type="button" className="ghost publicBtnBlock" onClick={() => (typeof window !== 'undefined' ? window.location.assign('/pipeline') : null)}>
                    Open in Pipeline
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
