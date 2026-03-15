'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const academyContent = {
  beginner: [
    {
      title: 'What is an IUL?',
      content: `An Indexed Universal Life (IUL) policy is permanent life insurance with two core parts: a death benefit and a cash value account.

The death benefit protects a family long-term. The cash value has growth potential tied to a market index (like the S&P 500), while preserving downside protection features.

Think of it as protection first, then strategy: coverage + long-term cash value design.`,
      keyPoints: ['Death benefit + cash value', 'Permanent coverage', 'Index-linked crediting potential', 'Protection-first structure']
    },
    {
      title: '0% Floor Protection',
      content: `The 0% floor means market downturn years do not directly credit negative index returns to the policy account.

When the index rises, the policy can receive positive crediting (subject to cap/participation/spread rules). When index performance is negative, crediting may floor at 0%.

This helps clients stay committed through volatility without panic exits.`,
      keyPoints: ['Downside protection concept', 'Growth years still participate', 'Helps long-term consistency', 'Set realistic expectations']
    }
  ],
  intermediate: [
    {
      title: 'Cap Rates & Participation',
      content: `Cap rate = maximum credited rate in a period.
Participation rate = percentage of index return used in crediting.

Agents must explain these clearly so clients understand why index gains and credited gains are not always identical.

Strong education here builds trust and reduces future confusion.`,
      keyPoints: ['Cap limits upside crediting', 'Participation defines portion used', 'Not direct stock investing', 'Expectation setting is key']
    },
    {
      title: 'Policy Loans & Tax Strategy',
      content: `Policy loans are often used for strategic liquidity.

Done properly, loans can support tax-advantaged access while policy remains in-force. Poor loan management can stress policy performance.

Your role is to teach responsible loan use, monitoring, and annual review discipline.`,
      keyPoints: ['Liquidity tool', 'Requires policy health monitoring', 'Annual review discipline', 'Client suitability matters']
    }
  ],
  advanced: [
    {
      title: 'IUL Design Strategy',
      content: `Design quality drives outcomes. Funding strategy, client age, timeline, risk profile, and objective alignment all matter.

A well-designed case balances protection needs with accumulation goals, and avoids common mistakes such as chronic underfunding or unrealistic assumptions.

Advanced agents tailor design to goal — not one-size-fits-all illustrations.`,
      keyPoints: ['Goal-based design', 'Funding discipline', 'Avoid underfunded cases', 'Review and adjust over time']
    },
    {
      title: 'Case Structuring Mindset',
      content: `At advanced level, focus on case architecture:
- what outcome the client actually wants,
- what premium commitment is sustainable,
- and how to keep the plan resilient over decades.

Strong structuring produces fewer surprises and better long-term retention.`,
      keyPoints: ['Outcome-first advising', 'Sustainable premium planning', 'Long-horizon resilience', 'Retention-focused structuring']
    }
  ],
  expert: [
    {
      title: 'Advanced Positioning & Objections',
      content: `Expert-level communication means simplifying without overselling.

Position IUL against alternatives by matching client profile, tax goals, and risk tolerance. Handle objections with plain language and confidence.

Clients should leave conversations feeling clarity, not complexity.`,
      keyPoints: ['Client-profile positioning', 'Objection mastery', 'Plain-language explanation', 'Confidence + compliance']
    },
    {
      title: 'Elite Conversation Framework',
      content: `Use a repeatable framework:
1) Diagnose objective,
2) Educate on mechanics,
3) Align design to objective,
4) Confirm commitment,
5) Set review cadence.

This creates a premium client experience and repeatable production quality.`,
      keyPoints: ['Repeatable framework', 'High-trust communication', 'Process consistency', 'Premium advisory feel']
    }
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
function normalize(v = '') { return clean(v).toLowerCase(); }
function initialsFromName(v = '') {
  const parts = clean(v).split(/\s+/).filter(Boolean);
  if (!parts.length) return 'LL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function LevelBadge({ level, unlocked, current, done, completedAt }) {
  const colors = { beginner: '#2563EB', intermediate: '#D97706', advanced: '#7C3AED', expert: '#059669' };
  const c = colors[level] || '#334155';
  return (
    <div style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
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
      {done && completedAt ? <small style={{ color: '#94A3B8' }}>{new Date(completedAt).toLocaleDateString()}</small> : <small style={{ color: '#64748B' }}> </small>}
    </div>
  );
}

function analyzeTranscript(transcript = '') {
  const text = clean(transcript).toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const keywordGroups = [
    ['death benefit', 'death-benefit'],
    ['cash value'],
    ['0% floor', 'floor'],
    ['cap', 'cap rate'],
    ['participation'],
    ['tax', 'tax-free'],
    ['loan', 'policy loan']
  ];

  let covered = 0;
  for (const g of keywordGroups) {
    if (g.some((k) => text.includes(k))) covered += 1;
  }

  const coveragePct = Math.round((covered / keywordGroups.length) * 100);
  const lengthScore = Math.min(100, Math.round((words.length / 140) * 100));
  const fillerCount = (text.match(/\b(um|uh|like|you know)\b/g) || []).length;
  const clarity = Math.max(50, 100 - fillerCount * 6);

  const score = Math.round((coveragePct * 0.5) + (lengthScore * 0.25) + (clarity * 0.25));
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D';
  const feedback = [
    `Coverage: ${covered}/${keywordGroups.length} core concepts`,
    `Delivery length: ${words.length} words`,
    `Clarity estimate: ${clarity}%`,
    score >= 80 ? 'Strong pitch foundation. Keep refining examples.' : 'Add more core terms: floor, cap, participation, tax strategy, and policy loans.'
  ].join(' • ');

  return { score, grade, feedback, covered, words: words.length };
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
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [advancedWriteup, setAdvancedWriteup] = useState('');
  const [advancedDone, setAdvancedDone] = useState(false);
  const [advancedSubmissions, setAdvancedSubmissions] = useState([]);
  const [expertDone, setExpertDone] = useState(false);
  const [expertSessions, setExpertSessions] = useState([]);
  const [expertFeedback, setExpertFeedback] = useState(null);
  const [expertTranscript, setExpertTranscript] = useState('');
  const [xp, setXp] = useState(0);
  const [levelCompletedAt, setLevelCompletedAt] = useState({ beginner: '', intermediate: '', advanced: '', expert: '' });
  const [leaderboard, setLeaderboard] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordedMs, setRecordedMs] = useState(0);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const speechRef = useRef(null);
  const timerRef = useRef(null);

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

        const [innerRes, progRes, boardRes] = await Promise.all([
          fetch('/api/inner-circle-hub-members', { cache: 'no-store' }),
          fetch(`/api/iul-academy-progress?email=${encodeURIComponent(idEmail)}&name=${encodeURIComponent(idName)}`, { cache: 'no-store' }),
          fetch('/api/iul-academy-progress?mode=leaderboard', { cache: 'no-store' })
        ]);

        const innerData = innerRes.ok ? await innerRes.json().catch(() => ({})) : {};
        const progData = progRes.ok ? await progRes.json().catch(() => ({})) : {};
        const boardData = boardRes.ok ? await boardRes.json().catch(() => ({})) : {};

        const innerRows = Array.isArray(innerData?.rows) ? innerData.rows : [];
        const innerActive = innerRows.some((r) => Boolean(r?.active) && ((idEmail && clean(r?.email || '').toLowerCase() === idEmail) || (idName && clean(r?.applicantName || r?.name || '').toLowerCase() === idName.toLowerCase())));

        const licensed = Boolean(licensedProfile?.email || qLicensed || innerActive || localMember?.active);
        if (!canceled) {
          setIdentity({ name: idName, email: idEmail, licensed, inner: innerActive });
          const p = progData?.row?.progress || {};
          setCompletedSections(new Set(Array.isArray(p.completedSections) ? p.completedSections : []));
          setQuizScore(p.quizScore == null ? null : Number(p.quizScore));
          setQuizAttempts(Array.isArray(p.quizAttempts) ? p.quizAttempts : []);
          setAdvancedDone(Boolean(p.advancedCompleted));
          setAdvancedSubmissions(Array.isArray(p.advancedSubmissions) ? p.advancedSubmissions : []);
          setExpertDone(Boolean(p.expertCompleted));
          setExpertSessions(Array.isArray(p.expertSessions) ? p.expertSessions : []);
          setXp(Number(p.xp || 0));
          setLevelCompletedAt({ ...(p.levelCompletedAt || { beginner: '', intermediate: '', advanced: '', expert: '' }) });
          setLeaderboard(Array.isArray(boardData?.rows) ? boardData.rows : []);
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

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try { speechRef.current?.stop?.(); } catch {}
    try { recorderRef.current?.stop?.(); } catch {}
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
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
        quizAttempts,
        advancedCompleted: advancedDone,
        advancedSubmissions,
        expertCompleted: expertDone,
        expertSessions,
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
        const p = data?.row?.progress || {};
        setLevelCompletedAt({ ...(p.levelCompletedAt || levelCompletedAt) });
      }
    } finally {
      setSaving(false);
      setTimeout(() => setToast(''), 2600);
    }
  }

  function completeSection(levelKey, idx) {
    const key = `${levelKey}_${idx}`;
    if (completedSections.has(key)) return;
    const next = new Set(completedSections);
    next.add(key);
    const nextXp = xp + 50;
    setCompletedSections(next);
    setXp(nextXp);
    persistProgress({ completedSections: [...next], xp: nextXp }, '+50 XP saved');
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
    const bonus = score >= 80 ? 150 : 0;
    const attempt = { score, correct, total: quizQuestions.length, at: new Date().toISOString() };
    const attempts = [...quizAttempts, attempt].slice(-20);
    const nextXp = xp + bonus;

    setQuizAnswers(next);
    setQuizScore(score);
    setQuizAttempts(attempts);
    setXp(nextXp);

    persistProgress({ quizScore: score, quizPassed: score >= 80, quizAttempts: attempts, quizAttempt: attempt, xp: nextXp }, score >= 80 ? 'Quiz passed — Advanced unlocked' : 'Quiz saved. Retry for 80%+');
  }

  function retakeQuiz() {
    setQuizIndex(0);
    setQuizAnswers([]);
    setQuizSelected(null);
    setQuizScore(null);
  }

  function submitAdvanced() {
    if (!clean(advancedWriteup)) {
      setToast('Please write your summary first.');
      setTimeout(() => setToast(''), 2200);
      return;
    }
    const nextXp = xp + 200;
    const submission = { summary: clean(advancedWriteup), at: new Date().toISOString() };
    const subs = [...advancedSubmissions, submission].slice(-20);
    setAdvancedDone(true);
    setAdvancedSubmissions(subs);
    setXp(nextXp);
    persistProgress({ advancedCompleted: true, advancedSubmissions: subs, advancedSubmission: submission, xp: nextXp }, 'Advanced challenge completed');
  }

  async function startRecording() {
    if (recording) return;
    setExpertTranscript('');
    setExpertFeedback(null);
    setRecordedMs(0);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    recorderRef.current = mr;
    mr.start();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const sr = new SR();
      sr.continuous = true;
      sr.interimResults = true;
      let finalText = '';
      sr.onresult = (evt) => {
        let interim = '';
        for (let i = evt.resultIndex; i < evt.results.length; i++) {
          const t = evt.results[i][0].transcript;
          if (evt.results[i].isFinal) finalText += ` ${t}`;
          else interim += ` ${t}`;
        }
        setExpertTranscript(clean(`${finalText} ${interim}`));
      };
      sr.start();
      speechRef.current = sr;
    }

    setRecording(true);
    timerRef.current = setInterval(() => setRecordedMs((x) => x + 1), 1000);
  }

  function stopRecording() {
    if (!recording) return;
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    try { speechRef.current?.stop?.(); } catch {}
    try { recorderRef.current?.stop?.(); } catch {}
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }

  function analyzeAndSaveExpert() {
    const result = analyzeTranscript(expertTranscript);
    const session = {
      transcript: expertTranscript,
      score: result.score,
      grade: result.grade,
      feedback: result.feedback,
      at: new Date().toISOString()
    };
    const sessions = [...expertSessions, session].slice(-30);
    const bonus = result.score >= 75 ? 250 : 100;
    const nextXp = xp + bonus;
    const done = result.score >= 75;

    setExpertSessions(sessions);
    setExpertFeedback(result);
    setExpertDone(done);
    setXp(nextXp);

    persistProgress({ expertSessions: sessions, expertSession: session, expertCompleted: done, xp: nextXp }, done ? 'Expert session passed' : 'Expert session saved — improve and retry');
  }

  if (loading) return <main className="publicPage"><div className="panel">Loading IUL Academy…</div></main>;

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
      <div className="panel" style={{ maxWidth: 1060, margin: '18px auto', border: '1px solid #1f2f48', background: '#0B1220' }}>
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
              <LevelBadge level={lv} unlocked={levelUnlocked[lv]} current={level === lv} done={levelDone[lv]} completedAt={levelCompletedAt?.[lv] || ''} />
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
              <div key={sectionId} style={{ border: done ? '1px solid #22c55e' : '1px solid #334155', borderRadius: 14, background: done ? '#0b1f16' : '#071022', padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, color: '#fff' }}>{section.title}</h3>
                  <span className={`pill ${done ? 'onpace' : 'neutral'}`}>{done ? 'Mastered' : 'In Progress'}</span>
                </div>
                <p style={{ color: '#E2E8F0', marginTop: 8, fontSize: 16, lineHeight: 1.72, whiteSpace: 'pre-line' }}>{section.content}</p>
                <ul style={{ margin: 0, paddingLeft: 20, color: '#93C5FD', fontSize: 15, lineHeight: 1.6 }}>
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
            <p style={{ color: '#9FB3CC', fontSize: 14, marginBottom: 8 }}>Question {quizIndex + 1} of {quizQuestions.length}</p>
            <p style={{ color: '#FDE68A', fontWeight: 800, fontSize: 21, lineHeight: 1.45, marginBottom: 10 }}>{quizQuestions[quizIndex].q}</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {quizQuestions[quizIndex].opts.map((opt, i) => (
                <button
                  key={`opt-${i}`}
                  type="button"
                  onClick={() => setQuizSelected(i)}
                  style={{
                    textAlign: 'left',
                    borderRadius: 12,
                    border: quizSelected === i ? '1px solid #60A5FA' : '1px solid #334155',
                    background: quizSelected === i ? '#1f2937' : '#0a0f1a',
                    color: quizSelected === i ? '#FDE68A' : '#FCD34D',
                    padding: '14px 14px',
                    fontSize: 16,
                    lineHeight: 1.55,
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    minHeight: 62,
                    display: 'block',
                    width: '100%'
                  }}
                >
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
            <p style={{ margin: '6px 0 0', color: quizPassed ? '#86EFAC' : '#fecaca' }}>{quizPassed ? 'Passed — Advanced unlocked' : 'Need 80% to unlock Advanced.'}</p>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="ghost" onClick={retakeQuiz}>Retake Quiz</button>
              {quizAttempts.slice(-3).map((a, i) => <span key={`qa-${i}`} className="pill neutral">{new Date(a.at).toLocaleDateString()} • {a.score}%</span>)}
            </div>
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
            {advancedSubmissions.length ? <p style={{ color: '#94A3B8', marginTop: 8 }}>Last submitted: {new Date(advancedSubmissions[advancedSubmissions.length - 1].at).toLocaleString()}</p> : null}
          </div>
        ) : null}

        {level === 'expert' && levelUnlocked.expert ? (
          <div style={{ marginTop: 14, border: '1px solid #334155', borderRadius: 14, background: '#071022', padding: 14 }}>
            <h3 style={{ marginTop: 0, color: '#fff' }}>Expert Practice Studio</h3>
            <p style={{ color: '#9FB3CC' }}>Record your pitch, generate transcript, and get rubric scoring.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!recording ? <button type="button" className="publicPrimaryBtn" onClick={startRecording}>🎙 Start Recording</button> : <button type="button" className="ghost" onClick={stopRecording}>⏹ Stop Recording</button>}
              <span className="pill neutral">Duration: {recordedMs}s</span>
            </div>
            <textarea value={expertTranscript} onChange={(e) => setExpertTranscript(e.target.value)} placeholder="Transcript appears here (or paste your script)" style={{ width: '100%', minHeight: 120, borderRadius: 10, border: '1px solid #334155', background: '#0B1220', color: '#E5E7EB', padding: 10, marginTop: 10 }} />
            <button type="button" onClick={analyzeAndSaveExpert} className="publicPrimaryBtn" style={{ marginTop: 10 }}>
              Analyze & Save Session
            </button>

            {expertFeedback ? (
              <div className="panel" style={{ marginTop: 10, border: '1px solid #334155', background: '#0B1220' }}>
                <strong style={{ color: '#fff' }}>Rubric Score: {expertFeedback.score} ({expertFeedback.grade})</strong>
                <p style={{ margin: '6px 0 0', color: '#CBD5E1' }}>{expertFeedback.feedback}</p>
              </div>
            ) : null}

            {expertSessions.length ? <p style={{ color: '#94A3B8', marginTop: 8 }}>Recent sessions: {expertSessions.slice(-3).map((s) => `${new Date(s.at).toLocaleDateString()} (${s.score})`).join(' • ')}</p> : null}
          </div>
        ) : null}

        <div style={{ marginTop: 14, border: '1px solid #334155', borderRadius: 14, background: '#071022', padding: 14 }}>
          <h3 style={{ marginTop: 0, color: '#fff' }}>Academy Leaderboard</h3>
          {!leaderboard.length ? <p className="muted">No leaderboard data yet.</p> : (
            <div style={{ display: 'grid', gap: 8 }}>
              {leaderboard.slice(0, 10).map((r, i) => {
                const me = (identity?.email && normalize(r?.email || '') === normalize(identity.email))
                  || (identity?.name && normalize(r?.name || '') === normalize(identity.name));
                return (
                  <div
                    key={`lb-${r.agentKey || i}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '26px 34px 1fr auto auto',
                      gap: 8,
                      alignItems: 'center',
                      border: me ? '1px solid #3B82F6' : '1px solid #334155',
                      boxShadow: me ? '0 0 0 1px rgba(59,130,246,.25)' : 'none',
                      borderRadius: 10,
                      padding: '8px 10px',
                      background: me ? '#0B1A33' : '#0B1220'
                    }}
                  >
                    <div style={{ display: 'grid', justifyItems: 'center', gap: 2 }}>
                      <strong style={{ color: '#93C5FD' }}>#{Number(r.rank || (i + 1))}</strong>
                      {r.movement === 'up' ? <small style={{ color: '#22C55E', fontWeight: 700 }}>▲{Math.abs(Number(r.rankDelta || 0))}</small> : null}
                      {r.movement === 'down' ? <small style={{ color: '#EF4444', fontWeight: 700 }}>▼{Math.abs(Number(r.rankDelta || 0))}</small> : null}
                      {r.movement === 'new' ? <small style={{ color: '#F59E0B', fontWeight: 700 }}>NEW</small> : null}
                      {r.movement === 'same' ? <small style={{ color: '#64748B', fontWeight: 700 }}>•</small> : null}
                    </div>
                    <div style={{ width: 30, height: 30, borderRadius: 999, background: me ? '#1D4ED8' : '#1F2937', border: '1px solid #334155', color: '#E5E7EB', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>
                      {initialsFromName(r.name || 'Agent')}
                    </div>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <span style={{ color: '#E5E7EB', fontWeight: 600 }}>{r.name || 'Agent'} {me ? <span style={{ color: '#93C5FD' }}>(You)</span> : null}</span>
                      <small style={{ color: '#64748B' }}>{r.expertCompleted ? 'Expert Complete' : 'In Progress'}</small>
                    </div>
                    <span className="pill neutral">XP: {Number(r.xp || 0)}</span>
                    <span className="pill onpace">{Number(r.progressPct || 0)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
