import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import { TRAINING_SEED } from '../../../lib/agentTrainingSeed';
import { getAdminSkeletonPasswords } from '../../../lib/adminSkeletonAuth';

export const dynamic = 'force-dynamic';

const CONTENT_PATH  = 'stores/agent-training-content.json';
const PROGRESS_PATH = 'stores/agent-training-progress.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase(); }
function nowIso() { return new Date().toISOString(); }

function isAdminAuth(req, body = {}) {
  const h = clean(req.headers.get('x-admin-key') || req.headers.get('authorization')).replace(/^Bearer\s+/i, '');
  const b = clean(body?.adminToken || '');
  const provided = h || b;
  return provided && getAdminSkeletonPasswords().includes(provided);
}

// Version bump forces a re-seed when content structure changes
const CONTENT_VERSION = '3';

async function loadContent() {
  const stored = await loadJsonStore(CONTENT_PATH, null);
  // Re-seed if missing OR if version is outdated (e.g. keyPoints format changed)
  if (stored && stored.stages && stored._version === CONTENT_VERSION) return stored;
  const seeded = { ...TRAINING_SEED, _version: CONTENT_VERSION };
  await saveJsonStore(CONTENT_PATH, seeded);
  return seeded;
}

async function loadProgress() {
  const p = await loadJsonStore(PROGRESS_PATH, {});
  return (p && typeof p === 'object') ? p : {};
}

// Flatten all modules from stages content
function allModules(content) {
  return (content.stages || []).flatMap(s => s.modules || []);
}

// Figure out which modules are accessible for an agent given their progress
function computeUnlocked(content, agentProgress) {
  const stages = content.stages || [];
  const unlocked = new Set();

  for (const stage of stages) {
    const mods = stage.modules || [];
    if (!mods.length) continue;

    // First module of each stage: unlocked if previous stage fully completed
    const stageIdx = stages.indexOf(stage);
    if (stageIdx === 0) {
      // Stage 1 always unlocked
      unlocked.add(mods[0].id);
    } else {
      // Previous stage must be fully passed
      const prevStage = stages[stageIdx - 1];
      const prevAllPassed = (prevStage.modules || []).every(m => agentProgress[m.id]?.completed);
      if (prevAllPassed) unlocked.add(mods[0].id);
      else continue;
    }

    // Within a stage: each module unlocks when the previous one is completed
    for (let i = 1; i < mods.length; i++) {
      if (agentProgress[mods[i - 1].id]?.completed) {
        unlocked.add(mods[i].id);
      }
    }
  }

  return unlocked;
}

// ─── GET: fetch content + agent progress ─────────────────────────────────────
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const email = normalize(searchParams.get('email') || '');
  const adminView = searchParams.get('admin') === '1';

  const content  = await loadContent();
  const progress = await loadProgress();

  if (adminView) {
    // Admin: return full content + all agents progress
    return Response.json({ ok: true, content, allProgress: progress });
  }

  if (!email) return Response.json({ ok: true, content, progress: {} });

  const agentProgress = progress[email] || {};
  const unlocked = computeUnlocked(content, agentProgress);

  const stages = (content.stages || []).map(stage => ({
    ...stage,
    modules: (stage.modules || []).map(mod => {
      const prog = agentProgress[mod.id] || {};
      return {
        id: mod.id,
        title: mod.title,
        description: mod.description,
        videoUrl: mod.videoUrl || '',
        keyPoints: mod.keyPoints || [],
        // Strip correct answers from quiz before sending to client
        quiz: {
          passingScore: mod.quiz?.passingScore ?? 8,
          questionCount: (mod.quiz?.questions || []).length,
          questions: (mod.quiz?.questions || []).map(q => ({
            id: q.id,
            text: q.text,
            options: q.options
            // correctIndex intentionally omitted
          }))
        },
        progress: {
          completed: Boolean(prog.completed),
          passedAt: prog.passedAt || '',
          attempts: prog.attempts || 0,
          bestScore: prog.bestScore ?? null,
          badgeEarned: Boolean(prog.badgeEarned)
        },
        unlocked: unlocked.has(mod.id)
      };
    })
  }));

  const totalModules   = allModules(content).length;
  const completedCount = Object.values(agentProgress).filter(p => p.completed).length;

  return Response.json({ ok: true, stages, totalModules, completedCount, email });
}

// ─── POST: submit a quiz attempt ─────────────────────────────────────────────
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // ── quiz submission ──────────────────────────────────────────────────────
  if (action === 'submit_quiz') {
    const email   = normalize(body?.email || '');
    const moduleId = clean(body?.moduleId || '');
    const answers  = body?.answers; // { questionId: chosenIndex, ... }

    if (!email || !moduleId || !answers || typeof answers !== 'object') {
      return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }

    const content = await loadContent();
    const trainingModule = allModules(content).find(m => m.id === moduleId);
    if (!trainingModule) return Response.json({ ok: false, error: 'module_not_found' }, { status: 404 });

    const questions    = trainingModule.quiz?.questions || [];
    const passingScore = trainingModule.quiz?.passingScore ?? 8;
    let correct = 0;
    const results = questions.map(q => {
      const chosen   = Number(answers[q.id] ?? -1);
      const isRight  = chosen === q.correctIndex;
      if (isRight) correct++;
      return {
        id: q.id,
        text: q.text,
        chosen,
        correctIndex: q.correctIndex,
        correct: isRight
      };
    });

    const passed   = correct >= passingScore;
    const progress = await loadProgress();
    const prev     = progress[email]?.[moduleId] || {};
    const attempts = (prev.attempts || 0) + 1;
    const bestScore = Math.max(prev.bestScore ?? 0, correct);

    progress[email] = progress[email] || {};
    progress[email][moduleId] = {
      completed:   passed || Boolean(prev.completed),
      passedAt:    passed && !prev.completed ? nowIso() : (prev.passedAt || ''),
      attempts,
      bestScore,
      lastScore:   correct,
      badgeEarned: passed || Boolean(prev.badgeEarned),
      lastAttemptAt: nowIso()
    };

    await saveJsonStore(PROGRESS_PATH, progress);

    return Response.json({
      ok: true,
      passed,
      score: correct,
      total: questions.length,
      passingScore,
      attempts,
      bestScore,
      // Tell client which questions were wrong (only text + correctIndex, no full data leak)
      missed: results
        .filter(r => !r.correct)
        .map(r => ({ id: r.id, text: r.text, correctIndex: r.correctIndex, yourAnswer: r.chosen })),
      badge: passed ? { moduleId, title: trainingModule.title, earnedAt: progress[email][moduleId].passedAt } : null
    });
  }

  return Response.json({ ok: false, error: 'unknown_action' }, { status: 400 });
}

// ─── PATCH: admin content edits ───────────────────────────────────────────────
export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));

  if (!isAdminAuth(req, body)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { action } = body;

  if (action === 'update_module') {
    const { moduleId, patch } = body;
    if (!moduleId || !patch) return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });

    const content = await loadContent();
    let found = false;
    for (const stage of content.stages || []) {
      for (let i = 0; i < (stage.modules || []).length; i++) {
        if (stage.modules[i].id === moduleId) {
          stage.modules[i] = { ...stage.modules[i], ...patch };
          found = true;
          break;
        }
      }
    }
    if (!found) return Response.json({ ok: false, error: 'module_not_found' }, { status: 404 });
    await saveJsonStore(CONTENT_PATH, content);
    return Response.json({ ok: true, content });
  }

  if (action === 'reset_progress') {
    const { email, moduleId } = body;
    if (!email) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });
    const progress = await loadProgress();
    if (moduleId) {
      if (progress[email]) delete progress[email][moduleId];
    } else {
      delete progress[email];
    }
    await saveJsonStore(PROGRESS_PATH, progress);
    return Response.json({ ok: true });
  }

  if (action === 'reset_content') {
    await saveJsonStore(CONTENT_PATH, TRAINING_SEED);
    return Response.json({ ok: true, message: 'Content reset to seed data' });
  }

  return Response.json({ ok: false, error: 'unknown_action' }, { status: 400 });
}
