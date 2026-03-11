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

function asTs(raw = '') {
  const d = new Date(raw || 0);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function refCodeFromName(name = '') {
  return clean(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizePhone(v = '') {
  return clean(v).replace(/\D/g, '');
}

function nameSignature(name = '') {
  const tokens = normalize(name).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean);
  if (!tokens.length) return '';
  if (tokens.length === 1) return tokens[0];
  return `${tokens[0]}_${tokens[tokens.length - 1]}`;
}

function personKeys(row = {}) {
  const keys = [];
  const em = clean(row?.email).toLowerCase();
  const ph = normalizePhone(row?.phone || '');
  const full = normalize(row?.name || '').replace(/[^a-z0-9]/g, '');
  const sig = nameSignature(row?.name || '');
  if (em) keys.push(`e:${em}`);
  if (ph) keys.push(`p:${ph}`);
  if (sig) keys.push(`s:${sig}`);
  if (full) keys.push(`n:${full}`);
  return keys;
}

function personPrimaryKey(row = {}) {
  const keys = personKeys(row);
  return keys[0] || `u:${normalize(row?.name || 'unknown')}`;
}

function dedupePeopleRows(rows = []) {
  const sorted = [...(rows || [])].sort((a, b) => asTs(b?.at) - asTs(a?.at));
  const keyToIdx = new Map();
  const out = [];

  for (const row of sorted) {
    const keys = personKeys(row);
    const existingIdx = keys.map((k) => keyToIdx.get(k)).find((v) => Number.isInteger(v));

    if (!Number.isInteger(existingIdx)) {
      const idx = out.push({ ...row }) - 1;
      for (const k of keys) keyToIdx.set(k, idx);
      continue;
    }

    const existing = out[existingIdx] || {};
    out[existingIdx] = {
      ...existing,
      name: clean(existing?.name || row?.name),
      email: clean(existing?.email || row?.email),
      phone: clean(existing?.phone || row?.phone),
      at: clean(existing?.at || row?.at),
      detail: clean(existing?.detail || row?.detail)
    };
    for (const k of keys) keyToIdx.set(k, existingIdx);
  }

  return out;
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

  const [bookingRows, policyRows, sponsorshipApps] = await Promise.all([
    loadJsonStore(SPONSORSHIP_BOOKINGS_PATH, []),
    loadJsonStore(POLICY_SUBMISSIONS_PATH, []),
    loadJsonStore(SPONSORSHIP_APPS_PATH, [])
  ]);

  const ownerRefCode = refCodeFromName(ownerName);
  const appById = new Map((sponsorshipApps || []).map((a) => [clean(a?.id), a]));
  const ownerAppKeys = new Set(
    (sponsorshipApps || [])
      .filter((a) => rowMatchesOwner(a, ownerName, ownerEmail, ownerRefCode))
      .map((a) => personPrimaryKey({
        name: clean(`${a?.firstName || ''} ${a?.lastName || ''}` || a?.name || ''),
        email: clean(a?.email || ''),
        phone: clean(a?.phone || '')
      }))
  );

  const submittedRaw = (sponsorshipApps || [])
    .filter((r) => rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCode))
    .map((r) => ({
      type: 'submitted',
      name: clean(`${r?.firstName || ''} ${r?.lastName || ''}` || r?.name || 'Unknown'),
      email: clean(r?.email || ''),
      phone: clean(r?.phone || ''),
      detail: 'Submitted',
      at: clean(r?.submitted_at || r?.createdAt || r?.updatedAt || '')
    }));
  const submitted = dedupePeopleRows(submittedRaw);

  const decisionsRaw = (sponsorshipApps || [])
    .filter((r) => {
      const status = normalize(r?.status || '');
      if (!(status.includes('approved') || status.includes('declined'))) return false;
      return rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCode);
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
  const decisions = dedupePeopleRows(decisionsRaw).map((r) => ({
    ...r,
    decision: normalize(r?.detail).includes('declined') ? 'declined' : 'approved'
  }));

  const booked = dedupePeopleRows((bookingRows || [])
    .filter((r) => {
      if (rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCode)) return true;
      const app = appById.get(clean(r?.source_application_id || ''));
      if (app && rowMatchesOwner(app, ownerName, ownerEmail, ownerRefCode)) return true;

      const bookingKey = personPrimaryKey({
        name: clean(r?.applicant_name || r?.name || ''),
        email: clean(r?.applicant_email || r?.email || ''),
        phone: clean(r?.applicant_phone || r?.phone || '')
      });
      return ownerAppKeys.has(bookingKey);
    })
    .filter((r) => ['booked', 'confirmed', 'completed'].includes(normalize(r?.booking_status || 'booked')))
    .map((r) => ({
      type: 'booked',
      name: clean(r?.applicant_name || r?.name || r?.fullName || 'Unknown'),
      email: clean(r?.applicant_email || r?.email || ''),
      phone: clean(r?.applicant_phone || r?.phone || ''),
      detail: 'Booked',
      at: clean(r?.updated_at || r?.created_at || '')
    })));

  const fng = dedupePeopleRows((policyRows || [])
    .filter((r) => rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCode))
    .map((r) => ({
      type: 'fng',
      name: clean(r?.applicantName || r?.name || r?.fullName || r?.insuredName || 'Unknown'),
      email: clean(r?.applicantEmail || r?.email || ''),
      phone: clean(r?.applicantPhone || r?.phone || ''),
      detail: 'FNG Submitted',
      at: clean(r?.submittedAt || r?.createdAt || r?.created_at || '')
    })));

  const approvedKeys = new Set(decisions.filter((r) => r.decision === 'approved').map((r) => personPrimaryKey(r)));
  const bookedKeys = new Set(booked.map((r) => personPrimaryKey(r)));

  const completed = [];
  for (const row of fng) {
    const k = personPrimaryKey(row);
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
