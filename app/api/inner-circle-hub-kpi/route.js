import { loadJsonStore } from '../../../lib/blobJsonStore';

const LEAD_ROUTER_EVENTS_PATH = 'stores/lead-router-events.json';
const POLICY_SUBMISSIONS_PATH = 'stores/policy-submissions.json';
const SPONSORSHIP_BOOKINGS_PATH = 'stores/sponsorship-bookings.json';
const SPONSORSHIP_APPS_PATH = 'stores/sponsorship-applications.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }

const NAME_ALIASES = {
  'latricia wright': 'leticia wright',
  'letitia wright': 'leticia wright',
  'latrisha wright': 'leticia wright',
  'dr breanna james': 'breanna james',
  'dr. breanna james': 'breanna james',
  'brianna james': 'breanna james',
  'kellen brown': 'kelin brown',
  'madeline adams': 'madalyn adams',
  'angelica lassiter': 'angelique lassiter',
  'angelic lassiter': 'angelique lassiter',
  link: 'kimora link'
};

function canonicalName(v = '') {
  const n = normalize(v);
  if (!n) return '';
  return NAME_ALIASES[n] || n;
}

function samePersonName(a = '', b = '') {
  const x = canonicalName(a);
  const y = canonicalName(b);
  if (!x || !y) return false;
  return x === y;
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

function dateKeyFromIso(iso = '') {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  const keys = new Set((rows || []).map((r) => personKey(r)));
  return keys.size;
}

function uniquePeople(rows = []) {
  const seen = new Set();
  const out = [];
  for (const r of rows || []) {
    const k = personKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function recommendedPotential(row = {}) {
  const explicit = Number(row?.payoutAmount || 0) || 0;
  if (explicit > 0) return explicit;
  const monthly = Number(row?.monthlyPremium || row?.premium || 0) || 0;
  if (monthly <= 0) return 500;
  return Math.min(monthly, 700);
}

function isOwnerMatch(row = {}, ownerName = '', ownerEmail = '') {
  const n = canonicalName(ownerName);
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
  ].map(canonicalName);

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

  if (n && candidates.some((c) => samePersonName(c, n))) return true;
  if (e && emailCandidates.some((c) => c === e)) return true;
  return false;
}

function rowMatchesOwner(row = {}, ownerName = '', ownerEmail = '', ownerRefCodes = []) {
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
  const codeSet = new Set((Array.isArray(ownerRefCodes) ? ownerRefCodes : [ownerRefCodes]).map((v) => clean(v).toLowerCase()).filter(Boolean));
  if (!codeSet.size) return false;
  return refCandidates.some((r) => r && codeSet.has(r));
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ownerName = clean(searchParams.get('name') || '');
  const ownerEmail = clean(searchParams.get('email') || '');

  if (!ownerName && !ownerEmail) {
    return Response.json({ ok: false, error: 'missing_name_or_email' }, { status: 400 });
  }

  const [events, policyRows, bookingRows, sponsorshipApps] = await Promise.all([
    loadJsonStore(LEAD_ROUTER_EVENTS_PATH, []),
    loadJsonStore(POLICY_SUBMISSIONS_PATH, []),
    loadJsonStore(SPONSORSHIP_BOOKINGS_PATH, []),
    loadJsonStore(SPONSORSHIP_APPS_PATH, [])
  ]);

  const ownerRefCodes = Array.from(new Set([
    refCodeFromName(ownerName),
    refCodeFromName(canonicalName(ownerName)),
    canonicalName(ownerName) === 'leticia wright' ? 'latricia_wright' : '',
    canonicalName(ownerName) === 'leticia wright' ? 'leticia_wright' : '',
    canonicalName(ownerName) === 'leticia wright' ? 'letitia_wright' : '',
    canonicalName(ownerName) === 'leticia wright' ? 'latrisha_wright' : '',
    normalize(ownerName) === 'kimora link' ? 'link' : ''
  ].filter(Boolean)));
  const appById = new Map((sponsorshipApps || []).map((a) => [clean(a?.id), a]));
  const ownerAppKeys = new Set(
    (sponsorshipApps || [])
      .filter((a) => rowMatchesOwner(a, ownerName, ownerEmail, ownerRefCodes))
      .map((a) => personKey({
        name: clean(`${a?.firstName || ''} ${a?.lastName || ''}` || a?.name || ''),
        email: clean(a?.email || ''),
        phone: clean(a?.phone || '')
      }))
  );

  const currentMonth = monthKey(new Date());
  const currentDateKey = dateKeyFromIso(new Date().toISOString());

  const assignedThisMonth = (events || []).filter((r) => {
    const type = normalize(r?.type || '');
    const isAssign = type.includes('assign') || type.includes('release_to_agent') || type.includes('released');
    const ts = r?.createdAt || r?.created_at || r?.timestamp || r?.at || '';
    return isAssign && monthKeyFromIso(ts) === currentMonth && rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCodes);
  });

  const leadsReceived = assignedThisMonth.length;

  const closesThisMonthRows = (policyRows || []).filter((r) => {
    if (!normalize(r?.status || '').startsWith('approved')) return false;
    const ts = r?.approvedAt || r?.approved_at || r?.updatedAt || r?.submittedAt || r?.submitted_at || '';
    if (monthKeyFromIso(ts) !== currentMonth) return false;
    return rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCodes);
  }).map((r) => ({
    name: clean(r?.applicantName || r?.name || r?.insuredName || ''),
    email: clean(r?.applicantEmail || r?.email || ''),
    phone: clean(r?.applicantPhone || r?.phone || '')
  }));

  const approvedPolicyRows = uniquePeople((policyRows || []).filter((r) => {
    const ts = r?.approvedAt || r?.approved_at || r?.updatedAt || r?.submittedAt || r?.submitted_at || '';
    if (monthKeyFromIso(ts) !== currentMonth) return false;
    if (!normalize(r?.status || '').startsWith('approved')) return false;
    return rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCodes);
  }).map((r) => ({
    ...r,
    name: clean(r?.applicantName || r?.name || r?.insuredName || ''),
    email: clean(r?.applicantEmail || r?.email || ''),
    phone: clean(r?.applicantPhone || r?.phone || '')
  })));

  const approvedPolicyRowsToday = uniquePeople((policyRows || []).filter((r) => {
    const ts = r?.approvedAt || r?.approved_at || r?.updatedAt || r?.submittedAt || r?.submitted_at || '';
    if (dateKeyFromIso(ts) !== currentDateKey) return false;
    if (!normalize(r?.status || '').startsWith('approved')) return false;
    return rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCodes);
  }).map((r) => ({
    ...r,
    name: clean(r?.applicantName || r?.name || r?.insuredName || ''),
    email: clean(r?.applicantEmail || r?.email || ''),
    phone: clean(r?.applicantPhone || r?.phone || '')
  })));

  const bookedThisMonthRows = (bookingRows || []).filter((r) => {
    const ts = r?.created_at || r?.updated_at || '';
    if (monthKeyFromIso(ts) !== currentMonth) return false;
    const status = normalize(r?.booking_status || 'booked');
    const bookingQualified = ['booked', 'confirmed', 'completed'].includes(status);
    if (!bookingQualified) return false;

    if (rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCodes)) return true;
    const srcId = clean(r?.source_application_id || '');
    const app = appById.get(srcId);
    if (app && rowMatchesOwner(app, ownerName, ownerEmail, ownerRefCodes)) return true;

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

  const approvedThisMonthRows = (sponsorshipApps || []).filter((r) => {
    const status = normalize(r?.status || '');
    if (!status.includes('approved')) return false;
    const ts = r?.approved_at || r?.reviewedAt || r?.updatedAt || r?.submitted_at || '';
    if (monthKeyFromIso(ts) !== currentMonth) return false;
    return rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCodes);
  }).map((r) => ({
    name: clean(`${r?.firstName || ''} ${r?.lastName || ''}` || r?.name || ''),
    email: clean(r?.email || ''),
    phone: clean(r?.phone || '')
  }));

  const closesThisMonth = uniquePeopleCount(closesThisMonthRows);
  const bookingsThisMonth = uniquePeopleCount(bookedThisMonthRows);
  const sponsorshipApprovedThisMonth = uniquePeopleCount(approvedThisMonthRows);

  let displayLeadsReceived = leadsReceived;
  let displayBookingsThisMonth = bookingsThisMonth;
  let displayClosesThisMonth = closesThisMonth;
  let displaySponsorshipApprovedThisMonth = sponsorshipApprovedThisMonth;
  let displayPotentialEarned = Number(approvedPolicyRows.reduce((sum, r) => sum + recommendedPotential(r), 0).toFixed(2));
  let displayClosesToday = uniquePeopleCount(approvedPolicyRowsToday);
  let displayPotentialToday = Number(approvedPolicyRowsToday.reduce((sum, r) => sum + recommendedPotential(r), 0).toFixed(2));

  const personalIsEmpty = displayLeadsReceived === 0 && displayBookingsThisMonth === 0 && displayClosesThisMonth === 0 && displaySponsorshipApprovedThisMonth === 0;

  if (personalIsEmpty) {
    const teamAssigned = (events || []).filter((r) => {
      const type = normalize(r?.type || '');
      const isAssign = type.includes('assign') || type.includes('release_to_agent') || type.includes('released');
      const ts = r?.createdAt || r?.created_at || r?.timestamp || r?.at || '';
      return isAssign && monthKeyFromIso(ts) === currentMonth;
    });

    const teamApprovedPolicies = uniquePeople((policyRows || []).filter((r) => {
      const ts = r?.approvedAt || r?.approved_at || r?.updatedAt || r?.submittedAt || r?.submitted_at || '';
      return monthKeyFromIso(ts) === currentMonth && normalize(r?.status || '').startsWith('approved');
    }).map((r) => ({
      ...r,
      name: clean(r?.applicantName || r?.name || r?.insuredName || ''),
      email: clean(r?.applicantEmail || r?.email || ''),
      phone: clean(r?.applicantPhone || r?.phone || '')
    })));

    const teamApprovedPoliciesToday = uniquePeople((policyRows || []).filter((r) => {
      const ts = r?.approvedAt || r?.approved_at || r?.updatedAt || r?.submittedAt || r?.submitted_at || '';
      return dateKeyFromIso(ts) === currentDateKey && normalize(r?.status || '').startsWith('approved');
    }).map((r) => ({
      ...r,
      name: clean(r?.applicantName || r?.name || r?.insuredName || ''),
      email: clean(r?.applicantEmail || r?.email || ''),
      phone: clean(r?.applicantPhone || r?.phone || '')
    })));

    const teamBookings = (bookingRows || []).filter((r) => {
      const ts = r?.created_at || r?.updated_at || '';
      const status = normalize(r?.booking_status || 'booked');
      const bookingQualified = ['booked', 'confirmed', 'completed'].includes(status);
      return monthKeyFromIso(ts) === currentMonth && bookingQualified;
    }).map((r) => ({
      name: clean(r?.applicant_name || r?.name || ''),
      email: clean(r?.applicant_email || r?.email || ''),
      phone: clean(r?.applicant_phone || r?.phone || '')
    }));

    const teamApprovedApps = (sponsorshipApps || []).filter((r) => {
      const status = normalize(r?.status || '');
      const ts = r?.approved_at || r?.reviewedAt || r?.updatedAt || r?.submitted_at || '';
      return status.includes('approved') && monthKeyFromIso(ts) === currentMonth;
    }).map((r) => ({
      name: clean(`${r?.firstName || ''} ${r?.lastName || ''}` || r?.name || ''),
      email: clean(r?.email || ''),
      phone: clean(r?.phone || '')
    }));

    displayLeadsReceived = teamAssigned.length;
    displayBookingsThisMonth = uniquePeopleCount(teamBookings);
    displayClosesThisMonth = uniquePeopleCount(teamApprovedPolicies);
    displaySponsorshipApprovedThisMonth = uniquePeopleCount(teamApprovedApps);
    displayPotentialEarned = Number(teamApprovedPolicies.reduce((sum, r) => sum + recommendedPotential(r), 0).toFixed(2));
    displayClosesToday = uniquePeopleCount(teamApprovedPoliciesToday);
    displayPotentialToday = Number(teamApprovedPoliciesToday.reduce((sum, r) => sum + recommendedPotential(r), 0).toFixed(2));
  }

  const closeRate = displayLeadsReceived > 0 ? (displayClosesThisMonth / displayLeadsReceived) * 100 : 0;

  return Response.json({
    ok: true,
    month: currentMonth,
    kpi: {
      leadsReceived: displayLeadsReceived,
      monthlyTarget: 60,
      remainingToTarget: Math.max(0, 60 - displayLeadsReceived),
      bookingsThisMonth: displayBookingsThisMonth,
      closesThisMonth: displayClosesThisMonth,
      sponsorshipApprovedThisMonth: displaySponsorshipApprovedThisMonth,
      closeRate: Number(closeRate.toFixed(1)),
      potentialEarned: displayPotentialEarned,
      grossEarned: displayPotentialEarned,
      closesToday: displayClosesToday,
      potentialToday: displayPotentialToday
    }
  });
}
