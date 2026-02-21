'use client';

import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'legacy-sponsorship-applications-v1';
const DEFAULT_BOOKING_URL = 'https://calendly.com/';

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

  const bookingUrl = record?.booking_link || DEFAULT_BOOKING_URL;

  const shareTelegram = async () => {
    if (!record) return;
    const text = [
      'Inner Circle Sponsor Alert',
      `Applicant: ${record.firstName || ''} ${record.lastName || ''}`.trim(),
      `Score: ${record.application_score || 0}`,
      'Needs licensed closer support for policy writing.',
      'Who can take this one?'
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }

    const tg = `https://t.me/share/url?url=&text=${encodeURIComponent(text)}`;
    window.open(tg, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="publicPage">
      <div className="panel" style={{ maxWidth: 760 }}>
        {!record ? (
          <>
            <h3 style={{ marginTop: 0 }}>Application Received</h3>
            <p className="muted">Your application was submitted. If qualified, a team member will reach out soon.</p>
          </>
        ) : record.decision_bucket === 'auto_approved' ? (
          <>
            <h3 style={{ marginTop: 0 }}>🎉 Congratulations — You’re Auto-Approved</h3>
            <p>
              You’re approved to move forward. Next step: book your onboarding call to get started.
            </p>

            <div className="rowActions" style={{ flexWrap: 'wrap' }}>
              <a href={bookingUrl} target="_blank" rel="noreferrer">
                <button type="button">Book Onboarding Call</button>
              </a>
              <button type="button" className="ghost" onClick={shareTelegram}>Need Licensed Closer (Telegram)</button>
            </div>

            <div style={{ marginTop: 12, border: '1px solid #bfdbfe', borderRadius: 12, background: '#eff6ff', padding: 12 }}>
              <strong>What to bring to your call:</strong>
              <ul style={{ marginBottom: 0 }}>
                <li>Valid ID and contact info</li>
                <li>Licensing status/details (if licensed)</li>
                <li>State availability and schedule</li>
                <li>Questions about onboarding and first policy plan</li>
              </ul>
              <p className="muted" style={{ marginBottom: 0 }}>
                Booking recommendation: choose a time at least 48 hours out.
              </p>
            </div>
          </>
        ) : record.decision_bucket === 'manual_review' ? (
          <>
            <h3 style={{ marginTop: 0 }}>✅ Application Submitted — Under Review</h3>
            <p>
              Thanks for applying. Your application is in manual review. A team member will contact you within
              <strong> 1–2 business days</strong>.
            </p>
            <p className="muted">Status: Pending Review • Score: {record.application_score || 0}</p>
          </>
        ) : (
          <>
            <h3 style={{ marginTop: 0 }}>Application Received</h3>
            <p>
              You don’t qualify at this time. Keep building your profile and feel free to reapply after strengthening
              your readiness.
            </p>
            <p className="muted">Status: Not Qualified At This Time • Score: {record.application_score || 0}</p>
          </>
        )}
      </div>
    </main>
  );
}
