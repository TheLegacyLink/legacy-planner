export async function POST(request) {
  try {
    const { personaId, transcript, difficulty, track } = await request.json();

    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!openaiKey && !anthropicKey) {
      return Response.json({ error: 'No AI API key configured' }, { status: 500 });
    }

    const PERSONA_INFO = {
      tanya: { name: 'Tanya', age: 28, occupation: 'Nurse' },
      devon: { name: 'Devon', age: 31, occupation: 'Amazon Warehouse Worker' },
      patricia: { name: 'Patricia', age: 52, occupation: 'Retired Teacher' },
      marcus: { name: 'Marcus', age: 26, occupation: 'Uber/Lyft Driver' },
      keisha: { name: 'Keisha', age: 34, occupation: 'Corporate HR Manager' },
      ray: { name: 'Ray', age: 45, occupation: 'Construction Foreman' },
    };

    const persona = PERSONA_INFO[personaId] || { name: personaId, age: 30, occupation: 'Prospect' };
    const trackLabel = track === 'recruiting' ? 'agent recruiting' : 'IUL sales';

    const formattedTranscript = transcript
      .map((t) => `${t.role === 'agent' ? 'AGENT' : persona.name.toUpperCase()}: ${t.content}`)
      .join('\n');

    const scoringPrompt = `You are an expert sales trainer evaluating an insurance agent's role-play session.
The agent was practicing a ${trackLabel} conversation with ${persona.name}, a ${persona.age}-year-old ${persona.occupation}.
The difficulty level was ${difficulty}.

Here is the full transcript:
${formattedTranscript}

Please evaluate the agent's performance and respond in VALID JSON format only (no markdown, no code blocks):
{
  "overall": <number 0-100>,
  "grade": "<A/B/C/D/F>",
  "verdict": "<1-2 sentence summary>",
  "wouldBuy": <true/false>,
  "callContext": "<2-3 sentence overview of how the call went>",
  "strengthsNarrative": "<Detailed paragraph analyzing what the agent did well with specific examples from the transcript>",
  "weaknessesNarrative": "<Detailed paragraph analyzing weaknesses with exact quotes from the transcript>",
  "customerResponse": "<Paragraph describing how the prospect responded and evolved throughout the call>",
  "overallImpression": "<Concluding paragraph with big picture assessment and one key takeaway>",
  "categories": {
    "discovery": { "score": <0-25>, "max": 25, "feedback": "<specific feedback>" },
    "productKnowledge": { "score": <0-25>, "max": 25, "feedback": "<specific feedback>" },
    "objectionHandling": { "score": <0-25>, "max": 25, "feedback": "<specific feedback>" },
    "compliance": { "score": <0-15>, "max": 15, "feedback": "<specific feedback>" },
    "closeNextSteps": { "score": <0-10>, "max": 10, "feedback": "<specific feedback>" }
  },
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "momentFlags": [
    { "type": "<positive/negative>", "quote": "<agent quote>", "feedback": "<why good or bad>" }
  ]
}
Grading: A (90-100), B (75-89), C (60-74), D (45-59), F (0-44)`;

    let raw = '{}';

    if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 4000,
          messages: [{ role: 'user', content: scoringPrompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        raw = data.choices?.[0]?.message?.content || '{}';
      }
    } else if (anthropicKey) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 2500, messages: [{ role: 'user', content: scoringPrompt }] }),
      });
      if (res.ok) {
        const data = await res.json();
        raw = data.content?.[0]?.text || '{}';
      } else {
        const err = await res.text();
        return Response.json({ error: err }, { status: 500 });
      }
    }

    let scorecard;
    try {
      scorecard = JSON.parse(raw);
    } catch {
      // Try to extract JSON from text
      const match = raw.match(/\{[\s\S]*\}/);
      scorecard = match ? JSON.parse(match[0]) : {};
    }

    return Response.json(scorecard);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
