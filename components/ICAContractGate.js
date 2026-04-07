'use client';

import { useEffect, useRef, useState } from 'react';

// ── ICA V3 full text ──────────────────────────────────────────────────────────
const ICA_TEXT = `INDEPENDENT CONTRACTOR AGREEMENT (V3)
THE LEGACY LINK / INVESTALINK LLC

This Independent Contractor Agreement ("Agreement") is entered into by and between The Legacy Link, a division of Investalink LLC ("Agency" or "Company"), and the undersigned independent agent ("Agent").

Effective Date: The latest date signed below.

──────────────────────────────────────────────
0. DEFINITIONS
──────────────────────────────────────────────

"Agency/Company" means The Legacy Link / Investalink LLC.
"Agent" means the independent contractor who signs this Agreement.
"Active Agent" means Agent in good standing, compliant, and not suspended/terminated.
"Issued Policy" means a policy accepted by carrier and in-force.
"Chargeback" means reversal/reduction of paid commission due to lapse/cancel/rescission.
"Compensation Schedule" means the current payout schedule in Exhibit A (as updated in writing by Agency).
"JumpStart" means Agency business-advance/payout model; not guaranteed income.
"Sponsorship Policy" means a policy initially funded under the Agency sponsorship structure.

──────────────────────────────────────────────
1. NATURE OF RELATIONSHIP
──────────────────────────────────────────────

1.1 Independent Contractor Status
Agent is an independent contractor and not an employee. Nothing in this Agreement creates an employer–employee relationship, partnership, or joint venture.

1.2 Non-Captive Status
Agent may contract with other agencies/carriers, provided Agent does not misuse Agency confidential/proprietary information.

1.3 Agent Responsibilities
Agent is responsible for licensing, taxes, business expenses, and legal/regulatory compliance.

──────────────────────────────────────────────
2. LICENSING, COMPLIANCE, AND E&O
──────────────────────────────────────────────

2.1 Licensing — Agent must maintain all required state insurance licenses.
2.2 Compliance — Agent must follow all state/federal insurance laws, carrier rules, and ethical sales standards.
2.3 E&O — Agent must maintain active E&O coverage.
2.4 E&O Limitations — If Agency provides E&O, coverage applies only to policies written within Agency hierarchy and terminates upon resignation/termination.

──────────────────────────────────────────────
3. COMPENSATION, PAYMENTS, AND CHARGEBACKS
──────────────────────────────────────────────

3.1 Commission Flow — Commissions are paid through Agency hierarchy.
3.2 Overrides — Overrides are paid under the active Compensation Schedule (Exhibit A).
3.3 Transfer Economics — Transfer/upline economics are governed by approved written transfer terms and the active Compensation Schedule.
3.4 Chargebacks — Chargebacks are Agent responsibility, with proportional recoupment as outlined in Exhibit A.
3.5 Deduction Authorization — Agent authorizes Agency to deduct owed balances from future commissions/bonuses.
3.6 Variability — Compensation may vary by carrier/product/regulatory requirements.
3.7 No Earnings Guarantee — Agency does not guarantee leads, sales, commissions, bonuses, or income.

──────────────────────────────────────────────
4. SPONSORSHIP PROGRAM TERMS
──────────────────────────────────────────────

4.1 Sponsorship Acknowledgment — Agent acknowledges that sponsorship-program business may include split/holdback/release rules under Exhibit A.

4.1A Sponsorship Policy Is Optional — Agent is not required to accept a sponsorship policy to remain part of the Agency. Participation is optional and based on Agent election and Agency eligibility criteria.

4.2 No Upfront Cost (Initial Sponsorship Window) — For eligible sponsorship participants who elect the sponsorship policy track, Agency may cover initial premium obligations during the sponsorship window.

4.2A Program Benefit Clarification — Agency may use sponsorship-track participation to provide operational support benefits (including lead flow and CRM/system enablement) at no upfront cost during the applicable sponsorship window, subject to Agency rules and compliance status.

4.3 Post-Sponsorship Responsibility (14-Month Transition) — At month fourteen (14) from policy start, Agent is responsible for taking over policy premium payments unless a separate written arrangement is approved by Agency.

4.4 If Agent Does Not Assume the Policy at 14 Months:
Option A: Ownership/beneficiary conversion by written consent. Agency may become/remain policy owner and designate beneficiary structure under Agency rules.
Option B: Policy termination. Policy may be canceled/terminated, which may result in loss of death benefit and potential loss/reduction of cash value subject to carrier terms.

4.5 Community Service / Program Participation — Agent acknowledges sponsorship participation includes performance expectations such as community service completion, training attendance, and program engagement requirements.

──────────────────────────────────────────────
5. TAX RESPONSIBILITY AND EXECUTIVE BONUS TREATMENT
──────────────────────────────────────────────

5.1 Tax Responsibility — Agent is solely responsible for all tax reporting and payment obligations related to commissions, bonuses, overrides, and any sponsored benefit treatment.
5.2 Executive Bonus / Economic Benefit Acknowledgment — Where sponsorship support or executive-bonus-style funding is provided, Agent acknowledges such amounts may create reportable income.
5.3 No Tax Advice — Agency does not provide legal or tax advice. Agent agrees to consult a qualified tax professional.
5.4 Information Reporting Clarification — IRS and state reporting thresholds can change and may apply at amounts lower than expected.

──────────────────────────────────────────────
6. LEAD OWNERSHIP AND USE
──────────────────────────────────────────────

6.1 Agency leads remain Agency property.
6.2 Leads may not be sold, transferred, or used outside Agency authorization.
6.3 Upon termination, Agent must cease contact/use of Agency leads unless required by law.

──────────────────────────────────────────────
7. TECHNOLOGY AND PROPERTY
──────────────────────────────────────────────

Agency CRM, numbers, emails, automations, scripts, and systems remain Agency property. Access may be revoked at any time.

──────────────────────────────────────────────
8. PROGRAM PARTICIPATION TERMS
──────────────────────────────────────────────

8.1 Agent may participate in lead/JumpStart programs under Exhibit A.
8.2 Agency may adjust pricing/allocations due to operational costs.
8.3 JumpStart tiers are business-model payouts, not guaranteed wages.
8.4 Contract-Sign Gate — Sponsorship-track participants must execute this Agreement electronically before sponsored application submission/final processing.

──────────────────────────────────────────────
9. TERMINATION
──────────────────────────────────────────────

Either party may terminate with written notice. Agency may terminate immediately for misconduct, fraud, misrepresentation, or compliance violations.

──────────────────────────────────────────────
10. CONFIDENTIALITY / IP / NON-CIRCUMVENTION / BRAND PROTECTION
──────────────────────────────────────────────

Agent shall not disclose, copy, or commercialize Agency proprietary systems, methods, training, compensation logic, recruiting frameworks, automation, or operations. These protections survive termination.

──────────────────────────────────────────────
11. DISPUTE RESOLUTION
──────────────────────────────────────────────

11.1 Good-faith resolution first.
11.2 Binding arbitration (AAA or similar), venue in North Carolina.
11.3 Agency may seek injunctive relief in court for confidentiality/IP breaches.
11.4 Prevailing party may recover legal fees/costs where permitted by law.

──────────────────────────────────────────────
12. RECORDING CONSENT
──────────────────────────────────────────────

Trainings/calls/meetings may be recorded for quality/compliance. Agent consents.

──────────────────────────────────────────────
13. GOVERNING LAW
──────────────────────────────────────────────

State of North Carolina.

──────────────────────────────────────────────
14. ELECTRONIC RECORDS AND NOTICES
──────────────────────────────────────────────

Electronic signatures and records are binding. Email/platform notices are valid unless proven undelivered.

──────────────────────────────────────────────
15. ENTIRE AGREEMENT / SEVERABILITY / ASSIGNMENT / AMENDMENTS
──────────────────────────────────────────────

This Agreement plus Exhibit A is the entire agreement. If any provision is unenforceable, remaining provisions remain in force. Agent may not assign without written Agency consent. Amendments must be in writing.

──────────────────────────────────────────────
EXHIBIT A — COMPENSATION SCHEDULE
──────────────────────────────────────────────

Small Policy Total: $1,200
  Special Agent $600 / Regional Director $300 / Legacy Visionary $200 / Agency Owner $100

Large Policy Total: $2,400
  Special Agent $1,200 / Regional Director $600 / Legacy Visionary $400 / Agency Owner $200

• Unlicensed split: 50% initial + 50% held until licensing completion + first issued policy
• No double payout on skipped tiers
• Chargeback recoupment applies proportionally
• Default payout cadence: Friday, subject to compliance/carrier timing`;

// ── Compliance Addendum text ──────────────────────────────────────────────────
const ADDENDUM_TEXT = `THE LEGACY LINK
Agent Compliance & Coverage Addendum

This addendum is incorporated into and forms part of the Legacy Link Independent Contractor Agreement (ICA).

──────────────────────────────────────────────
1. POLICIES AND DISCLOSURES
──────────────────────────────────────────────

Agent acknowledges that certain policies and disclosures may be provided during onboarding or participation in Legacy Link programs. These documents may include the Agent Protection and Coverage Policy, Lead By Example Program Policy, Optional Coverage Acknowledgment, Suitability Questionnaire, and Premium Advancement terms. These documents are incorporated into and form part of the Independent Contractor Agreement.

──────────────────────────────────────────────
2. INSURANCE COMPLIANCE
──────────────────────────────────────────────

Agent acknowledges that participation in Legacy Link programs does not require the purchase of any insurance product. Any life insurance coverage discussed or obtained is optional and must comply with applicable suitability standards, underwriting guidelines, and state insurance regulations.

──────────────────────────────────────────────
3. OPTIONAL COMPANY SUPPORTED COVERAGE
──────────────────────────────────────────────

In certain circumstances, The Legacy Link may elect to cover or advance the cost of an initial life insurance policy for an agent as part of onboarding support. This support is intended to demonstrate the protection strategies taught to clients and is not considered compensation, employment benefit, or inducement to purchase insurance.

──────────────────────────────────────────────
4. PREMIUM ADVANCEMENT
──────────────────────────────────────────────

If The Legacy Link advances the premium for a policy obtained by an agent, the payment shall be treated as a premium advancement made on behalf of the agent. If the policy is voluntarily cancelled, surrendered, or allowed to lapse within twelve (12) months of issuance, The Legacy Link reserves the right, where permitted by law, to recover or offset any advanced premium amount.

──────────────────────────────────────────────
5. PERSISTENCY EXPECTATION
──────────────────────────────────────────────

When company supported coverage is used, policies are expected to remain in good standing for approximately twelve (12) months from issue date to demonstrate genuine insurance purpose and compliance with carrier guidelines.`;

// ── Suitability questions ─────────────────────────────────────────────────────
const SUITABILITY_QUESTIONS = [
  {
    id: 'q1',
    text: 'Do you currently have any life insurance coverage?',
    options: ['Yes', 'No'],
  },
  {
    id: 'q2',
    text: 'Do you have anyone who relies on you financially?',
    options: ['Spouse/Partner', 'Children', 'Family Members', 'Business Partner', 'None'],
    multi: true,
  },
  {
    id: 'q3',
    text: 'Do you currently have financial obligations that could create hardship if something happened to you?',
    options: ['Mortgage/Rent', 'Personal Debt', 'Business Obligations', 'Family Support', 'None'],
    multi: true,
  },
  {
    id: 'q4',
    text: 'Would your family or loved ones experience financial hardship if you passed away unexpectedly?',
    options: ['Yes', 'No', 'Unsure'],
  },
  {
    id: 'q5',
    text: 'Do you understand the purpose of life insurance and how it can protect your family or financial responsibilities?',
    options: ['Yes', 'No'],
  },
];

function computeSuitability(answers) {
  // Not suitable if: no dependents (q2=None), no obligations (q3=None), no hardship (q4=No), no understanding (q5=No)
  const q2 = answers.q2 || [];
  const q3 = answers.q3 || [];
  const q4 = answers.q4 || '';
  const q5 = answers.q5 || '';

  const noDependents = Array.isArray(q2) ? (q2.length === 0 || (q2.length === 1 && q2[0] === 'None')) : q2 === 'None';
  const noObligations = Array.isArray(q3) ? (q3.length === 0 || (q3.length === 1 && q3[0] === 'None')) : q3 === 'None';
  const noHardship = q4 === 'No';
  const noUnderstanding = q5 === 'No';

  const notSuitable = (noDependents && noObligations) || (noHardship && noUnderstanding);
  return !notSuitable;
}

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
  stepLabel: { fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#d4a12a', marginBottom: 8 },
  scrollBox: {
    border: '1px solid #1e293b', borderRadius: 12, background: '#060c1a',
    padding: '20px 22px', height: 320, overflowY: 'scroll',
    fontSize: 13, lineHeight: 1.7, color: '#cbd5e1', whiteSpace: 'pre-wrap',
    fontFamily: 'monospace', marginBottom: 12,
  },
  scrollHint: { fontSize: 12, color: '#64748b', textAlign: 'right', marginBottom: 20 },
  checkRow: { display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20, cursor: 'pointer' },
  checkBox: (checked) => ({
    width: 20, height: 20, minWidth: 20, borderRadius: 4,
    border: '2px solid #d4a12a', background: checked ? '#d4a12a' : '#060c1a',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
  }),
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
  btnGhost: {
    width: '100%', padding: '14px', borderRadius: 12,
    border: '1px solid #334155', background: 'transparent',
    color: '#94a3b8', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', marginTop: 10,
  },
  errorBox: { background: '#3f0d0d', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16 },
  infoBox: { background: '#0f2040', border: '1px solid #1e4080', borderRadius: 8, padding: '12px 16px', color: '#93c5fd', fontSize: 13, marginBottom: 16, lineHeight: 1.6 },
  warningBox: { background: '#2d1f00', border: '1px solid #92400e', borderRadius: 8, padding: '12px 16px', color: '#fbbf24', fontSize: 13, marginBottom: 16, lineHeight: 1.6 },
  successBox: {
    position: 'fixed', inset: 0, zIndex: 10000,
    background: '#0a0f1e', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  divider: { border: 'none', borderTop: '1px solid #1e293b', margin: '28px 0' },
  questionCard: {
    border: '1px solid #1e293b', borderRadius: 12, background: '#060c1a',
    padding: '18px 20px', marginBottom: 16,
  },
  questionText: { fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 12, lineHeight: 1.5 },
  optionRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' },
  optionDot: (selected) => ({
    width: 18, height: 18, minWidth: 18, borderRadius: '50%',
    border: `2px solid ${selected ? '#d4a12a' : '#334155'}`,
    background: selected ? '#d4a12a' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }),
  optionCheck: (selected) => ({
    width: 18, height: 18, minWidth: 18, borderRadius: 4,
    border: `2px solid ${selected ? '#d4a12a' : '#334155'}`,
    background: selected ? '#d4a12a' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }),
  optionLabel: { fontSize: 14, color: '#cbd5e1' },
};

// ── Step indicator ────────────────────────────────────────────────────────────
function StepDots({ step }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
      {[1, 2, 3].map((n) => (
        <div key={n} style={{
          height: 4, flex: 1, borderRadius: 999,
          background: n <= step ? '#d4a12a' : '#1e293b',
          transition: 'background .3s',
        }} />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ICAContractGate({ token, session, onSigned }) {
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(1); // 1=ICA, 2=Addendum, 3=Suitability
  const [icaScrolled, setIcaScrolled] = useState(false);
  const [icaAgreed, setIcaAgreed] = useState(false);
  const [addendumScrolled, setAddendumScrolled] = useState(false);
  const [addendumAgreed, setAddendumAgreed] = useState(false);
  const [answers, setAnswers] = useState({});
  const [allAnswered, setAllAnswered] = useState(false);
  const [suitable, setSuitable] = useState(null);
  const [optInPolicy, setOptInPolicy] = useState(false);
  const [optedOut, setOptedOut] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const icaScrollRef = useRef(null);
  const addendumScrollRef = useRef(null);

  useEffect(() => {
    if (!token) return;
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
          onSigned();
        } else {
          setReady(true);
        }
      } catch {
        if (mounted) setReady(true);
      }
    })();
    return () => { mounted = false; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update allAnswered when answers change
  useEffect(() => {
    const answered = SUITABILITY_QUESTIONS.every((q) => {
      const a = answers[q.id];
      if (q.multi) return Array.isArray(a) && a.length > 0;
      return Boolean(a);
    });
    setAllAnswered(answered);
    if (answered) {
      const s = computeSuitability(answers);
      setSuitable(s);
      if (!s) {
        setOptInPolicy(false);
        setOptedOut(true);
      }
    } else {
      setSuitable(null);
    }
  }, [answers]);

  function toggleMulti(qid, option) {
    setAnswers((prev) => {
      const current = Array.isArray(prev[qid]) ? prev[qid] : [];
      if (option === 'None') return { ...prev, [qid]: ['None'] };
      const withoutNone = current.filter((o) => o !== 'None');
      if (withoutNone.includes(option)) {
        return { ...prev, [qid]: withoutNone.filter((o) => o !== option) };
      }
      return { ...prev, [qid]: [...withoutNone, option] };
    });
  }

  function setSingle(qid, option) {
    setAnswers((prev) => ({ ...prev, [qid]: option }));
  }

  async function handleSubmit() {
    setError('');
    if (!typedName.trim()) { setError('Please type your full legal name to sign.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/esign-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'candidate_sign',
          typedName: typedName.trim(),
          signatureType: 'typed',
          suitabilityAnswers: answers,
          suitable,
          optInPolicy: optInPolicy && !optedOut,
          upline: session?.referredBy || session?.refCode || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Submission failed. Please try again.');
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

  if (!ready) return null;

  if (success) {
    return (
      <div style={S.successBox}>
        <div style={{ fontSize: 64 }}>✅</div>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: '#d4a12a', margin: 0 }}>Agreement Signed</h2>
        <p style={{ fontSize: 15, color: '#94a3b8', margin: 0, textAlign: 'center', maxWidth: 380 }}>
          Your Independent Contractor Agreement has been recorded. Loading your back office…
        </p>
      </div>
    );
  }

  return (
    <div style={S.overlay}>
      <div style={S.inner}>
        <div style={S.logo}>THE LEGACY LINK</div>
        <h1 style={S.title}>
          {step === 1 && 'Independent Contractor Agreement'}
          {step === 2 && 'Compliance & Coverage Addendum'}
          {step === 3 && 'Coverage Suitability & Policy Election'}
        </h1>
        <p style={S.subtitle}>
          {step === 1 && 'Read and sign the ICA before accessing your back office. One-time requirement.'}
          {step === 2 && 'Read and acknowledge the compliance addendum. Required before proceeding.'}
          {step === 3 && 'Complete your suitability assessment and make your policy election.'}
        </p>

        <StepDots step={step} />

        {/* ── STEP 1: ICA ── */}
        {step === 1 && (
          <>
            <div style={S.stepLabel}>Step 1 of 3 — Independent Contractor Agreement</div>
            <div
              ref={icaScrollRef}
              style={S.scrollBox}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setIcaScrolled(true);
              }}
            >
              {ICA_TEXT}
            </div>
            {!icaScrolled && <p style={S.scrollHint}>↓ Scroll to read the full agreement</p>}

            <div
              style={S.checkRow}
              onClick={() => setIcaAgreed((v) => !v)}
              role="checkbox"
              aria-checked={icaAgreed}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setIcaAgreed((v) => !v); }}
            >
              <div style={S.checkBox(icaAgreed)}>
                {icaAgreed && <span style={{ color: '#0a0f1e', fontWeight: 900, fontSize: 14 }}>✓</span>}
              </div>
              <span style={S.checkLabel}>
                I have read the full Independent Contractor Agreement and agree to all terms and conditions. I understand this is a legally binding agreement.
              </span>
            </div>

            <button
              type="button"
              style={icaAgreed ? S.btn : S.btnDisabled}
              disabled={!icaAgreed}
              onClick={() => setStep(2)}
            >
              Continue to Compliance Addendum →
            </button>
          </>
        )}

        {/* ── STEP 2: Addendum ── */}
        {step === 2 && (
          <>
            <div style={S.stepLabel}>Step 2 of 3 — Compliance & Coverage Addendum</div>
            <div
              ref={addendumScrollRef}
              style={S.scrollBox}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setAddendumScrolled(true);
              }}
            >
              {ADDENDUM_TEXT}
            </div>
            {!addendumScrolled && <p style={S.scrollHint}>↓ Scroll to read the full addendum</p>}

            <div
              style={S.checkRow}
              onClick={() => setAddendumAgreed((v) => !v)}
              role="checkbox"
              aria-checked={addendumAgreed}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setAddendumAgreed((v) => !v); }}
            >
              <div style={S.checkBox(addendumAgreed)}>
                {addendumAgreed && <span style={{ color: '#0a0f1e', fontWeight: 900, fontSize: 14 }}>✓</span>}
              </div>
              <span style={S.checkLabel}>
                I have read and acknowledge the Compliance & Coverage Addendum. I understand it is incorporated into my ICA.
              </span>
            </div>

            <button
              type="button"
              style={addendumAgreed ? S.btn : S.btnDisabled}
              disabled={!addendumAgreed}
              onClick={() => setStep(3)}
            >
              Continue to Suitability Assessment →
            </button>
            <button type="button" style={S.btnGhost} onClick={() => setStep(1)}>← Back</button>
          </>
        )}

        {/* ── STEP 3: Suitability + Sign ── */}
        {step === 3 && (
          <>
            <div style={S.stepLabel}>Step 3 of 3 — Suitability & Policy Election</div>

            <div style={S.infoBox}>
              Answer the questions below honestly. These help determine whether a company-funded life insurance policy is appropriate for you. Regardless of outcome, you can still fully participate in Legacy Link.
            </div>

            {SUITABILITY_QUESTIONS.map((q) => (
              <div key={q.id} style={S.questionCard}>
                <div style={S.questionText}>{q.text}</div>
                {q.multi ? (
                  q.options.map((opt) => {
                    const selected = Array.isArray(answers[q.id]) && answers[q.id].includes(opt);
                    return (
                      <div key={opt} style={S.optionRow} onClick={() => toggleMulti(q.id, opt)}>
                        <div style={S.optionCheck(selected)}>
                          {selected && <span style={{ color: '#0a0f1e', fontWeight: 900, fontSize: 11 }}>✓</span>}
                        </div>
                        <span style={S.optionLabel}>{opt}</span>
                      </div>
                    );
                  })
                ) : (
                  q.options.map((opt) => {
                    const selected = answers[q.id] === opt;
                    return (
                      <div key={opt} style={S.optionRow} onClick={() => setSingle(q.id, opt)}>
                        <div style={S.optionDot(selected)} />
                        <span style={S.optionLabel}>{opt}</span>
                      </div>
                    );
                  })
                )}
              </div>
            ))}

            {/* Suitability result + policy election */}
            {allAnswered && (
              <>
                <hr style={S.divider} />

                {suitable ? (
                  <>
                    <div style={{ ...S.infoBox, background: '#0a2a15', border: '1px solid #166534', color: '#86efac' }}>
                      ✅ Based on your responses, you appear to be a suitable candidate for life insurance coverage.
                    </div>

                    <div
                      style={{ ...S.checkRow, padding: '16px', border: `1px solid ${optInPolicy ? '#d4a12a' : '#334155'}`, borderRadius: 12, background: optInPolicy ? '#1a1200' : '#060c1a' }}
                      onClick={() => { setOptInPolicy((v) => !v); setOptedOut(false); }}
                      role="checkbox"
                      aria-checked={optInPolicy}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { setOptInPolicy((v) => !v); setOptedOut(false); } }}
                    >
                      <div style={S.checkBox(optInPolicy)}>
                        {optInPolicy && <span style={{ color: '#0a0f1e', fontWeight: 900, fontSize: 14 }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ ...S.checkLabel, fontWeight: 700, color: '#f1f5f9' }}>
                          I am suitable for insurance and choose to receive a company-funded policy
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          Subject to Agency approval and back office review. Optional — you can still participate without this.
                        </div>
                      </div>
                    </div>

                    {!optInPolicy && (
                      <div
                        style={{ ...S.checkRow, padding: '16px', border: `1px solid ${optedOut ? '#475569' : '#334155'}`, borderRadius: 12, background: '#060c1a', marginTop: -8 }}
                        onClick={() => { setOptedOut((v) => !v); setOptInPolicy(false); }}
                        role="checkbox"
                        aria-checked={optedOut}
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { setOptedOut((v) => !v); setOptInPolicy(false); } }}
                      >
                        <div style={S.checkBox(optedOut)}>
                          {optedOut && <span style={{ color: '#0a0f1e', fontWeight: 900, fontSize: 14 }}>✓</span>}
                        </div>
                        <div>
                          <div style={{ ...S.checkLabel, color: '#94a3b8' }}>
                            I prefer to opt out of the company-funded policy at this time
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                            You can still participate fully in Legacy Link.
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={S.warningBox}>
                      ⚠️ Based on your responses, a company-funded life insurance policy may not be suitable for you at this time. You can still fully participate in Legacy Link — the policy is optional. Please acknowledge below to continue.
                    </div>
                    <div
                      style={{ ...S.checkRow, padding: '16px', border: `1px solid ${optedOut ? '#475569' : '#334155'}`, borderRadius: 12, background: optedOut ? '#0f172a' : '#060c1a', cursor: 'pointer' }}
                      onClick={() => setOptedOut((v) => !v)}
                      role="checkbox"
                      aria-checked={optedOut}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setOptedOut((v) => !v); }}
                    >
                      <div style={S.checkBox(optedOut)}>
                        {optedOut && <span style={{ color: '#0a0f1e', fontWeight: 900, fontSize: 14 }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ ...S.checkLabel, color: '#e2e8f0', fontWeight: 700 }}>I understand I am not eligible for the company-funded policy at this time and wish to proceed</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>You can still participate fully in Legacy Link.</div>
                      </div>
                    </div>
                  </>
                )}

                <hr style={S.divider} />

                {/* Signature */}
                <label style={S.label} htmlFor="ica-typed-name">Type your full legal name to sign</label>
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

                {(optInPolicy || optedOut) ? null : (
                  <div style={S.infoBox}>Please make your policy selection above before signing.</div>
                )}

                {error && <div style={S.errorBox}>{error}</div>}

                <button
                  type="button"
                  style={(typedName.trim() && (optInPolicy || optedOut) && !submitting) ? S.btn : S.btnDisabled}
                  disabled={!typedName.trim() || (!optInPolicy && !optedOut) || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Signing…' : 'Sign & Complete →'}
                </button>

                <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 16 }}>
                  Your electronic signature is legally binding. By signing, you confirm the name above is your legal name.
                  Your electronic signature is legally binding. By signing, you confirm the name above is your legal name. Your suitability responses and policy election will be reviewed by The Legacy Link back office.
                </p>
              </>
            )}

            {!allAnswered && (
              <div style={{ ...S.infoBox, marginTop: 8 }}>
                Answer all questions above to proceed to signing.
              </div>
            )}

            <button type="button" style={{ ...S.btnGhost, marginTop: 16 }} onClick={() => setStep(2)}>← Back</button>
          </>
        )}
      </div>
    </div>
  );
}
