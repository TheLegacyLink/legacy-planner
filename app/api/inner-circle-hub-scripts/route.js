import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/inner-circle-hub-scripts.json';

const DEFAULT_SCRIPTS = [
  {
    id: 'script-opener-income',
    category: 'opener',
    title: 'Income Opportunity Opener',
    text: 'Hey [Name], quick question — are you open to adding an extra $2k-$5k this month helping families protect what matters?'
  },
  {
    id: 'script-followup-2touch',
    category: 'followup',
    title: '2nd Touch Follow-Up',
    text: 'Just circling back — I can break down the exact process our producers are using this week to book and close. Want me to send it?'
  },
  {
    id: 'script-objection-busy',
    category: 'objection',
    title: 'Objection: I am too busy',
    text: 'That is exactly why this model works. We execute in focused blocks, not all day. If you can commit 60-90 minutes daily, you can still produce.'
  }
];

function clean(v = '') { return String(v || '').trim(); }
function nowIso() { return new Date().toISOString(); }

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const category = clean(searchParams.get('category') || '').toLowerCase();

  const rows = await loadJsonStore(STORE_PATH, DEFAULT_SCRIPTS);
  const list = Array.isArray(rows) ? rows : DEFAULT_SCRIPTS;
  const filtered = category ? list.filter((r) => clean(r?.category).toLowerCase() === category) : list;

  return Response.json({ ok: true, rows: filtered });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = clean(body?.action || '').toLowerCase();
  const rows = await loadJsonStore(STORE_PATH, DEFAULT_SCRIPTS);
  const list = Array.isArray(rows) ? rows : DEFAULT_SCRIPTS;

  if (action === 'upsert') {
    const id = clean(body?.id) || `script_${Date.now()}`;
    const category = clean(body?.category || 'general').toLowerCase();
    const title = clean(body?.title);
    const text = clean(body?.text);

    if (!title || !text) {
      return Response.json({ ok: false, error: 'missing_title_or_text' }, { status: 400 });
    }

    const idx = list.findIndex((r) => clean(r?.id) === id);
    const next = {
      ...(idx >= 0 ? list[idx] : {}),
      id,
      category,
      title,
      text,
      updatedAt: nowIso()
    };

    if (idx >= 0) list[idx] = next;
    else list.unshift(next);
    await saveJsonStore(STORE_PATH, list);
    return Response.json({ ok: true, row: next, rows: list });
  }

  if (action === 'delete') {
    const id = clean(body?.id);
    const next = list.filter((r) => clean(r?.id) !== id);
    await saveJsonStore(STORE_PATH, next);
    return Response.json({ ok: true, rows: next });
  }

  return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
}
