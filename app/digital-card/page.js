'use client';

import { useEffect, useState } from 'react';
import { CardEditor } from '../../components/DigitalCard';

const GOLD = '#d4af37';

export default function DigitalCardPage() {
  const [refCode, setRefCode] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    // Try licensed token first, then unlicensed
    const lToken = typeof window !== 'undefined' ? localStorage.getItem('licensed_backoffice_token') : '';
    const uToken = typeof window !== 'undefined' ? localStorage.getItem('unlicensed_backoffice_token') : '';

    async function tryAuth() {
      if (lToken) {
        try {
          const res = await fetch('/api/licensed-backoffice/auth/me', {
            headers: { Authorization: `Bearer ${lToken}` }, cache: 'no-store'
          });
          const d = await res.json();
          if (d?.ok && d?.profile) {
            setProfile(d.profile);
            const ref = referralCode(d.profile.name || '');
            setRefCode(ref);
            return;
          }
        } catch {}
      }
      if (uToken) {
        try {
          const res = await fetch('/api/unlicensed-backoffice/auth/me', {
            headers: { Authorization: `Bearer ${uToken}` }, cache: 'no-store'
          });
          const d = await res.json();
          if (d?.ok && d?.profile) {
            setProfile(d.profile);
            const ref = unlicensedRefCode(d.profile.name || '');
            setRefCode(ref);
            return;
          }
        } catch {}
      }
      setAuthError('Please log into your back office first.');
    }
    tryAuth();
  }, []);

  if (authError) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0c10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
          <div style={{ marginBottom: 16 }}>{authError}</div>
          <a href="/licensed-backoffice" style={{ color: GOLD }}>Licensed Back Office</a>
          &nbsp;&nbsp;|&nbsp;&nbsp;
          <a href="/unlicensed-backoffice" style={{ color: GOLD }}>Unlicensed Back Office</a>
        </div>
      </div>
    );
  }

  if (!refCode) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0c10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>Loading your card...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c10', padding: '32px 20px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'rgba(212,175,55,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>🪪</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>My Business Card</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>Customize your card and track QR scans</div>
          </div>
        </div>
        <CardEditor refCode={refCode} profile={profile} />
      </div>
    </div>
  );
}

function referralCode(name = '') {
  const n = String(name).trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  return n.replace(/\s+/g, '_') || 'member';
}

function unlicensedRefCode(name = '') {
  const n = String(name).trim().toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).map(x => x.trim()).filter(Boolean);
  if (n.length >= 2) return `${n[0]}.${n[n.length - 1]}`;
  return n[0] || 'member';
}
