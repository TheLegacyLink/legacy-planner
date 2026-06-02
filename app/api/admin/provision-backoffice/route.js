/**
 * POST /api/admin/provision-backoffice
 * Creates a start-intake record for an approved agent so they can authenticate
 * into the licensed back office immediately. Called on approval + backfill.
 *
 * Body: { actorEmail, agents: [{ firstName, lastName, email, phone, homeState, trackType, source }] }
 */
import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';

const STORE_PATH = 'stores/start-intake.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase(); }
function nowIso() { return new Date().toISOString(); }

function abbreviateState(s = '') {
  const n = clean(s).toUpperCase();
  if (n.length === 2) return n;
  const map = {
    'ALABAMA':'AL','ALASKA':'AK','ARIZONA':'AZ','ARKANSAS':'AR','CALIFORNIA':'CA',
    'COLORADO':'CO','CONNECTICUT':'CT','DELAWARE':'DE','FLORIDA':'FL','GEORGIA':'GA',
    'HAWAII':'HI','IDAHO':'ID','ILLINOIS':'IL','INDIANA':'IN','IOWA':'IA','KANSAS':'KS',
    'KENTUCKY':'KY','LOUISIANA':'LA','MAINE':'ME','MARYLAND':'MD','MASSACHUSETTS':'MA',
    'MICHIGAN':'MI','MINNESOTA':'MN','MISSISSIPPI':'MS','MISSOURI':'MO','MONTANA':'MT',
    'NEBRASKA':'NE','NEVADA':'NV','NEW HAMPSHIRE':'NH','NEW JERSEY':'NJ','NEW MEXICO':'NM',
    'NEW YORK':'NY','NORTH CAROLINA':'NC','NORTH DAKOTA':'ND','OHIO':'OH','OKLAHOMA':'OK',
    'OREGON':'OR','PENNSYLVANIA':'PA','RHODE ISLAND':'RI','SOUTH CAROLINA':'SC',
    'SOUTH DAKOTA':'SD','TENNESSEE':'TN','TEXAS':'TX','UTAH':'UT','VERMONT':'VT',
    'VIRGINIA':'VA','WASHINGTON':'WA','WEST VIRGINIA':'WV','WISCONSIN':'WI','WYOMING':'WY',
    'DISTRICT OF COLUMBIA':'DC','DC':'DC',
  };
  return map[n] || n.slice(0, 2) || 'XX';
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const actor = normalize(body?.actorEmail || '');
  if (actor !== 'kimora@thelegacylink.com') {
    return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const agents = Array.isArray(body?.agents) ? body.agents : [];
  if (!agents.length) return Response.json({ ok: false, error: 'no_agents_provided' }, { status: 400 });

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];

  let created = 0, skipped = 0;
  const results = [];

  for (const agent of agents) {
    const email = normalize(agent?.email || '');
    if (!email || !email.includes('@')) { results.push({ email, status: 'skip_invalid_email' }); skipped++; continue; }

    const existing = list.find((r) => normalize(r?.email) === email);
    if (existing) { results.push({ email, status: 'skip_already_exists', contractStatus: existing.contractStatus }); skipped++; continue; }

    const ts = nowIso();
    const record = {
      id: `intake_auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      trackType: normalize(agent?.trackType || 'licensed') === 'unlicensed' ? 'unlicensed' : 'licensed',
      firstName: clean(agent?.firstName || ''),
      lastName: clean(agent?.lastName || ''),
      email,
      phone: clean(agent?.phone || '').replace(/\D/g, '').slice(-10),
      birthDate: clean(agent?.birthDate || ''),
      homeState: abbreviateState(agent?.homeState || agent?.state || ''),
      npn: clean(agent?.npn || ''),
      licensedStates: [],
      source: clean(agent?.source || 'auto_provisioned_on_approval'),
      status: 'intake_submitted',
      credentialsStatus: 'pending',
      contractStatus: 'pending',
      contractSignedAt: '',
      contractMatchedBy: '',
      welcomeEmailStatus: 'skipped',
      createdAt: ts,
      updatedAt: ts,
    };

    list.push(record);
    results.push({ email, status: 'created', name: `${record.firstName} ${record.lastName}` });
    created++;
  }

  if (created > 0) await saveJsonStore(STORE_PATH, list);

  return Response.json({ ok: true, created, skipped, total: agents.length, results });
}
