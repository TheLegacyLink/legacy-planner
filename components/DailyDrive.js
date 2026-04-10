'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUOTES = [
  "You don't rise to the level of your goals, you fall to the level of your systems.",
  "Every conversation is a seed. Plant enough seeds.",
  "The goal isn't to be perfect. The goal is to be consistent.",
  "Legacy isn't built in a day — but it's built daily.",
  "Your why is your weapon. Use it.",
  "Five conversations a day changes your life in 90 days.",
  "Success is rented, and rent is due every day.",
  "Do the work when no one's watching. The scoreboard shows up later.",
  "Consistency is the price of excellence.",
  "One more conversation. That's always the move."
];

const GOLD = '#C8A96B';
const GOLD_LIGHT = '#E6D1A6';
const BG = '#0B1020';
const CARD = '#111827';
const CARD2 = '#0F172A';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoWeek(dateStr = '') {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4.getTime() - ((jan4.getDay() + 6) % 7) * 86400000);
  const weekNum = Math.floor((d.getTime() - startOfWeek1.getTime()) / (7 * 86400000)) + 1;
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekDays() {
  const today = new Date();
  const day = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function scoreForDay(log = {}) {
  if (!log) return 0;
  return (log.engaged || 0) * 0.5 + (log.realConvo || 0) * 1.0;
}

function dayLabel(dateStr = '') {
  const d = new Date(dateStr + 'T12:00:00');
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][((d.getDay() + 6) % 7)];
}

function displayName(nameStr = '', email = '') {
  if (nameStr) {
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    return parts[0] || '';
  }
  if (email) {
    const local = email.split('@')[0].replace(/[._]/g, ' ');
    const parts = local.split(' ').map((p) => p.charAt(0).toUpperCase() + p.slice(1));
    if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    return parts[0] || email;
  }
  return '';
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

function ConfettiCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: 8 + Math.random() * 8,
      h: 4 + Math.random() * 4,
      color: [GOLD, GOLD_LIGHT, '#fff', '#F59E0B', '#FDE68A'][Math.floor(Math.random() * 5)],
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      angle: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 0.1
    }));
    let frame;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.va;
        if (p.y > canvas.height) p.y = -20;
      });
      frame = requestAnimationFrame(draw);
    }
    draw();
    const t = setTimeout(() => { cancelAnimationFrame(frame); ctx.clearRect(0, 0, canvas.width, canvas.height); }, 3000);
    return () => { cancelAnimationFrame(frame); clearTimeout(t); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 9999 }} />;
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

function DailyDriveOnboarding({ tier, onComplete }) {
  const [screen, setScreen] = useState(1);
  const [why, setWhy] = useState('');
  const [whyPhoto, setWhyPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const goal = tier === 'inner_circle' ? 5 : 2;

  const screens = [
    {
      headline: 'Before we set your goals, let\'s set your reason.',
      body: 'Goals without a why are just chores. Take 60 seconds — this is the thing you\'ll come back to on the hard days.',
      btn: 'Let\'s Go →',
      onNext: () => setScreen(2)
    },
    {
      headline: `If you talk to ${goal} people a day for the next 90 days, what does your life look like?`,
      btn: 'Continue →',
      onNext: () => { if (why.trim()) setScreen(3); }
    },
    {
      headline: `Your daily number is ${goal}.`,
      math: goal === 5
        ? '5/day × 5 days = 25/week → 100/month → momentum you can\'t fake.'
        : '2/day × 5 days = 10/week → 40/month → momentum you can\'t fake.',
      btn: 'I\'m Committed →',
      onNext: () => setScreen(4)
    },
    {
      headline: 'You\'re locked in.',
      btn: 'Enter Daily Drive →',
      onNext: async () => {
        setSaving(true);
        await onComplete({ why, whyPhoto });
        setSaving(false);
      }
    }
  ];

  const s = screens[screen - 1];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: BG, zIndex: 1000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'inherit'
    }}>
      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
        {[1,2,3,4].map((n) => (
          <div key={n} style={{
            width: n === screen ? 24 : 8, height: 8, borderRadius: 99,
            background: n === screen ? GOLD : '#334155', transition: 'all .3s ease'
          }} />
        ))}
      </div>

      <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(22px, 5vw, 32px)', fontWeight: 800, color: '#fff', marginBottom: 16, lineHeight: 1.25 }}>
          {s.headline}
        </h1>

        {screen === 1 && (
          <p style={{ color: '#94A3B8', fontSize: 17, lineHeight: 1.6, marginBottom: 36 }}>{s.body}</p>
        )}

        {screen === 2 && (
          <div style={{ marginBottom: 28 }}>
            <textarea
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="I'll be able to pay off... My family will... I'll finally..."
              rows={5}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12,
                background: CARD, border: `1px solid ${why.trim() ? GOLD : '#334155'}`,
                color: '#fff', fontSize: 16, resize: 'vertical', outline: 'none',
                transition: 'border .2s', boxSizing: 'border-box'
              }}
            />
            <div style={{ marginTop: 12, textAlign: 'left' }}>
              <label style={{ color: '#64748B', fontSize: 13, cursor: 'pointer' }}>
                + Add a photo (optional)
                <input
                  type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => setWhyPhoto(ev.target.result);
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {whyPhoto && <img src={whyPhoto} alt="Why" style={{ marginTop: 8, maxHeight: 80, borderRadius: 8, opacity: 0.8 }} />}
            </div>
          </div>
        )}

        {screen === 3 && (
          <div style={{ marginBottom: 36 }}>
            <div style={{
              display: 'inline-block', padding: '8px 24px', borderRadius: 99,
              background: 'rgba(200,169,107,0.12)', border: `1px solid ${GOLD}`,
              color: GOLD, fontSize: 15, marginBottom: 20
            }}>{s.math}</div>
          </div>
        )}

        {screen === 4 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{
              padding: 20, borderRadius: 16, background: CARD,
              border: `1px solid ${GOLD}33`, marginBottom: 16
            }}>
              <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Your Why</div>
              <div style={{ color: GOLD_LIGHT, fontSize: 17, fontStyle: 'italic', lineHeight: 1.5 }}>&ldquo;{why}&rdquo;</div>
            </div>
            <div style={{
              padding: '12px 20px', borderRadius: 12, background: CARD,
              border: '1px solid #1E293B', color: '#E5E7EB', fontSize: 15
            }}>
              Your daily goal: <strong style={{ color: GOLD }}>{goal} real convos/day</strong>
            </div>
          </div>
        )}

        <button
          onClick={s.onNext}
          disabled={saving || (screen === 2 && !why.trim())}
          style={{
            width: '100%', padding: '16px 28px', borderRadius: 12,
            background: (saving || (screen === 2 && !why.trim())) ? '#334155' : GOLD,
            color: '#000', fontSize: 17, fontWeight: 800, border: 'none',
            cursor: (saving || (screen === 2 && !why.trim())) ? 'not-allowed' : 'pointer',
            transition: 'all .2s', letterSpacing: 0.5
          }}
        >
          {saving ? 'Saving...' : s.btn}
        </button>

        {screen > 1 && (
          <button
            onClick={() => setScreen(screen - 1)}
            style={{ marginTop: 14, background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 14 }}
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Progress Ring ────────────────────────────────────────────────────────────

function ProgressRing({ score, goal }) {
  const pct = goal > 0 ? Math.min(score / goal, 1.5) : 0;
  const r = 70;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 1.5, 1) * circ;
  const color = pct >= 1 ? '#4ADE80' : GOLD;

  return (
    <svg width={180} height={180} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={90} cy={90} r={r} fill="none" stroke="#1E293B" strokeWidth={12} />
      <circle
        cx={90} cy={90} r={r} fill="none" stroke={color} strokeWidth={12}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

// ─── Log Button ───────────────────────────────────────────────────────────────

function LogButton({ label, count, onLog, onUndo, pulsing }) {
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
      <button
        onClick={onLog}
        className={pulsing ? 'dd-pulse' : ''}
        style={{
          width: '100%', padding: '18px 8px', borderRadius: 14,
          background: CARD, border: `1px solid #334155`,
          color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          transition: 'border-color .2s, box-shadow .2s',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.boxShadow = `0 0 16px ${GOLD}44`; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        <span style={{ fontSize: 22, color: GOLD }}>+</span>
        <span>{label}</span>
        <span style={{ fontSize: 28, fontWeight: 900, color: GOLD_LIGHT }}>{count}</span>
      </button>
      {count > 0 && (
        <button
          onClick={onUndo}
          style={{ marginTop: 6, background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}
        >
          Undo
        </button>
      )}
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function Leaderboard({ userEmail, userTier }) {
  const [activeTab, setActiveTab] = useState(userTier === 'inner_circle' ? 'inner_circle' : 'licensed_agent');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userRank, setUserRank] = useState(null);

  const week = isoWeek();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/daily-drive?leaderboard=true&tier=${activeTab}&week=${week}`)
      .then((r) => r.json())
      .then((d) => {
        const list = d.rows || [];
        setRows(list);
        const idx = list.findIndex((r) => r.email === userEmail?.toLowerCase());
        setUserRank(idx >= 0 ? idx + 1 : null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeTab, week, userEmail]);

  return (
    <div style={{ background: CARD, borderRadius: 16, padding: 20, border: '1px solid #1E293B' }}>
      <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 14 }}>🏆 Weekly Leaderboard</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['inner_circle', 'Inner Circle'], ['licensed_agent', 'Licensed Agents']].map(([k, l]) => (
          <button key={k} onClick={() => setActiveTab(k)} style={{
            padding: '6px 14px', borderRadius: 99, border: 'none',
            background: activeTab === k ? GOLD : '#1E293B',
            color: activeTab === k ? '#000' : '#94A3B8',
            cursor: 'pointer', fontWeight: 600, fontSize: 13
          }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#475569', fontSize: 14 }}>Loading...</div>
      ) : rows.length === 0 ? (
        <div style={{ color: '#475569', fontSize: 14 }}>No activity yet this week. Be the first.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((row, i) => {
            const isMe = row.email === userEmail?.toLowerCase();
            return (
              <div key={row.email} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 10,
                background: isMe ? `${GOLD}22` : '#0F172A',
                border: isMe ? `1px solid ${GOLD}55` : '1px solid #1E293B'
              }}>
                <span style={{ color: i < 3 ? GOLD : '#64748B', fontWeight: 800, fontSize: 15, minWidth: 24 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                </span>
                <span style={{ flex: 1, color: isMe ? GOLD_LIGHT : '#E5E7EB', fontWeight: isMe ? 700 : 500, fontSize: 14 }}>
                  {row.displayName || row.email}
                  {isMe && <span style={{ marginLeft: 6, fontSize: 11, color: GOLD }}>(you)</span>}
                </span>
                <span style={{ color: GOLD, fontWeight: 800, fontSize: 15 }}>{row.score.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      )}

      {userRank === null && userEmail && (
        <div style={{ marginTop: 12, color: '#475569', fontSize: 13 }}>
          You're not on the board yet — log some activity!
        </div>
      )}
    </div>
  );
}

// ─── Income Projection Card ─────────────────────────────────────────────────

function IncomeProjectionCard({ defaultWeeklyGoal }) {
  const [weeklyConvos, setWeeklyConvos] = useState(defaultWeeklyGoal || 20);

  const monthly = weeklyConvos * 4;
  const interested = Math.round(monthly * 0.75);
  const moveForward = Math.round(interested * 0.75);
  const income = moveForward * 500;

  const handleChange = (e) => {
    const v = Math.max(1, Math.min(999, Number(e.target.value) || 1));
    setWeeklyConvos(v);
  };

  return (
    <div style={{ background: CARD, borderRadius: 16, padding: 20, marginBottom: 16, border: '1px solid #1E293B' }}>
      <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 16 }}>💰 Income Projection</div>

      {/* Editable weekly convo input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="number"
          min="1"
          max="999"
          value={weeklyConvos}
          onChange={handleChange}
          style={{
            width: 80, padding: '8px 10px', borderRadius: 10,
            background: '#0F172A', border: `1px solid ${GOLD}`,
            color: GOLD, fontSize: 22, fontWeight: 900, textAlign: 'center',
            outline: 'none'
          }}
        />
        <span style={{ color: '#94A3B8', fontSize: 15 }}>conversations / week</span>
      </div>

      {/* Flowing visual */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{
          padding: '12px 16px', borderRadius: 12,
          background: '#0F172A', border: '1px solid #334155'
        }}>
          <span style={{ color: GOLD, fontWeight: 900, fontSize: 24 }}>{monthly.toLocaleString()}</span>
          <span style={{ color: '#64748B', fontSize: 14, marginLeft: 10 }}>conversations / month</span>
        </div>

        <div style={{ textAlign: 'center', color: '#334155', fontSize: 22, lineHeight: 1 }}>↓</div>

        <div style={{
          padding: '12px 16px', borderRadius: 12,
          background: '#0F172A', border: '1px solid #334155'
        }}>
          <span style={{ color: GOLD, fontWeight: 900, fontSize: 24 }}>{interested.toLocaleString()}</span>
          <span style={{ color: '#64748B', fontSize: 14, marginLeft: 10 }}>interested (75% conversion)</span>
        </div>

        <div style={{ textAlign: 'center', color: '#334155', fontSize: 22, lineHeight: 1 }}>↓</div>

        <div style={{
          padding: '12px 16px', borderRadius: 12,
          background: '#0F172A', border: '1px solid #334155'
        }}>
          <span style={{ color: GOLD, fontWeight: 900, fontSize: 24 }}>{moveForward.toLocaleString()}</span>
          <span style={{ color: '#64748B', fontSize: 14, marginLeft: 10 }}>move forward (25% drop-off)</span>
        </div>

        <div style={{ textAlign: 'center', color: '#334155', fontSize: 22, lineHeight: 1 }}>↓</div>

        <div style={{
          padding: '16px 20px', borderRadius: 12,
          background: 'linear-gradient(135deg, #0F172A 0%, #0B1020 100%)',
          border: `1px solid ${GOLD}55`
        }}>
          <span style={{ color: '#4ADE80', fontWeight: 900, fontSize: 28 }}>~${income.toLocaleString()}</span>
          <span style={{ color: '#94A3B8', fontSize: 15, marginLeft: 10 }}>/month projected</span>
        </div>
      </div>

      <div style={{ marginTop: 12, color: '#475569', fontSize: 12, fontStyle: 'italic' }}>
        Based on team averages. Your results will vary.
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function DailyDriveDashboard({ userData, userEmail, onUpdate }) {
  const today = todayKey();
  const todayLog = userData.logs?.[today] || { touch: 0, engaged: 0, realConvo: 0 };
  const goal = userData.dailyGoal || (userData.tier === 'inner_circle' ? 5 : 2);
  const score = scoreForDay(todayLog);
  const pct = goal > 0 ? score / goal : 0;

  const [pulseType, setPulseType] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [editingWhy, setEditingWhy] = useState(false);
  const [whyDraft, setWhyDraft] = useState(userData.why || '');
  const [quoteIdx] = useState(() => Math.floor(Date.now() / (1000 * 60 * 60 * 6)) % QUOTES.length);
  const prevHit = useRef(pct >= 1);

  // Adjustable goal
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(goal));
  const [savingGoal, setSavingGoal] = useState(false);

  useEffect(() => {
    if (pct >= 1 && !prevHit.current) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3200);
    }
    prevHit.current = pct >= 1;
  }, [pct]);

  const saveGoal = async () => {
    const newGoal = Math.min(50, Math.max(1, Number(goalDraft) || goal));
    setSavingGoal(true);
    const res = await fetch('/api/daily-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, action: 'update-goal', dailyGoal: newGoal })
    });
    const d = await res.json();
    if (d.ok) { onUpdate(d.user); }
    setSavingGoal(false);
    setEditingGoal(false);
  };

  const progressMsg = () => {
    if (pct === 0) return "Let's get to work.";
    if (pct >= 1.5) return 'Overachiever mode. 🔥';
    if (pct >= 1) return "You hit it. That's how legacies get built.";
    if (pct >= 0.5) return 'Halfway. Keep going.';
    return "You're moving. Keep going.";
  };

  const doLog = async (type) => {
    setPulseType(type);
    setTimeout(() => setPulseType(null), 400);
    const res = await fetch('/api/daily-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, action: 'log', type, date: today })
    });
    const d = await res.json();
    if (d.ok) onUpdate(d.user);
  };

  const doUndo = async (type) => {
    const res = await fetch('/api/daily-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, action: 'undo', type, date: today })
    });
    const d = await res.json();
    if (d.ok) onUpdate(d.user);
  };

  const saveWhy = async () => {
    const res = await fetch('/api/daily-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, action: 'update-why', why: whyDraft })
    });
    const d = await res.json();
    if (d.ok) { onUpdate(d.user); setEditingWhy(false); }
  };

  // Weekly data
  const weekDays = getWeekDays();
  const currentWeek = isoWeek();
  const weekScore = weekDays.reduce((sum, d) => sum + scoreForDay(userData.logs?.[d]), 0);
  const weekGoal = goal * 5;

  // Default weekly convo goal for projection card = dailyGoal × 5
  const defaultWeeklyConvoGoal = goal * 5;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 12px', fontFamily: 'inherit' }}>
      {showConfetti && <ConfettiCanvas />}

      {/* 1. Hero Card */}
      <div style={{
        background: CARD, borderRadius: 20, padding: 28, marginBottom: 16,
        border: `1px solid ${pct >= 1 ? '#4ADE8055' : '#1E293B'}`,
        textAlign: 'center', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ color: '#64748B', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>Today's Progress</div>
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
          <ProgressRing score={score} goal={goal} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: pct >= 1 ? '#4ADE80' : GOLD_LIGHT }}>
              {score % 1 === 0 ? score : score.toFixed(1)}
            </div>
            <div style={{ fontSize: 14, color: '#64748B' }}>/ {goal}</div>
          </div>
        </div>

        {/* Adjustable goal */}
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {editingGoal ? (
            <>
              <span style={{ color: '#94A3B8', fontSize: 13 }}>Your number:</span>
              <input
                type="number" min="1" max="50"
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setEditingGoal(false); }}
                autoFocus
                style={{
                  width: 56, padding: '4px 8px', borderRadius: 8,
                  background: '#0F172A', border: `1px solid ${GOLD}`,
                  color: GOLD, fontSize: 18, fontWeight: 900, textAlign: 'center', outline: 'none'
                }}
              />
              <button
                onClick={saveGoal}
                disabled={savingGoal}
                style={{ padding: '4px 12px', borderRadius: 8, background: GOLD, color: '#000', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
              >{savingGoal ? '...' : 'Save'}</button>
              <button
                onClick={() => setEditingGoal(false)}
                style={{ padding: '4px 10px', borderRadius: 8, background: '#1E293B', color: '#94A3B8', border: 'none', cursor: 'pointer', fontSize: 13 }}
              >Cancel</button>
            </>
          ) : (
            <>
              <span style={{ color: '#94A3B8', fontSize: 13 }}>Your number: <strong style={{ color: GOLD }}>{goal}</strong></span>
              <button
                onClick={() => { setGoalDraft(String(goal)); setEditingGoal(true); }}
                title="Edit daily goal"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 16, padding: '2px 6px', borderRadius: 6,
                  color: '#475569', lineHeight: 1
                }}
              >✏️</button>
            </>
          )}
        </div>
        <div style={{ fontSize: 16, color: pct >= 1 ? '#4ADE80' : '#94A3B8', fontWeight: 600 }}>{progressMsg()}</div>
        {userData.streakDays > 0 && (
          <div style={{ marginTop: 8, fontSize: 14, color: GOLD }}>🔥 {userData.streakDays}-day streak</div>
        )}
      </div>

      {/* 2. Log Buttons */}
      <div style={{ background: CARD, borderRadius: 16, padding: 20, marginBottom: 16, border: '1px solid #1E293B' }}>
        <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 14 }}>Log a conversation</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <LogButton label="Touch" count={todayLog.touch || 0} onLog={() => doLog('touch')} onUndo={() => doUndo('touch')} pulsing={pulseType === 'touch'} />
          <LogButton label="Engaged" count={todayLog.engaged || 0} onLog={() => doLog('engaged')} onUndo={() => doUndo('engaged')} pulsing={pulseType === 'engaged'} />
          <LogButton label="Real Convo" count={todayLog.realConvo || 0} onLog={() => doLog('realConvo')} onUndo={() => doUndo('realConvo')} pulsing={pulseType === 'realConvo'} />
        </div>

        {/* Legend */}
        <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: '#0B1220', border: '1px solid #1E293B', fontSize: 12, color: '#64748B', lineHeight: 1.7 }}>
          <strong style={{ color: '#94A3B8' }}>What counts?</strong><br />
          <span style={{ color: '#475569' }}>Touch</span> = said hi, left a voicemail, liked a post (0 pts) &nbsp;·&nbsp;
          <span style={{ color: '#475569' }}>Engaged</span> = replied, had a brief exchange (0.5 pts) &nbsp;·&nbsp;
          <span style={{ color: GOLD }}>Real Convo</span> = substantive conversation about the opportunity (1.0 pt)
        </div>
      </div>

      {/* 3. Today's Breakdown */}
      <div style={{ background: CARD, borderRadius: 16, padding: 20, marginBottom: 16, border: '1px solid #1E293B' }}>
        <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 12 }}>Today's Breakdown</div>
        <div style={{ display: 'flex', gap: 12 }}>
          {[['Touch', todayLog.touch || 0, '#64748B'], ['Engaged', todayLog.engaged || 0, GOLD], ['Real Convo', todayLog.realConvo || 0, '#4ADE80']].map(([l, v, c]) => (
            <div key={l} style={{ flex: 1, textAlign: 'center', padding: '14px 8px', borderRadius: 12, background: '#0F172A', border: '1px solid #1E293B' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: c }}>{v}</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. This Week */}
      <div style={{ background: CARD, borderRadius: 16, padding: 20, marginBottom: 16, border: '1px solid #1E293B' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ color: '#94A3B8', fontSize: 13 }}>This Week</div>
          <div style={{ color: GOLD, fontSize: 13, fontWeight: 700 }}>{weekScore.toFixed(1)} / {weekGoal} this week</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {weekDays.map((d) => {
            const s = scoreForDay(userData.logs?.[d]);
            const isToday = d === today;
            const isFuture = d > today;
            const hitGoal = s >= goal;
            const halfGoal = s >= goal * 0.5;
            return (
              <div key={d} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                <div style={{
                  padding: '10px 4px', borderRadius: 99,
                  background: hitGoal ? '#4ADE8022' : halfGoal ? `${GOLD}22` : isFuture ? '#0F172A' : '#1A0A0A',
                  border: `1px solid ${hitGoal ? '#4ADE80' : halfGoal ? GOLD : isToday ? '#334155' : '#1E293B'}`,
                  color: hitGoal ? '#4ADE80' : halfGoal ? GOLD : isFuture ? '#334155' : '#EF4444',
                  fontSize: 16, fontWeight: 700
                }}>
                  {isFuture ? '' : hitGoal ? '✓' : halfGoal ? '½' : '✗'}
                </div>
                <div style={{ fontSize: 10, color: isToday ? GOLD : '#475569', marginTop: 4 }}>{dayLabel(d)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Income Projection */}
      <IncomeProjectionCard defaultWeeklyGoal={defaultWeeklyConvoGoal} />

      {/* 6. Leaderboard */}
      <div style={{ marginBottom: 16 }}>
        <Leaderboard userEmail={userEmail} userTier={userData.tier} />
      </div>

      {/* 7. Your Why */}
      <div style={{
        borderRadius: 16, padding: 24, marginBottom: 16,
        border: `1px solid ${GOLD}44`, overflow: 'hidden',
        position: 'relative', background: CARD
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {userData.whyPhoto && <img src={userData.whyPhoto} alt="" style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', opacity: 0.15, pointerEvents: 'none'
        }} />}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ color: '#64748B', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Your Why</div>
            <button
              onClick={() => { setEditingWhy(!editingWhy); setWhyDraft(userData.why || ''); }}
              style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18 }}
            >✏️</button>
          </div>

          {editingWhy ? (
            <div>
              <textarea
                value={whyDraft}
                onChange={(e) => setWhyDraft(e.target.value)}
                rows={4}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10,
                  background: '#0B1220', border: `1px solid ${GOLD}`,
                  color: '#fff', fontSize: 15, resize: 'vertical', outline: 'none', boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={saveWhy} style={{ padding: '8px 20px', borderRadius: 8, background: GOLD, color: '#000', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Save</button>
                <button onClick={() => setEditingWhy(false)} style={{ padding: '8px 20px', borderRadius: 8, background: '#1E293B', color: '#94A3B8', border: 'none', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ color: GOLD_LIGHT, fontSize: 18, fontStyle: 'italic', lineHeight: 1.65, fontWeight: 600 }}>
              &ldquo;{userData.why || 'Your why will appear here.'}&rdquo;
            </div>
          )}

          <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 10, background: 'rgba(0,0,0,0.4)', border: '1px solid #1E293B' }}>
            <div style={{ color: '#475569', fontSize: 12, marginBottom: 4 }}>Daily reminder</div>
            <div style={{ color: '#94A3B8', fontSize: 14, fontStyle: 'italic' }}>&ldquo;{QUOTES[quoteIdx]}&rdquo;</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────

export default function DailyDrive({ email, tier }) {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const normEmail = (email || '').toLowerCase().trim();

  useEffect(() => {
    if (!normEmail) { setLoading(false); return; }
    fetch(`/api/daily-drive?email=${encodeURIComponent(normEmail)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setUserData(d.user);
        else setError(d.error || 'Failed to load');
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, [normEmail]);

  const handleOnboardingComplete = async ({ why, whyPhoto }) => {
    const res = await fetch('/api/daily-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normEmail, action: 'complete-onboarding', why, whyPhoto, tier })
    });
    const d = await res.json();
    if (d.ok) setUserData(d.user);
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
        Loading Daily Drive...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, borderRadius: 12, background: '#1F0A0A', border: '1px solid #7F1D1D', color: '#FECACA' }}>
        {error}
      </div>
    );
  }

  if (!normEmail) {
    return (
      <div style={{ padding: 24, color: '#64748B' }}>No email found for session.</div>
    );
  }

  if (!userData || !userData.onboardingComplete) {
    return (
      <DailyDriveOnboarding
        tier={userData?.tier || tier || 'licensed_agent'}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  return (
    <>
      <style>{`
        @keyframes dd-pulse {
          0% { transform: scale(1); }
          40% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        .dd-pulse { animation: dd-pulse 0.35s ease-out; }
      `}</style>
      <DailyDriveDashboard
        userData={userData}
        userEmail={normEmail}
        onUpdate={setUserData}
      />
    </>
  );
}
