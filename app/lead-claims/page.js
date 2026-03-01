'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'legacy_lead_claim_portal_user_v1';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

function fmtDate(iso = '') {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function LeadClaimsPortalPage() {
  const [auth, setAuth] = useState({ name: '', role: '' });
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [rows, setRows] = useState([]);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('available');
  const [sliderById, setSliderById] = useState({});
  const [overrideById, setOverrideById] = useState({});

  const bookingQuery = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('booking') || '';
  }, []);

  const isManager = useMemo(() => ['admin', 'manager'].includes(normalize(auth.role)), [auth.role]);

  const loadRows = useCallback(async (silent = false) => {
    if (!auth.name) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/lead-claims?viewer=${encodeURIComponent(auth.name)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load claims');
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setRoster(Array.isArray(data.roster) ? data.roster : []);
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

  const claimLead = async (bookingId) => {
    if (!auth.name || !bookingId) return;
    setSavingId(bookingId);
    setMessage('');

    try {
      const res = await fetch('/api/lead-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim', bookingId, actorName: auth.name })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        const text = data?.error === 'priority_window_locked'
          ? `Priority locked for ${data?.priorityAgent || 'referrer'} until ${fmtDate(data?.priorityExpiresAt)}`
          : data?.error || 'Claim failed';
        setMessage(text);
        return;
      }

      setMessage('Claim confirmed.');
      await loadRows(true);
    } finally {
      setSavingId('');
      setSliderById((prev) => ({ ...prev, [bookingId]: 0 }));
    }
  };

  const overrideClaim = async (bookingId) => {
    const targetName = clean(overrideById[bookingId]);
    if (!isManager || !targetName) return;

    setSavingId(bookingId);
    setMessage('');
    try {
      const res = await fetch('/api/lead-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'override', bookingId, actorName: auth.name, targetName })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMessage(data?.error || 'Override failed');
        return;
      }
      setMessage(`Override complete: assigned to ${targetName}`);
      await loadRows(true);
    } finally {
      setSavingId('');
    }
  };

  const filtered = useMemo(() => {
    const mine = normalize(auth.name);
    if (tab === 'my') return rows.filter((r) => normalize(r.claimed_by) === mine);
    if (tab === 'locked') return rows.filter((r) => r.is_priority_window_open && !r.claimed_by);
    return rows.filter((r) => !r.claimed_by);
  }, [rows, tab, auth.name]);

  if (!auth.name) {
    return (
      <main className="claimsPortal">
        <section className="claimsAuthCard">
          <Image src="/legacy-link-logo-official.png" alt="Legacy Link" width={160} height={42} />
          <h2>Inner Circle Lead Claim Portal</h2>
          <p>Isolated access. This page does not expose Mission Control.</p>
          <input placeholder="Full name" value={loginName} onChange={(e) => setLoginName(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} />
          <button type="button" className="publicPrimaryBtn" onClick={login}>Enter Portal</button>
          {loginError ? <small className="errorCheck">{loginError}</small> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="claimsPortal">
      <section className="claimsHeader">
        <div>
          <Image src="/legacy-link-logo-official.png" alt="Legacy Link" width={170} height={44} />
          <h1>Lead Claim Portal</h1>
          <p>{auth.name} • {auth.role}</p>
        </div>
        <div className="claimsTabs">
          <button type="button" className={tab === 'available' ? 'active' : ''} onClick={() => setTab('available')}>Available</button>
          <button type="button" className={tab === 'my' ? 'active' : ''} onClick={() => setTab('my')}>My Claims</button>
          <button type="button" className={tab === 'locked' ? 'active' : ''} onClick={() => setTab('locked')}>Priority Locked</button>
          <button type="button" onClick={() => loadRows()}>Refresh</button>
        </div>
      </section>

      {message ? <div className="claimsMessage">{message}</div> : null}

      <section className="claimsRoster">
        <h3>Inner Circle Licensing Snapshot</h3>
        <div className="claimsRosterGrid">
          {roster.map((person) => (
            <div key={person.name} className="claimsRosterCard">
              <strong>{person.name}</strong>
              <small>{person.role}</small>
              <span>{(person.licensedStates || []).length ? person.licensedStates.join(', ') : 'No states on file'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="claimsCards">
        {loading ? <p>Loading...</p> : null}
        {!filtered.length && !loading ? <p>No leads in this view.</p> : null}

        {filtered.map((row) => {
          const isMine = normalize(row.claimed_by) === normalize(auth.name);
          const sliderValue = Number(sliderById[row.id] || 0);
          const canClaim = Boolean(row.can_claim);
          const highlight = bookingQuery && bookingQuery === row.id;

          return (
            <article key={row.id} className={`claimCard ${highlight ? 'highlight' : ''}`}>
              <div className="claimTop">
                <div>
                  <h3>{row.applicant_name || 'Lead'}</h3>
                  <p>{row.applicant_state || '—'} • {row.requested_at_est || '—'}</p>
                </div>
                <div>
                  {row.claimed_by ? <span className="pill onpace">Claimed by {row.claimed_by}</span> : null}
                  {!row.claimed_by && row.is_priority_window_open ? <span className="pill atrisk">Reserved for {row.priority_agent}</span> : null}
                  {!row.claimed_by && !row.is_priority_window_open ? <span className="pill onpace">Open to all Inner Circle</span> : null}
                </div>
              </div>

              <div className={`claimPrivate ${row.visibility === 'partial' ? 'blurred' : ''}`}>
                <p><strong>Email:</strong> {row.applicant_email || '—'}</p>
                <p><strong>Phone:</strong> {row.applicant_phone || '—'}</p>
                <p><strong>Referred By:</strong> {row.referred_by || 'Unknown'}</p>
              </div>

              {!row.claimed_by ? (
                <div className="claimAction">
                  <small>Slide to claim</small>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sliderValue}
                    disabled={!canClaim || savingId === row.id}
                    onChange={(e) => {
                      const val = Number(e.target.value || 0);
                      setSliderById((prev) => ({ ...prev, [row.id]: val }));
                      if (val >= 100) claimLead(row.id);
                    }}
                  />
                  {!canClaim ? <small className="muted">Locked during referral priority window.</small> : null}
                </div>
              ) : (
                <div className="claimAction">
                  <small>{isMine ? 'You own this lead.' : 'Already claimed.'}</small>
                </div>
              )}

              {isManager ? (
                <div className="claimOverride">
                  <select value={overrideById[row.id] || ''} onChange={(e) => setOverrideById((prev) => ({ ...prev, [row.id]: e.target.value }))}>
                    <option value="">Override assignee...</option>
                    {roster.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                  <button type="button" className="ghost" disabled={!overrideById[row.id] || savingId === row.id} onClick={() => overrideClaim(row.id)}>
                    Admin Override
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}
