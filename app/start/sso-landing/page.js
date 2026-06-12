'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Must match exactly what start/page.js uses
const TOKEN_KEY = 'start_portal_token_v1';

function SsoLandingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState('Logging you in\u2026');

  useEffect(() => {
    const sessionToken = params.get('session');
    const dest = params.get('dest') || '/unlicensed-backoffice';

    if (!sessionToken) {
      setStatus('Invalid link. Redirecting\u2026');
      setTimeout(() => {
        window.location.href = process.env.NEXT_PUBLIC_BASE44_LOGIN_URL || 'https://legacylinkhub.com';
      }, 1500);
      return;
    }

    // Store session token with the exact key the back office uses
    try {
      window.localStorage.setItem(TOKEN_KEY, sessionToken);
    } catch {
      // localStorage unavailable — proceed anyway
    }

    setStatus('Access granted. Taking you in\u2026');
    setTimeout(() => {
      router.replace(dest);
    }, 800);
  }, [params, router]);

  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: 'radial-gradient(900px 480px at 95% 4%, rgba(200,169,107,.15), transparent 55%), #020617',
      color: '#F8FAFC',
      fontFamily: 'Arial, Helvetica, sans-serif'
    }}>
      <div style={{ textAlign: 'center', display: 'grid', gap: 18, padding: 32 }}>
        <div style={{
          width: 56, height: 56, border: '3px solid #1F2A44',
          borderTop: '3px solid #C8A96B', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.1em', color: '#93C5FD', textTransform: 'uppercase', marginBottom: 6 }}>
            The Legacy Link
          </div>
          <p style={{ margin: 0, color: '#CBD5E1', fontSize: 15 }}>{status}</p>
        </div>
        <p style={{ margin: 0, color: '#475569', fontSize: 12 }}>Powered by Legacy Link Hub</p>
      </div>
    </main>
  );
}

export default function SsoLandingPage() {
  return (
    <Suspense>
      <SsoLandingInner />
    </Suspense>
  );
}
