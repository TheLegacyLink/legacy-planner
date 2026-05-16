'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../../components/AppShell';

const GOLD   = '#C8A96B';
const PANEL  = '#0f172a';
const BORDER = '#1e2d42';
const DARK   = '#0B1020';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase(); }

const S = {
  card:  { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 24px', marginBottom: 20 },
  h3:    { margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#e2e8f0' },
  muted: { color: '#475569', fontSize: 13 },
  btn:   { padding: '9px 18px', borderRadius: 9, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  gold:  { background: GOLD, color: DARK },
  ghost: { background: 'transparent', border: `1px solid ${BORDER}`, color: '#94a3b8' },
  red:   { background: 'rgba(248,113,113,.1)', border: '1px solid #f8717133', color: '#f87171' },
  input: { width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#0B1020', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box', marginTop: 4 },
  pill:  { display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600 },
  green: { background: 'rgba(74,222,128,.12)', color: '#4ade80', border: '1px solid #4ade8044' },
  gray:  { background: 'rgba(100,116,139,.1)', color: '#64748b', border: '1px solid #334155' },
};

export default function TrainingAdminPage() {
  const [authToken, setAuthToken]   = useState('');
  const [authed, setAuthed]         = useState(false);
  const [pwInput, setPwInput]       = useState('');
  const [authErr, setAuthErr]       = useState('');
  const [content, setContent]       = useState(null);
  const [allProgress, setProgress]  = useState({});
  const [saving, setSaving]         = useState('');
  const [msg, setMsg]               = useState('');
  const [editingMod, setEditing]    = useState(null); // { id, patch }
  const [activeTab, setActiveTab]   = useState('modules'); // modules | progress

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('training_admin_token') : '';
    if (stored) { setAuthToken(stored); setAuthed(true); }
  }, []);

  useEffect(() => {
    if (!authed || !authToken) return;
    fetch('/api/agent-training?admin=1', { headers: { 'x-admin-key': authToken }, cache: 'no-store' })
      .then(r => r.json()).catch(() => ({}))
      .then(d => {
        if (d?.ok) { setContent(d.content); setProgress(d.allProgress || {}); }
      });
  }, [authed, authToken]);

  async function login() {
    setAuthErr('');
    const res = await fetch('/api/admin-skeleton-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'Kimora Link', password: pwInput })
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d?.ok) { setAuthErr('Incorrect password.'); return; }
    setAuthToken(pwInput);
    localStorage.setItem('training_admin_token', pwInput);
    setAuthed(true);
  }

  async function patchModule(moduleId, patch) {
    setSaving(moduleId);
    setMsg('');
    const res = await fetch('/api/agent-training', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': authToken },
      body: JSON.stringify({ action: 'update_module', moduleId, patch })
    });
    const d = await res.json().catch(() => ({}));
    if (d?.ok) { setContent(d.content); setMsg('Saved ✓'); setEditing(null); }
    else setMsg(`Save failed: ${d?.error || 'unknown'}`);
    setSaving('');
  }

  async function resetProgress(email, moduleId = null) {
    const confirmed = window.confirm(moduleId
      ? `Reset ${email}'s progress for this module?`
      : `Reset ALL progress for ${email}? This cannot be undone.`);
    if (!confirmed) return;
    const res = await fetch('/api/agent-training', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': authToken },
      body: JSON.stringify({ action: 'reset_progress', email, moduleId })
    });
    const d = await res.json().catch(() => ({}));
    if (d?.ok) {
      setMsg('Progress reset.');
      // Reload
      fetch('/api/agent-training?admin=1', { headers: { 'x-admin-key': authToken }, cache: 'no-store' })
        .then(r => r.json()).then(d2 => { if (d2?.ok) setProgress(d2.allProgress || {}); });
    }
  }

  async function resetContent() {
    if (!window.confirm('Reset all module content back to defaults? This overwrites any edits you have made.')) return;
    const res = await fetch('/api/agent-training', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': authToken },
      body: JSON.stringify({ action: 'reset_content' })
    });
    const d = await res.json().catch(() => ({}));
    if (d?.ok) { setMsg('Content reset to defaults.'); setContent(null);
      fetch('/api/agent-training?admin=1', { headers: { 'x-admin-key': authToken }, cache: 'no-store' })
        .then(r => r.json()).then(d2 => { if (d2?.ok) setContent(d2.content); });
    }
  }

  const allModules = (content?.stages || []).flatMap(s => s.modules || []);
  const progressEntries = Object.entries(allProgress);

  // ─── Auth gate ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <AppShell title="Training Admin">
        <div style={{ maxWidth: 380, margin: '60px auto' }}>
          <div style={S.card}>
            <h3 style={S.h3}>Admin Access</h3>
            <p style={{ ...S.muted, marginBottom: 16 }}>Enter your admin password to manage training content.</p>
            <input type="password" placeholder="Admin password" value={pwInput} onChange={e => setPwInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()} style={S.input} />
            {authErr && <p style={{ color: '#f87171', fontSize: 13, marginTop: 6 }}>{authErr}</p>}
            <button style={{ ...S.btn, ...S.gold, marginTop: 14 }} onClick={login}>Unlock</button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Training Admin">
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: '#f1f5f9', fontWeight: 800, fontSize: 20 }}>Training Portal — Admin</h2>
          <a href="/agent-training" target="_blank" rel="noreferrer" style={{ ...S.btn, ...S.ghost, fontSize: 12, textDecoration: 'none' }}>Preview Portal ↗</a>
          <button style={{ ...S.btn, ...S.red, marginLeft: 'auto' }} onClick={resetContent}>Reset Content to Defaults</button>
        </div>

        {msg && <p style={{ color: '#4ade80', marginBottom: 16, fontSize: 13 }}>{msg}</p>}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${BORDER}`, marginBottom: 24 }}>
          {[['modules', '📚 Modules'], ['progress', '📊 Agent Progress']].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{ padding: '9px 18px', background: 'none', border: 'none', borderBottom: activeTab === id ? `2px solid ${GOLD}` : '2px solid transparent', color: activeTab === id ? GOLD : '#64748b', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── MODULES TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'modules' && (
          <div>
            <p style={{ ...S.muted, marginBottom: 20 }}>Click Edit on any module to update the YouTube video URL, description, or key points. Quiz questions can be edited directly below.</p>
            {(content?.stages || []).map(stage => (
              <div key={stage.id} style={{ marginBottom: 32 }}>
                <h3 style={{ ...S.h3, color: GOLD, borderBottom: `1px solid ${BORDER}`, paddingBottom: 10, marginBottom: 16 }}>{stage.label}</h3>
                {(stage.modules || []).map(mod => {
                  const isEditing = editingMod?.id === mod.id;
                  return (
                    <div key={mod.id} style={S.card}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ ...S.h3, marginBottom: 2 }}>{mod.title}</h3>
                          <p style={{ ...S.muted, margin: 0 }}>{mod.description}</p>
                          <p style={{ ...S.muted, marginTop: 4, fontSize: 12 }}>
                            Video: {mod.videoUrl ? <span style={{ color: '#4ade80' }}>{mod.videoUrl.slice(0, 50)}</span> : <span style={{ color: '#64748b' }}>Not set</span>}
                            &nbsp;·&nbsp; {(mod.keyPoints || []).length} key points &nbsp;·&nbsp; {(mod.quiz?.questions || []).length} quiz questions
                          </p>
                        </div>
                        <button style={{ ...S.btn, ...(isEditing ? S.red : S.ghost), flexShrink: 0 }}
                          onClick={() => setEditing(isEditing ? null : { id: mod.id, patch: { videoUrl: mod.videoUrl || '', description: mod.description || '', keyPoints: [...(mod.keyPoints || [])] } })}>
                          {isEditing ? 'Cancel' : 'Edit'}
                        </button>
                      </div>

                      {isEditing && (
                        <div style={{ marginTop: 20, borderTop: `1px solid ${BORDER}`, paddingTop: 20 }}>
                          <label style={{ display: 'block', marginBottom: 14 }}>
                            <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>YouTube Video URL or ID</span>
                            <input style={S.input} placeholder="https://youtube.com/watch?v=... or video ID" value={editingMod.patch.videoUrl}
                              onChange={e => setEditing(m => ({ ...m, patch: { ...m.patch, videoUrl: e.target.value } }))} />
                          </label>
                          <label style={{ display: 'block', marginBottom: 14 }}>
                            <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>Module Description</span>
                            <input style={S.input} value={editingMod.patch.description}
                              onChange={e => setEditing(m => ({ ...m, patch: { ...m.patch, description: e.target.value } }))} />
                          </label>
                          <div style={{ marginBottom: 14 }}>
                            <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Key Points</span>
                            {editingMod.patch.keyPoints.map((kp, i) => (
                              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                <input style={{ ...S.input, marginTop: 0 }} value={kp}
                                  onChange={e => setEditing(m => { const kps = [...m.patch.keyPoints]; kps[i] = e.target.value; return { ...m, patch: { ...m.patch, keyPoints: kps } }; })} />
                                <button style={{ ...S.btn, ...S.red, padding: '6px 10px', flexShrink: 0 }}
                                  onClick={() => setEditing(m => { const kps = m.patch.keyPoints.filter((_, j) => j !== i); return { ...m, patch: { ...m.patch, keyPoints: kps } }; })}>✕</button>
                              </div>
                            ))}
                            <button style={{ ...S.btn, ...S.ghost, fontSize: 12, marginTop: 4 }}
                              onClick={() => setEditing(m => ({ ...m, patch: { ...m.patch, keyPoints: [...m.patch.keyPoints, ''] } }))}>+ Add Point</button>
                          </div>
                          <button style={{ ...S.btn, ...S.gold }} disabled={saving === mod.id}
                            onClick={() => patchModule(mod.id, editingMod.patch)}>
                            {saving === mod.id ? 'Saving…' : 'Save Module'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* ── PROGRESS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'progress' && (
          <div>
            {progressEntries.length === 0
              ? <p style={S.muted}>No agent progress recorded yet.</p>
              : progressEntries.map(([email, modMap]) => {
                  const completed = Object.values(modMap).filter(p => p.completed).length;
                  return (
                    <div key={email} style={S.card}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                        <div>
                          <h3 style={S.h3}>{email}</h3>
                          <p style={{ ...S.muted, margin: 0 }}>{completed}/{allModules.length} modules completed</p>
                        </div>
                        <button style={{ ...S.btn, ...S.red, fontSize: 12 }} onClick={() => resetProgress(email)}>Reset All</button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {allModules.map(mod => {
                          const prog = modMap[mod.id];
                          if (!prog) return <span key={mod.id} style={{ ...S.pill, ...S.gray }}>{mod.title.split(' ').slice(0,3).join(' ')}… (not started)</span>;
                          return (
                            <span key={mod.id} style={{ ...S.pill, ...(prog.completed ? S.green : S.gray), cursor: 'pointer' }}
                              title={`Score: ${prog.bestScore ?? '?'}/10 · Attempts: ${prog.attempts}`}
                              onClick={() => { if (window.confirm(`Reset ${email}'s progress for "${mod.title}"?`)) resetProgress(email, mod.id); }}>
                              {prog.completed ? '🏆' : '📖'} {mod.title.split(' ').slice(0, 3).join(' ')}… {prog.completed ? `(${prog.bestScore}/10)` : `(${prog.bestScore ?? 0}/10)`}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
            }
          </div>
        )}
      </div>
    </AppShell>
  );
}
