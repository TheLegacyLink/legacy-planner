'use client';

import React, { useEffect, useState } from 'react';

const UNLOCK_KEY = 'peak_performance_playbook_unlocked';

const RocketIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);

const PlaybookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M5 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    <path d="m9 21-2-2 2-2" />
  </svg>
);

export default function GrowthHubPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(0);
  const [loadingGate, setLoadingGate] = useState(true);
  const requiredSteps = 8;

  const trackerStepOrder = [
    'backoffice_access',
    'pinnacle_contracting',
    'investalink_contracting',
    'contracting_tutorial_reviewed',
    'eo_uploaded',
    'product_training',
    'crm_setup',
    'script_cert',
    'youtube_review',
    'first_policy_submitted',
    'first_policy_placed'
  ];

  useEffect(() => {
    let cancelled = false;

    async function loadUnlockState() {
      setLoadingGate(true);
      try {
        let name = '';
        let email = '';

        try {
          const raw = window.localStorage.getItem('inner_hub_member_v1');
          const member = raw ? JSON.parse(raw) : null;
          name = String(member?.applicantName || member?.name || '').trim();
          email = String(member?.email || '').trim().toLowerCase();
        } catch {}

        if (!email) {
          try {
            const token = window.localStorage.getItem('licensed_backoffice_token') || '';
            if (token) {
              const meRes = await fetch('/api/licensed-backoffice/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store'
              });
              const me = await meRes.json().catch(() => ({}));
              if (meRes.ok && me?.ok && me?.profile) {
                name = String(me.profile?.name || name || '').trim();
                email = String(me.profile?.email || email || '').trim().toLowerCase();
              }
            }
          } catch {}
        }

        if (!name && !email) {
          const local = window.localStorage.getItem(UNLOCK_KEY) === '1';
          if (!cancelled) {
            setUnlocked(local);
            setCompletedSteps(local ? requiredSteps : 0);
          }
          return;
        }

        const stepLabels = Object.fromEntries(trackerStepOrder.map((k, i) => [k, `Step ${i + 1}`]));
        const qs = new URLSearchParams({
          viewerName: name,
          viewerEmail: email,
          viewerRole: 'agent',
          stepOrder: JSON.stringify(trackerStepOrder),
          stepLabels: JSON.stringify(stepLabels)
        });

        const res = await fetch(`/api/licensed-onboarding-tracker?${qs.toString()}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        const doneCount = Number(data?.myRow?.progress?.agentDoneSteps || 0);
        const canUnlock = doneCount >= requiredSteps;

        if (!cancelled) {
          setCompletedSteps(doneCount);
          setUnlocked(canUnlock);
          try {
            if (canUnlock) window.localStorage.setItem(UNLOCK_KEY, '1');
            else window.localStorage.removeItem(UNLOCK_KEY);
          } catch {}
        }
      } finally {
        if (!cancelled) setLoadingGate(false);
      }
    }

    loadUnlockState();
    return () => { cancelled = true; };
=======
  const [completedSteps, setCompletedSteps] = useState(0);
  const [loadingGate, setLoadingGate] = useState(true);
  const requiredSteps = 8;

  const trackerStepOrder = [
    'backoffice_access',
    'pinnacle_contracting',
    'investalink_contracting',
    'contracting_tutorial_reviewed',
    'eo_uploaded',
    'product_training',
    'crm_setup',
    'script_cert',
    'youtube_review',
    'first_policy_submitted',
    'first_policy_placed'
  ];

  useEffect(() => {
    let cancelled = false;

    async function loadUnlockState() {
      setLoadingGate(true);
      try {
        let name = '';
        let email = '';

        try {
          const raw = window.localStorage.getItem('inner_hub_member_v1');
          const member = raw ? JSON.parse(raw) : null;
          name = String(member?.applicantName || member?.name || '').trim();
          email = String(member?.email || '').trim().toLowerCase();
        } catch {}

        if (!email) {
          try {
            const token = window.localStorage.getItem('licensed_backoffice_token') || '';
            if (token) {
              const meRes = await fetch('/api/licensed-backoffice/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store'
              });
              const me = await meRes.json().catch(() => ({}));
              if (meRes.ok && me?.ok && me?.profile) {
                name = String(me.profile?.name || name || '').trim();
                email = String(me.profile?.email || email || '').trim().toLowerCase();
              }
            }
          } catch {}
        }

        if (!name && !email) {
          const local = window.localStorage.getItem(UNLOCK_KEY) === '1';
          if (!cancelled) {
            setUnlocked(local);
            setCompletedSteps(local ? requiredSteps : 0);
          }
          return;
        }

        const stepLabels = Object.fromEntries(trackerStepOrder.map((k, i) => [k, `Step ${i + 1}`]));
        const qs = new URLSearchParams({
          viewerName: name,
          viewerEmail: email,
          viewerRole: 'agent',
          stepOrder: JSON.stringify(trackerStepOrder),
          stepLabels: JSON.stringify(stepLabels)
        });

        const res = await fetch(`/api/licensed-onboarding-tracker?${qs.toString()}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        const doneCount = Number(data?.myRow?.progress?.agentDoneSteps || 0);
        const canUnlock = doneCount >= requiredSteps;

        if (!cancelled) {
          setCompletedSteps(doneCount);
          setUnlocked(canUnlock);
          try {
            if (canUnlock) window.localStorage.setItem(UNLOCK_KEY, '1');
            else window.localStorage.removeItem(UNLOCK_KEY);
          } catch {}
        }
      } finally {
        if (!cancelled) setLoadingGate(false);
      }
    }

    loadUnlockState();
    return () => { cancelled = true; };
  }, [];

  const openPlaybook = () => {
    try {
      if (window.top && window.top !== window) window.top.location.href = '/peak-performance-playbook';
      else window.location.href = '/peak-performance-playbook';
    } catch {
      window.location.href = '/peak-performance-playbook';
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #15213f 0%, #070b14 55%)', padding: '28px 16px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div style={{ border: '1px solid #2A3142', borderRadius: 16, background: 'linear-gradient(120deg,#1D428A,#006BB6)', padding: 20 }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <span style={{ color: '#C8A96B' }}><RocketIcon /></span>
            Growth Hub
          </h1>
          <p style={{ color: '#E2E8F0', fontSize: 15, margin: '8px 0 0' }}>
            Your central command for training, resources, and tools to expand your business.
          </p>
        </div>

        <div style={{ border: '1px solid #2A3142', borderRadius: 16, background: '#0F172A', overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #1f2937' }}>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 20 }}>Tools & Resources</h2>
            <p style={{ margin: '6px 0 0', color: '#94A3B8', fontSize: 13 }}>Explore key areas to level up your skills and build your pipeline.</p>
          </div>

          <div style={{ padding: 18 }}>
            <div role="button" tabIndex={0} onClick={openPlaybook} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPlaybook(); }} style={{ border: '1px solid #334155', borderRadius: 12, padding: 18, background: '#111827', display: 'grid', gap: 12, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 10, flexShrink: 0, background: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#93C5FD' }}>
                  <PlaybookIcon />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: '#F8FAFC', margin: '0 0 6px' }}>Peak Performance Playbook {unlocked ? '✅' : '🔒'}</h3>
                  <p style={{ fontSize: 14, color: '#CBD5E1', margin: 0, lineHeight: 1.55 }}>
                    Complete your interactive checklist to build discipline, track progress, and unlock your potential.
                  </p>
                  <p style={{ fontSize: 12, color: '#93C5FD', margin: '8px 0 0' }}>
                    Onboarding Unlock: {loadingGate ? 'Checking…' : `${completedSteps}/${requiredSteps}`}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openPlaybook(); }}
                  style={{
                    width: 'fit-content',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #C8A96B',
                    background: '#C8A96B',
                    color: '#0B1020',
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: 'pointer'
                  }}
                >
                  Open Peak Performance Playbook
                </button>
                <a href="/peak-performance-playbook" style={{ color: '#93C5FD', alignSelf: 'center' }}>Direct Link</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
