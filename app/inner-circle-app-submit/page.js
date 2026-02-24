'use client';

import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_CONFIG, loadRuntimeConfig } from '../../lib/runtimeConfig';

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

export default function InnerCircleAppSubmitPage() {
  const [ref, setRef] = useState('');
  const [saved, setSaved] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [innerCircleAgents, setInnerCircleAgents] = useState(DEFAULT_CONFIG.agents || []);

  const [form, setForm] = useState({
    applicantName: '',
    referredByName: '',
    policyWriterName: '',
    policyWriterOtherName: '',
    state: '',
    policyNumber: '',
    monthlyPremium: '',
    carrier: FIXED_CARRIER,
    productName: FIXED_PRODUCT,
    status: 'Submitted'
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    setRef(normalizeRef(sp.get('ref') || ''));

    const cfg = loadRuntimeConfig();
    if (Array.isArray(cfg?.agents) && cfg.agents.length) {
      setInnerCircleAgents(cfg.agents);
    }
  }, []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit = useMemo(() => {
    const writerOk = form.policyWriterName === 'Other'
      ? form.policyWriterOtherName.trim()
      : form.policyWriterName.trim();

    return (
      form.applicantName.trim() &&
      form.referredByName.trim() &&
      writerOk &&
      form.state.trim() &&
      form.monthlyPremium !== ''
    );
  }, [form]);

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const effectivePolicyWriter = form.policyWriterName === 'Other'
      ? form.policyWriterOtherName.trim()
      : form.policyWriterName;

    const record = {
      id: `app_${Date.now()}`,
      ...form,
      policyWriterName: effectivePolicyWriter,
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

    setSaved('Application submitted successfully.');
    setUploadFileName('');
    setForm({
      applicantName: '',
      referredByName: '',
      policyWriterName: '',
      policyWriterOtherName: '',
      state: '',
      policyNumber: '',
      monthlyPremium: '',
      carrier: FIXED_CARRIER,
      productName: FIXED_PRODUCT,
      status: 'Submitted'
    });
  };

  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 840 }}>
        <h3 style={{ marginTop: 0 }}>Policy Details</h3>
        <p className="muted" style={{ marginTop: -2 }}>Fill out the information below to submit your policy.</p>
        {ref ? <p className="pill onpace">Referral code locked: {ref}</p> : null}

        <form className="settingsGrid" onSubmit={submit}>
          <label>
            Client Name *
            <input
              value={form.applicantName}
              onChange={(e) => update('applicantName', e.target.value)}
              placeholder="Enter client's full name"
            />
          </label>

          <label>
            Referred By *
            <select value={form.referredByName} onChange={(e) => update('referredByName', e.target.value)}>
              <option value="">Select inner circle agent</option>
              {innerCircleAgents.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>

          <label>
            Policy Written By *
            <select value={form.policyWriterName} onChange={(e) => update('policyWriterName', e.target.value)}>
              <option value="">Select policy writer</option>
              {innerCircleAgents.map((name) => (
                <option key={`writer-${name}`} value={name}>{name}</option>
              ))}
              <option value="Other">Other</option>
            </select>
          </label>

          {form.policyWriterName === 'Other' ? (
            <label>
              Policy Writer Full Name *
              <input
                value={form.policyWriterOtherName}
                onChange={(e) => update('policyWriterOtherName', e.target.value)}
                placeholder="Enter full name"
              />
            </label>
          ) : null}

          <label>
            State *
            <input
              value={form.state}
              onChange={(e) => update('state', e.target.value.toUpperCase())}
              placeholder="e.g., FL"
              maxLength={2}
            />
          </label>

          <label>
            Carrier *
            <input value={FIXED_CARRIER} disabled readOnly />
          </label>

          <label>
            Product *
            <input value={FIXED_PRODUCT} disabled readOnly />
          </label>

          <label>
            Policy Number (Optional)
            <input
              value={form.policyNumber}
              onChange={(e) => update('policyNumber', e.target.value)}
              placeholder="Enter policy number if available"
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

          <div style={{ gridColumn: '1 / -1' }}>
            <label>
              Policy Documents (optional upload)
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={(e) => setUploadFileName(e.target.files?.[0]?.name || '')}
              />
            </label>
            <small className="muted">File: {uploadFileName || 'Not uploaded yet'}</small>
          </div>

          <div className="rowActions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" disabled={!canSubmit}>Submit Application</button>
          </div>
        </form>

        {saved ? <p className="green">{saved}</p> : null}
      </div>
    </main>
  );
}
