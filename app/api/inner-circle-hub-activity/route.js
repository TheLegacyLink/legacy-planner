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

function personKey({ name = '', email = '' } = {}) {
  const em = clean(email).toLowerCase();
  if (em) return `e:${em}`;
  return `n:${normalize(name).replace(/[^a-z0-9]/g, '')}`;
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

function countPeriod(rows = [], period = 'daily') {
  return (rows || []).filter((r) => inPeriod(asTs(r?.at), period)).length;
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
      email: clean(r?.email || ''),
      phone: clean(r?.phone || ''),
      detail: 'Submitted',
      at: clean(r?.submitted_at || r?.createdAt || r?.updatedAt || '')
    }));

  const decisions = (sponsorshipApps || [])
    .filter((r) => {
      const appRef = clean(r?.refCode || r?.ref_code || '').toLowerCase();
      const status = normalize(r?.status || '');
      if (!(status.includes('approved') || status.includes('declined'))) return false;
      if (ownerRefCode && appRef && appRef === ownerRefCode) return true;
      return isOwnerMatch(r, ownerName, ownerEmail);
    })
    .map((r) => {
      const status = normalize(r?.status || '');
      const decision = status.includes('declined') ? 'declined' : 'approved';
      return {
        type: 'decision',
        decision,
        name: clean(`${r?.firstName || ''} ${r?.lastName || ''}` || r?.name || 'Unknown'),
        email: clean(r?.email || ''),
        phone: clean(r?.phone || ''),
        detail: decision === 'approved' ? 'Approved' : 'Declined',
        at: clean(r?.approved_at || r?.reviewedAt || r?.updatedAt || r?.submitted_at || '')
      };
    });

  const booked = (bookingRows || [])
    .filter((r) => isOwnerMatch(r, ownerName, ownerEmail))
    .filter((r) => ['booked', 'confirmed', 'completed'].includes(normalize(r?.booking_status || 'booked')))
    .map((r) => ({
      type: 'booked',
      name: clean(r?.applicant_name || r?.name || r?.fullName || 'Unknown'),
      email: clean(r?.applicant_email || r?.email || ''),
      phone: clean(r?.applicant_phone || r?.phone || ''),
      detail: 'Booked',
      at: clean(r?.updated_at || r?.created_at || '')
    }));

  const fng = (policyRows || [])
    .filter((r) => isOwnerMatch(r, ownerName, ownerEmail))
    .map((r) => ({
      type: 'fng',
      name: clean(r?.applicantName || r?.name || r?.fullName || r?.insuredName || 'Unknown'),
      email: clean(r?.applicantEmail || r?.email || ''),
      phone: clean(r?.applicantPhone || r?.phone || ''),
      detail: 'FNG Submitted',
      at: clean(r?.submittedAt || r?.createdAt || r?.created_at || '')
    }));

  const approvedKeys = new Set(decisions.filter((r) => r.decision === 'approved').map((r) => personKey(r)));
  const bookedKeys = new Set(booked.map((r) => personKey(r)));
  const fngKeys = new Set(fng.map((r) => personKey(r)));

  const completed = [];
  for (const row of fng) {
    const k = personKey(row);
    if (approvedKeys.has(k) && bookedKeys.has(k)) {
      completed.push({
        type: 'completed',
        name: row.name,
        email: row.email,
        phone: row.phone,
        detail: 'Completed ⭐⭐⭐',
        at: row.at
      });
    }
  }

  const rows = [...booked, ...decisions, ...fng, ...completed]
    .sort((a, b) => asTs(b.at) - asTs(a.at))
    .slice(0, 40)
    .map((r) => ({
      ...r,
      showFngButton: r.type === 'booked' || (r.type === 'decision' && r.decision === 'approved')
    }));

  const summary = {
    submitted: submitted.length,
    approved: decisions.filter((r) => r.decision === 'approved').length,
    declined: decisions.filter((r) => r.decision === 'declined').length,
    booked: booked.length,
    fng: fng.length,
    completed: completed.length
  };

  const stats = {
    daily: {
      bookings: countPeriod(booked, 'daily'),
      sponsorshipSubmitted: countPeriod(submitted, 'daily'),
      sponsorshipApproved: countPeriod(decisions.filter((r) => r.decision === 'approved'), 'daily'),
      fngSubmitted: countPeriod(fng, 'daily')
    },
    weekly: {
      bookings: countPeriod(booked, 'weekly'),
      sponsorshipSubmitted: countPeriod(submitted, 'weekly'),
      sponsorshipApproved: countPeriod(decisions.filter((r) => r.decision === 'approved'), 'weekly'),
      fngSubmitted: countPeriod(fng, 'weekly')
    },
    monthly: {
      bookings: countPeriod(booked, 'monthly'),
      sponsorshipSubmitted: countPeriod(submitted, 'monthly'),
      sponsorshipApproved: countPeriod(decisions.filter((r) => r.decision === 'approved'), 'monthly'),
      fngSubmitted: countPeriod(fng, 'monthly')
    }
  };

  return Response.json({ ok: true, rows, summary, stats });
}
