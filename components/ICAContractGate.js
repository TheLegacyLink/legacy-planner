'use client';

import { useEffect, useRef, useState } from 'react';

// ── ICA full text ─────────────────────────────────────────────────────────────
const ICA_TEXT = `INDEPENDENT CONTRACTOR AGREEMENT (V4)
THE LEGACY LINK / INVESTALINK LLC

This Independent Contractor Agreement ("Agreement") is entered into by and between The Legacy Link, a division of Investalink LLC ("Agency" or "Company"), and the undersigned independent agent ("Agent").

Effective Date: The latest date signed below.

──────────────────────────────────────────────
0. DEFINITIONS
──────────────────────────────────────────────

• "Agency" / "Company" — The Legacy Link / Investalink LLC.
• "Agent" — The independent contractor executing this Agreement.
• "Active Agent" — An Agent in good standing, compliant, and not suspended or terminated.
• "Issued Policy" — A policy accepted by a carrier and currently in force.
• "Chargeback" — A reversal or reduction of paid commission resulting from a lapse, cancellation, or rescission.
• "Compensation Schedule" — The current payout schedule set forth in Exhibit A, as updated in writing by Agency.
• "JumpStart" — Agency's business-advance payout model; not a guarantee of income.
• "Sponsorship Policy" — A policy initially funded under the Agency sponsorship structure.

──────────────────────────────────────────────
1. NATURE OF RELATIONSHIP
──────────────────────────────────────────────

1.1 Independent Contractor Status
Agent is an independent contractor — not an employee. Nothing in this Agreement creates an employer–employee relationship, partnership, or joint venture.

1.2 Non-Captive Status
Agent may contract with other agencies or carriers, provided Agency's confidential and proprietary information is not misused.

1.3 Agent Responsibilities
Agent is solely responsible for maintaining all required licenses, paying applicable taxes, covering business expenses, and remaining in full legal and regulatory compliance.

──────────────────────────────────────────────
2. LICENSING, COMPLIANCE, AND E&O
──────────────────────────────────────────────

2.1 Licensing
Agent must hold and maintain all state insurance licenses required to conduct business.

2.2 Compliance
Agent must comply with all applicable state and federal insurance laws, carrier guidelines, and ethical sales standards at all times.

2.3 E&O Coverage
Agent must maintain active Errors & Omissions (E&O) coverage throughout the term of this Agreement.

2.4 Agency-Provided E&O
If Agency provides E&O coverage, that coverage applies only to policies written within Agency's hierarchy and terminates upon Agent's resignation or termination.

──────────────────────────────────────────────
3. COMPENSATION, PAYMENTS, AND CHARGEBACKS
──────────────────────────────────────────────

3.1 Commission Flow
All commissions are paid through Agency's hierarchy structure.

3.2 Overrides
Override compensation is governed by the active Compensation Schedule in Exhibit A.

3.3 Transfer Economics
Transfer and upline economics are governed by approved written transfer terms and the active Compensation Schedule.

3.4 Chargebacks
Chargebacks are Agent's responsibility. Recoupment is applied proportionally as outlined in Exhibit A.

3.5 Deduction Authorization
Agent authorizes Agency to deduct any owed balance from future commissions or bonuses.

3.6 Variability
Compensation may vary based on carrier, product type, or applicable regulatory requirements.

3.7 No Earnings Guarantee
Agency makes no guarantee of leads, sales, commissions, bonuses, or income of any kind.

──────────────────────────────────────────────
4. SPONSORSHIP PROGRAM TERMS
──────────────────────────────────────────────

4.1 Sponsorship Acknowledgment
Agent acknowledges that business written under the sponsorship program may be subject to split, holdback, and release rules as defined in Exhibit A.

4.1A Optional Participation
Participation in the sponsorship policy track is entirely optional. Agent is not required to accept a sponsorship policy to remain part of Agency. Eligibility is subject to Agency criteria and Agent election.

4.2 No Upfront Cost — Initial Sponsorship Window
For eligible participants who elect the sponsorship track, Agency may cover initial premium obligations during the sponsorship window.

4.2A Program Benefit Clarification
Agency may use sponsorship-track participation to provide operational support benefits — including lead flow and CRM/system enablement — at no upfront cost during the applicable window, subject to Agency rules and compliance status.

4.3 Post-Sponsorship Responsibility — 14-Month Transition
Beginning at month fourteen (14) from policy start date, Agent is responsible for assuming policy premium payments unless a separate written arrangement has been approved by Agency.

4.4 Non-Assumption at 14 Months
If Agent does not assume premium responsibility at month 14, one of the following outcomes applies:
• Option A — Ownership/Beneficiary Conversion: By written consent, Agency may become or remain policy owner and designate the beneficiary structure under Agency rules. Agency may continue premium payments.
• Option B — Policy Termination: The policy may be canceled or terminated, which may result in loss of death benefit and potential loss or reduction of cash value, subject to carrier terms.

4.5 Community Service / Program Participation
Sponsorship participation includes performance expectations such as community service completion, training attendance, and program engagement requirements as defined by Agency SOP and compliance policy.

──────────────────────────────────────────────
5. TAX RESPONSIBILITY AND EXECUTIVE BONUS TREATMENT
──────────────────────────────────────────────

5.1 Tax Responsibility
Agent is solely responsible for all tax reporting and payment obligations related to commissions, bonuses, overrides, and any sponsored benefit treatment.

5.2 Executive Bonus / Economic Benefit Acknowledgment
Where sponsorship support or executive-bonus-style funding is provided, Agent acknowledges that such amounts may constitute reportable income depending on applicable tax rules and total annual earnings.

5.3 No Tax Advice
Agency does not provide legal or tax advice. Agent agrees to consult a qualified tax professional.

5.4 Information Reporting
Agent understands that IRS and state reporting thresholds may change and may apply at amounts lower than expected.

──────────────────────────────────────────────
6. LEAD OWNERSHIP AND USE
──────────────────────────────────────────────

Agency leads are and remain Agency property. Leads may not be sold, transferred, or used outside of Agency authorization. Upon termination, Agent must immediately cease contact with and use of Agency leads, unless otherwise required by law.

──────────────────────────────────────────────
7. TECHNOLOGY AND PROPERTY
──────────────────────────────────────────────

Agency CRM systems, phone numbers, email accounts, automations, scripts, and all related tools and systems remain Agency property. Access may be revoked at any time without notice.

──────────────────────────────────────────────
8. PROGRAM PARTICIPATION TERMS
──────────────────────────────────────────────

8.1 Agent may participate in lead programs and JumpStart programs under the terms of Exhibit A.
8.2 Agency may adjust pricing or resource allocations based on operational costs and program structure.
8.3 JumpStart tiers are business-model payout structures — not guaranteed wages or salary equivalents.
8.4 Contract-Sign Gate: Sponsorship-track participants must fully execute this Agreement electronically before any sponsored application is submitted or finalized.

──────────────────────────────────────────────
9. TERMINATION
──────────────────────────────────────────────

Either party may terminate this Agreement with written notice. Agency may terminate immediately and without notice for misconduct, fraud, misrepresentation, or any compliance violation.

──────────────────────────────────────────────
10. CONFIDENTIALITY / INTELLECTUAL PROPERTY / NON-CIRCUMVENTION / BRAND PROTECTION
──────────────────────────────────────────────

Agent shall not disclose, copy, replicate, or commercialize any Agency proprietary systems, methods, training materials, compensation logic, recruiting frameworks, automations, or operational processes. These protections survive termination of this Agreement.

──────────────────────────────────────────────
11. DISPUTE RESOLUTION
──────────────────────────────────────────────

11.1 The parties will first attempt good-faith resolution of any dispute.
11.2 If unresolved, disputes are subject to binding arbitration under AAA rules, with venue in North Carolina.
11.3 Agency may seek injunctive or other equitable relief in a court of competent jurisdiction for any actual or threatened breach of confidentiality or intellectual property provisions.
11.4 The prevailing party may recover reasonable attorneys' fees and costs where permitted by law.

──────────────────────────────────────────────
12. RECORDING CONSENT
──────────────────────────────────────────────

Trainings, calls, and meetings may be recorded for quality assurance and compliance purposes. Agent consents to such recording by participating.

──────────────────────────────────────────────
13. GOVERNING LAW
──────────────────────────────────────────────

This Agreement is governed by the laws of the State of North Carolina.

──────────────────────────────────────────────
14. ELECTRONIC RECORDS AND NOTICES
──────────────────────────────────────────────

Electronic signatures and records are fully binding. Notices delivered by email or platform message are valid and effective unless proven undelivered.

──────────────────────────────────────────────
15. ENTIRE AGREEMENT / SEVERABILITY / ASSIGNMENT / AMENDMENTS
──────────────────────────────────────────────

This Agreement, together with Exhibit A, constitutes the entire agreement between the parties. If any provision is found unenforceable, all remaining provisions stay in full force. Agent may not assign rights or obligations without prior written Agency consent. Amendments must be made in writing.

──────────────────────────────────────────────
EXHIBIT A — COMPENSATION SCHEDULE
──────────────────────────────────────────────

Small Policy — Total Payout: $1,200
  Special Agent: $600 | Regional Director: $300 | Legacy Visionary: $200 | Agency Owner: $100

Large Policy — Total Payout: $2,400
  Special Agent: $1,200 | Regional Director: $600 | Legacy Visionary: $400 | Agency Owner: $200

• Unlicensed split: 50% at initial payout + 50% held until licensing completion and first issued policy
• No double payout on skipped tiers
• Chargeback recoupment applied proportionally
• Default payout cadence: Friday, subject to compliance and carrier timing

──────────────────────────────────────────────
AGENT COMPLIANCE & COVERAGE ADDENDUM
──────────────────────────────────────────────

This Addendum is incorporated into and forms part of the Legacy Link Independent Contractor Agreement (ICA).

Policies and Disclosures
Agent acknowledges that certain policies and disclosures may be provided during onboarding or program participation. These may include the Agent Protection and Coverage Policy, Lead By Example Program Policy, Optional Coverage Acknowledgment, Suitability Questionnaire, and Premium Advancement terms. All such documents are incorporated into and form part of the Independent Contractor Agreement.

Insurance Compliance
Participation in Legacy Link programs does not require the purchase of any insurance product. Any life insurance coverage discussed or obtained is optional and must comply with applicable suitability standards, underwriting guidelines, and state insurance regulations.

Optional Company-Supported Coverage
In certain circumstances, The Legacy Link may elect to cover or advance the cost of an initial life insurance policy for an agent as part of onboarding support. This support is intended to demonstrate the protection strategies taught to clients. It is not compensation, an employment benefit, or an inducement to purchase insurance.

Premium Advancement
If The Legacy Link advances the premium for an agent's policy, the payment is treated as a premium advancement made on the agent's behalf. If the policy is voluntarily cancelled, surrendered, or allowed to lapse within twelve (12) months of issuance, The Legacy Link reserves the right — where permitted by law — to recover or offset any advanced premium amount.

Persistency Expectation
When company-supported coverage is in place, policies are expected to remain in good standing for approximately twelve (12) months from issue date.

──────────────────────────────────────────────
AGENT COVERAGE SUITABILITY QUESTIONNAIRE
──────────────────────────────────────────────

This questionnaire is completed during onboarding to assess whether life insurance coverage may be appropriate for the participating agent.

1. Do you currently have any life insurance coverage? (Yes / No)
2. Do you have anyone who relies on you financially? (Spouse/Partner / Children / Family Members / Business Partner / None)
3. Do you currently have financial obligations that could create hardship if something happened to you? (Mortgage/Rent / Personal Debt / Business Obligations / Family Support / None)
4. Would your family or loved ones experience financial hardship if you passed away unexpectedly? (Yes / No / Unsure)
5. Do you understand the purpose of life insurance and how it can protect your family or financial responsibilities? (Yes / No)

Suitability Acknowledgment: I confirm that the information provided above is accurate to the best of my knowledge. I understand that any life insurance policy considered or applied for must be based on legitimate personal or financial protection needs and must meet applicable suitability guidelines.`;

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: '#0a0f1e', overflowY: 'auto',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#e5e7eb',
  },
  inner: { width: '100%', maxWidth: 800, padding: '40px 24px 80px', boxSizing: 'border-box' },
  logo: { fontSize: 13, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#d4a12a', marginBottom: 4 },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 4px' },
  subtitle: { fontSize: 14, color: '#94a3b8', margin: '0 0 28px' },
  scrollBox: {
    border: '1px solid #1e293b', borderRadius: 12, background: '#060c1a',
    padding: '20px 22px', height: 360, overflowY: 'scroll',
    fontSize: 13, lineHeight: 1.7, color: '#cbd5e1', whiteSpace: 'pre-wrap',
    fontFamily: 'monospace', marginBottom: 24,
  },
  scrollHint: { fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: -20, marginBottom: 20 },
  checkRow: { display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20, cursor: 'pointer' },
  checkBox: {
    width: 20, height: 20, minWidth: 20, borderRadius: 4,
    border: '2px solid #d4a12a', background: '#060c1a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  checkLabel: { fontSize: 14, color: '#e2e8f0', lineHeight: 1.5 },
  label: { display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: 6 },
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '12px 14px', borderRadius: 10,
    border: '1px solid #1e3a5f', background: '#060c1a',
    color: '#fff', fontSize: 16, fontWeight: 600,
    outline: 'none', marginBottom: 20,
  },
  btn: {
    width: '100%', padding: '16px', borderRadius: 12, border: 'none',
    background: 'linear-gradient(135deg, #d4a12a, #b8841e)',
    color: '#0a0f1e', fontSize: 16, fontWeight: 800,
    cursor: 'pointer', letterSpacing: '.04em',
  },
  btnDisabled: {
    width: '100%', padding: '16px', borderRadius: 12, border: 'none',
    background: '#1e293b', color: '#4b5563', fontSize: 16, fontWeight: 800,
    cursor: 'not-allowed', letterSpacing: '.04em',
  },
  errorBox: { background: '#3f0d0d', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16 },
  successBox: {
    position: 'fixed', inset: 0, zIndex: 10000,
    background: '#0a0f1e', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  successIcon: { fontSize: 64 },
  successTitle: { fontSize: 28, fontWeight: 800, color: '#d4a12a', margin: 0 },
  successText: { fontSize: 15, color: '#94a3b8', margin: 0, textAlign: 'center', maxWidth: 380 },
  divider: { border: 'none', borderTop: '1px solid #1e293b', margin: '28px 0' },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ICAContractGate({ token, session, onSigned }) {
  const [ready, setReady] = useState(false);   // true = not yet signed, show gate
  const [agreed, setAgreed] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const scrollRef = useRef(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  // On mount: check if already signed
  useEffect(() => {
    if (!token) return; // no token = nothing to gate
    setTypedName(String(session?.name || '').trim());

    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/esign-contract', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (data?.signed) {
          onSigned(); // already signed, pass through immediately
        } else {
          setReady(true); // not signed, show gate
        }
      } catch {
        if (mounted) setReady(true); // on error, show gate to be safe
      }
    })();
    return () => { mounted = false; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track scroll position to nudge user to read
  function handleScroll(e) {
    const el = e.currentTarget;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
    if (atBottom) setScrolledToBottom(true);
  }

  async function handleSubmit() {
    setError('');
    if (!agreed) { setError('Please check the agreement box to confirm you have read the ICA.'); return; }
    const name = typedName.trim();
    if (!name) { setError('Please type your full legal name to sign.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/esign-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'candidate_sign', typedName: name, signatureType: 'typed' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Signature submission failed. Please try again.');
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => onSigned(), 2500);
    } catch {
      setError('Network error. Please check your connection and try again.');
      setSubmitting(false);
    }
  }

  // Nothing to render until check completes (or no token)
  if (!ready) return null;

  // Success screen
  if (success) {
    return (
      <div style={S.successBox}>
        <div style={S.successIcon}>✅</div>
        <h2 style={S.successTitle}>Agreement Signed</h2>
        <p style={S.successText}>Your Independent Contractor Agreement has been recorded. Loading your back office…</p>
      </div>
    );
  }

  const canSubmit = agreed && typedName.trim().length > 0 && !submitting;

  return (
    <div style={S.overlay}>
      <div style={S.inner}>

        {/* Header */}
        <div style={S.logo}>THE LEGACY LINK</div>
        <h1 style={S.title}>Independent Contractor Agreement</h1>
        <p style={S.subtitle}>
          You must read and sign this agreement before accessing your back office.
          This is a one-time requirement.
        </p>

        <hr style={S.divider} />

        {/* ICA Scroll Box */}
        <div
          ref={scrollRef}
          style={S.scrollBox}
          onScroll={handleScroll}
        >
          {ICA_TEXT}
        </div>
        {!scrolledToBottom && (
          <p style={S.scrollHint}>↓ Scroll to read the full agreement</p>
        )}

        <hr style={S.divider} />

        {/* Checkbox */}
        <div
          style={S.checkRow}
          onClick={() => setAgreed((v) => !v)}
          role="checkbox"
          aria-checked={agreed}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setAgreed((v) => !v); }}
        >
          <div style={{ ...S.checkBox, background: agreed ? '#d4a12a' : '#060c1a' }}>
            {agreed && <span style={{ color: '#0a0f1e', fontWeight: 900, fontSize: 14, lineHeight: 1 }}>✓</span>}
          </div>
          <span style={S.checkLabel}>
            I have read the full Independent Contractor Agreement and I agree to all terms and conditions set forth above. I understand this is a legally binding agreement.
          </span>
        </div>

        {/* Typed Name */}
        <label style={S.label} htmlFor="ica-typed-name">
          Type your full legal name to sign
        </label>
        <input
          id="ica-typed-name"
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder="Your Full Legal Name"
          style={S.input}
          autoComplete="name"
          disabled={submitting}
        />

        {/* Error */}
        {error && <div style={S.errorBox}>{error}</div>}

        {/* Submit */}
        <button
          type="button"
          style={canSubmit ? S.btn : S.btnDisabled}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {submitting ? 'Signing…' : 'Sign & Continue →'}
        </button>

        <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 16 }}>
          Your electronic signature has the same legal effect as a handwritten signature.
          By signing, you confirm the name above is your legal name.
        </p>

      </div>
    </div>
  );
}
