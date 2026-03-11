import { loadJsonStore } from '../../../lib/blobJsonStore';

const LEAD_ROUTER_EVENTS_PATH = 'stores/lead-router-events.json';
const POLICY_SUBMISSIONS_PATH = 'stores/policy-submissions.json';
const SPONSORSHIP_BOOKINGS_PATH = 'stores/sponsorship-bookings.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }

function monthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthKeyFromIso(iso = '') {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return '';
  return monthKey(d);
}

function isOwnerMatch(row = {}, ownerName = '', ownerEmail = '') {
  const n = normalize(ownerName);
  const e = normalize(ownerEmail);

  const candidates = [
    row?.assignedTo,
    row?.assigned_to,
    row?.owner,
    row?.agent,
    row?.agentName,
    row?.producer,
    row?.referredBy,
    row?.referred_by
  ].map(normalize);

  const emailCandidates = [
    row?.assignedToEmail,
    row?.assigned_to_email,
    row?.ownerEmail,
    row?.agentEmail,
    row?.email,
    row?.producerEmail
  ].map(normalize);

  if (n && candidates.some((c) => c === n)) return true;
  if (e && emailCandidates.some((c) => c === e)) return true;
  return false;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ownerName = clean(searchParams.get('name') || '');
  const ownerEmail = clean(searchParams.get('email') || '');

  if (!ownerName && !ownerEmail) {
    return Response.json({ ok: false, error: 'missing_name_or_email' }, { status: 400 });
  }

  const [events, policyRows, bookingRows] = await Promise.all([
    loadJsonStore(LEAD_ROUTER_EVENTS_PATH, []),
    loadJsonStore(POLICY_SUBMISSIONS_PATH, []),
    loadJsonStore(SPONSORSHIP_BOOKINGS_PATH, [])
  ]);

  const currentMonth = monthKey(new Date());

  const assignedThisMonth = (events || []).filter((r) => {
    const type = normalize(r?.type || '');
    const isAssign = type.includes('assign') || type.includes('release_to_agent') || type.includes('released');
    const ts = r?.createdAt || r?.created_at || r?.timestamp || r?.at || '';
    return isAssign && monthKeyFromIso(ts) === currentMonth && isOwnerMatch(r, ownerName, ownerEmail);
  });

  const leadsReceived = assignedThisMonth.length;

  const closesThisMonth = (policyRows || []).filter((r) => {
    const ts = r?.submittedAt || r?.submitted_at || r?.createdAt || r?.created_at || '';
    if (monthKeyFromIso(ts) !== currentMonth) return false;
    return isOwnerMatch(r, ownerName, ownerEmail);
  }).length;

  const bookingsThisMonth = (bookingRows || []).filter((r) => {
    const ts = r?.created_at || r?.updated_at || '';
    if (monthKeyFromIso(ts) !== currentMonth) return false;
    return isOwnerMatch(r, ownerName, ownerEmail);
  }).length;

  const closeRate = leadsReceived > 0 ? (closesThisMonth / leadsReceived) * 100 : 0;
  const grossEarned = closesThisMonth > 0 ? 1200 + Math.max(0, closesThisMonth - 1) * 500 : 0;

  return Response.json({
    ok: true,
    month: currentMonth,
    kpi: {
      leadsReceived,
      monthlyTarget: 60,
      remainingToTarget: Math.max(0, 60 - leadsReceived),
      bookingsThisMonth,
      closesThisMonth,
      closeRate: Number(closeRate.toFixed(1)),
      grossEarned
    }
  });
}
