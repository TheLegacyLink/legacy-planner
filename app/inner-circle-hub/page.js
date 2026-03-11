'use client';

import { useMemo, useState } from 'react';

const SESSION_KEY = 'inner_circle_hub_member_v1';

function readSession() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

export default function InnerCircleHubPage() {
  const [member, setMember] = useState(() => readSession());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const unlocked = useMemo(() => Boolean(member?.active), [member]);

  async function login(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/inner-circle-hub-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'authenticate', email, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError('Invalid login. Check email/password or onboarding status.');
        return;
      }
      setMember(data.member);
      localStorage.setItem(SESSION_KEY, JSON.stringify(data.member));
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setMember(null);
    localStorage.removeItem(SESSION_KEY);
  }

  if (!member) {
    return (
      <main className="publicPage" style={{ minHeight: '100vh', background: 'radial-gradient(circle at top,#0b1326 0%,#020617 45%, #000 100%)', color: '#e5e7eb' }}>
        <div className="panel" style={{ maxWidth: 460, border: '1px solid #1f2937', background: '#020617' }}>
          <p style={{ margin: 0, color: '#93c5fd', fontWeight: 700 }}>THE LEGACY LINK</p>
          <h2 style={{ marginTop: 8, marginBottom: 6, color: '#fff' }}>Inner Circle Production Hub</h2>
          <p style={{ marginTop: 0, color: '#cbd5e1' }}>Member Login</p>

          <form onSubmit={login} className="settingsGrid" style={{ rowGap: 12 }}>
            <label style={{ color: '#e2e8f0' }}>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@email.com" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} />
            </label>
            <label style={{ color: '#e2e8f0' }}>
              Password
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} />
            </label>
            <button type="submit" className="publicPrimaryBtn" disabled={loading}>{loading ? 'Signing in...' : 'Enter Hub'}</button>
            {error ? <p className="red" style={{ marginTop: 4 }}>{error}</p> : null}
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="publicPage" style={{ minHeight: '100vh', background: '#020617', color: '#e5e7eb' }}>
      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #1f2937', background: '#030a17' }}>
        <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, color: '#93c5fd', fontWeight: 700 }}>THE LEGACY LINK</p>
            <h2 style={{ marginTop: 6, color: '#fff' }}>Inner Circle Production Hub</h2>
            <p className="muted" style={{ marginTop: -8 }}>Welcome, {member.applicantName || member.email}</p>
          </div>
          <button type="button" className="ghost" onClick={logout}>Logout</button>
        </div>

        {!unlocked ? (
          <div className="panel" style={{ borderColor: '#f59e0b', background: '#451a03' }}>
            <h3 style={{ marginTop: 0 }}>Onboarding Locked</h3>
            <p style={{ margin: 0 }}>Your onboarding is not unlocked yet. Please complete contract + payment steps with your advisor.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            {[
              'Start Here',
              'Today’s Action Plan',
              'Daily Production Checklist',
              'First 14 Days Fast Start',
              'What to Post Today',
              'What to Say',
              'Scoreboard'
            ].map((title) => (
              <div key={title} style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                <strong style={{ color: '#fff' }}>{title}</strong>
                <p className="muted" style={{ marginBottom: 0 }}>Phase 1 content slot ready.</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
