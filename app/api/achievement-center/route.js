import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/achievement-center.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase(); }

function agentKeyFrom({ email = '', name = '' } = {}) {
  const e = normalize(email);
  if (e) return `e:${e}`;
  const n = normalize(name).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n) return '';
  const parts = n.split(' ').filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return `n:${parts[0]}`;
  return `n:${parts[0]}_${parts[parts.length - 1]}`;
}

function uniq(arr = []) {
  return [...new Set((arr || []).map((v) => clean(v)).filter(Boolean))];
}

export async function GET(req) {
  const url = new URL(req.url);
  const email = clean(url.searchParams.get('email'));
  const name = clean(url.searchParams.get('name'));
  const key = agentKeyFrom({ email, name });

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const row = list.find((r) => clean(r?.agentKey) === key) || null;

  return Response.json({
    ok: true,
    row: row || {
      agentKey: key,
      email: normalize(email),
      name: clean(name),
      unlockedKeys: [],
      manualKeys: [],
      history: [],
      updatedAt: ''
    }
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = clean(body?.action || 'merge_unlocks');

  const email = clean(body?.email);
  const name = clean(body?.name);
  const key = agentKeyFrom({ email, name });
  if (!key) return Response.json({ ok: false, error: 'missing_identity' }, { status: 400 });

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => clean(r?.agentKey) === key);
  const current = idx >= 0 ? list[idx] : {
    agentKey: key,
    email: normalize(email),
    name: clean(name),
    unlockedKeys: [],
    manualKeys: [],
    history: [],
    updatedAt: ''
  };

  if (action === 'merge_unlocks') {
    const incoming = uniq(body?.unlockedKeys || []);
    const existing = uniq(current?.unlockedKeys || []);
    const merged = uniq([...existing, ...incoming, ...(current?.manualKeys || [])]);
    const existingSet = new Set(existing);
    const newOnes = incoming.filter((k) => !existingSet.has(k));

    const now = new Date().toISOString();
    const history = Array.isArray(current?.history) ? [...current.history] : [];
    for (const keyItem of newOnes) {
      history.unshift({ badgeKey: keyItem, at: now, source: clean(body?.source || 'check') || 'check' });
    }

    const next = {
      ...current,
      email: normalize(email) || normalize(current?.email),
      name: clean(name) || clean(current?.name),
      unlockedKeys: merged,
      history: history.slice(0, 500),
      updatedAt: now
    };

    const out = [...list];
    if (idx >= 0) out[idx] = next;
    else out.push(next);
    await saveJsonStore(STORE_PATH, out);

    return Response.json({ ok: true, row: next, newUnlocked: newOnes });
  }

  if (action === 'set_manual') {
    const manualKeys = uniq(body?.manualKeys || []);
    const now = new Date().toISOString();
    const next = {
      ...current,
      email: normalize(email) || normalize(current?.email),
      name: clean(name) || clean(current?.name),
      manualKeys,
      unlockedKeys: uniq([...(current?.unlockedKeys || []), ...manualKeys]),
      updatedAt: now
    };

    const out = [...list];
    if (idx >= 0) out[idx] = next;
    else out.push(next);
    await saveJsonStore(STORE_PATH, out);

    return Response.json({ ok: true, row: next });
  }

  return Response.json({ ok: false, error: 'unknown_action' }, { status: 400 });
}
