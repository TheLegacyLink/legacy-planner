'use client';

import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'legacy-sponsorship-applications-v1';

export default function SponsorshipThankYouPage() {
  const [id, setId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    setId(sp.get('id') || '');
  }, []);

  const record = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return list.find((r) => r.id === id) || null;
    } catch {
      return null;
    }
  }, [id]);

  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 700 }}>
        <h3 style={{ marginTop: 0 }}>Thank You — You’re In the System</h3>
        <p>Your application and agreement are complete.</p>
        <ul className="checklist">
          <li><span>Application Received</span><small>{record?.submitted_at || '—'}</small></li>
          <li><span>Contract Signed</span><small>{record?.contract_signed_date || '—'}</small></li>
          <li><span>Current Status</span><small>{record?.status || 'Pending Review'}</small></li>
          <li><span>Onboarding Status</span><small>{record?.onboarding_status || 'Needs Contact'}</small></li>
        </ul>
        <p className="muted">Your application will be reviewed. If qualified, your onboarding process will begin.</p>
      </div>
    </main>
  );
}
