'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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

function prefillFromSearch() {
  if (typeof window === 'undefined') return null;
  const sp = new URLSearchParams(window.location.search);
  const refCode = normalizeRef(sp.get('ref') || sp.get('refCode') || '');
  const firstName = String(sp.get('firstName') || '').trim();
  const lastName = String(sp.get('lastName') || '').trim();
  const name = String(sp.get('name') || `${firstName} ${lastName}` || '').trim();
  const email = String(sp.get('email') || '').trim();
  const phone = String(sp.get('phone') || '').trim();
  const state = String(sp.get('state') || '').trim().toUpperCase().slice(0, 2);
  const licensed = String(sp.get('licensed') || '').trim();
  const referredBy = String(sp.get('referredBy') || '').trim();

  const hasAny = Boolean(name || email || phone || state || licensed || referredBy || refCode);
  if (!hasAny) return null;

  return {
    refCode,
    applicantName: name,
    applicantEmail: email,
    applicantPhone: phone,
    applicantLicensedStatus: licensed,
    state,
    referredByNameRaw: referredBy
  };
}

function mapReferrerToUser(raw = '', users = [], refCode = '') {
  const input = String(raw || '').trim().toLowerCase();
  const byCode = String(refCode || '').replace(/[_-]+/g, ' ').trim().toLowerCase();
  if (!input && !byCode) return '';

  for (const u of users || []) {
    const n = String(u?.name || '').trim().toLowerCase();
    if (!n) continue;
    if (input && (n === input || n.includes(input) || input.includes(n))) return u.name;
    if (byCode && (n.includes(byCode) || byCode.includes(n.split(' ')[0] || ''))) return u.name;
  }
  return '';
}

export default function InnerCircleAppSubmitPage() {
  const [ref, setRef] = useState('');
  const [saved, setSaved] = useState('');
  const [contractStatus, setContractStatus] = useState({ loading: false, checkedEmail: '', signed: false, signedAt: '' });
  const [contractEmailBusy, setContractEmailBusy] = useState(false);
  const [contractEmailMsg, setContractEmailMsg] = useState('');
  const [contractLinkInfo, setContractLinkInfo] = useState({ loading: false, sentAt: '', requestedByName: '' });
  const [contractLastCheckedAt, setContractLastCheckedAt] = useState('');
  const [showSignedToast, setShowSignedToast] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const signedRef = useRef(false);

  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [users, setUsers] = useState([]);
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [form, setForm] = useState({
    applicantName: '',
    applicantEmail: '',
    applicantPhone: '',
    applicantLicensedStatus: '',
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
    const pre = prefillFromSearch();
    setPrefill(pre);
    setRef(pre?.refCode || '');

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

  async function loadContractLinkInfo(email = '') {
    const em = String(email || '').trim().toLowerCase();
    if (!em) {
      setContractLinkInfo({ loading: false, sentAt: '', requestedByName: '' });
      return;
    }

    setContractLinkInfo((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch(`/api/contract-signatures/send-link?email=${encodeURIComponent(em)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.row) {
        setContractLinkInfo({ loading: false, sentAt: '', requestedByName: '' });
        return;
      }
      setContractLinkInfo({ loading: false, sentAt: data.row.sentAt || '', requestedByName: data.row.requestedByName || '' });
    } catch {
      setContractLinkInfo({ loading: false, sentAt: '', requestedByName: '' });
    }
  }

  async function checkContractSignature(email = '') {
    const em = String(email || '').trim().toLowerCase();
    if (!em) {
      setContractStatus({ loading: false, checkedEmail: '', signed: false, signedAt: '' });
      return;
    }

    setContractStatus((s) => ({ ...s, loading: true, checkedEmail: em }));
    try {
      const res = await fetch(`/api/contract-signatures?email=${encodeURIComponent(em)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setContractStatus({ loading: false, checkedEmail: em, signed: false, signedAt: '' });
        setContractLastCheckedAt(new Date().toISOString());
        return;
      }
      setContractStatus({
        loading: false,
        checkedEmail: em,
        signed: Boolean(data?.signed),
        signedAt: data?.row?.signedAt || ''
      });
      setContractLastCheckedAt(new Date().toISOString());
    } catch {
      setContractStatus({ loading: false, checkedEmail: em, signed: false, signedAt: '' });
      setContractLastCheckedAt(new Date().toISOString());
    }
  }

  useEffect(() => {
    if (!prefill || prefillApplied) return;
    const mappedReferrer = mapReferrerToUser(prefill.referredByNameRaw, users, prefill.refCode);

    setForm((prev) => ({
      ...prev,
      applicantName: prefill.applicantName || prev.applicantName,
      applicantEmail: prefill.applicantEmail || prev.applicantEmail,
      applicantPhone: prefill.applicantPhone || prev.applicantPhone,
      applicantLicensedStatus: prefill.applicantLicensedStatus || prev.applicantLicensedStatus,
      state: prefill.state || prev.state,
      referredByName: mappedReferrer || prev.referredByName
    }));
    setPrefillApplied(true);
  }, [prefill, prefillApplied, users]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (form.applicantEmail.trim()) {
        checkContractSignature(form.applicantEmail);
        loadContractLinkInfo(form.applicantEmail);
      } else {
        setContractStatus({ loading: false, checkedEmail: '', signed: false, signedAt: '' });
        setContractLinkInfo({ loading: false, sentAt: '', requestedByName: '' });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [form.applicantEmail]);

  useEffect(() => {
    const email = String(form.applicantEmail || '').trim();
    if (!email || contractStatus.signed) return;

    const timer = setInterval(() => {
      checkContractSignature(email);
    }, 10 * 60 * 1000);

    return () => clearInterval(timer);
  }, [form.applicantEmail, contractStatus.signed]);

  useEffect(() => {
    const prev = signedRef.current;
    if (!prev && contractStatus.signed && contractStatus.checkedEmail) {
      setShowSignedToast(true);
      const t = setTimeout(() => setShowSignedToast(false), 4500);
      signedRef.current = contractStatus.signed;
      return () => clearTimeout(t);
    }
    signedRef.current = contractStatus.signed;
  }, [contractStatus.signed, contractStatus.checkedEmail]);

  const canSubmit = useMemo(() => {
    const writerOk = form.policyWriterName === 'Other'
      ? form.policyWriterOtherName.trim()
      : form.policyWriterName.trim();

    return (
      form.applicantName.trim() &&
      form.applicantEmail.trim() &&
      form.applicantPhone.trim() &&
      form.applicantLicensedStatus.trim() &&
      form.referredByName.trim() &&
      writerOk &&
      form.state.trim() &&
      form.monthlyPremium !== '' &&
      contractStatus.signed
    );
  }, [form, contractStatus.signed]);

  async function sendAgreementLinkEmail() {
    const applicantName = String(form.applicantName || '').trim();
    const applicantEmail = String(form.applicantEmail || '').trim();
    if (!applicantName || !applicantEmail) {
      setContractEmailMsg('Please enter applicant name and email first.');
      return;
    }

    setContractEmailBusy(true);
    setContractEmailMsg('');
    try {
      const res = await fetch('/api/contract-signatures/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName,
          applicantEmail,
          applicantPhone: form.applicantPhone,
          applicantState: form.state,
          requestedByName: session?.name || '',
          requestedByEmail: session?.email || ''
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setContractEmailMsg(`Could not send agreement email: ${data?.error || 'unknown_error'}`);
        return;
      }
      const sentAt = data?.sentAt || new Date().toISOString();
      setContractLinkInfo({ loading: false, sentAt, requestedByName: session?.name || '' });
      setContractEmailMsg('Agreement email sent successfully.');
    } catch {
      setContractEmailMsg('Could not send agreement email right now.');
    } finally {
      setContractEmailBusy(false);
    }
  }

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
      payoutAmount: 0,
      contractSignedAt: contractStatus.signedAt || new Date().toISOString(),
      contractSignatureVerified: Boolean(contractStatus.signed)
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
      applicantEmail: '',
      applicantPhone: '',
      applicantLicensedStatus: '',
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
      {showSignedToast ? (
        <div
          style={{
            position: 'fixed',
            right: 16,
            top: 16,
            zIndex: 70,
            background: '#16a34a',
            color: '#ffffff',
            padding: '10px 14px',
            borderRadius: 10,
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            fontWeight: 600
          }}
        >
          ✅ Contract signed — you can submit the application now.
        </div>
      ) : null}
      <div className="panel" style={{ maxWidth: 840 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>Policy Details</h3>
            <p className="muted" style={{ margin: 0 }}>Signed in as {session.name}</p>
          </div>
          <button type="button" className="ghost" onClick={logout}>Log Out</button>
        </div>
        {ref ? <p className="pill onpace">Referral code locked: {ref}</p> : null}
        {prefill ? <p className="pill">Prefilled from booked call — review and complete remaining fields.</p> : null}

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
            Applicant Email *
            <input
              type="email"
              value={form.applicantEmail}
              onChange={(e) => update('applicantEmail', e.target.value)}
              placeholder="applicant@email.com"
            />
          </label>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {contractStatus.loading ? <span className="pill">Checking contract signature…</span> : null}
            {!contractStatus.loading && form.applicantEmail && contractStatus.signed ? (
              <span className="pill onpace">Contract Signed ✅ {contractStatus.signedAt ? `(${new Date(contractStatus.signedAt).toLocaleDateString()})` : ''}</span>
            ) : null}
            {!contractStatus.loading && form.applicantEmail && !contractStatus.signed ? (
              <>
                <span className="pill atrisk">Contract Required Before Submit</span>
                <button type="button" className="ghost" onClick={sendAgreementLinkEmail} disabled={contractEmailBusy}>
                  {contractEmailBusy ? 'Sending Agreement…' : 'Send Agreement Link to Applicant'}
                </button>
                <button type="button" className="ghost" onClick={() => checkContractSignature(form.applicantEmail)}>
                  Refresh Signature Status
                </button>
                <a className="ghost" href="/contract-agreement" target="_blank" rel="noreferrer">Open Agreement / DocuSign</a>
              </>
            ) : null}
          </div>
          {contractEmailMsg ? <small className="muted" style={{ gridColumn: '1 / -1' }}>{contractEmailMsg}</small> : null}
          {contractLinkInfo.sentAt ? (
            <small className="muted" style={{ gridColumn: '1 / -1' }}>
              Agreement link last sent: {new Date(contractLinkInfo.sentAt).toLocaleString()}
              {contractLinkInfo.requestedByName ? ` by ${contractLinkInfo.requestedByName}` : ''}
            </small>
          ) : null}
          {contractLastCheckedAt ? (
            <small className="muted" style={{ gridColumn: '1 / -1' }}>
              Signature status last checked: {new Date(contractLastCheckedAt).toLocaleString()}
            </small>
          ) : null}

          <label>
            Applicant Phone *
            <input
              value={form.applicantPhone}
              onChange={(e) => update('applicantPhone', e.target.value)}
              placeholder="(555) 555-5555"
            />
          </label>

          <label>
            Licensed? *
            <select value={form.applicantLicensedStatus} onChange={(e) => update('applicantLicensedStatus', e.target.value)}>
              <option value="">Select status</option>
              <option value="Licensed">Licensed</option>
              <option value="Unlicensed">Unlicensed</option>
            </select>
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
            {!contractStatus.signed ? <small className="muted">Signature gate: applicant must complete ICA before submit.</small> : null}
          </div>
        </form>

        {saved ? <p className="green">{saved}</p> : null}
      </div>
    </main>
  );
}
