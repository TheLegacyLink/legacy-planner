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
  const [innerCircle, setInnerCircle] = useState([]);
  const [message, setMessage] = useState('');
  const [delegateByPerson, setDelegateByPerson] = useState({});
  const [showStalledOnly, setShowStalledOnly] = useState(false);

  const isAdmin = useMemo(() => normalize(auth.role) === 'admin', [auth.role]);
  const filteredRows = useMemo(() => (showStalledOnly ? rows.filter((r) => r.stalled24h) : rows), [rows, showStalledOnly]);

  async function loadData(silent = false) {
    if (!auth.name) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/referrer-dashboard?viewerName=${encodeURIComponent(auth.name)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'load_failed');
      setRows(data.rows || []);
      setMetrics(data.metrics || { total: 0, onTrack: 0, needsFollowup: 0, stalled24h: 0 });
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

  function sendReminderEmail(row) {
    const to = clean(row?.email);
    if (!to) {
      setMessage('No email on file for this person.');
      return;
    }
    const subject = encodeURIComponent('Quick follow-up on your Legacy Link progress');
    const body = encodeURIComponent([
      `Hi ${row?.name || ''},`,
      '',
      'Just checking in to help you keep momentum with your onboarding progress.',
      `Current stage I see: ${row?.stage || 'In Progress'}.`,
      '',
      'Reply here if you need help and I will support you step-by-step.',
      '',
      '— The Legacy Link Team'
    ].join('\n'));
    const cc = auth?.email ? `&cc=${encodeURIComponent(auth.email)}` : '';
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}${cc}`;
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
          <span className="pill">Total: {metrics.total}</span>
          <span className="pill onpace">On Track: {metrics.onTrack}</span>
          <span className="pill">Needs Follow-up: {metrics.needsFollowup}</span>
          <span className="pill atrisk">Stalled 24h+: {metrics.stalled24h}</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={showStalledOnly} onChange={(e) => setShowStalledOnly(e.target.checked)} />
            Show stalled only
          </label>
        </div>
        {message ? <p className="muted" style={{ marginTop: 8 }}>{message}</p> : null}
      </section>

      <section className="claimsCards">
        {loading ? <p>Loading...</p> : null}
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Licensed</th>
                <th>Stage</th>
                <th>Progress</th>
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
                  <td>{r.stage || '—'}</td>
                  <td>{r.completedSteps}/{r.totalSteps} ({r.progressPct}%)</td>
                  <td>{r.policyStatus || '—'}{r.stalled24h ? ' (stalled 24h+)' : ''}</td>
                  <td><span className="pill" style={badgeStyle(r.bucket)}>{r.bucket === 'on_track' ? 'On Track' : r.bucket === 'stalled' ? 'Stalled' : 'Needs Follow-up'}</span></td>
                  <td>{fmt(r.lastActivityAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <a className="ghost" href={r.sopUrl} target="_blank" rel="noreferrer">Open SOP</a>
                      <button type="button" className="ghost" onClick={() => sendReminderEmail(r)}>Send Reminder</button>
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
              {!(filteredRows || []).length ? <tr><td colSpan={isAdmin ? 9 : 8} className="muted">No referred people found yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
