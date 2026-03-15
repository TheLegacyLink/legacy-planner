'use client';

import { useEffect, useMemo, useState } from 'react';

const academyContent = {
  beginner: [
    { title: 'What is an IUL?', content: 'An IUL combines lifelong death-benefit protection with index-linked cash value growth and downside protection.', keyPoints: ['Death benefit + cash value', 'Index-linked growth', '0% floor protection'] },
    { title: '0% Floor Protection', content: 'If the market is down, credited interest can floor at 0% (no direct market-loss hit to cash value).', keyPoints: ['Market up = credited gains', 'Market down = 0% floor', 'Protection supports consistency'] }
  ],
  intermediate: [
    { title: 'Cap & Participation', content: 'Cap rate limits max credited gain. Participation rate determines what portion of index gain is credited.', keyPoints: ['Know cap vs participation', 'Set client expectations', 'Protection over hype'] },
    { title: 'Policy Loans & Tax Strategy', content: 'Loans against cash value can support strategic, tax-advantaged access while policy remains in force.', keyPoints: ['No credit checks', 'Potential tax-advantaged access', 'Need proper management'] }
  ],
  advanced: [
    { title: 'Policy Design Strategy', content: 'Design quality drives outcomes. Funding strategy, age, risk tolerance, and objectives matter.', keyPoints: ['Funding discipline matters', 'Avoid under-funding', 'Design to client goal'] }
  ],
  expert: [
    { title: 'Advanced Positioning', content: 'Position IUL by client profile, not product hype. Master objection handling with plain language.', keyPoints: ['Scenario-based recommendations', 'Clear objection handling', 'Client-first guidance'] }
  ]
};

const quizQuestions = [
  { q: 'What are the two main components of an IUL?', opts: ['Term + mutual funds', 'Death benefit + cash value', 'Fixed annuity + rider'], a: 1 },
  { q: 'What does the 0% floor primarily protect against?', opts: ['Policy fees', 'Market downturn losses', 'Inflation'], a: 1 },
  { q: 'A cap rate is best defined as:', opts: ['Maximum credited gain', 'Minimum guaranteed premium', 'Loan interest rate'], a: 0 },
  { q: 'A key strategic use of policy loans is:', opts: ['Tax-advantaged access potential', 'Guaranteed tax deduction', 'Eliminating policy costs'], a: 0 },
  { q: 'To unlock Advanced in this academy you must:', opts: ['Pass quiz 80%+', 'Complete 1 policy app', 'Be in for 6 months'], a: 0 }
];

function clean(v = '') { return String(v || '').trim(); }

function LevelBadge({ level, unlocked, current, done }) {
  const colors = {
    beginner: '#2563EB',
    intermediate: '#D97706',
    advanced: '#7C3AED',
    expert: '#059669'
  };
  const c = colors[level] || '#334155';
  return (
    <button
      type="button"
      style={{
        padding: '8px 14px',
        borderRadius: 999,
        border: `1px solid ${current ? c : '#334155'}`,
        background: current ? c : '#0B1220',
        color: '#F8FAFC',
        opacity: unlocked ? 1 : 0.55,
        cursor: unlocked ? 'pointer' : 'not-allowed',
        fontWeight: 700,
        textTransform: 'capitalize'
      }}
      disabled={!unlocked}
    >
      {level} {done ? '✅' : (!unlocked ? '🔒' : '')}
    </button>
  );
}

export default function IulLearningAcademyPage() {
  const [identity, setIdentity] = useState({ name: '', email: '', licensed: false, inner: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [level, setLevel] = useState('beginner');
  const [completedSections, setCompletedSections] = useState(new Set());
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizSelected, setQuizSelected] = useState(null);
  const [quizScore, setQuizScore] = useState(null);
  const [advancedWriteup, setAdvancedWriteup] = useState('');
  const [advancedDone, setAdvancedDone] = useState(false);
  const [expertDone, setExpertDone] = useState(false);
  const [xp, setXp] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    let canceled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const qp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search || '') : new URLSearchParams('');
        const qName = clean(qp.get('name') || '');
        const qEmail = clean(qp.get('email') || '').toLowerCase();
        const qLicensed = qp.get('licensed') === '1';

        const localMember = typeof window !== 'undefined' ? JSON.parse(window.localStorage.getItem('inner_hub_member_v1') || 'null') : null;
        const token = typeof window !== 'undefined' ? clean(window.localStorage.getItem('licensed_backoffice_token') || '') : '';

        let licensedProfile = null;
        if (token) {
          const meRes = await fetch('/api/licensed-backoffice/auth/me', { headers: { Authorization: `Bearer ${token}` } });
          const meData = meRes.ok ? await meRes.json().catch(() => ({})) : {};
          if (meData?.ok && meData?.profile) licensedProfile = meData.profile;
        }

        const idName = clean(licensedProfile?.name || localMember?.applicantName || localMember?.name || qName || '');
        const idEmail = clean(licensedProfile?.email || localMember?.email || qEmail || '').toLowerCase();

        const [innerRes, progRes] = await Promise.all([
          fetch('/api/inner-circle-hub-members', { cache: 'no-store' }),
          fetch(`/api/iul-academy-progress?email=${encodeURIComponent(idEmail)}&name=${encodeURIComponent(idName)}`, { cache: 'no-store' })
        ]);

        const innerData = innerRes.ok ? await innerRes.json().catch(() => ({})) : {};
        const progData = progRes.ok ? await progRes.json().catch(() => ({})) : {};

        const innerRows = Array.isArray(innerData?.rows) ? innerData.rows : [];
        const innerActive = innerRows.some((r) => Boolean(r?.active) && ((idEmail && clean(r?.email || '').toLowerCase() === idEmail) || (idName && clean(r?.applicantName || r?.name || '').toLowerCase() === idName.toLowerCase())));

        const licensed = Boolean(licensedProfile?.email || qLicensed || innerActive || localMember?.active);
        if (!canceled) {
          setIdentity({ name: idName, email: idEmail, licensed, inner: innerActive });

          const p = progData?.row?.progress || {};
          setCompletedSections(new Set(Array.isArray(p.completedSections) ? p.completedSections : []));
          setQuizScore(p.quizScore == null ? null : Number(p.quizScore));
          setAdvancedDone(Boolean(p.advancedCompleted));
          setExpertDone(Boolean(p.expertCompleted));
          setXp(Number(p.xp || 0));
        }
      } catch {
        if (!canceled) setError('Could not load academy right now.');
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    load();
    return () => { canceled = true; };
  }, []);

  const beginnerComplete = ['beginner_0', 'beginner_1'].every((k) => completedSections.has(k));
  const intermediateSectionsComplete = ['intermediate_0', 'intermediate_1'].every((k) => completedSections.has(k));
  const quizPassed = Number(quizScore || 0) >= 80;
  const advancedSectionsComplete = ['advanced_0'].every((k) => completedSections.has(k));
  const expertSectionsComplete = ['expert_0'].every((k) => completedSections.has(k));

  const levelUnlocked = {
    beginner: true,
    intermediate: beginnerComplete,
    advanced: intermediateSectionsComplete && quizPassed,
    expert: advancedSectionsComplete && advancedDone
  };

  const levelDone = {
    beginner: beginnerComplete,
    intermediate: intermediateSectionsComplete && quizPassed,
    advanced: advancedSectionsComplete && advancedDone,
    expert: expertSectionsComplete && expertDone
  };

  const totalSections = useMemo(() => Object.values(academyContent).flat().length + 3, []);
  const completedCount = completedSections.size + (quizPassed ? 1 : 0) + (advancedDone ? 1 : 0) + (expertDone ? 1 : 0);
  const progressPct = Math.min(100, Math.round((completedCount / totalSections) * 100));

  async function persistProgress(overrides = {}, toastMsg = '') {
    if (!identity.email && !identity.name) return;
    setSaving(true);
    try {
      const payload = {
        completedSections: [...completedSections],
        quizScore,
        quizPassed,
        advancedCompleted: advancedDone,
        expertCompleted: expertDone,
        xp,
        ...overrides
      };
      const res = await fetch('/api/iul-academy-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identity.email, name: identity.name, progress: payload })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        if (toastMsg) setToast(toastMsg);
        const newBadges = Array.isArray(data?.newlyUnlockedBadges) ? data.newlyUnlockedBadges.length : 0;
        if (newBadges) setToast(`🎉 ${newBadges} IUL badge${newBadges > 1 ? 's' : ''} unlocked!`);
      }
    } finally {
      setSaving(false);
      setTimeout(() => setToast(''), 2500);
    }
  }

  function completeSection(levelKey, idx) {
    const key = `${levelKey}_${idx}`;
    if (completedSections.has(key)) return;
    const next = new Set(completedSections);
    next.add(key);
    setCompletedSections(next);
    setXp((x) => x + 50);
    persistProgress({ completedSections: [...next], xp: xp + 50 }, '+50 XP saved');
  }

  function submitQuizAnswer() {
    if (quizSelected == null) return;
    const next = [...quizAnswers, quizSelected];
    if (quizIndex + 1 < quizQuestions.length) {
      setQuizAnswers(next);
      setQuizIndex(quizIndex + 1);
      setQuizSelected(null);
      return;
    }
    const correct = next.filter((a, i) => a === quizQuestions[i].a).length;
    const score = Math.round((correct / quizQuestions.length) * 100);
    setQuizAnswers(next);
    setQuizScore(score);
    const bonus = score >= 80 ? 150 : 0;
    if (bonus) setXp((x) => x + bonus);
    persistProgress({ quizScore: score, quizPassed: score >= 80, xp: xp + bonus }, score >= 80 ? 'Quiz passed — Advanced unlocked' : 'Quiz saved. Retry for 80%+');
  }

  function submitAdvanced() {
    if (!clean(advancedWriteup)) {
      setToast('Please write your summary first.');
      setTimeout(() => setToast(''), 2200);
      return;
    }
    setAdvancedDone(true);
    setXp((x) => x + 200);
    persistProgress({ advancedCompleted: true, xp: xp + 200 }, 'Advanced challenge completed');
  }

  function completeExpert() {
    setExpertDone(true);
    setXp((x) => x + 250);
    persistProgress({ expertCompleted: true, xp: xp + 250 }, 'Expert session completed');
  }

  if (loading) {
    return <main className="publicPage"><div className="panel">Loading IUL Academy…</div></main>;
  }

  if (!identity.licensed && !identity.inner) {
    return (
      <main className="publicPage">
        <div className="panel" style={{ maxWidth: 760, margin: '20px auto', textAlign: 'center' }}>
          <h2 style={{ marginTop: 0 }}>IUL Learning Academy</h2>
          <p className="muted">Access is available for active licensed agents and Inner Circle members only.</p>
        </div>
      </main>
    );
  }

  const sections = academyContent[level] || [];

  return (
    <main className="publicPage" style={{ background: 'radial-gradient(1200px 560px at 8% -8%, rgba(59,130,246,.18), transparent 60%), #020617', minHeight: '100vh' }}>
      <div className="panel" style={{ maxWidth: 980, margin: '18px auto', border: '1px solid #1f2f48', background: '#0B1220' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>🎓</div>
          <h1 style={{ margin: '6px 0 0', color: '#fff' }}>IUL Learning Academy</h1>
          <p style={{ color: '#9FB3CC', margin: '6px 0 0' }}>Premium structured training for licensed + Inner Circle agents.</p>
          <small style={{ color: '#86EFAC' }}>XP: {xp} • Progress: {progressPct}% {saving ? '• Saving…' : ''}</small>
        </div>

        <div style={{ height: 8, borderRadius: 999, background: '#1F2937', overflow: 'hidden', marginTop: 12 }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg,#3B82F6,#22C55E)', transition: 'width .3s ease' }} />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
          {['beginner', 'intermediate', 'advanced', 'expert'].map((lv) => (
            <span key={`lv-${lv}`} onClick={() => levelUnlocked[lv] && setLevel(lv)}>
              <LevelBadge level={lv} unlocked={levelUnlocked[lv]} current={level === lv} done={levelDone[lv]} />
            </span>
          ))}
        </div>

        {toast ? <div className="panel" style={{ marginTop: 10, border: '1px solid #334155', background: '#071022', color: '#BFDBFE' }}>{toast}</div> : null}
        {error ? <div className="panel" style={{ marginTop: 10, border: '1px solid #7f1d1d', background: '#2a0d14', color: '#fecaca' }}>{error}</div> : null}

        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          {sections.map((section, idx) => {
            const sectionId = `${level}_${idx}`;
            const done = completedSections.has(sectionId);
            return (
              <div key={sectionId} style={{ border: done ? '1px solid #22c55e' : '1px solid #334155', borderRadius: 14, background: done ? '#0b1f16' : '#071022', padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, color: '#fff' }}>{section.title}</h3>
                  <span className={`pill ${done ? 'onpace' : 'neutral'}`}>{done ? 'Mastered' : 'In Progress'}</span>
                </div>
                <p style={{ color: '#CBD5E1', marginTop: 8 }}>{section.content}</p>
                <ul style={{ margin: 0, paddingLeft: 18, color: '#93C5FD' }}>
                  {section.keyPoints.map((k) => <li key={k}>{k}</li>)}
                </ul>
                <button type="button" onClick={() => completeSection(level, idx)} disabled={done} className="publicPrimaryBtn" style={{ marginTop: 10 }}>
                  {done ? '✅ Completed' : 'Mark Complete (+50 XP)'}
                </button>
              </div>
            );
          })}
        </div>

        {level === 'intermediate' && intermediateSectionsComplete && quizScore == null ? (
          <div style={{ marginTop: 14, border: '1px solid #334155', borderRadius: 14, background: '#071022', padding: 14 }}>
            <h3 style={{ marginTop: 0, color: '#fff' }}>Knowledge Check (80% to pass)</h3>
            <p style={{ color: '#9FB3CC' }}>Question {quizIndex + 1} of {quizQuestions.length}</p>
            <p style={{ color: '#E5E7EB', fontWeight: 700 }}>{quizQuestions[quizIndex].q}</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {quizQuestions[quizIndex].opts.map((opt, i) => (
                <button key={`opt-${i}`} type="button" onClick={() => setQuizSelected(i)} style={{ textAlign: 'left', borderRadius: 10, border: quizSelected === i ? '1px solid #3B82F6' : '1px solid #334155', background: quizSelected === i ? '#1E3A8A' : '#0B1220', color: '#E5E7EB', padding: '10px 12px' }}>
                  {opt}
                </button>
              ))}
            </div>
            <button type="button" onClick={submitQuizAnswer} disabled={quizSelected == null} className="publicPrimaryBtn" style={{ marginTop: 10 }}>
              {quizIndex + 1 < quizQuestions.length ? 'Next Question' : 'Submit Quiz'}
            </button>
          </div>
        ) : null}

        {level === 'intermediate' && quizScore != null ? (
          <div className="panel" style={{ marginTop: 12, border: `1px solid ${quizPassed ? '#22c55e' : '#7f1d1d'}`, background: quizPassed ? '#0b1f16' : '#2a0d14' }}>
            <strong style={{ color: '#fff' }}>Quiz Score: {quizScore}%</strong>
            <p style={{ margin: '6px 0 0', color: quizPassed ? '#86EFAC' : '#fecaca' }}>{quizPassed ? 'Passed — Advanced unlocked' : 'Need 80% to unlock Advanced. Refresh and retry.'}</p>
          </div>
        ) : null}

        {level === 'advanced' && levelUnlocked.advanced ? (
          <div style={{ marginTop: 14, border: '1px solid #334155', borderRadius: 14, background: '#071022', padding: 14 }}>
            <h3 style={{ marginTop: 0, color: '#fff' }}>Advanced Challenge</h3>
            <p style={{ color: '#9FB3CC' }}>Write your client explanation. Keep it clear and practical.</p>
            <textarea value={advancedWriteup} onChange={(e) => setAdvancedWriteup(e.target.value)} disabled={advancedDone} style={{ width: '100%', minHeight: 140, borderRadius: 10, border: '1px solid #334155', background: '#0B1220', color: '#E5E7EB', padding: 10 }} />
            <button type="button" onClick={submitAdvanced} disabled={advancedDone} className="publicPrimaryBtn" style={{ marginTop: 10 }}>
              {advancedDone ? '✅ Advanced Completed' : 'Submit Advanced (+200 XP)'}
            </button>
          </div>
        ) : null}

        {level === 'expert' && levelUnlocked.expert ? (
          <div style={{ marginTop: 14, border: '1px solid #334155', borderRadius: 14, background: '#071022', padding: 14 }}>
            <h3 style={{ marginTop: 0, color: '#fff' }}>Expert Practice Studio</h3>
            <p style={{ color: '#9FB3CC' }}>Record + AI coaching can be added next. For now, mark completion when your expert session is done.</p>
            <button type="button" onClick={completeExpert} disabled={expertDone} className="publicPrimaryBtn">
              {expertDone ? '✅ Expert Completed' : 'Mark Expert Session Complete (+250 XP)'}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
