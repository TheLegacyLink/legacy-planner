import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/sales-trainer-scores.json';

async function getScores() {
  return await loadJsonStore(STORE_PATH, []);
}

async function saveScores(data) {
  return await saveJsonStore(STORE_PATH, data);
}

export async function GET() {
  try {
    const scores = await getScores();
    const sorted = [...scores].sort((a, b) => Number(b.overallScore || 0) - Number(a.overallScore || 0));
    return Response.json({ ok: true, rows: sorted.slice(0, 10) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, overallScore, difficulty, scores, verdict } = body;

    if (!name || overallScore == null) {
      return Response.json({ error: 'name and overallScore required' }, { status: 400 });
    }

    const allScores = await getScores();

    const newEntry = {
      id: Date.now(),
      name: String(name || ''),
      email: String(email || ''),
      overallScore: Number(overallScore || 0),
      difficulty: String(difficulty || 'warm'),
      scores: scores || {},
      verdict: String(verdict || ''),
      date: new Date().toISOString()
    };

    allScores.push(newEntry);

    // Keep only last 500 entries to avoid bloat
    const trimmed = allScores.slice(-500);
    await saveScores(trimmed);

    return Response.json({ ok: true, row: newEntry }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
