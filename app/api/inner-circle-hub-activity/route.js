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

function stagePriority(row = {}) {
  const type = clean(row?.type);
  if (type === 'completed') return 5;
  if (type === 'fng') return 4;
  if (type === 'decision') return 3;
  if (type === 'booked') return 2;
  if (type === 'submitted') return 1;
  return 0;
}

function collapseToLatestStage(rows = []) {
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
    const keepIncoming = stagePriority(row) > stagePriority(existing)
      || (stagePriority(row) === stagePriority(existing) && asTs(row?.at) > asTs(existing?.at));

    const merged = keepIncoming
      ? {
        ...existing,
        ...row,
        name: clean(row?.name || existing?.name),
        email: clean(row?.email || existing?.email),
        phone: clean(row?.phone || existing?.phone),
        detail: clean(row?.detail || existing?.detail),
        at: clean(row?.at || existing?.at)
      }
      : {
        ...existing,
        name: clean(existing?.name || row?.name),
        email: clean(existing?.email || row?.email),
        phone: clean(existing?.phone || row?.phone),
        detail: clean(existing?.detail || row?.detail),
        at: clean(existing?.at || row?.at)
      };

    out[existingIdx] = merged;
    for (const k of [...personKeys(existing), ...keys]) keyToIdx.set(k, existingIdx);
  }

  return out.sort((a, b) => asTs(b?.at) - asTs(a?.at));
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

  // If identity is missing, fall through and return global activity via all-empty fallback.
  const [bookingRows, policyRows, sponsorshipApps] = await Promise.all([
    loadJsonStore(SPONSORSHIP_BOOKINGS_PATH, []),
    loadJsonStore(POLICY_SUBMISSIONS_PATH, []),
    loadJsonStore(SPONSORSHIP_APPS_PATH, [])
  ]);

  const ownerRefCodes = Array.from(new Set([
    refCodeFromName(ownerName),
    refCodeFromName(canonicalName(ownerName)),
    canonicalName(ownerName) === 'leticia wright' ? 'latricia_wright' : '',
    canonicalName(ownerName) === 'leticia wright' ? 'leticia_wright' : '',
    canonicalName(ownerName) === 'leticia wright' ? 'letitia_wright' : '',
    canonicalName(ownerName) === 'leticia wright' ? 'latrisha_wright' : '',
    canonicalName(ownerName) === 'kimora link' ? 'link' : ''
  ].filter(Boolean)));
  const appById = new Map((sponsorshipApps || []).map((a) => [clean(a?.id), a]));
  const ownerAppKeys = new Set(
    (sponsorshipApps || [])
      .filter((a) => rowMatchesOwner(a, ownerName, ownerEmail, ownerRefCodes))
      .map((a) => personPrimaryKey({
        name: clean(`${a?.firstName || ''} ${a?.lastName || ''}` || a?.name || ''),
        email: clean(a?.email || ''),
        phone: clean(a?.phone || '')
      }))
  );

  const submittedRaw = (sponsorshipApps || [])
    .filter((r) => rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCodes))
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
      return rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCodes);
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
      if (rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCodes)) return true;
      const app = appById.get(clean(r?.source_application_id || ''));
      if (app && rowMatchesOwner(app, ownerName, ownerEmail, ownerRefCodes)) return true;

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
    .filter((r) => rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCodes))
    .map((r) => ({
      type: 'fng',
      name: clean(r?.applicantName || r?.name || r?.fullName || r?.insuredName || 'Unknown'),
      email: clean(r?.applicantEmail || r?.email || ''),
      phone: clean(r?.applicantPhone || r?.phone || ''),
      detail: 'Policy Submitted',
      at: clean(r?.submittedAt || r?.createdAt || r?.created_at || '')
    })));

  const completed = dedupePeopleRows((policyRows || [])
    .filter((r) => {
      if (!normalize(r?.status || '').startsWith('approved')) return false;
      return rowMatchesOwner(r, ownerName, ownerEmail, ownerRefCodes);
    })
    .map((r) => ({
      type: 'completed',
      name: clean(r?.applicantName || r?.name || r?.fullName || r?.insuredName || 'Unknown'),
      email: clean(r?.applicantEmail || r?.email || ''),
      phone: clean(r?.applicantPhone || r?.phone || ''),
      detail: 'Application Approved',
      at: clean(r?.approvedAt || r?.approved_at || r?.updatedAt || r?.submittedAt || r?.createdAt || '')
    })));

  const stageRows = collapseToLatestStage([...booked, ...decisions, ...fng, ...completed]);

  const rows = stageRows
    .map((r) => ({
      ...r,
      showFngButton: r.type === 'booked' || (r.type === 'decision' && r.decision === 'approved')
    }));

  const summary = {
    submitted: submitted.length,
    approved: rows.filter((r) => r.type === 'decision' && r.decision === 'approved').length,
    declined: rows.filter((r) => r.type === 'decision' && r.decision === 'declined').length,
    booked: rows.filter((r) => r.type === 'booked').length,
    fng: rows.filter((r) => r.type === 'fng').length,
    completed: rows.filter((r) => r.type === 'completed').length
  };

  let stats = {
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

  const allEmpty = !summary.submitted && !summary.approved && !summary.declined && !summary.booked && !summary.fng && !summary.completed;
  if (allEmpty) {
    const submittedAll = dedupePeopleRows((sponsorshipApps || []).map((r) => ({
      type: 'submitted',
      name: clean(`${r?.firstName || ''} ${r?.lastName || ''}` || r?.name || 'Unknown'),
      email: clean(r?.email || ''),
      phone: clean(r?.phone || ''),
      detail: 'Submitted',
      at: clean(r?.submitted_at || r?.createdAt || r?.updatedAt || '')
    })));

    const decisionsAll = dedupePeopleRows((sponsorshipApps || []).filter((r) => {
      const status = normalize(r?.status || '');
      return status.includes('approved') || status.includes('declined');
    }).map((r) => {
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
    }));

    const bookedAll = dedupePeopleRows((bookingRows || []).filter((r) => ['booked', 'confirmed', 'completed'].includes(normalize(r?.booking_status || 'booked'))).map((r) => ({
      type: 'booked',
      name: clean(r?.applicant_name || r?.name || r?.fullName || 'Unknown'),
      email: clean(r?.applicant_email || r?.email || ''),
      phone: clean(r?.applicant_phone || r?.phone || ''),
      detail: 'Booked',
      at: clean(r?.updated_at || r?.created_at || '')
    })));

    const fngAll = dedupePeopleRows((policyRows || []).map((r) => ({
      type: 'fng',
      name: clean(r?.applicantName || r?.name || r?.fullName || r?.insuredName || 'Unknown'),
      email: clean(r?.applicantEmail || r?.email || ''),
      phone: clean(r?.applicantPhone || r?.phone || ''),
      detail: 'Policy Submitted',
      at: clean(r?.submittedAt || r?.createdAt || r?.created_at || '')
    })));

    const completedAll = dedupePeopleRows((policyRows || []).filter((r) => normalize(r?.status || '').startsWith('approved')).map((r) => ({
      type: 'completed',
      name: clean(r?.applicantName || r?.name || r?.fullName || r?.insuredName || 'Unknown'),
      email: clean(r?.applicantEmail || r?.email || ''),
      phone: clean(r?.applicantPhone || r?.phone || ''),
      detail: 'Application Approved',
      at: clean(r?.approvedAt || r?.approved_at || r?.updatedAt || r?.submittedAt || r?.createdAt || '')
    })));

    const stageRowsAll = collapseToLatestStage([...bookedAll, ...decisionsAll, ...fngAll, ...completedAll]);
    const rowsAll = stageRowsAll.map((r) => ({ ...r, showFngButton: r.type === 'booked' || (r.type === 'decision' && r.decision === 'approved') }));

    summary.submitted = submittedAll.length;
    summary.approved = rowsAll.filter((r) => r.type === 'decision' && r.decision === 'approved').length;
    summary.declined = rowsAll.filter((r) => r.type === 'decision' && r.decision === 'declined').length;
    summary.booked = rowsAll.filter((r) => r.type === 'booked').length;
    summary.fng = rowsAll.filter((r) => r.type === 'fng').length;
    summary.completed = rowsAll.filter((r) => r.type === 'completed').length;

    stats = {
      daily: {
        bookings: countPeriod(bookedAll, 'daily'),
        sponsorshipSubmitted: countPeriod(submittedAll, 'daily'),
        sponsorshipApproved: countPeriod(decisionsAll.filter((r) => r.decision === 'approved'), 'daily'),
        fngSubmitted: countPeriod(fngAll, 'daily')
      },
      weekly: {
        bookings: countPeriod(bookedAll, 'weekly'),
        sponsorshipSubmitted: countPeriod(submittedAll, 'weekly'),
        sponsorshipApproved: countPeriod(decisionsAll.filter((r) => r.decision === 'approved'), 'weekly'),
        fngSubmitted: countPeriod(fngAll, 'weekly')
      },
      monthly: {
        bookings: countPeriod(bookedAll, 'monthly'),
        sponsorshipSubmitted: countPeriod(submittedAll, 'monthly'),
        sponsorshipApproved: countPeriod(decisionsAll.filter((r) => r.decision === 'approved'), 'monthly'),
        fngSubmitted: countPeriod(fngAll, 'monthly')
      }
    };

    return Response.json({ ok: true, rows: rowsAll, summary, stats });
  }

  return Response.json({ ok: true, rows, summary, stats });
}
