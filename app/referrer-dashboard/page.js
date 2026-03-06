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
  const [auth, setAuth] = useState({ name: '', role: '' });
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, onTrack: 0, needsFollowup: 0, stalled24h: 0 });
  const [innerCircle, setInnerCircle] = useState([]);
  const [message, setMessage] = useState('');
  const [delegateByPerson, setDelegateByPerson] = useState({});

  const isAdmin = useMemo(() => normalize(auth.role) === 'admin', [auth.role]);

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
      setAuth((a) => ({ ...a, role: data?.viewer?.role || a.role }));
    } catch (e) {
      setMessage(`Load failed: ${e?.message || 'unknown_error'}`);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      if (saved?.name) setAuth({ name: saved.name, role: saved.role || '' });
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

    const next = { name: data.user.name, role: data.user.role || '' };
    setAuth(next);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setPassword('');
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAuth({ name: '', role: '' });
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
        <div className="claimsQuickTools" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="pill">Total: {metrics.total}</span>
          <span className="pill onpace">On Track: {metrics.onTrack}</span>
          <span className="pill">Needs Follow-up: {metrics.needsFollowup}</span>
          <span className="pill atrisk">Stalled 24h+: {metrics.stalled24h}</span>
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
                {isAdmin ? <th>Delegate</th> : null}
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((r) => (
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
              {!(rows || []).length ? <tr><td colSpan={isAdmin ? 8 : 7} className="muted">No referred people found yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
