'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const STORAGE_KEY = 'legacy-sponsorship-applications-v1';

function normalizeRef(ref = '') {
  return String(ref).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function scoreApplication(form) {
  let score = 0;
  const breakdown = {};

  const age = Number(form.age || 0);
  breakdown.age = age >= 25 && age <= 55 ? 20 : 0;
  score += breakdown.age;

  breakdown.income = form.hasIncome === 'yes' ? 20 : 0;
  score += breakdown.income;

  breakdown.health = ['Excellent', 'Good'].includes(form.healthStatus) ? 15 : 0;
  score += breakdown.health;

  breakdown.whyJoin = String(form.whyJoin || '').trim().length > 100 ? 15 : 0;
  score += breakdown.whyJoin;

  breakdown.motivation = ['Very Motivated', 'Extremely Motivated'].includes(form.motivation) ? 15 : 0;
  score += breakdown.motivation;

  breakdown.hours = ['20-30 hours', '30+ hours'].includes(form.hoursPerWeek) ? 15 : 0;
  score += breakdown.hours;

  return { score, breakdown, status: score >= 75 ? 'Qualified' : 'Pending Review' };
}

export default function SponsorshipApplicationPage() {
  const router = useRouter();
  const [ref, setRef] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [termsViewed, setTermsViewed] = useState(false);
  const [termsScrollReady, setTermsScrollReady] = useState(false);
  const termsBodyRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    setRef(normalizeRef(sp.get('ref') || ''));
  }, []);



  useEffect(() => {
    if (!showTerms) return;
    const el = termsBodyRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 2) {
      setTermsScrollReady(true);
    }
  }, [showTerms]);

  const signupSeed = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('legacy-sponsor-signup');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const [form, setForm] = useState({
    firstName: signupSeed?.firstName || '',
    lastName: signupSeed?.lastName || '',
    age: '',
    state: '',
    email: '',
    phone: signupSeed?.phone || '',
    hasIncome: 'no',
    incomeSource: '',
    isLicensed: 'no',
    licenseDetails: '',
    healthStatus: '',
    whyJoin: '',
    goal12Month: '',
    motivation: '',
    hoursPerWeek: '',
    heardFrom: ref ? 'Agent Referral' : '',
    referralName: '',
    referralOther: '',
    agreeTraining: false,
    agreeWeekly: false,
    agreeService: false,
    agreeTerms: false
  });
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setValidationErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const phone = String(form.phone || '').replace(/\D/g, '');
    const age = Number(form.age || 0);
    const fieldErrors = {};

    if (!form.firstName.trim()) fieldErrors.firstName = true;
    if (!form.lastName.trim()) fieldErrors.lastName = true;
    if (!form.state.trim()) fieldErrors.state = true;
    if (!form.email.trim()) fieldErrors.email = true;
    if (!phone || phone.length < 10) fieldErrors.phone = true;
    if (!form.age || age < 18 || age > 100) fieldErrors.age = true;

    if (form.hasIncome === 'yes' && !form.incomeSource.trim()) {
      fieldErrors.incomeSource = true;
    }
    if (form.isLicensed === 'yes' && !form.licenseDetails.trim()) {
      fieldErrors.licenseDetails = true;
    }

    if (String(form.whyJoin || '').trim().length < 50) fieldErrors.whyJoin = true;
    if (String(form.goal12Month || '').trim().length < 20) fieldErrors.goal12Month = true;

    if (!termsViewed) fieldErrors.termsViewed = true;
    if (!form.agreeTraining) fieldErrors.agreeTraining = true;
    if (!form.agreeWeekly) fieldErrors.agreeWeekly = true;
    if (!form.agreeService) fieldErrors.agreeService = true;
    if (!form.agreeTerms) fieldErrors.agreeTerms = true;

    if (Object.keys(fieldErrors).length > 0) {
      setValidationErrors(fieldErrors);
      setError('Please complete highlighted fields before submitting.');
      setTimeout(() => {
        const first = document.querySelector('.errorInput, .errorCheck');
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 10);
      return;
    }

    setValidationErrors({});
    setError('');

    const scoring = scoreApplication(form);
    const id = `sapp_${Date.now()}`;
    const record = {
      id,
      ...form,
      phone,
      age,
      refCode: ref || signupSeed?.refCode || '',
      referralLocked: Boolean(ref || signupSeed?.refCode),
      status: scoring.status,
      application_score: scoring.score,
      score_breakdown: scoring.breakdown,
      submitted_at: new Date().toISOString(),
      onboarding_status: 'Needs Contact'
    };

    if (typeof window !== 'undefined') {
      let list = [];
      try {
        list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      } catch {
        list = [];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...list]));
      sessionStorage.setItem('legacy-active-sponsorship-id', id);
    }

    router.push(`/sponsorship-contract?id=${encodeURIComponent(id)}`);
  };

  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 920 }}>
        <div style={{ display: 'grid', gap: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <img
              src="/legacy-link-sponsorship-badge.jpg"
              alt="Legacy Link"
              style={{ width: 76, height: 76, borderRadius: 999, objectFit: 'cover', border: '2px solid #dbe5f5' }}
            />
            <div>
              <h2 style={{ margin: 0 }}>Legacy Link Sponsorship Application</h2>
              <p className="muted" style={{ margin: '4px 0 0 0' }}>
                Complete this form to see if you qualify for our sponsorship program.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className="pill" style={{ background: '#eef3ff', color: '#1e3a8a', borderColor: '#c7d2fe' }}>👥 Join 200+ successful agents</span>
            <span className="pill" style={{ background: '#fff1f2', color: '#9f1239', borderColor: '#fecdd3' }}>🚀 Spots are limited</span>
          </div>

          <div style={{ border: '1px solid #bfdbfe', borderRadius: 12, background: '#eff6ff', padding: 14 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10, color: '#1e3a8a' }}>Program Benefits</h3>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
              <li>Remove the cost barrier for licensing, CRM, leads, and training</li>
              <li>Earn bonuses while you learn with our JumpStart program</li>
              <li>Full training, mentorship, and support system included</li>
            </ul>
          </div>
        </div>

        {ref ? <p className="pill onpace">Referral locked to code: {ref}</p> : null}

        <form className="logForm" onSubmit={onSubmit}>
          <label>First Name<input className={validationErrors.firstName ? 'errorInput' : ''} value={form.firstName} onChange={(e) => update('firstName', e.target.value)} /></label>
          <label>Last Name<input className={validationErrors.lastName ? 'errorInput' : ''} value={form.lastName} onChange={(e) => update('lastName', e.target.value)} /></label>
          <label>Age<input className={validationErrors.age ? 'errorInput' : ''} type="number" value={form.age} onChange={(e) => update('age', e.target.value)} /></label>
          <label>State<input className={validationErrors.state ? 'errorInput' : ''} value={form.state} onChange={(e) => update('state', e.target.value)} /></label>
          <label>Email<input className={validationErrors.email ? 'errorInput' : ''} type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></label>
          <label>Phone<input className={validationErrors.phone ? 'errorInput' : ''} value={form.phone} onChange={(e) => update('phone', e.target.value)} /></label>

          <label>
            Reliable Source of Income?
            <select value={form.hasIncome} onChange={(e) => update('hasIncome', e.target.value)}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <label>
            Income Source
            <input className={validationErrors.incomeSource ? 'errorInput' : ''} value={form.incomeSource} onChange={(e) => update('incomeSource', e.target.value)} placeholder="Job, spouse, savings..." />
          </label>

          <label>
            Currently licensed to sell insurance?
            <select value={form.isLicensed} onChange={(e) => update('isLicensed', e.target.value)}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <label>
            Licensing details
            <input className={validationErrors.licenseDetails ? 'errorInput' : ''} value={form.licenseDetails} onChange={(e) => update('licenseDetails', e.target.value)} placeholder="States, years, company" />
          </label>

          <label>
            Health Status
            <select value={form.healthStatus} onChange={(e) => update('healthStatus', e.target.value)}>
              <option value="">Select</option>
              {['Excellent', 'Good', 'Fair', 'Poor'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            Motivation Level
            <select value={form.motivation} onChange={(e) => update('motivation', e.target.value)}>
              <option value="">Select</option>
              {['Slightly Motivated', 'Moderately Motivated', 'Very Motivated', 'Extremely Motivated'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label>
            Hours per week available
            <select value={form.hoursPerWeek} onChange={(e) => update('hoursPerWeek', e.target.value)}>
              <option value="">Select</option>
              {['0-10 hours', '10-20 hours', '20-30 hours', '30+ hours'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label>
            How did you hear about us?
            <select
              value={form.heardFrom}
              onChange={(e) => update('heardFrom', e.target.value)}
              disabled={Boolean(ref)}
            >
              <option value="">Select</option>
              {['Agent Referral', 'Social Media', 'Friend/Family', 'Event', 'Other'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            Referral / Source details
            <input
              value={form.referralName}
              onChange={(e) => update('referralName', e.target.value)}
              placeholder={ref ? 'Referral locked via personal link' : 'Agent name or source detail'}
              disabled={Boolean(ref)}
            />
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            Why do you want to join Legacy Link?
            <textarea className={validationErrors.whyJoin ? 'errorInput' : ''} value={form.whyJoin} onChange={(e) => update('whyJoin', e.target.value)} />
            <small className={validationErrors.whyJoin ? 'red' : 'muted'}>{String(form.whyJoin || '').trim().length}/50 minimum</small>
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            What is your #1 goal in the next 12 months?
            <textarea className={validationErrors.goal12Month ? 'errorInput' : ''} value={form.goal12Month} onChange={(e) => update('goal12Month', e.target.value)} />
            <small className={validationErrors.goal12Month ? 'red' : 'muted'}>{String(form.goal12Month || '').trim().length}/20 minimum</small>
          </label>

          <label className={validationErrors.agreeTraining ? 'errorCheck' : ''} style={{ gridColumn: '1 / -1' }}><input type="checkbox" checked={form.agreeTraining} onChange={(e) => update('agreeTraining', e.target.checked)} /> I commit to following training and systems.</label>
          <label className={validationErrors.agreeWeekly ? 'errorCheck' : ''} style={{ gridColumn: '1 / -1' }}><input type="checkbox" checked={form.agreeWeekly} onChange={(e) => update('agreeWeekly', e.target.checked)} /> I agree to attend at least ONE weekly training.</label>
          <label className={validationErrors.agreeService ? 'errorCheck' : ''} style={{ gridColumn: '1 / -1' }}><input type="checkbox" checked={form.agreeService} onChange={(e) => update('agreeService', e.target.checked)} /> I agree to one hour community service monthly.</label>

          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="ghost" onClick={() => { setTermsScrollReady(false); setShowTerms(true); }}>View Terms & Conditions</button>
            {termsViewed ? <span className="pill onpace">Terms viewed</span> : <span className={`pill ${validationErrors.termsViewed ? 'offpace' : 'atrisk'}`}>Terms not viewed</span>}
          </div>

          <label className={validationErrors.agreeTerms ? 'errorCheck' : ''} style={{ gridColumn: '1 / -1' }}>
            <input
              type="checkbox"
              checked={form.agreeTerms}
              onChange={(e) => update('agreeTerms', e.target.checked)}
              disabled={!termsViewed}
            />{' '}
            I have read and agree to Terms & Conditions.
          </label>

          <div className="rowActions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit">Submit Application</button>
          </div>
          {error ? <p className="red" style={{ gridColumn: '1 / -1', marginTop: 0 }}>{error}</p> : null}
        </form>
      </div>

      {showTerms ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50,
            padding: 16
          }}
          onClick={() => setShowTerms(false)}
        >
          <div className="panel" style={{ width: 'min(900px, 96vw)', maxHeight: '82vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="panelRow">
              <h3 style={{ margin: 0 }}>Sponsorship Agreement Terms</h3>
              <button type="button" className="ghost" onClick={() => setShowTerms(false)}>Close</button>
            </div>

            <div
              ref={termsBodyRef}
              style={{ maxHeight: '56vh', overflowY: 'auto', paddingRight: 6 }}
              onScroll={(e) => {
                const el = e.currentTarget;
                const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
                if (nearBottom) setTermsScrollReady(true);
              }}
            >
              <ol>
                <li><strong>Referral Bonus:</strong> $400 per qualified referral with validated attribution.</li>
                <li><strong>Payout Trigger:</strong> Approval alone does not trigger payout. Payout requires onboarding initiation and required onboarding documents complete.</li>
                <li><strong>Licensed and Unlicensed Paths:</strong> Both accepted. Licensed applicants must provide licensing details. Unlicensed applicants must begin pre-licensing for full activation.</li>
                <li><strong>Training Commitment:</strong> Agent agrees to follow Legacy Link systems and attend at least one weekly training session.</li>
                <li><strong>Community Service Requirement:</strong> Agent agrees to complete at least one hour of community service each month as a core part of Legacy Link culture and leadership standards.</li>
                <li><strong>Compliance & Accountability:</strong> Company may hold, suspend, or deny payouts for non-compliance, inactivity, fraudulent attribution, or incomplete onboarding requirements.</li>
                <li><strong>No Income Guarantee:</strong> No guarantee of commissions, bonuses, promotions, or production results.</li>
                <li><strong>Tax Responsibility:</strong> Agent is responsible for all tax reporting and obligations. Company may issue 1099 where required.</li>
                <li><strong>Policy Updates:</strong> Company may update program terms and compensation structures with notice.</li>
              </ol>
            </div>

            <div className="rowActions" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <small className="muted">{termsScrollReady ? '✅ You reached the end.' : 'Scroll to the bottom to enable acceptance.'}</small>
              <button
                type="button"
                disabled={!termsScrollReady}
                onClick={() => {
                  setTermsViewed(true);
                  setValidationErrors((prev) => {
                    if (!prev.termsViewed && !prev.agreeTerms) return prev;
                    const next = { ...prev };
                    delete next.termsViewed;
                    delete next.agreeTerms;
                    return next;
                  });
                  setShowTerms(false);
                }}
              >
                I Have Read Terms & Conditions
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
