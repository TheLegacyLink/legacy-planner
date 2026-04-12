const PERSONA_VOICES = {
  tanya: '21m00Tcm4TlvDq8ikWAM',
  devon: 'TxGEqnHWrfWFTfGW9XjX',
  patricia: 'XrExE9yKIg1WjnnlVkGX',
  marcus: 'TX3LPaxmHKxFdv7VOQHJ',
  keisha: 'AZnzlk1XvdvUeBnXmlld',
  ray: 'nPczCjzI2devNBz1zQrb',
};

export async function POST(request) {
  try {
    const { text, personaName } = await request.json();

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return Response.json({ fallback: true }, { status: 200 });
    }

    const voiceId = PERSONA_VOICES[personaName?.toLowerCase()] || PERSONA_VOICES.tanya;

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      return Response.json({ fallback: true }, { status: 200 });
    }

    const audioBuffer = await res.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return Response.json({ fallback: true }, { status: 200 });
  }
}
