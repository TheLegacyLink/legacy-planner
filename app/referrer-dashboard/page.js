'use client';

import { useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'legacy_referrer_dashboard_user_v1';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase(); }
function fmt(iso = '') {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function badgeStyle(bucket = '') {
  if (bucket === 'on_track') return { background: '#dcfce7', color: '#166534' };
  if (bucket === 'stalled') return { background: '#fee2e2', color: '#991b1b' };
  return { background: '#fef9c3', color: '#854d0e' };
}

export default function ReferrerDashboardPage() {
  const [auth, setAuth] = useState({ name: '', role: '', email: '' });
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, onTrack: 0, needsFollowup: 0, stalled24h: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [myPolicies, setMyPolicies] = useState([]);
  const [policyMetrics, setPolicyMetrics] = useState({ total: 0, submitted: 0, approved: 0, declined: 0, paid: 0 });
  const [innerCircle, setInnerCircle] = useState([]);
  const [message, setMessage] = useState('');
  const [delegateByPerson, setDelegateByPerson] = useState({});
  const [showStalledOnly, setShowStalledOnly] = useState(false);
  const [showLicensedOnly, setShowLicensedOnly] = useState(false);
  const [viewMode, setViewMode] = useState('scoreboard');

  const isAdmin = useMemo(() => normalize(auth.role) === 'admin', [auth.role]);
  const filteredRows = useMemo(() => rows.filter((r) => {
    if (showStalledOnly && !r.stalled24h) return false;
    if (showLicensedOnly && !r.licensed) return false;
    return true;
  }), [rows, showStalledOnly, showLicensedOnly]);

  async function loadData(silent = false) {
    if (!auth.name) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/referrer-dashboard?viewerName=${encodeURIComponent(auth.name)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'load_failed');
      setRows(data.rows || []);
      setMetrics(data.metrics || { total: 0, onTrack: 0, needsFollowup: 0, stalled24h: 0 });
      setLeaderboard(data.leaderboard || []);
      setMyPolicies(data.myPolicies || []);
      setPolicyMetrics(data.policyMetrics || { total: 0, submitted: 0, approved: 0, declined: 0, paid: 0 });
      setInnerCircle(data.innerCircle || []);
      setAuth((a) => ({ ...a, role: data?.viewer?.role || a.role, email: data?.viewer?.email || a.email || '' }));
    } catch (e) {
      setMessage(`Load failed: ${e?.message || 'unknown_error'}`);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      if (saved?.name) setAuth({ name: saved.name, role: saved.role || '', email: saved.email || '' });
      if (saved?.name) setLoginName(saved.name);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!auth.name) return;
    loadData();
    const t = setInterval(() => loadData(true), 30000);
    return () => clearInterval(t);
  }, [auth.name]);

  async function login() {
    setLoginError('');
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

    const next = { name: data.user.name, role: data.user.role || '', email: data.user.email || '' };
    setAuth(next);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setPassword('');
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAuth({ name: '', role: '', email: '' });
    setRows([]);
    setMessage('');
  }

  async function saveDelegation(personKey) {
    const delegateTo = clean(delegateByPerson[personKey]);
    if (!delegateTo) return;
    const res = await fetch('/api/referrer-dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delegate_referrer', actorName: auth.name, personKey, delegateTo })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setMessage(`Delegation failed: ${data?.error || 'unknown_error'}`);
      return;
    }
    setMessage(`Delegated successfully to ${delegateTo}`);
    await loadData(true);
  }

  function openMail({ to = '', subject = '', body = '', cc = '' } = {}) {
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}${cc ? `&cc=${encodeURIComponent(cc)}` : ''}`;
    window.location.href = mailto;
  }

  function sendReminderEmail(row) {
    const to = clean(row?.email);
    if (!to) {
      setMessage('No email on file for this person.');
      return;
    }
    openMail({
      to,
      subject: 'Quick follow-up on your Legacy Link progress',
      body: [
        `Hi ${row?.name || ''},`,
        '',
        'Just checking in to help you keep momentum with your onboarding progress.',
        `Current stage I see: ${row?.stage || 'In Progress'}.`,
        '',
        'Reply here if you need help and I will support you step-by-step.',
        '',
        '— The Legacy Link Team'
      ].join('\n'),
      cc: auth?.email || ''
    });
  }

  function messageJamal(row) {
    openMail({
      to: 'support@Jdholmesagencyllc.com',
      subject: `Support needed for ${row?.name || 'referral'} (licensing/progress)`,
      body: [
        'Hi Jamal,',
        '',
        `Please support this referral: ${row?.name || '—'}.`,
        `Email: ${row?.email || '—'}`,
        `Current stage: ${row?.stage || '—'}`,
        `Licensed: ${row?.licensed ? 'Yes' : 'No'}`,
        '',
        'Please follow up within 24 hours.',
        '',
        `— ${auth?.name || 'Inner Circle'}`
      ].join('\n'),
      cc: auth?.email || ''
    });
  }

  function messageDave(row) {
    openMail({
      to: 'davevanlarcena0021@gmail.com',
      subject: `GHL follow-up for ${row?.name || 'referral'}`,
      body: [
        'Hi Dave,',
        '',
        `Please review GHL readiness for: ${row?.name || '—'}.`,
        `Email: ${row?.email || '—'}`,
        `Current stage: ${row?.stage || '—'}`,
        `Licensed: ${row?.licensed ? 'Yes' : 'No'}`,
        '',
        `— ${auth?.name || 'Inner Circle'}`
      ].join('\n'),
      cc: auth?.email || ''
    });
  }

  if (!auth.name) {
    return (
      <main className="claimsPortal claimsPortalMarketplace">
        <section className="claimsAuthCard">
          <h2 className="claimsWordmark">The Legacy Link</h2>
          <p className="claimsQuote">Referrer Scoreboard (V1)</p>
          <input placeholder="Full name" value={loginName} onChange={(e) => setLoginName(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} />
          <button type="button" className="publicPrimaryBtn" onClick={login}>Open My Scoreboard</button>
          {loginError ? <small className="errorCheck">{loginError}</small> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="claimsPortal claimsPortalMarketplace">
      <section className="claimsHeader marketplaceHeader">
        <div>
          <h1>My Referred People — Scoreboard</h1>
          <p>{auth.name}</p>
        </div>
        <button type="button" className="ghost" onClick={logout}>Logout</button>
      </section>

      <section className="claimsRoster" style={{ marginTop: 8 }}>
        <div className="claimsQuickTools" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className={viewMode === 'scoreboard' ? '' : 'ghost'} onClick={() => setViewMode('scoreboard')}>My Referrals</button>
          <button type="button" className={viewMode === 'policies' ? '' : 'ghost'} onClick={() => setViewMode('policies')}>My Policy Pipeline</button>
          <span className="pill">Policies: {policyMetrics.total}</span>
          <span className="pill">Submitted: {policyMetrics.submitted}</span>
          <span className="pill onpace">Approved: {policyMetrics.approved}</span>
          <span className="pill atrisk">Declined: {policyMetrics.declined}</span>
          <span className="pill">Paid: {policyMetrics.paid}</span>
        </div>
      </section>

      {viewMode === 'scoreboard' ? (
        <>
          <section className="claimsRoster" style={{ marginTop: 8 }}>
            <div className="claimsQuickTools" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="pill">Total: {metrics.total}</span>
              <span className="pill">Submitted Apps: {metrics.submittedApps ?? metrics.total}</span>
              <span className="pill onpace">Approved Apps: {metrics.approvedApps ?? 0}</span>
              <span className="pill onpace">On Track: {metrics.onTrack}</span>
              <span className="pill">Needs Follow-up: {metrics.needsFollowup}</span>
              <span className="pill atrisk">Stalled 24h+: {metrics.stalled24h}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={showStalledOnly} onChange={(e) => setShowStalledOnly(e.target.checked)} />
                Show stalled only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={showLicensedOnly} onChange={(e) => setShowLicensedOnly(e.target.checked)} />
                Licensed only
              </label>
            </div>
            <p className="muted" style={{ marginTop: 8 }}>Progress/stage bars below are policy-pipeline based (Submitted → Approved → Paid) for people who submitted policy applications.</p>
            {message ? <p className="muted" style={{ marginTop: 8 }}>{message}</p> : null}
          </section>

          <section className="claimsRoster" style={{ marginTop: 8 }}>
            <h3 style={{ marginTop: 0 }}>Leaderboard — Team Momentum</h3>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Referrer</th>
                    <th>On Track</th>
                    <th>Stalled</th>
                    <th>Avg Progress</th>
                    <th>Speed Score</th>
                  </tr>
                </thead>
                <tbody>
                  {(leaderboard || []).map((r, i) => (
                    <tr key={`${r.name}-${i}`}>
                      <td>#{i + 1}</td>
                      <td>{r.name}</td>
                      <td>{r.onTrack}/{r.total}</td>
                      <td>{r.stalled}</td>
                      <td>{r.avgProgress}%</td>
                      <td>{r.speedScore}</td>
                    </tr>
                  ))}
                  {!(leaderboard || []).length ? <tr><td colSpan={6} className="muted">No leaderboard data yet.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="claimsCards">
            {loading ? <p>Loading...</p> : null}
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Licensed</th>
                    <th>Application</th>
                    <th>Policy Stage</th>
                    <th>Policy Progress</th>
                    <th>Policy</th>
                    <th>Status</th>
                    <th>Last Activity</th>
                    <th>Actions</th>
                    {isAdmin ? <th>Delegate</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {(filteredRows || []).map((r) => (
                    <tr key={r.personKey}>
                      <td>
                        <div>{r.name || '—'}</div>
                        <small className="muted">{r.email || r.phone || '—'}</small>
                      </td>
                      <td>{r.licensed ? 'Yes' : 'No'}</td>
                      <td>{r.appStatus || 'Submitted'}</td>
                      <td>{r.stage || '—'}</td>
                      <td>{r.completedSteps}/{r.totalSteps} ({r.progressPct}%)</td>
                      <td>{r.policyStatus || '—'}{r.stalled24h ? ' (stalled 24h+)' : ''}</td>
                      <td><span className="pill" style={badgeStyle(r.bucket)}>{r.bucket === 'on_track' ? 'On Track' : r.bucket === 'stalled' ? 'Stalled' : 'Needs Follow-up'}</span></td>
                      <td>{fmt(r.lastActivityAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <a className="ghost" href={r.sopUrl} target="_blank" rel="noreferrer">Open SOP</a>
                          <button type="button" className="ghost" onClick={() => sendReminderEmail(r)}>Send Reminder</button>
                          <button type="button" className="ghost" onClick={() => messageJamal(r)}>Message Jamal</button>
                          <button type="button" className="ghost" onClick={() => messageDave(r)}>Message Dave</button>
                        </div>
                      </td>
                      {isAdmin ? (
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <select
                              value={delegateByPerson[r.personKey] || r.effectiveReferrer || ''}
                              onChange={(e) => setDelegateByPerson((m) => ({ ...m, [r.personKey]: e.target.value }))}
                            >
                              {(innerCircle || []).map((u) => <option key={u.name} value={u.name}>{u.name}</option>)}
                            </select>
                            <button type="button" className="ghost" onClick={() => saveDelegation(r.personKey)}>Save</button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {!(filteredRows || []).length ? <tr><td colSpan={isAdmin ? 10 : 9} className="muted">No referred people found yet.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="claimsCards" style={{ marginTop: 8 }}>
          <h3 style={{ marginTop: 0 }}>My Policy Pipeline (View Only)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Status</th>
                  <th>My Payout</th>
                  <th>Payout Status</th>
                  <th>Submitted</th>
                  <th>Approved</th>
                  <th>SOP</th>
                  <th>Paid At</th>
                </tr>
              </thead>
              <tbody>
                {(myPolicies || []).map((p) => (
                  <tr key={p.id || `${p.applicantName}-${p.submittedAt}`}>
                    <td>
                      <div>{p.applicantName || '—'}</div>
                      <small className="muted">Ref: {p.referredByName || '—'} • Writer: {p.policyWriterName || '—'}</small>
                    </td>
                    <td>{p.status || 'Submitted'}</td>
                    <td>
                      ${Number(p.viewerPayout || 0).toFixed(2)}
                      <br />
                      <small className="muted">{p.viewerPayoutRole === 'referrer' ? 'Referral share' : p.viewerPayoutRole === 'writer' ? 'Writer share' : p.viewerPayoutRole === 'referrer_writer' ? 'Full share' : 'No share'}</small>
                    </td>
                    <td>{p.payoutStatus || 'Unpaid'}{(Number(p.payoutAmount || 0) > 0) ? ` (Total $${Number(p.payoutAmount).toFixed(2)})` : ''}</td>
                    <td>{fmt(p.submittedAt)}</td>
                    <td>{fmt(p.approvedAt)}</td>
                    <td><a className="ghost" href={p.sopUrl} target="_blank" rel="noreferrer">Open SOP</a></td>
                    <td>{fmt(p.payoutPaidAt)}</td>
                  </tr>
                ))}
                {!(myPolicies || []).length ? <tr><td colSpan={8} className="muted">No policy submissions yet for your profile.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>This view is read-only. Status approvals/declines are controlled by Kimora/admin.</p>
        </section>
      )}
    </main>
  );
}
