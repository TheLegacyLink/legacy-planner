import { loadJsonStore } from '../../../lib/blobJsonStore';

const POLICY_SUBMISSIONS_PATH = 'stores/policy-submissions.json';
const SPONSORSHIP_BOOKINGS_PATH = 'stores/sponsorship-bookings.json';

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

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ownerName = clean(searchParams.get('name') || '');
  const ownerEmail = clean(searchParams.get('email') || '');

  if (!ownerName && !ownerEmail) {
    return Response.json({ ok: false, error: 'missing_name_or_email' }, { status: 400 });
  }

  const [bookingRows, policyRows] = await Promise.all([
    loadJsonStore(SPONSORSHIP_BOOKINGS_PATH, []),
    loadJsonStore(POLICY_SUBMISSIONS_PATH, [])
  ]);

  const submitted = (bookingRows || [])
    .filter((r) => isOwnerMatch(r, ownerName, ownerEmail))
    .map((r) => ({
      type: 'submitted',
      name: clean(r?.applicant_name || r?.name || r?.fullName || 'Unknown'),
      detail: 'Sponsorship form submitted',
      at: clean(r?.created_at || r?.updated_at || '')
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

  const fng = (policyRows || [])
    .filter((r) => isOwnerMatch(r, ownerName, ownerEmail))
    .map((r) => ({
      type: 'fng',
      name: clean(r?.applicantName || r?.name || r?.fullName || r?.insuredName || 'Unknown'),
      detail: 'FNG application submitted',
      at: clean(r?.submittedAt || r?.createdAt || r?.created_at || '')
    }));

  const rows = [...submitted, ...booked, ...fng]
    .sort((a, b) => asTs(b.at) - asTs(a.at))
    .slice(0, 30);

  const summary = {
    submitted: submitted.length,
    booked: booked.length,
    fng: fng.length
  };

  return Response.json({ ok: true, rows, summary });
}
