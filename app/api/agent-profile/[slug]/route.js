import { loadJsonStore } from '../../../../lib/blobJsonStore';

const CHECKOUT_PROFILES_PATH = 'stores/linkleads-checkout-profiles.json';

function clean(v = '') { return String(v || '').trim(); }
function slugify(v = '') {
  return clean(v)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function GET(_req, { params }) {
  const slug = slugify(params?.slug || '');
  if (!slug) return Response.json({ ok: false, error: 'missing_slug' }, { status: 400 });

  const rows = await loadJsonStore(CHECKOUT_PROFILES_PATH, []);
  const sorted = (Array.isArray(rows) ? rows : [])
    .slice()
    .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());

  const hit = sorted.find((r) => {
    const s = r?.firstTimeSetup || {};
    const fullName = clean(`${s?.firstName || ''} ${s?.lastName || ''}`);
    const byName = slugify(fullName);
    const byEmailPrefix = slugify(clean(r?.buyerEmail || '').split('@')[0] || '');
    return slug === byName || slug === byEmailPrefix || slug === clean(r?.agentSlug || '');
  });

  if (!hit) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  const s = hit.firstTimeSetup || {};
  return Response.json({
    ok: true,
    profile: {
      slug,
      name: clean(`${s?.firstName || ''} ${s?.lastName || ''}`),
      title: clean(s?.displayAgentTitle || s?.title || 'Licensed Agent'),
      email: clean(s?.displayAgentEmail || s?.email || ''),
      phone: clean(s?.displayAgentPhone || s?.phone || ''),
      website: clean(s?.displayAgentWebsite || s?.agentWebsite || ''),
      calendar: clean(s?.displayAgentCalendarLink || ''),
      npnId: clean(s?.displayAgentNpn || s?.npnId || ''),
      licensedStates: Array.isArray(s?.licensedStates) ? s.licensedStates : [],
      profilePhotoDataUrl: clean(s?.profilePhotoDataUrl || '')
    }
  });
}
