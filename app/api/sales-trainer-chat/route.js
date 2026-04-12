import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request) {
  try {
    const body = await request.json();
    const { messages, systemPrompt } = body;

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'messages required' }, { status: 400 });
    }

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt || 'You are a prospect on a phone call.' },
        ...messages
      ],
      max_tokens: 200,
      temperature: 0.85
    });

    const reply = completion.choices?.[0]?.message?.content || "I'm not sure about that.";
    return Response.json({ reply });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
