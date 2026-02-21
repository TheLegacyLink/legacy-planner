'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../components/AppShell';

function normalizeRef(ref = '') {
  return String(ref).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

export default function SponsorshipSignupPage() {
  const router = useRouter();
  const [ref, setRef] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    setRef(normalizeRef(sp.get('ref') || ''));
  }, []);

  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [error, setError] = useState('');

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
    <AppShell title="Sponsorship Program Signup">
      <div className="panel" style={{ maxWidth: 620 }}>
        <h3 style={{ marginTop: 0 }}>Profile Creation</h3>
        <p className="muted">Complete your profile to begin your sponsorship application.</p>
        {ref ? <p className="pill onpace">Referred by code: {ref}</p> : null}

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

          <div className="rowActions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit">Continue to Application</button>
          </div>
          {error ? <p className="red" style={{ gridColumn: '1 / -1', marginTop: 0 }}>{error}</p> : null}
        </form>
      </div>
    </AppShell>
  );
}
