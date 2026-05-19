'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

const PODCAST_EMBED = 'https://www.iheart.com/podcast/334111550/?embed=true';
const STORAGE_KEY   = 'll_podcast_popup_v1';
const LISTEN_SECS   = 10;   // seconds of detected play before dismissing
const DISMISS_DAYS  = 7;    // days before popup returns (next episode window)
const GOLD          = '#C8A96B';
const DARK          = '#0b1020';

export default function PodcastPopup() {
  const [visible,   setVisible]   = useState(false);
  const [phase,     setPhase]     = useState('idle');      // idle | listening | done
  const [countdown, setCountdown] = useState(LISTEN_SECS);
  const iframeRef  = useRef(null);
  const timerRef   = useRef(null);
  const phaseRef   = useRef(phase);
  phaseRef.current = phase;

  // Decide whether to show on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { listenedAt } = JSON.parse(raw);
        const daysSince = (Date.now() - listenedAt) / 86400000;
        if (daysSince < DISMISS_DAYS) return; // within 7-day window — stay hidden
      }
    } catch { /* first time or corrupt storage — show it */ }
    // Small delay so the page finishes rendering first
    const t = setTimeout(() => setVisible(true), 900);
    return () => clearTimeout(t);
  }, []);

  // Detect iframe click via window blur — fires when user clicks inside the embed
  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (
        phaseRef.current === 'idle' &&
        document.activeElement &&
        document.activeElement.tagName === 'IFRAME'
      ) {
        setPhase('listening');
      }
    }, 80);
  }, []);

  useEffect(() => {
    if (!visible) return;
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [visible, handleBlur]);

  // 10-second countdown once listening starts
  useEffect(() => {
    if (phase !== 'listening') return;
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setPhase('done');
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ listenedAt: Date.now() }));
          } catch { /* ignore */ }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // No auto-close — user picks Continue Listening or Listen Later

  function skipForNow() {
    // Closes but DOES NOT save — will show again on next refresh
    setVisible(false);
  }

  if (!visible) return null;

  const pct    = phase === 'done' ? 100 : phase === 'listening' ? Math.round(((LISTEN_SECS - countdown) / LISTEN_SECS) * 100) : 0;
  const isDone = phase === 'done';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px',
      backdropFilter: 'blur(4px)',
      animation: 'll_fade_in .3s ease',
    }}>
      <style>{`
        @keyframes ll_fade_in { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes ll_pulse   { 0%,100% { opacity: 1; } 50% { opacity: .6; } }
      `}</style>

      <div style={{
        width: '100%', maxWidth: 540,
        background: 'linear-gradient(160deg,#0f172a 0%,#0b1020 100%)',
        border: `1px solid ${GOLD}55`,
        borderRadius: 18,
        boxShadow: `0 24px 60px rgba(0,0,0,.7), 0 0 0 1px ${GOLD}22 inset`,
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${GOLD}22`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 26 }}>🎙️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9', lineHeight: 1.2 }}>New Episode — The Legacy Link Podcast</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Hosted by Kimora Link · iHeart Radio</div>
          </div>
          <button
            onClick={skipForNow}
            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '4px 6px' }}
            title="Skip for now"
          >×</button>
        </div>

        {/* Embed */}
        <div style={{ padding: '14px 16px 10px' }}>
          <iframe
            ref={iframeRef}
            allow="autoplay"
            width="100%"
            height="300"
            src={PODCAST_EMBED}
            frameBorder="0"
            style={{ borderRadius: 10, display: 'block', border: 0 }}
            title="The Legacy Link Podcast"
          />
        </div>

        {/* Status bar */}
        <div style={{ padding: '10px 20px 18px' }}>
          {/* Progress track */}
          <div style={{ height: 4, background: '#1e2d42', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{
              height: '100%', borderRadius: 999,
              width: `${pct}%`,
              background: isDone ? '#4ade80' : GOLD,
              transition: 'width .9s linear, background .4s',
            }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
              {isDone ? (
                <span style={{ color: '#4ade80', fontWeight: 700 }}>✓ Saved — see you next episode!</span>
              ) : phase === 'listening' ? (
                <span style={{ color: GOLD, animation: 'll_pulse 1.4s ease infinite' }}>
                  🎧 Listening… {countdown}s remaining
                </span>
              ) : (
                <span>Hit play in the player above to unlock.</span>
              )}
            </div>

            {isDone ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setVisible(false)}
                  style={{ background: GOLD, border: 'none', color: DARK, borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  🎧 Continue Listening
                </button>
                <button
                  onClick={() => setVisible(false)}
                  style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Listen Later
                </button>
              </div>
            ) : (
              <button
                onClick={skipForNow}
                style={{ background: 'none', border: '1px solid #334155', color: '#475569', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Skip for now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
