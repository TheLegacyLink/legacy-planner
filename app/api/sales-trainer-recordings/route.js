import { list } from '@vercel/blob';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    const prefix = sessionId ? `recordings/${sessionId}/` : 'recordings/';
    const { blobs } = await list({ prefix });

    if (sessionId) {
      // Return sorted list of recordings for this session
      const recordings = blobs
        .map(b => ({ url: b.url, pathname: b.pathname, uploadedAt: b.uploadedAt }))
        .sort((a, b) => a.pathname.localeCompare(b.pathname));
      return Response.json({ recordings });
    }

    // Return grouped sessions
    const sessions = {};
    for (const blob of blobs) {
      // pathname: recordings/{sessionId}/{index}.mp3
      const parts = blob.pathname.split('/');
      if (parts.length < 3) continue;
      const sid = parts[1];
      if (!sessions[sid]) sessions[sid] = { sessionId: sid, count: 0, firstAt: blob.uploadedAt };
      sessions[sid].count++;
      if (blob.uploadedAt > sessions[sid].lastAt) sessions[sid].lastAt = blob.uploadedAt;
    }

    const sessionList = Object.values(sessions).sort((a, b) =>
      new Date(b.firstAt) - new Date(a.firstAt)
    );

    return Response.json({ sessions: sessionList });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
