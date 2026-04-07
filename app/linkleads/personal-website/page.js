'use client';

import { useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'legacy_lead_marketplace_user_v1';
const HUB_SESSION_KEY = 'inner_circle_hub_member_v1';
const SETUP_PROFILE_MAP_KEY = 'linkleads_setup_profiles_by_email_v1';
const SETUP_PROFILE_KEY = 'linkleads_setup_profile_v1';

function clean(v = '') { return String(v || '').trim(); }

export default function LinkLeadsPersonalWebsitePage() {
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromQuery = new URLSearchParams(window.location.search).get('email') || '';

    let sessionEmail = '';
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      sessionEmail = clean(s?.email || '');
    } catch {}

    if (!sessionEmail) {
      try {
        const hub = JSON.parse(localStorage.getItem(HUB_SESSION_KEY) || '{}');
        sessionEmail = clean(hub?.email || '');
      } catch {}
    }

    const resolvedEmail = clean(fromQuery || sessionEmail).toLowerCase();
    setEmail(resolvedEmail);

    try {
      const byEmail = JSON.parse(localStorage.getItem(SETUP_PROFILE_MAP_KEY) || '{}');
      const mapped = resolvedEmail ? byEmail?.[resolvedEmail] : null;
      const fallback = JSON.parse(localStorage.getItem(SETUP_PROFILE_KEY) || 'null');
      setProfile(mapped || fallback || null);
    } catch {
      setProfile(null);
    }
  }, []);

  const fullName = useMemo(() => {
    if (!profile) return '';
    return clean(`${profile?.firstName || ''} ${profile?.lastName || ''}`) || clean(profile?.displayAgentName || '');
  }, [profile]);

  const photo = clean(profile?.profilePhotoDataUrl || '') || '/kimora-profile.png';

  return (
    <main style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0', padding: 16 }}>
      <div style={{ maxWidth: 980, margin: '0 auto', border: '1px solid #1f2a44', borderRadius: 16, background: '#0b1220', overflow: 'hidden' }}>
        <div style={{ padding: 18, borderBottom: '1px solid #1f2a44', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0 }}>Personal Website Preview</h1>
            <small style={{ color: '#94a3b8' }}>{email || 'No email detected'}</small>
          </div>
          <a href="/linkleads/order-builder?showBuilder=1" style={{ color: '#93c5fd' }}>Back to Lead Setup</a>
        </div>

        <div style={{ padding: 18, display: 'grid', gap: 14, gridTemplateColumns: '220px 1fr' }}>
          <div style={{ border: '1px solid #334155', borderRadius: 12, background: '#020617', padding: 12, textAlign: 'center' }}>
            <img src={photo} alt="Agent profile" style={{ width: 150, height: 150, objectFit: 'cover', borderRadius: 999, border: '2px solid #dc2626' }} />
            <div style={{ marginTop: 10, fontWeight: 800 }}>{fullName || 'Agent Name'}</div>
            <small style={{ color: '#94a3b8' }}>{profile?.displayAgentTitle || profile?.title || 'Licensed Agent'}</small>
          </div>

          <div style={{ border: '1px solid #334155', borderRadius: 12, background: '#020617', padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Website Contact Block</h3>
            <p style={{ margin: '4px 0', color: '#cbd5e1' }}><strong>Name:</strong> {fullName || '-'}</p>
            <p style={{ margin: '4px 0', color: '#cbd5e1' }}><strong>NPN:</strong> {profile?.displayAgentNpn || profile?.npnId || '-'}</p>
            <p style={{ margin: '4px 0', color: '#cbd5e1' }}><strong>Email:</strong> {profile?.displayAgentEmail || profile?.email || '-'}</p>
            <p style={{ margin: '4px 0', color: '#cbd5e1' }}><strong>Phone:</strong> {profile?.displayAgentPhone || profile?.phone || '-'}</p>
            <p style={{ margin: '4px 0', color: '#cbd5e1' }}><strong>Website:</strong> {profile?.displayAgentWebsite || profile?.agentWebsite || '-'}</p>
            <p style={{ margin: '4px 0', color: '#cbd5e1' }}><strong>Licensed States:</strong> {Array.isArray(profile?.licensedStates) && profile.licensedStates.length ? profile.licensedStates.join(', ') : '-'}</p>

            <div style={{ marginTop: 12, borderTop: '1px solid #1f2a44', paddingTop: 10 }}>
              <small style={{ color: '#94a3b8' }}>
                This preview is now wired to your Link Leads setup profile, including uploaded photo.
              </small>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
