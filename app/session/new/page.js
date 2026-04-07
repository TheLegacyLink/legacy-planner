'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const SESSION_KEY = 'legacy_lead_marketplace_user_v1';

const TESTIMONIALS = [
  {
    quote: 'The lead quality and speed changed our close rate in under 30 days.',
    name: 'Insurance Agency Owner'
  },
  {
    quote: 'Sponsor Leads gave us people already open to team growth conversations.',
    name: 'Regional Team Builder'
  },
  {
    quote: 'Advanced system design + stronger appointment flow from day one.',
    name: 'Tray Honeycutt'
  }
];

function clean(v = '') {
  return String(v || '').trim();
}

export default function LinkLeadsSignInPage() {
  const router = useRouter();
  const [emailOrName, setEmailOrName] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [nextUrl, setNextUrl] = useState('/linkleads/order-builder');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setNextUrl(clean(params.get('next') || '/linkleads/order-builder'));
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    if (!agree) {
      setError('Please agree to Terms & Privacy to continue.');
      return;
    }

    if (!clean(emailOrName) || !clean(password)) {
      setError('Please enter your login credentials.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/linkleads-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: emailOrName, name: emailOrName, password })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok || !data?.user?.name) {
        setError('Invalid login. Please check your email/name and password.');
        return;
      }

      const user = {
        name: data.user.name,
        email: data.user.email || '',
        role: data.user.role || 'buyer'
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
      router.push(nextUrl || '/linkleads/order-builder');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="publicPage"
      style={{
        minHeight: '100vh',
        padding: 16,
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)'
      }}
    >
      <div
        style={{
          width: 'min(1080px, 98vw)',
          background: '#fff',
          border: '1px solid #dbe5f5',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 18px 45px rgba(15,23,42,0.08)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))'
        }}
      >
        <section style={{ padding: 22, borderRight: '1px solid #e2e8f0' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="pill onpace" style={{ width: 'fit-content' }}>Link Leads • Sign In</div>
            <div style={{ border: '1px solid #f59e0b', background: '#fffbeb', color: '#92400e', borderRadius: 10, padding: '8px 10px', fontSize: 13, fontWeight: 700 }}>
              Lead purchases are restricted to licensed agents only. Complete NPN intake first if you are not yet onboarded.
            </div>
            <h1 style={{ margin: 0 }}>Welcome Back</h1>
            <p className="muted" style={{ margin: 0 }}>
              Sign in to access inventory, complete checkout, and track your lead purchases and spend.
            </p>
          </div>

          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              Email or Full Name
              <input
                placeholder="you@example.com"
                value={emailOrName}
                onChange={(e) => setEmailOrName(e.target.value)}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              Password
              <input
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
              <small className="muted">
                I agree to the <a href="/welcome/terms">Terms & Conditions</a>, <a href="/welcome/privacy">Privacy Policy</a>, and <a href="/welcome/lead-replacement-policy">Lead Replacement Policy</a>.
              </small>
            </label>

            <button type="submit" className="publicPrimaryBtn publicBtnBlock" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          {error ? <p className="red" style={{ marginTop: 10 }}>{error}</p> : null}

          <p className="muted" style={{ marginTop: 12 }}>
            Not set up yet? <a href={`/start/licensed?next=${encodeURIComponent(nextUrl || '/lead-marketplace')}`}>Complete Licensed Agent Sign-Up (NPN required)</a>
          </p>

          <div style={{ borderTop: '1px solid #dbe5f5', marginTop: 12, paddingTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <small className="muted">© 2026 The Legacy Link. All rights reserved.</small>
            <small><a href="/welcome/privacy">Privacy</a></small>
            <small><a href="/welcome/terms">Terms & Conditions</a></small>
          </div>
        </section>

        <section
          style={{
            padding: 22,
            background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
            color: '#fff',
            display: 'grid',
            gap: 12,
            alignContent: 'center'
          }}
        >
          <h2 style={{ margin: 0 }}>Get Qualified Leads And Close Deals Faster</h2>
          <p style={{ margin: 0, color: '#cbd5e1' }}>
            Join top agents using Link Leads to connect with real clients and grow commissions every week.
          </p>

          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <div className="pill" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>Real-Time Lead Delivery</div>
            <div className="pill" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>Volume-Based Pricing</div>
            <div className="pill" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>Sponsor Leads Available ($25 • min 15)</div>
          </div>

          <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
            {TESTIMONIALS.map((t) => (
              <div key={t.quote} style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: 10, background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ color: '#fbbf24', marginBottom: 4 }}>★★★★★</div>
                <p style={{ margin: 0, fontStyle: 'italic' }}>“{t.quote}”</p>
                <small style={{ color: '#cbd5e1' }}>— {t.name}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
