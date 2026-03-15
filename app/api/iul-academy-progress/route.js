import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/iul-academy-progress.json';
const ACH_PATH = 'stores/achievement-center.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase(); }
function normalizeName(v = '') { return normalize(v).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function nowIso() { return new Date().toISOString(); }

function agentKeyFrom({ email = '', name = '' } = {}) {
  const e = normalize(email);
  if (e) return `e:${e}`;
  const n = normalizeName(name);
  if (!n) return '';
  const parts = n.split(' ').filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return `n:${parts[0]}`;
  return `n:${parts[0]}_${parts[parts.length - 1]}`;
}

function uniq(arr = []) {
  return [...new Set((arr || []).map((v) => clean(v)).filter(Boolean))];
}

function emptyProgress() {
  return {
    completedSections: [],
    quizScore: null,
    quizPassed: false,
    advancedCompleted: false,
    expertCompleted: false,
    xp: 0,
    levelUnlocked: {
      beginner: false,
      intermediate: false,
      advanced: false,
      expert: false
    }
  };
}

function deriveLevels(progress = {}) {
  const completed = new Set(Array.isArray(progress.completedSections) ? progress.completedSections : []);
  const beginnerComplete = ['beginner_0', 'beginner_1'].every((k) => completed.has(k));
  const intermediateComplete = ['intermediate_0', 'intermediate_1'].every((k) => completed.has(k));
  const advancedSections = ['advanced_0'].every((k) => completed.has(k));
  const expertSections = ['expert_0'].every((k) => completed.has(k));

  const quizPassed = Number(progress.quizScore || 0) >= 80 || Boolean(progress.quizPassed);
  const advancedCompleted = Boolean(progress.advancedCompleted);
  const expertCompleted = Boolean(progress.expertCompleted);

  const levelUnlocked = {
    beginner: beginnerComplete,
    intermediate: intermediateComplete && quizPassed,
    advanced: advancedSections && advancedCompleted,
    expert: expertSections && expertCompleted
  };

  const badgeKeys = [];
  if (levelUnlocked.beginner) badgeKeys.push('academy.iul_beginner');
  if (levelUnlocked.intermediate) badgeKeys.push('academy.iul_intermediate');
  if (levelUnlocked.advanced) badgeKeys.push('academy.iul_advanced');
  if (levelUnlocked.expert) badgeKeys.push('academy.iul_expert');

  return {
    ...progress,
    quizPassed,
    advancedCompleted,
    expertCompleted,
    levelUnlocked,
    badgeKeys
  };
}

async function mergeAchievementBadges({ email = '', name = '', badgeKeys = [] } = {}) {
  const key = agentKeyFrom({ email, name });
  if (!key) return { ok: false, error: 'missing_identity' };

  const rows = await loadJsonStore(ACH_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => clean(r?.agentKey) === key);
  const base = idx >= 0 ? list[idx] : {
    agentKey: key,
    email: normalize(email),
    name: clean(name),
    unlockedKeys: [],
    manualKeys: [],
    history: [],
    updatedAt: ''
  };

  const existing = uniq(base?.unlockedKeys || []);
  const merged = uniq([...existing, ...badgeKeys, ...(base?.manualKeys || [])]);
  const existingSet = new Set(existing);
  const newly = badgeKeys.filter((k) => !existingSet.has(k));
  const ts = nowIso();
  const history = Array.isArray(base?.history) ? [...base.history] : [];
  for (const k of newly) history.unshift({ badgeKey: k, at: ts, source: 'iul_academy' });

  const next = {
    ...base,
    email: normalize(email) || normalize(base?.email),
    name: clean(name) || clean(base?.name),
    unlockedKeys: merged,
    history: history.slice(0, 500),
    updatedAt: ts
  };

  if (idx >= 0) list[idx] = next;
  else list.push(next);
  await saveJsonStore(ACH_PATH, list);

  return { ok: true, newly, unlockedKeys: merged };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const email = clean(searchParams.get('email') || '');
  const name = clean(searchParams.get('name') || '');
  const key = agentKeyFrom({ email, name });
  if (!key) return Response.json({ ok: false, error: 'missing_identity' }, { status: 400 });

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const row = list.find((r) => clean(r?.agentKey) === key) || null;

  const progress = deriveLevels(row?.progress || emptyProgress());
  return Response.json({ ok: true, row: row ? { ...row, progress } : { agentKey: key, email: normalize(email), name: clean(name), progress } });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = clean(body?.email || '');
  const name = clean(body?.name || '');
  const key = agentKeyFrom({ email, name });
  if (!key) return Response.json({ ok: false, error: 'missing_identity' }, { status: 400 });

  const incoming = body?.progress || {};

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => clean(r?.agentKey) === key);
  const base = idx >= 0 ? list[idx] : {
    id: `iul_${Date.now()}`,
    agentKey: key,
    email: normalize(email),
    name: clean(name),
    createdAt: nowIso(),
    progress: emptyProgress()
  };

  const merged = {
    ...emptyProgress(),
    ...(base?.progress || {}),
    ...incoming,
    completedSections: uniq([...(base?.progress?.completedSections || []), ...(incoming?.completedSections || [])]),
    quizScore: incoming?.quizScore == null ? (base?.progress?.quizScore ?? null) : Number(incoming.quizScore),
    xp: Number(incoming?.xp == null ? (base?.progress?.xp || 0) : incoming.xp) || 0
  };

  const progress = deriveLevels(merged);
  const ach = await mergeAchievementBadges({ email, name, badgeKeys: progress.badgeKeys });

  const next = {
    ...base,
    email: normalize(email) || normalize(base?.email),
    name: clean(name) || clean(base?.name),
    progress,
    updatedAt: nowIso()
  };

  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  await saveJsonStore(STORE_PATH, list);

  return Response.json({ ok: true, row: next, unlockedBadges: progress.badgeKeys, newlyUnlockedBadges: ach?.newly || [] });
}
