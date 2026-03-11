import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/inner-circle-hub-scripts.json';

const DEFAULT_SCRIPTS = [
  {
    id: 'script-sponsor-opener',
    category: 'sponsorship',
    title: 'Sponsorship Interest Opener',
    text: 'Hey [Name], are you still open to earning an extra $2k-$5k this month through our sponsorship path?'
  },
  {
    id: 'script-sponsor-followup',
    category: 'sponsorship',
    title: 'Sponsorship Follow-Up',
    text: 'Quick follow-up: I can send you the exact steps our sponsorship producers are using this week. Want me to send it now?'
  },
  {
    id: 'script-life-insurance-opener',
    category: 'life-insurance',
    title: 'Life Insurance Interest Opener',
    text: 'Hey [Name], if your family had to use your income tomorrow, would they be fully protected? I can help you build a plan today.'
  },
  {
    id: 'script-life-insurance-objection',
    category: 'life-insurance',
    title: 'Life Insurance Objection: Need to think about it',
    text: 'Totally fair. Most families wait because they are unsure, but waiting is where risk stays high. Let me simplify this into two options right now.'
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
    const stamp = nowIso();
    const next = {
      ...(idx >= 0 ? list[idx] : {}),
      id,
      category,
      title,
      text,
      createdAt: idx >= 0 ? clean(list[idx]?.createdAt) || stamp : stamp,
      updatedAt: stamp
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
