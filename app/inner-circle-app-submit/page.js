'use client';

import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'legacy-inner-circle-policy-apps-v1';
const SESSION_KEY = 'legacy-inner-circle-submit-session-v1';
const FIXED_CARRIER = 'F&G';
const FIXED_PRODUCT = 'IUL Pathsetter';

function normalizeRef(ref = '') {
  const cleaned = String(ref).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (cleaned === 'latricia_wright') return 'leticia_wright';
  return cleaned;
}

function normalizePremiumInput(v = '') {
  const raw = String(v || '').replace(/[^0-9.]/g, '');
  if (!raw) return '';

  const [wholeRaw, ...rest] = raw.split('.');
  const whole = wholeRaw || '0';
  const decimal = rest.join('').slice(0, 2);
  const rebuilt = decimal ? `${whole}.${decimal}` : whole;

  const n = Number(rebuilt);
  if (Number.isNaN(n)) return '';

  // Hard cap requested by Kimora.
  if (n > 5000) return '5000';
  return rebuilt;
}

export default function InnerCircleAppSubmitPage() {
  const [ref, setRef] = useState('');
  const [saved, setSaved] = useState('');

  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [users, setUsers] = useState([]);
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [form, setForm] = useState({
    applicantName: '',
    referredByName: '',
    policyWriterName: '',
    policyWriterOtherName: '',
    state: '',
    policyNumber: '',
    monthlyPremium: '',
    carrier: FIXED_CARRIER,
    productName: FIXED_PRODUCT,
    status: 'Submitted'
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    setRef(normalizeRef(sp.get('ref') || ''));

    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.name) setSession(parsed);
      }
    } catch {
      // ignore
    }

    async function loadUsers() {
      try {
        const res = await fetch('/api/inner-circle-auth', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok && Array.isArray(data.users)) {
          setUsers(data.users);
          if (!loginName && data.users[0]?.name) setLoginName(data.users[0].name);
        }
      } finally {
        setAuthLoading(false);
      }
    }

    loadUsers();
  }, []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit = useMemo(() => {
    const writerOk = form.policyWriterName === 'Other'
      ? form.policyWriterOtherName.trim()
      : form.policyWriterName.trim();

    return (
      form.applicantName.trim() &&
      form.referredByName.trim() &&
      writerOk &&
      form.state.trim() &&
      form.monthlyPremium !== ''
    );
  }, [form]);

  async function login(e) {
    e.preventDefault();
    setLoginError('');
    setLoginBusy(true);
    try {
      const res = await fetch('/api/inner-circle-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: loginName, password: loginPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.user) {
        setLoginError('Invalid login. Please check your password.');
        return;
      }

      setSession(data.user);
      localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
      setLoginPassword('');
    } catch {
      setLoginError('Login failed. Please retry.');
    } finally {
      setLoginBusy(false);
    }
  }

  function logout() {
    setSession(null);
    if (typeof window !== 'undefined') localStorage.removeItem(SESSION_KEY);
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || !session?.name) return;

    const effectivePolicyWriter = form.policyWriterName === 'Other'
      ? form.policyWriterOtherName.trim()
      : form.policyWriterName;

    const record = {
      id: `app_${Date.now()}`,
      ...form,
      policyWriterName: effectivePolicyWriter,
      carrier: FIXED_CARRIER,
      productName: FIXED_PRODUCT,
      submittedBy: session.name,
      submittedByRole: session.role || 'submitter',
      refCode: ref,
      submittedAt: new Date().toISOString(),
      payoutStatus: 'Unpaid',
      payoutAmount: 0
    };

    if (typeof window !== 'undefined') {
      let list = [];
      try {
        list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      } catch {
        list = [];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...list]));
    }

    try {
      await fetch('/api/policy-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'upsert', record })
      });
    } catch {
      // non-blocking: keep local backup
    }

    setSaved('Application submitted successfully.');
    setForm({
      applicantName: '',
      referredByName: '',
      policyWriterName: '',
      policyWriterOtherName: '',
      state: '',
      policyNumber: '',
      monthlyPremium: '',
      carrier: FIXED_CARRIER,
      productName: FIXED_PRODUCT,
      status: 'Submitted'
    });
  };

  if (authLoading) {
    return (
      <main className="publicPage">
        <div className="panel" style={{ maxWidth: 480 }}>
          <h3 style={{ marginTop: 0 }}>Loading...</h3>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="publicPage">
        <div className="panel" style={{ maxWidth: 480 }}>
          <h3 style={{ marginTop: 0 }}>Inner Circle Login</h3>
          <p className="muted" style={{ marginTop: -2 }}>Use your individual password to access policy submission.</p>

          <form className="settingsGrid" onSubmit={login}>
            <label>
              Name
              <select value={loginName} onChange={(e) => setLoginName(e.target.value)}>
                {users.map((u) => (
                  <option key={u.name} value={u.name}>{u.name}</option>
                ))}
              </select>
            </label>
            <label>
              Password
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            </label>
            <div className="rowActions" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={loginBusy}>{loginBusy ? 'Signing in...' : 'Sign In'}</button>
            </div>
            {loginError ? <p className="red">{loginError}</p> : null}
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 840 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>Policy Details</h3>
            <p className="muted" style={{ margin: 0 }}>Signed in as {session.name}</p>
          </div>
          <button type="button" className="ghost" onClick={logout}>Log Out</button>
        </div>
        {ref ? <p className="pill onpace">Referral code locked: {ref}</p> : null}

        <form className="settingsGrid" onSubmit={submit}>
          <label>
            Client Name *
            <input
              value={form.applicantName}
              onChange={(e) => update('applicantName', e.target.value)}
              placeholder="Enter client's full name"
            />
          </label>

          <label>
            Referred By *
            <select value={form.referredByName} onChange={(e) => update('referredByName', e.target.value)}>
              <option value="">Select inner circle agent</option>
              {users.map((u) => (
                <option key={`ref-${u.name}`} value={u.name}>{u.name}</option>
              ))}
            </select>
          </label>

          <label>
            Policy Written By *
            <select value={form.policyWriterName} onChange={(e) => update('policyWriterName', e.target.value)}>
              <option value="">Select policy writer</option>
              {users.map((u) => (
                <option key={`writer-${u.name}`} value={u.name}>{u.name}</option>
              ))}
              <option value="Other">Other</option>
            </select>
          </label>

          {form.policyWriterName === 'Other' ? (
            <label>
              Policy Writer Full Name *
              <input
                value={form.policyWriterOtherName}
                onChange={(e) => update('policyWriterOtherName', e.target.value)}
                placeholder="Enter full name"
              />
            </label>
          ) : null}

          <label>
            State *
            <input
              value={form.state}
              onChange={(e) => update('state', e.target.value.toUpperCase())}
              placeholder="e.g., FL"
              maxLength={2}
            />
          </label>

          <label>
            Carrier *
            <input value={FIXED_CARRIER} disabled readOnly />
          </label>

          <label>
            Product *
            <input value={FIXED_PRODUCT} disabled readOnly />
          </label>

          <label>
            Policy Number (Optional)
            <input
              value={form.policyNumber}
              onChange={(e) => update('policyNumber', e.target.value)}
              placeholder="Enter policy number if available"
            />
          </label>

          <label>
            Monthly Premium *
            <input
              type="number"
              min="0"
              max="5000"
              step="0.01"
              value={form.monthlyPremium}
              onChange={(e) => update('monthlyPremium', normalizePremiumInput(e.target.value))}
              onBlur={() => {
                const n = Number(form.monthlyPremium || 0);
                if (!Number.isNaN(n) && form.monthlyPremium !== '') {
                  update('monthlyPremium', Math.min(5000, n).toFixed(2));
                }
              }}
              placeholder="0.00"
            />
          </label>

          <div className="rowActions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" disabled={!canSubmit}>Submit Application</button>
          </div>
        </form>

        {saved ? <p className="green">{saved}</p> : null}
      </div>
    </main>
  );
}
