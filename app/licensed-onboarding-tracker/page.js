'use client';

import { useEffect, useState } from 'react';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function fmtDateTime(iso = '') {
  if (!clean(iso)) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() <= 0) return '—';
  return d.toLocaleString();
}

const CRM_SETUP_VIDEO_URL = 'https://innercirclelink.com/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf';
const YOUTUBE_REVIEW_URL = 'https://youtu.be/SVvU9SvCH9o?si=nzgjgEa7DfGQlxmX';
const PINNACLE_CONTRACTING_URL = 'https://surelc.surancebay.com/producer/?gaId=190';
const INVESTALINK_CONTRACTING_URL = 'https://surelc.surancebay.com/sbweb/login.jsp?branch=InvestaLink&branchEditable=off&branchRequired=on&branchVisible=on&gaId=168&gaName=AIP%20Marketing%20Alliance';
const CONTRACTING_VIDEO_URL = 'https://www.loom.com/share/79354f8de2334697ba53cc5b0ff80c86?sid=b88fafc3-96a0-4d6a-9918-f396f0047603';
const EO_PURCHASE_URL = 'https://thelegacylink.com/e-and-o-insurance';

const STEP_DEFS_LICENSED = [
  { key: 'backoffice_access', label: 'Step 1 — Back Office Access + Welcome Instructions', why: 'Open your welcome email, save your links, and confirm access to start onboarding.' },
  { key: 'pinnacle_contracting', label: 'Step 2A — InVestaLink Partner Contracting Submitted', why: 'Complete the contracting package (Foresters, Transamerica, American National, Mutual of Omaha).', resourceUrl: PINNACLE_CONTRACTING_URL },
  { key: 'investalink_contracting', label: 'Step 2B — InVestaLink Contracting Submitted', why: 'Complete the InVestaLink contracting packet (F&G + National Life Group).', resourceUrl: INVESTALINK_CONTRACTING_URL },
  { key: 'contracting_tutorial_reviewed', label: 'Step 2C — Contracting Tutorial Reviewed', why: 'Use the contracting video guide to complete the process correctly.', resourceUrl: CONTRACTING_VIDEO_URL },
  { key: 'eo_uploaded', label: 'Step 3 — E&O Activated', why: 'Required protection before production (activate and confirm E&O).', resourceUrl: EO_PURCHASE_URL },
  { key: 'product_training', label: 'Step 4 — Core Product Training Completed', why: 'Complete core carrier product training sequence.' },
  { key: 'crm_setup', label: 'Step 5 — CRM + Calendar + Dialer Setup', why: 'Complete CRM workflow setup using the onboarding guide/video.', resourceUrl: CRM_SETUP_VIDEO_URL },
  { key: 'script_cert', label: 'Step 6 — Script Roleplay Certification', why: 'Complete roleplay certification with trainer/uplink.' },
  { key: 'youtube_review', label: 'Step 7 — Required YouTube Task', why: 'Watch the required video and leave a comment.', resourceUrl: YOUTUBE_REVIEW_URL },
  { key: 'first_policy_submitted', label: 'Step 8A — First Policy Submitted', why: 'Milestone from application submission.' },
  { key: 'first_policy_placed', label: 'Step 8B — First Policy Placed', why: 'Milestone when first policy is approved.' },
  // --- 30-Day Sprint Steps ---
  { key: 'sprint_contracting_approved', label: 'Sprint: Contracting Approved (Both Carriers)', why: 'Carrier approval confirmed for Pinnacle + InvestaLink packets. Your uplink marks this once confirmed.', sprintOnly: true },
  { key: 'sprint_watched_video', label: 'Sprint: Watch "Whatever It Takes" + Leave Comment', why: 'Watch the required video and leave a comment.', sprintOnly: true },
  { key: 'sprint_referred_one', label: 'Sprint: Refer 1 Friend or Family Member', why: 'Share the opportunity with at least one person in your network.', sprintOnly: true },
  { key: 'sprint_meeting_1', label: 'Sprint: Team Meeting #1', why: 'Attend a team or training meeting.', sprintOnly: true },
  { key: 'sprint_meeting_2', label: 'Sprint: Team Meeting #2', why: 'Attend a team or training meeting.', sprintOnly: true },
  { key: 'sprint_meeting_3', label: 'Sprint: Team Meeting #3', why: 'Attend a team or training meeting.', sprintOnly: true },
  { key: 'sprint_meeting_4', label: 'Sprint: Team Meeting #4 — Sprint Complete!', why: 'All 4 meetings attended. Sprint requirement met.', sprintOnly: true },
];

const STEP_DEFS_INNER_CIRCLE = [
  { key: 'product_training', label: 'Core Product Training Completed', why: 'Build confidence and product accuracy.' },
  { key: 'crm_setup', label: 'CRM + Calendar + Dialer Setup', why: 'Use the setup guide/video to complete your CRM workflow.', resourceUrl: CRM_SETUP_VIDEO_URL },
  { key: 'script_cert', label: 'Script Roleplay Certification', why: 'Improves close rate and consistency.' },
  { key: 'youtube_review', label: 'YouTube Training + Comment Completed', why: 'Watch the required video and leave a comment.', resourceUrl: YOUTUBE_REVIEW_URL },
  { key: 'first_sponsorship_submitted', label: 'First Sponsorship App Submitted', why: 'Auto-completed from sponsorship submissions.', automated: true },
  { key: 'first_policy_submitted', label: 'First Policy Submitted', why: 'Auto-completed from policy submissions.', automated: true },
  { key: 'first_policy_placed', label: 'First Policy Placed', why: 'Auto-completed when first policy is approved.', automated: true }
];

function colorBadge(color = '') {
  if (color === 'red') return { bg: '#7f1d1d', border: '#dc2626', text: '#fecaca', label: 'Stalled' };
  if (color === 'yellow') return { bg: '#713f12', border: '#d97706', text: '#fde68a', label: 'At Risk' };
  return { bg: '#14532d', border: '#16a34a', text: '#bbf7d0', label: 'On Track' };
}

export default function LicensedOnboardingTrackerPage() {
  const [viewer, setViewer] = useState({ name: '', email: '', role: 'agent' });
  const [track, setTrack] = useState('licensed');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingStep, setSavingStep] = useState('');
  const [msg, setMsg] = useState('');
  const [nudgeState, setNudgeState] = useState({ running: false, sent: null, detail: '' });

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const fromParent = {
      name: clean(sp.get('viewerName') || ''),
      email: clean(sp.get('viewerEmail') || '').toLowerCase(),
      role: clean(sp.get('viewerRole') || 'agent') || 'agent'
    };
    const rawTrack = clean(sp.get('track') || 'licensed').toLowerCase();
    setTrack(rawTrack === 'inner-circle' ? 'inner-circle' : 'licensed');
    setViewer(fromParent);
  }, []);

  const STEP_DEFS = track === 'inner-circle' ? STEP_DEFS_INNER_CIRCLE : STEP_DEFS_LICENSED;
  const STEP_ORDER = STEP_DEFS.filter((s) => !s.sprintOnly).map((s) => s.key);
  const SPRINT_STEP_DEFS = STEP_DEFS.filter((s) => s.sprintOnly);
  const STEP_LABELS = STEP_DEFS.reduce((acc, s) => ({ ...acc, [s.key]: s.label }), {});
  const AUTO_STEP_KEYS = STEP_DEFS.filter((s) => s.automated).map((s) => s.key);

  async function loadTracker() {
    if (!viewer.name && !viewer.email) return;
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        viewerName: viewer.name,
        viewerEmail: viewer.email,
        viewerRole: viewer.role,
        stepOrder: JSON.stringify(STEP_ORDER),
        stepLabels: JSON.stringify(STEP_LABELS),
        autoStepKeys: JSON.stringify(AUTO_STEP_KEYS)
      });
      const res = await fetch(`/api/licensed-onboarding-tracker?${qs.toString()}`, { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) throw new Error(body?.error || 'load_failed');
      setData(body);
    } catch (e) {
      setError(`Could not load onboarding tracker: ${e?.message || 'unknown_error'}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!viewer.name && !viewer.email) return;
    loadTracker();
  }, [viewer.name, viewer.email, viewer.role, track]);

  async function updateStep(action, stepKey, targetRow) {
    if (!targetRow?.agentName || !stepKey) return;
    setSavingStep(`${targetRow.agentKey}:${stepKey}:${action}`);
    setMsg('');
    try {
      const res = await fetch('/api/licensed-onboarding-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'step_update',
          actorName: viewer.name || targetRow.agentName,
          actorEmail: viewer.email || targetRow.agentEmail,
          actorRole: viewer.role || 'agent',
          agentName: targetRow.agentName,
          agentEmail: targetRow.agentEmail,
          agentKey: targetRow.agentKey,
          stepKey,
          action,
          note: '',
          stepOrder: STEP_ORDER,
          stepLabels: STEP_LABELS,
          autoStepKeys: AUTO_STEP_KEYS
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) throw new Error(body?.error || 'update_failed');
      const notified = Boolean(body?.noteNotification?.ok);
      setMsg(notified ? 'Saved. Note sent to uplink.' : 'Saved.');
      await loadTracker();
    } catch (e) {
      setMsg(`Update failed: ${e?.message || 'unknown_error'}`);
    } finally {
      setSavingStep('');
    }
  }

  async function runNudges() {
    setNudgeState({ running: true, sent: null, detail: '' });
    try {
      const res = await fetch('/api/licensed-onboarding-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'run_nudges',
          actorName: viewer.name,
          actorEmail: viewer.email,
          actorRole: viewer.role,
          minDays: 4,
          maxPerRun: 50,
          stepOrder: STEP_ORDER,
          stepLabels: STEP_LABELS,
          autoStepKeys: AUTO_STEP_KEYS
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) throw new Error(body?.error || 'run_nudges_failed');
      setNudgeState({ running: false, sent: Number(body?.sent || 0), detail: '' });
      await loadTracker();
    } catch (e) {
      setNudgeState({ running: false, sent: null, detail: e?.message || 'run_nudges_failed' });
    }
  }

  useEffect(() => {
    if (!data?.downlineRows?.length) return;
    if (normalize(viewer.role) !== 'admin') return;
    runNudges();
    // auto-run once on load for admin viewers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.viewer?.name]);

  const myRow = data?.myRow || null;
  const downlineRows = Array.isArray(data?.downlineRows) ? data.downlineRows : [];
  const metrics = data?.metrics || { totalDownline: 0, red: 0, yellow: 0, green: 0, completed: 0 };

  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #15213f 0%, #070b14 55%)', color: '#E5E7EB', padding: 16 }}>
      <section style={{ maxWidth: 1250, margin: '0 auto', display: 'grid', gap: 12 }}>
        <header style={{ border: '1px solid #334155', borderRadius: 16, background: 'linear-gradient(120deg, #0F172A 0%, #111C35 60%, #1D4ED8 160%)', padding: 16, boxShadow: '0 18px 40px rgba(2,6,23,.35)' }}>
          <h2 style={{ margin: 0, letterSpacing: '.02em' }}>Onboarding Tracker</h2>
          <p style={{ margin: '6px 0 0', color: '#9CA3AF' }}>
            {track === 'inner-circle' ? 'Inner Circle Flow' : 'Licensed Agent Flow'} • Monday Onboarding: <strong style={{ color: '#E2E8F0' }}>7:00 PM CST</strong>
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <span style={{ border: '1px solid #334155', borderRadius: 999, padding: '4px 10px', background: '#0B1220', color: '#CBD5E1', fontSize: 12 }}>
              Viewer: {viewer.name || viewer.email || 'Unknown'}
            </span>
            <span style={{ border: '1px solid #334155', borderRadius: 999, padding: '4px 10px', background: '#0B1220', color: '#CBD5E1', fontSize: 12 }}>
              Role: {viewer.role || 'agent'}
            </span>
            <button onClick={loadTracker} style={{ borderRadius: 10, border: '1px solid #334155', padding: '6px 10px', background: '#0B1220', color: '#E2E8F0' }}>
              Refresh
            </button>
            <button onClick={runNudges} disabled={nudgeState.running} style={{ borderRadius: 10, border: '1px solid #854d0e', padding: '6px 10px', background: '#78350f', color: '#fde68a', fontWeight: 700 }}>
              {nudgeState.running ? 'Checking Status…' : 'Refresh Stuck Status'}
            </button>
            {nudgeState.sent != null ? <span style={{ color: '#86EFAC', fontSize: 12 }}>Nudges sent: {nudgeState.sent}</span> : null}
            {nudgeState.detail ? <span style={{ color: '#FCA5A5', fontSize: 12 }}>{nudgeState.detail}</span> : null}
          </div>
        </header>

        {loading ? <div style={{ border: '1px solid #243046', borderRadius: 12, background: '#0F172A', padding: 12 }}>Loading tracker…</div> : null}
        {error ? <div style={{ border: '1px solid #7f1d1d', borderRadius: 12, background: '#1f0a0a', color: '#fecaca', padding: 12 }}>{error}</div> : null}
        {msg ? <div style={{ border: '1px solid #334155', borderRadius: 12, background: '#0B1220', color: '#cbd5e1', padding: 12 }}>{msg}</div> : null}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
          <div style={{ border: '1px solid #334155', borderRadius: 14, background: 'rgba(30,64,175,.22)', padding: 14 }}>
            <div style={{ color: '#93C5FD', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>Downlink Total</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{metrics.totalDownline || 0}</div>
          </div>
          <div style={{ border: '1px solid #334155', borderRadius: 14, background: 'rgba(22,163,74,.16)', padding: 14 }}>
            <div style={{ color: '#86EFAC', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>On Track</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{metrics.green || 0}</div>
          </div>
          <div style={{ border: '1px solid #334155', borderRadius: 14, background: 'rgba(217,119,6,.16)', padding: 14 }}>
            <div style={{ color: '#FDE68A', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>At Risk</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{metrics.yellow || 0}</div>
          </div>
          <div style={{ border: '1px solid #334155', borderRadius: 14, background: 'rgba(220,38,38,.16)', padding: 14 }}>
            <div style={{ color: '#FCA5A5', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>Stalled</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{metrics.red || 0}</div>
          </div>
        </section>

        {/* 30-Day Sprint Card */}
        {myRow ? (() => {
          const joinedMs = new Date(myRow?.joinedAt || 0).getTime();
          const deadlineMs = joinedMs > 0 ? joinedMs + 30 * 24 * 60 * 60 * 1000 : 0;
          const nowMs = Date.now();
          const daysElapsed = joinedMs > 0 ? Math.floor((nowMs - joinedMs) / (24 * 60 * 60 * 1000)) : 0;
          const daysLeft = deadlineMs > 0 ? Math.max(0, Math.ceil((deadlineMs - nowMs) / (24 * 60 * 60 * 1000))) : 30;
          const sprintSteps = myRow?.steps || {};
          const contractingDone = Boolean(sprintSteps?.sprint_contracting_approved || (sprintSteps?.investalink_contracting && sprintSteps?.pinnacle_contracting));
          const videoDone = Boolean(sprintSteps?.sprint_watched_video || sprintSteps?.youtube_review);
          const referralDone = Boolean(sprintSteps?.sprint_referred_one);
          const meetingsDone = [sprintSteps?.sprint_meeting_1, sprintSteps?.sprint_meeting_2, sprintSteps?.sprint_meeting_3, sprintSteps?.sprint_meeting_4].filter(Boolean).length;
          const sprintComplete = contractingDone && videoDone && referralDone && meetingsDone >= 4;
          const sprintExpired = deadlineMs > 0 && nowMs > deadlineMs && !sprintComplete;
          const barPct = Math.min(100, Math.round((daysElapsed / 30) * 100));
          const borderCol = sprintComplete ? '#16a34a' : sprintExpired ? '#dc2626' : daysLeft <= 7 ? '#f59e0b' : '#C8A96B';
          const bgGrad = sprintComplete
            ? 'linear-gradient(160deg,#052e16,#0a1a0a)'
            : sprintExpired ? 'linear-gradient(160deg,#1a0000,#0d0000)'
            : 'linear-gradient(160deg,#0f172a,#111c35)';

          const req = [
            { label: 'Contracting Approved', done: contractingDone, key: 'sprint_contracting_approved' },
            { label: 'Watch "Whatever It Takes" + Comment', done: videoDone, key: 'sprint_watched_video' },
            { label: 'Refer 1 Friend or Family Member', done: referralDone, key: 'sprint_referred_one' },
            { label: `Attend 4 Team Meetings (${meetingsDone}/4)`, done: meetingsDone >= 4, key: null },
          ];

          return (
            <section style={{ border: `2px solid ${borderCol}`, borderRadius: 16, background: bgGrad, padding: 16, boxShadow: '0 12px 26px rgba(2,6,23,.28)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0, color: sprintComplete ? '#86EFAC' : '#FCD34D' }}>
                    {sprintComplete ? '30-Day Sprint Complete!' : sprintExpired ? 'Sprint Window Closed' : '30-Day Sprint'}
                  </h3>
                  <p style={{ margin: '4px 0 0', color: '#94A3B8', fontSize: 13 }}>
                    {sprintComplete ? 'All requirements met. $250 bonus queued for processing.' : sprintExpired ? 'The 30-day window passed. Keep executing.' : `Complete all 4 requirements within your first 30 days — earn $250.`}
                  </p>
                </div>
                <div style={{ border: `1px solid ${borderCol}44`, borderRadius: 12, padding: '10px 16px', textAlign: 'center', background: 'rgba(0,0,0,0.3)', minWidth: 80 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: sprintComplete ? '#86EFAC' : daysLeft <= 5 ? '#FCA5A5' : '#FCD34D' }}>
                    {sprintComplete ? 'Done' : daysLeft}
                  </div>
                  {!sprintComplete && <div style={{ color: '#9CA3AF', fontSize: 11 }}>days left</div>}
                </div>
              </div>

              {!sprintComplete && !sprintExpired && (
                <div style={{ marginBottom: 10, height: 8, borderRadius: 999, background: '#1f2937', overflow: 'hidden' }}>
                  <div style={{ width: `${barPct}%`, height: '100%', background: barPct >= 80 ? 'linear-gradient(90deg,#ef4444,#dc2626)' : 'linear-gradient(90deg,#f59e0b,#C8A96B)' }} />
                </div>
              )}

              <div style={{ display: 'grid', gap: 8 }}>
                {req.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: r.done ? 'rgba(22,163,74,.12)' : 'rgba(15,23,42,.6)', border: `1px solid ${r.done ? '#166534' : '#334155'}` }}>
                    <span style={{ fontSize: 16 }}>{r.done ? '✅' : '○'}</span>
                    <span style={{ color: r.done ? '#86EFAC' : '#CBD5E1', fontWeight: r.done ? 700 : 400 }}>{r.label}</span>
                    {r.key && !r.done && (
                      <button
                        onClick={() => updateStep('agent_mark_done', r.key, myRow)}
                        disabled={Boolean(savingStep)}
                        style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 999, border: '1px solid #334155', background: '#0B1220', color: '#CBD5E1', fontSize: 12, cursor: 'pointer' }}
                      >
                        Mark Done
                      </button>
                    )}
                    {!r.key ? (
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        {[1,2,3,4].map((n) => {
                          const mk = `sprint_meeting_${n}`;
                          const mDone = Boolean(sprintSteps?.[mk]);
                          return (
                            <button key={n} onClick={() => !mDone && updateStep('agent_mark_done', mk, myRow)} disabled={mDone || Boolean(savingStep)}
                              style={{ width: 28, height: 28, borderRadius: 999, border: `1px solid ${mDone ? '#166534' : '#334155'}`, background: mDone ? '#166534' : '#0B1220', color: mDone ? '#86EFAC' : '#9CA3AF', fontSize: 11, cursor: mDone ? 'default' : 'pointer', fontWeight: 700 }}>
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          );
        })() : null}

        {myRow ? (
          <section style={{ border: '1px solid #334155', borderRadius: 16, background: 'rgba(15,23,42,.86)', padding: 14, boxShadow: '0 12px 26px rgba(2,6,23,.28)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>My SOP Progress</h3>
              <div style={{ color: '#9CA3AF', fontSize: 13 }}>
                Completed: <strong style={{ color: '#E2E8F0' }}>{myRow?.progress?.agentDoneSteps || 0}/{myRow?.progress?.totalSteps || STEP_ORDER.length}</strong>
              </div>
            </div>

            <div style={{ marginTop: 10, height: 10, borderRadius: 999, background: '#1f2937', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(2, Number(myRow?.progress?.progressPct || 0))}%`, height: '100%', background: 'linear-gradient(90deg,#2563EB,#22C55E)' }} />
            </div>

            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {STEP_DEFS.map((step) => {
                const s = myRow?.steps?.[step.key] || {};
                const busyMark = savingStep === `${myRow.agentKey}:${step.key}:agent_mark_done`;
                const automated = Boolean(step?.automated);
                const isDone = Boolean(s?.agentDone || s?.verified);

                return (
                  <article key={step.key} style={{ border: '1px solid #334155', borderRadius: 12, background: 'linear-gradient(180deg,#0B1220 0%,#0a1326 100%)', padding: 12, boxShadow: '0 8px 20px rgba(2,6,23,.22)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div>
                        <strong>{step.label}</strong>
                        <div style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>{step.why}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ border: '1px solid #334155', borderRadius: 999, padding: '2px 8px', fontSize: 11, color: isDone ? '#86EFAC' : '#CBD5E1', background: isDone ? '#052e16' : '#111827' }}>
                          {isDone ? 'Completed' : 'Not Completed'}
                        </span>
                        {automated ? <span style={{ border: '1px solid #1d4ed8', borderRadius: 999, padding: '2px 8px', fontSize: 11, color: '#bfdbfe', background: '#0c1e4a' }}>Automated</span> : null}
                        {step?.resourceUrl ? (
                          <a href={step.resourceUrl} target="_blank" rel="noreferrer" style={{ border: '1px solid #334155', borderRadius: 999, padding: '2px 8px', fontSize: 11, color: '#cbd5e1', textDecoration: 'none' }}>
                            {step.key === 'eo_uploaded' ? 'Purchase E&O Insurance' : 'Open Resource'}
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: automated ? '1fr' : (step?.resourceUrl ? 'auto auto' : 'auto'), gap: 8, marginTop: 10, alignItems: 'center', justifyContent: 'start' }}>
                      {!automated ? (
                        <>
                          {step?.resourceUrl ? (
                            <a href={step.resourceUrl} target="_blank" rel="noreferrer" style={{ minWidth: 104, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', borderRadius: 10, border: '1px solid #334155', background: '#0B1220', color: '#E2E8F0', textDecoration: 'none', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {step.key === 'eo_uploaded' ? 'Purchase E&O Insurance' : 'Open Link'}
                            </a>
                          ) : null}
                          <button onClick={() => updateStep('agent_mark_done', step.key, myRow)} disabled={busyMark || isDone} style={{ minWidth: 104, height: 36, padding: '0 12px', borderRadius: 10, border: 0, background: (busyMark || isDone) ? '#166534' : '#16a34a', color: '#fff', fontWeight: 700, opacity: (busyMark || isDone) ? 0.75 : 1, cursor: (busyMark || isDone) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                            {busyMark ? 'Saving…' : isDone ? 'Completed' : 'Mark Done'}
                          </button>
                        </>
                      ) : null}
                    </div>

                    <div style={{ marginTop: 6, color: '#94A3B8', fontSize: 12 }}>
                      Completed at: {fmtDateTime(s?.agentDoneAt || s?.verifiedAt)}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <section style={{ border: '1px solid #334155', borderRadius: 16, background: 'rgba(15,23,42,.86)', padding: 14, boxShadow: '0 12px 26px rgba(2,6,23,.28)' }}>
            <h3 style={{ margin: 0 }}>My SOP Progress</h3>
            <p style={{ marginTop: 8, color: '#94A3B8' }}>
              Your tracking appears after your application is submitted.
            </p>
          </section>
        )}

        <section style={{ border: '1px solid #334155', borderRadius: 16, background: 'rgba(15,23,42,.86)', padding: 14, boxShadow: '0 12px 26px rgba(2,6,23,.28)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Downlink Tracker</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ border: '1px solid #14532d', background: '#052e16', color: '#86efac', borderRadius: 999, padding: '2px 9px', fontSize: 12 }}>Green: {metrics.green}</span>
              <span style={{ border: '1px solid #854d0e', background: '#713f12', color: '#fde68a', borderRadius: 999, padding: '2px 9px', fontSize: 12 }}>Yellow: {metrics.yellow}</span>
              <span style={{ border: '1px solid #7f1d1d', background: '#450a0a', color: '#fecaca', borderRadius: 999, padding: '2px 9px', fontSize: 12 }}>Red: {metrics.red}</span>
              <span style={{ border: '1px solid #1e3a8a', background: '#0c1e4a', color: '#bfdbfe', borderRadius: 999, padding: '2px 9px', fontSize: 12 }}>Completed: {metrics.completed}</span>
            </div>
          </div>

          {!downlineRows.length ? (
            <p style={{ color: '#9CA3AF', marginTop: 10 }}>No downlink onboarding records found yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10, marginTop: 12 }}>
              {downlineRows.map((row) => {
                const badge = colorBadge(row?.progress?.color || 'green');
                return (
                  <article key={row.agentKey} style={{ border: `1px solid ${badge.border}`, borderRadius: 12, background: 'linear-gradient(180deg,#0B1220 0%,#0a1326 100%)', padding: 12, boxShadow: '0 8px 20px rgba(2,6,23,.22)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                      <div>
                        <strong>{row.agentName}</strong>
                        <div style={{ color: '#94A3B8', fontSize: 12 }}>{row.agentEmail || 'No email on file'}</div>
                        <div style={{ color: '#94A3B8', fontSize: 12 }}>Sponsor: {row.sponsorName || '—'}</div>
                      </div>
                      <span style={{ border: `1px solid ${badge.border}`, background: badge.bg, color: badge.text, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{badge.label}</span>
                    </div>

                    <div style={{ marginTop: 8, color: '#CBD5E1', fontSize: 13 }}>
                      Completed: <strong>{row?.progress?.agentDoneSteps || 0}/{row?.progress?.totalSteps || STEP_ORDER.length}</strong> ({row?.progress?.progressPct || 0}%)
                    </div>
                    <div style={{ marginTop: 4, color: '#94A3B8', fontSize: 12 }}>
                      Current step: {STEP_LABELS[row?.progress?.currentStepKey] || row?.progress?.currentStepKey || '—'}
                    </div>
                    <div style={{ marginTop: 4, color: '#94A3B8', fontSize: 12 }}>
                      Days stuck: {row?.progress?.stuckDays ?? 0}
                    </div>
                    <div style={{ marginTop: 4, color: '#94A3B8', fontSize: 12 }}>
                      Last updated: {fmtDateTime(row.updatedAt)}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
