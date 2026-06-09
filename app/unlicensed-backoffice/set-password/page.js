'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function SetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState('loading'); // loading | ready | submitting | done | error
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setErr('No setup link token found. Please use the link from your email.'); return; }
    fetch(`/api/unlicensed-backoffice/auth/setup-password?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { setStatus('error'); setErr('This setup link is invalid or has expired. Contact support@thelegacylink.com for a new one.'); return; }
        setEmail(d.email || '');
        setStatus('ready');
      })
      .catch(() => { setStatus('error'); setErr('Unable to verify link. Check your connection and try again.'); });
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (password.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setErr('Passwords do not match.'); return; }
    setStatus('submitting');
    try {
      const res = await fetch('/api/unlicensed-backoffice/auth/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const msg = data.error === 'invalid_or_expired_token'
          ? 'This link has expired. Contact support@thelegacylink.com for a new one.'
          : data.error === 'password_too_short'
          ? 'Password must be at least 8 characters.'
          : 'Something went wrong. Please try again.';
        setErr(msg); setStatus('ready'); return;
      }
      // Auto-login if session was issued
      if (data.autoLogin && data.token) {
        try { localStorage.setItem('unlicensed_backoffice_token', data.token); } catch {}
        try { document.cookie = `unlicensed_bo_token=${data.token};path=/;max-age=2592000;SameSite=Lax`; } catch {}
      }
      setStatus('done');
      setTimeout(() => router.push('/unlicensed-backoffice'), 2000);
    } catch {
      setErr('Network error. Please try again.'); setStatus('ready');
    }
  }

  const iS = {
    width: '100%', padding: '14px 16px', borderRadius: 10,
    border: '1px solid #374151', background: '#020617', color: '#fff',
    fontSize: 15, boxSizing: 'border-box', outline: 'none',
  };

  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #15213f 0%, #070b14 55%)', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section style={{ width: 'min(480px, 95vw)', border: '1px solid #2A3142', borderRadius: 16, background: 'rgba(17,24,39,0.95)', overflow: 'hidden' }}>
        <div style={{ padding: '22px 26px', background: 'linear-gradient(120deg, #1D428A, #006BB6)', textAlign: 'center' }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 28, letterSpacing: 1 }}>THE LEGACY LINK</div>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>Create Your Back Office Password</p>
        </div>

        <div style={{ padding: '28px 26px' }}>
          {status === 'loading' && (
            <p style={{ color: '#94a3b8', textAlign: 'center' }}>Verifying your link…</p>
          )}

          {status === 'error' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
              <p style={{ color: '#fca5a5', fontSize: 14 }}>{err}</p>
            </div>
          )}

          {status === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>✅</div>
              <p style={{ color: '#86efac', fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Password set! Taking you to your back office…</p>
            </div>
          )}

          {(status === 'ready' || status === 'submitting') && (
            <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
              {email && (
                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#94a3b8' }}>
                  Setting password for: <strong style={{ color: '#e2e8f0' }}>{email}</strong>
                </div>
              )}
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    autoFocus
                    style={{ ...iS, paddingRight: 50 }}
                  />
                  <button type="button" onClick={() => setShow(v => !v)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>
                    {show ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                  Confirm Password
                </label>
                <input type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password" required style={iS} />
              </div>
              {err && <p style={{ color: '#fca5a5', fontSize: 13, margin: 0 }}>{err}</p>}
              <button type="submit" disabled={status === 'submitting'}
                style={{ padding: '14px', borderRadius: 10, border: 0, background: '#C8A96B', color: '#0B1020', fontWeight: 800, fontSize: 16, cursor: 'pointer', opacity: status === 'submitting' ? 0.6 : 1 }}>
                {status === 'submitting' ? 'Saving…' : 'Set Password & Enter Back Office →'}
              </button>
              <p style={{ textAlign: 'center', color: '#475569', fontSize: 12, margin: 0 }}>
                Questions? <a href="mailto:support@thelegacylink.com" style={{ color: '#60A5FA' }}>support@thelegacylink.com</a>
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordForm />
    </Suspense>
  );
}
