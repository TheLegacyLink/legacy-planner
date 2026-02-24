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

function parseFromFilename(fileName = '') {
  const raw = String(fileName || '');
  const upper = raw.toUpperCase();

  const stateMatch = upper.match(/\b([A-Z]{2})\b/);
  const premiumMatch = raw.match(/\$?\s*([0-9]{2,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]{2,6}(?:\.[0-9]{1,2})?)/);

  // Very light name guess from prefix before first number
  const namePart = raw.split(/[0-9$]/)[0] || '';

  return {
    state: stateMatch ? stateMatch[1] : '',
    monthlyPremium: premiumMatch ? fmtCurrency(premiumMatch[1]) : '',
    applicantName: cleanNameGuess(namePart)
  };
}

export default function InnerCircleAppSubmitPage() {
  const [ref, setRef] = useState('');
  const [saved, setSaved] = useState('');
  const [step, setStep] = useState(1);
  const [uploadFileName, setUploadFileName] = useState('');

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

  function applyIllustrationMap(file) {
    if (!file) return;
    setUploadFileName(file.name || 'Uploaded illustration');

    // Best-effort from filename only. User can correct in Step 1.
    const mapped = parseFromFilename(file.name || '');
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
                  onChange={(e) => applyIllustrationMap(e.target.files?.[0])}
                />
              </label>

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
