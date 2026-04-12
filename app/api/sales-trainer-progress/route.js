import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/sales-trainer-progress.json';

async function getProgress() {
  return await loadJsonStore(STORE_PATH, {});
}

async function saveProgress(data) {
  return await saveJsonStore(STORE_PATH, data);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    if (!email) {
      return Response.json({ error: 'email required' }, { status: 400 });
    }

    const all = await getProgress();
    const record = all[email] || {
      email,
      warmCompleted: 0,
      skepticalCompleted: 0,
      coldCompleted: 0,
      currentLevel: 1,
      certifiedAt: null,
    };

    return Response.json(record);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, name, difficulty, grade, score } = body;

    if (!email || !difficulty || !grade) {
      return Response.json({ error: 'email, difficulty, and grade required' }, { status: 400 });
    }

    const all = await getProgress();
    const record = all[email] || {
      email,
      name: name || '',
      warmCompleted: 0,
      skepticalCompleted: 0,
      coldCompleted: 0,
      currentLevel: 1,
      certifiedAt: null,
    };

    const passed = grade === 'A' || grade === 'B';

    if (passed) {
      if (difficulty === 'warm') {
        record.warmCompleted = (record.warmCompleted || 0) + 1;
      } else if (difficulty === 'skeptical') {
        record.skepticalCompleted = (record.skepticalCompleted || 0) + 1;
      } else if (difficulty === 'cold') {
        record.coldCompleted = (record.coldCompleted || 0) + 1;
      }
    }

    // Update level
    if (record.coldCompleted >= 3 && !record.certifiedAt) {
      record.certifiedAt = new Date().toISOString();
      record.currentLevel = 4;
    } else if (record.skepticalCompleted >= 3 && record.currentLevel < 3) {
      record.currentLevel = 3;
    } else if (record.warmCompleted >= 3 && record.currentLevel < 2) {
      record.currentLevel = 2;
    }

    if (name) record.name = name;
    record.lastUpdated = new Date().toISOString();

    all[email] = record;
    await saveProgress(all);

    return Response.json(record, { status: 200 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
