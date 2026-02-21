'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function normalizeRef(ref = '') {
  const cleaned = String(ref).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (cleaned === 'latricia_wright') return 'leticia_wright';
  return cleaned;
}

export default function SponsorshipSignupPage() {
  const router = useRouter();
  const [ref, setRef] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    setRef(normalizeRef(sp.get('ref') || ''));
  }, []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = (e) => {
    e.preventDefault();
    const phone = String(form.phone || '').replace(/\D/g, '');
    if (!form.firstName.trim() || !form.lastName.trim() || phone.length < 10) {
      setError('Please complete first name, last name, and a valid phone number.');
      return;
    }

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone,
      refCode: ref,
      createdAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('legacy-sponsor-signup', JSON.stringify(payload));
    }

    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    router.push(`/sponsorship-application${query}`);
  };

  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 960 }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <img
              src="/legacy-link-sponsorship-badge.jpg"
              alt="Legacy Link"
              style={{ width: 80, height: 80, borderRadius: 999, objectFit: 'cover', border: '2px solid #dbe5f5' }}
            />
            <div>
              <h1 style={{ margin: 0 }}>Legacy Link Sponsorship Program</h1>
              <p className="muted" style={{ margin: '4px 0 0 0' }}>
                Make money first. Build legacy forever.
              </p>
            </div>
          </div>

          <p style={{ margin: 0 }}>
            We remove the upfront barriers (licensing, CRM, leads, training) so you can start earning and grow with a proven system.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="#apply" style={{ textDecoration: 'none' }}>
              <button type="button" className="publicPrimaryBtn publicPrimaryBtnXL">Start My Sponsored Application</button>
            </a>
            <a href="https://www.loom.com/share/71356efcc71c4959a71106a1147d0b7d" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button type="button" className="ghost">Watch 2-Minute Overview</button>
            </a>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className="pill" style={{ background: '#eef3ff', color: '#1e3a8a', borderColor: '#c7d2fe' }}>No Upfront Cost</span>
            <span className="pill" style={{ background: '#ecfeff', color: '#0f766e', borderColor: '#99f6e4' }}>Live + On-Demand Training</span>
            <span className="pill" style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>CRM + Lead Access</span>
          </div>

          <div className="luxCard luxBlue">
            <h3 style={{ marginTop: 0, marginBottom: 10, color: '#1e3a8a' }}>What You Get</h3>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
              <li>Licensing and onboarding support</li>
              <li>CRM and lead access system</li>
              <li>Mentorship + weekly training</li>
              <li>Scripts, objections, and day-1 playbook</li>
            </ul>
          </div>

          <div className="luxCard">
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Roadmap</h3>
            <p className="muted" style={{ margin: 0 }}>
              $0 → $2,500 → $5,000 → $10,000/month → Leadership
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 10 }}>
            <div className="miniStat"><strong>24h</strong><span>Review target</span></div>
            <div className="miniStat"><strong>Mon–Sat</strong><span>Support cadence</span></div>
            <div className="miniStat"><strong>1 hr/mo</strong><span>Community service</span></div>
          </div>

          <div className="luxCard">
            <h3 style={{ marginTop: 0 }}>Watch: How to Apply</h3>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 10, overflow: 'hidden', background: '#0f172a' }}>
              <iframe
                src="https://www.loom.com/embed/71356efcc71c4959a71106a1147d0b7d"
                title="Legacy Link Sponsorship Video"
                frameBorder="0"
                allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              />
            </div>
          </div>

          <div className="luxCard">
            <h3 style={{ marginTop: 0 }}>Frequently Asked Questions</h3>
            <details>
              <summary>Do I need to be licensed to apply?</summary>
              <p className="muted">No. We sponsor both licensed and unlicensed applicants.</p>
            </details>
            <details>
              <summary>How long does review take?</summary>
              <p className="muted">Manual review candidates are contacted within 1–2 business days.</p>
            </details>
            <details>
              <summary>What happens if I’m approved?</summary>
              <p className="muted">You immediately book a call and begin onboarding steps.</p>
            </details>
          </div>
        </div>
      </div>

      <div className="sectionDivider" />

      <div className="panel" id="apply" style={{ maxWidth: 820, marginTop: 16, padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>Start Your Sponsored Application</h3>
        <p className="muted">Complete this quick profile to continue.</p>
        {ref ? <p className="pill onpace">Referral locked: {ref}</p> : null}

        <form className="settingsGrid" onSubmit={onSubmit}>
          <label>
            First Name
            <input value={form.firstName} onChange={(e) => update('firstName', e.target.value)} />
          </label>
          <label>
            Last Name
            <input value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Phone Number
            <input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </label>

          <div className="rowActions" style={{ gridColumn: '1 / -1', display: 'grid', gap: 8 }}>
            <button type="submit" className="publicPrimaryBtn publicPrimaryBtnXL publicBtnBlock">🚀 START YOUR APPLICATION NOW</button>
            <small className="muted" style={{ textAlign: 'center' }}>Takes less than 2 minutes • Limited sponsorship spots each month</small>
          </div>
          {error ? <p className="red" style={{ gridColumn: '1 / -1', marginTop: 0 }}>{error}</p> : null}
        </form>
      </div>
    </main>
  );
}
