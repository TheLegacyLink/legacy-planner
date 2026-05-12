'use client';

import { useEffect, useRef, useState } from 'react';

export default function PayPage() {
  const containerRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  useEffect(() => {
    let canceled = false;

    async function loadEmbed() {
      try {
        const res = await fetch('/api/byzly-token', { cache: 'no-store' });
        const data = await res.json();
        if (!data?.ok || !data?.token || canceled) { setStatus('error'); return; }

        const iframe = document.createElement('iframe');
        iframe.src = `https://app.byzly.com/embed?token=${encodeURIComponent(data.token)}`;
        iframe.style.width = '100%';
        iframe.style.height = '800px';
        iframe.style.border = 'none';
        iframe.style.maxWidth = '100%';
        iframe.style.borderRadius = '16px';
        iframe.allow = 'payment';

        if (containerRef.current && !canceled) {
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(iframe);
          setStatus('ready');
        }
      } catch {
        if (!canceled) setStatus('error');
      }
    }

    loadEmbed();
    return () => { canceled = true; };
  }, []);

  return (
    <main style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 1200px 600px at 50% -10%, rgba(22,81,174,0.18), transparent 60%), #020617',
      color: '#F8FAFC',
      fontFamily: 'Arial, Helvetica, sans-serif'
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 24px 32px',
        textAlign: 'center'
      }}>
        {/* Logo */}
        <div style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: '#0047AB',
          border: '3px solid #1651AE',
          boxShadow: '0 0 40px rgba(22,81,174,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          overflow: 'hidden'
        }}>
          <img
            src="/legacy-link-seal.png"
            alt="Legacy Link"
            style={{ width: 80, height: 80, objectFit: 'contain', filter: 'invert(1) brightness(1.2)' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>

        {/* Brand name */}
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#60A5FA', marginBottom: 10 }}>
          The Legacy Link
        </div>

        {/* Headline */}
        <h1 style={{
          margin: 0,
          fontSize: 'clamp(28px, 5vw, 42px)',
          fontWeight: 900,
          lineHeight: 1.1,
          color: '#F8FAFC',
          maxWidth: 640,
          marginBottom: 14
        }}>
          Secure Payment Portal
        </h1>

        {/* Subtext */}
        <p style={{
          margin: 0,
          fontSize: 16,
          color: '#94A3B8',
          maxWidth: 480,
          lineHeight: 1.6,
          marginBottom: 8
        }}>
          Complete your payment securely below. All transactions are encrypted and processed through our trusted payment partner.
        </p>

        {/* Trust badges */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 20 }}>
          {['🔒 SSL Secured', '✓ Encrypted', '✓ Trusted Processing'].map(b => (
            <span key={b} style={{
              background: 'rgba(22,81,174,0.15)',
              border: '1px solid rgba(96,165,250,0.25)',
              borderRadius: 20,
              padding: '5px 14px',
              fontSize: 12,
              color: '#93C5FD',
              fontWeight: 600
            }}>{b}</span>
          ))}
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ width: '100%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.2), transparent)', marginBottom: 32 }} />

      {/* ── Payment Embed ── */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px 80px' }}>

        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#64748B' }}>
            <div style={{ fontSize: 32, marginBottom: 16, animation: 'pulse 1.5s infinite' }}>⏳</div>
            <p style={{ margin: 0, fontSize: 15 }}>Loading secure payment form...</p>
          </div>
        )}

        {status === 'error' && (
          <div style={{
            textAlign: 'center',
            padding: '80px 24px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 16
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <p style={{ margin: '0 0 8px', color: '#FCA5A5', fontWeight: 700, fontSize: 18 }}>Payment Form Unavailable</p>
            <p style={{ margin: 0, color: '#94A3B8', fontSize: 14 }}>
              Please contact us at{' '}
              <a href="mailto:support@thelegacylink.com" style={{ color: '#60A5FA' }}>support@thelegacylink.com</a>
            </p>
          </div>
        )}

        <div
          ref={containerRef}
          style={{
            display: status === 'ready' ? 'block' : 'none',
            background: 'rgba(11,18,52,0.6)',
            border: '1px solid rgba(30,58,138,0.4)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
          }}
        />
      </div>

      {/* ── Footer ── */}
      <div style={{
        borderTop: '1px solid rgba(30,58,138,0.3)',
        padding: '24px',
        textAlign: 'center'
      }}>
        <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>
          © 2026 The Legacy Link · Investalink LLC ·{' '}
          <a href="mailto:support@thelegacylink.com" style={{ color: '#60A5FA', textDecoration: 'none' }}>
            support@thelegacylink.com
          </a>
          {' '}· 201-862-7040
        </p>
      </div>

    </main>
  );
}
