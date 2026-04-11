'use client';
import { useState } from 'react';

const GOLD = '#C8A96B';
const NAVY = '#040B23';
const NAVY2 = '#061028';
const BORDER = '#162040';
const TEXT_MUTED = '#6a7f96';
const TEXT_LIGHT = '#9aafc4';

const inputStyle = {
  width: '100%',
  background: '#0a1628',
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  color: '#fff',
  fontSize: 14,
  padding: '12px 14px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const labelStyle = {
  display: 'block',
  fontSize: 11,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  color: GOLD,
  fontWeight: 700,
  marginBottom: 7,
};

const fieldWrap = { marginBottom: 20 };

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
  'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky',
  'Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
  'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico',
  'New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania',
  'Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming','Washington D.C.'
];

const PROGRAMS = [
  { value: 'inner_circle', label: 'Inner Circle' },
  { value: 'jumpstart', label: 'JumpStart Program' },
  { value: 'sponsorship', label: 'Sponsorship Program' },
  { value: 'agency_owner', label: 'Agency Owner' },
  { value: 'regional_director', label: 'Regional Director' },
  { value: 'unsure', label: "I'm not sure yet" },
];

const INCOME_GOALS = [
  { value: 'under_50k', label: 'Under $50,000' },
  { value: '50_100k', label: '$50,000 – $100,000' },
  { value: '100_250k', label: '$100,000 – $250,000' },
  { value: '250_500k', label: '$250,000 – $500,000' },
  { value: '500k_plus', label: '$500,000+' },
];

const HOURS = [
  { value: 'part_time', label: 'Part-time (under 20 hrs/week)' },
  { value: 'full_time', label: 'Full-time (20–40 hrs/week)' },
  { value: 'all_in', label: 'All-in (40+ hrs/week)' },
];

const HEAR_ABOUT = [
  'Referral from a team member',
  'Social media (Instagram, Facebook, etc.)',
  'YouTube',
  'Google / web search',
  'LinkedIn',
  'Event or conference',
  'Other',
];

const STEPS = ['Personal Info', 'Background', 'Goals', 'Referral'];

function ProgressBar({ step, total }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: i < step ? GOLD : i === step ? '#fff' : BORDER,
              border: `2px solid ${i <= step ? GOLD : BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              color: i < step ? NAVY : i === step ? NAVY : TEXT_MUTED,
              marginBottom: 6, transition: 'all 0.3s',
            }}>
              {i < step ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 9, letterSpacing: '1px', color: i === step ? GOLD : TEXT_MUTED, textTransform: 'uppercase', fontWeight: 700 }}>
              {STEPS[i]}
            </span>
          </div>
        ))}
      </div>
      <div style={{ height: 2, background: BORDER, borderRadius: 1 }}>
        <div style={{ height: '100%', width: `${(step / (total - 1)) * 100}%`, background: GOLD, borderRadius: 1, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={fieldWrap}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function Input({ ...props }) {
  return <input style={inputStyle} {...props} />;
}

function Select({ children, ...props }) {
  return (
    <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} {...props}>
      {children}
    </select>
  );
}

function RadioGroup({ options, value, onChange, name }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {options.map(opt => (
        <label key={opt.value} style={{
          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
          background: value === opt.value ? '#0f1e3d' : '#0a1628',
          border: `1px solid ${value === opt.value ? GOLD : BORDER}`,
          borderRadius: 8, padding: '12px 14px',
          transition: 'all 0.2s',
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            border: `2px solid ${value === opt.value ? GOLD : BORDER}`,
            background: value === opt.value ? GOLD : 'transparent',
            flexShrink: 0,
          }} />
          <span style={{ color: value === opt.value ? '#fff' : TEXT_LIGHT, fontSize: 13 }}>{opt.label}</span>
          <input type="radio" name={name} value={opt.value} checked={value === opt.value} onChange={() => onChange(opt.value)} style={{ display: 'none' }} />
        </label>
      ))}
    </div>
  );
}

export default function IntakeForm() {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', state: '',
    licensed: '', licenseStates: '', yearsExperience: '', currentOccupation: '',
    programInterest: '', incomeGoal: '', weeklyHours: '', motivation: '',
    hearAbout: '', referredBy: '', referrerEmail: '',
  });

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function validateStep() {
    if (step === 0) {
      if (!form.firstName.trim()) return 'First name is required.';
      if (!form.lastName.trim()) return 'Last name is required.';
      if (!form.email.trim() || !form.email.includes('@')) return 'Valid email is required.';
      if (!form.phone.trim()) return 'Phone number is required.';
      if (!form.state) return 'State is required.';
    }
    if (step === 1) {
      if (!form.licensed) return 'Please indicate your license status.';
    }
    if (step === 2) {
      if (!form.programInterest) return 'Please select a program of interest.';
      if (!form.incomeGoal) return 'Please select an income goal.';
      if (!form.weeklyHours) return 'Please select your weekly availability.';
    }
    if (step === 3) {
      if (!form.hearAbout) return 'Please tell us how you heard about us.';
    }
    return '';
  }

  function next() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
  }

  function back() {
    setError('');
    setStep(s => s - 1);
  }

  async function submit() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Submission failed. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
          <div style={{ fontSize: 11, letterSpacing: '4px', color: GOLD, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>Application Received</div>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: '0 0 16px' }}>You're in the queue, {form.firstName}.</h1>
          <p style={{ color: TEXT_LIGHT, fontSize: 15, lineHeight: 1.7, margin: '0 0 32px' }}>
            The Legacy Link team will review your application and reach out within 24–48 hours. Check your inbox at <strong style={{ color: '#fff' }}>{form.email}</strong> for next steps.
          </p>
          <p style={{ color: TEXT_MUTED, fontSize: 13 }}>Questions? Reach us at <a href="mailto:support@thelegacylink.com" style={{ color: GOLD, textDecoration: 'none' }}>support@thelegacylink.com</a></p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: NAVY, padding: '40px 20px', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 10, letterSpacing: '4px', color: GOLD, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase' }}>The Legacy Link</div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: '0 0 10px', letterSpacing: 0.5 }}>Pre-Qualification Application</h1>
          <p style={{ color: TEXT_MUTED, fontSize: 13, margin: 0 }}>Complete all steps to submit your application. Takes about 3 minutes.</p>
        </div>

        {/* Card */}
        <div style={{ background: NAVY2, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '36px 40px', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>
          <ProgressBar step={step} total={4} />

          {/* Step 0 — Personal Info */}
          {step === 0 && (
            <div>
              <h2 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: '0 0 24px' }}>Personal Information</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="First Name">
                  <Input placeholder="First name" value={form.firstName} onChange={e => set('firstName', e.target.value)} />
                </Field>
                <Field label="Last Name">
                  <Input placeholder="Last name" value={form.lastName} onChange={e => set('lastName', e.target.value)} />
                </Field>
              </div>
              <Field label="Email Address">
                <Input type="email" placeholder="your@email.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </Field>
              <Field label="Phone Number">
                <Input type="tel" placeholder="(555) 000-0000" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </Field>
              <Field label="State of Residence">
                <Select value={form.state} onChange={e => set('state', e.target.value)}>
                  <option value="">Select your state</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
          )}

          {/* Step 1 — Background */}
          {step === 1 && (
            <div>
              <h2 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: '0 0 24px' }}>Your Background</h2>
              <Field label="Do you currently hold a life insurance license?">
                <RadioGroup
                  name="licensed"
                  value={form.licensed}
                  onChange={v => set('licensed', v)}
                  options={[
                    { value: 'yes', label: 'Yes — I am currently licensed' },
                    { value: 'in_progress', label: 'In progress — working on getting licensed' },
                    { value: 'no', label: 'No — not yet licensed' },
                  ]}
                />
              </Field>
              {form.licensed === 'yes' && (
                <Field label="Which state(s) are you licensed in?">
                  <Input placeholder="e.g. New Jersey, New York, Florida" value={form.licenseStates} onChange={e => set('licenseStates', e.target.value)} />
                </Field>
              )}
              <Field label="Years of experience in financial services or sales">
                <Select value={form.yearsExperience} onChange={e => set('yearsExperience', e.target.value)}>
                  <option value="">Select experience level</option>
                  <option value="none">No prior experience</option>
                  <option value="under_1">Less than 1 year</option>
                  <option value="1_3">1–3 years</option>
                  <option value="3_5">3–5 years</option>
                  <option value="5_10">5–10 years</option>
                  <option value="10_plus">10+ years</option>
                </Select>
              </Field>
              <Field label="Current Occupation">
                <Input placeholder="e.g. Sales rep, Teacher, Entrepreneur..." value={form.currentOccupation} onChange={e => set('currentOccupation', e.target.value)} />
              </Field>
            </div>
          )}

          {/* Step 2 — Goals */}
          {step === 2 && (
            <div>
              <h2 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: '0 0 24px' }}>Your Goals</h2>
              <Field label="Which program are you most interested in?">
                <RadioGroup
                  name="programInterest"
                  value={form.programInterest}
                  onChange={v => set('programInterest', v)}
                  options={PROGRAMS}
                />
              </Field>
              <Field label="12-month income goal">
                <RadioGroup
                  name="incomeGoal"
                  value={form.incomeGoal}
                  onChange={v => set('incomeGoal', v)}
                  options={INCOME_GOALS}
                />
              </Field>
              <Field label="Weekly time commitment">
                <RadioGroup
                  name="weeklyHours"
                  value={form.weeklyHours}
                  onChange={v => set('weeklyHours', v)}
                  options={HOURS}
                />
              </Field>
              <Field label="What's driving you to make a change? (optional)">
                <textarea
                  rows={3}
                  placeholder="Tell us what's motivating you..."
                  value={form.motivation}
                  onChange={e => set('motivation', e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                />
              </Field>
            </div>
          )}

          {/* Step 3 — Referral */}
          {step === 3 && (
            <div>
              <h2 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: '0 0 24px' }}>Almost Done</h2>
              <Field label="How did you hear about The Legacy Link?">
                <Select value={form.hearAbout} onChange={e => set('hearAbout', e.target.value)}>
                  <option value="">Select one</option>
                  {HEAR_ABOUT.map(h => <option key={h} value={h}>{h}</option>)}
                </Select>
              </Field>
              <Field label="Were you referred by a team member?">
                <Input placeholder="Referring agent's full name (if applicable)" value={form.referredBy} onChange={e => set('referredBy', e.target.value)} />
              </Field>
              <Field label="Referrer's email (if known)">
                <Input type="email" placeholder="referrer@email.com (optional)" value={form.referrerEmail} onChange={e => set('referrerEmail', e.target.value)} />
              </Field>

              {/* Summary preview */}
              <div style={{ background: '#0a1628', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 20, marginTop: 8 }}>
                <div style={{ fontSize: 10, letterSpacing: '2px', color: GOLD, fontWeight: 700, marginBottom: 14, textTransform: 'uppercase' }}>Application Summary</div>
                {[
                  ['Name', `${form.firstName} ${form.lastName}`],
                  ['Email', form.email],
                  ['State', form.state],
                  ['Licensed', form.licensed === 'yes' ? 'Yes' : form.licensed === 'in_progress' ? 'In Progress' : 'Not yet'],
                  ['Program', PROGRAMS.find(p => p.value === form.programInterest)?.label || '—'],
                  ['Income Goal', INCOME_GOALS.find(g => g.value === form.incomeGoal)?.label || '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${BORDER}`, paddingBottom: 8, marginBottom: 8 }}>
                    <span style={{ color: TEXT_MUTED, fontSize: 12 }}>{k}</span>
                    <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginTop: 20, color: '#fca5a5', fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Nav Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, gap: 12 }}>
            {step > 0 ? (
              <button onClick={back} style={{ flex: 1, padding: '13px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT_LIGHT, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Back
              </button>
            ) : <div style={{ flex: 1 }} />}

            {step < 3 ? (
              <button onClick={next} style={{ flex: 2, padding: '13px', background: GOLD, border: 'none', borderRadius: 8, color: NAVY, fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.5px', fontFamily: 'inherit' }}>
                Continue →
              </button>
            ) : (
              <button onClick={submit} disabled={submitting} style={{ flex: 2, padding: '13px', background: submitting ? '#7a6a3d' : GOLD, border: 'none', borderRadius: 8, color: NAVY, fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', letterSpacing: '0.5px', fontFamily: 'inherit' }}>
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 28, color: TEXT_MUTED, fontSize: 12 }}>
          Questions? <a href="mailto:support@thelegacylink.com" style={{ color: GOLD, textDecoration: 'none' }}>support@thelegacylink.com</a>
          &nbsp;·&nbsp; <a href="tel:2018627040" style={{ color: GOLD, textDecoration: 'none' }}>201-862-7040</a>
        </div>
      </div>
    </div>
  );
}
