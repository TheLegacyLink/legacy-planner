'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// ─── Base44 Redirect Gate ─────────────────────────────────────────────────────
// If SSO_MODE is active, redirect everyone to Base44 for login.
// Pass ?bypass=1 or ?sso=1 to skip the redirect (for internal/contract flows).
function SsoRedirectGate({ children }) {
  const params = useSearchParams();
  const bypass = params.get('bypass') || params.get('sso') || params.get('error');
  const base44Url = process.env.NEXT_PUBLIC_BASE44_LOGIN_URL;

  useEffect(() => {
    if (!bypass && base44Url) {
      window.location.replace(base44Url);
    }
  }, [bypass, base44Url]);

  if (!bypass && base44Url) {
    return (
      <main style={{
        minHeight: '100vh', display: 'grid', placeItems: 'center',
        background: '#020617', color: '#F8FAFC', fontFamily: 'Arial, Helvetica, sans-serif'
      }}>
        <p style={{ color: '#CBD5E1', fontSize: 14 }}>Redirecting to Legacy Link Hub…</p>
      </main>
    );
  }

  return children;
}

const TOKEN_KEY = 'start_portal_token_v1';
const PROFILE_KEY = 'start_portal_profile_v1';

function clean(v = '') { return String(v || '').trim(); }
function isEmail(v = '') { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v)); }

// ─── ICA Contract text ────────────────────────────────────────────────────
const CONTRACT_TEXT = `INDEPENDENT CONTRACTOR AGREEMENT (V3)
THE LEGACY LINK / INVESTALINK LLC

This Independent Contractor Agreement ("Agreement") is entered into by and between The Legacy Link, a division of Investalink LLC ("Agency" or "Company"), and the undersigned independent agent ("Agent").

Effective Date: The latest date signed below.

0. DEFINITIONS
"Agency/Company" means The Legacy Link / Investalink LLC.
"Agent" means the independent contractor who signs this Agreement.
"Active Agent" means Agent in good standing, compliant, and not suspended/terminated.
"Issued Policy" means a policy accepted by carrier and in-force.
"Chargeback" means reversal/reduction of paid commission due to lapse/cancel/rescission.
"Compensation Schedule" means the current payout schedule in Exhibit A (as updated in writing by Agency).
"JumpStart" means Agency business-advance/payout model; not guaranteed income.
"Sponsorship Policy" means a policy initially funded under the Agency sponsorship structure.

1. NATURE OF RELATIONSHIP

1.1 Independent Contractor Status
Agent is an independent contractor and not an employee. Nothing in this Agreement creates an employer-employee relationship, partnership, or joint venture.

1.2 Non-Captive Status
Agent may contract with other agencies/carriers, provided Agent does not misuse Agency confidential/proprietary information.

1.3 Agent Responsibilities
Agent is responsible for licensing, taxes, business expenses, and legal/regulatory compliance.

2. LICENSING, COMPLIANCE, AND E&O

2.1 Licensing
Agent must maintain all required state insurance licenses.

2.2 Compliance
Agent must follow all state/federal insurance laws, carrier rules, and ethical sales standards.

2.3 E&O
Agent must maintain active E&O coverage.

2.4 E&O Limitations
If Agency provides E&O, coverage applies only to policies written within Agency hierarchy and terminates upon resignation/termination.

3. COMPENSATION, PAYMENTS, AND CHARGEBACKS

3.1 Commission Flow
Commissions are paid through Agency hierarchy.

3.2 Overrides
Overrides are paid under the active Compensation Schedule (Exhibit A).

3.3 Transfer Economics
Transfer/upline economics are governed by approved written transfer terms and the active Compensation Schedule.

3.4 Chargebacks
Chargebacks are Agent responsibility, with proportional recoupment as outlined in Exhibit A.

3.5 Deduction Authorization
Agent authorizes Agency to deduct owed balances from future commissions/bonuses.

3.6 Variability
Compensation may vary by carrier/product/regulatory requirements.

3.7 No Earnings Guarantee
Agency does not guarantee leads, sales, commissions, bonuses, or income.

4. SPONSORSHIP PROGRAM TERMS

4.1 Sponsorship Acknowledgment
Agent acknowledges that sponsorship-program business may include split/holdback/release rules under Exhibit A.

4.1A Sponsorship Policy Is Optional
Agent is not required to accept a sponsorship policy to remain part of the Agency. Participation in a sponsorship policy track is optional and based on Agent election and Agency eligibility criteria.

4.2 No Upfront Cost (Initial Sponsorship Window)
For eligible sponsorship participants who elect the sponsorship policy track, Agency may cover initial premium obligations during the sponsorship window.

4.2A Program Benefit Clarification
Agency may use sponsorship-track participation to provide operational support benefits (including lead flow and CRM/system enablement) at no upfront cost during the applicable sponsorship window, subject to Agency rules and compliance status.

4.3 Post-Sponsorship Responsibility (14-Month Transition)
At month fourteen (14) from policy start, Agent is responsible for taking over policy premium payments unless a separate written arrangement is approved by Agency.

4.4 If Agent Does Not Assume the Policy at 14 Months
If Agent does not assume payment responsibility at month 14, Agent agrees one of the following outcomes applies:

Option A: Ownership/beneficiary conversion by written consent. Agency may become/remain policy owner and designate beneficiary structure under Agency rules, and Agency may continue premium payments. Agent expressly acknowledges and agrees this option requires written consent and processing compliance.

Option B: Policy termination. Policy may be canceled/terminated, which may result in loss of death benefit and potential loss/reduction of cash value subject to carrier terms.

4.5 Community Service / Program Participation
Agent acknowledges sponsorship participation includes performance expectations such as community service completion, training attendance, and program engagement requirements defined by Agency SOP and compliance policy.

5. TAX RESPONSIBILITY AND EXECUTIVE BONUS TREATMENT

5.1 Tax Responsibility
Agent is solely responsible for all tax reporting and payment obligations related to commissions, bonuses, overrides, and any sponsored benefit treatment.

5.2 Executive Bonus / Economic Benefit Acknowledgment
Where sponsorship support or executive-bonus-style funding is provided, Agent acknowledges such amounts may create reportable income depending on tax rules and total annual earnings.

5.3 No Tax Advice
Agency does not provide legal or tax advice. Agent agrees to consult a qualified tax professional.

5.4 Information Reporting Clarification
Agent understands IRS and state reporting thresholds and rules can change and may apply at amounts lower than expected; reporting obligations may still exist even when no specific form threshold is triggered.

6. LEAD OWNERSHIP AND USE

6.1 Agency leads remain Agency property.
6.2 Leads may not be sold, transferred, or used outside Agency authorization.
6.3 Upon termination, Agent must cease contact/use of Agency leads unless required by law.

7. TECHNOLOGY AND PROPERTY
Agency CRM, numbers, emails, automations, scripts, and systems remain Agency property. Access may be revoked at any time.

8. PROGRAM PARTICIPATION TERMS

8.1 Agent may participate in lead/JumpStart programs under Exhibit A.
8.2 Agency may adjust pricing/allocations due to operational costs.
8.3 JumpStart tiers are business-model payouts, not guaranteed wages.
8.4 Contract-Sign Gate: Sponsorship-track participants must execute this Agreement electronically before sponsored application submission/final processing.

9. TERMINATION
Either party may terminate with written notice. Agency may terminate immediately for misconduct, fraud, misrepresentation, or compliance violations.

10. CONFIDENTIALITY / IP / NON-CIRCUMVENTION / BRAND PROTECTION
Agent shall not disclose, copy, or commercialize Agency proprietary systems, methods, training, compensation logic, recruiting frameworks, automation, or operations. Confidentiality and proprietary protections survive termination.

11. DISPUTE RESOLUTION
11.1 Good-faith resolution first.
11.2 Binding arbitration (AAA or similar), venue in North Carolina.
11.3 Agency may seek injunctive relief in court for confidentiality/IP breaches.
11.4 Prevailing party may recover legal fees/costs where permitted by law.

12. RECORDING CONSENT
Trainings/calls/meetings may be recorded for quality/compliance. Agent consents.

13. GOVERNING LAW
State of North Carolina.

14. ELECTRONIC RECORDS AND NOTICES
Electronic signatures and records are binding. Email/platform notices are valid notices unless proven undelivered.

15. ENTIRE AGREEMENT / SEVERABILITY / ASSIGNMENT / AMENDMENTS
This Agreement plus Exhibit A is the entire agreement. If any provision is unenforceable, remaining provisions remain in force. Agent may not assign without written Agency consent. Amendments must be in writing.

─────────────────────────────────────────────
EXHIBIT A - COMPENSATION SCHEDULE (INCORPORATED BY REFERENCE)
─────────────────────────────────────────────

Small Policy Total: $1,200
Special Agent $600 / Regional Director $300 / Legacy Visionary $200 / Agency Owner $100

Large Policy Total: $2,400
Special Agent $1,200 / Regional Director $600 / Legacy Visionary $400 / Agency Owner $200

Unlicensed split: 50% initial + 50% hold until licensing completion + first issued policy
No double payout on skipped tiers
Chargeback recoupment applies proportionally
Default payout cadence: Friday, subject to compliance/carrier timing

─────────────────────────────────────────────
AGENT COMPLIANCE & COVERAGE ADDENDUM
─────────────────────────────────────────────

This addendum is incorporated into and forms part of the Legacy Link Independent Contractor Agreement (ICA).

1. Policies and Disclosures
Agent acknowledges that certain policies and disclosures may be provided during onboarding or participation in Legacy Link programs. These documents are incorporated into and form part of the Independent Contractor Agreement.

2. Insurance Compliance
Agent acknowledges that participation in Legacy Link programs does not require the purchase of any insurance product. Any life insurance coverage discussed or obtained is optional and must comply with applicable suitability standards, underwriting guidelines, and state insurance regulations.

3. Optional Company Supported Coverage
In certain circumstances, The Legacy Link may elect to cover or advance the cost of an initial life insurance policy for an agent as part of onboarding support. This support is not considered compensation, employment benefit, or inducement to purchase insurance.

4. Premium Advancement
If The Legacy Link advances the premium for a policy obtained by an agent, the payment shall be treated as a premium advancement made on behalf of the agent. If the policy is voluntarily cancelled, surrendered, or allowed to lapse within twelve (12) months of issuance, The Legacy Link reserves the right, where permitted by law, to recover or offset any advanced premium amount.

5. Persistency Expectation
When company supported coverage is used, policies are expected to remain in good standing for approximately twelve (12) months from issue date to demonstrate genuine insurance purpose and compliance with carrier guidelines.

By signing below, Agent confirms they have read, understood, and agree to this Independent Contractor Agreement (V3) and all incorporated addenda.`;

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
// 'role-select' → (New Agent: external) | (Licensed/Unlicensed: external link)
// 'email' → 'otp' → 'contract' → 'done'  (for new agents signing ICA)

function StartPortalPageInner() {
  const router = useRouter();
  const [stage, setStage] = useState('loading');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [suitAnswers, setSuitAnswers] = useState({}); // {q1:'', q2:[], q3:[], q4:'', q5:''}
  const [policyElect, setPolicyElect] = useState(''); // 'yes' | 'no'
  const [notice, setNotice] = useState('');
  const [signedAt, setSignedAt] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  // Password auth state
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Typed-name sig state
  const [typedName, setTypedName] = useState('');
  const [agreed, setAgreed] = useState(false);

  // Restore session on mount
  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : '';
    if (!t) { setStage('role-select'); return; }
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

  // ── Check email first - routes to password or OTP ──────────────────────
  async function checkEmail() {
    setError(''); setNotice('');
    const e = clean(email).toLowerCase();
    if (!isEmail(e)) { setError('Enter a valid email address.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/start-auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error === 'not_found'
          ? 'No account found for that email. If you just signed your contract, wait 1\u20132 minutes and try again.'
          : (data?.error || 'Unable to continue. Try again.'));
        return;
      }
      setAlreadyRegistered(Boolean(data?.alreadyRegistered));
      if (data?.hasPassword) {
        setStage('password');
      } else {
        await requestCode(e);
      }
    } finally { setBusy(false); }
  }

  async function requestCode(prevalidatedEmail) {
    setError(''); setNotice('');
    const e = prevalidatedEmail || clean(email).toLowerCase();
    if (!prevalidatedEmail) {
      if (!isEmail(e)) { setError('Enter a valid email address.'); return; }
      setBusy(true);
    }
    try {
      const res = await fetch('/api/start-auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        const msg = data?.error === 'not_found'
          ? 'No account found for that email. If you just signed your contract, wait 1\u20132 minutes and try again. Or go directly to your back office: innercirclelink.com/unlicensed-backoffice'
          : (data?.error || 'Unable to send code. Try again.');
        setError(msg);
        return;
      }
      setAlreadyRegistered(Boolean(data?.alreadyRegistered));
      setNotice('Code sent! Check your email (including spam).');
      setStage('otp');
    } finally { if (!prevalidatedEmail) setBusy(false); }
  }

  // ── Password login ────────────────────────────────────────────────────────
  async function loginWithPassword() {
    setError('');
    const e = clean(email).toLowerCase();
    const pw = passwordInput;
    if (!pw) { setError('Enter your password.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/start-auth/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, password: pw })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.token) {
        setError(data?.error === 'invalid_credentials'
          ? 'Incorrect password. Try again or use a code instead.'
          : 'Login failed. Try again.');
        return;
      }
      if (typeof window !== 'undefined') window.localStorage.setItem(TOKEN_KEY, data.token);
      if (typeof window !== 'undefined') window.localStorage.setItem(PROFILE_KEY, JSON.stringify(data.profile));
      setToken(data.token);
      setProfile(data.profile);
      await proceedAfterAuth(data.token, data.profile);
    } finally { setBusy(false); }
  }

  // ── Set password (post-OTP, optional) ────────────────────────────────────
  async function handleSetPassword() {
    setError('');
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmNewPassword) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/start-auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: newPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) { setError('Failed to set password. Try again.'); return; }
      await proceedAfterAuth(token, profile);
    } finally { setBusy(false); }
  }

  async function proceedAfterAuth(tok, prof) {
    const cr = await fetch('/api/esign-contract', { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store' });
    const cd = await cr.json().catch(() => ({}));
    if (cd?.signed) redirectToBackoffice(prof);
    else setStage('contract');
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
      // Offer password setup before proceeding
      setStage('set-password');
    } finally { setBusy(false); }
  }

  function computeSuitabilityResult(ans) {
    const q2 = Array.isArray(ans.q2) ? ans.q2 : [];
    const q3 = Array.isArray(ans.q3) ? ans.q3 : [];
    const q4 = ans.q4 || '';
    const q5 = ans.q5 || '';
    const noDependents = q2.length === 0 || (q2.length === 1 && q2[0] === 'None');
    const noObligations = q3.length === 0 || (q3.length === 1 && q3[0] === 'None');
    const noHardship = q4 === 'No';
    const noUnderstanding = q5 === 'No';
    return !((noDependents && noObligations) || (noHardship && noUnderstanding));
  }

  async function submitSignature() {
    setError(''); setNotice('');
    const typed = clean(typedName);
    const requiredQs = ['q1','q4','q5'];
    const allAnswered = requiredQs.every(q => suitAnswers[q]) && Array.isArray(suitAnswers.q2) && Array.isArray(suitAnswers.q3);
    if (!allAnswered) { setError('Please answer all suitability questions before signing.'); return; }
    if (!policyElect) { setError('Please make your policy election before signing.'); return; }
    if (!typed) { setError('Type your full legal name to sign.'); return; }
    if (!agreed) { setError('You must check the box to confirm your agreement.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/esign-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'candidate_sign',
          signatureType: 'typed',
          typedName: typed,
          suitable: computeSuitabilityResult(suitAnswers),
          optInPolicy: policyElect === 'yes',
          suitabilityAnswers: { ...suitAnswers, policyElection: policyElect }
        })
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


  // ─── Role Selector (default landing) ──────────────────────────────────────
  if (stage === 'role-select') {
    const selectorBg = {
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: 'radial-gradient(900px 400px at 10% -10%, rgba(29,66,138,.35) 0%, transparent 55%), radial-gradient(700px 350px at 90% 5%, rgba(200,169,107,.15) 0%, transparent 55%), #020617',
      fontFamily: 'Arial, Helvetica, sans-serif',
      color: '#F8FAFC',
      padding: 16
    };
    const selectorCard = {
      width: '100%',
      maxWidth: 600,
      background: 'linear-gradient(180deg,#0a1628 0%,#070d1c 100%)',
      border: '1px solid #1F2D4A',
      borderRadius: 18,
      padding: '32px 28px 24px',
      boxShadow: '0 24px 60px rgba(0,0,0,.5)'
    };
    const optionBase = {
      display: 'block',
      textDecoration: 'none',
      color: '#F8FAFC',
      background: 'rgba(255,255,255,.03)',
      borderRadius: 14,
      padding: '18px 20px',
      marginBottom: 12
    };
    return (
      <main style={selectorBg}>
        <div style={selectorCard}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.14em', color: '#93C5FD', textTransform: 'uppercase', marginBottom: 6 }}>The Legacy Link</div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, lineHeight: 1.15 }}>Back Office Access</h1>
            <p style={{ margin: '8px 0 0', color: '#94A3B8', fontSize: 15 }}>Select your status to continue.</p>
          </div>

          {/* New Agent */}
          <a href="/sponsorship-signup" style={{ ...optionBase, border: '1px solid #C8A96B' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <span style={{ fontSize: 26, lineHeight: 1 }}>&#x1F31F;</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#FBBF24', marginBottom: 4 }}>New Agent</div>
                <div style={{ color: '#94A3B8', fontSize: 14, marginBottom: 10 }}>First time here. Never signed up or signed a contract yet.</div>
                <span style={{ color: '#C8A96B', fontWeight: 700, fontSize: 14 }}>Start your registration at Legacy Link Hub &rarr;</span>
              </div>
            </div>
          </a>

          {/* Licensed Agent */}
          <a href="/licensed-backoffice" style={{ ...optionBase, border: '1px solid #3B82F6' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <span style={{ fontSize: 26, lineHeight: 1 }}>&#x2705;</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#93C5FD', marginBottom: 4 }}>Licensed Agent</div>
                <div style={{ color: '#94A3B8', fontSize: 14, marginBottom: 10 }}>Returning agent with an active insurance license.</div>
                <span style={{ color: '#60A5FA', fontWeight: 700, fontSize: 14 }}>Go to Licensed Agent Back Office &rarr;</span>
              </div>
            </div>
          </a>

          {/* Unlicensed Trainee */}
          <a href="/unlicensed-backoffice" style={{ ...optionBase, border: '1px solid #475569', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <span style={{ fontSize: 26, lineHeight: 1 }}>&#x1F4CB;</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#CBD5E1', marginBottom: 4 }}>Unlicensed Trainee</div>
                <div style={{ color: '#94A3B8', fontSize: 14, marginBottom: 10 }}>Returning trainee working toward your license.</div>
                <span style={{ color: '#94A3B8', fontWeight: 700, fontSize: 14 }}>Go to Trainee Back Office &rarr;</span>
              </div>
            </div>
          </a>

          {/* Footer */}
          <p style={{ textAlign: 'center', color: '#475569', fontSize: 13, marginTop: 24, marginBottom: 0 }}>
            Questions?{' '}
            <a href="mailto:support@thelegacylink.com" style={{ color: '#60A5FA', textDecoration: 'none' }}>support@thelegacylink.com</a>
            {' '}&middot;{' '}201-862-7040
          </p>

          <p style={{ textAlign: 'center', color: '#2D3748', fontSize: 12, marginTop: 12, marginBottom: 0 }}>
            Need to sign your ICA?{' '}
            <button onClick={() => setStage('email')} style={{ background: 'none', border: 'none', color: '#4A5568', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 }}>Click here</button>
          </p>
        </div>
      </main>
    );
  }

  if (stage === 'loading') {
    return (
      <main style={bg}>
        <div style={card}>
          <p style={mutedStyle}>Loading...</p>
        </div>
      </main>
    );
  }

  if (stage === 'done') {
    return (
      <main style={bg}>
        <div style={{ ...card, textAlign: 'center', gap: 14 }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <h2 style={{ margin: 0, fontSize: 26 }}>Agreement Signed</h2>
          <p style={{ ...mutedStyle, fontSize: 15, margin: 0 }}>
            You are officially onboard. Your back office is ready.
          </p>
          <a
            href="/unlicensed-backoffice"
            style={{ display: 'block', padding: '16px', borderRadius: 12, background: '#1651AE', color: '#fff', fontWeight: 800, fontSize: 17, textDecoration: 'none', textAlign: 'center', boxShadow: '0 6px 20px rgba(22,81,174,0.4)' }}
          >
            Go to My Back Office →
          </a>
          <p style={{ ...mutedStyle, fontSize: 12, margin: 0 }}>
            Bookmark this link: <strong style={{ color: '#93C5FD' }}>innercirclelink.com/unlicensed-backoffice</strong>
          </p>
          <p style={{ ...mutedStyle, fontSize: 11, margin: 0, opacity: 0.6 }}>Redirecting automatically in a moment...</p>
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
            {stage === 'password' && 'Welcome Back'}
            {stage === 'otp' && 'Enter Your Code'}
            {stage === 'set-password' && 'Set a Password'}
            {stage === 'contract' && 'Independent Contractor Agreement'}
          </h1>
          <p style={{ ...mutedStyle, marginTop: 6 }}>
            {stage === 'email' && 'Enter your email to continue.'}
            {stage === 'password' && `Enter your password for ${clean(email)}`}
            {stage === 'otp' && `We sent a 6-digit code to ${clean(email)}`}
            {stage === 'set-password' && 'Skip the code every time — set a password once and you\'re done.'}
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
                onKeyDown={(e) => e.key === 'Enter' && checkEmail()}
                autoFocus
              />
            </label>
            {notice && <p style={{ ...mutedStyle, color: '#86EFAC' }}>{notice}</p>}
            {error && <p style={errStyle}>{error}</p>}
            <button style={btnPrimary} onClick={checkEmail} disabled={busy}>
              {busy ? 'Checking...' : 'Continue'}
            </button>
            <p style={{ ...mutedStyle, textAlign: 'center' }}>
              Not registered yet?{' '}
              <a href="/start/licensed" style={{ color: '#60A5FA' }}>Licensed Agent Sign-Up</a>
              {' '}or{' '}
              <a href="/start/unlicensed" style={{ color: '#60A5FA' }}>Unlicensed Sign-Up</a>
            </p>
          </>
        )}

        {/* ── STAGE: PASSWORD ── */}
        {stage === 'password' && (
          <>
            <label style={labelStyle}>
              Password
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 44 }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loginWithPassword()}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 13, padding: 0 }}
                >{showPassword ? 'Hide' : 'Show'}</button>
              </div>
            </label>
            {error && <p style={errStyle}>{error}</p>}
            <button style={btnPrimary} onClick={loginWithPassword} disabled={busy}>
              {busy ? 'Logging in...' : 'Log In'}
            </button>
            <button
              style={btnSecondary}
              disabled={busy}
              onClick={() => { setError(''); setPasswordInput(''); requestCode(clean(email).toLowerCase()); }}
            >
              Use a code instead
            </button>
            <button style={{ ...btnSecondary, marginTop: -8 }} onClick={() => { setStage('email'); setPasswordInput(''); setError(''); }}>
              ← Use a different email
            </button>
          </>
        )}

        {/* ── STAGE: SET-PASSWORD (post-OTP, optional) ── */}
        {stage === 'set-password' && (
          <>
            <div style={{ background: '#071a0e', border: '1px solid #166534', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ margin: 0, color: '#86efac', fontWeight: 700, fontSize: 14 }}>You&apos;re in! 🎉</p>
              <p style={{ margin: '4px 0 0', color: '#6ee7b7', fontSize: 13 }}>Create a password now and you&apos;ll never need an email code again.</p>
            </div>
            <label style={labelStyle}>
              New Password <span style={{ color: '#64748B', fontWeight: 400 }}>(min 8 characters)</span>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 44 }}
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 13, padding: 0 }}
                >{showNewPassword ? 'Hide' : 'Show'}</button>
              </div>
            </label>
            <label style={labelStyle}>
              Confirm Password
              <input
                style={inputStyle}
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Repeat your password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
              />
            </label>
            {error && <p style={errStyle}>{error}</p>}
            <button style={btnPrimary} onClick={handleSetPassword} disabled={busy}>
              {busy ? 'Saving...' : 'Set Password & Continue'}
            </button>
            <button
              style={btnSecondary}
              disabled={busy}
              onClick={() => proceedAfterAuth(token, profile)}
            >
              Skip for now
            </button>
          </>
        )}

        {/* ── STAGE: OTP ── */}
        {stage === 'otp' && (
          <>
            {alreadyRegistered && (
              <div style={{ background: '#0f2a1a', border: '1px solid #16a34a', borderRadius: 10, padding: '12px 14px', marginBottom: 4 }}>
                <p style={{ margin: 0, color: '#86efac', fontWeight: 700, fontSize: 14 }}>You already have an account - welcome back!</p>
                <p style={{ margin: '4px 0 0', color: '#6ee7b7', fontSize: 13 }}>Enter the code sent to your email to log back into your back office.</p>
              </div>
            )}
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
              {busy ? 'Verifying...' : 'Verify Code'}
            </button>
            <button style={btnSecondary} onClick={() => { setStage('email'); setOtp(''); setError(''); setNotice(''); }}>
              ← Use a different email
            </button>
            <p style={{ ...mutedStyle, textAlign: 'center' }}>
              Didn&apos;t get the code?{' '}
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

            {/* ── Suitability Questionnaire ── */}
            <div style={{ background: '#071235', border: '1px solid #1E3A5F', borderRadius: 10, padding: '16px 18px', marginBottom: 4 }}>
              <p style={{ margin: '0 0 6px', color: '#F8FAFC', fontWeight: 700, fontSize: 14 }}>Suitability Questionnaire <span style={{ color: '#ef4444' }}>*</span></p>
              <p style={{ margin: '0 0 14px', color: '#94A3B8', fontSize: 13 }}>Answer honestly - these help determine whether a company-funded life insurance policy is appropriate for you. You can still fully participate in Legacy Link regardless of your answers.</p>

              {/* Q1 - Current life insurance */}
              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: '0 0 8px', color: '#CBD5E1', fontSize: 13, fontWeight: 600 }}>1. Do you currently have any life insurance coverage?</p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {['Yes','No'].map(v => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: suitAnswers.q1 === v ? '#F8FAFC' : '#94A3B8', fontSize: 13 }}>
                      <input type="radio" name="sq1" value={v} checked={suitAnswers.q1 === v} onChange={() => setSuitAnswers(a => ({ ...a, q1: v }))} style={{ cursor: 'pointer' }} />
                      {v}
                    </label>
                  ))}
                </div>
              </div>

              {/* Q2 - Dependents (multi) */}
              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: '0 0 8px', color: '#CBD5E1', fontSize: 13, fontWeight: 600 }}>2. Do you have anyone who relies on you financially? <span style={{ color: '#64748b', fontWeight: 400 }}>(select all that apply)</span></p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
                  {['Spouse/Partner','Children','Family Members','Business Partner','None'].map(v => {
                    const sel = (suitAnswers.q2 || []).includes(v);
                    return (
                      <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: sel ? '#F8FAFC' : '#94A3B8', fontSize: 13 }}>
                        <input type="checkbox" checked={sel} onChange={() => setSuitAnswers(a => {
                          const cur = Array.isArray(a.q2) ? a.q2 : [];
                          return { ...a, q2: sel ? cur.filter(x => x !== v) : [...cur.filter(x => x !== 'None'), ...(v === 'None' ? ['None'] : [v])] };
                        })} style={{ cursor: 'pointer' }} />
                        {v}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Q3 - Financial obligations (multi) */}
              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: '0 0 8px', color: '#CBD5E1', fontSize: 13, fontWeight: 600 }}>3. Do you have financial obligations that could create hardship if something happened to you? <span style={{ color: '#64748b', fontWeight: 400 }}>(select all that apply)</span></p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
                  {['Mortgage/Rent','Personal Debt','Business Obligations','Family Support','None'].map(v => {
                    const sel = (suitAnswers.q3 || []).includes(v);
                    return (
                      <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: sel ? '#F8FAFC' : '#94A3B8', fontSize: 13 }}>
                        <input type="checkbox" checked={sel} onChange={() => setSuitAnswers(a => {
                          const cur = Array.isArray(a.q3) ? a.q3 : [];
                          return { ...a, q3: sel ? cur.filter(x => x !== v) : [...cur.filter(x => x !== 'None'), ...(v === 'None' ? ['None'] : [v])] };
                        })} style={{ cursor: 'pointer' }} />
                        {v}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Q4 - Financial hardship */}
              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: '0 0 8px', color: '#CBD5E1', fontSize: 13, fontWeight: 600 }}>4. Would your family or loved ones experience financial hardship if you passed away unexpectedly?</p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {['Yes','No','Unsure'].map(v => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: suitAnswers.q4 === v ? '#F8FAFC' : '#94A3B8', fontSize: 13 }}>
                      <input type="radio" name="sq4" value={v} checked={suitAnswers.q4 === v} onChange={() => setSuitAnswers(a => ({ ...a, q4: v }))} style={{ cursor: 'pointer' }} />
                      {v}
                    </label>
                  ))}
                </div>
              </div>

              {/* Q5 - Understanding */}
              <div style={{ marginBottom: 4 }}>
                <p style={{ margin: '0 0 8px', color: '#CBD5E1', fontSize: 13, fontWeight: 600 }}>5. Do you understand the purpose of life insurance and how it can protect your family or financial responsibilities?</p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {['Yes','No'].map(v => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: suitAnswers.q5 === v ? '#F8FAFC' : '#94A3B8', fontSize: 13 }}>
                      <input type="radio" name="sq5" value={v} checked={suitAnswers.q5 === v} onChange={() => setSuitAnswers(a => ({ ...a, q5: v }))} style={{ cursor: 'pointer' }} />
                      {v}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Policy Election ── */}
            <div style={{ background: '#071235', border: '1px solid #1E3A5F', borderRadius: 10, padding: '16px 18px', marginBottom: 4 }}>
              <p style={{ margin: '0 0 8px', color: '#F8FAFC', fontWeight: 700, fontSize: 14 }}>Company Policy Election <span style={{ color: '#ef4444' }}>*</span></p>
              <p style={{ margin: '0 0 12px', color: '#94A3B8', fontSize: 13 }}>The Legacy Link may elect to cover or advance the cost of an initial life insurance policy as part of onboarding support. Your participation is entirely optional.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input type="radio" name="policyElect" value="yes" checked={policyElect === 'yes'} onChange={() => setPolicyElect('yes')} style={{ marginTop: 3, cursor: 'pointer' }} />
                  <span style={{ color: policyElect === 'yes' ? '#86EFAC' : '#94A3B8', fontSize: 13, lineHeight: 1.5 }}>
                    <strong style={{ color: policyElect === 'yes' ? '#F8FAFC' : '#CBD5E1' }}>Yes - I elect to participate</strong> in the company-sponsored life insurance policy option, subject to eligibility, underwriting, and program terms.
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input type="radio" name="policyElect" value="no" checked={policyElect === 'no'} onChange={() => setPolicyElect('no')} style={{ marginTop: 3, cursor: 'pointer' }} />
                  <span style={{ color: policyElect === 'no' ? '#FCA5A5' : '#94A3B8', fontSize: 13, lineHeight: 1.5 }}>
                    <strong style={{ color: policyElect === 'no' ? '#F8FAFC' : '#CBD5E1' }}>No - I do not elect to participate</strong> in the company-sponsored life insurance policy option at this time.
                  </span>
                </label>
              </div>
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
              {busy ? 'Submitting...' : '✍️ Sign & Continue to Back Office'}
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

// ─── Default export: wrapped with SSO redirect gate ──────────────────────────
import { Suspense } from 'react';
export default function StartPortalPage() {
  return (
    <Suspense>
      <SsoRedirectGate>
        <StartPortalPageInner />
      </SsoRedirectGate>
    </Suspense>
  );
}
