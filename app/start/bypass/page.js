'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const TOKEN_KEY = 'start_portal_token_v1';
const PROFILE_KEY = 'start_portal_profile_v1';

function clean(v = '') { return String(v || '').trim(); }

function BypassInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState('Verifying your access…');

  useEffect(() => {
    const token = clean(params.get('t') || '');
    if (!token) {
      setStatus('Invalid link. Redirecting…');
      setTimeout(() => router.replace('/start'), 2000);
      return;
    }

    (async () => {
      try {
        // Validate token against the server
        const res = await fetch('/api/start-auth/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.ok) {
          setStatus('Link expired or invalid. Redirecting to login…');
          setTimeout(() => router.replace('/start'), 2500);
          return;
        }

        // Store token + profile
        window.localStorage.setItem(TOKEN_KEY, token);
        window.localStorage.setItem(PROFILE_KEY, JSON.stringify(data.profile));

        setStatus('Access confirmed. Taking you to your back office…');

        // Check contract status
        const cr = await fetch('/api/esign-contract', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const cd = await cr.json().catch(() => ({}));

        if (cd?.signed) {
          const track = clean(data.profile?.trackType || 'unlicensed');
          router.replace(track === 'licensed' ? '/licensed-backoffice' : '/unlicensed-backoffice');
        } else {
          // Needs to sign contract — /start will read token from localStorage
          router.replace('/start');
        }
      } catch {
        setStatus('Something went wrong. Redirecting to login…');
        setTimeout(() => router.replace('/start'), 2500);
      }
    })();
  }, [params, router]);

  return (
    <main style={{
      minHeight: '100vh',
      background: '#020617',
      display: 'grid',
      placeItems: 'center',
      color: '#F8FAFC',
      fontFamily: 'Arial, Helvetica, sans-serif'
    }}>
      <div style={{ textAlign: 'center', display: 'grid', gap: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.1em', color: '#93C5FD', textTransform: 'uppercase' }}>
          The Legacy Link
        </div>
        <div style={{ fontSize: 32 }}>🔐</div>
        <p style={{ margin: 0, color: '#CBD5E1', fontSize: 16 }}>{status}</p>
      </div>
    </main>
  );
}

export default function BypassPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100vh', background: '#020617', display: 'grid', placeItems: 'center' }}>
        <p style={{ color: '#CBD5E1' }}>Loading…</p>
      </main>
    }>
      <BypassInner />
    </Suspense>
  );
}
