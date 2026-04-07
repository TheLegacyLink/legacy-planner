'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const TOKEN_KEY = 'start_portal_token_v1';
const PROFILE_KEY = 'start_portal_profile_v1';

function clean(v = '') { return String(v || '').trim(); }
function isEmail(v = '') { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v)); }

// ─── ICA Contract text ────────────────────────────────────────────────────
// Replace this placeholder with the full ICA text.
const CONTRACT_TEXT = `INDEPENDENT CONTRACTOR AGREEMENT

This Independent Contractor Agreement ("Agreement") is entered into between The Legacy Link ("Company") and the undersigned individual ("Contractor").

1. INDEPENDENT CONTRACTOR STATUS
Contractor is an independent contractor and not an employee, agent, joint venturer, or partner of Company.

2. SERVICES
Contractor agrees to provide insurance sales and related services as directed by Company.

3. COMPENSATION
Contractor will be compensated pursuant to the compensation schedule provided by Company, which may be updated from time to time.

4. CONFIDENTIALITY
Contractor agrees to keep all client and business information confidential and not to disclose such information to any third party.

5. TERM AND TERMINATION
This Agreement is at-will and may be terminated by either party at any time with or without cause.

6. COMPLIANCE
Contractor agrees to comply with all applicable laws, regulations, and Company policies.

7. ENTIRE AGREEMENT
This Agreement constitutes the entire agreement between the parties with respect to its subject matter.

By signing below, Contractor acknowledges reading, understanding, and agreeing to the terms of this Agreement.`;

const bg = {
  minHeight: '100vh',
  background: 'radial-gradient(1100px 520px at 8% -8%, rgba(59,130,246,.22), transparent 58%), radial-gradient(900px 480px at 95% 4%, rgba(200,169,107,.15), transparent 55%), #020617',
  padding: '16px',
  color: '#F8FAFC',
  display: 'grid',
  placeItems: 'center'
};

const card = {
  width: 'min(560px, 98vw)',
  background: 'linear-gradient(180deg,#081124 0%,#070d1c 100%)',
  border: '1px solid #1F2A44',
  borderRadius: 18,
  padding: 28,
  display: 'grid',
  gap: 16
};

const labelStyle = { display: 'grid', gap: 6, fontSize: 14, color: '#CBD5E1', fontWeight: 600 };
const inputStyle = {
  background: '#0B1220', border: '1px solid #334155', borderRadius: 10,
  padding: '10px 14px', color: '#F8FAFC', fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box'
};
const btnPrimary = {
  background: '#1651AE', border: 'none', borderRadius: 10, color: '#fff',
  padding: '12px 20px', fontWeight: 700, fontSize: 15, cursor: 'pointer', width: '100%'
};
const btnSecondary = {
  background: 'transparent', border: '1px solid #334155', borderRadius: 10, color: '#94A3B8',
  padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer', width: '100%'
};
const errStyle = { color: '#F87171', fontSize: 13, margin: 0 };
const mutedStyle = { color: '#64748B', fontSize: 13, margin: 0 };

// ─── Stages ───────────────────────────────────────────────────────────────
// 'email' → 'otp' → 'contract' → 'done'

export default function StartPortalPage() {
  const router = useRouter();
  const [stage, setStage] = useState('loading');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [signedAt, setSignedAt] = useState('');

  // Typed-name sig state
  const [typedName, setTypedName] = useState('');
  const [agreed, setAgreed] = useState(false);

  // Restore session on mount
  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : '';
    if (!t) { setStage('email'); return; }
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/start-auth/me', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!mounted || !res.ok || !data?.ok) { setStage('email'); return; }
        const p = data.profile;
        setToken(t);
        setProfile(p);
        // Check if contract is already signed
        const cr = await fetch('/api/esign-contract', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' });
        const cd = await cr.json().catch(() => ({}));
        if (cd?.signed) {
          redirectToBackoffice(p);
        } else {
          setStage('contract');
        }
      } catch { setStage('email'); }
    })();
    return () => { mounted = false; };
  }, []);

  function redirectToBackoffice(p = null) {
    const prof = p || profile;
    const track = clean(prof?.trackType || 'unlicensed');
    if (track === 'licensed') {
      router.push('/licensed-backoffice');
    } else {
      router.push('/unlicensed-backoffice');
    }
  }

  async function requestCode() {
    setError(''); setNotice('');
    const e = clean(email).toLowerCase();
    if (!isEmail(e)) { setError('Enter a valid email address.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/start-auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        const msg = data?.error === 'not_found'
          ? 'No account found for that email. Complete your intake first at innercirclelink.com/start/licensed or /start/unlicensed.'
          : (data?.error || 'Unable to send code. Try again.');
        setError(msg);
        return;
      }
      setNotice('Code sent! Check your email (including spam).');
      setStage('otp');
    } finally { setBusy(false); }
  }

  async function verifyOtp() {
    setError(''); setNotice('');
    const e = clean(email).toLowerCase();
    const c = clean(otp).replace(/\s+/g, '');
    if (!c || c.length < 6) { setError('Enter the 6-digit code.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/start-auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, code: c })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.token) {
        setError(data?.error === 'code_expired' ? 'Code expired. Request a new one.' : 'Invalid code. Try again.');
        return;
      }
      if (typeof window !== 'undefined') window.localStorage.setItem(TOKEN_KEY, data.token);
      if (typeof window !== 'undefined') window.localStorage.setItem(PROFILE_KEY, JSON.stringify(data.profile));
      setToken(data.token);
      setProfile(data.profile);
      // Check contract status
      const cr = await fetch('/api/esign-contract', { headers: { Authorization: `Bearer ${data.token}` }, cache: 'no-store' });
      const cd = await cr.json().catch(() => ({}));
      if (cd?.signed) {
        redirectToBackoffice(data.profile);
      } else {
        setStage('contract');
      }
    } finally { setBusy(false); }
  }

  async function submitSignature() {
    setError(''); setNotice('');
    const typed = clean(typedName);
    if (!typed) { setError('Type your full legal name to sign.'); return; }
    if (!agreed) { setError('You must check the box to confirm your agreement.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/esign-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'candidate_sign', signatureType: 'typed', typedName: typed })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError('Signature failed. Try again or contact support@thelegacylink.com.');
        return;
      }
      setSignedAt(data.signedAt || new Date().toISOString());
      setStage('done');
      setTimeout(() => redirectToBackoffice(), 2400);
    } finally { setBusy(false); }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (stage === 'loading') {
    return (
      <main style={bg}>
        <div style={card}>
          <p style={mutedStyle}>Loading…</p>
        </div>
      </main>
    );
  }

  if (stage === 'done') {
    return (
      <main style={bg}>
        <div style={{ ...card, textAlign: 'center', gap: 12 }}>
          <div style={{ fontSize: 42 }}>✅</div>
          <h2 style={{ margin: 0, fontSize: 26 }}>Agreement Signed</h2>
          <p style={{ ...mutedStyle, fontSize: 14 }}>
            Your signature has been recorded. Redirecting to your back office…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={bg}>
      <div style={card}>

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.1em', color: '#93C5FD', textTransform: 'uppercase', marginBottom: 4 }}>The Legacy Link</div>
          <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.2 }}>
            {stage === 'email' && 'Back Office Access'}
            {stage === 'otp' && 'Enter Your Code'}
            {stage === 'contract' && 'Independent Contractor Agreement'}
          </h1>
          <p style={{ ...mutedStyle, marginTop: 6 }}>
            {stage === 'email' && 'Enter your email to receive a one-time login code.'}
            {stage === 'otp' && `We sent a 6-digit code to ${clean(email)}`}
            {stage === 'contract' && 'Read and sign the agreement below to access your back office.'}
          </p>
        </div>

        {/* ── STAGE: EMAIL ── */}
        {stage === 'email' && (
          <>
            <label style={labelStyle}>
              Email Address
              <input
                style={inputStyle}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && requestCode()}
                autoFocus
              />
            </label>
            {notice && <p style={{ ...mutedStyle, color: '#86EFAC' }}>{notice}</p>}
            {error && <p style={errStyle}>{error}</p>}
            <button style={btnPrimary} onClick={requestCode} disabled={busy}>
              {busy ? 'Sending…' : 'Send Login Code'}
            </button>
            <p style={{ ...mutedStyle, textAlign: 'center' }}>
              Not registered yet?{' '}
              <a href="/start/licensed" style={{ color: '#60A5FA' }}>Licensed Agent Sign-Up</a>
              {' '}or{' '}
              <a href="/start/unlicensed" style={{ color: '#60A5FA' }}>Unlicensed Sign-Up</a>
            </p>
          </>
        )}

        {/* ── STAGE: OTP ── */}
        {stage === 'otp' && (
          <>
            <label style={labelStyle}>
              6-Digit Code
              <input
                style={{ ...inputStyle, fontSize: 24, letterSpacing: 6, textAlign: 'center' }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && verifyOtp()}
                autoFocus
              />
            </label>
            {notice && <p style={{ ...mutedStyle, color: '#86EFAC' }}>{notice}</p>}
            {error && <p style={errStyle}>{error}</p>}
            <button style={btnPrimary} onClick={verifyOtp} disabled={busy}>
              {busy ? 'Verifying…' : 'Verify Code'}
            </button>
            <button style={btnSecondary} onClick={() => { setStage('email'); setOtp(''); setError(''); setNotice(''); }}>
              ← Use a different email
            </button>
            <p style={{ ...mutedStyle, textAlign: 'center' }}>
              Didn't get the code?{' '}
              <span
                style={{ color: '#60A5FA', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => { setStage('email'); setOtp(''); setError(''); setNotice(''); }}
              >
                Resend
              </span>
            </p>
          </>
        )}

        {/* ── STAGE: CONTRACT ── */}
        {stage === 'contract' && (
          <>
            {profile?.name && (
              <p style={{ margin: 0, color: '#94A3B8', fontSize: 13 }}>
                Signing as: <strong style={{ color: '#F8FAFC' }}>{profile.name}</strong>
              </p>
            )}

            {/* Contract scroll box */}
            <div style={{
              background: '#0A1528',
              border: '1px solid #1E3A5F',
              borderRadius: 10,
              padding: '14px 16px',
              maxHeight: 280,
              overflowY: 'auto',
              fontSize: 13,
              lineHeight: 1.7,
              color: '#CBD5E1',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace'
            }}>
              {CONTRACT_TEXT}
            </div>

            {/* Typed name sig */}
            <label style={labelStyle}>
              Type your full legal name to sign
              <input
                style={inputStyle}
                type="text"
                placeholder="Full Legal Name"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
              />
            </label>

            {/* Agreement checkbox */}
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.5 }}>
                I have read and agree to the Independent Contractor Agreement above. I understand this is a legally binding e-signature.
              </span>
            </label>

            {error && <p style={errStyle}>{error}</p>}

            <button style={btnPrimary} onClick={submitSignature} disabled={busy}>
              {busy ? 'Submitting…' : '✍️ Sign & Continue to Back Office'}
            </button>

            <p style={{ ...mutedStyle, textAlign: 'center', fontSize: 12 }}>
              Questions? Contact <a href="mailto:support@thelegacylink.com" style={{ color: '#60A5FA' }}>support@thelegacylink.com</a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
