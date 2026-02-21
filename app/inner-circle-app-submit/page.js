'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'legacy-inner-circle-policy-apps-v1';

function normalizeRef(ref = '') {
  const cleaned = String(ref).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (cleaned === 'latricia_wright') return 'leticia_wright';
  return cleaned;
}

export default function InnerCircleAppSubmitPage() {
  const [ref, setRef] = useState('');
  const [saved, setSaved] = useState('');
  const [form, setForm] = useState({
    applicantName: '',
    referredByName: '',
    policyNumber: '',
    carrier: '',
    productName: '',
    status: 'Submitted'
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    setRef(normalizeRef(sp.get('ref') || ''));
  }, []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.applicantName.trim()) return;

    const record = {
      id: `app_${Date.now()}`,
      ...form,
      refCode: ref,
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

    setSaved('Application submitted.');
    setForm({ applicantName: '', referredByName: '', policyNumber: '', carrier: '', productName: '', status: 'Submitted' });
  };

  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 760 }}>
        <h3 style={{ marginTop: 0 }}>Standalone Application Submission</h3>
        {ref ? <p className="pill onpace">Referral code locked: {ref}</p> : <p className="muted">No referral code detected.</p>}

        <form className="settingsGrid" onSubmit={submit}>
          <label>
            Applicant Name
            <input value={form.applicantName} onChange={(e) => update('applicantName', e.target.value)} />
          </label>
          <label>
            Referred By
            <input value={form.referredByName} onChange={(e) => update('referredByName', e.target.value)} />
          </label>
          <label>
            Policy Number
            <input value={form.policyNumber} onChange={(e) => update('policyNumber', e.target.value)} />
          </label>
          <label>
            Carrier
            <input value={form.carrier} onChange={(e) => update('carrier', e.target.value)} />
          </label>
          <label>
            Product Name
            <input value={form.productName} onChange={(e) => update('productName', e.target.value)} />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(e) => update('status', e.target.value)}>
              {['Submitted', 'Pending', 'Approved'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <div className="rowActions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit">Submit Application</button>
          </div>
        </form>

        {saved ? <p className="green">{saved}</p> : null}
      </div>
    </main>
  );
}
