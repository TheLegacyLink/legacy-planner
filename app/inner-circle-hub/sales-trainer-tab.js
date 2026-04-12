'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const BG = '#0E131B';
const GOLD = '#c8a96b';
const CARD = '#141B27';
const CARD2 = '#1A2236';
const TEXT = '#F2F2F2';
const MUTED = '#7B8494';

const DIFFICULTIES = [
  {
    key: 'warm',
    label: 'Warm Lead',
    emoji: '😊',
    description: 'Friendly, open-minded, asks basic questions about the program.',
    color: '#16a34a',
    border: 'rgba(34,197,94,0.35)',
    systemPrompt: `You are a curious, open-minded prospect named Marcus who is interested in financial security for your family. You ask basic questions about how the program works, what it costs, and how long it takes. Keep responses short (1–3 sentences). You are on a phone call. Sound warm and genuine.`
  },
  {
    key: 'skeptical',
    label: 'Skeptical',
    emoji: '🤔',
    description: 'Hesitant, needs convincing, asks tough questions about cost and time.',
    color: '#d97706',
    border: 'rgba(245,158,11,0.35)',
    systemPrompt: `You are a skeptical prospect named Dana. You are busy and unsure. You ask hard questions about cost, time commitment, and whether it is legit. Push back but stay somewhat open. Keep responses short (1–3 sentences). You are on a phone call. Don't be rude, just guarded.`
  },
  {
    key: 'resistant',
    label: 'Resistant',
    emoji: '😤',
    description: 'Dismissive, objection-heavy, short answers. "I\'m not interested."',
    color: '#dc2626',
    border: 'rgba(220,38,38,0.35)',
    systemPrompt: `You are a resistant, dismissive prospect named Ray. You do not have time for this and are not interested. Give short, cold responses. Only soften slightly if the agent says something genuinely compelling. You are on a phone call. Be brief and skeptical.`
  }
];

const EVAL_PROMPT = `You are an expert sales coach evaluating a Legacy Link agent's call performance. 
Score the following conversation on these criteria (each 1–10):
- Opening: Did they introduce themselves clearly and establish rapport quickly?
- Rapport Building: Did they connect personally and build trust?
- Objection Handling: Did they address concerns confidently and with empathy?
- Closing Attempt: Did they ask for a next step or commitment?
- Overall: General effectiveness and professionalism.

Also provide:
- strengths: array of 2–3 specific things they did well (short phrases)
- improvements: array of 2–3 specific things to improve (short phrases)
- verdict: one of "Needs Work" | "Good" | "Certified Legacy Link Closer!" (use "Certified Legacy Link Closer!" only if Overall >= 8)

Respond with ONLY valid JSON in this exact format:
{
  "Opening": 7,
  "Rapport Building": 6,
  "Objection Handling": 5,
  "Closing Attempt": 4,
  "Overall": 6,
  "strengths": ["Used prospect's name", "Stayed calm under pressure"],
  "improvements": ["Ask discovery questions earlier", "Tie back to family benefits"],
  "verdict": "Good"
}`;

function useSpeechRecognition({ onResult, enabled }) {
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);

  const start = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    try {
      const recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.onresult = (e) => {
        const transcript = e.results?.[0]?.[0]?.transcript || '';
        if (transcript) onResult(transcript);
      };
      recognition.onend = () => setListening(false);
      recognition.onerror = () => setListening(false);
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch {}
  }, [enabled, onResult]);

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  }, []);

  return { start, stop, listening };
}

function speakText(text, muted) {
  if (muted || typeof window === 'undefined') return;
  try { window.speechSynthesis.cancel(); } catch {}
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1;
    window.speechSynthesis.speak(utter);
  } catch {}
}

async function speakWithElevenLabs(text, muted) {
  if (muted) return false;
  // ElevenLabs TTS via server-side would need a proxy route.
  // We skip client-side ElevenLabs (API key would be exposed).
  return false;
}

export default function SalesTrainerTab({ member }) {
  const [screen, setScreen] = useState('home'); // home | training | review
  const [difficulty, setDifficulty] = useState(null);
  const [messages, setMessages] = useState([]); // { role: 'user'|'assistant', content: string }
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [scorecard, setScorecard] = useState(null);
  const [muted, setMuted] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [postingScore, setPostingScore] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);
  const chatEndRef = useRef(null);

  const hasSpeechRecognition = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // Fetch leaderboard on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/sales-trainer-leaderboard', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) setLeaderboard(Array.isArray(data.rows) ? data.rows : []);
      } catch {}
      setLeaderboardLoading(false);
    })();
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (screen === 'training') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, screen]);

  const sendMessage = useCallback(async (text) => {
    const content = (text || '').trim();
    if (!content || loading || !difficulty) return;

    const diff = DIFFICULTIES.find((d) => d.key === difficulty);
    const updated = [...messages, { role: 'user', content }];
    setMessages(updated);
    setInputText('');
    setLoading(true);

    try {
      const res = await fetch('/api/sales-trainer-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated,
          systemPrompt: diff?.systemPrompt || ''
        })
      });
      const data = await res.json().catch(() => ({}));
      const reply = data?.reply || "I'm not sure about that.";
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      // TTS
      const spoke = await speakWithElevenLabs(reply, muted);
      if (!spoke) speakText(reply, muted);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: "Sorry, I lost connection for a second. What were you saying?" }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, difficulty, muted]);

  const { start: startListening, stop: stopListening, listening } = useSpeechRecognition({
    enabled: voiceMode && hasSpeechRecognition,
    onResult: (text) => sendMessage(text)
  });

  const endSession = useCallback(async () => {
    if (!messages.length) { setScreen('home'); return; }
    setScreen('review');
    setEvaluating(true);
    setScorecard(null);

    try {
      const diff = DIFFICULTIES.find((d) => d.key === difficulty);
      const transcript = messages.map((m) => `${m.role === 'user' ? 'Agent' : 'Prospect'}: ${m.content}`).join('\n');
      const evalMessages = [
        { role: 'system', content: EVAL_PROMPT },
        { role: 'user', content: `Difficulty: ${diff?.label || difficulty}\n\nTranscript:\n${transcript}` }
      ];

      const res = await fetch('/api/sales-trainer-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: evalMessages.slice(1),
          systemPrompt: evalMessages[0].content
        })
      });
      const data = await res.json().catch(() => ({}));
      let parsed = null;
      try {
        // strip markdown fences if present
        const raw = (data?.reply || '').replace(/```json|```/g, '').trim();
        parsed = JSON.parse(raw);
      } catch {
        parsed = {
          Opening: 5, 'Rapport Building': 5, 'Objection Handling': 5, 'Closing Attempt': 5, Overall: 5,
          strengths: ['Attempted the call'],
          improvements: ['Keep practicing'],
          verdict: 'Needs Work'
        };
      }
      setScorecard(parsed);
    } catch {
      setScorecard({
        Opening: 5, 'Rapport Building': 5, 'Objection Handling': 5, 'Closing Attempt': 5, Overall: 5,
        strengths: ['Completed the session'],
        improvements: ['Try again for a better score'],
        verdict: 'Needs Work'
      });
    } finally {
      setEvaluating(false);
    }
  }, [messages, difficulty]);

  const saveScore = useCallback(async () => {
    if (!scorecard || postingScore || scoreSaved) return;
    setPostingScore(true);
    try {
      const name = (member?.applicantName || member?.name || member?.email || 'Anonymous').split(' ')[0] + ' ' + ((member?.applicantName || '').split(' ').slice(-1)[0] || '').charAt(0) + '.';
      await fetch('/api/sales-trainer-leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: member?.applicantName || member?.name || 'Anonymous',
          email: member?.email || '',
          overallScore: scorecard?.Overall || 0,
          difficulty,
          scores: {
            Opening: scorecard?.Opening,
            RapportBuilding: scorecard?.['Rapport Building'],
            ObjectionHandling: scorecard?.['Objection Handling'],
            ClosingAttempt: scorecard?.['Closing Attempt'],
            Overall: scorecard?.Overall
          },
          verdict: scorecard?.verdict || ''
        })
      });
      setScoreSaved(true);
      // Refresh leaderboard
      const res = await fetch('/api/sales-trainer-leaderboard', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) setLeaderboard(Array.isArray(data.rows) ? data.rows : []);
    } catch {}
    setPostingScore(false);
  }, [scorecard, postingScore, scoreSaved, difficulty, member]);

  const trainAgain = () => {
    setMessages([]);
    setScorecard(null);
    setScoreSaved(false);
    setInputText('');
    setDifficulty(null);
    setScreen('home');
    try { window.speechSynthesis?.cancel(); } catch {}
  };

  const startTraining = (diffKey) => {
    setDifficulty(diffKey);
    setMessages([]);
    setScorecard(null);
    setScoreSaved(false);
    setInputText('');
    setScreen('training');
    // AI opens the call
    setTimeout(async () => {
      const diff = DIFFICULTIES.find((d) => d.key === diffKey);
      setLoading(true);
      try {
        const res = await fetch('/api/sales-trainer-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Hello?' }],
            systemPrompt: diff?.systemPrompt || ''
          })
        });
        const data = await res.json().catch(() => ({}));
        const reply = data?.reply || "Hello? Who's this?";
        setMessages([{ role: 'assistant', content: reply }]);
        const spoke = await speakWithElevenLabs(reply, muted);
        if (!spoke) speakText(reply, muted);
      } catch {
        setMessages([{ role: 'assistant', content: "Hello? Who's this?" }]);
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  const SCORE_KEYS = ['Opening', 'Rapport Building', 'Objection Handling', 'Closing Attempt', 'Overall'];
  const currentDiff = DIFFICULTIES.find((d) => d.key === difficulty);

  // ── HOME SCREEN ──────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <div style={{ background: BG, borderRadius: 16, padding: 20, display: 'grid', gap: 20 }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: GOLD, fontWeight: 900, fontSize: 22, letterSpacing: '.04em' }}>🎯 AI SALES TRAINER</div>
          <div style={{ color: MUTED, fontSize: 14, marginTop: 4 }}>Train like you're on a real call</div>
        </div>

        {/* Difficulty cards */}
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {DIFFICULTIES.map((d) => (
            <div key={d.key} style={{ background: CARD, border: `1px solid ${d.border}`, borderRadius: 14, padding: 18, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 28 }}>{d.emoji}</div>
              <div style={{ color: d.color, fontWeight: 800, fontSize: 17 }}>{d.label}</div>
              <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.5 }}>{d.description}</div>
              <button
                type="button"
                onClick={() => startTraining(d.key)}
                style={{ padding: '10px 0', borderRadius: 9, border: 0, background: d.color, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
              >
                Start Training
              </button>
            </div>
          ))}
        </div>

        {/* Leaderboard */}
        <div style={{ background: CARD, border: '1px solid rgba(200,169,107,0.2)', borderRadius: 14, padding: 16 }}>
          <div style={{ color: GOLD, fontWeight: 800, fontSize: 16, marginBottom: 12 }}>🏆 Top Performers</div>
          {leaderboardLoading ? (
            <div style={{ color: MUTED, fontSize: 13 }}>Loading leaderboard...</div>
          ) : leaderboard.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 13 }}>No scores yet. Be the first!</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {leaderboard.slice(0, 10).map((row, idx) => (
                <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: CARD2, borderRadius: 10, padding: '9px 12px' }}>
                  <span style={{ color: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#c8764a' : MUTED, fontWeight: 800, minWidth: 22, fontSize: 13 }}>
                    #{idx + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: TEXT, fontWeight: 700, fontSize: 14 }}>{row.name}</div>
                    <div style={{ color: MUTED, fontSize: 12 }}>{row.difficulty} • {new Date(row.date).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: GOLD, fontWeight: 800, fontSize: 16 }}>{row.overallScore}/10</div>
                    <div style={{ color: MUTED, fontSize: 11 }}>{row.verdict}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── TRAINING SESSION ──────────────────────────────────────────────────────
  if (screen === 'training') {
    return (
      <div style={{ background: BG, borderRadius: 16, padding: 20, display: 'grid', gap: 16, minHeight: 520 }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: GOLD, fontWeight: 800, fontSize: 16 }}>{currentDiff?.emoji} {currentDiff?.label} Prospect</div>
            <div style={{ color: MUTED, fontSize: 13 }}>You're the Legacy Link agent. Make the call count.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #334155', background: muted ? '#334155' : CARD2, color: muted ? '#94a3b8' : TEXT, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
            >
              {muted ? '🔇 Muted' : '🔊 Audio'}
            </button>
            {hasSpeechRecognition && (
              <button
                type="button"
                onClick={() => setVoiceMode((v) => !v)}
                style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #334155', background: voiceMode ? GOLD : CARD2, color: voiceMode ? '#0b1020' : TEXT, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
              >
                {voiceMode ? '🎙️ Voice ON' : '🎙️ Voice OFF'}
              </button>
            )}
            <button
              type="button"
              onClick={endSession}
              style={{ padding: '8px 16px', borderRadius: 8, border: 0, background: '#dc2626', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
            >
              End Session
            </button>
          </div>
        </div>

        {/* Chat bubbles */}
        <div style={{ background: CARD, borderRadius: 12, padding: 14, minHeight: 320, maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && !loading ? (
            <div style={{ color: MUTED, fontSize: 14, textAlign: 'center', marginTop: 40 }}>Connecting to prospect...</div>
          ) : null}
          {messages.map((msg, idx) => {
            const isAI = msg.role === 'assistant';
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: isAI ? 'row' : 'row-reverse', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ fontSize: 20 }}>{isAI ? '🧑' : '🎯'}</div>
                <div style={{
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: isAI ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
                  background: isAI ? CARD2 : GOLD,
                  color: isAI ? TEXT : '#0b1020',
                  border: isAI ? `1px solid ${GOLD}` : 'none',
                  fontSize: 14,
                  lineHeight: 1.5,
                  fontWeight: isAI ? 400 : 600
                }}>
                  {msg.content}
                </div>
              </div>
            );
          })}
          {loading ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ fontSize: 20 }}>🧑</div>
              <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 4px', background: CARD2, border: `1px solid ${GOLD}`, color: MUTED, fontSize: 14 }}>
                Typing...
              </div>
            </div>
          ) : null}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {voiceMode && hasSpeechRecognition ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                disabled={loading}
                style={{
                  width: 64, height: 64, borderRadius: '50%', border: 0,
                  background: listening ? '#dc2626' : GOLD,
                  color: listening ? '#fff' : '#0b1020',
                  fontSize: 26, cursor: 'pointer',
                  boxShadow: listening ? '0 0 0 6px rgba(220,38,38,0.25)' : '0 0 0 4px rgba(200,169,107,0.2)',
                  transition: 'all .2s'
                }}
              >
                {listening ? '⏹' : '🎤'}
              </button>
              {listening ? <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 14 }}>Listening...</span> : <span style={{ color: MUTED, fontSize: 13 }}>Tap to speak</span>}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputText); } }}
                placeholder="What would you say to the prospect?"
                disabled={loading}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: 10,
                  border: '1px solid #334155', background: CARD2,
                  color: TEXT, fontSize: 14, outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => sendMessage(inputText)}
                disabled={loading || !inputText.trim()}
                style={{
                  padding: '12px 20px', borderRadius: 10, border: 0,
                  background: GOLD, color: '#0b1020',
                  fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  opacity: (loading || !inputText.trim()) ? 0.6 : 1
                }}
              >
                Send
              </button>
            </div>
          )}
          {voiceMode && (
            <div style={{ textAlign: 'center' }}>
              <button type="button" onClick={() => setVoiceMode(false)} style={{ background: 'none', border: 'none', color: MUTED, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                Switch to text input
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── PERFORMANCE REVIEW ────────────────────────────────────────────────────
  if (screen === 'review') {
    const overall = scorecard?.Overall || 0;
    const isCertified = overall >= 8 && scorecard?.verdict === 'Certified Legacy Link Closer!';

    return (
      <div style={{ background: BG, borderRadius: 16, padding: 20, display: 'grid', gap: 20 }}>
        {evaluating ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 32 }}>🔍</div>
            <div style={{ color: GOLD, fontWeight: 700, fontSize: 18, marginTop: 12 }}>Evaluating your performance...</div>
            <div style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>Analyzing your call strategy and execution</div>
          </div>
        ) : scorecard ? (
          <>
            {/* Certified Banner */}
            {isCertified && (
              <div style={{
                background: 'linear-gradient(135deg,#44300a 0%,#1f2937 100%)',
                border: `2px solid ${GOLD}`,
                borderRadius: 16,
                padding: '20px 24px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 36 }}>🏆</div>
                <div style={{ color: GOLD, fontWeight: 900, fontSize: 22, marginTop: 8 }}>You are a Certified Legacy Link Closer!</div>
                <div style={{ color: TEXT, fontSize: 14, marginTop: 6 }}>Elite performance. You have what it takes.</div>
              </div>
            )}

            {/* Header */}
            <div>
              <div style={{ color: TEXT, fontWeight: 800, fontSize: 20 }}>📊 Performance Scorecard</div>
              <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{currentDiff?.label} • {messages.length} exchanges</div>
            </div>

            {/* Score bars */}
            <div style={{ background: CARD, borderRadius: 14, padding: 16, display: 'grid', gap: 12 }}>
              {SCORE_KEYS.map((key) => {
                const val = scorecard?.[key] || 0;
                const pct = (val / 10) * 100;
                const barColor = val >= 8 ? '#22c55e' : val >= 6 ? GOLD : val >= 4 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: key === 'Overall' ? GOLD : TEXT, fontWeight: key === 'Overall' ? 800 : 600, fontSize: key === 'Overall' ? 16 : 14 }}>{key}</span>
                      <span style={{ color: barColor, fontWeight: 800, fontSize: key === 'Overall' ? 18 : 15 }}>{val}/10</span>
                    </div>
                    <div style={{ height: key === 'Overall' ? 12 : 8, background: '#1f2937', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 999, transition: 'width .5s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Verdict */}
            <div style={{ background: CARD2, border: `1px solid ${isCertified ? GOLD : '#334155'}`, borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ color: MUTED, fontSize: 12, marginBottom: 4 }}>VERDICT</div>
              <div style={{ color: isCertified ? GOLD : overall >= 6 ? '#86efac' : '#fca5a5', fontWeight: 900, fontSize: 18 }}>
                {scorecard?.verdict || 'Needs Work'}
              </div>
            </div>

            {/* Strengths & Improvements */}
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
              <div style={{ background: CARD, border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, padding: 14 }}>
                <div style={{ color: '#22c55e', fontWeight: 800, marginBottom: 10, fontSize: 15 }}>✅ Strengths</div>
                {(scorecard?.strengths || []).map((s, i) => (
                  <div key={i} style={{ color: TEXT, fontSize: 14, marginBottom: 6, paddingLeft: 4 }}>• {s}</div>
                ))}
              </div>
              <div style={{ background: CARD, border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: 14 }}>
                <div style={{ color: '#f59e0b', fontWeight: 800, marginBottom: 10, fontSize: 15 }}>🔧 Improve</div>
                {(scorecard?.improvements || []).map((s, i) => (
                  <div key={i} style={{ color: TEXT, fontSize: 14, marginBottom: 6, paddingLeft: 4 }}>• {s}</div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={saveScore}
                disabled={postingScore || scoreSaved}
                style={{
                  padding: '12px 24px', borderRadius: 10, border: 0,
                  background: scoreSaved ? '#22c55e' : GOLD,
                  color: '#0b1020', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  opacity: postingScore ? 0.7 : 1
                }}
              >
                {scoreSaved ? '✅ Score Saved to Leaderboard' : postingScore ? 'Saving...' : '🏆 Submit to Leaderboard'}
              </button>
              <button
                type="button"
                onClick={trainAgain}
                style={{
                  padding: '12px 24px', borderRadius: 10,
                  border: `1px solid ${GOLD}`, background: 'transparent',
                  color: GOLD, fontWeight: 800, fontSize: 14, cursor: 'pointer'
                }}
              >
                🔄 Train Again
              </button>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  return null;
}
