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
    const sorted = [...scores].sort((a, b) => Number(b.overall || 0) - Number(a.overall || 0));
    return Response.json({ ok: true, rows: sorted.slice(0, 10) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, name, overall, grade, difficulty, personaName } = body;

    if (!name || overall == null) {
      return Response.json({ error: 'name and overall required' }, { status: 400 });
    }

    const allScores = await getScores();

    const newEntry = {
      id: Date.now(),
      name: String(name || ''),
      email: String(email || ''),
      overall: Number(overall || 0),
      grade: String(grade || 'F'),
      difficulty: String(difficulty || 'warm'),
      personaName: String(personaName || ''),
      date: new Date().toISOString(),
    };

    allScores.push(newEntry);
    const trimmed = allScores.slice(-500);
    await saveScores(trimmed);

    const sorted = [...trimmed].sort((a, b) => Number(b.overall || 0) - Number(a.overall || 0));
    return Response.json({ ok: true, rows: sorted.slice(0, 10) }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
