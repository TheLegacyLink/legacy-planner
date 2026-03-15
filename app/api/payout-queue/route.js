import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/payout-queue.json';

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase(); }

function defaultMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const month = clean(searchParams.get('month')) || defaultMonthKey();
  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const filtered = list.filter((r) => clean(r?.month) === month);
  return Response.json({ ok: true, month, rows: filtered });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = norm(body?.action);
  const month = clean(body?.month) || defaultMonthKey();
  const agent = clean(body?.agent);
  const note = clean(body?.note);

  if (!action || !month) return Response.json({ ok: false, error: 'missing_action_or_month' }, { status: 400 });

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];

  if (action === 'mark_paid' || action === 'mark_unpaid') {
    if (!agent) return Response.json({ ok: false, error: 'missing_agent' }, { status: 400 });
    const idx = list.findIndex((r) => clean(r?.month) === month && norm(r?.agent) === norm(agent));
    const payload = {
      month,
      agent,
      paid: action === 'mark_paid',
      paidAt: action === 'mark_paid' ? new Date().toISOString() : '',
      updatedAt: new Date().toISOString(),
      note
    };
    if (idx >= 0) list[idx] = { ...list[idx], ...payload };
    else list.push(payload);
    await saveJsonStore(STORE_PATH, list);
    return Response.json({ ok: true, month, row: payload });
  }

  if (action === 'mark_many_paid') {
    const agents = Array.isArray(body?.agents) ? body.agents.map(clean).filter(Boolean) : [];
    if (!agents.length) return Response.json({ ok: false, error: 'missing_agents' }, { status: 400 });
    const now = new Date().toISOString();
    for (const agentName of agents) {
      const idx = list.findIndex((r) => clean(r?.month) === month && norm(r?.agent) === norm(agentName));
      const payload = { month, agent: agentName, paid: true, paidAt: now, updatedAt: now, note };
      if (idx >= 0) list[idx] = { ...list[idx], ...payload };
      else list.push(payload);
    }
    await saveJsonStore(STORE_PATH, list);
    return Response.json({ ok: true, month, count: agents.length });
  }

  return Response.json({ ok: false, error: 'invalid_action' }, { status: 400 });
}
