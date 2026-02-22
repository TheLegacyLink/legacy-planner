'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

const BRAND = {
  bgDeep: '#060b16',
  bgPanel: '#0d162a',
  text: '#f8fafc',
  textMuted: '#cbd5e1',
  ink: '#0f172a',
  line: '#e2e8f0',
  accent: '#d4af37',
  accentDark: '#8b6b10',
  link: '#1d4ed8',
  success: '#166534'
};

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
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: `radial-gradient(circle at top, #182847 0%, ${BRAND.bgDeep} 55%)`, color: BRAND.text, padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 500, background: BRAND.bgPanel, border: '1px solid #24334f', borderRadius: 18, padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }}>
          <div style={{ display: 'grid', justifyItems: 'center', gap: 12, marginBottom: 8 }}>
            <Image src="/legacy-link-logo-white.png" alt="Legacy Link" width={220} height={120} style={{ width: 220, height: 'auto' }} priority />
            <div style={{ width: 80, height: 2, background: BRAND.accent }} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 32, letterSpacing: 0.2, textAlign: 'center' }}>Agent Onboarding Portal</h2>
          <p style={{ color: BRAND.textMuted, marginTop: 0, textAlign: 'center', fontSize: 16 }}>Secure access to your Legacy Link SOP checklist</p>
          <input
            type="password"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="Enter Access Code"
            style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #31476f', background: '#020617', color: '#fff', marginBottom: 14, fontSize: 16 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') unlock();
            }}
          />
          <button
            type="button"
            onClick={unlock}
            style={{ width: '100%', padding: 14, borderRadius: 12, border: 0, background: `linear-gradient(90deg, ${BRAND.accent} 0%, #f2d369 100%)`, color: '#1f2937', fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px rgba(212,175,55,0.35)' }}
          >
            Open Portal
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0a1120 0%, #13213e 28%, #f8fafc 28%, #f8fafc 100%)', padding: 20 }}>
      <div style={{ maxWidth: 980, margin: '0 auto', background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 14px 40px rgba(2,6,23,0.18)' }}>
        <div style={{ background: `linear-gradient(120deg, #0d162a 0%, #132543 100%)`, color: '#fff', padding: '22px 30px' }}>
          <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
            <Image src="/legacy-link-logo-white.png" alt="Legacy Link" width={250} height={120} style={{ width: 250, height: 'auto' }} priority />
            <p style={{ margin: 0, opacity: 0.95, fontSize: 18, fontWeight: 700, letterSpacing: 0.2 }}>Agent Onboarding SOP Portal</p>
          </div>
        </div>

        <div style={{ padding: 30, color: BRAND.ink }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <span style={{ background: data.licensing === 'Licensed' ? '#dcfce7' : '#ffedd5', color: data.licensing === 'Licensed' ? '#14532d' : '#9a3412', border: `1px solid ${data.licensing === 'Licensed' ? '#86efac' : '#fdba74'}`, borderRadius: 999, padding: '7px 14px', fontWeight: 800, fontSize: 13 }}>
              {trackLabel(data.licensing)}
            </span>
            <span style={{ background: '#eff6ff', color: '#1e3a8a', border: '1px solid #bfdbfe', borderRadius: 999, padding: '7px 14px', fontWeight: 800, fontSize: 13 }}>
              Progress: {done}/{items.length} ({pct}%)
            </span>
          </div>

          <div style={{ height: 12, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden', marginBottom: 22 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${BRAND.accentDark} 0%, ${BRAND.accent} 100%)`, transition: 'width 180ms ease' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
            <div style={{ border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 14, background: '#fcfdff' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Name</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{data.name}</div>
            </div>
            <div style={{ border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 14, background: '#fcfdff' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{data.email || '—'}</div>
            </div>
            <div style={{ border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 14, background: '#fcfdff' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Referred By</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{data.referredBy || '—'}</div>
            </div>
          </div>

          <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 26, letterSpacing: 0.2 }}>Your Checklist</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((item, idx) => (
              <label
                key={`${item.label}-${idx}`}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  padding: 14,
                  border: checks[idx] ? '1px solid #86efac' : `1px solid ${BRAND.line}`,
                  borderRadius: 12,
                  background: checks[idx] ? '#f0fdf4' : '#fff'
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(checks[idx])}
                  onChange={(e) => setChecks((prev) => ({ ...prev, [idx]: e.target.checked }))}
                  style={{ marginTop: 3, width: 18, height: 18 }}
                />
                <span style={{ fontSize: 17, lineHeight: 1.45, fontWeight: 600 }}>
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer" style={{ color: BRAND.link, fontWeight: 700, textDecoration: 'none' }}>{item.label}</a>
                  ) : (
                    item.label
                  )}
                </span>
              </label>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: 16, border: '1px solid #e2e8f0', borderRadius: 12, background: '#ffffff' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 24 }}>Start Here: Legacy Link Playbook</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                'Module 1: What Legacy Link is and what to expect in your first 30 days',
                'Module 2: Daily production rhythm (activity targets, follow-up windows, accountability)',
                'Module 3: Lead handling + scripts + objection flow',
                'Module 4: Contracting, compliance, and activation milestones',
                'Module 5: How to earn your first wins and scale consistently'
              ].map((module) => (
                <div key={module} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, background: '#f8fafc', fontWeight: 600 }}>
                  {module}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14, padding: 16, border: '1px solid #bfdbfe', borderRadius: 12, background: '#eff6ff' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 22 }}>Your Upline + Support</h3>
            <p style={{ margin: '0 0 6px' }}><strong>Upline:</strong> {data.referredBy || 'Assigned by operations'}</p>
            <p style={{ margin: 0 }}><strong>Operations:</strong> <a href="mailto:support@jdholmesagencyllc.com">SUPPORT@jdholmesagencyllc.com</a></p>
          </div>

          <div style={{ marginTop: 14, padding: 16, border: '1px solid #fde68a', borderRadius: 12, background: '#fffbeb' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 22 }}>Optional Upgrade: Inner Circle</h3>
            <p style={{ margin: '0 0 10px' }}>You are not obligated to upgrade. You can stay on the free plan. If you want faster growth, Inner Circle gives you leverage.</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>CRM + dialer + automations to improve follow-up consistency</li>
              <li>AI-powered follow-up support and conversion workflows</li>
              <li>Execution playbooks, accountability, and production coaching</li>
            </ul>
            <p style={{ margin: '10px 0 0' }}><strong>Limited spots.</strong> Reinvesting in your system can materially increase output when you execute consistently.</p>
          </div>

          <div style={{ marginTop: 20, padding: 14, border: '1px solid #bbf7d0', borderRadius: 12, background: '#f0fdf4' }}>
            <strong style={{ color: BRAND.success }}>Lead Release:</strong> Once you are contracted and all checklist items are complete, you will begin receiving leads.
          </div>

          <div style={{ marginTop: 12, padding: 14, border: '1px solid #dbeafe', borderRadius: 12, background: '#eff6ff' }}>
            <strong>Need help?</strong> Contact Operations at <a href="mailto:support@jdholmesagencyllc.com">SUPPORT@jdholmesagencyllc.com</a>
          </div>
        </div>
      </div>
    </main>
  );
}
