'use client';

import { useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'legacy_sponsorship_sop_user_v1';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

function statusStyle(status = '') {
  if (status === 'approved') return { background: '#dcfce7', color: '#166534' };
  if (status === 'pending') return { background: '#fef9c3', color: '#854d0e' };
  if (status === 'locked') return { background: '#fee2e2', color: '#991b1b' };
  return { background: '#e5e7eb', color: '#374151' };
}

export default function SponsorshipSopPage() {
  const [auth, setAuth] = useState({ name: '', email: '', role: '' });
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [member, setMember] = useState(null);
  const [sop, setSop] = useState(null);
  const [resources, setResources] = useState({ skoolUrl: '', youtubeUrl: '' });
  const [requestingStep, setRequestingStep] = useState('');

  const demo = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const p = new URLSearchParams(window.location.search);
    return normalize(p.get('demo') || '');
  }, []);

  async function loadSop(params = {}) {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (params.demo) query.set('demo', params.demo);
      if (params.viewerName) query.set('viewerName', params.viewerName);
      if (params.viewerEmail) query.set('viewerEmail', params.viewerEmail);

      const res = await fetch(`/api/sponsorship-sop?${query.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setMember(null);
        setSop(null);
        setNotice(data?.error === 'member_not_found' ? 'No SOP profile found yet for this agent.' : 'Unable to load SOP right now.');
        return;
      }

      setMember(data.member || null);
      setSop(data.sop || null);
      setResources(data.resources || { skoolUrl: '', youtubeUrl: '' });
      setNotice('');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (demo === 'licensed' || demo === 'unlicensed') {
      loadSop({ demo });
      return;
    }

    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      if (saved?.name) {
        setAuth(saved);
        loadSop({ viewerName: saved.name, viewerEmail: saved.email || '' });
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, [demo]);

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
      setLoginError('Access denied for this SOP page.');
      return;
    }

    const next = { name: data.user.name, email: data.user.email || '', role: data.user.role };
    setAuth(next);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    await loadSop({ viewerName: next.name, viewerEmail: next.email || '' });
    setPassword('');
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAuth({ name: '', email: '', role: '' });
    setMember(null);
    setSop(null);
    setNotice('');
  }

  async function requestApproval(stepKey = '') {
    if (!member?.name || !member?.email || !stepKey) return;

    setRequestingStep(stepKey);
    setNotice('');
    try {
      const res = await fetch('/api/sponsorship-sop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_approval', memberName: member.name, memberEmail: member.email, stepKey })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setNotice(`Request failed: ${data?.error || 'unknown'}`);
        return;
      }

      setNotice('Approval request submitted. Waiting for admin review.');
      await loadSop(demo ? { demo } : { viewerName: auth.name, viewerEmail: auth.email || '' });
    } finally {
      setRequestingStep('');
    }
  }

  async function createTesters() {
    setNotice('Creating tester profiles...');
    const res = await fetch('/api/sponsorship-sop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_testers' })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setNotice(`Unable to create testers: ${data?.error || 'unknown'}`);
      return;
    }

    setNotice('Testers created. Use the demo links below.');
  }

  const isDemo = demo === 'licensed' || demo === 'unlicensed';

  if (!isDemo && !auth.name) {
    return (
      <main className="claimsPortal claimsPortalMarketplace">
        <section className="claimsAuthCard">
          <h2 className="claimsWordmark">The Legacy Link</h2>
          <p className="claimsQuote">Sponsorship SOP Page</p>
          <input placeholder="Full name" value={loginName} onChange={(e) => setLoginName(e.target.value)} />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
          />
          <button type="button" className="publicPrimaryBtn" onClick={login}>Open My SOP</button>
          {loginError ? <small className="errorCheck">{loginError}</small> : null}

          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <button type="button" className="ghost" onClick={createTesters}>Create 2 Testers</button>
            <a href="/sponsorship-sop?demo=licensed">View Licensed Tester SOP</a>
            <a href="/sponsorship-sop?demo=unlicensed">View Unlicensed Tester SOP</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="claimsPortal claimsPortalMarketplace">
      <section className="claimsHeader marketplaceHeader">
        <div>
          <h1>Agent Sponsorship SOP</h1>
          <p>{member?.name || auth.name} • {sop?.track === 'licensed' ? 'Licensed Track' : 'Unlicensed Track'}</p>
        </div>
        {!isDemo ? <button type="button" className="ghost" onClick={logout}>Logout</button> : null}
      </section>

      {notice ? (
        <section className="claimsRoster" style={{ marginTop: 8 }}>
          <div className="pill" style={{ background: '#dbeafe', color: '#1e3a8a' }}>{notice}</div>
        </section>
      ) : null}

      <section className="claimsRoster" style={{ marginTop: 8 }}>
        <div className="claimsQuickTools" style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill">Progress: {sop?.progressPct ?? 0}%</span>
            <span className="pill">Lead Access: {sop?.leadAccessActive ? 'Active' : 'Pending'}</span>
            <span className="pill">Tier: {member?.tier || 'PROGRAM_TIER_0'}</span>
            <span className="pill">Commission (non-sponsored): {member?.commissionNonSponsoredPct || 50}%</span>
          </div>
          <div className="muted">When a step says “Request Approval,” click it and wait for admin review.</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {resources?.skoolUrl ? <a href={resources.skoolUrl} target="_blank" rel="noreferrer">Open Skool Community</a> : <span className="muted">Skool link pending</span>}
            {resources?.youtubeUrl ? <a href={resources.youtubeUrl} target="_blank" rel="noreferrer">Open “Whatever It Takes” YouTube</a> : <span className="muted">YouTube link pending</span>}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/sponsorship-sop?demo=licensed">Licensed Demo</a>
            <a href="/sponsorship-sop?demo=unlicensed">Unlicensed Demo</a>
          </div>
        </div>
      </section>

      <section className="claimsCards">
        {loading ? <p>Loading...</p> : null}
        <div className="claimsLeadGrid marketplaceGrid">
          {(sop?.steps || []).map((step) => {
            const st = step.status;
            const canRequest = step.type === 'approval_required' && st !== 'approved' && st !== 'pending' && !isDemo;
            return (
              <article key={step.key} className="claimCard claimCardV2 marketplaceCard">
                <div className="claimTop">
                  <div>
                    <h3>{step.title}</h3>
                    <p className="muted">{step.description}</p>
                  </div>
                  <span className="pill" style={statusStyle(st)}>{st.replace('_', ' ')}</span>
                </div>

                {st === 'approved' ? (
                  <button type="button" className="publicPrimaryBtn publicBtnBlock" disabled>Completed ✅</button>
                ) : st === 'pending' ? (
                  <button type="button" className="publicPrimaryBtn publicBtnBlock" disabled>Waiting for Approval ⏳</button>
                ) : st === 'locked' ? (
                  <button type="button" className="publicPrimaryBtn publicBtnBlock" disabled>Locked 🔒</button>
                ) : canRequest ? (
                  <button
                    type="button"
                    className="publicPrimaryBtn publicBtnBlock"
                    disabled={requestingStep === step.key}
                    onClick={() => requestApproval(step.key)}
                  >
                    {requestingStep === step.key ? 'Submitting...' : 'Request Approval'}
                  </button>
                ) : (
                  <button type="button" className="publicPrimaryBtn publicBtnBlock" disabled>
                    Self Progress Step
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
