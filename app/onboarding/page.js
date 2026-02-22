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
    { label: 'Watch Welcome Video', url: 'https://www.youtube.com/watch?v=SVvU9SvCH9o' }
  ];

  if (licensing === 'Unlicensed' || licensing === 'Pre-licensing') {
    return [
      ...common,
      { label: 'Watch How to Get Contracted', url: 'https://youtu.be/d2saZzYzzkA?si=z63iJxMZD0b78guj' },
      { label: 'Wait for Jamal outreach to start pre-licensing', url: '' }
    ];
  }

  return [
    ...common,
    {
      label: 'Complete Contracting Profile',
      url: 'https://accounts.surancebay.com/oauth/authorize?redirect_uri=https:%2F%2Fsurelc.surancebay.com%2Fproducer%2Foauth%3FreturnUrl%3D%252Fprofile%252Fcontact-info%253FgaId%253D168%2526gaId%253D168%2526branch%253DInvestaLink%2526branchVisible%253Dtrue%2526branchEditable%253Dfalse%2526branchRequired%253Dtrue%2526autoAdd%253Dfalse%2526requestMethod%253DGET&gaId=168&client_id=surecrmweb&response_type=code'
    },
    { label: 'Watch How to Get Contracted', url: 'https://youtu.be/d2saZzYzzkA?si=z63iJxMZD0b78guj' },
    { label: 'Watch Back Office Access & Setup', url: 'https://youtu.be/QVg0rUti1hM' }
  ];
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
        <div style={{ width: '100%', maxWidth: 420, background: '#111827', border: '1px solid #334155', borderRadius: 12, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Legacy Link Onboarding Portal</h2>
          <p style={{ color: '#cbd5e1' }}>Enter your access code to continue.</p>
          <input
            type="password"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="Access Code"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#fff', marginBottom: 10 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') unlock();
            }}
          />
          <button type="button" onClick={unlock} style={{ width: '100%', padding: 10, borderRadius: 8, border: 0, background: '#2563eb', color: '#fff' }}>
            Open Portal
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: 20 }}>
      <div style={{ maxWidth: 760, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ background: '#0f172a', color: '#fff', padding: '20px 24px' }}>
          <h2 style={{ margin: 0 }}>Welcome to The Legacy Link</h2>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Onboarding SOP Portal</p>
        </div>

        <div style={{ padding: 24 }}>
          <p><strong>Name:</strong> {data.name}</p>
          <p><strong>Email:</strong> {data.email || '—'}</p>
          <p><strong>Path:</strong> {data.licensing}</p>
          <p><strong>Referred By:</strong> {data.referredBy || '—'}</p>

          <div style={{ marginTop: 16, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
            <strong>Progress:</strong> {done}/{items.length} complete
          </div>

          <h3 style={{ marginTop: 20 }}>Checklist</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((item, idx) => (
              <label key={`${item.label}-${idx}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={Boolean(checks[idx])}
                  onChange={(e) => setChecks((prev) => ({ ...prev, [idx]: e.target.checked }))}
                />
                <span>
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer">{item.label}</a>
                  ) : (
                    item.label
                  )}
                </span>
              </label>
            ))}
          </div>

          <p style={{ marginTop: 20, color: '#334155' }}>
            Need help? Contact Operations at <a href="mailto:jamalholmes195@yahoo.com">jamalholmes195@yahoo.com</a>.
          </p>
        </div>
      </div>
    </main>
  );
}
