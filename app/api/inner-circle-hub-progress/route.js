import { loadJsonStore } from '../../../lib/blobJsonStore';

const MEMBERS_PATH = 'stores/inner-circle-hub-members.json';
const DAILY_PATH = 'stores/inner-circle-hub-daily.json';
const LEAD_ROUTER_EVENTS_PATH = 'stores/lead-router-events.json';
const POLICY_SUBMISSIONS_PATH = 'stores/policy-submissions.json';
const SPONSORSHIP_BOOKINGS_PATH = 'stores/sponsorship-bookings.json';
const SPONSORSHIP_APPS_PATH = 'stores/sponsorship-applications.json';

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

function refCodeFromName(name = '') {
  return clean(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizePhone(v = '') { return clean(v).replace(/\D/g, ''); }
function nameSignature(name = '') {
  const tokens = normalize(name).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean);
  if (!tokens.length) return '';
  if (tokens.length === 1) return tokens[0];
  return `${tokens[0]}_${tokens[tokens.length - 1]}`;
}

function personKey({ name = '', email = '', phone = '' } = {}) {
  const em = clean(email).toLowerCase();
  if (em) return `e:${em}`;
  const ph = normalizePhone(phone);
  if (ph) return `p:${ph}`;
  const sig = nameSignature(name);
  if (sig) return `s:${sig}`;
  return `n:${normalize(name).replace(/[^a-z0-9]/g, '')}`;
}

function uniquePeopleCount(rows = []) {
  return new Set((rows || []).map((r) => personKey(r))).size;
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
    row?.referred_by,
    row?.referredByName,
    row?.policyWriterName,
    row?.submittedBy,
    row?.submitted_by
  ].map(normalize);

  const emailCandidates = [
    row?.assignedToEmail,
    row?.assigned_to_email,
    row?.ownerEmail,
    row?.agentEmail,
    row?.email,
    row?.producerEmail,
    row?.submittedByEmail,
    row?.submitted_by_email
  ].map(normalize);

  if (n && candidates.some((c) => c === n)) return true;
  if (e && emailCandidates.some((c) => c === e)) return true;
  return false;
}

function rowMatchesOwner(row = {}, ownerName = '', ownerEmail = '', ownerRefCode = '') {
  if (isOwnerMatch(row, ownerName, ownerEmail)) return true;
  const refCandidates = [
    row?.refCode,
    row?.ref_code,
    row?.referralCode,
    row?.referral_code,
    row?.referredByCode,
    row?.referred_by_code,
    row?.source_ref_code,
    row?.agent_ref_code
  ].map((v) => clean(v).toLowerCase());
  return Boolean(ownerRefCode && refCandidates.some((r) => r && r === ownerRefCode));
}

function kpiForMember(events = [], policyRows = [], bookingRows = [], sponsorshipApps = [], member = {}, currentMonth = '') {
  const ownerName = clean(member?.applicantName);
  const ownerEmail = clean(member?.email);
  const ownerRefCode = refCodeFromName(ownerName);
  const appById = new Map((sponsorshipApps || []).map((a) => [clean(a?.id), a]));
  const ownerAppKeys = new Set(
    (sponsorshipApps || [])
      .filter((a) => rowMatchesOwner(a, ownerName, ownerEmail, ownerRefCode))
      .map((a) => personKey({
        name: clean(`${a?.firstName || ''} ${a?.lastName || ''}` || a?.name || ''),
        email: clean(a?.email || ''),
        phone: clean(a?.phone || '')
      }))
  );

  const assignedThisMonth = (events || []).filter((r) => {
    const type = normalize(r?.type || '');
    const isAssign = type.includes('assign') || type.includes('release_to_agent') || type.includes('released');
    const ts = r?.createdAt || r?.created_at || r?.timestamp || r?.at || '';
    return isAssign && monthKeyFromIso(ts) === currentMonth && rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCode);
  });
  const leadsReceived = assignedThisMonth.length;

  const closesRows = (policyRows || []).filter((r) => {
    const ts = r?.submittedAt || r?.submitted_at || r?.createdAt || r?.created_at || '';
    return monthKeyFromIso(ts) === currentMonth && rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCode);
  }).map((r) => ({
    name: clean(r?.applicantName || r?.name || r?.insuredName || ''),
    email: clean(r?.applicantEmail || r?.email || ''),
    phone: clean(r?.applicantPhone || r?.phone || '')
  }));

  const bookingRowsMonth = (bookingRows || []).filter((r) => {
    const ts = r?.created_at || r?.updated_at || '';
    if (monthKeyFromIso(ts) !== currentMonth) return false;
    const status = normalize(r?.booking_status || 'booked');
    const bookingQualified = ['booked', 'confirmed', 'completed'].includes(status);
    if (!bookingQualified) return false;
    if (rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCode)) return true;
    const app = appById.get(clean(r?.source_application_id || ''));
    if (app && rowMatchesOwner(app, ownerName, ownerEmail, ownerRefCode)) return true;

    const bookingPersonKey = personKey({
      name: clean(r?.applicant_name || r?.name || ''),
      email: clean(r?.applicant_email || r?.email || ''),
      phone: clean(r?.applicant_phone || r?.phone || '')
    });
    return ownerAppKeys.has(bookingPersonKey);
  }).map((r) => ({
    name: clean(r?.applicant_name || r?.name || ''),
    email: clean(r?.applicant_email || r?.email || ''),
    phone: clean(r?.applicant_phone || r?.phone || '')
  }));

  const approvedRows = (sponsorshipApps || []).filter((r) => {
    const status = normalize(r?.status || '');
    if (!status.includes('approved')) return false;
    const ts = r?.approved_at || r?.reviewedAt || r?.updatedAt || r?.submitted_at || '';
    return monthKeyFromIso(ts) === currentMonth && rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCode);
  }).map((r) => ({
    name: clean(`${r?.firstName || ''} ${r?.lastName || ''}` || r?.name || ''),
    email: clean(r?.email || ''),
    phone: clean(r?.phone || '')
  }));

  const closesThisMonth = uniquePeopleCount(closesRows);
  const bookingsThisMonth = uniquePeopleCount(bookingRowsMonth);
  const sponsorshipApprovedThisMonth = uniquePeopleCount(approvedRows);
  const closeRate = leadsReceived > 0 ? (closesThisMonth / leadsReceived) * 100 : 0;
  const grossEarned = sponsorshipApprovedThisMonth * 500;

  return {
    leadsReceived,
    bookingsThisMonth,
    closesThisMonth,
    sponsorshipApprovedThisMonth,
    closeRate: Number(closeRate.toFixed(1)),
    grossEarned
  };
}

export async function GET() {
  const [members, dailyRows, events, policyRows, bookingRows, sponsorshipApps] = await Promise.all([
    loadJsonStore(MEMBERS_PATH, []),
    loadJsonStore(DAILY_PATH, []),
    loadJsonStore(LEAD_ROUTER_EVENTS_PATH, []),
    loadJsonStore(POLICY_SUBMISSIONS_PATH, []),
    loadJsonStore(SPONSORSHIP_BOOKINGS_PATH, []),
    loadJsonStore(SPONSORSHIP_APPS_PATH, [])
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
      sponsorshipApps: acc.sponsorshipApps + toNum(r?.sponsorshipApps),
      fngSubmittedApps: acc.fngSubmittedApps + toNum(r?.fngSubmittedApps),
      appsTotal: acc.appsTotal + toNum(r?.sponsorshipApps) + toNum(r?.fngSubmittedApps) + toNum(r?.apps)
    }), { calls: 0, texts: 0, followUps: 0, bookings: 0, sponsorshipApps: 0, fngSubmittedApps: 0, appsTotal: 0 });

    return {
      id: clean(m?.id),
      applicantName: clean(m?.applicantName),
      email,
      active: Boolean(m?.active),
      contractSignedAt: clean(m?.contractSignedAt),
      paymentReceivedAt: clean(m?.paymentReceivedAt),
      onboardingUnlockedAt: clean(m?.onboardingUnlockedAt),
      kpi: kpiForMember(events, policyRows, bookingRows, sponsorshipApps, m, currentMonth),
      trackerTotals,
      trackerDaysLogged: trackerMonth.length
    };
  });

  return Response.json({ ok: true, month: currentMonth, rows });
}
