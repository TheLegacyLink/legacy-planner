'use client';

import { useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'legacy_sponsorship_queue_user_v1';
const SLA_MINUTES = 10;

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

function fmtDate(iso = '') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function minsSince(iso = '') {
  const ts = new Date(iso || 0).getTime();
  if (!ts) return 0;
  return Math.max(0, Math.floor((Date.now() - ts) / 60000));
}

export default function SponsorshipQueuePage() {
  const [auth, setAuth] = useState({ name: '', email: '', role: '' });
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('available');
  const [grabbingKey, setGrabbingKey] = useState('');
  const [markingId, setMarkingId] = useState('');

  const [member, setMember] = useState(null);
  const [policy, setPolicy] = useState({ eligible: false, reason: 'loading' });
  const [queue, setQueue] = useState([]);
  const [myClaims, setMyClaims] = useState([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      if (saved?.name) setAuth(saved);
    } catch {
      // ignore
    }
  }, []);

  async function loadData() {
    if (!auth.name) return;

    const params = new URLSearchParams({
      viewerName: auth.name,
      viewerEmail: auth.email || '',
      viewerRole: auth.role || ''
    });

    const res = await fetch(`/api/sponsorship-program?${params.toString()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.ok) {
      setMember(data.member || null);
      setPolicy(data.policy || { eligible: false, reason: 'unknown' });
      setQueue(Array.isArray(data.queue) ? data.queue : []);
      setMyClaims(Array.isArray(data.myClaims) ? data.myClaims : []);
    }
  }

  useEffect(() => {
    if (!auth.name) {
      setLoading(false);
      return;
    }

    let active = true;

    async function refresh() {
      setLoading(true);
      await loadData();
      if (active) setLoading(false);
    }

    refresh();
    const timer = setInterval(refresh, 15000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [auth.name, auth.email, auth.role]);

  async function login() {
    setLoginError('');

    const name = clean(loginName);
    if (!name || !password) {
      setLoginError('Enter your name and password.');
      return;
    }

    const res = await fetch('/api/lead-claims-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setLoginError('Invalid login.');
      return;
    }

    const role = normalize(data?.user?.role);
    if (!['submitter', 'agent', 'manager', 'admin'].includes(role)) {
      setLoginError('Access denied for this queue.');
      return;
    }

    const next = { name: data.user.name, email: data.user.email || '', role: data.user.role };
    setAuth(next);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setPassword('');
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAuth({ name: '', email: '', role: '' });
    setQueue([]);
    setMyClaims([]);
    setMember(null);
    setPolicy({ eligible: false, reason: 'signed_out' });
    setNotice('');
  }

  async function grabLead(leadKey = '') {
    if (!leadKey) return;
    setGrabbingKey(leadKey);
    setNotice('');

    try {
      const res = await fetch('/api/sponsorship-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'grab_lead',
          leadKey,
          viewerName: auth.name,
          viewerEmail: auth.email
        })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setNotice(`Unable to grab lead: ${data?.error || 'failed'}`);
      } else {
        setNotice('Lead grabbed. First contact SLA timer started (10 minutes).');
        setTab('my');
      }

      await loadData();
    } finally {
      setGrabbingKey('');
    }
  }

  async function markFirstContact(claimId = '') {
    if (!claimId) return;
    setMarkingId(claimId);
    setNotice('');

    try {
      const res = await fetch('/api/sponsorship-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_first_contact',
          claimId,
          viewerName: auth.name,
          viewerEmail: auth.email
        })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setNotice(`Unable to log contact: ${data?.error || 'failed'}`);
      } else {
        setNotice(data?.claim?.slaMet ? 'First contact logged on time ✅' : 'First contact logged (SLA missed).');
      }

      await loadData();
    } finally {
      setMarkingId('');
    }
  }

  const activeGrabCount = useMemo(() => myClaims.filter((c) => c.status === 'grabbed').length, [myClaims]);

  if (!auth.name) {
    return (
      <main className="claimsPortal claimsPortalMarketplace">
        <section className="claimsAuthCard">
          <h2 className="claimsWordmark">The Legacy Link</h2>
          <p className="claimsQuote">Sponsorship Queue</p>
          <input placeholder="Full name" value={loginName} onChange={(e) => setLoginName(e.target.value)} />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
          />
          <button type="button" className="publicPrimaryBtn" onClick={login}>Enter Queue</button>
          {loginError ? <small className="errorCheck">{loginError}</small> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="claimsPortal claimsPortalMarketplace">
      <section className="claimsHeader marketplaceHeader">
        <div>
          <h1>Sponsorship Queue</h1>
          <p>Grab-based distribution for eligible sponsorship participants. {auth.name} • {auth.role}</p>
        </div>
        <button type="button" className="ghost" onClick={logout}>Logout</button>
      </section>

      {notice ? (
        <section className="claimsRoster" style={{ marginTop: 8 }}>
          <div className="pill" style={{ background: '#dbeafe', color: '#1e3a8a' }}>{notice}</div>
        </section>
      ) : null}

      <section className="claimsRoster" style={{ marginTop: 8 }}>
        <div className="claimsQuickTools" style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill">Tier: {member?.tier || '—'}</span>
            <span className="pill">Lead Access: {policy?.eligible ? 'Active' : 'Hold'}</span>
            <span className="pill">Weekly Remaining: {policy?.weeklyRemaining ?? '—'}</span>
            <span className="pill">Queue: {queue.length}</span>
            <span className="pill">My Active Grabs: {activeGrabCount}</span>
          </div>

          {!policy?.eligible ? (
            <div className="pill" style={{ background: '#fee2e2', color: '#991b1b' }}>
              Lead access not active: {policy?.reason || 'not_eligible'}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={tab === 'available' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTab('available')}>Available Queue</button>
            <button type="button" className={tab === 'my' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTab('my')}>My Grabbed Leads</button>
          </div>
        </div>
      </section>

      <section className="claimsCards">
        {loading ? <p>Loading...</p> : null}

        {tab === 'available' ? (
          <div className="claimsLeadGrid marketplaceGrid">
            {queue.map((row) => (
              <article key={row.key} className="claimCard claimCardV2 marketplaceCard">
                <div className="claimTop">
                  <div>
                    <h3>{row.maskedName}</h3>
                    <p className="muted">{row.state || '—'} • {row.engagement}</p>
                  </div>
                  <span className="pill" style={{ background: '#1d4ed8', color: '#fff' }}>Queue Lead</span>
                </div>

                <p className="muted" style={{ margin: '6px 0 0' }}>Approved: {fmtDate(row.approvedAt)}</p>
                <div className="claimPrivate" style={{ marginTop: 10 }}>
                  <p><strong>Name:</strong> {row.maskedName}</p>
                  <p><strong>Email:</strong> {row.maskedEmail}</p>
                  <p><strong>Phone:</strong> {row.maskedPhone}</p>
                </div>

                <button
                  type="button"
                  className="publicPrimaryBtn publicBtnBlock"
                  disabled={!policy?.eligible || grabbingKey === row.key}
                  onClick={() => grabLead(row.key)}
                >
                  {grabbingKey === row.key ? 'Grabbing...' : 'Grab Lead'}
                </button>
              </article>
            ))}
            {!queue.length && !loading ? (
              <div className="claimsEmptyState">
                <div className="icon">📭</div>
                <h3>No queue leads available</h3>
                <p className="muted">Check back shortly.</p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="claimsLeadGrid marketplaceGrid">
            {myClaims.map((c) => {
              const elapsed = minsSince(c.grabbedAt);
              const remaining = Math.max(0, SLA_MINUTES - elapsed);
              const needsContact = c.status === 'grabbed' && !c.firstContactAt;

              return (
                <article key={c.id} className="claimCard claimCardV2 marketplaceCard">
                  <div className="claimTop">
                    <div>
                      <h3>{c.applicant || 'Lead'}</h3>
                      <p className="muted">{c.state || '—'} • {c.engagement || '—'}</p>
                    </div>
                    <span className="pill" style={{ background: needsContact ? '#b91c1c' : '#166534', color: '#fff' }}>
                      {needsContact ? `SLA ${remaining}m left` : c.status}
                    </span>
                  </div>

                  <div className="claimPrivate" style={{ marginTop: 10 }}>
                    <p><strong>Email:</strong> {c.email || '—'}</p>
                    <p><strong>Phone:</strong> {c.phone || '—'}</p>
                  </div>

                  <p className="muted">Grabbed: {fmtDate(c.grabbedAt)}</p>
                  <p className="muted">First Contact: {fmtDate(c.firstContactAt)}</p>

                  <button
                    type="button"
                    className="publicPrimaryBtn publicBtnBlock"
                    disabled={!needsContact || markingId === c.id}
                    onClick={() => markFirstContact(c.id)}
                  >
                    {markingId === c.id ? 'Logging...' : 'Mark First Contact'}
                  </button>
                </article>
              );
            })}

            {!myClaims.length && !loading ? (
              <div className="claimsEmptyState">
                <div className="icon">📝</div>
                <h3>No grabbed leads yet</h3>
                <p className="muted">Grab from Available Queue to start.</p>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
