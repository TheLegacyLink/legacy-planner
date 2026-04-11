'use client';
import { useState, useRef } from 'react';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const GOLD = '#D4AF37';
const BG = '#0E131B';
const CARD = '#141B27';
const CARD2 = '#1A2236';
const TEXT = '#F2F2F2';
const MUTED = '#7B8494';
const INPUT_BG = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(212,175,55,0.22)';
const DANGER = '#F87171';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM',
  'NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA',
  'WV','WI','WY',
];

const STEP_NAMES = [
  'Personal Information',
  'Employment & Income',
  'Coverage',
  'Beneficiaries',
  'Policy Owner',
  'Health & Medical',
  'Existing Insurance',
  'Review & Submit',
];

// ─── Helper: format phone ─────────────────────────────────────────────────────
function fmtPhone(digits = '') {
  const d = String(digits).replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
}

// ─── Shared UI Primitives ─────────────────────────────────────────────────────
function Lbl({ children, req }) {
  return (
    <div style={{ fontSize: 13, color: MUTED, marginBottom: 5, fontWeight: 500, letterSpacing: 0.2 }}>
      {children}{req && <span style={{ color: GOLD, marginLeft: 2 }}>*</span>}
    </div>
  );
}

function FieldErr({ msg }) {
  return msg ? <div style={{ color: DANGER, fontSize: 12, marginTop: 3 }}>{msg}</div> : null;
}

function FInput({ label, req, error, style, value, onChange, ...rest }) {
  const [foc, setFoc] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <Lbl req={req}>{label}</Lbl>}
      <input
        value={value}
        onChange={onChange}
        onFocus={() => setFoc(true)}
        onBlur={() => setFoc(false)}
        style={{
          width: '100%', background: INPUT_BG,
          border: `1px solid ${foc ? GOLD : error ? DANGER : BORDER}`,
          borderRadius: 8, padding: '10px 12px', color: TEXT,
          fontSize: 15, outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.2s', ...style,
        }}
        {...rest}
      />
      <FieldErr msg={error} />
    </div>
  );
}

function FSelect({ label, req, error, children, value, onChange, ...rest }) {
  const [foc, setFoc] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <Lbl req={req}>{label}</Lbl>}
      <select
        value={value}
        onChange={onChange}
        onFocus={() => setFoc(true)}
        onBlur={() => setFoc(false)}
        style={{
          width: '100%', background: CARD2,
          border: `1px solid ${foc ? GOLD : error ? DANGER : BORDER}`,
          borderRadius: 8, padding: '10px 12px', color: value ? TEXT : MUTED,
          fontSize: 15, outline: 'none', boxSizing: 'border-box',
          cursor: 'pointer', transition: 'border-color 0.2s',
        }}
        {...rest}
      >
        {children}
      </select>
      <FieldErr msg={error} />
    </div>
  );
}

function FRadio({ label, req, name, value, onChange, options, error }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <Lbl req={req}>{label}</Lbl>}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {options.map((opt) => (
          <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: TEXT, fontSize: 14 }}>
            <input
              type="radio" name={name} value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              style={{ accentColor: GOLD, width: 15, height: 15 }}
            />
            {opt.label}
          </label>
        ))}
      </div>
      <FieldErr msg={error} />
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`,
      borderRadius: 12, padding: '22px 24px', marginBottom: 16,
      boxShadow: '0 0 0 1px rgba(212,175,55,0.04), 0 4px 20px rgba(0,0,0,0.3)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardTitle({ children }) {
  return <h3 style={{ margin: '0 0 18px', color: TEXT, fontSize: 17, fontWeight: 600 }}>{children}</h3>;
}

function Row2({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {children}
    </div>
  );
}

function InfoBox({ children }) {
  return (
    <div style={{
      background: 'rgba(212,175,55,0.08)', border: `1px solid rgba(212,175,55,0.3)`,
      borderRadius: 8, padding: '12px 16px', color: '#E8D47A',
      fontSize: 14, marginBottom: 16, lineHeight: 1.6,
    }}>
      {children}
    </div>
  );
}

function CheckItem({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
      <span style={{ color: GOLD, fontSize: 14, marginTop: 2 }}>✓</span>
      <span style={{ color: TEXT, fontSize: 14, lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

function GoldBanner({ children }) {
  return (
    <div style={{
      background: `linear-gradient(90deg, ${GOLD}22, ${GOLD}44, ${GOLD}22)`,
      border: `1px solid ${GOLD}66`,
      borderRadius: 8, padding: '12px 18px',
      color: GOLD, fontWeight: 600, fontSize: 15,
      marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
    }}>
      🛡️ {children}
    </div>
  );
}

// SSN Input with masking
function SSNInput({ value, onChange, error }) {
  const [foc, setFoc] = useState(false);
  const raw = String(value || '').replace(/\D/g, '').slice(0, 9);

  function display(digits, focused) {
    if (!digits) return '';
    const d = digits;
    if (focused) {
      if (d.length <= 3) return d;
      if (d.length <= 5) return `${d.slice(0,3)}-${d.slice(3)}`;
      return `${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}`;
    }
    if (d.length < 9) {
      if (d.length <= 3) return d;
      if (d.length <= 5) return `${d.slice(0,3)}-${d.slice(3)}`;
      return `${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}`;
    }
    return `•••-••-${d.slice(5)}`;
  }

  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
    onChange(digits);
  }

  return (
    <div>
      <FInput
        value={display(raw, foc)}
        onChange={handleChange}
        onFocus={() => setFoc(true)}
        onBlur={() => setFoc(false)}
        placeholder="XXX-XX-XXXX"
        inputMode="numeric"
        error={error}
      />
    </div>
  );
}

// PhoneInput
function PhoneInput({ value, onChange, error, label, req, placeholder }) {
  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    onChange(digits);
  }
  return (
    <FInput
      label={label}
      req={req}
      type="tel"
      value={fmtPhone(value)}
      onChange={handleChange}
      placeholder={placeholder || '(XXX) XXX-XXXX'}
      inputMode="numeric"
      error={error}
    />
  );
}

// Beneficiary row
function BeneficiaryCard({ bene, idx, onChange, onRemove, required, errors }) {
  return (
    <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ color: GOLD, fontWeight: 600, fontSize: 14 }}>
          Beneficiary #{idx + 1}
        </div>
        {onRemove && (
          <button onClick={onRemove} style={{ background: 'none', border: 'none', color: DANGER, cursor: 'pointer', fontSize: 18 }}>🗑</button>
        )}
      </div>
      <Row2>
        <FInput
          label="Full Name" req={required && idx === 0}
          value={bene.fullName} onChange={e => onChange({ ...bene, fullName: e.target.value })}
          error={errors?.[`bene${idx}Name`]}
        />
        <FInput
          label="Date of Birth"
          type="date" value={bene.dateOfBirth} onChange={e => onChange({ ...bene, dateOfBirth: e.target.value })}
        />
      </Row2>
      <Row2>
        <FInput
          label="Relationship" req={required && idx === 0}
          placeholder="e.g. Spouse, Child"
          value={bene.relationship} onChange={e => onChange({ ...bene, relationship: e.target.value })}
          error={errors?.[`bene${idx}Rel`]}
        />
        <FInput
          label="Percentage (%)" req={required && idx === 0}
          type="number" min="1" max="100"
          value={bene.percentage} onChange={e => onChange({ ...bene, percentage: e.target.value })}
          error={errors?.[`bene${idx}Pct`]}
        />
      </Row2>
      <div style={{ marginBottom: 14 }}>
        <Lbl>SSN (optional)</Lbl>
        <SSNInput
          value={bene.ssn || ''}
          onChange={val => onChange({ ...bene, ssn: val })}
        />
      </div>
    </div>
  );
}

// Progress bar & step indicator
function ProgressHeader({ step, goToStep }) {
  const pct = ((step - 1) / 7) * 100;
  return (
    <div style={{ marginBottom: 24 }}>
      {/* Step indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {STEP_NAMES.map((name, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <button
              key={n}
              onClick={() => done ? goToStep(n) : null}
              title={name}
              style={{
                width: 30, height: 30, borderRadius: '50%',
                border: `2px solid ${active ? GOLD : done ? GOLD : BORDER}`,
                background: active ? GOLD : done ? `${GOLD}33` : 'transparent',
                color: active ? BG : done ? GOLD : MUTED,
                fontWeight: 700, fontSize: 13,
                cursor: done ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s', flexShrink: 0,
              }}
            >
              {done ? '✓' : n}
            </button>
          );
        })}
      </div>
      {/* Step label */}
      <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, marginBottom: 10 }}>
        Step {step} of 8 — <span style={{ color: TEXT }}>{STEP_NAMES[step - 1]}</span>
      </div>
      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: `linear-gradient(90deg, ${GOLD}, #F0D060)`,
          borderRadius: 4, transition: 'width 0.35s ease',
        }} />
      </div>
    </div>
  );
}

// ─── Initial form state ───────────────────────────────────────────────────────
const INITIAL = {
  // Step 1
  firstName: '', middleName: '', lastName: '',
  dateOfBirth: '', gender: '', ssn: '', phone: '', email: '',
  streetAddress: '', city: '', state: '', zip: '',
  maritalStatus: '', citizenship: '',
  visaType: '', countryOfCitizenship: '',
  driversLicenseNumber: '', driversLicenseState: '',
  idType: '', idPhotoBase64: '',
  // Step 2
  employer: '', occupation: '', workPhone: '',
  employerStreet: '', employerCity: '', employerState: '', employerZip: '',
  annualIncome: '', netWorth: '',
  // Step 3
  coveragePurpose: '',
  // Step 5
  ownerSameAsInsured: 'yes', ownerIsTrust: false,
  trustName: '', trustDate: '',
  ownerFullName: '', ownerDOB: '', ownerSSN: '',
  ownerPhone: '', ownerRelationship: '',
  ownerStreet: '', ownerCity: '', ownerState: '', ownerZip: '',
  // Step 6
  fatherAlive: '', fatherAge: '', fatherAgeAtDeath: '', fatherCauseOfDeath: '',
  motherAlive: '', motherAge: '', motherAgeAtDeath: '', motherCauseOfDeath: '',
  heightFeet: '', heightInches: '',
  weight: '', tobaccoUse: '', tobaccoType: '', tobaccoFrequency: '',
  hasMedications: '', hasMedicalConditions: '',
  // Step 7
  hasExistingInsurance: '', isReplacement: '',
  // Step 8
  certify: false, authorize: false,
  signatureName: '',
  signatureDate: new Date().toISOString().slice(0, 10),
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ApplyPage() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [errors, setErrors] = useState({});
  const topRef = useRef(null);

  const [fd, setFd] = useState(INITIAL);
  const [idPhotoPreview, setIdPhotoPreview] = useState(null);
  const idPhotoRef = useRef(null);
  const [primaryBenes, setPrimaryBenes] = useState([
    { fullName: '', dateOfBirth: '', ssn: '', relationship: '', percentage: '' },
  ]);
  const [contingentBenes, setContingentBenes] = useState([]);
  const [existingPolicies, setExistingPolicies] = useState([
    { companyName: '', faceAmount: '', whenIssued: '', willBeReplaced: '' },
  ]);

  function upd(field, val) {
    setFd((p) => ({ ...p, [field]: val }));
    setErrors((p) => ({ ...p, [field]: '' }));
  }

  function scrollTop() {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function validate() {
    const e = {};
    if (step === 1) {
      if (!fd.firstName.trim()) e.firstName = 'Required';
      if (!fd.lastName.trim()) e.lastName = 'Required';
      if (!fd.dateOfBirth) e.dateOfBirth = 'Required';
      if (!fd.gender) e.gender = 'Required';
      if (fd.ssn.replace(/\D/g, '').length !== 9) e.ssn = 'Must be exactly 9 digits';
      if (fd.phone.length !== 10) e.phone = 'Must be 10 digits';
      if (!fd.email || !fd.email.includes('@')) e.email = 'Valid email required';
      if (!fd.streetAddress.trim()) e.streetAddress = 'Required';
      if (!fd.city.trim()) e.city = 'Required';
      if (!fd.state) e.state = 'Required';
      if (fd.zip.replace(/\D/g, '').length !== 5) e.zip = 'Must be 5 digits';
      if (!fd.maritalStatus) e.maritalStatus = 'Required';
      if (!fd.citizenship) e.citizenship = 'Required';
      if (fd.citizenship === 'Foreign National') {
        if (!fd.visaType.trim()) e.visaType = 'Required';
        if (!fd.countryOfCitizenship.trim()) e.countryOfCitizenship = 'Required';
      }
      if (!fd.idType) e.idPhoto = 'Please select your ID type';
      if (!fd.idPhotoBase64) e.idPhoto = 'Please upload a photo of your government-issued ID';
    }
    if (step === 3) {
      if (!fd.coveragePurpose) e.coveragePurpose = 'Please select your membership level';
    }
    if (step === 4) {
      const pb = primaryBenes[0];
      if (!pb?.fullName?.trim()) e.bene0Name = 'Required';
      if (!pb?.relationship?.trim()) e.bene0Rel = 'Required';
      if (!pb?.percentage) e.bene0Pct = 'Required';
    }
    if (step === 5) {
      if (fd.ownerSameAsInsured === 'no') {
        if (fd.ownerIsTrust) {
          if (!fd.trustName.trim()) e.trustName = 'Required';
          if (!fd.trustDate) e.trustDate = 'Required';
        } else {
          if (!fd.ownerFullName.trim()) e.ownerFullName = 'Required';
        }
      }
    }
    if (step === 6) {
      if (!fd.fatherAlive) e.fatherAlive = 'Required';
      if (fd.fatherAlive === 'yes' && !fd.fatherAge.trim()) e.fatherAge = 'Required';
      if (fd.fatherAlive === 'no' && !fd.fatherAgeAtDeath.trim()) e.fatherAgeAtDeath = 'Required';
      if (!fd.motherAlive) e.motherAlive = 'Required';
      if (fd.motherAlive === 'yes' && !fd.motherAge.trim()) e.motherAge = 'Required';
      if (fd.motherAlive === 'no' && !fd.motherAgeAtDeath.trim()) e.motherAgeAtDeath = 'Required';
      if (!fd.heightFeet) e.heightFeet = 'Required';
      if (fd.heightInches === '') e.heightInches = 'Required';
      if (!fd.weight.trim()) e.weight = 'Required';
      if (!fd.tobaccoUse) e.tobaccoUse = 'Required';
      if (fd.tobaccoUse === 'yes') {
        if (!fd.tobaccoType.trim()) e.tobaccoType = 'Required';
        if (!fd.tobaccoFrequency.trim()) e.tobaccoFrequency = 'Required';
      }
      if (!fd.hasMedications) e.hasMedications = 'Required';
      if (!fd.hasMedicalConditions) e.hasMedicalConditions = 'Required';
    }
    if (step === 7) {
      if (!fd.hasExistingInsurance) e.hasExistingInsurance = 'Required';
    }
    if (step === 8) {
      if (!fd.certify) e.certify = 'You must certify this information';
      if (!fd.authorize) e.authorize = 'Authorization required';
      if (!fd.signatureName.trim()) e.signatureName = 'Signature required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function goNext() {
    if (!validate()) { scrollTop(); return; }
    setStep((s) => Math.min(s + 1, 8));
    scrollTop();
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 1));
    scrollTop();
  }

  function goToStep(n) {
    if (n < step) { setStep(n); scrollTop(); }
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const faceAmount = fd.coveragePurpose === 'Inner Circle' ? 'Up to $3,000,000' : 'Up to $1,000,000';
      const payload = {
        first_name: fd.firstName, middle_name: fd.middleName, last_name: fd.lastName,
        date_of_birth: fd.dateOfBirth, gender: fd.gender, ssn: fd.ssn,
        phone: fd.phone, email: fd.email,
        street_address: fd.streetAddress, city: fd.city, state: fd.state, zip: fd.zip,
        marital_status: fd.maritalStatus, citizenship: fd.citizenship,
        visa_type: fd.visaType, country_of_citizenship: fd.countryOfCitizenship,
        drivers_license_number: fd.driversLicenseNumber, drivers_license_state: fd.driversLicenseState,
        id_type: fd.idType, id_photo_base64: fd.idPhotoBase64,
        employer: fd.employer, occupation: fd.occupation, work_phone: fd.workPhone,
        employer_street: fd.employerStreet, employer_city: fd.employerCity,
        employer_state: fd.employerState, employer_zip: fd.employerZip,
        annual_income: fd.annualIncome, net_worth: fd.netWorth,
        insurance_type: 'Indexed Universal Life',
        face_amount: faceAmount,
        payment_frequency: 'Company Funded',
        coverage_purpose: fd.coveragePurpose,
        primary_beneficiaries: JSON.stringify(primaryBenes),
        contingent_beneficiaries: JSON.stringify(contingentBenes),
        owner_same_as_insured: fd.ownerSameAsInsured,
        owner_info: JSON.stringify({
          isTrust: fd.ownerIsTrust, trustName: fd.trustName, trustDate: fd.trustDate,
          fullName: fd.ownerFullName, dob: fd.ownerDOB, ssn: fd.ownerSSN,
          phone: fd.ownerPhone, relationship: fd.ownerRelationship,
          street: fd.ownerStreet, city: fd.ownerCity, state: fd.ownerState, zip: fd.ownerZip,
        }),
        father_alive: fd.fatherAlive, father_age: fd.fatherAge,
        father_age_at_death: fd.fatherAgeAtDeath, father_cause_of_death: fd.fatherCauseOfDeath,
        mother_alive: fd.motherAlive, mother_age: fd.motherAge,
        mother_age_at_death: fd.motherAgeAtDeath, mother_cause_of_death: fd.motherCauseOfDeath,
        height_feet: fd.heightFeet, height_inches: fd.heightInches,
        weight: fd.weight, tobacco_use: fd.tobaccoUse,
        tobacco_type: fd.tobaccoType, tobacco_frequency: fd.tobaccoFrequency,
        has_medications: fd.hasMedications, has_medical_conditions: fd.hasMedicalConditions,
        health_questions: '{}',
        has_existing_insurance: fd.hasExistingInsurance,
        existing_policies: fd.hasExistingInsurance === 'yes' ? JSON.stringify(existingPolicies) : '[]',
        is_replacement: fd.isReplacement,
        signature_name: fd.signatureName,
        signature_date: fd.signatureDate,
      };

      const res = await fetch('/api/nlg-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Submission failed. Please try again.');
      setSubmitted(true);
      scrollTop();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Review helper ──────────────────────────────────────────────────────────
  function ReviewSection({ title, stepNum, rows }) {
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ color: GOLD, fontWeight: 600, fontSize: 14 }}>{title}</div>
          <button
            onClick={() => goToStep(stepNum)}
            style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '3px 10px', color: MUTED, fontSize: 12, cursor: 'pointer' }}
          >
            Edit
          </button>
        </div>
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 13 }}>
            <span style={{ color: MUTED, minWidth: 140 }}>{k}</span>
            <span style={{ color: TEXT }}>{v}</span>
          </div>
        ))}
      </div>
    );
  }

  // ─── Step renderers ─────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <>
        <GoldBanner>National Life Group — Life Insurance Pre-Qualification Form</GoldBanner>

        <Card>
          <CardTitle>Welcome to The Legacy Link</CardTitle>
          <Row2>
            <FInput label="First Name" req value={fd.firstName} onChange={e => upd('firstName', e.target.value)} error={errors.firstName} />
            <FInput label="Middle Name" value={fd.middleName} onChange={e => upd('middleName', e.target.value)} />
          </Row2>
          <FInput label="Last Name" req value={fd.lastName} onChange={e => upd('lastName', e.target.value)} error={errors.lastName} />
          <Row2>
            <FInput label="Date of Birth" req type="date" value={fd.dateOfBirth} onChange={e => upd('dateOfBirth', e.target.value)} error={errors.dateOfBirth} />
            <FSelect label="Gender" req value={fd.gender} onChange={e => upd('gender', e.target.value)} error={errors.gender}>
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </FSelect>
          </Row2>
          <div style={{ marginBottom: 14 }}>
            <Lbl req>Social Security Number</Lbl>
            <SSNInput value={fd.ssn} onChange={v => { upd('ssn', v); }} error={errors.ssn} />
          </div>
          <Row2>
            <PhoneInput label="Phone Number" req value={fd.phone} onChange={v => { upd('phone', v); setErrors(p => ({ ...p, phone: '' })); }} error={errors.phone} />
            <FInput label="Email Address" req type="email" value={fd.email} onChange={e => upd('email', e.target.value)} error={errors.email} />
          </Row2>
        </Card>

        <Card>
          <CardTitle>Home Address</CardTitle>
          <FInput label="Street Address" req value={fd.streetAddress} onChange={e => upd('streetAddress', e.target.value)} error={errors.streetAddress} />
          <Row2>
            <FInput label="City" req value={fd.city} onChange={e => upd('city', e.target.value)} error={errors.city} />
            <FSelect label="State" req value={fd.state} onChange={e => upd('state', e.target.value)} error={errors.state}>
              <option value="">Select state</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </FSelect>
          </Row2>
          <FInput
            label="ZIP Code" req
            value={fd.zip} onChange={e => upd('zip', e.target.value.replace(/\D/g, '').slice(0, 5))}
            inputMode="numeric" error={errors.zip}
          />
        </Card>

        <Card>
          <CardTitle>Additional Details</CardTitle>
          <Row2>
            <FSelect label="Marital Status" req value={fd.maritalStatus} onChange={e => upd('maritalStatus', e.target.value)} error={errors.maritalStatus}>
              <option value="">Select status</option>
              <option>Single</option><option>Married</option>
              <option>Widowed</option><option>Divorced</option>
            </FSelect>
            <FSelect label="Citizenship" req value={fd.citizenship} onChange={e => upd('citizenship', e.target.value)} error={errors.citizenship}>
              <option value="">Select citizenship</option>
              <option>US Citizen</option>
              <option>Foreign National</option>
            </FSelect>
          </Row2>
          {fd.citizenship === 'Foreign National' && (
            <Row2>
              <FInput label="Visa Type" req value={fd.visaType} onChange={e => upd('visaType', e.target.value)} error={errors.visaType} />
              <FInput label="Country of Citizenship" req value={fd.countryOfCitizenship} onChange={e => upd('countryOfCitizenship', e.target.value)} error={errors.countryOfCitizenship} />
            </Row2>
          )}
          <Row2>
            <FInput label="Driver's License Number" value={fd.driversLicenseNumber} onChange={e => upd('driversLicenseNumber', e.target.value)} />
            <FSelect label="Driver's License State" value={fd.driversLicenseState} onChange={e => upd('driversLicenseState', e.target.value)}>
              <option value="">Select state</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </FSelect>
          </Row2>

          {/* ── Government-Issued ID Upload ── */}
          <div style={{ marginTop: 8 }}>
            <Lbl req>Government-Issued ID — Front Photo</Lbl>
            <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
              {["Driver's License", "Non-Driver's ID", "Passport"].map(type => (
                <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: TEXT, fontSize: 14 }}>
                  <input
                    type="radio" name="idType" value={type}
                    checked={fd.idType === type}
                    onChange={() => upd('idType', type)}
                    style={{ accentColor: GOLD, width: 15, height: 15 }}
                  />
                  {type}
                </label>
              ))}
            </div>
            <div
              onClick={() => idPhotoRef.current?.click()}
              style={{
                border: `2px dashed ${idPhotoPreview ? GOLD : BORDER}`,
                borderRadius: 10, padding: '20px 16px',
                background: idPhotoPreview ? 'rgba(212,175,55,0.05)' : INPUT_BG,
                cursor: 'pointer', textAlign: 'center',
                transition: 'border-color 0.2s',
              }}
            >
              {idPhotoPreview ? (
                <div>
                  <img
                    src={idPhotoPreview} alt="ID preview"
                    style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, objectFit: 'contain' }}
                  />
                  <div style={{ color: GOLD, fontSize: 12, marginTop: 8 }}>Tap to replace</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📎</div>
                  <div style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>Tap to upload ID photo</div>
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>JPG, PNG, HEIC — front side only</div>
                </div>
              )}
            </div>
            <input
              ref={idPhotoRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                  setIdPhotoPreview(ev.target.result);
                  upd('idPhotoBase64', ev.target.result);
                };
                reader.readAsDataURL(file);
              }}
            />
            <FieldErr msg={errors.idPhoto} />
          </div>
        </Card>
      </>
    );
  }

  function renderStep2() {
    return (
      <>
        <Card>
          <CardTitle>Employment</CardTitle>
          <p style={{ color: MUTED, fontSize: 13, marginTop: -10, marginBottom: 16 }}>All fields in this step are optional.</p>
          <Row2>
            <FInput label="Current Employer" value={fd.employer} onChange={e => upd('employer', e.target.value)} />
            <FInput label="Occupation / Job Title" value={fd.occupation} onChange={e => upd('occupation', e.target.value)} />
          </Row2>
          <PhoneInput label="Work Phone Number" value={fd.workPhone} onChange={v => upd('workPhone', v)} />
        </Card>

        <Card>
          <CardTitle>Employer Address</CardTitle>
          <FInput label="Street Address" value={fd.employerStreet} onChange={e => upd('employerStreet', e.target.value)} />
          <Row2>
            <FInput label="City" value={fd.employerCity} onChange={e => upd('employerCity', e.target.value)} />
            <FSelect label="State" value={fd.employerState} onChange={e => upd('employerState', e.target.value)}>
              <option value="">Select state</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </FSelect>
          </Row2>
          <FInput label="ZIP" value={fd.employerZip} onChange={e => upd('employerZip', e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" />
        </Card>

        <Card>
          <CardTitle>Financial Information</CardTitle>
          <div style={{ marginBottom: 14 }}>
            <Lbl>Annual Household Income</Lbl>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: GOLD, fontWeight: 600 }}>$</span>
              <FInput
                value={fd.annualIncome} onChange={e => upd('annualIncome', e.target.value)}
                style={{ paddingLeft: 24 }} placeholder="0"
                title="Your total yearly income before taxes"
              />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <Lbl>Net Worth</Lbl>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: GOLD, fontWeight: 600 }}>$</span>
              <FInput
                value={fd.netWorth} onChange={e => upd('netWorth', e.target.value)}
                style={{ paddingLeft: 24 }} placeholder="0"
                title="Total assets minus total debts"
              />
            </div>
          </div>
        </Card>
      </>
    );
  }

  function renderStep3() {
    return (
      <>
        <Card>
          <CardTitle>Your Coverage</CardTitle>
          <p style={{ color: MUTED, fontSize: 14, marginTop: -10, marginBottom: 16 }}>
            This is a company-funded Indexed Universal Life (IUL) policy through National Life Group.
          </p>
          <InfoBox>
            <strong>What is an IUL?</strong><br />
            An IUL is a permanent life insurance policy that provides a death benefit for your loved ones while also building cash value over time. Your cash value growth is tied to a market index (like the S&P 500), giving you the potential for higher returns — but with a floor that protects you from market losses.
          </InfoBox>
          <div style={{ marginBottom: 8 }}>
            <CheckItem><strong>Lifetime Protection</strong> — Permanent coverage that stays with you for life</CheckItem>
            <CheckItem><strong>Cash Value Growth</strong> — Tax-deferred cash value you can access during your lifetime</CheckItem>
            <CheckItem><strong>Living Benefits</strong> — Access funds while alive for chronic/critical/terminal illness</CheckItem>
            <CheckItem><strong>Tax-Free Death Benefit</strong> — Beneficiaries receive full death benefit income tax-free</CheckItem>
            <CheckItem><strong>Downside Protection</strong> — Built-in floor protects cash value when market dips</CheckItem>
            <CheckItem><strong>Company Funded</strong> — Premiums funded by the company, you pay nothing out of pocket</CheckItem>
          </div>
        </Card>

        <Card>
          <CardTitle>Membership Level</CardTitle>
          <p style={{ color: MUTED, fontSize: 13, marginTop: -10, marginBottom: 16 }}>
            This determines your maximum eligible coverage amount.
          </p>
          <FieldErr msg={errors.coveragePurpose} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {[
              { value: 'Sponsor', label: 'Sponsor', desc: 'Up to $1,000,000 in coverage, funded by the company', amount: '$1,000,000' },
              { value: 'Inner Circle', label: 'Inner Circle', desc: 'Up to $3,000,000 in coverage, funded by the company', amount: '$3,000,000' },
            ].map(opt => {
              const active = fd.coveragePurpose === opt.value;
              return (
                <label key={opt.value} style={{ cursor: 'pointer' }}>
                  <div style={{
                    border: `2px solid ${active ? GOLD : BORDER}`,
                    borderRadius: 10, padding: '16px 20px',
                    background: active ? 'rgba(212,175,55,0.06)' : CARD2,
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: 16,
                  }}>
                    <input
                      type="radio" name="coveragePurpose"
                      value={opt.value} checked={active}
                      onChange={() => { upd('coveragePurpose', opt.value); }}
                      style={{ accentColor: GOLD, width: 18, height: 18 }}
                    />
                    <div>
                      <div style={{ color: active ? GOLD : TEXT, fontWeight: 700, fontSize: 16 }}>{opt.label}</div>
                      <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{opt.desc}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', color: GOLD, fontWeight: 700, fontSize: 18 }}>
                      {opt.amount}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </Card>
      </>
    );
  }

  function renderStep4() {
    return (
      <>
        <Card>
          <CardTitle>Beneficiary Information</CardTitle>
          <p style={{ color: MUTED, fontSize: 13, marginTop: -10, marginBottom: 16 }}>
            Primary beneficiaries receive the benefit first. Contingent beneficiaries receive it only if no primary beneficiaries are alive.
          </p>
          <div style={{ color: GOLD, fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Primary Beneficiaries</div>
          {primaryBenes.map((bene, idx) => (
            <BeneficiaryCard
              key={idx} bene={bene} idx={idx}
              onChange={val => {
                const next = [...primaryBenes];
                next[idx] = val;
                setPrimaryBenes(next);
                setErrors(p => ({ ...p, [`bene${idx}Name`]: '', [`bene${idx}Rel`]: '', [`bene${idx}Pct`]: '' }));
              }}
              onRemove={idx > 0 ? () => setPrimaryBenes(primaryBenes.filter((_, i) => i !== idx)) : null}
              required={true}
              errors={errors}
            />
          ))}
          <button
            onClick={() => setPrimaryBenes([...primaryBenes, { fullName: '', dateOfBirth: '', ssn: '', relationship: '', percentage: '' }])}
            style={{
              background: 'none', border: `1px solid ${GOLD}`, borderRadius: 8,
              color: GOLD, padding: '8px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}
          >
            + Add Another Primary Beneficiary
          </button>
        </Card>

        <Card>
          <div style={{ color: GOLD, fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Contingent Beneficiaries (Optional)</div>
          {contingentBenes.map((bene, idx) => (
            <BeneficiaryCard
              key={idx} bene={bene} idx={idx}
              onChange={val => {
                const next = [...contingentBenes];
                next[idx] = val;
                setContingentBenes(next);
              }}
              onRemove={() => setContingentBenes(contingentBenes.filter((_, i) => i !== idx))}
              required={false}
              errors={{}}
            />
          ))}
          <button
            onClick={() => setContingentBenes([...contingentBenes, { fullName: '', dateOfBirth: '', ssn: '', relationship: '', percentage: '' }])}
            style={{
              background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8,
              color: MUTED, padding: '8px 16px', cursor: 'pointer', fontSize: 14,
            }}
          >
            + Add Contingent Beneficiary
          </button>
        </Card>
      </>
    );
  }

  function renderStep5() {
    return (
      <Card>
        <CardTitle>Policy Owner Information</CardTitle>
        <p style={{ color: MUTED, fontSize: 13, marginTop: -10, marginBottom: 16 }}>
          The policy owner is typically the same person being insured.
        </p>
        <FRadio
          label="Is the policy owner the same as the insured?"
          req name="ownerSame"
          value={fd.ownerSameAsInsured}
          onChange={v => upd('ownerSameAsInsured', v)}
          options={[{ value: 'yes', label: 'Yes (same person)' }, { value: 'no', label: 'No (different person or entity)' }]}
        />
        {fd.ownerSameAsInsured === 'no' && (
          <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 18px', marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14, color: TEXT }}>
              <input
                type="checkbox" checked={fd.ownerIsTrust}
                onChange={e => upd('ownerIsTrust', e.target.checked)}
                style={{ accentColor: GOLD, width: 15, height: 15 }}
              />
              Owner is a Trust
            </label>
            {fd.ownerIsTrust && (
              <Row2>
                <FInput label="Trust Name" req value={fd.trustName} onChange={e => upd('trustName', e.target.value)} error={errors.trustName} />
                <FInput label="Trust Date" req type="date" value={fd.trustDate} onChange={e => upd('trustDate', e.target.value)} error={errors.trustDate} />
              </Row2>
            )}
            {!fd.ownerIsTrust && (
              <>
                <FInput label="Owner Full Name" req value={fd.ownerFullName} onChange={e => upd('ownerFullName', e.target.value)} error={errors.ownerFullName} />
                <Row2>
                  <FInput label="Date of Birth" type="date" value={fd.ownerDOB} onChange={e => upd('ownerDOB', e.target.value)} />
                  <PhoneInput label="Phone Number" value={fd.ownerPhone} onChange={v => upd('ownerPhone', v)} />
                </Row2>
                <div style={{ marginBottom: 14 }}>
                  <Lbl>SSN (optional)</Lbl>
                  <SSNInput value={fd.ownerSSN} onChange={v => upd('ownerSSN', v)} />
                </div>
                <FInput label="Relationship to Insured" value={fd.ownerRelationship} onChange={e => upd('ownerRelationship', e.target.value)} />
                <FInput label="Street Address" value={fd.ownerStreet} onChange={e => upd('ownerStreet', e.target.value)} />
                <Row2>
                  <FInput label="City" value={fd.ownerCity} onChange={e => upd('ownerCity', e.target.value)} />
                  <FSelect label="State" value={fd.ownerState} onChange={e => upd('ownerState', e.target.value)}>
                    <option value="">Select state</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </FSelect>
                </Row2>
                <FInput label="ZIP" value={fd.ownerZip} onChange={e => upd('ownerZip', e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" />
              </>
            )}
          </div>
        )}
      </Card>
    );
  }

  function renderStep6() {
    return (
      <>
        <Card>
          <CardTitle>Family History</CardTitle>
          <div style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 16, marginBottom: 16 }}>
            <div style={{ color: TEXT, fontWeight: 600, marginBottom: 10 }}>Father</div>
            <FRadio
              label="Is your father still alive?" req name="fatherAlive"
              value={fd.fatherAlive} onChange={v => upd('fatherAlive', v)}
              options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
              error={errors.fatherAlive}
            />
            {fd.fatherAlive === 'yes' && (
              <FInput label="Father's Current Age" req inputMode="numeric"
                value={fd.fatherAge} onChange={e => upd('fatherAge', e.target.value.replace(/\D/g, ''))}
                error={errors.fatherAge} />
            )}
            {fd.fatherAlive === 'no' && (
              <Row2>
                <FInput label="Age at Time of Passing" req inputMode="numeric"
                  value={fd.fatherAgeAtDeath} onChange={e => upd('fatherAgeAtDeath', e.target.value.replace(/\D/g, ''))}
                  error={errors.fatherAgeAtDeath} />
                <FInput label="Cause of Passing" value={fd.fatherCauseOfDeath} onChange={e => upd('fatherCauseOfDeath', e.target.value)} />
              </Row2>
            )}
          </div>
          <div>
            <div style={{ color: TEXT, fontWeight: 600, marginBottom: 10 }}>Mother</div>
            <FRadio
              label="Is your mother still alive?" req name="motherAlive"
              value={fd.motherAlive} onChange={v => upd('motherAlive', v)}
              options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
              error={errors.motherAlive}
            />
            {fd.motherAlive === 'yes' && (
              <FInput label="Mother's Current Age" req inputMode="numeric"
                value={fd.motherAge} onChange={e => upd('motherAge', e.target.value.replace(/\D/g, ''))}
                error={errors.motherAge} />
            )}
            {fd.motherAlive === 'no' && (
              <Row2>
                <FInput label="Age at Time of Passing" req inputMode="numeric"
                  value={fd.motherAgeAtDeath} onChange={e => upd('motherAgeAtDeath', e.target.value.replace(/\D/g, ''))}
                  error={errors.motherAgeAtDeath} />
                <FInput label="Cause of Passing" value={fd.motherCauseOfDeath} onChange={e => upd('motherCauseOfDeath', e.target.value)} />
              </Row2>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Health & Medical</CardTitle>
          <p style={{ color: MUTED, fontSize: 13, marginTop: -10, marginBottom: 16 }}>
            Basic health information to help determine your coverage options. Your agent will discuss any details with you by phone.
          </p>
          <Row2>
            <FSelect label="Height (ft)" req value={fd.heightFeet} onChange={e => upd('heightFeet', e.target.value)} error={errors.heightFeet}>
              <option value="">ft</option>
              {['3','4','5','6','7'].map(n => <option key={n} value={n}>{n} ft</option>)}
            </FSelect>
            <FSelect label="Height (in)" req value={fd.heightInches} onChange={e => upd('heightInches', e.target.value)} error={errors.heightInches}>
              <option value="">in</option>
              {Array.from({ length: 12 }, (_, i) => i).map(n => <option key={n} value={String(n)}>{n} in</option>)}
            </FSelect>
          </Row2>
          <FInput label="Weight (lbs)" req inputMode="numeric"
            value={fd.weight} onChange={e => upd('weight', e.target.value.replace(/\D/g, ''))}
            error={errors.weight} />
          <FRadio
            label="Do you use tobacco products?" req name="tobacco"
            value={fd.tobaccoUse} onChange={v => upd('tobaccoUse', v)}
            options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
            error={errors.tobaccoUse}
          />
          {fd.tobaccoUse === 'yes' && (
            <Row2>
              <FInput label="Type of Tobacco" req value={fd.tobaccoType} onChange={e => upd('tobaccoType', e.target.value)} error={errors.tobaccoType} />
              <FInput label="Frequency" req value={fd.tobaccoFrequency} onChange={e => upd('tobaccoFrequency', e.target.value)} error={errors.tobaccoFrequency} />
            </Row2>
          )}
          <FRadio
            label="Currently prescribed medications?" req name="meds"
            value={fd.hasMedications} onChange={v => upd('hasMedications', v)}
            options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
            error={errors.hasMedications}
          />
          <FRadio
            label="Current medical conditions?" req name="conditions"
            value={fd.hasMedicalConditions} onChange={v => upd('hasMedicalConditions', v)}
            options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
            error={errors.hasMedicalConditions}
          />
          {(fd.hasMedications === 'yes' || fd.hasMedicalConditions === 'yes') && (
            <InfoBox>
              No need to provide details here — your agent will discuss this with you by phone to ensure everything is documented accurately.
            </InfoBox>
          )}
        </Card>
      </>
    );
  }

  function renderStep7() {
    return (
      <Card>
        <CardTitle>Existing Insurance</CardTitle>
        <FRadio
          label="Do you currently have any life insurance policies?" req name="hasExisting"
          value={fd.hasExistingInsurance} onChange={v => upd('hasExistingInsurance', v)}
          options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
          error={errors.hasExistingInsurance}
        />
        {fd.hasExistingInsurance === 'yes' && (
          <>
            {existingPolicies.map((pol, idx) => (
              <div key={idx} style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 18px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ color: GOLD, fontWeight: 600, fontSize: 14 }}>Policy #{idx + 1}</div>
                  {idx > 0 && (
                    <button onClick={() => setExistingPolicies(existingPolicies.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: DANGER, cursor: 'pointer', fontSize: 18 }}>🗑</button>
                  )}
                </div>
                <Row2>
                  <FInput label="Company Name" value={pol.companyName}
                    onChange={e => { const n = [...existingPolicies]; n[idx] = { ...pol, companyName: e.target.value }; setExistingPolicies(n); }} />
                  <div style={{ marginBottom: 14 }}>
                    <Lbl>Face Amount</Lbl>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: GOLD, fontWeight: 600 }}>$</span>
                      <FInput value={pol.faceAmount} onChange={e => { const n = [...existingPolicies]; n[idx] = { ...pol, faceAmount: e.target.value }; setExistingPolicies(n); }} style={{ paddingLeft: 24 }} />
                    </div>
                  </div>
                </Row2>
                <Row2>
                  <FInput label="When Issued" type="date" value={pol.whenIssued}
                    onChange={e => { const n = [...existingPolicies]; n[idx] = { ...pol, whenIssued: e.target.value }; setExistingPolicies(n); }} />
                  <FRadio
                    label="Will this policy be replaced?" name={`replace${idx}`}
                    value={pol.willBeReplaced}
                    onChange={v => { const n = [...existingPolicies]; n[idx] = { ...pol, willBeReplaced: v }; setExistingPolicies(n); }}
                    options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
                  />
                </Row2>
              </div>
            ))}
            <button
              onClick={() => setExistingPolicies([...existingPolicies, { companyName: '', faceAmount: '', whenIssued: '', willBeReplaced: '' }])}
              style={{ background: 'none', border: `1px solid ${GOLD}`, borderRadius: 8, color: GOLD, padding: '8px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 16 }}
            >
              + Add Another Policy
            </button>
            <FRadio
              label="Is this new policy intended to replace any existing life insurance?" name="isReplacement"
              value={fd.isReplacement} onChange={v => upd('isReplacement', v)}
              options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
            />
          </>
        )}
      </Card>
    );
  }

  function renderStep8() {
    const faceAmount = fd.coveragePurpose === 'Inner Circle' ? 'Up to $3,000,000' : 'Up to $1,000,000';
    const ssnMasked = fd.ssn.length >= 9 ? `***-**-${fd.ssn.slice(5)}` : '—';
    return (
      <>
        <Card>
          <CardTitle>Review Your Application</CardTitle>
          <ReviewSection title="Personal Information" stepNum={1} rows={[
            ['Carrier', 'National Life Group'],
            ['Full Name', [fd.firstName, fd.middleName, fd.lastName].filter(Boolean).join(' ')],
            ['Date of Birth', fd.dateOfBirth],
            ['Gender', fd.gender],
            ['SSN', ssnMasked],
            ['Phone', fmtPhone(fd.phone)],
            ['Email', fd.email],
            ['Address', [fd.streetAddress, fd.city, fd.state, fd.zip].filter(Boolean).join(', ')],
            ['Marital Status', fd.maritalStatus],
            ['Citizenship', fd.citizenship],
          ]} />
          <ReviewSection title="Employment & Income" stepNum={2} rows={[
            ['Employer', fd.employer],
            ['Occupation', fd.occupation],
            ['Annual Income', fd.annualIncome ? `$${fd.annualIncome}` : ''],
            ['Net Worth', fd.netWorth ? `$${fd.netWorth}` : ''],
          ]} />
          <ReviewSection title="Coverage" stepNum={3} rows={[
            ['Product', 'Indexed Universal Life'],
            ['Membership Level', fd.coveragePurpose],
            ['Max Coverage', faceAmount],
            ['Funding', 'Company Funded'],
          ]} />
          <ReviewSection title="Beneficiaries" stepNum={4} rows={
            primaryBenes.map((b, i) => [`Primary #${i+1}`, b.fullName ? `${b.fullName} (${b.relationship || '—'}) — ${b.percentage}%` : ''])
              .concat(contingentBenes.map((b, i) => [`Contingent #${i+1}`, b.fullName ? `${b.fullName} (${b.relationship || '—'}) — ${b.percentage}%` : '']))
          } />
          <ReviewSection title="Policy Owner" stepNum={5} rows={[
            ['Owner', fd.ownerSameAsInsured === 'yes' ? 'Same as insured' : fd.ownerFullName || 'Different person'],
          ]} />
          <ReviewSection title="Health & Medical" stepNum={6} rows={[
            ['Height', fd.heightFeet && fd.heightInches !== '' ? `${fd.heightFeet}ft ${fd.heightInches}in` : ''],
            ['Weight', fd.weight ? `${fd.weight} lbs` : ''],
            ['Tobacco', fd.tobaccoUse],
            ['Medications', fd.hasMedications],
            ['Medical Conditions', fd.hasMedicalConditions],
          ]} />
          <ReviewSection title="Existing Insurance" stepNum={7} rows={[
            ['Has Existing Insurance', fd.hasExistingInsurance],
          ]} />
        </Card>

        <Card>
          <CardTitle>Authorization & Signature</CardTitle>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 14 }}>
            <input
              type="checkbox" checked={fd.certify}
              onChange={e => upd('certify', e.target.checked)}
              style={{ accentColor: GOLD, width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
            />
            <span style={{ color: TEXT, fontSize: 14, lineHeight: 1.6 }}>
              I certify that all information provided is true and complete to the best of my knowledge.
            </span>
          </label>
          <FieldErr msg={errors.certify} />

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 14 }}>
            <input
              type="checkbox" checked={fd.authorize}
              onChange={e => upd('authorize', e.target.checked)}
              style={{ accentColor: GOLD, width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
            />
            <span style={{ color: TEXT, fontSize: 14, lineHeight: 1.6 }}>
              I authorize The Legacy Link and its agents to use this information for the purpose of completing my life insurance application.
            </span>
          </label>
          <FieldErr msg={errors.authorize} />

          <div style={{ marginTop: 8 }}>
            <Lbl req>E-Signature — Type your full legal name</Lbl>
            <input
              value={fd.signatureName}
              onChange={e => upd('signatureName', e.target.value)}
              placeholder="Full legal name"
              style={{
                width: '100%', background: INPUT_BG,
                border: `1px solid ${errors.signatureName ? DANGER : BORDER}`,
                borderRadius: 8, padding: '12px 16px',
                color: GOLD, fontSize: 18,
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontStyle: 'italic',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <FieldErr msg={errors.signatureName} />
          </div>
          <div style={{ marginTop: 10, color: MUTED, fontSize: 13 }}>
            Date: <span style={{ color: TEXT }}>{fd.signatureDate}</span>
          </div>

          {submitError && (
            <div style={{ color: DANGER, background: 'rgba(248,113,113,0.08)', border: `1px solid ${DANGER}44`, borderRadius: 8, padding: '10px 14px', marginTop: 14, fontSize: 14 }}>
              {submitError}
            </div>
          )}
        </Card>
      </>
    );
  }

  // ─── Success screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: GOLD, fontSize: 26, fontWeight: 700, marginBottom: 12 }}>Application Submitted</h2>
          <p style={{ color: TEXT, fontSize: 16, lineHeight: 1.7 }}>
            Thank you, <strong>{fd.firstName}</strong>. Your pre-qualification form has been received. Your agent will review your information and reach out to you shortly to complete the official application process.
          </p>
          <div style={{ marginTop: 32, color: MUTED, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            🛡️ Your information is secure and confidential
          </div>
        </div>
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: `${BG}EE`, backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${BORDER}`,
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: GOLD, fontWeight: 800, fontSize: 16, letterSpacing: 2 }}>THE LEGACY LINK</div>
          <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>Life Insurance Pre-Qualification</div>
        </div>
        <div style={{
          background: `${GOLD}22`, border: `1px solid ${GOLD}44`,
          borderRadius: 20, padding: '4px 12px',
          color: GOLD, fontSize: 12, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          🛡️ Secure & Confidential
        </div>
      </div>

      {/* Content */}
      <div ref={topRef} style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px 80px' }}>
        <ProgressHeader step={step} goToStep={goToStep} />

        {/* Step content */}
        <div key={step}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          {step === 6 && renderStep6()}
          {step === 7 && renderStep7()}
          {step === 8 && renderStep8()}
        </div>

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {step > 1 && (
            <button
              onClick={goBack}
              style={{
                flex: 1, padding: '14px', border: `1px solid ${BORDER}`,
                borderRadius: 10, background: 'none', color: TEXT,
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
            >
              ← Back
            </button>
          )}
          {step < 8 ? (
            <button
              onClick={goNext}
              style={{
                flex: 2, padding: '14px',
                background: `linear-gradient(135deg, ${GOLD}, #F0D060)`,
                border: 'none', borderRadius: 10, color: '#0E131B',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(212,175,55,0.3)',
                transition: 'opacity 0.2s',
              }}
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                flex: 2, padding: '14px',
                background: submitting ? MUTED : `linear-gradient(135deg, ${GOLD}, #F0D060)`,
                border: 'none', borderRadius: 10, color: '#0E131B',
                fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(212,175,55,0.3)',
              }}
            >
              🛡️ {submitting ? 'Submitting…' : 'Submit Application'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
