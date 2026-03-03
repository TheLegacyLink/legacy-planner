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
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function initials(name = '') {
  const parts = clean(name).split(/\s+/).filter(Boolean);
  if (!parts.length) return 'LL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function priorityCountdown(expiresAt = '', nowTs = Date.now()) {
  const exp = new Date(expiresAt || 0).getTime();
  if (!exp || Number.isNaN(exp)) return '—';

  const remaining = exp - nowTs;
  if (remaining <= 0) return 'Released';

  const totalSeconds = Math.floor(remaining / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function stateToneClass(state = '') {
  const key = clean(state).toUpperCase();
  if (!key) return 'stateTag stateTagDefault';
  const seed = key.charCodeAt(0) + (key.charCodeAt(1) || 0);
  const bucket = seed % 4;
  if (bucket === 0) return 'stateTag stateTagBlue';
  if (bucket === 1) return 'stateTag stateTagGreen';
  if (bucket === 2) return 'stateTag stateTagGold';
  return 'stateTag stateTagPurple';
}

function priorityProgress(expiresAt = '', nowTs = Date.now()) {
  const exp = new Date(expiresAt || 0).getTime();
  if (!exp || Number.isNaN(exp)) return 0;
  const maxMs = 24 * 60 * 60 * 1000;
  const remainingMs = Math.max(0, exp - nowTs);
  return Math.max(0, Math.min(100, (remainingMs / maxMs) * 100));
}

function submitterLabel(name = '') {
  const raw = clean(name);
  const n = normalize(raw);
  if (!raw) return '—';
  if (n === 'camorlink' || n === 'kimora link' || n === 'link') return 'Kimora L.';
  if (n === 'bonus booking') return 'Bonus Booking';

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = (parts[parts.length - 1][0] || '').toUpperCase();
  return `${first} ${lastInitial}.`;
}

function bookedWithTimezone(dateText = '', tz = '') {
  const d = clean(dateText);
  if (!d) return '—';
  const zone = clean(tz || 'ET');
  return `${d} (${zone})`;
}

export default function LeadClaimsPortalPage() {
  const [auth, setAuth] = useState({ name: '', role: '' });
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [rows, setRows] = useState([]);
  const [roster, setRoster] = useState([]);
  const [pendingPipeline, setPendingPipeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('available');
  const [overrideById, setOverrideById] = useState({});
  const [nowTs, setNowTs] = useState(Date.now());
  const [expandedId, setExpandedId] = useState('');
  const [query, setQuery] = useState('');

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
      setPendingPipeline(Array.isArray(data.pendingPipeline) ? data.pendingPipeline : []);
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
    const clock = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(clock);
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
      setExpandedId(bookingId);
      setTab('my');
      await loadRows(true);
      window.setTimeout(() => jumpToLeadCard(bookingId), 180);
    } finally {
      setSavingId('');
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

  const forceClaimAsAdmin = async (bookingId) => {
    if (!isManager) return;
    setOverrideById((prev) => ({ ...prev, [bookingId]: auth.name }));
    setSavingId(bookingId);
    setMessage('');
    try {
      const res = await fetch('/api/lead-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'override', bookingId, actorName: auth.name, targetName: auth.name })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMessage(data?.error || 'Admin force claim failed');
        return;
      }
      setMessage('Admin test claim complete.');
      await loadRows(true);
    } finally {
      setSavingId('');
    }
  };

  const jumpToLeadCard = (bookingId) => {
    const el = document.getElementById(`claim-${bookingId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const deleteLead = async (bookingId) => {
    if (!isManager || !bookingId) return;
    const ok = window.confirm('Delete this lead from claim queue?');
    if (!ok) return;

    setSavingId(bookingId);
    setMessage('');
    try {
      const res = await fetch('/api/lead-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', bookingId, actorName: auth.name })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMessage(data?.error || 'Delete failed');
        return;
      }
      setMessage('Lead deleted.');
      await loadRows(true);
    } finally {
      setSavingId('');
    }
  };

  const byId = useMemo(() => {
    const map = new Map();
    for (const r of rows) map.set(r.id, r);
    return map;
  }, [rows]);

  const counts = useMemo(() => {
    const mine = normalize(auth.name);
    return {
      available: rows.filter((r) => !r.claimed_by).length,
      my: rows.filter((r) => normalize(r.claimed_by) === mine).length,
      locked: rows.filter((r) => r.is_priority_window_open && !r.claimed_by).length
    };
  }, [rows, auth.name]);

  const filtered = useMemo(() => {
    const mine = normalize(auth.name);
    let base = rows;
    if (tab === 'my') base = rows.filter((r) => normalize(r.claimed_by) === mine);
    else if (tab === 'locked') base = rows.filter((r) => r.is_priority_window_open && !r.claimed_by);
    else base = rows.filter((r) => !r.claimed_by);

    const q = normalize(query);
    if (!q) return base;
    return base.filter((r) => {
      const blob = [r.applicant_name, r.applicant_state, r.referred_by, r.claimed_by].map((x) => normalize(x)).join(' ');
      return blob.includes(q);
    });
  }, [rows, tab, auth.name, query]);

  const viewerLicensedStates = useMemo(() => {
    const me = roster.find((p) => normalize(p?.name) === normalize(auth.name));
    return new Set((me?.licensedStates || []).map((s) => clean(s).toUpperCase()));
  }, [roster, auth.name]);

  if (!auth.name) {
    return (
      <main className="claimsPortal">
        <section className="claimsAuthCard">
          <h2 className="claimsWordmark">The Legacy Link</h2>
          <p className="claimsQuote">“Discipline today creates generational freedom tomorrow.”</p>
          <p>Inner Circle Lead Claim Portal</p>
          <input placeholder="Full name" value={loginName} onChange={(e) => setLoginName(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} />
          <button type="button" className="publicPrimaryBtn" onClick={login}>Enter Portal</button>
          {loginError ? <small className="errorCheck">{loginError}</small> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="claimsPortal claimsPortalV2">
      <section className="claimsHeader">
        <div>
          <h2 className="claimsWordmark">The Legacy Link</h2>
          <h1>Lead Claim Portal</h1>
          <p>{auth.name} • {auth.role}</p>
        </div>
        <div className="claimsTabs">
          <button type="button" className={tab === 'available' ? 'active' : ''} onClick={() => setTab('available')}>Available ({counts.available})</button>
          <button type="button" className={tab === 'my' ? 'active' : ''} onClick={() => setTab('my')}>My Claims ({counts.my})</button>
          <button type="button" className={tab === 'locked' ? 'active' : ''} onClick={() => setTab('locked')}>Locked ({counts.locked})</button>
          <button type="button" onClick={() => loadRows()}>Refresh</button>
        </div>
      </section>

      {message ? <div className="claimsMessage">{message}</div> : null}

      <section className="claimsRoster">
        <div className="claimsTopStats">
          <div className="claimsStatBox"><strong>{counts.available}</strong><span>Available</span></div>
          <div className="claimsStatBox"><strong>{counts.my}</strong><span>My Claimed</span></div>
          <div className="claimsStatBox"><strong>{counts.locked}</strong><span>24h Locked</span></div>
          <div className="claimsStatBox"><strong>{pendingPipeline.length}</strong><span>Booked Pending F&G</span></div>
        </div>
        <div className="claimsQuickTools">
          <input placeholder="Search lead name, state, submitter..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </section>

      <section className="claimsRoster">
        <h3>Inner Circle Team</h3>
        <div className="claimsAgentStrip">
          {roster.map((person) => (
            <div key={person.name} className="claimsAgentTile">
              <div className="claimsAvatar" aria-hidden>{initials(person.name)}</div>
              <div>
                <strong>{person.name}</strong>
                <small>{(person.licensedStates || []).length} states licensed</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="claimsCards">
        <h3 className="claimsSectionTitle">
          {tab === 'my' ? 'My Claimed Leads' : tab === 'locked' ? 'Priority Locked Leads' : 'Available Leads to Claim'}
        </h3>

        {loading ? <p>Loading...</p> : null}
        {!filtered.length && !loading ? <p>No leads in this view.</p> : null}

        <div className="claimsLeadGrid">
          {filtered.map((row) => {
            const isMine = normalize(row.claimed_by) === normalize(auth.name);
            const canClaim = Boolean(row.can_claim);
            const highlight = bookingQuery && bookingQuery === row.id;
            const liveCountdown = priorityCountdown(row.priority_expires_at, nowTs);
            const inPriority = Boolean(row.is_priority_window_open && !row.claimed_by);
            const stateClass = stateToneClass(row.applicant_state);
            const isBooked = Boolean(clean(row.requested_at_est));
            const isLicensedMatch = viewerLicensedStates.has(clean(row.applicant_state).toUpperCase());

            return (
              <article key={row.id} id={`claim-${row.id}`} className={`claimCard claimCardV2 ${highlight ? 'highlight' : ''}`}>
                <div className="claimTop">
                  <div>
                    <h3>{row.applicant_name || 'Lead'}</h3>
                    <p>
                      <span className={stateClass}>{row.applicant_state || '—'}</span>
                      <span> • {bookedWithTimezone(row.requested_at_est, row.booking_timezone)}</span>
                    </p>
                  </div>
                </div>

                <div className="claimBadgeCol claimBadgeRow">
                  {isBooked ? <span className="pill onpace">✅ Booked</span> : null}
                  {isLicensedMatch ? <span className="pill onpace">⭐ Licensed Match</span> : null}
                  {row.claimed_by ? <span className="pill onpace">👤 Claimed by {row.claimed_by}</span> : null}
                  {inPriority ? <span className="pill atrisk">🔒 Reserved for {row.priority_agent} • {liveCountdown}</span> : null}
                  {!row.claimed_by && !inPriority ? <span className="pill onpace">Open to all Inner Circle</span> : null}
                </div>

                <p className="muted" style={{ margin: '8px 0 0' }}><strong>Submitter:</strong> {submitterLabel(row.referred_by)}</p>

                {row.visibility === 'full' || isManager ? (
                  <>
                    <div className="claimInfoActions">
                      <button type="button" className="ghost" onClick={() => setExpandedId((prev) => (prev === row.id ? '' : row.id))}>
                        {expandedId === row.id ? 'Hide Details' : 'Open Details'}
                      </button>
                    </div>
                    {expandedId === row.id ? (
                      <div className="claimPrivate">
                        <p><strong>Email:</strong> {row.applicant_email || '—'}</p>
                        <p><strong>Phone:</strong> {row.applicant_phone || '—'}</p>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="claimPrivateHint">Claim this lead to unlock contact details.</div>
                )}

                {!row.claimed_by ? (
                  <div className="claimAction">
                    <div className="claimButtonsRow">
                      <button type="button" className="publicPrimaryBtn" disabled={!canClaim || savingId === row.id} onClick={() => claimLead(row.id)}>
                        {canClaim ? 'Claim Lead' : 'Claim Locked'}
                      </button>
                      {isManager && !canClaim ? (
                        <button type="button" className="ghost" disabled={savingId === row.id} onClick={() => forceClaimAsAdmin(row.id)}>
                          Force Claim
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="claimAction"><small>{isMine ? 'You own this lead.' : 'Already claimed.'}</small></div>
                )}

                {isManager ? (
                  <div className="claimOverride">
                    <select value={overrideById[row.id] || ''} onChange={(e) => setOverrideById((prev) => ({ ...prev, [row.id]: e.target.value }))}>
                      <option value="">Override assignee...</option>
                      {roster.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                    <button type="button" className="ghost" disabled={!overrideById[row.id] || savingId === row.id} onClick={() => overrideClaim(row.id)}>Assign</button>
                    <button type="button" className="ghost" disabled={savingId === row.id} onClick={() => deleteLead(row.id)}>Delete</button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
