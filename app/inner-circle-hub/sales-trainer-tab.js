'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import React from 'react';

const BG = '#0E131B';
const GOLD = '#c8a96b';
const CARD = '#141B27';
const CARD2 = '#1A2236';
const TEXT = '#F2F2F2';
const MUTED = '#7B8494';
const BORDER = 'rgba(200,169,107,0.2)';
const DANGER = '#F87171';
const GREEN = '#4ade80';

const PERSONAS = [
  {
    id: 'tanya',
    name: 'Tanya',
    age: 28,
    occupation: 'Nurse',
    track: 'iul_sales',
    difficulty: 'warm',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    backstory:
      'Single mom of 2 kids. Works night shifts at a regional hospital. Her coworker Brenda got an IUL — she has ~$200/month but is cautious after a bad variable annuity.',
  },
  {
    id: 'devon',
    name: 'Devon',
    age: 31,
    occupation: 'Amazon Warehouse Worker',
    track: 'iul_sales',
    difficulty: 'skeptical',
    voiceId: 'TxGEqnHWrfWFTfGW9XjX',
    backstory:
      "Makes ~$19/hr. Girlfriend is 7 months pregnant. No life insurance, minimal savings. Saw a TikTok about IUL but thinks it sounds too good to be true.",
  },
  {
    id: 'patricia',
    name: 'Patricia',
    age: 52,
    occupation: 'Retired Teacher',
    track: 'iul_sales',
    difficulty: 'cold',
    voiceId: 'XrExE9yKIg1WjnnlVkGX',
    backstory:
      "Taught 28 years, retired with state pension. Had a terrible experience with a door-to-door insurance salesman. Protective of her money but loves her 3 grandchildren.",
  },
  {
    id: 'marcus',
    name: 'Marcus',
    age: 26,
    occupation: 'Uber/Lyft Driver',
    track: 'recruiting',
    difficulty: 'warm',
    voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
    backstory:
      'Works 50-60 hrs/week, Camry has 180K miles. No benefits or retirement. Saw a YouTube video about financial freedom. Dropped out of community college. Hungry for something better.',
  },
  {
    id: 'keisha',
    name: 'Keisha',
    age: 34,
    occupation: 'Corporate HR Manager',
    track: 'recruiting',
    difficulty: 'skeptical',
    voiceId: 'AZnzlk1XvdvUeBnXmlld',
    backstory:
      "HR Manager, $75K, master's degree. Lost money with Amway and Herbalife. Friend from church mentioned the opportunity. Very wary of MLMs — asks pointed questions.",
  },
  {
    id: 'ray',
    name: 'Ray',
    age: 45,
    occupation: 'Construction Foreman',
    track: 'recruiting',
    difficulty: 'cold',
    voiceId: 'nPczCjzI2devNBz1zQrb',
    backstory:
      "25 years in construction, $85K. Wife Angela made him call. Thinks it's nonsense. Bad knees and back he won't admit to. No retirement savings. Oldest kid just started college.",
  },
];

const TRACKS = [
  { key: 'iul_sales', label: 'IUL Sales' },
  { key: 'recruiting', label: 'Agent Recruiting' },
];

const DIFFICULTIES = [
  { key: 'warm', label: 'Warm Lead', color: GREEN, lockAfter: 0 },
  { key: 'skeptical', label: 'Skeptical', color: GOLD, lockAfter: 3 },
  { key: 'cold', label: 'Cold', color: DANGER, lockAfter: 3 },
];

function gradeColor(g) {
  if (g === 'A') return GREEN;
  if (g === 'B') return GOLD;
  if (g === 'C') return '#facc15';
  if (g === 'D') return '#f97316';
  return DANGER;
}

function getLevelLabel(progress) {
  if (progress?.certifiedAt) return 'Certified';
  const lvl = progress?.currentLevel || 1;
  if (lvl >= 3) return 'Cold Unlocked';
  if (lvl >= 2) return 'Skeptical Unlocked';
  return 'Warm Only';
}

function isUnlocked(difficulty, progress) {
  if (difficulty === 'warm') return true;
  const lvl = progress?.currentLevel || 1;
  if (difficulty === 'skeptical') return lvl >= 2;
  if (difficulty === 'cold') return lvl >= 3;
  return false;
}

export default function SalesTrainerTab({ member }) {
  const [screen, setScreen] = useState('home');
  const [selectedTrack, setSelectedTrack] = useState('iul_sales');
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [score, setScore] = useState(null);
  const [progress, setProgress] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isScoring, setIsScoring] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const callTimerRef = useRef(null);
  const sessionIdRef = useRef(null);
  const prospectMsgCountRef = useRef(0);

  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const accumulatedRef = useRef('');
  const isVoiceActiveRef = useRef(false);
  const startListeningRef = useRef(null);
  const sendMessageRef = useRef(null);

  const email = member?.email || '';
  const agentName = member?.applicantName || member?.name || 'Agent';

  // Fetch progress + leaderboard on mount
  useEffect(() => {
    if (email) {
      fetch(`/api/sales-trainer-progress?email=${encodeURIComponent(email)}`)
        .then((r) => r.json())
        .then((d) => setProgress(d))
        .catch(() => {});
    }
    fetch('/api/sales-trainer-leaderboard')
      .then((r) => r.json())
      .then((d) => setLeaderboard(d.rows || []))
      .catch(() => {});
  }, [email]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, isTyping]);

  const browserTTS = useCallback((text) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.95;
      window.speechSynthesis.speak(utt);
    }
  }, []);

  // TTS via ElevenLabs or browser fallback — declared before sendMessage/startSession
  const playTTS = useCallback(async (text, personaId) => {
    try {
      const msgIndex = prospectMsgCountRef.current++;
      const res = await fetch('/api/sales-trainer-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          personaName: personaId,
          sessionId: sessionIdRef.current,
          messageIndex: msgIndex,
        }),
      });

      if (res.headers.get('Content-Type')?.includes('audio')) {
        // Capture blob recording URL if saved
        const recordingUrl = res.headers.get('X-Recording-URL');
        if (recordingUrl) {
          setTranscript(prev => {
            const updated = [...prev];
            // Tag the last prospect message with the recording URL
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i].role === 'prospect') {
                updated[i] = { ...updated[i], audioUrl: recordingUrl };
                break;
              }
            }
            return updated;
          });
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.pause();
          URL.revokeObjectURL(audioRef.current.src);
        }
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.play().catch(() => {});
        return;
      }

      const data = await res.json();
      if (data.fallback) {
        browserTTS(text);
      }
    } catch {
      browserTTS(text);
    }
  }, [browserTTS]);

  // Send a message and get AI reply
  const sendMessage = useCallback(
    async (content) => {
      if (!content?.trim() || !selectedPersona) return;

      const agentMsg = { role: 'agent', content: content.trim() };
      setTranscript((prev) => [...prev, agentMsg]);
      setIsTyping(true);

      try {
        // Build message history using functional state update to always get latest
        const history = [...transcript, agentMsg];
        const res = await fetch('/api/sales-trainer-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personaId: selectedPersona.id,
            messages: history,
          }),
        });
        const data = await res.json();
        // Surface real API errors instead of silent fallback
        const reply = data.reply || (data.error ? `[Error: ${data.error}]` : "I'm not sure about that.");
        const prospectMsg = { role: 'prospect', content: reply };
        setTranscript((prev) => [...prev, prospectMsg]);

        if (!isMuted && data.reply) {
          await playTTS(reply, selectedPersona.id);
        }

        // Always restart mic after AI responds (if voice mode is on)
        if (voiceMode) {
          isVoiceActiveRef.current = true;
          setTimeout(() => startListeningRef.current?.(), 800);
        }
      } catch (err) {
        setTranscript((prev) => [
          ...prev,
          { role: 'prospect', content: `[Network error: ${err?.message || 'unknown'}]` },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [selectedPersona, transcript, isMuted, playTTS]
  );

  // Keep sendMessageRef in sync so voice recognition always calls the latest version
  sendMessageRef.current = sendMessage;

  // Start a training session
  const startSession = useCallback(
    async (persona) => {
      setSelectedPersona(persona);
      setTranscript([]);
      setScore(null);
      setCallSeconds(0);
      setIsConnecting(true);
      setScreen('training');
      // Generate unique session ID for this call
      sessionIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      prospectMsgCountRef.current = 0;

      // Unlock audio + mic on the user gesture (button click)
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
      }
      if (typeof window !== 'undefined') {
        try { new (window.AudioContext || window.webkitAudioContext)().resume().catch(() => {}); } catch {}
      }

      // Short connecting pause
      await new Promise((r) => setTimeout(r, 1200));
      setIsConnecting(false);

      // Start call timer
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      callTimerRef.current = setInterval(() => setCallSeconds((s) => s + 1), 1000);

      // Tanya picks up — she speaks first
      setIsTyping(true);
      try {
        const res = await fetch('/api/sales-trainer-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personaId: persona.id,
            messages: [{ role: 'agent', content: 'Hello?' }],
          }),
        });
        const data = await res.json();
        const reply = data.reply || 'Hello?';
        setTranscript([{ role: 'prospect', content: reply }]);
        if (!isMuted) await playTTS(reply, persona.id);
        // Auto-start mic after she speaks
        setVoiceMode(true);
        setTimeout(() => startListeningRef.current?.(), 600);
      } catch {
        setTranscript([{ role: 'prospect', content: 'Hello? Who is this?' }]);
        setVoiceMode(true);
        setTimeout(() => startListeningRef.current?.(), 600);
      } finally {
        setIsTyping(false);
      }
    },
    [isMuted, playTTS]
  );

  // Stop call timer when ending session
  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  // End session → go to review
  const endSession = useCallback(async () => {
    stopCallTimer();
    if (transcript.length < 2) {
      stopListening();
      setScreen('home');
      return;
    }
    stopListening();
    setIsScoring(true);
    setScreen('review');

    try {
      const res = await fetch('/api/sales-trainer-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId: selectedPersona.id,
          transcript,
          difficulty: selectedPersona.difficulty,
          track: selectedPersona.track,
        }),
      });
      const data = await res.json();
      setScore(data);

      // Post results
      const passed = data.grade === 'A' || data.grade === 'B';
      if (passed && email) {
        await fetch('/api/sales-trainer-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name: agentName,
            difficulty: selectedPersona.difficulty,
            grade: data.grade,
            score: data.overall,
          }),
        });
        // Refresh progress
        const pRes = await fetch(`/api/sales-trainer-progress?email=${encodeURIComponent(email)}`);
        const pData = await pRes.json();
        setProgress(pData);
      }

      // Post to leaderboard
      if (email && data.overall) {
        const lbRes = await fetch('/api/sales-trainer-leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name: agentName,
            overall: data.overall,
            grade: data.grade,
            difficulty: selectedPersona.difficulty,
            personaName: selectedPersona.name,
          }),
        });
        const lbData = await lbRes.json();
        setLeaderboard(lbData.rows || []);
      }
    } catch {
      setScore({ error: true });
    } finally {
      setIsScoring(false);
    }
  }, [transcript, selectedPersona, email, agentName]);

  // (playTTS and browserTTS moved above sendMessage to avoid TDZ)

  // Voice input — hands-free mode
  const stopListening = useCallback(() => {
    isVoiceActiveRef.current = false;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    setVoiceTranscript('');
    accumulatedRef.current = '';
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported. Use Chrome for voice mode.');
      return;
    }

    // Stop any existing session
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    accumulatedRef.current = '';
    isVoiceActiveRef.current = true;

    recognition.onresult = (event) => {
      if (!isVoiceActiveRef.current) return;
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          accumulatedRef.current += t + ' ';
        } else {
          interim += t;
        }
      }
      setVoiceTranscript(accumulatedRef.current + interim);

      // Reset silence timer — auto-send after 2.5s of silence
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const text = accumulatedRef.current.trim();
        if (text && isVoiceActiveRef.current) {
          accumulatedRef.current = '';
          setVoiceTranscript('');
          silenceTimerRef.current = null;
          // Stop mic fully before sending — prevents AI response from being picked up
          isVoiceActiveRef.current = false;
          try { recognition.stop(); } catch {}
          setIsListening(false);
          sendMessageRef.current?.(text);
        }
      }, 2500);
    };

    recognition.onend = () => {
      // If voice mode still active and no pending send, restart
      if (isVoiceActiveRef.current && !silenceTimerRef.current) {
        setTimeout(() => {
          if (isVoiceActiveRef.current) startListeningRef.current?.();
        }, 300);
      }
    };

    recognition.onerror = (e) => {
      if (e.error === 'no-speech' && isVoiceActiveRef.current) {
        // Restart on no-speech — just means silence
        setTimeout(() => {
          if (isVoiceActiveRef.current) startListeningRef.current?.();
        }, 500);
        return;
      }
      if (e.error !== 'aborted') {
        console.error('Speech recognition error:', e.error);
        setIsListening(false);
        isVoiceActiveRef.current = false;
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  // Keep ref in sync so sendMessage can call startListening without circular dep
  startListeningRef.current = startListening;

  // ─── RENDER ────────────────────────────────────────────────────────────────

  if (screen === 'training') {
    return <TrainingScreen
      persona={selectedPersona}
      transcript={transcript}
      isTyping={isTyping}
      isListening={isListening}
      voiceTranscript={voiceTranscript}
      voiceMode={voiceMode}
      isMuted={isMuted}
      chatEndRef={chatEndRef}
      callSeconds={callSeconds}
      isConnecting={isConnecting}
      onEndSession={endSession}
      onToggleVoice={() => {
        if (voiceMode && isListening) {
          setVoiceMode(false);
          stopListening();
        } else {
          setVoiceMode(true);
          startListening();
        }
      }}
      onToggleMute={() => {
        setIsMuted((m) => {
          if (!m && audioRef.current) audioRef.current.pause();
          if (!m && typeof window !== 'undefined') window.speechSynthesis?.cancel();
          return !m;
        });
      }}
    />;
  }

  if (screen === 'review') {
    return <ReviewScreen
      score={score}
      isScoring={isScoring}
      persona={selectedPersona}
      progress={progress}
      leaderboard={leaderboard}
      transcript={transcript}
      onTrainAgain={() => setScreen('home')}
      onResumeSession={() => setScreen('training')}
    />;
  }

  // HOME
  const trackPersonas = PERSONAS.filter((p) => p.track === selectedTrack);

  return (
    <div style={{ background: BG, padding: '16px', fontFamily: 'sans-serif', color: TEXT }}>
      {/* Compact header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>📞 AI Sales Trainer</div>
          {progress && (
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
              {getLevelLabel(progress)} &nbsp;·&nbsp; Warm: {progress.warmCompleted || 0} &nbsp;·&nbsp; Skeptical: {progress.skepticalCompleted || 0} &nbsp;·&nbsp; Cold: {progress.coldCompleted || 0}
            </div>
          )}
        </div>
        {/* Track tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {TRACKS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSelectedTrack(t.key)}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 12,
                background: selectedTrack === t.key ? GOLD : CARD2,
                color: selectedTrack === t.key ? '#0E131B' : MUTED,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty sections — compact 2-col grid */}
      {DIFFICULTIES.map((diff) => {
        const personas = trackPersonas.filter((p) => p.difficulty === diff.key);
        const unlocked = isUnlocked(diff.key, progress);
        const neededFor = diff.key === 'skeptical' ? 'Warm' : 'Skeptical';

        return (
          <div key={diff.key} style={{ marginBottom: 14 }}>
            {/* Section label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: diff.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{diff.label}</span>
              {unlocked ? (
                <span style={{ fontSize: 11, color: GREEN }}>✓ Unlocked</span>
              ) : (
                <span style={{ fontSize: 11, color: MUTED }}>🔒 Complete 3 {neededFor} (B+)</span>
              )}
            </div>

            {/* Compact cards — 2 per row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {personas.map((persona) => (
                <div
                  key={persona.id}
                  style={{
                    background: CARD,
                    border: `1px solid ${unlocked ? diff.color + '55' : BORDER}`,
                    borderRadius: 10,
                    padding: '10px 14px',
                    opacity: unlocked ? 1 : 0.45,
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {!unlocked && (
                    <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 16 }}>🔒</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: TEXT }}>{persona.name}</span>
                    <span style={{ fontSize: 12, color: MUTED }}>{persona.age} · {persona.occupation}</span>
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {persona.backstory}
                  </div>
                  <button
                    disabled={!unlocked}
                    onClick={() => unlocked && startSession(persona)}
                    style={{
                      background: unlocked ? GOLD : CARD2,
                      color: unlocked ? '#0E131B' : MUTED,
                      border: 'none', borderRadius: 6,
                      padding: '6px 0', fontWeight: 700, fontSize: 12,
                      cursor: unlocked ? 'pointer' : 'not-allowed',
                      marginTop: 2,
                    }}
                  >
                    {unlocked ? '📞 Start Call' : '🔒 Locked'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Top 5 strip */}
      {leaderboard.length > 0 && (
        <div style={{ marginTop: 16, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, fontWeight: 700, color: GOLD }}>🏆 Top Performers</div>
          {leaderboard.slice(0, 5).map((row, i) => (
            <div key={row.id || i} style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', borderBottom: i < 4 ? `1px solid ${BORDER}` : 'none', gap: 10, fontSize: 12 }}>
              <span style={{ color: i === 0 ? GOLD : MUTED, width: 20, fontWeight: 700 }}>#{i + 1}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{row.name}</span>
              <span style={{ color: MUTED }}>{row.personaName} · {row.difficulty}</span>
              <span style={{ color: gradeColor(row.grade), fontWeight: 700 }}>{row.overall}/100</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TRAINING SCREEN — Phone Call UI ──────────────────────────────────────

function formatCallTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function TrainingScreen({
  persona, transcript, isTyping, isListening, voiceTranscript, voiceMode,
  isMuted, chatEndRef, callSeconds, isConnecting,
  onEndSession, onToggleVoice, onToggleMute,
}) {
  const diffColor = { warm: GREEN, skeptical: GOLD, cold: DANGER }[persona.difficulty] || GOLD;

  if (isConnecting) {
    return (
      <div style={{ background: BG, minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: 48 }}>📞</div>
        <div style={{ color: GOLD, fontSize: 18, fontWeight: 700 }}>Connecting to {persona.name}...</div>
        <div style={{ color: MUTED, fontSize: 13 }}>{persona.age} · {persona.occupation}</div>
      </div>
    );
  }

  return (
    <div style={{ background: BG, fontFamily: 'sans-serif', color: TEXT, display: 'flex', flexDirection: 'column' }}>

      {/* Call header — persona + timer */}
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: '14px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{persona.name}</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{persona.age} · {persona.occupation}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }}>
          <span style={{ width: 8, height: 8, background: GREEN, borderRadius: '50%', display: 'inline-block' }} />
          <span style={{ fontSize: 13, color: GREEN, fontWeight: 600 }}>In Call · {formatCallTime(callSeconds)}</span>
          <span style={{ background: diffColor + '22', color: diffColor, border: `1px solid ${diffColor}44`, borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 600, marginLeft: 4 }}>
            {persona.difficulty}
          </span>
        </div>
      </div>

      {/* Live call display — voice UI with subtitle */}
      <div style={{ flex: 1, minHeight: 220, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '24px 16px 48px' }}>
        {isTyping ? (
          <>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: `rgba(200,169,107,0.15)`,
              border: `3px solid ${GOLD}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36,
              boxShadow: `0 0 0 12px rgba(200,169,107,0.08), 0 0 0 24px rgba(200,169,107,0.04)`,
            }}>🔊</div>
            <div style={{ color: GOLD, fontSize: 15, fontWeight: 600, marginTop: 8 }}>{persona.name.split(' ')[0]} is speaking...</div>
            {isMuted && <div style={{ color: DANGER, fontSize: 12 }}>🔇 You're muted — tap speaker to hear</div>}
          </>
        ) : isListening ? (
          <>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: `rgba(74,222,128,0.15)`,
              border: `3px solid ${GREEN}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36,
              boxShadow: `0 0 0 12px rgba(74,222,128,0.08), 0 0 0 24px rgba(74,222,128,0.04)`,
            }}>🎙️</div>
            <div style={{ color: GREEN, fontSize: 15, fontWeight: 600, marginTop: 8 }}>You're speaking...</div>
            {voiceTranscript && (
              <div style={{ color: MUTED, fontSize: 12, fontStyle: 'italic', maxWidth: 260, textAlign: 'center', marginTop: 4 }}>
                "{voiceTranscript}"
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: CARD2, border: `2px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, opacity: 0.5,
            }}>📞</div>
            <div style={{ color: MUTED, fontSize: 14, marginTop: 8 }}>Tap mic to speak</div>
          </>
        )}
        {/* Last line spoken — subtitle style */}
        {transcript.length > 0 && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 20px', textAlign: 'center', fontSize: 13, color: MUTED, fontStyle: 'italic', background: 'linear-gradient(transparent, rgba(14,19,27,0.95))' }}>
            {transcript[transcript.length - 1]?.content?.slice(0, 120)}{transcript[transcript.length - 1]?.content?.length > 120 ? '…' : ''}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Bottom call controls */}
      <div style={{ background: CARD, borderTop: `1px solid ${BORDER}`, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>

          {/* Mute */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <button
              onClick={onToggleMute}
              style={{
                width: 52, height: 52, borderRadius: '50%',
                background: isMuted ? CARD2 : 'rgba(200,169,107,0.15)',
                border: `2px solid ${isMuted ? BORDER : GOLD}`,
                cursor: 'pointer', fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
            <span style={{ fontSize: 10, color: isMuted ? DANGER : MUTED }}>{isMuted ? 'Unmute' : 'Mute'}</span>
          </div>

          {/* Hang up */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <button
              onClick={onEndSession}
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: DANGER, border: 'none',
                cursor: 'pointer', fontSize: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 16px ${DANGER}55`,
              }}
            >
              📵
            </button>
            <span style={{ fontSize: 10, color: DANGER, fontWeight: 600 }}>Hang Up</span>
          </div>

          {/* Mic toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <button
              onClick={onToggleVoice}
              disabled={isTyping}
              style={{
                width: 52, height: 52, borderRadius: '50%',
                background: voiceMode && isListening ? 'rgba(74,222,128,0.15)' : CARD2,
                border: `2px solid ${voiceMode && isListening ? GREEN : BORDER}`,
                cursor: isTyping ? 'not-allowed' : 'pointer', fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: isTyping ? 0.5 : 1,
              }}
            >
              {voiceMode && isListening ? '🎙️' : '🎤'}
            </button>
            <span style={{ fontSize: 10, color: voiceMode && isListening ? GREEN : MUTED }}>
              {isTyping ? 'Wait...' : voiceMode && isListening ? 'Listening' : 'Tap to speak'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── REVIEW SCREEN ──────────────────────────────────────────────────────────

function ReviewScreen({ score, isScoring, persona, progress, leaderboard, transcript, onTrainAgain, onResumeSession }) {
  const [activeTab, setActiveTab] = React.useState('summary');
  if (isScoring || !score) {
    return (
      <div style={{ background: BG, minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 40, fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: 32 }}>⏳</div>
        <div style={{ color: GOLD, fontSize: 18, fontWeight: 600 }}>Evaluating your performance...</div>
        <div style={{ color: MUTED, fontSize: 14 }}>Analyzing your conversation with {persona?.name}...</div>
      </div>
    );
  }

  if (score.error) {
    return (
      <div style={{ background: BG, minHeight: '100%', padding: 32, fontFamily: 'sans-serif', color: TEXT }}>
        <div style={{ color: DANGER, fontSize: 16 }}>Failed to score session. Please try again.</div>
        <button onClick={onTrainAgain} style={{ marginTop: 16, background: GOLD, color: '#0E131B', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer' }}>
          Train Again
        </button>
      </div>
    );
  }

  const gColor = gradeColor(score.grade);
  const passed = score.grade === 'A' || score.grade === 'B';
  const certified = progress?.certifiedAt;
  const cats = [
    { key: 'discovery', label: 'Discovery' },
    { key: 'productKnowledge', label: 'Product Knowledge' },
    { key: 'objectionHandling', label: 'Objection Handling' },
    { key: 'compliance', label: 'Compliance' },
    { key: 'closeNextSteps', label: 'Close / Next Steps' },
  ];

  return (
    <div style={{ background: BG, minHeight: '100%', fontFamily: 'sans-serif', color: TEXT }}>
      {/* Score header */}
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: '14px 16px' }}>
        {certified && <div style={{ background: 'rgba(200,169,107,0.15)', border: `1px solid ${GOLD}`, borderRadius: 8, padding: '7px 12px', marginBottom: 10, textAlign: 'center', fontSize: 13, fontWeight: 700, color: GOLD }}>🏆 Certified Legacy Link Closer!</div>}
        {passed && !certified && <div style={{ background: 'rgba(74,222,128,0.1)', border: `1px solid ${GREEN}44`, borderRadius: 8, padding: '7px 12px', marginBottom: 10, textAlign: 'center', fontSize: 12, fontWeight: 600, color: GREEN }}>🏆 Session Complete — Progress Updated!</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'center', minWidth: 50 }}>
            <div style={{ fontSize: 38, fontWeight: 800, color: gColor, lineHeight: 1 }}>{score.overall}</div>
            <div style={{ fontSize: 11, color: MUTED }}>/100</div>
          </div>
          <div style={{ background: gColor + '22', border: `2px solid ${gColor}`, borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: gColor }}>{score.grade}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{persona?.name} · {persona?.difficulty}</div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{score.verdict}</div>
            <div style={{ marginTop: 3, fontSize: 12, color: score.wouldBuy ? GREEN : DANGER }}>{score.wouldBuy ? '✅ Would move forward' : '❌ Would not move forward'}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: CARD, borderBottom: `1px solid ${BORDER}` }}>
        {['summary','scorecard','transcript'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            flex: 1, padding: '10px 0', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
            color: activeTab === t ? GOLD : MUTED,
            borderBottom: activeTab === t ? `2px solid ${GOLD}` : '2px solid transparent',
          }}>{t}</button>
        ))}
      </div>

      <div style={{ padding: '14px 14px 90px', overflowY: 'auto' }}>
        {/* SUMMARY TAB */}
        {activeTab === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {score.callContext && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '13px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Call Overview</div>
                <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{score.callContext}</div>
              </div>
            )}
            {score.strengthsNarrative && (
              <div style={{ background: CARD, border: `1px solid rgba(74,222,128,0.2)`, borderRadius: 12, padding: '13px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Strengths</div>
                <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{score.strengthsNarrative}</div>
              </div>
            )}
            {score.weaknessesNarrative && (
              <div style={{ background: CARD, border: `1px solid rgba(248,113,113,0.2)`, borderRadius: 12, padding: '13px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: DANGER, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Areas to Improve</div>
                <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{score.weaknessesNarrative}</div>
              </div>
            )}
            {score.customerResponse && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '13px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Prospect Response</div>
                <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{score.customerResponse}</div>
              </div>
            )}
            {score.overallImpression && (
              <div style={{ background: 'rgba(200,169,107,0.08)', border: `1px solid ${GOLD}44`, borderRadius: 12, padding: '13px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Overall Impression</div>
                <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{score.overallImpression}</div>
              </div>
            )}
            {!score.strengthsNarrative && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180, background: CARD, border: `1px solid rgba(74,222,128,0.2)`, borderRadius: 12, padding: '13px 14px' }}>
                  <div style={{ fontWeight: 700, color: GREEN, marginBottom: 8, fontSize: 13 }}>Strengths</div>
                  {(score.strengths || []).map((s, i) => <div key={i} style={{ fontSize: 13, color: TEXT, marginBottom: 5 }}>✅ {s}</div>)}
                </div>
                <div style={{ flex: 1, minWidth: 180, background: CARD, border: `1px solid rgba(251,191,36,0.2)`, borderRadius: 12, padding: '13px 14px' }}>
                  <div style={{ fontWeight: 700, color: GOLD, marginBottom: 8, fontSize: 13 }}>To Improve</div>
                  {(score.improvements || []).map((s, i) => <div key={i} style={{ fontSize: 13, color: TEXT, marginBottom: 5 }}>🔧 {s}</div>)}
                </div>
              </div>
            )}
            {score.momentFlags?.length > 0 && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '13px 14px' }}>
                <div style={{ fontWeight: 700, color: GOLD, marginBottom: 8, fontSize: 13 }}>Key Moments</div>
                {score.momentFlags.map((flag, i) => (
                  <div key={i} style={{ borderLeft: `3px solid ${flag.type === 'positive' ? GREEN : DANGER}`, paddingLeft: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: MUTED, marginBottom: 2 }}>You said: "{flag.quote}"</div>
                    <div style={{ fontSize: 13, color: flag.type === 'positive' ? GREEN : DANGER }}>{flag.feedback}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SCORECARD TAB */}
        {activeTab === 'scorecard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: GOLD }}>Category Breakdown</div>
              {cats.map((cat) => {
                const c = score.categories?.[cat.key];
                if (!c) return null;
                const pct = Math.round((c.score / c.max) * 100);
                return (
                  <div key={cat.key} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span>{cat.label}</span><span style={{ color: GOLD }}>{c.score}/{c.max}</span>
                    </div>
                    <div style={{ background: CARD2, borderRadius: 6, height: 7 }}>
                      <div style={{ background: GOLD, borderRadius: 6, height: 7, width: `${pct}%`, transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{c.feedback}</div>
                  </div>
                );
              })}
            </div>
            {leaderboard.length > 0 && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '13px 14px' }}>
                <div style={{ fontWeight: 700, color: GOLD, marginBottom: 8, fontSize: 13 }}>🏆 Top Performers</div>
                {leaderboard.slice(0, 5).map((row, i) => (
                  <div key={row.id || i} style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: i === 0 ? GOLD : MUTED, width: 22 }}>#{i + 1}</span>
                    <span style={{ flex: 1 }}>{row.name}</span>
                    <span style={{ color: gradeColor(row.grade) }}>{row.overall}/100 · {row.grade}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TRANSCRIPT TAB */}
        {activeTab === 'transcript' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(transcript || []).map((msg, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: msg.role === 'prospect' ? GOLD : MUTED, minWidth: 40, paddingTop: 2 }}>
                  {msg.role === 'prospect' ? persona?.name?.split(' ')[0] : 'You'}
                </span>
                <span style={{ fontSize: 13, color: TEXT, lineHeight: 1.5, flex: 1 }}>{msg.content}</span>
                {msg.audioUrl && (
                  <button
                    onClick={() => { const a = new Audio(msg.audioUrl); a.play(); }}
                    style={{ background: 'rgba(200,169,107,0.15)', border: `1px solid ${GOLD}44`, borderRadius: 20, padding: '3px 10px', cursor: 'pointer', fontSize: 12, color: GOLD, flexShrink: 0 }}
                  >▶</button>
                )}
              </div>
            ))}
            {(!transcript || transcript.length === 0) && (
              <div style={{ color: MUTED, fontSize: 13, textAlign: 'center', marginTop: 20 }}>No transcript available.</div>
            )}
          </div>
        )}
      </div>

      {/* Fixed bottom actions */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: CARD, borderTop: `1px solid ${BORDER}`, padding: '10px 14px', display: 'flex', gap: 10 }}>
        <button onClick={onTrainAgain} style={{ flex: 1, background: GOLD, color: '#0E131B', border: 'none', borderRadius: 8, padding: '11px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Train Again</button>
        <button onClick={onResumeSession} style={{ flex: 1, background: CARD2, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '11px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Resume Session</button>
      </div>
    </div>
  );
}
