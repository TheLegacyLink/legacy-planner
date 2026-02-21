'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const STORAGE_KEY = 'legacy-sponsorship-applications-v1';
const CONTRACT_VERSION = 'v2.1';

export default function SponsorshipContractPage() {
  const router = useRouter();
  const [id, setId] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    setId(sp.get('id') || '');
  }, []);

  const [accepted, setAccepted] = useState(false);
  const [signature, setSignature] = useState('');
  const [error, setError] = useState('');

  const appRecord = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return list.find((r) => r.id === id) || null;
    } catch {
      return null;
    }
  }, [id]);

  const finalize = () => {
    if (!accepted || !signature.trim()) {
      setError('Please accept terms and provide your full name as e-signature.');
      return;
    }

    if (typeof window !== 'undefined') {
      let list = [];
      try {
        list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      } catch {
        list = [];
      }

      const next = list.map((r) =>
        r.id === id
          ? {
              ...r,
              contract_version: CONTRACT_VERSION,
              contract_signed: true,
              contract_signed_date: new Date().toISOString(),
              contract_signature_name: signature.trim()
            }
          : r
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }

    router.push(`/sponsorship-thank-you?id=${encodeURIComponent(id)}`);
  };

  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 900 }}>
        <div className="panelRow">
          <h3 style={{ marginTop: 0 }}>Legacy Link Sponsorship Program Agreement</h3>
          <span className="pill">Contract {CONTRACT_VERSION}</span>
        </div>

        <ol>
          <li><strong>Referral Bonus:</strong> up to $400 per qualified referral with validated attribution.</li>
          <li><strong>Payout Trigger:</strong> Approval alone does not trigger payout. Payout requires onboarding initiation and required onboarding documents complete.</li>
          <li><strong>Licensed and Unlicensed Paths:</strong> Both accepted. Licensed applicants must provide licensing details. Unlicensed applicants must begin pre-licensing for full activation.</li>
          <li><strong>No Income Guarantee:</strong> No guarantee of commissions, bonuses, or production results.</li>
          <li><strong>Compliance:</strong> Company may hold, suspend, or deny payouts for non-compliance, inactivity, fraudulent attribution, or incomplete onboarding.</li>
          <li><strong>Tax Responsibility:</strong> Agent is responsible for all tax reporting and obligations. Company may issue 1099 where required.</li>
          <li><strong>Policy Updates:</strong> Company may update program terms and compensation structures with notice.</li>
        </ol>

        {appRecord ? (
          <p className="muted">
            Applicant: <strong>{appRecord.firstName} {appRecord.lastName}</strong> • Status: <strong>{appRecord.status}</strong> • Score: <strong>{appRecord.application_score}</strong>
          </p>
        ) : (
          <p className="red">Application record not found. Go back and submit application first.</p>
        )}

        <div className="settingsGrid" style={{ marginTop: 16 }}>
          <label style={{ gridColumn: '1 / -1' }}>
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            {' '}I have read and agree to all Sponsorship Agreement terms.
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            E-signature (Full Legal Name)
            <input value={signature} onChange={(e) => setSignature(e.target.value)} />
          </label>
        </div>

        <div className="rowActions">
          <button type="button" onClick={finalize} disabled={!appRecord}>Sign Contract & Continue</button>
        </div>
        {error ? <p className="red">{error}</p> : null}
      </div>
    </main>
  );
}
