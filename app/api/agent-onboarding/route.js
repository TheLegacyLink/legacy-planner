import { loadJsonStore, saveJsonStore, loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

const ONBOARDING_PATH = 'stores/agent-onboarding.json';
const LEAD_ROUTER_SETTINGS_PATH = 'stores/lead-router-settings.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

export async function GET() {
  const rows = await loadJsonStore(ONBOARDING_PATH, []);
  const list = (Array.isArray(rows) ? rows : [])
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

  return Response.json({ ok: true, rows: list });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const mode = normalize(body?.mode || 'upsert');
  if (!['upsert', 'remove'].includes(mode)) {
    return Response.json({ ok: false, error: 'unsupported_mode' }, { status: 400 });
  }

  const name = clean(body?.name || body?.agentName || '');
  if (!name) return Response.json({ ok: false, error: 'missing_name' }, { status: 400 });

  const rows = await loadJsonStore(ONBOARDING_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => normalize(r?.name) === normalize(name));

  if (mode === 'remove') {
    if (idx >= 0) list.splice(idx, 1);
    await saveJsonStore(ONBOARDING_PATH, list);
    return Response.json({ ok: true, removed: idx >= 0 });
  }

  const row = {
    name,
    email: clean(body?.email || ''),
    phone: clean(body?.phone || ''),
    ghlUserId: clean(body?.ghlUserId || ''),
    leadConnectorEmail: clean(body?.leadConnectorEmail || ''),
    leadConnectorPassword: clean(body?.leadConnectorPassword || ''),
    group: normalize(body?.group || '') === 'inner' ? 'inner' : 'general',
    active: body?.active !== false,
    paused: Boolean(body?.paused),
    delayedReleaseEnabled: body?.delayedReleaseEnabled !== false,
    capPerDay: body?.capPerDay == null || body?.capPerDay === '' ? null : Number(body.capPerDay),
    capPerWeek: body?.capPerWeek == null || body?.capPerWeek === '' ? null : Number(body.capPerWeek),
    capPerMonth: body?.capPerMonth == null || body?.capPerMonth === '' ? null : Number(body.capPerMonth),
    updatedAt: nowIso(),
    createdAt: idx >= 0 ? clean(list[idx]?.createdAt || nowIso()) : nowIso()
  };

  if (idx >= 0) list[idx] = { ...list[idx], ...row };
  else list.push(row);

  await saveJsonStore(ONBOARDING_PATH, list);

  // Optional sync: ensure agent exists in lead router settings so they are selectable/assignable.
  const settings = await loadJsonFile(LEAD_ROUTER_SETTINGS_PATH, {});
  const agents = Array.isArray(settings?.agents) ? settings.agents : [];
  const aIdx = agents.findIndex((a) => normalize(a?.name) === normalize(name));
  const syncedAgent = {
    name,
    active: row.active,
    paused: row.paused,
    delayedReleaseEnabled: row.delayedReleaseEnabled,
    windowStart: clean(agents[aIdx]?.windowStart || '09:00') || '09:00',
    windowEnd: clean(agents[aIdx]?.windowEnd || '21:00') || '21:00',
    capPerDay: row.capPerDay,
    capPerWeek: row.capPerWeek,
    capPerMonth: row.capPerMonth
  };

  if (aIdx >= 0) agents[aIdx] = { ...agents[aIdx], ...syncedAgent };
  else agents.push(syncedAgent);

  await saveJsonFile(LEAD_ROUTER_SETTINGS_PATH, { ...settings, agents });

  return Response.json({ ok: true, row });
}
