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
  const namePart = raw.split(/[0-9$]/)[0] || '';

  return {
    state: stateMatch && STATE_CODES.has(stateMatch[1]) ? stateMatch[1] : '',
    monthlyPremium: premiumMatch ? fmtCurrency(premiumMatch[1]) : '',
    applicantName: cleanNameGuess(namePart)
  };
}

function extractStateFromText(text = '') {
  const raw = String(text || '');
  const upper = raw.toUpperCase();
  const lines = upper.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

  // Primary: explicit State line, tolerant to OCR misspellings like STETE/STATE
  for (const line of lines) {
    const normalized = line.replace(/[^A-Z0-9: -]/g, ' ');
    if (/\bST[A-Z]{2,4}\b/.test(normalized)) {
      const m = normalized.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/);
      if (m) return m[1];
    }
  }

  const labeledCode = upper.match(/(?:STATE|STETE|STATEE|ST)\s*[:\-]?\s*([A-Z]{2})\b/);
  if (labeledCode && STATE_CODES.has(labeledCode[1])) return labeledCode[1];

  const cityStateZip = upper.match(/,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s+\d{5}/);
  if (cityStateZip) return cityStateZip[1];

  for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
    if (upper.includes(name)) return code;
  }

  const anyCode = upper.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/);
  return anyCode ? anyCode[1] : '';
}

function extractPremiumFromText(text = '') {
  const src = String(text || '');
  const lines = src.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

  const moneyRegex = /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]{2,6}(?:\.[0-9]{1,2}))/;

  // Highest priority: line containing INITIAL + PREMIUM (tolerant to OCR)
  const explicitInitial = lines.find((l) => {
    const norm = l.toLowerCase().replace(/[^a-z0-9]/g, '');
    return norm.includes('initial') && norm.includes('prem');
  });
  if (explicitInitial) {
    const m = explicitInitial.match(moneyRegex);
    if (m) return fmtCurrency(m[1]);
  }

  // Next priority: line containing MONTHLY + PREMIUM / MODAL
  const monthlyLine = lines.find((l) => {
    const norm = l.toLowerCase().replace(/[^a-z0-9]/g, '');
    return (norm.includes('monthly') && norm.includes('prem')) || norm.includes('modal');
  });
  if (monthlyLine) {
    const m = monthlyLine.match(moneyRegex);
    if (m) return fmtCurrency(m[1]);
  }

  // Any line with premium keyword
  const preferred = lines.find((l) => /prem|monthly|modal|target/i.test(l));
  if (preferred) {
    const m = preferred.match(moneyRegex);
    if (m) return fmtCurrency(m[1]);
  }

  // Last fallback: first dollar-like amount in full OCR text
  const fallback = src.match(moneyRegex);
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

let ocrWorkerPromise;

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const { createWorker, PSM } = await import('tesseract.js');
      const worker = await createWorker('eng');
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: '1'
      });
      return worker;
    })();
  }
  return ocrWorkerPromise;
}

async function extractTextFromImage(fileOrBlob) {
  const worker = await getOcrWorker();
  const result = await worker.recognize(fileOrBlob);
  return String(result?.data?.text || '');
}

async function loadImageBitmapFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function cropTopSummaryBlobFromImage(file) {
  const img = await loadImageBitmapFromFile(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const sx = 0;
  const sy = Math.floor(img.height * 0.04);
  const sw = img.width;
  const sh = Math.max(1, Math.floor(img.height * 0.33));

  canvas.width = sw;
  canvas.height = sh;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob || file;
}

async function extractTextFromPdf(file) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.149/legacy/build/pdf.worker.min.mjs';

  const ab = await file.arrayBuffer();
  const task = pdfjsLib.getDocument({ data: ab });
  const pdf = await task.promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1.4 });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  // OCR only the summary band at top for speed
  const crop = document.createElement('canvas');
  const cropCtx = crop.getContext('2d');
  const sy = Math.floor(canvas.height * 0.04);
  const sh = Math.max(1, Math.floor(canvas.height * 0.33));
  crop.width = canvas.width;
  crop.height = sh;
  cropCtx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);

  const blob = await new Promise((resolve) => crop.toBlob(resolve, 'image/png'));
  if (!blob) return '';
  return extractTextFromImage(blob);
}

export default function InnerCircleAppSubmitPage() {
  const [ref, setRef] = useState('');
  const [saved, setSaved] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [mappingBusy, setMappingBusy] = useState(false);
  const [mappingStatus, setMappingStatus] = useState('');
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

  async function applyIllustrationMap(file) {
    if (!file) return;
    setUploadFileName(file.name || 'Uploaded illustration');
    setMappingBusy(true);
    setMappingStatus('Reading illustration...');

    try {
      const fromFilename = parseFromFilename(file.name || '');
      let fromText = { applicantName: '', state: '', monthlyPremium: '' };
      const fileType = String(file.type || '').toLowerCase();

      setMappingStatus('Mapping top summary section...');

      if (fileType.startsWith('image/')) {
        const topBlob = await cropTopSummaryBlobFromImage(file);
        const topText = await extractTextFromImage(topBlob);
        fromText = {
          applicantName: extractNameFromText(topText),
          state: extractStateFromText(topText),
          monthlyPremium: extractPremiumFromText(topText)
        };
      } else if (fileType.includes('pdf') || String(file.name || '').toLowerCase().endsWith('.pdf')) {
        const text = await extractTextFromPdf(file);
        fromText = {
          applicantName: extractNameFromText(text),
          state: extractStateFromText(text),
          monthlyPremium: extractPremiumFromText(text)
        };
      }

      const mapped = {
        applicantName: fromText.applicantName || fromFilename.applicantName || '',
        state: fromText.state || fromFilename.state || '',
        monthlyPremium: fromText.monthlyPremium || fromFilename.monthlyPremium || ''
      };

      setForm((prev) => ({
        ...prev,
        applicantName: mapped.applicantName || prev.applicantName,
        state: mapped.state || prev.state,
        monthlyPremium: mapped.monthlyPremium || prev.monthlyPremium,
        carrier: FIXED_CARRIER,
        productName: FIXED_PRODUCT
      }));

      setMappingStatus(
        `Mapped values → State: ${mapped.state || 'not found'} | Monthly: ${mapped.monthlyPremium || 'not found'}`
      );
    } catch {
      setMappingStatus('Could not auto-map this file. Please enter fields manually.');
    } finally {
      setMappingBusy(false);
    }
  }

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
    setMappingStatus('');
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
              Policy Documents (Upload illustration to auto-fill)
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                disabled={mappingBusy}
                onChange={(e) => applyIllustrationMap(e.target.files?.[0])}
              />
            </label>
            {mappingBusy ? <p className="muted">Mapping in progress...</p> : null}
            {mappingStatus ? <p className="muted">{mappingStatus}</p> : null}
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
