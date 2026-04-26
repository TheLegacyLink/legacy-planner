'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const STORAGE_KEY = 'legacy-sponsorship-applications-v1';

function normalizeRef(ref = '') {
  const cleaned = String(ref).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (cleaned === 'latricia_wright') return 'leticia_wright';
  return cleaned;
}

function calculateAgeFromBirthday(birthday = '') {
  const dob = new Date(birthday);
  if (Number.isNaN(dob.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}

function getFieldErrors(form, termsViewed, referralLocked = false) {
  const phone = String(form.phone || '').replace(/\D/g, '');
  const age = Number(form.age || 0);
  const fieldErrors = {};

  if (!form.firstName.trim()) fieldErrors.firstName = true;
  if (!form.lastName.trim()) fieldErrors.lastName = true;
  if (!form.state.trim()) fieldErrors.state = true;
  if (!form.email.trim()) fieldErrors.email = true;
  if (!phone || phone.length < 10) fieldErrors.phone = true;
  if (!String(form.birthday || '').trim()) fieldErrors.birthday = true;
  if (!form.age || age < 18 || age > 100) fieldErrors.age = true;

  if (!String(form.healthStatus || '').trim()) fieldErrors.healthStatus = true;
  if (!String(form.motivation || '').trim()) fieldErrors.motivation = true;
  if (!String(form.hoursPerWeek || '').trim()) fieldErrors.hoursPerWeek = true;

  if (!String(form.hasIncome || '').trim()) fieldErrors.hasIncome = true;
  if (form.hasIncome === 'yes' && !form.incomeSource.trim()) fieldErrors.incomeSource = true;
  if (form.hasIncome === 'yes' && !String(form.annualIncome || '').trim()) fieldErrors.annualIncome = true;
  if (!String(form.creditScore || '').trim()) fieldErrors.creditScore = true;
  if (!String(form.isLicensed || '').trim()) fieldErrors.isLicensed = true;
  if (form.isLicensed === 'yes' && !form.licenseDetails.trim()) fieldErrors.licenseDetails = true;

  if (!referralLocked && !String(form.referralName || '').trim()) fieldErrors.referralName = true;

  if (String(form.whyJoin || '').trim().length < 50) fieldErrors.whyJoin = true;
  if (String(form.goal12Month || '').trim().length < 20) fieldErrors.goal12Month = true;

  if (!termsViewed) fieldErrors.termsViewed = true;
  if (!form.agreeTraining) fieldErrors.agreeTraining = true;
  if (!form.agreeWeekly) fieldErrors.agreeWeekly = true;
  if (!form.agreeService) fieldErrors.agreeService = true;
  if (!form.agreeTerms) fieldErrors.agreeTerms = true;

  return fieldErrors;
}


function determineDecision(score) {
  if (score >= 70) {
    return {
      decision_bucket: 'auto_approved',
      status: 'Approved – Onboarding Pending',
      onboarding_status: 'Call Booking Pending'
    };
  }
  if (score >= 40) {
    return {
      decision_bucket: 'manual_review',
      status: 'Pending Review',
      onboarding_status: 'Needs Review'
    };
  }
  return {
    decision_bucket: 'not_qualified',
    status: 'Not Qualified At This Time',
    onboarding_status: 'Nurture / Reapply Later'
  };
}

function computeUpsellTier(form) {
  const income = String(form.annualIncome || '');
  const credit = String(form.creditScore || '');
  const accelerate = String(form.wantsToAccelerate || '') === 'yes';
  const hasIncome = String(form.hasIncome || '') === 'yes';

  if (!accelerate) return { tier: 'standard', label: 'Standard Onboarding', pitch: '' };

  const highIncome = income === '60k_100k' || income === '100k_plus';
  const midIncome = income === '30k_60k';
  const goodCredit = credit === '670_739' || credit === '740_plus';
  const excellentCredit = credit === '740_plus';

  // Agency Ownership: $60K+ income AND 700+ credit
  if (hasIncome && highIncome && (excellentCredit || credit === '670_739')) {
    return {
      tier: 'agency_ownership',
      label: '🏆 Agency Ownership Candidate',
      pitch: 'Build your own agency, override your agents, and create 6–7 figure generational income.'
    };
  }

  // Inner Circle: good credit (700+) even without income
  if (!hasIncome && excellentCredit) {
    return {
      tier: 'inner_circle',
      label: '⭐ Inner Circle Candidate',
      pitch: 'Disciplined financial profile. Fast-track access to Kimora, premium mentorship, and $3K–$12K/month potential.'
    };
  }

  // Inner Circle: mid income any credit
  if (hasIncome && midIncome) {
    return {
      tier: 'inner_circle',
      label: '⭐ Inner Circle Candidate',
      pitch: 'Strong candidate for accelerated results. Direct mentorship path to $3K–$12K/month extra.'
    };
  }

  // Inner Circle: any income + good credit
  if (hasIncome && goodCredit) {
    return {
      tier: 'inner_circle',
      label: '⭐ Inner Circle Candidate',
      pitch: 'Strong financial profile. Positioned for $3K–$12K/month with the right mentorship.'
    };
  }

  return { tier: 'standard', label: 'Standard Onboarding', pitch: '' };
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
    birthday: '',
    state: '',
    email: '',
    phone: signupSeed?.phone || '',
    hasIncome: '',
    incomeSource: '',
    annualIncome: '',
    creditScore: '',
    wantsToAccelerate: '',
    isLicensed: '',
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
    setForm((prev) => {
      if (key === 'birthday') {
        const derivedAge = calculateAgeFromBirthday(value);
        return { ...prev, birthday: value, age: derivedAge > 0 ? String(derivedAge) : '' };
      }
      return { ...prev, [key]: value };
    });
    setValidationErrors((prev) => {
      if (!prev[key] && !(key === 'birthday' && prev.age)) return prev;
      const next = { ...prev };
      delete next[key];
      if (key === 'birthday') delete next.age;
      return next;
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const phone = String(form.phone || '').replace(/\D/g, '');
    const age = Number(form.age || 0);
    const fieldErrors = getFieldErrors(form, termsViewed, Boolean(ref || signupSeed?.refCode));

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
    const decision = determineDecision(scoring.score);
    const upsellTier = computeUpsellTier(form);
    const id = `sapp_${Date.now()}`;
    const record = {
      id,
      ...form,
      phone,
      age,
      birthday: String(form.birthday || '').trim(),
      refCode: ref || signupSeed?.refCode || '',
      referralLocked: Boolean(ref || signupSeed?.refCode),
      status: decision.status,
      decision_bucket: decision.decision_bucket,
      application_score: scoring.score,
      score_breakdown: scoring.breakdown,
      upsell_tier: upsellTier.tier,
      upsell_label: upsellTier.label,
      upsell_pitch: upsellTier.pitch,
      submitted_at: new Date().toISOString(),
      approved_at: decision.decision_bucket === 'auto_approved' ? new Date().toISOString() : null,
      onboarding_status: decision.onboarding_status
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

    try {
      await fetch('/api/sponsorship-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'submit', ...record })
      });
    } catch {
      // non-blocking backup is localStorage
    }

    router.push(`/sponsorship-contract?id=${encodeURIComponent(id)}`);
  };

  const liveScore = scoreApplication(form);
  const liveDecision = determineDecision(liveScore.score);
  const pendingErrors = getFieldErrors(form, termsViewed, Boolean(ref || signupSeed?.refCode));
  const missingCount = Object.keys(pendingErrors).length;

  const phoneDigits = String(form.phone || '').replace(/\D/g, '');
  const ageNum = Number(form.age || 0);
  const personalReady = Boolean(
    form.firstName.trim() && form.lastName.trim() && form.state.trim() && form.email.trim() &&
    phoneDigits.length >= 10 && String(form.birthday || '').trim() && form.age && ageNum >= 18 && ageNum <= 100
  );
  const fitReady = Boolean(
    (form.hasIncome !== 'yes' || form.incomeSource.trim()) &&
    (form.isLicensed !== 'yes' || form.licenseDetails.trim()) &&
    String(form.whyJoin || '').trim().length >= 50 &&
    String(form.goal12Month || '').trim().length >= 20
  );
  const agreementsReady = Boolean(form.agreeTraining && form.agreeWeekly && form.agreeService && form.agreeTerms);
  const stepsCompleted = [personalReady, fitReady, termsViewed, agreementsReady].filter(Boolean).length;
  const progressPct = Math.round((stepsCompleted / 4) * 100);

  // Premium design tokens
  const G = '#d4af37';
  const BG = '#08111f';
  const CARD = '#0f1c2e';
  const BORDER = '#1e3a5f';
  const INPUT_BG = '#0a1628';
  const INPUT_BORDER = '#1e3a5f';
  const INPUT_ERR = '#7f1d1d';
  const TEXT = '#f1f5f9';
  const MUTED = '#64748b';

  const fieldStyle = (hasErr = false) => ({
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: `1px solid ${hasErr ? '#ef4444' : INPUT_BORDER}`,
    background: hasErr ? 'rgba(239,68,68,0.08)' : INPUT_BG,
    color: TEXT,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  });

  const labelStyle = { display: 'grid', gap: 6, fontSize: 13, color: MUTED, fontWeight: 500, letterSpacing: 0.3 };

  const sectionHeader = (title, subtitle = '') => (
    <div style={{ gridColumn: '1 / -1', borderBottom: `1px solid ${BORDER}`, paddingBottom: 10, marginBottom: 4, marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: G, letterSpacing: 1.5, textTransform: 'uppercase' }}>{title}</div>
      {subtitle ? <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{subtitle}</div> : null}
    </div>
  );

  return (
    <main style={{ minHeight: '100vh', background: BG, padding: '0 0 80px', display: 'grid', alignContent: 'start', justifyItems: 'center' }}>

      {/* Hero header */}
      <div style={{ width: '100%', background: `linear-gradient(135deg, #06101f 0%, #0d1f3c 100%)`, borderBottom: `1px solid ${BORDER}`, padding: '32px 24px', textAlign: 'center', marginBottom: 24 }}>
        <img src="/legacy-link-logo-official.png" alt="Legacy Link" style={{ width: 64, height: 64, borderRadius: 999, objectFit: 'contain', background: '#0047AB', padding: 8, border: `2px solid ${G}`, marginBottom: 16, display: 'block', margin: '0 auto 16px' }} />
        <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: TEXT, letterSpacing: -0.5 }}>Legacy Link Sponsorship Application</h1>
        <p style={{ margin: 0, color: MUTED, fontSize: 14 }}>Complete this form to see if you qualify for our sponsorship program.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
          {['👥 200+ Agents Nationwide', '🚀 Limited Spots Available', '🔒 Secure & Private', '⏱ 24-Hr Review'].map((t) => (
            <span key={t} style={{ background: 'rgba(212,175,55,0.1)', border: `1px solid rgba(212,175,55,0.3)`, borderRadius: 999, padding: '4px 12px', fontSize: 12, color: G, fontWeight: 600 }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Main card */}
      <div style={{ width: 'min(940px, 100%)', padding: '0 16px' }}>

        {/* Progress */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Application Progress</span>
            <span style={{ fontSize: 12, color: G, fontWeight: 700 }}>{progressPct}% Complete</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: '#1e3a5f', overflow: 'hidden' }}>
            <div style={{ width: `${progressPct}%`, height: '100%', background: `linear-gradient(90deg, ${G}, #22c55e)`, transition: 'width .3s ease', borderRadius: 999 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {[['Personal Info', personalReady], ['Qualification', fitReady], ['Agreements', agreementsReady]].map(([label, done]) => (
              <span key={label} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, border: `1px solid ${done ? '#16a34a' : BORDER}`, background: done ? 'rgba(22,163,74,0.12)' : 'transparent', color: done ? '#4ade80' : MUTED }}>{done ? '✅' : '●'} {label}</span>
            ))}
          </div>
        </div>

        {/* Live score */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Live Qualification Score</span>
          <span style={{
            fontSize: 13, fontWeight: 700, padding: '4px 14px', borderRadius: 999,
            background: liveDecision.decision_bucket === 'auto_approved' ? 'rgba(22,163,74,0.15)' : liveDecision.decision_bucket === 'manual_review' ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.12)',
            border: `1px solid ${liveDecision.decision_bucket === 'auto_approved' ? '#16a34a' : liveDecision.decision_bucket === 'manual_review' ? '#d97706' : '#ef4444'}`,
            color: liveDecision.decision_bucket === 'auto_approved' ? '#4ade80' : liveDecision.decision_bucket === 'manual_review' ? '#fbbf24' : '#f87171'
          }}>{liveScore.score}/100 — {liveDecision.status}</span>
        </div>

        {ref ? <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid #16a34a', borderRadius: 10, padding: '10px 16px', marginBottom: 16, color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✅ Referral attribution secured.</div> : null}

        {/* Program benefits */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${G}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: G, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>Program Benefits</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {[
              ['No cost barrier', 'We remove the cost of licensing, CRM, leads, and training.'],
              ['Earn while you learn', 'JumpStart bonuses activate as soon as you’re moving.'],
              ['Full support system', 'Training, mentorship, and a team that’s invested in your win.'],
            ].map(([title, desc]) => (
              <div key={title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: G, fontSize: 16, marginTop: 1 }}>▸</span>
                <div><span style={{ color: TEXT, fontWeight: 600, fontSize: 13 }}>{title}</span><span style={{ color: MUTED, fontSize: 13 }}> — {desc}</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '24px 24px 28px' }}>
          <form id="sponsor-app-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px 20px' }} onSubmit={onSubmit}>

            {sectionHeader('Personal Information')}
            <label style={labelStyle}>First Name<input style={fieldStyle(validationErrors.firstName)} value={form.firstName} onChange={(e) => update('firstName', e.target.value)} /></label>
            <label style={labelStyle}>Last Name<input style={fieldStyle(validationErrors.lastName)} value={form.lastName} onChange={(e) => update('lastName', e.target.value)} /></label>
            <label style={labelStyle}>Birthday<input type="date" style={fieldStyle(validationErrors.birthday)} value={form.birthday} onChange={(e) => update('birthday', e.target.value)} /></label>
            <label style={labelStyle}>Age (auto-calculated)<input type="number" style={{ ...fieldStyle(validationErrors.age), opacity: 0.7 }} value={form.age} readOnly /></label>
            <label style={labelStyle}>State<input style={fieldStyle(validationErrors.state)} value={form.state} onChange={(e) => update('state', e.target.value)} placeholder="e.g. New Jersey" /></label>
            <label style={labelStyle}>Email<input type="email" style={fieldStyle(validationErrors.email)} value={form.email} onChange={(e) => update('email', e.target.value)} /></label>
            <label style={labelStyle}>Phone<input style={fieldStyle(validationErrors.phone)} value={form.phone} onChange={(e) => update('phone', e.target.value)} /></label>

            {sectionHeader('Financial Profile', 'This helps us match you with the right path.')}
            <label style={labelStyle}>
              Reliable Source of Income?
              <select style={fieldStyle(validationErrors.hasIncome)} value={form.hasIncome} onChange={(e) => update('hasIncome', e.target.value)}>
                <option value="">Select one</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>

            {form.hasIncome === 'yes' && (
              <label style={labelStyle}>
                Income Source
                <input style={fieldStyle(validationErrors.incomeSource)} value={form.incomeSource} onChange={(e) => update('incomeSource', e.target.value)} placeholder="Job, business, spouse..." />
              </label>
            )}

            {form.hasIncome === 'yes' && (
              <label style={labelStyle}>
                Approximate Annual Income
                <select style={fieldStyle(validationErrors.annualIncome)} value={form.annualIncome} onChange={(e) => update('annualIncome', e.target.value)}>
                  <option value="">Select range</option>
                  <option value="under_30k">Under $30,000</option>
                  <option value="30k_60k">$30,000 – $60,000</option>
                  <option value="60k_100k">$60,000 – $100,000</option>
                  <option value="100k_plus">$100,000+</option>
                </select>
              </label>
            )}

            <label style={labelStyle}>
              Credit Score Range
              <select style={fieldStyle(validationErrors.creditScore)} value={form.creditScore} onChange={(e) => update('creditScore', e.target.value)}>
                <option value="">Select range</option>
                <option value="below_580">Below 580</option>
                <option value="580_669">580 – 669</option>
                <option value="670_739">670 – 739</option>
                <option value="740_plus">740+</option>
              </select>
            </label>

            {(form.annualIncome || form.creditScore) && (
              <div style={{ gridColumn: '1 / -1', border: `1px solid rgba(212,175,55,0.4)`, borderLeft: `3px solid ${G}`, borderRadius: 12, background: 'rgba(212,175,55,0.06)', padding: 18 }}>
                <div style={{ fontWeight: 700, color: G, fontSize: 14, marginBottom: 6 }}>⚡ Would you like to accelerate your success?</div>
                <p style={{ margin: '0 0 14px', color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 }}>
                  I’ve watched people with less than you walk in and change their family’s life in 90 days — because they chose to move with intention from the start.
                </p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0, color: '#4ade80', fontWeight: 600, fontSize: 14 }}>
                    <input type="radio" name="wantsToAccelerate" value="yes" checked={form.wantsToAccelerate === 'yes'} onChange={() => update('wantsToAccelerate', 'yes')} style={{ accentColor: G }} />
                    Yes — I want to learn more on my onboarding call
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0, color: MUTED, fontSize: 14 }}>
                    <input type="radio" name="wantsToAccelerate" value="no" checked={form.wantsToAccelerate === 'no'} onChange={() => update('wantsToAccelerate', 'no')} />
                    No thanks, standard path
                  </label>
                </div>
              </div>
            )}

            {sectionHeader('Background & Readiness')}
            <label style={labelStyle}>
              Currently Licensed to Sell Insurance?
              <select style={fieldStyle(validationErrors.isLicensed)} value={form.isLicensed} onChange={(e) => update('isLicensed', e.target.value)}>
                <option value="">Select one</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            {form.isLicensed === 'yes' && (
              <label style={labelStyle}>
                Licensing Details
                <input style={fieldStyle(validationErrors.licenseDetails)} value={form.licenseDetails} onChange={(e) => update('licenseDetails', e.target.value)} placeholder="States, years active, company" />
              </label>
            )}
            <label style={labelStyle}>
              Health Status
              <select style={fieldStyle(validationErrors.healthStatus)} value={form.healthStatus} onChange={(e) => update('healthStatus', e.target.value)}>
                <option value="">Select one</option>
                {['Excellent', 'Good', 'Fair', 'Poor'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              Motivation Level
              <select style={fieldStyle(validationErrors.motivation)} value={form.motivation} onChange={(e) => update('motivation', e.target.value)}>
                <option value="">Select one</option>
                {['Slightly Motivated', 'Moderately Motivated', 'Very Motivated', 'Extremely Motivated'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              Hours Per Week Available
              <select style={fieldStyle(validationErrors.hoursPerWeek)} value={form.hoursPerWeek} onChange={(e) => update('hoursPerWeek', e.target.value)}>
                <option value="">Select one</option>
                {['0-10 hours', '10-20 hours', '20-30 hours', '30+ hours'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>

            {!Boolean(ref) && (
              <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
                Referral / Agent Name
                <input style={fieldStyle(validationErrors.referralName)} value={form.referralName} onChange={(e) => update('referralName', e.target.value)} placeholder="Who referred you?" />
              </label>
            )}
            {Boolean(ref) && (
              <div style={{ gridColumn: '1 / -1', background: 'rgba(22,163,74,0.08)', border: '1px solid #16a34a', borderRadius: 10, padding: '10px 14px', color: '#4ade80', fontSize: 13 }}>✅ Referral attribution secured via personal link.</div>
            )}

            {sectionHeader('Tell Us About You', 'Be specific — this is what separates serious candidates.')}
            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
              Why do you want to join Legacy Link?
              <textarea style={{ ...fieldStyle(validationErrors.whyJoin), minHeight: 100, resize: 'vertical' }} value={form.whyJoin} onChange={(e) => update('whyJoin', e.target.value)} placeholder="Be honest. What's driving you?" />
              <span style={{ fontSize: 11, color: String(form.whyJoin || '').trim().length >= 50 ? '#4ade80' : validationErrors.whyJoin ? '#f87171' : MUTED }}>{String(form.whyJoin || '').trim().length}/50 minimum characters</span>
            </label>
            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
              What is your #1 goal in the next 12 months?
              <textarea style={{ ...fieldStyle(validationErrors.goal12Month), minHeight: 80, resize: 'vertical' }} value={form.goal12Month} onChange={(e) => update('goal12Month', e.target.value)} placeholder="Be specific. Numbers, timelines, outcomes." />
              <span style={{ fontSize: 11, color: String(form.goal12Month || '').trim().length >= 20 ? '#4ade80' : validationErrors.goal12Month ? '#f87171' : MUTED }}>{String(form.goal12Month || '').trim().length}/20 minimum characters</span>
            </label>

            {sectionHeader('Commitments & Agreements')}
            {[
              ['agreeTraining', 'I commit to following Legacy Link training systems.'],
              ['agreeWeekly', 'I agree to attend at least one weekly training session.'],
              ['agreeService', 'I agree to complete one hour of community service monthly.'],
            ].map(([key, text]) => (
              <label key={key} style={{ ...labelStyle, gridColumn: '1 / -1', flexDirection: 'row', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', border: `1px solid ${validationErrors[key] ? '#ef4444' : BORDER}`, borderRadius: 10, padding: '12px 14px', background: form[key] ? 'rgba(212,175,55,0.06)' : 'transparent' }}>
                <input type="checkbox" checked={form[key]} onChange={(e) => update(key, e.target.checked)} style={{ accentColor: G, width: 16, height: 16, flexShrink: 0 }} />
                <span style={{ color: form[key] ? TEXT : MUTED, fontSize: 13 }}>{text}</span>
              </label>
            ))}

            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => { setTermsScrollReady(false); setShowTerms(true); }}
                style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${G}`, background: 'transparent', color: G, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                View Terms & Conditions
              </button>
              {termsViewed
                ? <span style={{ fontSize: 13, color: '#4ade80', fontWeight: 600 }}>✅ Terms reviewed</span>
                : <span style={{ fontSize: 13, color: validationErrors.termsViewed ? '#f87171' : MUTED }}>Must read before agreeing</span>}
            </div>

            <label style={{ ...labelStyle, gridColumn: '1 / -1', flexDirection: 'row', display: 'flex', alignItems: 'center', gap: 10, cursor: termsViewed ? 'pointer' : 'not-allowed', border: `1px solid ${validationErrors.agreeTerms ? '#ef4444' : BORDER}`, borderRadius: 10, padding: '12px 14px', background: form.agreeTerms ? 'rgba(212,175,55,0.06)' : 'transparent', opacity: termsViewed ? 1 : 0.5 }}>
              <input type="checkbox" checked={form.agreeTerms} onChange={(e) => update('agreeTerms', e.target.checked)} disabled={!termsViewed} style={{ accentColor: G, width: 16, height: 16, flexShrink: 0 }} />
              <span style={{ color: form.agreeTerms ? TEXT : MUTED, fontSize: 13 }}>I have read and agree to the Terms & Conditions.</span>
            </label>

            {error ? <div style={{ gridColumn: '1 / -1', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13 }}>{error}</div> : null}

            <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
              <button
                type="submit"
                style={{ width: '100%', padding: '16px', borderRadius: 12, background: `linear-gradient(135deg, ${G}, #b8962e)`, border: 'none', color: '#0a0e1a', fontWeight: 800, fontSize: 16, cursor: 'pointer', letterSpacing: 0.5 }}
              >
                Submit Application →
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Sticky bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(8,17,31,0.95)', backdropFilter: 'blur(12px)', borderTop: `1px solid ${BORDER}`, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, zIndex: 100 }}>
        <div>
          <div style={{ fontWeight: 700, color: TEXT, fontSize: 14 }}>{missingCount === 0 ? '✅ Ready to submit' : `${missingCount} field${missingCount === 1 ? '' : 's'} remaining`}</div>
          <div style={{ fontSize: 12, color: MUTED }}>Complete all required fields</div>
        </div>
        <button
          type="submit" form="sponsor-app-form"
          style={{ padding: '10px 28px', borderRadius: 10, background: `linear-gradient(135deg, ${G}, #b8962e)`, border: 'none', color: '#0a0e1a', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
        >
          Submit →
        </button>
      </div>

      {showTerms ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'grid', placeItems: 'center', zIndex: 200, padding: 16 }}
          onClick={() => setShowTerms(false)}
        >
          <div style={{ background: '#0f1c2e', border: '1px solid #1e3a5f', borderRadius: 16, width: 'min(900px, 96vw)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1e3a5f' }}>
              <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: 16 }}>Sponsorship Agreement Terms</h3>
              <button type="button" onClick={() => setShowTerms(false)} style={{ background: 'transparent', border: '1px solid #1e3a5f', borderRadius: 8, color: '#94a3b8', padding: '6px 12px', cursor: 'pointer' }}>Close</button>
            </div>

            <div
              ref={termsBodyRef}
              style={{ maxHeight: '56vh', overflowY: 'auto', paddingRight: 6, padding: '16px 20px', color: '#cbd5e1' }}
              onScroll={(e) => {
                const el = e.currentTarget;
                const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
                if (nearBottom) setTermsScrollReady(true);
              }}
            >
              <ol>
                <li><strong>Referral Bonus:</strong> Inner Circle members — $500 flat per sponsorship referral. Non-Inner Circle — $400 with policy placed, $300 without policy. Writing agent receives $50 (IC) or $100 (non-IC) when different from referral owner. All subject to validated attribution.</li>
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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #1e3a5f', gap: 12, flexWrap: 'wrap' }}>
              <small style={{ color: termsScrollReady ? '#4ade80' : '#64748b', fontSize: 12 }}>{termsScrollReady ? '✅ You’ve reached the end.' : 'Scroll to the bottom to enable acceptance.'}</small>
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
                style={{ padding: '10px 20px', borderRadius: 10, background: termsScrollReady ? 'linear-gradient(135deg, #d4af37, #b8962e)' : '#1e3a5f', border: 'none', color: termsScrollReady ? '#0a0e1a' : '#64748b', fontWeight: 700, fontSize: 13, cursor: termsScrollReady ? 'pointer' : 'not-allowed' }}
              >
                I Have Read the Terms
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
