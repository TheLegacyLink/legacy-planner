'use client';

import { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    setRef(normalizeRef(sp.get('ref') || ''));
  }, []);

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

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = (e) => {
    e.preventDefault();
    const phone = String(form.phone || '').replace(/\D/g, '');
    const age = Number(form.age || 0);

    if (!form.firstName.trim() || !form.lastName.trim() || !form.state.trim() || !form.email.trim()) {
      setError('Please complete all required personal information fields.');
      return;
    }
    if (age < 18 || age > 100) {
      setError('Age must be between 18 and 100.');
      return;
    }
    if (phone.length < 10) {
      setError('Phone number must be at least 10 digits.');
      return;
    }
    if (form.hasIncome === 'yes' && !form.incomeSource.trim()) {
      setError('Please provide your income source.');
      return;
    }
    if (form.isLicensed === 'yes' && !form.licenseDetails.trim()) {
      setError('Please provide licensing details (states, years, company).');
      return;
    }
    if (String(form.whyJoin || '').trim().length < 50 || String(form.goal12Month || '').trim().length < 20) {
      setError('Please complete the Why Join and 12-month goal responses.');
      return;
    }
    if (!termsViewed) {
      setError('Please open and review Terms & Conditions before accepting.');
      return;
    }
    if (!form.agreeTraining || !form.agreeWeekly || !form.agreeService || !form.agreeTerms) {
      setError('All agreement checkboxes are required.');
      return;
    }

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
        <h3 style={{ marginTop: 0 }}>Application</h3>
        {ref ? <p className="pill onpace">Referral locked to code: {ref}</p> : null}

        <form className="logForm" onSubmit={onSubmit}>
          <label>First Name<input value={form.firstName} onChange={(e) => update('firstName', e.target.value)} /></label>
          <label>Last Name<input value={form.lastName} onChange={(e) => update('lastName', e.target.value)} /></label>
          <label>Age<input type="number" value={form.age} onChange={(e) => update('age', e.target.value)} /></label>
          <label>State<input value={form.state} onChange={(e) => update('state', e.target.value)} /></label>
          <label>Email<input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></label>
          <label>Phone<input value={form.phone} onChange={(e) => update('phone', e.target.value)} /></label>

          <label>
            Reliable Source of Income?
            <select value={form.hasIncome} onChange={(e) => update('hasIncome', e.target.value)}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <label>
            Income Source
            <input value={form.incomeSource} onChange={(e) => update('incomeSource', e.target.value)} placeholder="Job, spouse, savings..." />
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
            <input value={form.licenseDetails} onChange={(e) => update('licenseDetails', e.target.value)} placeholder="States, years, company" />
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
            <textarea value={form.whyJoin} onChange={(e) => update('whyJoin', e.target.value)} />
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            What is your #1 goal in the next 12 months?
            <textarea value={form.goal12Month} onChange={(e) => update('goal12Month', e.target.value)} />
          </label>

          <label style={{ gridColumn: '1 / -1' }}><input type="checkbox" checked={form.agreeTraining} onChange={(e) => update('agreeTraining', e.target.checked)} /> I commit to following training and systems.</label>
          <label style={{ gridColumn: '1 / -1' }}><input type="checkbox" checked={form.agreeWeekly} onChange={(e) => update('agreeWeekly', e.target.checked)} /> I agree to attend at least ONE weekly training.</label>
          <label style={{ gridColumn: '1 / -1' }}><input type="checkbox" checked={form.agreeService} onChange={(e) => update('agreeService', e.target.checked)} /> I agree to one hour community service monthly.</label>

          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="ghost" onClick={() => setShowTerms(true)}>View Terms & Conditions</button>
            {termsViewed ? <span className="pill onpace">Terms viewed</span> : <span className="pill atrisk">Terms not viewed</span>}
          </div>

          <label style={{ gridColumn: '1 / -1' }}>
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
          <div className="panel" style={{ width: 'min(900px, 96vw)', maxHeight: '82vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="panelRow">
              <h3 style={{ margin: 0 }}>Sponsorship Agreement Terms</h3>
              <button type="button" className="ghost" onClick={() => setShowTerms(false)}>Close</button>
            </div>
            <ol>
              <li><strong>Referral Bonus:</strong> $400 per qualified referral with validated attribution.</li>
              <li><strong>Payout Trigger:</strong> Approval alone does not trigger payout. Payout requires onboarding initiation and required onboarding documents complete.</li>
              <li><strong>Licensed and Unlicensed Paths:</strong> Both accepted. Licensed applicants must provide licensing details. Unlicensed applicants must begin pre-licensing for full activation.</li>
              <li><strong>No Income Guarantee:</strong> No guarantee of commissions, bonuses, or production results.</li>
              <li><strong>Compliance:</strong> Company may hold, suspend, or deny payouts for non-compliance, inactivity, fraudulent attribution, or incomplete onboarding.</li>
              <li><strong>Tax Responsibility:</strong> Agent is responsible for all tax reporting and obligations. Company may issue 1099 where required.</li>
              <li><strong>Policy Updates:</strong> Company may update program terms and compensation structures with notice.</li>
            </ol>
            <div className="rowActions">
              <button
                type="button"
                onClick={() => {
                  setTermsViewed(true);
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
