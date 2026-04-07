'use client';

import { useEffect, useState } from 'react';

function clean(v = '') { return String(v || '').trim(); }

export default function AgentPublicPage({ params }) {
  const slug = clean(params?.slug || '');
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch(`/api/agent-profile/${encodeURIComponent(slug)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          if (!canceled) setError('Agent profile not found yet.');
          return;
        }
        if (!canceled) setProfile(data.profile || null);
      } catch {
        if (!canceled) setError('Could not load this profile right now.');
      }
    })();
    return () => { canceled = true; };
  }, [slug]);

  if (error) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#020617', color: '#e2e8f0', padding: 16 }}>
        <div style={{ border: '1px solid #334155', borderRadius: 14, background: '#0b1220', padding: 20, maxWidth: 600 }}>
          <h1 style={{ marginTop: 0 }}>Profile Unavailable</h1>
          <p style={{ color: '#94a3b8' }}>{error}</p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#020617', color: '#e2e8f0' }}>Loading profile…</main>;
  }

  const photo = clean(profile?.profilePhotoDataUrl) || '/kimora-profile.png';

  return (
    <main style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0', padding: 16 }}>
      <div style={{ maxWidth: 980, margin: '0 auto', border: '1px solid #1f2a44', borderRadius: 16, background: '#0b1220', overflow: 'hidden' }}>
        <div style={{ padding: 20, borderBottom: '1px solid #1f2a44' }}>
          <h1 style={{ margin: 0 }}>{profile.name || 'Agent Profile'}</h1>
          <p style={{ color: '#94a3b8', marginBottom: 0 }}>{profile.title || 'Licensed Agent'} • The Legacy Link</p>
        </div>
        <div style={{ padding: 20, display: 'grid', gap: 14, gridTemplateColumns: '220px 1fr' }}>
          <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 12, textAlign: 'center', background: '#020617' }}>
            <img src={photo} alt={profile.name || 'Agent'} style={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 999, border: '2px solid #dc2626' }} />
          </div>
          <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 12, background: '#020617' }}>
            <p><strong>Email:</strong> {profile.email || '-'}</p>
            <p><strong>Phone:</strong> {profile.phone || '-'}</p>
            <p><strong>NPN:</strong> {profile.npnId || '-'}</p>
            <p><strong>Website:</strong> {profile.website || '-'}</p>
            <p><strong>Licensed States:</strong> {Array.isArray(profile.licensedStates) && profile.licensedStates.length ? profile.licensedStates.join(', ') : '-'}</p>
            {profile.calendar ? <p><strong>Book a call:</strong> <a href={profile.calendar} style={{ color: '#93c5fd' }}>{profile.calendar}</a></p> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
