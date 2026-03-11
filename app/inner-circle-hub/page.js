'use client';

import { useMemo, useState } from 'react';

const SESSION_KEY = 'inner_circle_hub_member_v1';

function readSession() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

function firstNameFromMember(member = {}) {
  const full = String(member?.applicantName || member?.email || '').trim();
  const first = full.split(/\s+/)[0] || 'Member';
  return first;
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
            <p className="muted" style={{ marginTop: -8 }}>Welcome, {firstNameFromMember(member)}</p>
          </div>
          <button type="button" className="ghost" onClick={logout}>Logout</button>
        </div>

        {!unlocked ? (
          <div className="panel" style={{ borderColor: '#f59e0b', background: '#451a03' }}>
            <h3 style={{ marginTop: 0 }}>Onboarding Locked</h3>
            <p style={{ margin: 0 }}>Your onboarding is not unlocked yet. Please complete contract + payment steps with your advisor.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#020617' }}>
              <strong style={{ color: '#fff', fontSize: 16 }}>Start Here (Phase 1)</strong>
              <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#cbd5e1', display: 'grid', gap: 4 }}>
                <li>Watch welcome + expectations (5 min)</li>
                <li>Understand what active means (daily execution standard)</li>
                <li>Set your 7-day production target</li>
                <li>Complete setup checklist: CRM, phone line, profile, scripts</li>
              </ul>
            </div>

            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
              <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                <strong style={{ color: '#fff' }}>Today’s Action Plan</strong>
                <p className="muted" style={{ marginBottom: 0 }}>1) Work new leads • 2) Follow up warm leads • 3) Book at least 1 conversation</p>
              </div>
              <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                <strong style={{ color: '#fff' }}>Daily Production Checklist</strong>
                <p className="muted" style={{ marginBottom: 0 }}>Calls/texts, follow-up count, one post, objection handling, CRM update.</p>
              </div>
              <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                <strong style={{ color: '#fff' }}>First 14 Days Fast Start</strong>
                <p className="muted" style={{ marginBottom: 0 }}>Do this in order: setup → script reps → first bookings → momentum sprint.</p>
              </div>
              <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                <strong style={{ color: '#fff' }}>What to Post Today</strong>
                <p className="muted" style={{ marginBottom: 0 }}>Daily prompt + CTA post + one credibility story to start conversations.</p>
              </div>
              <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                <strong style={{ color: '#fff' }}>What to Say</strong>
                <p className="muted" style={{ marginBottom: 0 }}>Openers, follow-up scripts, approved-not-booked script, and objections.</p>
              </div>
              <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                <strong style={{ color: '#fff' }}>Scoreboard</strong>
                <p className="muted" style={{ marginBottom: 0 }}>Track: leads worked, bookings, applications, paid bonuses, consistency streak.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
