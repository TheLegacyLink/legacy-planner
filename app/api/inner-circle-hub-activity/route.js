import { loadJsonStore } from '../../../lib/blobJsonStore';

const POLICY_SUBMISSIONS_PATH = 'stores/policy-submissions.json';
const SPONSORSHIP_BOOKINGS_PATH = 'stores/sponsorship-bookings.json';
const SPONSORSHIP_APPS_PATH = 'stores/sponsorship-applications.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }

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

function asTs(raw = '') {
  const d = new Date(raw || 0);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function refCodeFromName(name = '') {
  return clean(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function inPeriod(ts = 0, period = 'daily') {
  if (!ts) return false;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();

  if (period === 'monthly') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  if (period === 'weekly') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return d >= start;
  }

  return d.toDateString() === now.toDateString();
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ownerName = clean(searchParams.get('name') || '');
  const ownerEmail = clean(searchParams.get('email') || '');

  if (!ownerName && !ownerEmail) {
    return Response.json({ ok: false, error: 'missing_name_or_email' }, { status: 400 });
  }

  const [bookingRows, policyRows, sponsorshipApps] = await Promise.all([
    loadJsonStore(SPONSORSHIP_BOOKINGS_PATH, []),
    loadJsonStore(POLICY_SUBMISSIONS_PATH, []),
    loadJsonStore(SPONSORSHIP_APPS_PATH, [])
  ]);

  const ownerRefCode = refCodeFromName(ownerName);

  const submitted = (sponsorshipApps || [])
    .filter((r) => {
      const appRef = clean(r?.refCode || r?.ref_code || '').toLowerCase();
      if (ownerRefCode && appRef && appRef === ownerRefCode) return true;
      return isOwnerMatch(r, ownerName, ownerEmail);
    })
    .map((r) => ({
      type: 'submitted',
      name: clean(`${r?.firstName || ''} ${r?.lastName || ''}` || r?.name || 'Unknown'),
      detail: 'Sponsorship app submitted',
      at: clean(r?.submitted_at || r?.createdAt || r?.updatedAt || '')
    }));

  const booked = (bookingRows || [])
    .filter((r) => isOwnerMatch(r, ownerName, ownerEmail))
    .filter((r) => ['booked', 'confirmed', 'completed'].includes(normalize(r?.booking_status || 'booked')))
    .map((r) => ({
      type: 'booked',
      name: clean(r?.applicant_name || r?.name || r?.fullName || 'Unknown'),
      detail: `Call ${clean(r?.booking_status || 'booked')}`,
      at: clean(r?.updated_at || r?.created_at || '')
    }));

  const approved = (sponsorshipApps || [])
    .filter((r) => {
      const appRef = clean(r?.refCode || r?.ref_code || '').toLowerCase();
      const status = normalize(r?.status || '');
      if (!status.includes('approved')) return false;
      if (ownerRefCode && appRef && appRef === ownerRefCode) return true;
      return isOwnerMatch(r, ownerName, ownerEmail);
    })
    .map((r) => ({
      type: 'approved',
      name: clean(`${r?.firstName || ''} ${r?.lastName || ''}` || r?.name || 'Unknown'),
      detail: 'Sponsorship app approved',
      at: clean(r?.approved_at || r?.reviewedAt || r?.updatedAt || r?.submitted_at || '')
    }));

  const fng = (policyRows || [])
    .filter((r) => isOwnerMatch(r, ownerName, ownerEmail))
    .map((r) => ({
      type: 'fng',
      name: clean(r?.applicantName || r?.name || r?.fullName || r?.insuredName || 'Unknown'),
      detail: 'FNG application submitted',
      at: clean(r?.submittedAt || r?.createdAt || r?.created_at || '')
    }));

  const rows = [...submitted, ...approved, ...booked, ...fng]
    .sort((a, b) => asTs(b.at) - asTs(a.at))
    .slice(0, 30);

  const summary = {
    submitted: submitted.length,
    approved: approved.length,
    booked: booked.length,
    fng: fng.length
  };

  const stats = {
    daily: {
      bookings: booked.filter((r) => inPeriod(asTs(r.at), 'daily')).length,
      sponsorshipSubmitted: submitted.filter((r) => inPeriod(asTs(r.at), 'daily')).length,
      sponsorshipApproved: approved.filter((r) => inPeriod(asTs(r.at), 'daily')).length,
      fngSubmitted: fng.filter((r) => inPeriod(asTs(r.at), 'daily')).length
    },
    weekly: {
      bookings: booked.filter((r) => inPeriod(asTs(r.at), 'weekly')).length,
      sponsorshipSubmitted: submitted.filter((r) => inPeriod(asTs(r.at), 'weekly')).length,
      sponsorshipApproved: approved.filter((r) => inPeriod(asTs(r.at), 'weekly')).length,
      fngSubmitted: fng.filter((r) => inPeriod(asTs(r.at), 'weekly')).length
    },
    monthly: {
      bookings: booked.filter((r) => inPeriod(asTs(r.at), 'monthly')).length,
      sponsorshipSubmitted: submitted.filter((r) => inPeriod(asTs(r.at), 'monthly')).length,
      sponsorshipApproved: approved.filter((r) => inPeriod(asTs(r.at), 'monthly')).length,
      fngSubmitted: fng.filter((r) => inPeriod(asTs(r.at), 'monthly')).length
    }
  };

  return Response.json({ ok: true, rows, summary, stats });
}
