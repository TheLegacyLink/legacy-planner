'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isScoring, setIsScoring] = useState(false);

  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const inputRef = useRef(null);
  const accumulatedRef = useRef('');
  const isVoiceActiveRef = useRef(false);
  const startListeningRef = useRef(null);

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

  // Send a message and get AI reply
  const sendMessage = useCallback(
    async (content) => {
      if (!content?.trim() || !selectedPersona) return;

      const agentMsg = { role: 'agent', content: content.trim() };
      setTranscript((prev) => [...prev, agentMsg]);
      setInputText('');
      setIsTyping(true);

      try {
        // Build message history: interleave agent/prospect
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
        const reply = data.reply || "I'm not sure about that.";
        const prospectMsg = { role: 'prospect', content: reply };
        setTranscript((prev) => [...prev, prospectMsg]);

        if (!isMuted) {
          await playTTS(reply, selectedPersona.id);
        }

        // Auto-restart mic if voice mode is still active
        if (isVoiceActiveRef.current) {
          setTimeout(() => startListeningRef.current?.(), 800);
        }
      } catch {
        setTranscript((prev) => [
          ...prev,
          { role: 'prospect', content: "Sorry, I didn't catch that." },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [selectedPersona, transcript, isMuted, playTTS]
  );

  // Start a training session
  const startSession = useCallback(
    async (persona) => {
      setSelectedPersona(persona);
      setTranscript([]);
      setScore(null);
      setScreen('training');

      // Trigger the AI to open the call
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
        if (!isMuted) {
          await playTTS(reply, persona.id);
        }
        // Auto-start mic if voice mode is already active
        if (isVoiceActiveRef.current) {
          setTimeout(() => startListeningRef.current?.(), 800);
        }
      } catch {
        setTranscript([{ role: 'prospect', content: 'Hello? Who is this?' }]);
      } finally {
        setIsTyping(false);
      }
    },
    [isMuted, playTTS]
  );

  // End session → go to review
  const endSession = useCallback(async () => {
    if (transcript.length < 2) {
      setScreen('home');
      return;
    }
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

  // TTS via ElevenLabs or browser fallback
  const playTTS = useCallback(async (text, personaId) => {
    try {
      const res = await fetch('/api/sales-trainer-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, personaName: personaId }),
      });

      if (res.headers.get('Content-Type')?.includes('audio')) {
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
  }, []);

  const browserTTS = (text) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.95;
      window.speechSynthesis.speak(utt);
    }
  };

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

      // Reset silence timer — auto-send after 1.5s of silence
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const text = accumulatedRef.current.trim();
        if (text && isVoiceActiveRef.current) {
          accumulatedRef.current = '';
          setVoiceTranscript('');
          silenceTimerRef.current = null;
          // Stop recognition during AI response
          try { recognition.stop(); } catch {}
          setIsListening(false);
          sendMessage(text);
        }
      }, 1500);
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
  }, [sendMessage]);

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
      inputText={inputText}
      inputRef={inputRef}
      chatEndRef={chatEndRef}
      onSend={sendMessage}
      onEndSession={endSession}
      onToggleVoice={() => {
        if (voiceMode) {
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
      onStartListening={startListening}
      onStopListening={stopListening}
      onInputChange={(v) => setInputText(v)}
    />;
  }

  if (screen === 'review') {
    return <ReviewScreen
      score={score}
      isScoring={isScoring}
      persona={selectedPersona}
      progress={progress}
      leaderboard={leaderboard}
      onTrainAgain={() => setScreen('home')}
    />;
  }

  // HOME
  const trackPersonas = PERSONAS.filter((p) => p.track === selectedTrack);

  return (
    <div style={{ background: BG, minHeight: '100%', padding: '24px 16px', fontFamily: 'sans-serif', color: TEXT }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: GOLD }}>🎭 AI Sales Trainer</div>
        <div style={{ color: MUTED, fontSize: 14, marginTop: 4 }}>
          Train like you're on a real call. Choose your track and difficulty.
        </div>
        {progress && (
          <div style={{ marginTop: 8, display: 'inline-block', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '4px 12px', fontSize: 13, color: GOLD }}>
            {getLevelLabel(progress)} · Warm: {progress.warmCompleted || 0} · Skeptical: {progress.skepticalCompleted || 0} · Cold: {progress.coldCompleted || 0}
          </div>
        )}
      </div>

      {/* Track tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {TRACKS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSelectedTrack(t.key)}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
              background: selectedTrack === t.key ? GOLD : CARD,
              color: selectedTrack === t.key ? '#0E131B' : TEXT,
              borderBottom: selectedTrack === t.key ? `2px solid ${GOLD}` : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Difficulty sections */}
      {DIFFICULTIES.map((diff) => {
        const personas = trackPersonas.filter((p) => p.difficulty === diff.key);
        const unlocked = isUnlocked(diff.key, progress);
        const neededFor = diff.key === 'skeptical' ? 'warm' : 'skeptical';
        const needed = diff.key === 'warm' ? 0 : 3;

        return (
          <div key={diff.key} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: diff.color }}>{diff.label}</div>
              {unlocked ? (
                <span style={{ background: 'rgba(74,222,128,0.12)', color: GREEN, border: `1px solid rgba(74,222,128,0.3)`, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                  ✓ Unlocked
                </span>
              ) : (
                <span style={{ background: 'rgba(200,169,107,0.1)', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>
                  🔒 Complete 3 {neededFor} (B+) to unlock
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {personas.map((persona) => (
                <div
                  key={persona.id}
                  style={{
                    background: CARD,
                    border: `1px solid ${unlocked ? diff.color + '44' : BORDER}`,
                    borderRadius: 12,
                    padding: '16px 20px',
                    width: 280,
                    opacity: unlocked ? 1 : 0.5,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 16, color: TEXT }}>{persona.name}</div>
                  <div style={{ color: MUTED, fontSize: 13, marginBottom: 6 }}>
                    {persona.age} · {persona.occupation}
                  </div>
                  <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5, marginBottom: 14 }}>
                    {persona.backstory}
                  </div>
                  <button
                    disabled={!unlocked}
                    onClick={() => unlocked && startSession(persona)}
                    style={{
                      background: unlocked ? GOLD : CARD2,
                      color: unlocked ? '#0E131B' : MUTED,
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 16px',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: unlocked ? 'pointer' : 'not-allowed',
                      width: '100%',
                    }}
                  >
                    {unlocked ? 'Start Training →' : '🔒 Locked'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Top Performers */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: GOLD, marginBottom: 12 }}>🏆 Top Performers</div>
        {leaderboard.length === 0 ? (
          <div style={{ color: MUTED, fontSize: 14 }}>No scores yet. Be the first!</div>
        ) : (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
            {leaderboard.slice(0, 5).map((row, i) => (
              <div
                key={row.id || i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 16px',
                  borderBottom: i < Math.min(leaderboard.length, 5) - 1 ? `1px solid ${BORDER}` : 'none',
                  gap: 12,
                }}
              >
                <div style={{ width: 28, color: i === 0 ? GOLD : MUTED, fontWeight: 700 }}>#{i + 1}</div>
                <div style={{ flex: 1, fontWeight: 600 }}>{row.name}</div>
                <div style={{ color: MUTED, fontSize: 13 }}>{row.personaName} · {row.difficulty}</div>
                <div style={{ color: gradeColor(row.grade), fontWeight: 700, minWidth: 50, textAlign: 'right' }}>
                  {row.overall}/100
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TRAINING SCREEN ────────────────────────────────────────────────────────

function TrainingScreen({
  persona, transcript, isTyping, isListening, voiceTranscript, voiceMode,
  isMuted, inputText, inputRef, chatEndRef,
  onSend, onEndSession, onToggleVoice, onToggleMute, onStartListening, onStopListening, onInputChange,
}) {
  const diffColor = { warm: GREEN, skeptical: GOLD, cold: DANGER }[persona.difficulty] || GOLD;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(inputText);
    }
  };

  return (
    <div style={{ background: BG, minHeight: '100%', padding: '0', fontFamily: 'sans-serif', color: TEXT, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: CARD, borderBottom: `1px solid ${BORDER}` }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{persona.name} <span style={{ color: MUTED, fontWeight: 400, fontSize: 14 }}>· {persona.occupation}</span></div>
          <span style={{ background: diffColor + '22', color: diffColor, border: `1px solid ${diffColor}55`, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
            {persona.difficulty.charAt(0).toUpperCase() + persona.difficulty.slice(1)}
          </span>
        </div>
        <button
          onClick={onEndSession}
          style={{ background: DANGER + '22', color: DANGER, border: `1px solid ${DANGER}55`, borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        >
          End Session
        </button>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, maxHeight: 420 }}>
        {transcript.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'agent' ? 'flex-end' : 'flex-start' }}>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 3 }}>
              {msg.role === 'agent' ? 'You' : persona.name}
            </div>
            <div style={{
              maxWidth: '80%',
              padding: '10px 14px',
              borderRadius: 12,
              fontSize: 14,
              lineHeight: 1.55,
              background: msg.role === 'agent' ? 'rgba(200,169,107,0.15)' : CARD2,
              borderLeft: msg.role === 'prospect' ? `3px solid ${GOLD}` : 'none',
              borderRight: msg.role === 'agent' ? `3px solid ${GOLD}` : 'none',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {isTyping && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 3 }}>{persona.name}</div>
            <div style={{ background: CARD2, borderLeft: `3px solid ${GOLD}`, padding: '10px 14px', borderRadius: 12, fontSize: 14 }}>
              <span style={{ animation: 'pulse 1s infinite' }}>•••</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 20px', background: CARD, borderTop: `1px solid ${BORDER}` }}>
        {/* Voice transcript preview */}
        {voiceMode && isListening && voiceTranscript && (
          <div style={{ fontSize: 13, color: GOLD, marginBottom: 8, fontStyle: 'italic' }}>
            "{voiceTranscript}"
          </div>
        )}
        {voiceMode && isListening && !voiceTranscript && (
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>🎙️ Listening for your voice...</div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Mute */}
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
            style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px', cursor: 'pointer', fontSize: 16 }}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>

          {voiceMode ? (
            isListening ? (
              <button
                onClick={onToggleVoice}
                style={{
                  flex: 1,
                  background: DANGER + '22',
                  border: `1px solid ${DANGER}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: DANGER,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontWeight: 600,
                }}
              >
                <span style={{ width: 10, height: 10, background: DANGER, borderRadius: '50%', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                🔴 Listening... (tap to stop)
              </button>
            ) : (
              <button
                disabled
                style={{
                  flex: 1,
                  background: CARD2,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  cursor: 'not-allowed',
                  fontSize: 14,
                  color: MUTED,
                }}
              >
                ⏳ AI responding...
              </button>
            )
          ) : (
            <>
              <input
                ref={inputRef}
                value={inputText}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response..."
                style={{
                  flex: 1,
                  background: CARD2,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: TEXT,
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => onSend(inputText)}
                disabled={!inputText.trim()}
                style={{
                  background: GOLD,
                  color: '#0E131B',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 16px',
                  fontWeight: 700,
                  cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                  opacity: inputText.trim() ? 1 : 0.5,
                }}
              >
                Send
              </button>
            </>
          )}

          {/* Toggle voice/text — only show when not in voice mode */}
          {!voiceMode && (
            <button
              onClick={onToggleVoice}
              style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: MUTED }}
            >
              🎙️ Voice
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── REVIEW SCREEN ──────────────────────────────────────────────────────────

function ReviewScreen({ score, isScoring, persona, progress, leaderboard, onTrainAgain }) {
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
    <div style={{ background: BG, minHeight: '100%', padding: '24px 20px', fontFamily: 'sans-serif', color: TEXT }}>
      {/* Certified banner */}
      {certified && (
        <div style={{ background: 'rgba(200,169,107,0.15)', border: `1px solid ${GOLD}`, borderRadius: 12, padding: '14px 20px', marginBottom: 20, textAlign: 'center', fontSize: 18, fontWeight: 700, color: GOLD }}>
          🏆 You're a Certified Legacy Link Closer!
        </div>
      )}

      {/* Passed banner */}
      {passed && !certified && (
        <div style={{ background: 'rgba(74,222,128,0.1)', border: `1px solid ${GREEN}44`, borderRadius: 12, padding: '10px 16px', marginBottom: 20, textAlign: 'center', fontSize: 15, fontWeight: 600, color: GREEN }}>
          🏆 Session Complete — Progress Updated!
        </div>
      )}

      {/* Score header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: gColor, lineHeight: 1 }}>{score.overall}</div>
          <div style={{ fontSize: 13, color: MUTED }}>/ 100</div>
        </div>
        <div style={{ background: gColor + '22', border: `2px solid ${gColor}`, borderRadius: 12, width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: gColor }}>
          {score.grade}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{persona?.name} · {persona?.difficulty}</div>
          <div style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>{score.verdict}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: score.wouldBuy ? GREEN : DANGER }}>
            {score.wouldBuy ? '✅ They would have moved forward' : '❌ They would not have moved forward'}
          </div>
        </div>
      </div>

      {/* Category bars */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: GOLD }}>Category Breakdown</div>
        {cats.map((cat) => {
          const c = score.categories?.[cat.key];
          if (!c) return null;
          const pct = Math.round((c.score / c.max) * 100);
          return (
            <div key={cat.key} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>{cat.label}</span>
                <span style={{ color: GOLD }}>{c.score}/{c.max}</span>
              </div>
              <div style={{ background: CARD2, borderRadius: 6, height: 8 }}>
                <div style={{ background: GOLD, borderRadius: 6, height: 8, width: `${pct}%`, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{c.feedback}</div>
            </div>
          );
        })}
      </div>

      {/* Strengths + Improvements */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 220, background: CARD, border: `1px solid rgba(74,222,128,0.2)`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, color: GREEN, marginBottom: 10 }}>Strengths</div>
          {(score.strengths || []).map((s, i) => (
            <div key={i} style={{ fontSize: 13, color: TEXT, marginBottom: 6 }}>✅ {s}</div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 220, background: CARD, border: `1px solid rgba(251,191,36,0.2)`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, color: GOLD, marginBottom: 10 }}>To Improve</div>
          {(score.improvements || []).map((s, i) => (
            <div key={i} style={{ fontSize: 13, color: TEXT, marginBottom: 6 }}>🔧 {s}</div>
          ))}
        </div>
      </div>

      {/* Moment Flags */}
      {score.momentFlags?.length > 0 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: GOLD, marginBottom: 10 }}>Key Moments</div>
          {score.momentFlags.map((flag, i) => (
            <div key={i} style={{ borderLeft: `3px solid ${flag.type === 'positive' ? GREEN : DANGER}`, paddingLeft: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 2 }}>You said: "{flag.quote}"</div>
              <div style={{ fontSize: 13, color: flag.type === 'positive' ? GREEN : DANGER }}>{flag.feedback}</div>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard snippet */}
      {leaderboard.length > 0 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: GOLD, marginBottom: 10 }}>🏆 Top Performers</div>
          {leaderboard.slice(0, 5).map((row, i) => (
            <div key={row.id || i} style={{ display: 'flex', gap: 10, fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: i === 0 ? GOLD : MUTED, width: 24 }}>#{i + 1}</span>
              <span style={{ flex: 1 }}>{row.name}</span>
              <span style={{ color: gradeColor(row.grade) }}>{row.overall}/100 · {row.grade}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onTrainAgain}
          style={{ flex: 1, background: GOLD, color: '#0E131B', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
        >
          Train Again
        </button>
        <button
          onClick={() => document.querySelector('[data-leaderboard]')?.scrollIntoView({ behavior: 'smooth' })}
          style={{ flex: 1, background: CARD, color: GOLD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
        >
          View Leaderboard
        </button>
      </div>
    </div>
  );
}
