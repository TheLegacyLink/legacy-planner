import { loadJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/onboarding-decisions.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase(); }

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const email = normalize(searchParams.get('email') || '');
  const name = normalize(searchParams.get('name') || '');

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];

  const filtered = (!email && !name)
    ? list
    : list.filter((r) => {
      const rEmail = normalize(r?.applicantEmail || '');
      const rName = normalize(r?.applicantName || '');
      const ref = normalize(r?.referredByName || '');
      const writer = normalize(r?.policyWriterName || '');
      if (email && rEmail === email) return true;
      if (name && (rName === name || ref === name || writer === name)) return true;
      return false;
    });

  filtered.sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
  return Response.json({ ok: true, rows: filtered });
}
