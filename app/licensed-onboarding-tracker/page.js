'use client';

import { useEffect, useMemo, useState } from 'react';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function fmtDateTime(iso = '') {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

const STEP_DEFS = [
  { key: 'profile_setup', label: 'Profile + Contact Setup', why: 'Ensures your profile is complete for routing and support.' },
  { key: 'carrier_contracting', label: 'Carrier Contracting Packet Submitted', why: 'Required before active writing with carriers.' },
  { key: 'eo_uploaded', label: 'E&O Uploaded', why: 'Compliance requirement before production.' },
  { key: 'aml_complete', label: 'AML Training Completed', why: 'Regulatory requirement to write business.' },
  { key: 'product_training', label: 'Core Product Training Completed', why: 'Build confidence and product accuracy.' },
  { key: 'crm_setup', label: 'CRM + Calendar + Dialer Setup', why: 'Enables speed-to-lead and daily execution.' },
  { key: 'script_cert', label: 'Script Roleplay Certification', why: 'Improves close rate and consistency.' },
  { key: 'first_appt', label: 'First Appointment Booked', why: 'Moves onboarding into production behavior.' },
  { key: 'first_app', label: 'First App Submitted', why: 'Confirms end-to-end execution.' },
  { key: 'first_policy', label: 'First Policy Placed', why: 'Marks complete onboarding readiness.' }
];

const STEP_ORDER = STEP_DEFS.map((s) => s.key);
const STEP_LABELS = STEP_DEFS.reduce((acc, s) => ({ ...acc, [s.key]: s.label }), {});

function colorBadge(color = '') {
  if (color === 'red') return { bg: '#7f1d1d', border: '#dc2626', text: '#fecaca', label: 'Stalled' };
  if (color === 'yellow') return { bg: '#713f12', border: '#d97706', text: '#fde68a', label: 'At Risk' };
  return { bg: '#14532d', border: '#16a34a', text: '#bbf7d0', label: 'On Track' };
}

export default function LicensedOnboardingTrackerPage() {
  const [viewer, setViewer] = useState({ name: '', email: '', role: 'agent' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingStep, setSavingStep] = useState('');
  const [noteByStep, setNoteByStep] = useState({});
  const [msg, setMsg] = useState('');
  const [nudgeState, setNudgeState] = useState({ running: false, sent: null, detail: '' });

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const fromParent = {
      name: clean(sp.get('viewerName') || ''),
      email: clean(sp.get('viewerEmail') || '').toLowerCase(),
      role: clean(sp.get('viewerRole') || 'agent') || 'agent'
    };
    setViewer(fromParent);
  }, []);

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
        stepLabels: JSON.stringify(STEP_LABELS)
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
  }, [viewer.name, viewer.email, viewer.role]);

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
          actorName: viewer.name,
          actorEmail: viewer.email,
          actorRole: viewer.role,
          agentName: targetRow.agentName,
          agentEmail: targetRow.agentEmail,
          stepKey,
          action,
          note: clean(noteByStep[`${targetRow.agentKey}:${stepKey}`] || ''),
          stepOrder: STEP_ORDER,
          stepLabels: STEP_LABELS
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) throw new Error(body?.error || 'update_failed');
      setMsg('Saved.');
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
          stepLabels: STEP_LABELS
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

  const canVerifyByRow = useMemo(() => {
    const m = new Map();
    for (const row of downlineRows) {
      m.set(row.agentKey, true);
    }
    return m;
  }, [downlineRows]);

  return (
    <main style={{ minHeight: '100vh', background: '#070b14', color: '#E5E7EB', padding: 16 }}>
      <section style={{ maxWidth: 1250, margin: '0 auto', display: 'grid', gap: 12 }}>
        <header style={{ border: '1px solid #243046', borderRadius: 14, background: '#0F172A', padding: 16 }}>
          <h2 style={{ margin: 0 }}>Onboarding Tracker</h2>
          <p style={{ margin: '6px 0 0', color: '#9CA3AF' }}>
            Licensed Agent Flow • Monday Onboarding: <strong style={{ color: '#E2E8F0' }}>7:00 PM CST</strong>
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
              {nudgeState.running ? 'Running Nudges…' : 'Run Stuck Nudges'}
            </button>
            {nudgeState.sent != null ? <span style={{ color: '#86EFAC', fontSize: 12 }}>Nudges sent: {nudgeState.sent}</span> : null}
            {nudgeState.detail ? <span style={{ color: '#FCA5A5', fontSize: 12 }}>{nudgeState.detail}</span> : null}
          </div>
        </header>

        {loading ? <div style={{ border: '1px solid #243046', borderRadius: 12, background: '#0F172A', padding: 12 }}>Loading tracker…</div> : null}
        {error ? <div style={{ border: '1px solid #7f1d1d', borderRadius: 12, background: '#1f0a0a', color: '#fecaca', padding: 12 }}>{error}</div> : null}
        {msg ? <div style={{ border: '1px solid #334155', borderRadius: 12, background: '#0B1220', color: '#cbd5e1', padding: 12 }}>{msg}</div> : null}

        {myRow ? (
          <section style={{ border: '1px solid #243046', borderRadius: 14, background: '#0F172A', padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>My SOP Progress</h3>
              <div style={{ color: '#9CA3AF', fontSize: 13 }}>
                Verified: <strong style={{ color: '#E2E8F0' }}>{myRow?.progress?.verifiedSteps || 0}/{myRow?.progress?.totalSteps || STEP_ORDER.length}</strong>
              </div>
            </div>

            <div style={{ marginTop: 10, height: 10, borderRadius: 999, background: '#1f2937', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(2, Number(myRow?.progress?.progressPct || 0))}%`, height: '100%', background: 'linear-gradient(90deg,#2563EB,#22C55E)' }} />
            </div>

            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {STEP_DEFS.map((step) => {
                const s = myRow?.steps?.[step.key] || {};
                const busyMark = savingStep === `${myRow.agentKey}:${step.key}:agent_mark_done`;
                const busyUndo = savingStep === `${myRow.agentKey}:${step.key}:agent_mark_not_done`;
                const busyVerify = savingStep === `${myRow.agentKey}:${step.key}:upline_verify`;
                const busyUnverify = savingStep === `${myRow.agentKey}:${step.key}:upline_unverify`;

                return (
                  <article key={step.key} style={{ border: '1px solid #334155', borderRadius: 12, background: '#0B1220', padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div>
                        <strong>{step.label}</strong>
                        <div style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>{step.why}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ border: '1px solid #334155', borderRadius: 999, padding: '2px 8px', fontSize: 11, color: s?.agentDone ? '#86EFAC' : '#CBD5E1', background: s?.agentDone ? '#052e16' : '#111827' }}>
                          {s?.agentDone ? 'Agent: Done' : 'Agent: Not Done'}
                        </span>
                        <span style={{ border: '1px solid #334155', borderRadius: 999, padding: '2px 8px', fontSize: 11, color: s?.verified ? '#93C5FD' : '#CBD5E1', background: s?.verified ? '#0c1e4a' : '#111827' }}>
                          {s?.verified ? `Verified by ${s?.verifiedBy || 'Upline'}` : 'Awaiting Upline Verify'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 8, marginTop: 10, alignItems: 'center' }}>
                      <input
                        placeholder="Optional note for upline"
                        value={noteByStep[`${myRow.agentKey}:${step.key}`] || ''}
                        onChange={(e) => setNoteByStep((m) => ({ ...m, [`${myRow.agentKey}:${step.key}`]: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }}
                      />
                      <button onClick={() => updateStep('agent_mark_done', step.key, myRow)} disabled={busyMark} style={{ padding: '8px 10px', borderRadius: 10, border: 0, background: '#16a34a', color: '#fff', fontWeight: 700 }}>
                        {busyMark ? 'Saving…' : 'Mark Done'}
                      </button>
                      <button onClick={() => updateStep('agent_mark_not_done', step.key, myRow)} disabled={busyUndo} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #334155', background: '#0B1220', color: '#E2E8F0' }}>
                        {busyUndo ? 'Saving…' : 'Undo'}
                      </button>
                      {canVerifyByRow.get(myRow.agentKey) || normalize(viewer.role) === 'admin' ? (
                        <>
                          <button onClick={() => updateStep('upline_verify', step.key, myRow)} disabled={busyVerify} style={{ padding: '8px 10px', borderRadius: 10, border: 0, background: '#1d4ed8', color: '#fff', fontWeight: 700 }}>
                            {busyVerify ? 'Saving…' : 'Verify'}
                          </button>
                          <button onClick={() => updateStep('upline_unverify', step.key, myRow)} disabled={busyUnverify} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #334155', background: '#0B1220', color: '#E2E8F0' }}>
                            {busyUnverify ? 'Saving…' : 'Unverify'}
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94A3B8' }}>Upline verification required</span>
                      )}
                    </div>

                    <div style={{ marginTop: 6, color: '#94A3B8', fontSize: 12 }}>
                      Agent done: {fmtDateTime(s?.agentDoneAt)} • Verified: {fmtDateTime(s?.verifiedAt)}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section style={{ border: '1px solid #243046', borderRadius: 14, background: '#0F172A', padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Downline Tracker</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ border: '1px solid #14532d', background: '#052e16', color: '#86efac', borderRadius: 999, padding: '2px 9px', fontSize: 12 }}>Green: {metrics.green}</span>
              <span style={{ border: '1px solid #854d0e', background: '#713f12', color: '#fde68a', borderRadius: 999, padding: '2px 9px', fontSize: 12 }}>Yellow: {metrics.yellow}</span>
              <span style={{ border: '1px solid #7f1d1d', background: '#450a0a', color: '#fecaca', borderRadius: 999, padding: '2px 9px', fontSize: 12 }}>Red: {metrics.red}</span>
              <span style={{ border: '1px solid #1e3a8a', background: '#0c1e4a', color: '#bfdbfe', borderRadius: 999, padding: '2px 9px', fontSize: 12 }}>Completed: {metrics.completed}</span>
            </div>
          </div>

          {!downlineRows.length ? (
            <p style={{ color: '#9CA3AF', marginTop: 10 }}>No downline onboarding records found yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10, marginTop: 12 }}>
              {downlineRows.map((row) => {
                const badge = colorBadge(row?.progress?.color || 'green');
                return (
                  <article key={row.agentKey} style={{ border: `1px solid ${badge.border}`, borderRadius: 12, background: '#0B1220', padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                      <div>
                        <strong>{row.agentName}</strong>
                        <div style={{ color: '#94A3B8', fontSize: 12 }}>{row.agentEmail || 'No email on file'}</div>
                        <div style={{ color: '#94A3B8', fontSize: 12 }}>Sponsor: {row.sponsorName || '—'}</div>
                      </div>
                      <span style={{ border: `1px solid ${badge.border}`, background: badge.bg, color: badge.text, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{badge.label}</span>
                    </div>

                    <div style={{ marginTop: 8, color: '#CBD5E1', fontSize: 13 }}>
                      Verified: <strong>{row?.progress?.verifiedSteps || 0}/{row?.progress?.totalSteps || STEP_ORDER.length}</strong> ({row?.progress?.progressPct || 0}%)
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
