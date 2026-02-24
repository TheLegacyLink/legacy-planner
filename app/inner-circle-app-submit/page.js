'use client';

import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'legacy-inner-circle-policy-apps-v1';
const FIXED_CARRIER = 'F&G';
const FIXED_PRODUCT = 'IUL Pathsetter';

function normalizeRef(ref = '') {
  const cleaned = String(ref).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (cleaned === 'latricia_wright') return 'leticia_wright';
  return cleaned;
}

function fmtCurrency(v = '') {
  if (v === '' || v == null) return '';
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  if (Number.isNaN(n)) return '';
  return n.toFixed(2);
}

function cleanNameGuess(v = '') {
  return String(v || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STATE_NAME_TO_CODE = {
  ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA', COLORADO: 'CO',
  CONNECTICUT: 'CT', DELAWARE: 'DE', FLORIDA: 'FL', GEORGIA: 'GA', HAWAII: 'HI', IDAHO: 'ID',
  ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS', KENTUCKY: 'KY', LOUISIANA: 'LA',
  MAINE: 'ME', MARYLAND: 'MD', MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN', MISSISSIPPI: 'MS',
  MISSOURI: 'MO', MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV', 'NEW HAMPSHIRE': 'NH',
  'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC',
  'NORTH DAKOTA': 'ND', OHIO: 'OH', OKLAHOMA: 'OK', OREGON: 'OR', PENNSYLVANIA: 'PA',
  'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN',
  TEXAS: 'TX', UTAH: 'UT', VERMONT: 'VT', VIRGINIA: 'VA', WASHINGTON: 'WA',
  'WEST VIRGINIA': 'WV', WISCONSIN: 'WI', WYOMING: 'WY'
};

const STATE_CODES = new Set(Object.values(STATE_NAME_TO_CODE));

function parseFromFilename(fileName = '') {
  const raw = String(fileName || '');
  const upper = raw.toUpperCase();

  const stateMatch = upper.match(/\b([A-Z]{2})\b/);
  const premiumMatch = raw.match(/\$?\s*([0-9]{2,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]{2,6}(?:\.[0-9]{1,2})?)/);

  // Very light name guess from prefix before first number
  const namePart = raw.split(/[0-9$]/)[0] || '';

  return {
    state: stateMatch && STATE_CODES.has(stateMatch[1]) ? stateMatch[1] : '',
    monthlyPremium: premiumMatch ? fmtCurrency(premiumMatch[1]) : '',
    applicantName: cleanNameGuess(namePart)
  };
}

function extractStateFromText(text = '') {
  const upper = String(text || '').toUpperCase();

  const labeledCode = upper.match(/(?:STATE|ST)\s*[:\-]?\s*([A-Z]{2})\b/);
  if (labeledCode && STATE_CODES.has(labeledCode[1])) return labeledCode[1];

  const labeledName = upper.match(/(?:STATE|ST)\s*[:\-]?\s*([A-Z ]{4,})/);
  if (labeledName) {
    const cleaned = labeledName[1].replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (STATE_NAME_TO_CODE[cleaned]) return STATE_NAME_TO_CODE[cleaned];
  }

  for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
    if (upper.includes(name)) return code;
  }

  const anyCode = upper.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/);
  return anyCode ? anyCode[1] : '';
}

function extractPremiumFromText(text = '') {
  const src = String(text || '');
  const lines = src.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

  const preferred = lines.find((l) => /monthly|modal|target premium|premium/i.test(l));
  const sample = preferred || src;
  const m = sample.match(/\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]{2,6}(?:\.[0-9]{1,2})?)/);
  if (m) return fmtCurrency(m[1]);

  const fallback = src.match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]{2,6}(?:\.[0-9]{1,2}))/);
  return fallback ? fmtCurrency(fallback[1]) : '';
}

function extractNameFromText(text = '') {
  const src = String(text || '');
  const lines = src.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

  const labeled = lines.find((l) => /(?:client|insured|applicant)\s*name/i.test(l));
  if (labeled) {
    const after = labeled.split(/name\s*[:\-]?/i)[1] || '';
    const clean = after.replace(/[^a-zA-Z' -]/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean && clean.length >= 3) return clean;
  }

  for (const l of lines.slice(0, 12)) {
    const candidate = l.replace(/[^a-zA-Z' -]/g, ' ').replace(/\s+/g, ' ').trim();
    if (/^[A-Za-z' -]{5,40}$/.test(candidate) && candidate.split(' ').length >= 2) return candidate;
  }

  return '';
}

async function extractTextFromImage(file) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(file);
    return String(result?.data?.text || '');
  } finally {
    await worker.terminate();
  }
}

export default function InnerCircleAppSubmitPage() {
  const [ref, setRef] = useState('');
  const [saved, setSaved] = useState('');
  const [step, setStep] = useState(1);
  const [uploadFileName, setUploadFileName] = useState('');
  const [mappingBusy, setMappingBusy] = useState(false);
  const [mappingStatus, setMappingStatus] = useState('');

  const [form, setForm] = useState({
    applicantName: '',
    state: '',
    initialPremium: '',
    monthlyPremium: '',
    policyNumber: '',
    referredByName: '',
    carrier: FIXED_CARRIER,
    productName: FIXED_PRODUCT,
    status: 'Submitted'
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    setRef(normalizeRef(sp.get('ref') || ''));
  }, []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function applyIllustrationMap(file) {
    if (!file) return;
    setUploadFileName(file.name || 'Uploaded illustration');
    setMappingBusy(true);
    setMappingStatus('Reading illustration...');

    try {
      const fromFilename = parseFromFilename(file.name || '');
      let fromText = { applicantName: '', state: '', monthlyPremium: '' };

      if (String(file.type || '').startsWith('image/')) {
        const text = await extractTextFromImage(file);
        fromText = {
          applicantName: extractNameFromText(text),
          state: extractStateFromText(text),
          monthlyPremium: extractPremiumFromText(text)
        };
        setMappingStatus('Mapped from illustration text. Please verify before submit.');
      } else {
        setMappingStatus('PDF uploaded. Used filename mapping; please verify all fields.');
      }

      const mapped = {
        applicantName: fromText.applicantName || fromFilename.applicantName || '',
        state: fromText.state || fromFilename.state || '',
        monthlyPremium: fromText.monthlyPremium || fromFilename.monthlyPremium || ''
      };

      setForm((prev) => ({
        ...prev,
        applicantName: prev.applicantName || mapped.applicantName,
        state: prev.state || mapped.state,
        monthlyPremium: prev.monthlyPremium || mapped.monthlyPremium,
        initialPremium: prev.initialPremium || mapped.monthlyPremium,
        carrier: FIXED_CARRIER,
        productName: FIXED_PRODUCT
      }));

      setStep(3);
    } catch {
      setMappingStatus('Could not auto-map this file. Please enter fields manually.');
      setStep(1);
    } finally {
      setMappingBusy(false);
    }
  }

  const canSubmit = useMemo(() => {
    return (
      form.applicantName.trim() &&
      form.state.trim() &&
      form.initialPremium !== '' &&
      form.monthlyPremium !== ''
    );
  }, [form]);

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const record = {
      id: `app_${Date.now()}`,
      ...form,
      carrier: FIXED_CARRIER,
      productName: FIXED_PRODUCT,
      refCode: ref,
      illustrationFileName: uploadFileName,
      submittedAt: new Date().toISOString()
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

    setSaved('Application submitted and mapped successfully.');
    setStep(1);
    setUploadFileName('');
    setMappingStatus('');
    setForm({
      applicantName: '',
      state: '',
      initialPremium: '',
      monthlyPremium: '',
      policyNumber: '',
      referredByName: '',
      carrier: FIXED_CARRIER,
      productName: FIXED_PRODUCT,
      status: 'Submitted'
    });
  };

  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 840 }}>
        <h3 style={{ marginTop: 0 }}>Inner Circle App Submit</h3>
        <p className="muted" style={{ marginTop: -4 }}>
          Upload illustration → map key fields → review and submit.
        </p>
        {ref ? <p className="pill onpace">Referral code locked: {ref}</p> : <p className="muted">No referral code detected.</p>}

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              className={step === n ? '' : 'ghost'}
              onClick={() => setStep(n)}
            >
              Step {n}
            </button>
          ))}
        </div>

        <form className="settingsGrid" onSubmit={submit}>
          {step === 1 ? (
            <>
              <label>
                Client Name *
                <input
                  value={form.applicantName}
                  onChange={(e) => update('applicantName', e.target.value)}
                  placeholder="Enter client full name"
                />
              </label>
              <label>
                State *
                <input
                  value={form.state}
                  onChange={(e) => update('state', e.target.value.toUpperCase())}
                  placeholder="e.g., TX"
                  maxLength={2}
                />
              </label>

              <label>
                Initial Premium *
                <input
                  value={form.initialPremium}
                  onChange={(e) => update('initialPremium', fmtCurrency(e.target.value))}
                  placeholder="0.00"
                />
              </label>
              <label>
                Monthly Premium *
                <input
                  value={form.monthlyPremium}
                  onChange={(e) => update('monthlyPremium', fmtCurrency(e.target.value))}
                  placeholder="0.00"
                />
              </label>

              <label>
                Carrier
                <input value={FIXED_CARRIER} disabled readOnly />
              </label>
              <label>
                Product
                <input value={FIXED_PRODUCT} disabled readOnly />
              </label>

              <label>
                Policy Number (optional)
                <input value={form.policyNumber} onChange={(e) => update('policyNumber', e.target.value)} />
              </label>
              <label>
                Referred By (optional)
                <input value={form.referredByName} onChange={(e) => update('referredByName', e.target.value)} />
              </label>
            </>
          ) : null}

          {step === 2 ? (
            <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 10 }}>
              <label>
                Upload Illustration (PNG, JPG, PDF)
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  disabled={mappingBusy}
                  onChange={(e) => applyIllustrationMap(e.target.files?.[0])}
                />
              </label>

              {mappingBusy ? <p className="muted">Mapping in progress...</p> : null}
              {mappingStatus ? <p className="muted">{mappingStatus}</p> : null}

              <div className="panel" style={{ padding: 12 }}>
                <strong>Mapping rules locked</strong>
                <ul style={{ margin: '8px 0 0 18px' }}>
                  <li>Carrier = <strong>F&amp;G</strong> (always)</li>
                  <li>Product = <strong>IUL Pathsetter</strong> (always)</li>
                  <li>Mapped fields shown on Step 3 immediately after upload</li>
                </ul>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 10 }}>
              <div className="panel" style={{ padding: 14 }}>
                <h4 style={{ marginTop: 0, marginBottom: 8 }}>Review Mapped Policy</h4>
                <div className="settingsGrid">
                  <label>
                    Client Name
                    <input value={form.applicantName} onChange={(e) => update('applicantName', e.target.value)} />
                  </label>
                  <label>
                    State
                    <input value={form.state} onChange={(e) => update('state', e.target.value.toUpperCase())} maxLength={2} />
                  </label>
                  <label>
                    Initial Premium
                    <input value={form.initialPremium} onChange={(e) => update('initialPremium', fmtCurrency(e.target.value))} />
                  </label>
                  <label>
                    Monthly Premium
                    <input value={form.monthlyPremium} onChange={(e) => update('monthlyPremium', fmtCurrency(e.target.value))} />
                  </label>
                  <label>
                    Carrier
                    <input value={FIXED_CARRIER} disabled readOnly />
                  </label>
                  <label>
                    Product
                    <input value={FIXED_PRODUCT} disabled readOnly />
                  </label>
                </div>

                <div style={{ marginTop: 8 }}>
                  <small className="muted">Illustration file: {uploadFileName || 'Not uploaded yet'}</small>
                  {mappingStatus ? <><br /><small className="muted">{mappingStatus}</small></> : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="rowActions" style={{ gridColumn: '1 / -1' }}>
            {step > 1 ? (
              <button type="button" className="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))}>
                Back
              </button>
            ) : null}
            {step < 3 ? (
              <button type="button" onClick={() => setStep((s) => Math.min(3, s + 1))}>
                Next
              </button>
            ) : (
              <button type="submit" disabled={!canSubmit}>Submit Application</button>
            )}
          </div>
        </form>

        {saved ? <p className="green">{saved}</p> : null}
      </div>
    </main>
  );
}
