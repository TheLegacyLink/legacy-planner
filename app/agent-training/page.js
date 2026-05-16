'use client';

import { useEffect, useMemo, useState } from 'react';

const GOLD   = '#C8A96B';
const DARK   = '#0B1020';
const PANEL  = '#0f172a';
const BORDER = '#1e2d42';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase(); }

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = {
  page:    { minHeight: '100vh', background: DARK, color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', padding: '0 0 80px' },
  header:  { background: '#080e1c', borderBottom: `1px solid ${BORDER}`, padding: '18px 28px', display: 'flex', alignItems: 'center', gap: 16 },
  logo:    { color: GOLD, fontWeight: 900, fontSize: 20, letterSpacing: '.5px' },
  sub:     { color: '#475569', fontSize: 13, marginLeft: 'auto' },
  body:    { maxWidth: 900, margin: '0 auto', padding: '32px 20px' },
  card:    { background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '24px 28px', marginBottom: 24 },
  h2:      { margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#f1f5f9' },
  h3:      { margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#e2e8f0' },
  muted:   { color: '#475569', fontSize: 13 },
  gold:    { color: GOLD },
  btn:     { padding: '11px 22px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  btnGold: { background: GOLD, color: DARK },
  btnGhost:{ background: 'transparent', border: `1px solid ${BORDER}`, color: '#94a3b8' },
  pill:    { display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 },
  green:   { background: 'rgba(74,222,128,.12)', color: '#4ade80', border: '1px solid #4ade8044' },
  amber:   { background: 'rgba(251,191,36,.12)', color: '#fbbf24', border: '1px solid #fbbf2444' },
  red:     { background: 'rgba(248,113,113,.12)', color: '#f87171', border: '1px solid #f8717144' },
  gray:    { background: 'rgba(100,116,139,.10)', color: '#64748b', border: '1px solid #334155' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function ProgressBar({ value = 0, max = 1 }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ background: '#1e2d42', borderRadius: 999, height: 8, overflow: 'hidden', margin: '8px 0' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: GOLD, borderRadius: 999, transition: 'width .4s' }} />
    </div>
  );
}

function Badge({ title }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 999, background: 'rgba(200,169,107,.15)', border: `1px solid ${GOLD}55`, color: GOLD, fontSize: 12, fontWeight: 700 }}>
      🏆 {title}
    </span>
  );
}

// ─── Quiz Component ───────────────────────────────────────────────────────────
function Quiz({ module, email, onPass }) {
  const [answers, setAnswers]       = useState({});
  const [result, setResult]         = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [shuffled, setShuffled]     = useState([]);

  useEffect(() => {
    // Shuffle question order on each mount (new attempt)
    const qs = [...(module.quiz?.questions || [])];
    for (let i = qs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [qs[i], qs[j]] = [qs[j], qs[i]];
    }
    setShuffled(qs);
    setAnswers({});
    setResult(null);
  }, [module.id]);

  const allAnswered = shuffled.length > 0 && shuffled.every(q => answers[q.id] !== undefined);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/agent-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_quiz', email, moduleId: module.id, answers })
      });
      const data = await res.json().catch(() => ({}));
      setResult(data);
      if (data.passed) onPass(data);
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    const qs = [...shuffled];
    for (let i = qs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [qs[i], qs[j]] = [qs[j], qs[i]];
    }
    setShuffled(qs);
    setAnswers({});
    setResult(null);
  }

  if (result) {
    const pct = Math.round((result.score / result.total) * 100);
    return (
      <div style={{ ...S.card, background: result.passed ? 'rgba(74,222,128,.05)' : 'rgba(248,113,113,.05)', border: `1px solid ${result.passed ? '#4ade8044' : '#f8717144'}` }}>
        <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>{result.passed ? '🏆' : '📚'}</div>
        <h3 style={{ ...S.h3, textAlign: 'center', fontSize: 22, color: result.passed ? '#4ade80' : '#f87171' }}>
          {result.passed ? 'You Passed!' : 'Not Quite — Try Again'}
        </h3>
        <p style={{ textAlign: 'center', color: '#94a3b8', margin: '4px 0 18px' }}>
          Score: <strong style={{ color: '#f1f5f9' }}>{result.score}/{result.total}</strong> &nbsp;·&nbsp; {pct}% &nbsp;·&nbsp; Need 80% to pass
        </p>

        {result.missed?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ ...S.muted, marginBottom: 10, fontWeight: 700, color: '#94a3b8' }}>Questions you missed:</p>
            {result.missed.map((m, i) => (
              <div key={m.id} style={{ background: 'rgba(248,113,113,.08)', border: '1px solid #f8717122', borderRadius: 10, padding: '12px 16px', marginBottom: 8 }}>
                <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>{i + 1}. {m.text}</p>
                <p style={{ margin: 0, fontSize: 13, color: '#4ade80' }}>✓ Correct answer: <strong>{module.quiz.questions.find(q => q.id === m.id)?.options?.[m.correctIndex] || '—'}</strong></p>
                {m.yourAnswer >= 0 && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#f87171' }}>✗ Your answer: <strong>{module.quiz.questions.find(q => q.id === m.id)?.options?.[m.yourAnswer] || '—'}</strong></p>}
              </div>
            ))}
          </div>
        )}

        {result.passed
          ? <div style={{ textAlign: 'center' }}><Badge title={`${module.title} Complete`} /></div>
          : <div style={{ textAlign: 'center' }}>
              <button style={{ ...S.btn, ...S.btnGold }} onClick={retry}>Retake Quiz</button>
            </div>
        }
      </div>
    );
  }

  return (
    <div>
      <p style={{ ...S.muted, marginBottom: 20 }}>Answer all {shuffled.length} questions. You need <strong style={{ color: GOLD }}>8 or more correct (80%)</strong> to pass. Questions shuffle each attempt.</p>
      {shuffled.map((q, idx) => (
        <div key={q.id} style={{ ...S.card, padding: '18px 20px', marginBottom: 12 }}>
          <p style={{ margin: '0 0 12px', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.5 }}>
            <span style={{ color: GOLD, marginRight: 8 }}>{idx + 1}.</span>{q.text}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(q.options || []).map((opt, i) => {
              const selected = answers[q.id] === i;
              return (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `1px solid ${selected ? GOLD : BORDER}`, background: selected ? 'rgba(200,169,107,.1)' : 'transparent', cursor: 'pointer', color: selected ? GOLD : '#94a3b8', fontSize: 14, transition: 'all .15s' }}>
                  <input type="radio" name={`q-${q.id}`} value={i} checked={selected} onChange={() => setAnswers(a => ({ ...a, [q.id]: i }))} style={{ accentColor: GOLD }} />
                  {opt}
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <button style={{ ...S.btn, ...S.btnGold, opacity: allAnswered ? 1 : .5 }} disabled={!allAnswered || submitting} onClick={submit}>
          {submitting ? 'Submitting…' : 'Submit Quiz'}
        </button>
        {!allAnswered && <p style={{ ...S.muted, marginTop: 8 }}>Answer all questions to submit.</p>}
      </div>
    </div>
  );
}

// ─── Module Detail ────────────────────────────────────────────────────────────
function ModuleDetail({ module, email, onBack, onComplete }) {
  const [tab, setTab] = useState('overview');

  function handlePass(result) {
    onComplete(module.id, result);
    setTab('overview');
  }

  const tabs = [
    { id: 'overview', label: '📋 Overview' },
    { id: 'video',    label: '📺 Video' },
    { id: 'study',    label: '📝 Study Guide' },
    { id: 'quiz',     label: '✅ Quiz' },
  ];

  return (
    <div>
      <button style={{ ...S.btn, ...S.btnGhost, marginBottom: 20, fontSize: 13 }} onClick={onBack}>← Back to Modules</button>

      <div style={{ ...S.card }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <h2 style={S.h2}>{module.title}</h2>
            <p style={{ ...S.muted, margin: 0 }}>{module.description}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {module.progress?.completed && <span style={{ ...S.pill, ...S.green }}>✓ Complete</span>}
            {module.progress?.badgeEarned && <Badge title={module.title} />}
            {!module.progress?.completed && module.unlocked && <span style={{ ...S.pill, ...S.amber }}>In Progress</span>}
          </div>
        </div>

        {/* Tab nav */}
        <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${BORDER}`, marginBottom: 24, overflowX: 'auto' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: tab === t.id ? `2px solid ${GOLD}` : '2px solid transparent', color: tab === t.id ? GOLD : '#64748b', fontWeight: 600, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div>
            <p style={{ color: '#94a3b8', lineHeight: 1.7 }}>Work through each section of this module to build your knowledge. When you are ready, take the quiz — you need to score <strong style={{ color: GOLD }}>80% or higher (8 out of 10)</strong> to complete this module and earn your badge.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 20 }}>
              {[
                { icon: '📺', label: 'Video Lesson', action: () => setTab('video') },
                { icon: '📝', label: 'Study Guide', action: () => setTab('study') },
                { icon: '✅', label: module.progress?.completed ? 'Retake Quiz' : 'Take Quiz', action: () => setTab('quiz') },
              ].map(item => (
                <button key={item.label} onClick={item.action} style={{ ...S.card, padding: '18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: `1px solid ${BORDER}`, background: '#0B1020', transition: 'border-color .2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = GOLD}
                  onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}>
                  <span style={{ fontSize: 28 }}>{item.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0' }}>{item.label}</span>
                </button>
              ))}
            </div>
            {module.progress?.attempts > 0 && (
              <p style={{ ...S.muted, marginTop: 16 }}>Best score: <strong style={{ color: '#f1f5f9' }}>{module.progress.bestScore}/10</strong> &nbsp;·&nbsp; Attempts: {module.progress.attempts}</p>
            )}
          </div>
        )}

        {tab === 'video' && (
          <div>
            {module.videoUrl ? (
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 12, overflow: 'hidden', background: '#000' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${module.videoUrl.includes('youtu.be') ? module.videoUrl.split('/').pop() : module.videoUrl.split('v=')[1]?.split('&')[0] || module.videoUrl}`}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                  allowFullScreen title={module.title}
                />
              </div>
            ) : (
              <div style={{ background: '#0B1020', border: `2px dashed ${BORDER}`, borderRadius: 12, padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
                <h3 style={{ ...S.h3, color: '#64748b' }}>Video Coming Soon</h3>
                <p style={{ ...S.muted }}>The video lesson for this module will be added shortly. In the meantime, review the Study Guide to prepare for your quiz.</p>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={{ ...S.btn, ...S.btnGold }} onClick={() => setTab('study')}>Continue to Study Guide →</button>
            </div>
          </div>
        )}

        {tab === 'study' && (
          <div>
            <h3 style={{ ...S.h3, color: GOLD, marginBottom: 16 }}>Key Points — {module.title}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(module.keyPoints || []).map((point, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 18px', background: '#0B1020', border: `1px solid ${BORDER}`, borderRadius: 10, lineHeight: 1.6 }}>
                  <span style={{ color: GOLD, fontWeight: 900, fontSize: 16, minWidth: 24 }}>{i + 1}</span>
                  <span style={{ color: '#cbd5e1', fontSize: 14 }}>{point}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button style={{ ...S.btn, ...S.btnGold }} onClick={() => setTab('quiz')}>Ready to Take the Quiz →</button>
            </div>
          </div>
        )}

        {tab === 'quiz' && (
          <div>
            <Quiz module={module} email={email} onPass={handlePass} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AgentTrainingPage() {
  const [session, setSession]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [stages, setStages]           = useState([]);
  const [totalModules, setTotal]      = useState(0);
  const [completedCount, setDone]     = useState(0);
  const [activeModule, setActive]     = useState(null);
  const [error, setError]             = useState('');

  // Load session from licensed backoffice token
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('licensed_backoffice_token') : '';
    if (!token) { setLoading(false); return; }
    fetch('/api/licensed-backoffice/auth/me', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(r => r.json()).catch(() => ({}))
      .then(d => {
        if (d?.ok && d?.profile) setSession(d.profile);
        setLoading(false);
      });
  }, []);

  // Load training content + progress
  useEffect(() => {
    if (!session?.email) return;
    fetch(`/api/agent-training?email=${encodeURIComponent(normalize(session.email))}`, { cache: 'no-store' })
      .then(r => r.json()).catch(() => ({}))
      .then(d => {
        if (d?.ok) {
          setStages(d.stages || []);
          setTotal(d.totalModules || 0);
          setDone(d.completedCount || 0);
        } else {
          setError('Could not load training content.');
        }
      });
  }, [session?.email]);

  function handleModuleComplete(moduleId, result) {
    // Optimistically update progress in local state
    setStages(prev => prev.map(stage => ({
      ...stage,
      modules: stage.modules.map(m => m.id === moduleId
        ? { ...m, progress: { ...m.progress, completed: true, badgeEarned: true, bestScore: result.bestScore, attempts: result.attempts } }
        : m
      )
    })));
    setDone(prev => prev + 1);
  }

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.header}><span style={S.logo}>The Legacy Link</span><span style={{ ...S.sub }}>Agent Training Portal</span></div>
        <div style={{ ...S.body, textAlign: 'center', paddingTop: 80 }}><p style={{ color: '#475569' }}>Loading…</p></div>
      </div>
    );
  }

  // ─── Not logged in ────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div style={S.page}>
        <div style={S.header}><span style={S.logo}>The Legacy Link</span><span style={{ ...S.sub }}>Agent Training Portal</span></div>
        <div style={{ ...S.body, textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
          <h2 style={{ ...S.h2, textAlign: 'center' }}>Login Required</h2>
          <p style={{ color: '#64748b', maxWidth: 420, margin: '12px auto 28px' }}>You must be logged in through your Back Office to access the training portal.</p>
          <a href="/licensed-backoffice" style={{ ...S.btn, ...S.btnGold, textDecoration: 'none', display: 'inline-block' }}>Go to Back Office Login</a>
        </div>
      </div>
    );
  }

  // ─── Not licensed ─────────────────────────────────────────────────────────
  const isLicensed = normalize(session?.role || '') !== 'unlicensed';
  if (!isLicensed) {
    return (
      <div style={S.page}>
        <div style={S.header}>
          <span style={S.logo}>The Legacy Link</span>
          <span style={{ ...S.sub }}>Agent Training Portal</span>
          <span style={{ marginLeft: 'auto', ...S.muted }}>{session.name}</span>
        </div>
        <div style={{ ...S.body, textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📋</div>
          <h2 style={{ ...S.h2, textAlign: 'center' }}>Get Licensed First</h2>
          <p style={{ color: '#64748b', maxWidth: 480, margin: '12px auto 12px' }}>
            Agent training is reserved for licensed agents. Complete your licensing process before accessing this portal.
          </p>
          <p style={{ color: '#475569', maxWidth: 480, margin: '0 auto 28px', fontSize: 14 }}>
            If you believe this is an error, contact your upline or <a href="mailto:support@thelegacylink.com" style={{ color: GOLD }}>support@thelegacylink.com</a>.
          </p>
          <a href="/licensed-backoffice" style={{ ...S.btn, ...S.btnGold, textDecoration: 'none', display: 'inline-block' }}>Back to Back Office</a>
        </div>
      </div>
    );
  }

  // ─── Module detail view ───────────────────────────────────────────────────
  if (activeModule) {
    return (
      <div style={S.page}>
        <div style={S.header}>
          <span style={S.logo}>The Legacy Link</span>
          <span style={{ color: '#475569', fontSize: 13 }}>Agent Training Portal</span>
          <span style={{ marginLeft: 'auto', ...S.muted }}>{session.name}</span>
        </div>
        <div style={S.body}>
          <ModuleDetail
            module={activeModule}
            email={normalize(session.email)}
            onBack={() => setActive(null)}
            onComplete={(id, result) => {
              handleModuleComplete(id, result);
              setActive(m => m ? { ...m, progress: { ...m.progress, completed: true, badgeEarned: true, bestScore: result.bestScore, attempts: result.attempts } } : m);
            }}
          />
        </div>
      </div>
    );
  }

  // ─── Main portal view ─────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.logo}>The Legacy Link</span>
        <span style={{ color: '#475569', fontSize: 13 }}>Agent Training Portal</span>
        <span style={{ marginLeft: 'auto', ...S.muted }}>{session.name}</span>
      </div>

      <div style={S.body}>
        {/* Hero */}
        <div style={{ ...S.card, background: 'linear-gradient(135deg, #0B1020, #111827)', borderColor: `${GOLD}33`, marginBottom: 32 }}>
          <h2 style={{ ...S.h2, fontSize: 24 }}>Welcome, {session.name?.split(' ')[0]} 👋</h2>
          <p style={{ color: '#94a3b8', marginBottom: 16 }}>Complete each module in order to advance. Score 80% or higher on each quiz to earn your badge and unlock the next module.</p>
          <ProgressBar value={completedCount} max={totalModules} />
          <p style={{ ...S.muted, fontSize: 12 }}>{completedCount} of {totalModules} modules completed</p>
        </div>

        {error && <p style={{ color: '#f87171', marginBottom: 20 }}>{error}</p>}

        {/* Stages */}
        {stages.map((stage, si) => {
          const stageMods     = stage.modules || [];
          const stageDone     = stageMods.filter(m => m.progress?.completed).length;
          const stageComplete = stageDone === stageMods.length;
          const stageUnlocked = stageMods.some(m => m.unlocked);

          return (
            <div key={stage.id} style={{ marginBottom: 32 }}>
              {/* Stage header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: stageComplete ? GOLD : stageUnlocked ? '#1e2d42' : '#0B1020', border: `2px solid ${stageComplete ? GOLD : stageUnlocked ? '#334155' : '#1e293b'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: stageComplete ? DARK : '#64748b', flexShrink: 0 }}>
                  {stageComplete ? '✓' : si + 1}
                </div>
                <div>
                  <h3 style={{ ...S.h3, margin: 0 }}>{stage.label}</h3>
                  <p style={{ ...S.muted, margin: 0 }}>{stage.description}</p>
                </div>
                <span style={{ marginLeft: 'auto', ...S.pill, ...(stageComplete ? S.green : stageUnlocked ? S.amber : S.gray) }}>
                  {stageComplete ? 'Complete' : stageUnlocked ? `${stageDone}/${stageMods.length}` : 'Locked'}
                </span>
              </div>

              {/* Module cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                {stageMods.map((mod, mi) => {
                  const done     = mod.progress?.completed;
                  const unlocked = mod.unlocked;
                  return (
                    <div
                      key={mod.id}
                      onClick={() => unlocked && setActive(mod)}
                      style={{ background: PANEL, border: `1px solid ${done ? '#4ade8033' : unlocked ? BORDER : '#0f172a'}`, borderRadius: 14, padding: '20px 20px 16px', cursor: unlocked ? 'pointer' : 'default', opacity: unlocked ? 1 : .45, transition: 'all .2s', position: 'relative' }}
                      onMouseEnter={e => unlocked && (e.currentTarget.style.borderColor = GOLD)}
                      onMouseLeave={e => e.currentTarget.style.borderColor = done ? '#4ade8033' : unlocked ? BORDER : '#0f172a'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <span style={{ ...S.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px' }}>Module {mi + 1}</span>
                        <span style={{ fontSize: 18 }}>{done ? '🏆' : unlocked ? '📖' : '🔒'}</span>
                      </div>
                      <h3 style={{ ...S.h3, marginBottom: 6, fontSize: 15 }}>{mod.title}</h3>
                      <p style={{ ...S.muted, fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>{mod.description}</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {done
                          ? <span style={{ ...S.pill, ...S.green, fontSize: 11 }}>✓ Passed</span>
                          : unlocked
                            ? <span style={{ ...S.pill, ...S.amber, fontSize: 11 }}>Ready</span>
                            : <span style={{ ...S.pill, ...S.gray, fontSize: 11 }}>Locked</span>
                        }
                        {mod.progress?.bestScore != null && <span style={{ ...S.pill, ...S.gray, fontSize: 11 }}>Best: {mod.progress.bestScore}/10</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {completedCount === totalModules && totalModules > 0 && (
          <div style={{ ...S.card, textAlign: 'center', borderColor: `${GOLD}44` }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
            <h2 style={{ ...S.h2, color: GOLD }}>Training Complete!</h2>
            <p style={{ color: '#94a3b8' }}>You have completed all training modules. Keep showing up, keep learning, and keep building.</p>
          </div>
        )}
      </div>
    </div>
  );
}
