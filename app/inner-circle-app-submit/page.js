'use client';

import { useEffect } from 'react';

export default function InnerCircleAppSubmitPage() {
  useEffect(() => {
    // Auto-redirect after short delay
    const t = setTimeout(() => {
      window.location.href = 'https://legacylinkhub.com';
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top,#17120a 0%,#0b1020 42%, #05070f 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 480, background: 'linear-gradient(180deg,#0f172a 0%, #0b1020 100%)', border: '1px solid #5f4a23', borderRadius: 16, padding: 32, textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>🔗</div>
        <h2 style={{ color: '#fff', marginTop: 0, marginBottom: 8 }}>Policy Submissions Have Moved</h2>
        <p style={{ color: '#9CA3AF', lineHeight: 1.7, marginBottom: 24 }}>
          All policy applications are now submitted through the Legacy Link Hub.
          You will be redirected automatically in a few seconds.
        </p>
        <a
          href="https://legacylinkhub.com"
          style={{ display: 'block', background: 'linear-gradient(135deg,#c8a96b,#a78647)', color: '#0b1020', fontWeight: 800, borderRadius: 10, padding: '14px 24px', textDecoration: 'none', fontSize: 16, marginBottom: 12 }}
        >
          Go to Legacy Link Hub &rarr;
        </a>
        <p style={{ color: '#475569', fontSize: 12, margin: 0 }}>Redirecting automatically in 3 seconds&hellip;</p>
      </div>
    </main>
  );
}
