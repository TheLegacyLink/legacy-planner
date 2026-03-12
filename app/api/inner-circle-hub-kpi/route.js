import { loadJsonStore } from '../../../lib/blobJsonStore';

const LEAD_ROUTER_EVENTS_PATH = 'stores/lead-router-events.json';
const POLICY_SUBMISSIONS_PATH = 'stores/policy-submissions.json';
const SPONSORSHIP_BOOKINGS_PATH = 'stores/sponsorship-bookings.json';
const SPONSORSHIP_APPS_PATH = 'stores/sponsorship-applications.json';

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

  const currentMonth = monthKey(new Date());

  const assignedThisMonth = (events || []).filter((r) => {
    const type = normalize(r?.type || '');
    const isAssign = type.includes('assign') || type.includes('release_to_agent') || type.includes('released');
    const ts = r?.createdAt || r?.created_at || r?.timestamp || r?.at || '';
    return isAssign && monthKeyFromIso(ts) === currentMonth && rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCode);
  });

  const leadsReceived = assignedThisMonth.length;

  const closesThisMonthRows = (policyRows || []).filter((r) => {
    const ts = r?.submittedAt || r?.submitted_at || r?.createdAt || r?.created_at || '';
    if (monthKeyFromIso(ts) !== currentMonth) return false;
    return rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCode);
  }).map((r) => ({
    name: clean(r?.applicantName || r?.name || r?.insuredName || ''),
    email: clean(r?.applicantEmail || r?.email || ''),
    phone: clean(r?.applicantPhone || r?.phone || '')
  }));

  const approvedPolicyRows = uniquePeople((policyRows || []).filter((r) => {
    const ts = r?.approvedAt || r?.approved_at || r?.updatedAt || r?.submittedAt || r?.submitted_at || '';
    if (monthKeyFromIso(ts) !== currentMonth) return false;
    if (!normalize(r?.status || '').startsWith('approved')) return false;
    return rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCode);
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

    if (rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCode)) return true;
    const srcId = clean(r?.source_application_id || '');
    const app = appById.get(srcId);
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

  const approvedThisMonthRows = (sponsorshipApps || []).filter((r) => {
    const status = normalize(r?.status || '');
    if (!status.includes('approved')) return false;
    const ts = r?.approved_at || r?.reviewedAt || r?.updatedAt || r?.submitted_at || '';
    if (monthKeyFromIso(ts) !== currentMonth) return false;
    return rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCode);
  }).map((r) => ({
    name: clean(`${r?.firstName || ''} ${r?.lastName || ''}` || r?.name || ''),
    email: clean(r?.email || ''),
    phone: clean(r?.phone || '')
  }));

  const closesThisMonth = uniquePeopleCount(closesThisMonthRows);
  const bookingsThisMonth = uniquePeopleCount(bookedThisMonthRows);
  const sponsorshipApprovedThisMonth = uniquePeopleCount(approvedThisMonthRows);

  const closeRate = leadsReceived > 0 ? (closesThisMonth / leadsReceived) * 100 : 0;
  const potentialEarned = Number(approvedPolicyRows.reduce((sum, r) => sum + recommendedPotential(r), 0).toFixed(2));

  return Response.json({
    ok: true,
    month: currentMonth,
    kpi: {
      leadsReceived,
      monthlyTarget: 60,
      remainingToTarget: Math.max(0, 60 - leadsReceived),
      bookingsThisMonth,
      closesThisMonth,
      sponsorshipApprovedThisMonth,
      closeRate: Number(closeRate.toFixed(1)),
      potentialEarned,
      grossEarned: potentialEarned
    }
  });
}
