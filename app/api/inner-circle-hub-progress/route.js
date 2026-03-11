import { loadJsonStore } from '../../../lib/blobJsonStore';

const MEMBERS_PATH = 'stores/inner-circle-hub-members.json';
const DAILY_PATH = 'stores/inner-circle-hub-daily.json';
const LEAD_ROUTER_EVENTS_PATH = 'stores/lead-router-events.json';
const POLICY_SUBMISSIONS_PATH = 'stores/policy-submissions.json';
const SPONSORSHIP_BOOKINGS_PATH = 'stores/sponsorship-bookings.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function toNum(v = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

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

function kpiForMember(events = [], policyRows = [], bookingRows = [], member = {}, currentMonth = '') {
  const ownerName = clean(member?.applicantName);
  const ownerEmail = clean(member?.email);

  const assignedThisMonth = (events || []).filter((r) => {
    const type = normalize(r?.type || '');
    const isAssign = type.includes('assign') || type.includes('release_to_agent') || type.includes('released');
    const ts = r?.createdAt || r?.created_at || r?.timestamp || r?.at || '';
    return isAssign && monthKeyFromIso(ts) === currentMonth && isOwnerMatch(r, ownerName, ownerEmail);
  });

  const leadsReceived = assignedThisMonth.length;

  const closesThisMonth = (policyRows || []).filter((r) => {
    const ts = r?.submittedAt || r?.submitted_at || r?.createdAt || r?.created_at || '';
    return monthKeyFromIso(ts) === currentMonth && isOwnerMatch(r, ownerName, ownerEmail);
  }).length;

  const bookingsThisMonth = (bookingRows || []).filter((r) => {
    const ts = r?.created_at || r?.updated_at || '';
    return monthKeyFromIso(ts) === currentMonth && isOwnerMatch(r, ownerName, ownerEmail);
  }).length;

  const closeRate = leadsReceived > 0 ? (closesThisMonth / leadsReceived) * 100 : 0;
  const grossEarned = closesThisMonth > 0 ? 1200 + Math.max(0, closesThisMonth - 1) * 500 : 0;

  return {
    leadsReceived,
    bookingsThisMonth,
    closesThisMonth,
    closeRate: Number(closeRate.toFixed(1)),
    grossEarned
  };
}

export async function GET() {
  const [members, dailyRows, events, policyRows, bookingRows] = await Promise.all([
    loadJsonStore(MEMBERS_PATH, []),
    loadJsonStore(DAILY_PATH, []),
    loadJsonStore(LEAD_ROUTER_EVENTS_PATH, []),
    loadJsonStore(POLICY_SUBMISSIONS_PATH, []),
    loadJsonStore(SPONSORSHIP_BOOKINGS_PATH, [])
  ]);

  const currentMonth = monthKey(new Date());
  const memberRows = (members || []).filter((m) => clean(m?.email));

  const rows = memberRows.map((m) => {
    const email = clean(m?.email).toLowerCase();
    const trackerMonth = (dailyRows || []).filter((d) => clean(d?.email).toLowerCase() === email && clean(d?.dateKey).startsWith(currentMonth));

    const trackerTotals = trackerMonth.reduce((acc, r) => ({
      calls: acc.calls + toNum(r?.calls),
      texts: acc.texts + toNum(r?.texts),
      followUps: acc.followUps + toNum(r?.followUps),
      bookings: acc.bookings + toNum(r?.bookings),
      apps: acc.apps + toNum(r?.apps)
    }), { calls: 0, texts: 0, followUps: 0, bookings: 0, apps: 0 });

    return {
      id: clean(m?.id),
      applicantName: clean(m?.applicantName),
      email,
      active: Boolean(m?.active),
      contractSignedAt: clean(m?.contractSignedAt),
      paymentReceivedAt: clean(m?.paymentReceivedAt),
      onboardingUnlockedAt: clean(m?.onboardingUnlockedAt),
      kpi: kpiForMember(events, policyRows, bookingRows, m, currentMonth),
      trackerTotals,
      trackerDaysLogged: trackerMonth.length
    };
  });

  return Response.json({ ok: true, month: currentMonth, rows });
}
