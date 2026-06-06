'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const C = {
  gold: '#B28147',
  goldBright: '#D4A24A',
  goldLight: '#E6C97F',
  goldDark: '#8A6234',
  ink: '#0A0A0A',
  inkSoft: '#1A1410',
  cream: '#FAF8F2',
  paper: '#FFFFFF',
  line: '#E5DFCF',
  lineSoft: '#F0EADB',
  text: '#1A1410',
  textMuted: '#6B6357',
  textFaint: '#9C9486',
  success: '#437A22',
  successBg: '#ECF5E0',
  overdue: '#A12C7B',
  overdueBg: '#FBE9F3',
};

const TOKEN_KEY = 'start_portal_token_v1';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysSince(isoDate) {
  if (!isoDate) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24)));
}

const OWNER_LABEL = {
  'YOU DO': 'Your action',
  'WE DO': 'We handle it',
  'WE GUIDE': 'We guide you',
  'WE PAY': 'We pay you',
  'CARRIER': 'Carrier action',
};

function ownerColor(owner) {
  if (owner === 'YOU DO' || owner === 'WE GUIDE') return C.goldDark;
  return C.textMuted;
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const [state, setState] = useState({ status: 'loading' });
  const [agent, setAgent] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [homework, setHomework] = useState(null);
  const [book, setBook] = useState(null);
  const [filter, setFilter] = useState('all');
  const [drawer, setDrawer] = useState(null); // { entry } or null
  const [hwYoutube, setHwYoutube] = useState('');
  const [hwNote, setHwNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) { setState({ status: 'auth' }); return; }

    try {
      const res = await fetch('/api/onboarding/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) { setState({ status: 'auth' }); return; }
      if (res.status === 404) { setState({ status: 'not_found' }); return; }
      if (!res.ok) throw new Error('server_error');
      const data = await res.json();
      setAgent(data.agent);
      setChecklist(data.checklist || []);
      setHomework(data.homework);
      setBook(data.book);
      setState({ status: 'ok' });
    } catch {
      setState({ status: 'error' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Stats ──────────────────────────────────────────────────────────────────
  const coreEntries = checklist.filter(e => !e.item.recurring && e.visible);
  const done = coreEntries.filter(e => e.checked).length;
  const total = coreEntries.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const dayN = agent ? daysSince(agent.start_date) : 0;

  // ─── Filtered view ───────────────────────────────────────────────────────────
  const visibleEntries = checklist.filter(e => e.visible);
  const filteredEntries = visibleEntries.filter(e => {
    if (filter === 'done') return e.checked;
    if (filter === 'open') return !e.checked;
    if (filter === 'mine') return e.can_check && !e.checked;
    if (filter === 'overdue') return e.is_overdue;
    return true;
  });

  const coreFiltered = filteredEntries.filter(e => !e.item.recurring);
  const recurringFiltered = filteredEntries.filter(e => e.item.recurring);

  // ─── Actions ─────────────────────────────────────────────────────────────────
  async function toggleItem(itemId, checked) {
    const token = localStorage.getItem(TOKEN_KEY);
    setSaving(true);
    try {
      const res = await fetch('/api/onboarding/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id: itemId, checked })
      });
      if (!res.ok) throw new Error();
      // Optimistic update
      setChecklist(prev => prev.map(e =>
        e.item.id === itemId
          ? { ...e, checked, checked_at: checked ? new Date().toISOString() : null, checked_by: checked ? agent.email : null }
          : e
      ));
      setDrawer(null);
      showToast(checked ? 'Marked complete ✓' : 'Unmarked');
    } catch {
      showToast('Error saving. Try again.', 'error');
    }
    setSaving(false);
  }

  async function submitHomework() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!hwYoutube.trim()) { showToast('YouTube URL is required', 'error'); return; }
    setSaving(true);
    try {
      await fetch('/api/onboarding/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ youtube_url: hwYoutube, weekly_note: hwNote })
      });
      setHomework({ youtube_url: hwYoutube, weekly_note: hwNote, submitted_at: new Date().toISOString() });
      setDrawer(null);
      showToast('Homework submitted ✓');
    } catch {
      showToast('Error submitting', 'error');
    }
    setSaving(false);
  }

  async function completeBook() {
    const token = localStorage.getItem(TOKEN_KEY);
    setSaving(true);
    try {
      await fetch('/api/onboarding/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ completed: true })
      });
      setBook({ completed: true, completed_at: new Date().toISOString() });
      setDrawer(null);
      showToast("This month's book marked complete ✓");
    } catch {
      showToast('Error saving', 'error');
    }
    setSaving(false);
  }

  // ─── States ───────────────────────────────────────────────────────────────────
  if (state.status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.textMuted, fontFamily: 'Inter, sans-serif', fontSize: 15 }}>Loading your playbook…</div>
      </div>
    );
  }

  if (state.status === 'auth') {
    return (
      <div style={{ minHeight: '100vh', background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 22, fontWeight: 700, color: C.goldBright, marginBottom: 12 }}>The Legacy Link</div>
          <p style={{ color: C.textFaint, fontFamily: 'Inter, sans-serif', marginBottom: 24 }}>Sign in to access your onboarding tracker.</p>
          <a href="/start" style={{ display: 'inline-block', padding: '12px 28px', background: C.gold, color: C.ink, borderRadius: 8, fontWeight: 700, fontFamily: 'DM Sans, sans-serif', textDecoration: 'none' }}>
            Sign In
          </a>
        </div>
      </div>
    );
  }

  if (state.status === 'not_found') {
    return (
      <div style={{ minHeight: '100vh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 12 }}>No tracker found</div>
          <p style={{ color: C.textMuted }}>You don't have an onboarding tracker yet. Contact <a href="mailto:support@thelegacylink.com" style={{ color: C.gold }}>support@thelegacylink.com</a> to get set up.</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div style={{ minHeight: '100vh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ color: C.overdue, fontFamily: 'Inter, sans-serif' }}>Something went wrong. <button onClick={load} style={{ color: C.gold, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Retry</button></div>
      </div>
    );
  }

  const tierLabel = agent.tier === 'elite' ? 'Inner Circle Elite' : 'Inner Circle';
  const tierIsElite = agent.tier === 'elite';

  // ─── Main render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Google fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

      <div style={{ minHeight: '100vh', background: C.cream, fontFamily: 'Inter, -apple-system, sans-serif', color: C.text }}>

        {/* ─── Topbar ─── */}
        <div style={{ background: C.ink, borderBottom: `2px solid ${C.gold}` }}>
          <div style={{ maxWidth: 880, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/onboarding-logo.png" alt="Legacy Link Seal" style={{ width: 44, height: 44, objectFit: 'contain' }} />
              <div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 16, letterSpacing: '0.02em', color: C.goldBright }}>
                  The Legacy Link
                </div>
                <div style={{ fontSize: 11, color: C.textFaint, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Onboarding Tracker
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 500, color: C.cream }}>
              <span>{agent.first_name} {agent.last_name}</span>
              <span style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 11, fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: 99,
                background: tierIsElite ? `linear-gradient(135deg, ${C.goldBright}, ${C.goldLight})` : C.gold,
                color: C.ink
              }}>
                {tierIsElite ? 'Elite' : 'Inner Circle'}
              </span>
            </div>
          </div>
        </div>

        {/* ─── Container ─── */}
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '28px 24px 80px' }}>

          {/* ─── Hero card ─── */}
          <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 12, padding: 28, boxShadow: '0 4px 12px rgba(10,10,10,0.06)', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.goldDark, marginBottom: 6 }}>
                  Your Onboarding Playbook
                </div>
                <h1 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 28, fontWeight: 700, margin: '0 0 6px', color: C.ink, lineHeight: 1.15 }}>
                  {pct === 0 ? `Welcome, ${agent.first_name}. Let's build.` :
                    pct >= 95 ? `Onboarded. Welcome to the operator class.` :
                    `Welcome back, ${agent.first_name}.`}
                </h1>
                <p style={{ margin: 0, color: C.textMuted, fontSize: 15 }}>
                  {tierLabel} · Started {fmtDate(agent.start_date)} · Day {dayN}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { num: done, label: 'Complete' },
                  { num: total - done, label: 'Remaining' },
                  { num: dayN, label: 'Day' }
                ].map(({ num, label }) => (
                  <div key={label} style={{ textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 28, fontWeight: 700, color: C.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{num}</div>
                    <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textFaint, marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div style={{ height: 10, background: C.lineSoft, borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.goldDark}, ${C.goldBright})`, borderRadius: 99, transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 13 }}>
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, color: C.goldDark }}>{pct}% Complete</span>
                <span style={{ color: C.textMuted }}>
                  {pct === 0 ? 'Start with item 1.' :
                    pct < 30 ? 'Foundation phase. Keep moving.' :
                    pct < 70 ? 'Momentum building. Stay disciplined.' :
                    pct < 95 ? 'Almost fully producing. Finish strong.' :
                    'Fully producing. Lead by example.'}
                </span>
              </div>
            </div>
          </div>

          {/* ─── Filter row ─── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
            {[
              { key: 'all', label: 'All' },
              { key: 'open', label: 'Open' },
              { key: 'done', label: 'Done' },
              { key: 'mine', label: 'My Action' },
              { key: 'overdue', label: 'Overdue' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '8px 14px',
                  borderRadius: 99,
                  border: `1px solid ${filter === key ? C.ink : C.line}`,
                  background: filter === key ? C.ink : C.paper,
                  color: filter === key ? C.goldBright : C.textMuted,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s'
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ─── Core checklist ─── */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 4px', letterSpacing: '0.01em' }}>
              Core Onboarding Steps
            </h2>
            <p style={{ margin: '0 0 14px', color: C.textMuted, fontSize: 13 }}>Items 1–19 · Milestone path from Day 0 to producing</p>
            <ChecklistItems
              entries={coreFiltered}
              agent={agent}
              onOpen={entry => { setDrawer({ entry }); setHwYoutube(''); setHwNote(''); }}
            />
          </div>

          {/* ─── Recurring section ─── */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 18, fontWeight: 700, color: C.goldDark, margin: '0 0 4px', letterSpacing: '0.01em' }}>
              Recurring Commitments
            </h2>
            <p style={{ margin: '0 0 14px', color: C.textMuted, fontSize: 13 }}>Items 20–21 · Weekly homework + monthly reading</p>
            <ChecklistItems
              entries={recurringFiltered}
              agent={agent}
              onOpen={entry => { setDrawer({ entry }); setHwYoutube(homework?.youtube_url || ''); setHwNote(homework?.weekly_note || ''); }}
            />
          </div>

          {/* ─── Footer ─── */}
          <div style={{ textAlign: 'center', marginTop: 40, fontSize: 12, color: C.textFaint, fontFamily: 'Inter, sans-serif' }}>
            <div>The Legacy Link · 340 Old River Road, Edgewater, NJ 07020 · 201-862-7040</div>
            <div style={{ fontStyle: 'italic', marginTop: 6, color: C.textFaint }}>Individual results vary. Income is not guaranteed.</div>
          </div>
        </div>
      </div>

      {/* ─── Item Drawer ─── */}
      {drawer && (
        <ItemDrawer
          entry={drawer.entry}
          agent={agent}
          homework={homework}
          book={book}
          hwYoutube={hwYoutube}
          hwNote={hwNote}
          setHwYoutube={setHwYoutube}
          setHwNote={setHwNote}
          saving={saving}
          onClose={() => setDrawer(null)}
          onToggle={toggleItem}
          onSubmitHomework={submitHomework}
          onCompleteBook={completeBook}
        />
      )}

      {/* ─── Toast ─── */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'error' ? C.overdue : C.ink,
          color: toast.type === 'error' ? '#fff' : C.goldBright,
          padding: '12px 24px',
          borderRadius: 8,
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: 600,
          fontSize: 14,
          boxShadow: '0 8px 24px rgba(10,10,10,0.2)',
          zIndex: 999,
          pointerEvents: 'none'
        }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}

// ─── ChecklistItems component ─────────────────────────────────────────────────
function ChecklistItems({ entries, agent, onOpen }) {
  if (!entries.length) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#9C9486', fontSize: 13, background: '#FFFFFF', border: '1px dashed #E5DFCF', borderRadius: 8 }}>
        No items match this filter.
      </div>
    );
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map(entry => {
        const { item, checked, is_overdue, can_check } = entry;
        const locked = !can_check && !checked;
        const bg = checked ? C.successBg : (is_overdue ? C.overdueBg : (item.elite_only ? 'linear-gradient(135deg, rgba(178,129,71,0.04), rgba(178,129,71,0.01))' : C.paper));
        const borderColor = checked ? '#C5DEAF' : (is_overdue ? C.overdue : (item.elite_only ? C.goldLight : C.line));

        return (
          <li
            key={item.id}
            onClick={() => onOpen(entry)}
            style={{
              background: bg,
              border: `1px solid ${borderColor}`,
              borderRadius: 8,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              cursor: locked && !checked ? 'default' : 'pointer',
              boxShadow: '0 1px 2px rgba(10,10,10,0.04)',
              transition: 'all 0.18s',
              opacity: locked && !checked ? 0.78 : 1
            }}
          >
            {/* Checkmark */}
            <div style={{
              width: 26, height: 26, borderRadius: 6, flexShrink: 0,
              border: `2px solid ${checked ? C.success : (locked ? C.line : C.line)}`,
              background: checked ? C.success : (locked ? C.lineSoft : C.paper),
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {checked && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {locked && !checked && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textFaint} strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
            </div>

            {/* Item number */}
            <div style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 700,
              color: checked ? C.success : C.goldDark,
              background: checked ? 'rgba(67,122,34,0.12)' : 'rgba(178,129,71,0.10)',
              padding: '3px 7px', borderRadius: 4, letterSpacing: '0.04em',
              flexShrink: 0, minWidth: 28, textAlign: 'center'
            }}>
              {String(item.id).padStart(2, '0')}
            </div>

            {/* Main */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 600, fontSize: 15,
                color: checked ? '#2F5817' : C.text,
                margin: '0 0 2px', lineHeight: 1.3,
                textDecoration: checked ? 'line-through' : 'none',
                textDecorationColor: 'rgba(67,122,34,0.3)'
              }}>
                {item.title}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: C.textMuted, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 500, color: ownerColor(item.owner) }}>
                  {OWNER_LABEL[item.owner] || item.owner}
                </span>
                {item.recurring ? (
                  <span style={{ color: C.textFaint }}>Every {item.target_day_end === 7 ? 'week' : 'month'}</span>
                ) : item.target_day_end ? (
                  <span style={{ color: C.textFaint }}>Days {item.target_day_start}–{item.target_day_end}</span>
                ) : null}
                {is_overdue && (
                  <span style={{ color: C.overdue, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', fontSize: 11 }}>
                    Overdue
                  </span>
                )}
                {item.elite_only && (
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.ink, background: C.goldBright, padding: '2px 6px', borderRadius: 3 }}>
                    Elite
                  </span>
                )}
              </div>
            </div>

            {/* Chevron */}
            <div style={{ color: C.textFaint, fontSize: 18, flexShrink: 0 }}>›</div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Item drawer ──────────────────────────────────────────────────────────────
function ItemDrawer({ entry, agent, homework, book, hwYoutube, hwNote, setHwYoutube, setHwNote, saving, onClose, onToggle, onSubmitHomework, onCompleteBook }) {
  const { item, checked, checked_at, checked_by, is_overdue, can_check } = entry;
  const isHw = item.id === 20;
  const isBook = item.id === 21;
  const locked = !can_check;

  // Close on escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function targetText() {
    if (item.recurring) return `Recurring: Every ${item.target_day_end === 7 ? 'week' : 'month'}`;
    if (item.target_day_end) return `Target window: Days ${item.target_day_start}–${item.target_day_end} from start`;
    return '';
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'auto' }}>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,10,0.45)' }}
      />

      {/* Panel */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: 440,
        background: C.paper,
        boxShadow: '0 12px 32px rgba(10,10,10,0.10)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.28s cubic-bezier(0.4,0,0.2,1)'
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 12, right: 14, background: 'transparent', border: 0, fontSize: 28, lineHeight: 1, color: C.textMuted, cursor: 'pointer', padding: '4px 10px', borderRadius: 6 }}
        >
          ×
        </button>

        {/* Body */}
        <div style={{ padding: '56px 28px 28px', overflowY: 'auto', flex: 1, fontFamily: 'Inter, sans-serif' }}>
          {/* Meta pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '4px 10px', borderRadius: 99,
              background: C.cream, color: C.textMuted, border: `1px solid ${C.line}`
            }}>
              {item.owner}
            </span>
            {item.elite_only && (
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 99, background: C.goldBright, color: C.ink, border: `1px solid ${C.gold}` }}>
                Elite
              </span>
            )}
            {item.pif_only && (
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 99, background: C.goldBright, color: C.ink, border: `1px solid ${C.gold}` }}>
                Paid In Full
              </span>
            )}
          </div>

          {/* Title */}
          <h2 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 22, fontWeight: 700, color: C.ink, margin: '0 0 12px', lineHeight: 1.2 }}>
            {item.title}
          </h2>

          {/* Description */}
          <p style={{ color: C.textMuted, fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
            {item.description}
          </p>

          {/* Target window */}
          {targetText() && (
            <div style={{ background: C.lineSoft, padding: '12px 14px', borderRadius: 8, fontSize: 13, color: C.textMuted, marginBottom: 20 }}>
              <strong style={{ color: C.text }}>{targetText().split(':')[0]}:</strong> {targetText().split(':').slice(1).join(':')}
            </div>
          )}

          {/* ─── Homework form (item 20) ─── */}
          {isHw && (
            <div style={{ marginBottom: 20 }}>
              {homework?.submitted_at && (
                <div style={{ background: C.successBg, border: `1px solid #C5DEAF`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#2F5817' }}>
                  ✓ Submitted this week — {fmtDate(homework.submitted_at)}
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>YouTube Comment URL</label>
                <input
                  type="url"
                  value={hwYoutube}
                  onChange={e => setHwYoutube(e.target.value)}
                  placeholder="https://youtube.com/..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.line}`, background: C.paper, fontSize: 14, fontFamily: 'Inter, sans-serif', color: C.text, boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>What you're learning & implementing this week</label>
                <textarea
                  value={hwNote}
                  onChange={e => setHwNote(e.target.value)}
                  placeholder="Write your takeaways here…"
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.line}`, background: C.paper, fontSize: 14, fontFamily: 'Inter, sans-serif', color: C.text, resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <button
                onClick={onSubmitHomework}
                disabled={saving}
                style={{ width: '100%', padding: '12px 18px', borderRadius: 8, border: 0, background: C.ink, color: C.goldBright, fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Submitting…' : 'Submit Homework'}
              </button>
            </div>
          )}

          {/* ─── Book completion (item 21) ─── */}
          {isBook && (
            <div style={{ marginBottom: 20 }}>
              {book?.completed ? (
                <div style={{ background: C.successBg, border: `1px solid #C5DEAF`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#2F5817' }}>
                  ✓ This month's book marked complete — {fmtDate(book.completed_at)}
                </div>
              ) : (
                <button
                  onClick={onCompleteBook}
                  disabled={saving}
                  style={{ width: '100%', padding: '12px 18px', borderRadius: 8, border: 0, background: C.success, color: '#fff', fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Saving…' : "Mark This Month's Book Complete"}
                </button>
              )}
            </div>
          )}

          {/* ─── Standard check/uncheck actions ─── */}
          {!isHw && !isBook && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {checked ? (
                <button
                  onClick={() => !locked && onToggle(item.id, false)}
                  disabled={locked || saving}
                  style={{
                    padding: '12px 18px', borderRadius: 8, border: `1px solid ${C.line}`,
                    background: C.cream, color: C.text,
                    fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600, cursor: locked ? 'default' : 'pointer'
                  }}
                >
                  {locked ? 'Marked complete by team' : 'Mark as not done'}
                </button>
              ) : locked ? (
                <button
                  disabled
                  style={{ padding: '12px 18px', borderRadius: 8, border: 0, background: C.lineSoft, color: C.textFaint, fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600, cursor: 'not-allowed' }}
                >
                  {item.owner === 'CARRIER' ? 'Waiting on carrier' : 'Team will mark complete'}
                </button>
              ) : (
                <button
                  onClick={() => onToggle(item.id, true)}
                  disabled={saving}
                  style={{ padding: '12px 18px', borderRadius: 8, border: 0, background: C.success, color: '#fff', fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Saving…' : 'Mark as Complete'}
                </button>
              )}
            </div>
          )}

          {/* Status info */}
          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 16, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: C.textMuted }}>
              <span>Status</span>
              <span style={{ color: C.text, fontWeight: 500 }}>
                {checked ? 'Complete' : (is_overdue ? 'Overdue' : 'Open')}
              </span>
            </div>
            {checked && checked_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: C.textMuted }}>
                <span>Completed</span>
                <span style={{ color: C.text, fontWeight: 500 }}>{fmtDate(checked_at)}</span>
              </div>
            )}
            {checked && checked_by && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: C.textMuted }}>
                <span>Marked by</span>
                <span style={{ color: C.text, fontWeight: 500 }}>{checked_by}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
