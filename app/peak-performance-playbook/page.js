'use client';

import React, { useEffect, useRef, useState } from 'react';

const SOP_STORAGE_KEY = 'peak_performance_playbook_progress';
const UNLOCK_KEY = 'peak_performance_playbook_unlocked';

const sopChecklist = [
  { id: 'step_1', order_index: 1, title: 'Review & Sign Your Agent Contract', description: 'Complete the independent contractor agreement to gain full access to the agent portal.' },
  { id: 'step_2', order_index: 2, title: 'Write Your First Policy', description: 'Get your first policy on the books — on yourself, or a friend/family member.' },
  { id: 'step_3', order_index: 3, title: 'Watch "Whatever It Takes"', description: 'Essential mindset training video to set the foundation for your success.', video_links: [{ title: 'Whatever It Takes', url: 'https://youtu.be/SVvU9SvCH9o?si=8cgj3ehub8j9OQt' }] },
  { id: 'step_4', order_index: 4, title: 'Watch "My Lowest Point"', description: 'Inspirational story that will help you understand the resilience needed to succeed.', video_links: [{ title: 'My Lowest Point', url: 'https://youtu.be/Crs-2RLpog?si=1SYwQUO8U-DAAb8J' }] },
  { id: 'step_5', order_index: 5, title: 'Join the Skool Community', description: 'Connect with other agents, access training materials, and stay updated.', resource_link: 'https://www.skool.com/legacylink/about?ref__=660035f641d94e3a919e081e220ed6fe' },
  { id: 'step_6', order_index: 6, title: 'Start Carrier Contracting', description: 'Begin contracting with carriers. Find resources in Skool\'s first classroom: "Legacy & Contracting".', resource_link: 'https://www.skool.com/legacylink/about?ref__=660035f641d94e3a919e081e220ed6fe' },
  { id: 'step_7', order_index: 7, title: 'Schedule & Complete Your Onboarding Session', description: 'Book your one-on-one onboarding session for personalized guidance and questions.' },
  { id: 'step_8', order_index: 8, title: 'Learn the CRM', description: 'Get comfortable tracking leads & clients in the customer relationship management system.' },
  { id: 'step_9', order_index: 9, title: 'Study the Scripts', description: 'Master both the sales scripts and recruiting scripts until they feel natural.' },
  { id: 'step_10', order_index: 10, title: 'Start Calling Leads', description: 'Begin making calls to your leads. Remember: speed to contact is key!' },
  { id: 'step_11', order_index: 11, title: 'Invite Prospects to the Webinar', description: 'Learn how to invite prospects to webinars. Add your current registration link to invitations.' },
  { id: 'step_12', order_index: 12, title: 'Connect with Your Upline & Mentor', description: 'Establish regular check-ins with your upline and mentor for guidance and support.' },
  { id: 'step_13', order_index: 13, title: 'Stay Plugged In', description: 'Attend all trainings, calls, and webinars consistently. Success comes from staying connected.' }
];

const Icon = ({ d, size = 24, color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((path, i) => <path key={i} d={path} />) : <path d={d} />}
  </svg>
);

const BookIcon = () => <Icon size={40} color="white" d={["M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3", "M14 2v4a2 2 0 0 0 2 2h4", "M5 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6", "m9 21-2-2 2-2"]} />;
const TargetIcon = () => <Icon size={32} color="white" d={["M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10", "M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12", "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4"]} />;
const ArrowIcon = () => <Icon size={18} color="white" d={["M5 12h14", "m13-5 5 5-5 5"]} />;
const PartyIcon = () => <Icon size={32} color="#16a34a" d={["M22 11v2", "M11 22h2", "m4-14 3-3", "m0 14 3 3", "M3 12h2", "m2-7 3 3", "m0 8-3 3", "M12 8v8", "M8 12h8"]} />;

function LandingScreen({ onStart }) {
  return (
    <div style={{ padding: '32px 16px', background: 'linear-gradient(135deg, #eff6ff, #eef2ff)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 34, fontWeight: 900, color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookIcon /></div>
            Peak Performance Playbook
          </h1>
          <p style={{ fontSize: 18, color: '#4b5563', margin: 0 }}>Your personal guide to achieving big goals.</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0 16px' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookIcon /></div>
          </div>
          <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Peak Performance Playbook</h2>
          <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 16, margin: '0 24px 24px' }}>Define your legacy goals and generate your personalized action plan.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: '#f3f4f6', margin: '0 24px 24px', borderRadius: 12, overflow: 'hidden' }}>
            {[{ value: '14', label: 'Days to Complete', color: '#2563eb' }, { value: '1500', label: 'XP On Time', color: '#16a34a' }, { value: '750', label: 'XP if Late', color: '#d97706' }].map((s) => (
              <div key={s.label} style={{ background: '#f9fafb', padding: '16px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '0 24px 32px' }}>
            <button onClick={onStart} style={{ width: '100%', padding: '16px', fontSize: 17, fontWeight: 700, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Start Your Journey <ArrowIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoalSettingScreen({ onSubmit }) {
  const [goals, setGoals] = useState(Array(10).fill(''));
  const [priorityGoal, setPriorityGoal] = useState('');
  const [why, setWhy] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const placeholders = [
    'I earn $10,000/month', 'I drive my dream car', 'I help 100 families this year', 'I own my first home', 'I am debt-free',
    'I take my family on a dream vacation', 'I promote to Regional Director', 'I recruit 5 new agents this year', 'I invest $1,000/month', 'I wake up at 5am every day'
  ];

  const handleSubmit = async () => {
    const filled = goals.filter((g) => g.trim());
    if (filled.length < 5) return setError('Please write at least 5 goals before continuing.');
    if (!priorityGoal.trim()) return setError('Please identify your #1 priority goal.');
    if (!why.trim()) return setError('Please explain why this goal is important to you.');

    setError('');
    setIsSubmitting(true);

    try {
      const memberRaw = typeof window !== 'undefined' ? window.localStorage.getItem('inner_hub_member_v1') : '';
      const member = memberRaw ? JSON.parse(memberRaw) : null;
      const memberName = String(member?.applicantName || member?.name || '').trim();
      const memberEmail = String(member?.email || '').trim().toLowerCase();

      const res = await fetch('/api/peak-performance-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          goals: filled,
          priorityGoal,
          why,
          memberName,
          memberEmail
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError('Could not generate plan right now. Please try again.');
        return;
      }

      const planSteps = Array.isArray(data?.row?.planSteps) ? data.row.planSteps : [];
      onSubmit({ goals: filled, priorityGoal, why, planSteps, planId: data?.row?.id || null });
    } catch {
      setError('Could not generate plan right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '32px 16px', background: 'linear-gradient(135deg, #eff6ff, #eef2ff)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ background: 'linear-gradient(135deg, #2563eb, #4338ca)', borderRadius: 16, padding: 28, color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TargetIcon /></div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Your Legacy Goals Exercise</h2>
          </div>
          <p style={{ color: '#bfdbfe', fontSize: 15, marginBottom: 16 }}>
            This is your first test of discipline. Success starts with mindset, clarity, and commitment.
          </p>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 14 }}>
            <p style={{ fontWeight: 800, marginBottom: 6 }}>🔥 Why This Matters:</p>
            <p style={{ color: '#dbeafe', fontSize: 14, margin: 0 }}>
              If you won’t take 30 minutes to do this exercise, you won’t succeed in this business. But if you do it — and commit — you’re already separating yourself from the average.
            </p>
          </div>
          <p style={{ color: '#dbeafe', fontSize: 14, marginTop: 12, marginBottom: 0 }}>
            At Legacy Link, we don’t just build agents. We build leaders. Leaders start with vision.
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>1</span>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>Write 10 Goals for the Next 12 Months</h3>
            </div>
            <p style={{ fontSize: 14, color: '#334155', margin: 0, paddingLeft: 42 }}>
              Write them in present tense as if you already achieved them.
            </p>
          </div>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {goals.map((goal, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#e2e8f0', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                <input
                  value={goal}
                  onChange={(e) => { const g = [...goals]; g[i] = e.target.value; setGoals(g); }}
                  placeholder={`Goal ${i + 1}: ${placeholders[i]}`}
                  style={{ flex: 1, padding: '11px 14px', border: '1px solid #94a3b8', borderRadius: 8, fontSize: 14, color: '#0f172a', background: '#ffffff', outline: 'none' }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#d97706', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>2</span>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>Identify Your #1 Priority</h3>
            </div>
          </div>
          <div style={{ padding: 24 }}>
            <textarea value={priorityGoal} onChange={(e) => setPriorityGoal(e.target.value)} rows={3} placeholder="Copy your most important goal from above and explain it in detail..." style={{ width: '100%', padding: '12px 14px', border: '1px solid #94a3b8', borderRadius: 8, fontSize: 14, color: '#0f172a', background: '#ffffff', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>3</span>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>Why Is This Goal Critical?</h3>
            </div>
          </div>
          <div style={{ padding: 24 }}>
            <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={4} placeholder="This goal is important because..." style={{ width: '100%', padding: '12px 14px', border: '1px solid #94a3b8', borderRadius: 8, fontSize: 14, color: '#0f172a', background: '#ffffff', boxSizing: 'border-box' }} />
          </div>
        </div>

        {error ? <p style={{ color: '#dc2626', fontWeight: 700, textAlign: 'center', margin: 0 }}>{error}</p> : null}

        <button onClick={handleSubmit} disabled={isSubmitting} style={{ padding: '14px 18px', border: 0, borderRadius: 10, background: isSubmitting ? '#86efac' : '#16a34a', color: '#fff', fontWeight: 800, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
          {isSubmitting ? 'Generating Plan...' : 'Generate My Plan'}
        </button>
      </div>
    </div>
  );
}

function DailyTrackerScreen({ data, onComplete }) {
  const TOTAL_DAYS = 14;
  const planSteps = Array.isArray(data?.planSteps) ? data.planSteps.slice(0, TOTAL_DAYS) : [];
  const progressKey = `peak_playbook_tracker_${data?.planId || data?.priorityGoal || 'default'}`;

  const [checked, setChecked] = useState(() => {
    try {
      const raw = localStorage.getItem(progressKey);
      const arr = raw ? JSON.parse(raw) : null;
      return Array.isArray(arr) && arr.length === TOTAL_DAYS ? arr.map(Boolean) : Array(TOTAL_DAYS).fill(false);
    } catch {
      return Array(TOTAL_DAYS).fill(false);
    }
  });
  const [reflection, setReflection] = useState('');

  const completedCount = checked.filter(Boolean).length;
  const currentDay = Math.min(TOTAL_DAYS, completedCount + 1);
  const allDone = completedCount >= TOTAL_DAYS;

  useEffect(() => {
    try { localStorage.setItem(progressKey, JSON.stringify(checked)); } catch {}
  }, [checked, progressKey]);

  const canOpenDay = (dayNum) => dayNum <= currentDay || checked[dayNum - 1];
  const [selectedDay, setSelectedDay] = useState(1);
  useEffect(() => {
    if (!canOpenDay(selectedDay)) setSelectedDay(currentDay);
  }, [selectedDay, currentDay]);

  const markDay = (dayNum, done) => {
    if (!canOpenDay(dayNum)) return;
    const idx = dayNum - 1;
    const next = [...checked];
    next[idx] = !!done;
    for (let i = idx + 1; i < next.length; i += 1) {
      if (!next[i - 1]) next[i] = false;
    }
    setChecked(next);
  };

  const step = planSteps[selectedDay - 1] || { text: `Day ${selectedDay}: Complete your insurance actions for today.`, metrics: [] };

  return (
    <div style={{ padding: '24px 16px', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 18 }}>
        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, color: '#0f172a' }}>📅 Your 14-Day Journey</h3>
            <span style={{ border: '1px solid #cbd5e1', borderRadius: 999, padding: '4px 10px', color: '#0f172a', fontWeight: 700 }}>{completedCount}/{TOTAL_DAYS}</span>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {Array.from({ length: TOTAL_DAYS }, (_, i) => {
              const day = i + 1;
              const done = checked[i];
              const open = canOpenDay(day);
              const active = selectedDay === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => open && setSelectedDay(day)}
                  style={{
                    border: `1px solid ${active ? '#2563eb' : done ? '#16a34a' : '#cbd5e1'}`,
                    borderRadius: 10,
                    padding: '10px 12px',
                    background: done ? '#f0fdf4' : active ? '#eff6ff' : '#ffffff',
                    color: open ? '#0f172a' : '#94a3b8',
                    cursor: open ? 'pointer' : 'not-allowed',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span style={{ fontWeight: 700 }}>Day {day}</span>
                  <span>{done ? '✅' : open ? '▶' : '🔒'}</span>
                </button>
              );
            })}
          </div>

          {allDone ? (
            <div style={{ marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
              <h4 style={{ margin: '0 0 8px', color: '#0f172a' }}>Final Reflection</h4>
              <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} rows={4} placeholder="My biggest wins were..." style={{ width: '100%', padding: '10px 12px', border: '1px solid #94a3b8', borderRadius: 8, boxSizing: 'border-box', color: '#0f172a' }} />
              <button onClick={() => reflection.trim() ? onComplete() : alert('Please add reflection.')} style={{ marginTop: 10, width: '100%', padding: 12, border: 0, borderRadius: 8, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Submit for Final Approval & XP</button>
            </div>
          ) : null}
        </div>

        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 16, padding: 16, display: 'grid', gap: 12, alignContent: 'start' }}>
          <h4 style={{ margin: 0, color: '#0f172a' }}>Day {selectedDay} Insurance Action Plan</h4>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 12, color: '#1e3a8a', fontWeight: 600 }}>
            {step.text}
          </div>
          <div>
            <strong style={{ color: '#0f172a' }}>Step-by-step targets</strong>
            <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18, color: '#334155' }}>
              {(Array.isArray(step.metrics) ? step.metrics : []).map((m, idx) => <li key={idx}>{m}</li>)}
              {!Array.isArray(step.metrics) || !step.metrics.length ? <li>Complete your highest-value insurance activity for this day.</li> : null}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => markDay(selectedDay, !checked[selectedDay - 1])}
            style={{
              padding: '11px 12px',
              borderRadius: 8,
              border: checked[selectedDay - 1] ? '1px solid #16a34a' : '1px solid #2563eb',
              background: checked[selectedDay - 1] ? '#f0fdf4' : '#2563eb',
              color: checked[selectedDay - 1] ? '#166534' : '#fff',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {checked[selectedDay - 1] ? '✓ Day Completed (Click to Undo)' : `Mark Day ${selectedDay} Complete`}
          </button>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
            <h4 style={{ margin: '0 0 6px', color: '#0f172a' }}>Goal Details</h4>
            <p style={{ margin: '0 0 6px', color: '#334155' }}><strong>Priority Goal:</strong> {data.priorityGoal}</p>
            <p style={{ margin: 0, color: '#334155' }}><strong>Why:</strong> {data.why}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdvancedPlaybook() {
  const [screen, setScreen] = useState('landing');
  const [playbookData, setPlaybookData] = useState(null);

  if (screen === 'landing') return <LandingScreen onStart={() => setScreen('goals')} />;
  if (screen === 'goals') return <GoalSettingScreen onSubmit={(data) => { setPlaybookData(data); setScreen('tracker'); }} />;
  if (screen === 'tracker') return <DailyTrackerScreen data={playbookData} onComplete={() => setScreen('done')} />;

  return (
    <div style={{ padding: '32px 16px', display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f0fdf4' }}>
      <div style={{ textAlign: 'center', background: '#fff', border: '1px solid #bbf7d0', borderRadius: 20, padding: 40, maxWidth: 480 }}>
        <PartyIcon />
        <h2 style={{ fontSize: 28, fontWeight: 900, color: '#166534', marginBottom: 8 }}>Playbook Complete! 🎉</h2>
        <p style={{ color: '#15803d' }}>You have completed your journey.</p>
        <button onClick={() => setScreen('landing')} style={{ marginTop: 16, padding: '10px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>View Again</button>
      </div>
    </div>
  );
}

export default function PeakPerformancePlaybookPage() {
  const [completions, setCompletions] = useState(() => {
    try {
      const saved = localStorage.getItem(SOP_STORAGE_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [isUnlocked, setIsUnlocked] = useState(false);
  const didSyncRef = useRef(false);

  const completedCount = completions.size;
  const totalCount = sopChecklist.length;

  useEffect(() => {
    const done = totalCount > 0 && completedCount >= totalCount;
    setIsUnlocked(done);
    try {
      if (done) localStorage.setItem(UNLOCK_KEY, '1');
      else localStorage.removeItem(UNLOCK_KEY);
    } catch {}

    if (!done || didSyncRef.current) return;
    didSyncRef.current = true;

    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('inner_hub_member_v1') : '';
    const localMember = raw ? JSON.parse(raw) : null;
    const name = String(localMember?.applicantName || localMember?.name || '').trim();
    const email = String(localMember?.email || '').trim().toLowerCase();
    if (!name && !email) return;

    fetch('/api/achievement-center', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'merge_unlocks', name, email, unlockedKeys: ['performance.official_link'], source: 'peak_playbook_complete' })
    }).catch(() => {});
  }, [completedCount, totalCount]);

  const toggle = (id) => {
    const next = new Set(completions);
    if (next.has(id)) next.delete(id); else next.add(id);
    setCompletions(next);
    try { localStorage.setItem(SOP_STORAGE_KEY, JSON.stringify(Array.from(next))); } catch {}
  };

  if (isUnlocked) return <AdvancedPlaybook />;

  return (
    <div style={{ padding: '32px 16px', background: 'radial-gradient(circle at top, #15213f 0%, #070b14 55%)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ color: '#fff', marginTop: 0 }}>Peak Performance Unlock</h1>
        <p style={{ color: '#9CA3AF' }}>Complete all 13 SOP steps to unlock the full Peak Performance Playbook experience.</p>
        <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: 12, padding: 14, marginBottom: 12, color: '#E2E8F0', fontWeight: 700 }}>
          Progress: {completedCount}/{totalCount}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {sopChecklist.map((item) => {
            const done = completions.has(item.id);
            return (
              <div key={item.id} style={{ background: '#0F172A', border: `1px solid ${done ? '#16a34a' : '#334155'}`, borderRadius: 10, padding: 12 }}>
                <label style={{ color: done ? '#86efac' : '#fff', display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={done} onChange={() => toggle(item.id)} />
                  <span><strong>{item.order_index}. {item.title}</strong><br /><small style={{ color: '#94A3B8' }}>{item.description}</small></span>
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
