import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/start-intake.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase(); }
function nowIso() { return new Date().toISOString(); }

function normalizePhone(v = '') {
  const d = clean(v).replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  return d;
}

function parseStates(input) {
  const arr = Array.isArray(input)
    ? input
    : String(input || '').split(',');
  return [...new Set(arr.map((s) => clean(s).toUpperCase()).filter(Boolean))];
}

function validate(body = {}) {
  const trackType = normalize(body?.trackType || '');
  if (!['licensed', 'unlicensed'].includes(trackType)) return { ok: false, error: 'invalid_track_type' };

  const firstName = clean(body?.firstName || '');
  const lastName = clean(body?.lastName || '');
  const email = normalize(body?.email || '');
  const phone = normalizePhone(body?.phone || '');
  const homeState = clean(body?.homeState || '').toUpperCase();

  if (!firstName || !lastName) return { ok: false, error: 'missing_name' };
  if (!email || !email.includes('@')) return { ok: false, error: 'missing_valid_email' };
  if (!phone || phone.length < 10) return { ok: false, error: 'missing_valid_phone' };
  if (!homeState || homeState.length !== 2) return { ok: false, error: 'missing_home_state' };

  const npn = clean(body?.npn || '');
  const licensedStates = parseStates(body?.licensedStates || []);

  if (trackType === 'licensed') {
    if (!npn || !/^\d{6,12}$/.test(npn)) return { ok: false, error: 'missing_valid_npn' };
    if (!licensedStates.length) return { ok: false, error: 'missing_licensed_states' };
  }

  return {
    ok: true,
    value: {
      trackType,
      firstName,
      lastName,
      email,
      phone,
      homeState,
      npn: trackType === 'licensed' ? npn : '',
      licensedStates: trackType === 'licensed' ? licensedStates : []
    }
  };
}

export async function GET() {
  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];
  list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  return Response.json({ ok: true, rows: list });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const check = validate(body);
  if (!check.ok) return Response.json({ ok: false, error: check.error }, { status: 400 });

  const data = check.value;
  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];

  const idx = list.findIndex((r) => normalize(r?.email) === data.email);
  const previous = idx >= 0 ? list[idx] : null;
  const ts = nowIso();

  const next = {
    id: clean(previous?.id || `intake_${Date.now()}`),
    ...data,
    source: clean(body?.source || 'community_start_portal') || 'community_start_portal',
    status: clean(previous?.status || 'intake_submitted') || 'intake_submitted',
    credentialsStatus: clean(previous?.credentialsStatus || 'pending') || 'pending',
    welcomeEmailStatus: clean(previous?.welcomeEmailStatus || 'pending') || 'pending',
    notes: clean(body?.notes || previous?.notes || ''),
    createdAt: clean(previous?.createdAt || ts),
    updatedAt: ts
  };

  if (idx >= 0) list[idx] = next;
  else list.unshift(next);

  await saveJsonStore(STORE_PATH, list);
  return Response.json({ ok: true, row: next, updatedExisting: idx >= 0 });
}
