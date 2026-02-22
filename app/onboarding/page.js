'use client';

import { useMemo, useState } from 'react';

function readParam(params, key, fallback = '') {
  return String(params.get(key) || fallback).trim();
}

function decodeHash(value = '') {
  try {
    return atob(value);
  } catch {
    return '';
  }
}

function checklistByLicensing(licensing = 'Unknown') {
  const common = [
    { label: 'Join Skool', url: 'https://www.skool.com/legacylink/about?ref=660035f641d94e3a919e081e220ed6fe' },
    { label: 'Watch Whatever It Takes + Leave a Comment', url: 'https://www.youtube.com/watch?v=SVvU9SvCH9o' }
  ];

  if (licensing === 'Unlicensed' || licensing === 'Pre-licensing') {
    return [
      ...common,
      { label: 'Watch Get Contracted', url: 'https://youtu.be/d2saZzYzzkA?si=z63iJxMZD0b78guj' },
      { label: 'Operations Outreach (Jamal contacts you)', url: '' },
      { label: 'Start Pre-Licensing', url: '' },
      { label: 'Attend Weekly Meeting', url: '' },
      { label: 'Complete 1 Hour Community Service + Upload Proof in App', url: '' }
    ];
  }

  return [
    ...common,
    { label: 'Watch Get Contracted', url: 'https://youtu.be/d2saZzYzzkA?si=z63iJxMZD0b78guj' },
    {
      label: 'Complete Contracting Profile (SuranceBay)',
      url: 'https://accounts.surancebay.com/oauth/authorize?redirect_uri=https:%2F%2Fsurelc.surancebay.com%2Fproducer%2Foauth%3FreturnUrl%3D%252Fprofile%252Fcontact-info%253FgaId%253D168%2526gaId%253D168%2526branch%253DInvestaLink%2526branchVisible%253Dtrue%2526branchEditable%253Dfalse%2526branchRequired%253Dtrue%2526autoAdd%253Dfalse%2526requestMethod%253DGET&gaId=168&client_id=surecrmweb&response_type=code'
    },
    { label: 'Attend Weekly Meeting', url: '' },
    { label: 'Complete 1 Hour Community Service + Upload Proof in App', url: '' }
  ];
}

function trackLabel(licensing) {
  if (licensing === 'Unlicensed' || licensing === 'Pre-licensing') return 'Unlicensed Track';
  if (licensing === 'Licensed') return 'Licensed Track';
  return 'Onboarding Track';
}

export default function OnboardingPortalPage() {
  const [accessCode, setAccessCode] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [checks, setChecks] = useState({});

  const data = useMemo(() => {
    if (typeof window === 'undefined') {
      return { first: 'Agent', last: '', name: 'Agent', email: '', licensing: 'Unknown', referredBy: '', codeHash: '' };
    }
    const params = new URLSearchParams(window.location.search);
    const first = readParam(params, 'first', 'Agent');
    const last = readParam(params, 'last', '');
    const name = readParam(params, 'name', `${first} ${last}`.trim());
    const email = readParam(params, 'email', '');
    const licensing = readParam(params, 'licensing', 'Unknown');
    const referredBy = readParam(params, 'referredBy', '');
    const codeHash = readParam(params, 'codeHash', '');
    return { first, last, name, email, licensing, referredBy, codeHash };
  }, []);

  const items = checklistByLicensing(data.licensing);
  const done = items.filter((_, idx) => checks[idx]).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  function unlock() {
    const expected = `legacy-link|${accessCode.trim()}`;
    if (decodeHash(data.codeHash) !== expected) {
      window.alert('Incorrect access code.');
      return;
    }
    setUnlocked(true);
  }

  if (!unlocked) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0b1220', color: '#fff', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 460, background: '#0f172a', border: '1px solid #334155', borderRadius: 14, padding: 24 }}>
          <div style={{ display: 'grid', justifyItems: 'center', marginBottom: 10 }}>
            <img src="/legacy-link-logo-white.png" alt="Legacy Link" style={{ width: 180, height: 'auto' }} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 28, textAlign: 'center' }}>Agent Onboarding Portal</h2>
          <p style={{ color: '#cbd5e1', marginTop: 0, textAlign: 'center' }}>Secure portal access</p>
          <input
            type="password"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="Enter Access Code"
            style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #475569', background: '#020617', color: '#fff', marginBottom: 12, fontSize: 16 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') unlock();
            }}
          />
          <button type="button" onClick={unlock} style={{ width: '100%', padding: 12, borderRadius: 10, border: 0, background: '#2563eb', color: '#fff', fontSize: 16, fontWeight: 600 }}>
            Open Portal
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0b1220 0%, #111827 35%, #f8fafc 35%, #f8fafc 100%)', padding: 20 }}>
      <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 10px 30px rgba(2,6,23,0.12)' }}>
        <div style={{ background: '#0f172a', color: '#fff', padding: '20px 28px' }}>
          <div style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
            <img src="/legacy-link-logo-white.png" alt="Legacy Link" style={{ width: 220, height: 'auto' }} />
            <p style={{ margin: 0, opacity: 0.95, fontSize: 18, fontWeight: 600 }}>Agent Onboarding SOP Portal</p>
          </div>
        </div>

        <div style={{ padding: 28, color: '#0f172a' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <span style={{ background: data.licensing === 'Licensed' ? '#dcfce7' : '#ffedd5', color: '#14532d', border: '1px solid #86efac', borderRadius: 999, padding: '6px 12px', fontWeight: 700 }}>
              {trackLabel(data.licensing)}
            </span>
            <span style={{ background: '#eef2ff', color: '#1e3a8a', border: '1px solid #c7d2fe', borderRadius: 999, padding: '6px 12px', fontWeight: 700 }}>
              Progress: {done}/{items.length} ({pct}%)
            </span>
          </div>

          <div style={{ height: 10, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#2563eb', transition: 'width 180ms ease' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 22 }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Name</div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{data.name}</div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Email</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{data.email || '—'}</div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Referred By</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{data.referredBy || '—'}</div>
            </div>
          </div>

          <h3 style={{ marginTop: 0, marginBottom: 10, fontSize: 24 }}>Your Checklist</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((item, idx) => (
              <label key={`${item.label}-${idx}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, background: checks[idx] ? '#f0fdf4' : '#fff' }}>
                <input
                  type="checkbox"
                  checked={Boolean(checks[idx])}
                  onChange={(e) => setChecks((prev) => ({ ...prev, [idx]: e.target.checked }))}
                  style={{ marginTop: 4 }}
                />
                <span style={{ fontSize: 17 }}>
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', fontWeight: 600 }}>{item.label}</a>
                  ) : (
                    item.label
                  )}
                </span>
              </label>
            ))}
          </div>

          <div style={{ marginTop: 18, padding: 12, border: '1px solid #dcfce7', borderRadius: 10, background: '#f0fdf4' }}>
            <strong>Lead Release:</strong> Once you are contracted and all checklist items are complete, you will begin receiving leads.
          </div>

          <div style={{ marginTop: 12, padding: 12, border: '1px solid #dbeafe', borderRadius: 10, background: '#eff6ff' }}>
            <strong>Need help?</strong> Contact Operations at <a href="mailto:support@jdholmesagencyllc.com">SUPPORT@jdholmesagencyllc.com</a>
          </div>
        </div>
      </div>
    </main>
  );
}
