import { loadJsonStore } from '../../../lib/blobJsonStore';

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

function prevMonthKey(key, n = 1) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

// Matches sponsorship apps where the agent is the referral source.
// Checks referred_by, referredByName, sponsorDisplayName, referralName via rowMatchesOwner + extras.
function sponsorAppReferrerMatch(row = {}, ownerName = '', ownerEmail = '', ownerRefCodes = []) {
  if (rowMatchesOwner(row, ownerName, ownerEmail, ownerRefCodes)) return true;
  // Extra fields specific to sponsorship apps
  const n = canonicalName(ownerName);
  if (!n) return false;
  const extra = [row?.sponsorDisplayName, row?.referralName].map(canonicalName).filter(Boolean);
  return extra.some((c) => c === n);
}

function appToPerson(app = {}) {
  return {
    name: clean(`${app?.firstName || ''} ${app?.lastName || ''}`.trim() || app?.name || ''),
    email: clean(app?.email || ''),
    phone: clean(app?.phone || '')
  };
}

function buildPolicyPersonMap(policyRows = []) {
  const map = new Map();
  for (const p of (policyRows || [])) {
    const key = personKey({
      name: clean(p?.applicantName || p?.name || p?.insuredName || ''),
      email: clean(p?.applicantEmail || p?.email || ''),
      phone: clean(p?.applicantPhone || p?.phone || '')
    });
    if (key && !map.has(key)) map.set(key, p);
  }
  return map;
}

function computeMonthKpi(month, { sponsorshipApps, bookingRows, policyRows }, ownerName, ownerEmail, ownerRefCodes) {
  const appById = new Map((sponsorshipApps || []).map((a) => [clean(a?.id), a]));

  // ownerAppKeys: person keys for apps owned by this agent (used for booking lookup)
  const ownerAppKeys = new Set(
    (sponsorshipApps || [])
      .filter((a) => rowMatchesOwner(a, ownerName, ownerEmail, ownerRefCodes))
      .map((a) => personKey(appToPerson(a)))
  );

  // Leads: sponsorship apps where agent is referral source, submitted_at in month
  const leadApps = (sponsorshipApps || []).filter((r) => {
    const ts = r?.submitted_at || r?.submittedAt || '';
    return ts && monthKeyFromIso(ts) === month && sponsorAppReferrerMatch(r, ownerName, ownerEmail, ownerRefCodes);
  });
  const leadsReceived = uniquePeopleCount(leadApps.map(appToPerson));

  // Bookings: existing logic filtered to the requested month
  const bookedRows = (bookingRows || []).filter((r) => {
    const ts = r?.created_at || r?.updated_at || '';
    if (!ts || monthKeyFromIso(ts) !== month) return false;
    const status = normalize(r?.booking_status || 'booked');
    if (!['booked', 'confirmed', 'completed'].includes(status)) return false;
    if (rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCodes)) return true;
    const srcId = clean(r?.source_application_id || '');
    const app = appById.get(srcId);
    if (app && rowMatchesOwner(app, ownerName, ownerEmail, ownerRefCodes)) return true;
    const bpk = personKey({
      name: clean(r?.applicant_name || r?.name || ''),
      email: clean(r?.applicant_email || r?.email || ''),
      phone: clean(r?.applicant_phone || r?.phone || '')
    });
    return ownerAppKeys.has(bpk);
  }).map((r) => ({
    name: clean(r?.applicant_name || r?.name || ''),
    email: clean(r?.applicant_email || r?.email || ''),
    phone: clean(r?.applicant_phone || r?.phone || '')
  }));
  const bookingsThisMonth = uniquePeopleCount(bookedRows);

  // Closes: approved sponsorship apps where agent is referral source, date in month
  const closeApps = (sponsorshipApps || []).filter((r) => {
    const status = normalize(r?.status || '');
    if (!status.includes('approved')) return false;
    const ts = r?.approved_at || r?.reviewedAt || r?.updatedAt || r?.submitted_at || '';
    return ts && monthKeyFromIso(ts) === month && sponsorAppReferrerMatch(r, ownerName, ownerEmail, ownerRefCodes);
  });
  const closesThisMonth = uniquePeopleCount(closeApps.map(appToPerson));

  // Potential: closes with a linked policy submission → recommendedPotential(); no policy = $0
  const policyMap = buildPolicyPersonMap(policyRows);
  let potentialEarned = 0;
  for (const app of closeApps) {
    const policy = policyMap.get(personKey(appToPerson(app)));
    if (policy) potentialEarned += recommendedPotential(policy);
  }

  const closeRate = leadsReceived > 0 ? (closesThisMonth / leadsReceived) * 100 : 0;

  return {
    leadsReceived,
    monthlyTarget: 60,
    remainingToTarget: Math.max(0, 60 - leadsReceived),
    bookingsThisMonth,
    closesThisMonth,
    sponsorshipApprovedThisMonth: closesThisMonth,
    closeRate: Number(closeRate.toFixed(1)),
    potentialEarned: Number(potentialEarned.toFixed(2)),
    grossEarned: Number(potentialEarned.toFixed(2)),
    closesToday: 0,
    potentialToday: 0
  };
}

function computeTeamMonthKpi(month, { sponsorshipApps, bookingRows, policyRows }) {
  // Team-wide: no owner filtering (fallback when personal data is empty)
  const leadApps = (sponsorshipApps || []).filter((r) => {
    const ts = r?.submitted_at || r?.submittedAt || '';
    return ts && monthKeyFromIso(ts) === month;
  });
  const leadsReceived = leadApps.length;

  const bookedRows = (bookingRows || []).filter((r) => {
    const ts = r?.created_at || r?.updated_at || '';
    if (!ts || monthKeyFromIso(ts) !== month) return false;
    const status = normalize(r?.booking_status || 'booked');
    return ['booked', 'confirmed', 'completed'].includes(status);
  }).map((r) => ({
    name: clean(r?.applicant_name || r?.name || ''),
    email: clean(r?.applicant_email || r?.email || ''),
    phone: clean(r?.applicant_phone || r?.phone || '')
  }));
  const bookingsThisMonth = uniquePeopleCount(bookedRows);

  const closeApps = (sponsorshipApps || []).filter((r) => {
    const status = normalize(r?.status || '');
    if (!status.includes('approved')) return false;
    const ts = r?.approved_at || r?.reviewedAt || r?.updatedAt || r?.submitted_at || '';
    return ts && monthKeyFromIso(ts) === month;
  });
  const closesThisMonth = uniquePeopleCount(closeApps.map(appToPerson));

  const policyMap = buildPolicyPersonMap(policyRows);
  let potentialEarned = 0;
  for (const app of closeApps) {
    const policy = policyMap.get(personKey(appToPerson(app)));
    if (policy) potentialEarned += recommendedPotential(policy);
  }

  const closeRate = leadsReceived > 0 ? (closesThisMonth / leadsReceived) * 100 : 0;

  return {
    leadsReceived,
    monthlyTarget: 60,
    remainingToTarget: Math.max(0, 60 - leadsReceived),
    bookingsThisMonth,
    closesThisMonth,
    sponsorshipApprovedThisMonth: closesThisMonth,
    closeRate: Number(closeRate.toFixed(1)),
    potentialEarned: Number(potentialEarned.toFixed(2)),
    grossEarned: Number(potentialEarned.toFixed(2)),
    closesToday: 0,
    potentialToday: 0
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ownerName = clean(searchParams.get('name') || '');
  const ownerEmail = clean(searchParams.get('email') || '');
  const monthParam = clean(searchParams.get('month') || '');

  if (!ownerName && !ownerEmail) {
    return Response.json({ ok: false, error: 'missing_name_or_email' }, { status: 400 });
  }

  const [policyRows, bookingRows, sponsorshipApps] = await Promise.all([
    loadJsonStore(POLICY_SUBMISSIONS_PATH, []),
    loadJsonStore(SPONSORSHIP_BOOKINGS_PATH, []),
    loadJsonStore(SPONSORSHIP_APPS_PATH, [])
  ]);

  const currentMonth = monthKey(new Date());
  const requestedMonth = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonth;

  const ownerRefCodes = Array.from(new Set([
    refCodeFromName(ownerName),
    refCodeFromName(canonicalName(ownerName)),
    canonicalName(ownerName) === 'leticia wright' ? 'latricia_wright' : '',
    canonicalName(ownerName) === 'leticia wright' ? 'leticia_wright' : '',
    canonicalName(ownerName) === 'leticia wright' ? 'letitia_wright' : '',
    canonicalName(ownerName) === 'leticia wright' ? 'latrisha_wright' : '',
    normalize(ownerName) === 'kimora link' ? 'link' : ''
  ].filter(Boolean)));

  const data = { policyRows, bookingRows, sponsorshipApps };

  // Compute KPI for requested month + 2 prior months
  const monthsToCompute = [
    requestedMonth,
    prevMonthKey(requestedMonth, 1),
    prevMonthKey(requestedMonth, 2)
  ];

  const currentDateKey = dateKeyFromIso(new Date().toISOString());
  const policyMap = buildPolicyPersonMap(policyRows);

  const computeFullKpiForMonth = (month) => {
    const personal = computeMonthKpi(month, data, ownerName, ownerEmail, ownerRefCodes);
    const personalIsEmpty = personal.leadsReceived === 0 && personal.bookingsThisMonth === 0 && personal.closesThisMonth === 0;

    if (personalIsEmpty) {
      const team = computeTeamMonthKpi(month, data);
      // Add today metrics for current month team fallback
      if (month === currentMonth) {
        const todayTeamCloseApps = (sponsorshipApps || []).filter((r) => {
          const status = normalize(r?.status || '');
          if (!status.includes('approved')) return false;
          const ts = r?.approved_at || r?.reviewedAt || r?.updatedAt || r?.submitted_at || '';
          return ts && dateKeyFromIso(ts) === currentDateKey;
        });
        let potentialToday = 0;
        for (const app of todayTeamCloseApps) {
          const policy = policyMap.get(personKey(appToPerson(app)));
          if (policy) potentialToday += recommendedPotential(policy);
        }
        return { ...team, closesToday: todayTeamCloseApps.length, potentialToday: Number(potentialToday.toFixed(2)) };
      }
      return team;
    }

    // Add today metrics for current month personal
    if (month === currentMonth) {
      const todayCloseApps = (sponsorshipApps || []).filter((r) => {
        const status = normalize(r?.status || '');
        if (!status.includes('approved')) return false;
        const ts = r?.approved_at || r?.reviewedAt || r?.updatedAt || r?.submitted_at || '';
        return ts && dateKeyFromIso(ts) === currentDateKey && sponsorAppReferrerMatch(r, ownerName, ownerEmail, ownerRefCodes);
      });
      let potentialToday = 0;
      for (const app of todayCloseApps) {
        const policy = policyMap.get(personKey(appToPerson(app)));
        if (policy) potentialToday += recommendedPotential(policy);
      }
      return { ...personal, closesToday: todayCloseApps.length, potentialToday: Number(potentialToday.toFixed(2)) };
    }

    return personal;
  };

  const [mainKpi, prev1Kpi, prev2Kpi] = monthsToCompute.map(computeFullKpiForMonth);

  return Response.json({
    ok: true,
    month: requestedMonth,
    kpi: mainKpi,
    prevMonths: [
      { month: monthsToCompute[1], kpi: prev1Kpi },
      { month: monthsToCompute[2], kpi: prev2Kpi }
    ]
  });
}
