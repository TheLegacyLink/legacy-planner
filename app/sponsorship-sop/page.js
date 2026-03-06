'use client';

import { useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'legacy_sponsorship_sop_user_v1';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

const STATUS_STYLE = {
  approved: { bg: '#dcfce7', color: '#166534', label: 'Approved' },
  pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending Approval' },
  not_started: { bg: '#e2e8f0', color: '#334155', label: 'Not Started' },
  locked: { bg: '#fee2e2', color: '#991b1b', label: 'Locked' }
};

export default function SponsorshipSopPage() {
  const [auth, setAuth] = useState({ name: '', email: '', role: '' });
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [member, setMember] = useState(null);
  const [sop, setSop] = useState(null);
  const [requesting, setRequesting] = useState('');

  const demo = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return normalize(new URLSearchParams(window.location.search).get('demo') || '');
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      if (saved?.name) setAuth(saved);
    } catch {
      // ignore
    }
  }, []);

  async function loadSop(viewer = auth) {
    const params = new URLSearchParams();
    if (demo) params.set('demo', demo);
    if (!demo) {
      params.set('viewerName', viewer?.name || '');
      params.set('viewerEmail', viewer?.email || '');
    }

    const res = await fetch(`/api/sponsorship-sop?${params.toString()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.ok) {
      setMember(null);
      setSop(null);
      setMessage(data?.error === 'member_not_found' ? 'No SOP profile found yet. Ask admin to add you in Sponsorship Program.' : 'Unable to load SOP.');
      return;
    }

    setMember(data.member);
    setSop(data.sop);
    setMessage('');
  }

  useEffect(() => {
    if (demo) {
      setLoading(true);
      loadSop({});
      setLoading(false);
      return;
    }

    if (!auth.name) {
      setLoading(false);
      return;
    }

    let active = true;
    async function run() {
      setLoading(true);
      await loadSop(auth);
      if (active) setLoading(false);
    }

    run();
    const timer = setInterval(run, 20000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [auth.name, auth.email, demo]);

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

    const next = { name: data.user.name, email: data.user.email || '', role: data.user.role || '' };
    setAuth(next);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setPassword('');
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAuth({ name: '', email: '', role: '' });
    setMember(null);
    setSop(null);
    setMessage('');
  }

  async function requestApproval(stepKey = '') {
    if (!member?.name || !member?.email || !stepKey) return;
    setRequesting(stepKey);

    try {
      const res = await fetch('/api/sponsorship-sop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_approval', memberName: member.name, memberEmail: member.email, stepKey })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMessage(`Request failed: ${data?.error || 'unknown'}`);
        return;
      }

      setMessage('Approval request submitted. Please wait for admin review.');
      await loadSop(auth);
    } finally {
      setRequesting('');
    }
  }

  async function createTesters() {
    setMessage('Creating tester profiles...');
    const res = await fetch('/api/sponsorship-sop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_testers' })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setMessage(`Could not create testers: ${data?.error || 'unknown'}`);
      return;
    }
    setMessage('Testers created. Use the links below to preview both tracks.');
  }

  const canPreviewWithoutLogin = demo === 'licensed' || demo === 'unlicensed';

  if (!canPreviewWithoutLogin && !auth.name) {
    return (
      <main className="claimsPortal claimsPortalMarketplace">
        <section className="claimsAuthCard">
          <h2 className="claimsWordmark">The Legacy Link</h2>
          <p className="claimsQuote">Sponsorship SOP</p>
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

          <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
            <button type="button" className="ghost" onClick={createTesters}>Create 2 Testers</button>
            <a className="ghost" href="/sponsorship-sop?demo=licensed" style={{ textAlign: 'center', padding: 8 }}>Preview Licensed Tester</a>
            <a className="ghost" href="/sponsorship-sop?demo=unlicensed" style={{ textAlign: 'center', padding: 8 }}>Preview Unlicensed Tester</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="claimsPortal claimsPortalMarketplace">
      <section className="claimsHeader marketplaceHeader">
        <div>
          <h1>Sponsorship SOP</h1>
          <p>
            {member?.name || (demo ? `Demo ${demo}` : auth.name)} • {sop?.track === 'licensed' ? 'Licensed Track' : 'Unlicensed Track'}
          </p>
        </div>
        {!demo ? <button type="button" className="ghost" onClick={logout}>Logout</button> : null}
      </section>

      <section className="claimsRoster" style={{ marginTop: 8 }}>
        <div className="claimsQuickTools" style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill">Progress: {sop?.progressPct || 0}%</span>
            <span className="pill" style={{ background: sop?.leadAccessActive ? '#dcfce7' : '#fee2e2', color: sop?.leadAccessActive ? '#166534' : '#991b1b' }}>
              Lead Access: {sop?.leadAccessActive ? 'Active' : 'Hold'}
            </span>
            <span className="pill">Tier: {member?.tier || 'PROGRAM_TIER_0'}</span>
            <span className="pill">Commission: {member?.commissionNonSponsoredPct ?? 50}%</span>
          </div>

          {message ? <div className="pill" style={{ background: '#dbeafe', color: '#1e3a8a' }}>{message}</div> : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a className="ghost" href="/sponsorship-queue" style={{ padding: '8px 12px' }}>Open Sponsorship Queue</a>
            <a className="ghost" href="/sponsorship-sop?demo=licensed" style={{ padding: '8px 12px' }}>Licensed Demo</a>
            <a className="ghost" href="/sponsorship-sop?demo=unlicensed" style={{ padding: '8px 12px' }}>Unlicensed Demo</a>
          </div>
        </div>
      </section>

      <section className="claimsCards" style={{ marginTop: 10 }}>
        {loading ? <p>Loading...</p> : null}

        <div className="claimsLeadGrid marketplaceGrid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
          {(sop?.steps || []).map((step) => {
            const style = STATUS_STYLE[step.status] || STATUS_STYLE.not_started;
            const approvalStep = step.type === 'approval_required' || step.type === 'self_or_review';
            const showRequest = approvalStep && (step.status === 'not_started' || step.status === 'locked');

            return (
              <article key={step.key} className="claimCard claimCardV2 marketplaceCard">
                <div className="claimTop">
                  <h3 style={{ margin: 0 }}>{step.title}</h3>
                  <span className="pill" style={{ background: style.bg, color: style.color }}>{style.label}</span>
                </div>
                <p className="muted" style={{ marginTop: 8 }}>{step.description}</p>

                {step.status === 'pending' ? (
                  <p className="claimPrivateHint">Waiting for admin approval.</p>
                ) : null}

                {showRequest ? (
                  <button
                    type="button"
                    className="publicPrimaryBtn publicBtnBlock"
                    disabled={requesting === step.key}
                    onClick={() => requestApproval(step.key)}
                  >
                    {requesting === step.key ? 'Submitting...' : 'Request Approval'}
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
