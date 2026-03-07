import { loadJsonFile, saveJsonFile, loadJsonStore } from '../../../lib/blobJsonStore';
import users from '../../../data/innerCircleUsers.json';

const APPS_PATH = 'stores/sponsorship-applications.json';
const MEMBERS_PATH = 'stores/sponsorship-program-members.json';
const REQUESTS_PATH = 'stores/sponsorship-sop-requests.json';
const POLICY_PATH = 'stores/policy-submissions.json';
const DELEGATIONS_PATH = 'stores/referrer-delegations.json';
const INVITES_PATH = 'stores/sponsorship-sop-invites.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function nowIso() { return new Date().toISOString(); }

function refCodeFromName(name = '') {
  return clean(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function nameKey(v = '') { return clean(v).toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); }
function emailKey(v = '') { return clean(v).toLowerCase(); }

function personKey({ email = '', name = '' } = {}) {
  const e = emailKey(email);
  if (e) return `e:${e}`;
  const n = nameKey(name);
  return n ? `n:${n}` : '';
}

function boolLicensed(v = '') {
  const n = normalize(v);
  return n === 'yes' || n === 'true' || n === 'licensed';
}

function findInnerUser(name = '') {
  const n = normalize(name);
  return (users || []).find((u) => u.active && normalize(u.name) === n) || null;
}

function mapRefCodeToName(refCode = '') {
  const rc = clean(refCode).toLowerCase();
  if (!rc) return '';
  const hit = (users || []).find((u) => refCodeFromName(u.name) === rc);
  return clean(hit?.name || '');
}

function appReferrerName(row = {}) {
  return clean(row?.referralName || row?.referredByName || mapRefCodeToName(row?.refCode || row?.referral_code || ''));
}

function isSubmittedApplication(row = {}) {
  const mode = normalize(row?.mode || 'submit');
  const submittedAt = clean(row?.submitted_at || row?.submittedAt || '');
  return mode === 'submit' && Boolean(submittedAt);
}

function pendingRequest(requests = [], memberEmail = '', stepKey = '') {
  const em = emailKey(memberEmail);
  return Boolean((requests || []).find((r) => emailKey(r?.memberEmail) === em && clean(r?.stepKey) === stepKey && clean(r?.status) === 'pending'));
}

function stepModel(member = {}, requests = []) {
  const licensed = Boolean(member?.licensed);
  const steps = [];
  const push = (key, approved) => steps.push({ key, status: approved ? 'approved' : 'not_started' });

  push('community_service_submit', Boolean(member?.communityServiceApproved));
  push('license_verified', Boolean(clean(member?.npn)));
  if (!licensed) steps.push({ key: 'unlicensed_contact_jamal', status: pendingRequest(requests, member?.email, 'unlicensed_contact_jamal') ? 'pending' : 'not_started' });
  steps.push({ key: 'skool_joined', status: Boolean(member?.schoolCommunityJoined) ? 'approved' : (pendingRequest(requests, member?.email, 'skool_joined') ? 'pending' : 'not_started') });

  const skoolGate = Boolean(member?.schoolCommunityJoined || pendingRequest(requests, member?.email, 'skool_joined'));
  steps.push({ key: 'contracting_started', status: skoolGate ? ((member?.contractingStarted || member?.contractingComplete) ? 'approved' : 'not_started') : 'locked' });
  steps.push({ key: 'youtube_comment_approved', status: Boolean(member?.youtubeCommentApproved) ? 'approved' : (pendingRequest(requests, member?.email, 'youtube_comment_approved') ? 'pending' : 'not_started') });

  const scriptUnlocked = Boolean(licensed && member?.communityServiceApproved && member?.contractingComplete);
  steps.push({ key: 'sponsorship_script_ack', status: scriptUnlocked ? (member?.sponsorshipScriptAcknowledged ? 'approved' : 'not_started') : 'locked' });
  steps.push({ key: 'lead_access_active', status: member?.leadAccessActive ? 'approved' : 'locked' });

  const total = steps.length;
  const approved = steps.filter((s) => s.status === 'approved').length;
  const progressPct = total ? Math.round((approved / total) * 100) : 0;

  let stage = 'Application Submitted';
  if (member?.leadAccessActive) stage = 'Lead Access Active';
  else {
    const first = steps.find((s) => s.status !== 'approved');
    const labels = {
      community_service_submit: 'Community Service',
      license_verified: 'License Verification (NPN)',
      unlicensed_contact_jamal: 'Contact Jamal (Licensing)',
      skool_joined: 'SKOOL Request',
      contracting_started: 'Contracting Started',
      youtube_comment_approved: 'YouTube Comment Approval',
      sponsorship_script_ack: 'Sponsorship Script Ack',
      lead_access_active: 'Lead Access Activation'
    };
    stage = labels[first?.key] || stage;
  }

  return { steps, approved, total, progressPct, stage };
}

function bonusSplit(row = {}) {
  const monthly = Number(row?.monthlyPremium || 0) || 0;
  const maxBonus = Math.min(monthly, 700);
  const referred = normalize(row?.referredByName || '');
  const writer = normalize(row?.policyWriterName || '');
  const writerEligible = !!writer && !!referred && writer !== referred;
  const writerBonus = writerEligible ? Math.min(100, maxBonus) : 0;
  const referralBonus = Math.max(maxBonus - writerBonus, 0);
  return { referralBonus, writerBonus, totalRecommended: maxBonus };
}

function viewerPayoutForPolicy(row = {}, viewerName = '') {
  const v = normalize(viewerName);
  if (!v) return { payout: 0, role: 'none' };
  const split = bonusSplit(row);
  const referred = normalize(row?.referredByName || '');
  const writer = normalize(row?.policyWriterName || '');

  if (v === referred && v === writer) return { payout: split.totalRecommended, role: 'referrer_writer' };
  if (v === referred) return { payout: split.referralBonus, role: 'referrer' };
  if (v === writer) return { payout: split.writerBonus, role: 'writer' };
  return { payout: 0, role: 'none' };
}

function policyProgressModel(policy = {}) {
  const status = normalize(policy?.status || '');
  const payoutStatus = normalize(policy?.payoutStatus || '');

  if (!status) {
    return { stage: 'No Policy Submitted Yet', completed: 0, total: 3, progressPct: 0, bucket: 'needs_followup' };
  }

  if (status.startsWith('declined')) {
    return { stage: 'Policy Declined', completed: 1, total: 3, progressPct: 33, bucket: 'needs_followup' };
  }

  if (status.startsWith('approved') && payoutStatus === 'paid') {
    return { stage: 'Paid Out', completed: 3, total: 3, progressPct: 100, bucket: 'on_track' };
  }

  if (status.startsWith('approved')) {
    return { stage: 'Approved (Unpaid)', completed: 2, total: 3, progressPct: 67, bucket: 'on_track' };
  }

  return { stage: 'Policy Submitted', completed: 1, total: 3, progressPct: 33, bucket: 'needs_followup' };
}

function statusBucket({ stalled24h = false, leadAccessActive = false, progressPct = 0 } = {}) {
  if (stalled24h) return 'stalled';
  if (leadAccessActive || progressPct >= 85) return 'on_track';
  if (progressPct >= 35) return 'needs_followup';
  return 'needs_followup';
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const viewerName = clean(searchParams.get('viewerName') || '');
  if (!viewerName) return Response.json({ ok: false, error: 'missing_viewer' }, { status: 400 });

  const viewer = findInnerUser(viewerName);
  if (!viewer) return Response.json({ ok: false, error: 'viewer_not_found' }, { status: 404 });

  const [appsRaw, membersRaw, requestsRaw, policyRows, delegationsRaw, invitesRaw] = await Promise.all([
    loadJsonStore(APPS_PATH, []),
    loadJsonFile(MEMBERS_PATH, []),
    loadJsonFile(REQUESTS_PATH, []),
    loadJsonStore(POLICY_PATH, []),
    loadJsonFile(DELEGATIONS_PATH, []),
    loadJsonFile(INVITES_PATH, [])
  ]);

  const apps = Array.isArray(appsRaw) ? appsRaw : [];
  const members = Array.isArray(membersRaw) ? membersRaw : [];
  const requests = Array.isArray(requestsRaw) ? requestsRaw : [];
  const delegations = Array.isArray(delegationsRaw) ? delegationsRaw : [];
  const invites = Array.isArray(invitesRaw) ? invitesRaw : [];

  const memberByEmail = new Map(members.map((m) => [emailKey(m?.email), m]));
  const inviteByEmail = new Map(invites.map((i) => [emailKey(i?.memberEmail), i]));
  const policyByPerson = new Map();
  for (const p of (Array.isArray(policyRows) ? policyRows : [])) {
    const k = personKey({ email: p?.applicantEmail, name: p?.applicantName });
    if (!k) continue;
    const cur = policyByPerson.get(k);
    const ts = new Date(p?.updatedAt || p?.submittedAt || 0).getTime();
    const cts = new Date(cur?.updatedAt || cur?.submittedAt || 0).getTime();
    if (!cur || ts > cts) policyByPerson.set(k, p);
  }

  const delegByPerson = new Map(delegations.map((d) => [clean(d.personKey), d]));
  const rows = [];
  const nowMs = Date.now();
  const appUrl = clean(process.env.NEXT_PUBLIC_APP_URL || 'https://innercirclelink.com').replace(/\/$/, '');

  for (const app of apps) {
    if (!isSubmittedApplication(app)) continue;

    const fullName = clean(`${app?.firstName || ''} ${app?.lastName || ''}`) || clean(app?.name || app?.applicantName || '');
    const email = clean(app?.email || app?.applicantEmail || '').toLowerCase();
    const pKey = personKey({ email, name: fullName });
    if (!pKey) continue;

    const originalReferrer = appReferrerName(app);
    if (!originalReferrer) continue;

    const delegate = delegByPerson.get(pKey);
    const effectiveReferrer = clean(delegate?.delegateTo || originalReferrer);
    if (normalize(effectiveReferrer) !== normalize(viewer.name)) continue;

    const member = memberByEmail.get(email) || {};
    const invite = inviteByEmail.get(emailKey(email)) || null;
    const policy = policyByPerson.get(pKey) || {};
    const step = stepModel({
      ...member,
      licensed: member?.licensed ?? boolLicensed(app?.isLicensed),
      email,
      leadAccessActive: Boolean(member?.leadAccessActive)
    }, requests);

    const policyStatus = clean(policy?.status || '');
    if (!policyStatus) continue; // Referrer scoreboard rows should be policy-submitted people only.

    const policyTs = new Date(policy?.updatedAt || policy?.submittedAt || 0).getTime();
    const stalled24h = Boolean(policyStatus && !['approved', 'declined'].includes(normalize(policyStatus)) && Number.isFinite(policyTs) && nowMs - policyTs >= 24 * 60 * 60 * 1000);
    const policyModel = policyProgressModel(policy);
    const finalBucket = stalled24h ? 'stalled' : policyModel.bucket;

    rows.push({
      personKey: pKey,
      name: fullName,
      email,
      phone: clean(app?.phone || app?.applicantPhone || ''),
      licensed: Boolean(member?.licensed ?? boolLicensed(app?.isLicensed)),
      appStatus: clean(app?.status || ''),
      originalReferrer,
      effectiveReferrer,
      delegatedBy: clean(delegate?.delegatedBy || ''),
      progressPct: policyModel.progressPct,
      completedSteps: policyModel.completed,
      totalSteps: policyModel.total,
      stage: policyModel.stage,
      sponsorshipStage: step.stage,
      leadAccessActive: Boolean(member?.leadAccessActive),
      policyStatus,
      policyUpdatedAt: clean(policy?.updatedAt || policy?.submittedAt || ''),
      stalled24h,
      bucket: finalBucket,
      lastActivityAt: clean(policy?.updatedAt || policy?.submittedAt || member?.updatedAt || app?.updatedAt || app?.submitted_at || ''),
      sopUrl: invite?.token ? `${appUrl}/sponsorship-sop?invite=${encodeURIComponent(invite.token)}` : `${appUrl}/sponsorship-sop`
    });
  }

  rows.sort((a, b) => {
    if (a.stalled24h !== b.stalled24h) return a.stalled24h ? -1 : 1;
    return new Date(b.lastActivityAt || 0).getTime() - new Date(a.lastActivityAt || 0).getTime();
  });

  const metrics = {
    total: rows.length,
    submittedApps: rows.length,
    approvedApps: rows.filter((r) => normalize(r.appStatus).includes('approved')).length,
    onTrack: rows.filter((r) => r.bucket === 'on_track').length,
    needsFollowup: rows.filter((r) => r.bucket === 'needs_followup').length,
    stalled24h: rows.filter((r) => r.stalled24h).length
  };

  const myPolicies = (Array.isArray(policyRows) ? policyRows : [])
    .filter((p) => {
      const n = normalize(viewer.name);
      return normalize(p?.referredByName || '') === n || normalize(p?.policyWriterName || '') === n || normalize(p?.submittedBy || '') === n;
    })
    .map((p) => {
      const payout = viewerPayoutForPolicy(p, viewer.name);
      const invite = inviteByEmail.get(emailKey(p?.applicantEmail || '')) || null;
      return {
        id: clean(p?.id || ''),
        applicantName: clean(p?.applicantName || ''),
        applicantEmail: clean(p?.applicantEmail || ''),
        referredByName: clean(p?.referredByName || ''),
        policyWriterName: clean(p?.policyWriterName || ''),
        status: clean(p?.status || 'Submitted') || 'Submitted',
        submittedAt: clean(p?.submittedAt || ''),
        approvedAt: clean(p?.approvedAt || ''),
        payoutStatus: clean(p?.payoutStatus || 'Unpaid') || 'Unpaid',
        payoutAmount: Number(p?.payoutAmount || 0) || 0,
        payoutPaidAt: clean(p?.payoutPaidAt || ''),
        monthlyPremium: Number(p?.monthlyPremium || 0) || 0,
        viewerPayout: Number(payout.payout || 0),
        viewerPayoutRole: payout.role,
        sopUrl: invite?.token ? `${appUrl}/sponsorship-sop?invite=${encodeURIComponent(invite.token)}` : `${appUrl}/sponsorship-sop`
      };
    })
    .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());

  const policyMetrics = {
    total: myPolicies.length,
    submitted: myPolicies.filter((p) => normalize(p.status) === 'submitted').length,
    approved: myPolicies.filter((p) => normalize(p.status).startsWith('approved')).length,
    declined: myPolicies.filter((p) => normalize(p.status).startsWith('declined')).length,
    paid: myPolicies.filter((p) => normalize(p.payoutStatus) === 'paid').length
  };

  const byReferrer = new Map();
  for (const r of rows) {
    const key = clean(r.effectiveReferrer || r.originalReferrer || '');
    if (!key) continue;
    const cur = byReferrer.get(key) || { name: key, total: 0, onTrack: 0, stalled: 0, progressSum: 0 };
    cur.total += 1;
    if (r.bucket === 'on_track') cur.onTrack += 1;
    if (r.stalled24h) cur.stalled += 1;
    cur.progressSum += Number(r.progressPct || 0);
    byReferrer.set(key, cur);
  }

  const leaderboard = [...byReferrer.values()].map((x) => {
    const avgProgress = x.total ? Math.round(x.progressSum / x.total) : 0;
    const speedScore = (x.onTrack * 2) - x.stalled + (avgProgress / 100);
    return {
      name: x.name,
      total: x.total,
      onTrack: x.onTrack,
      stalled: x.stalled,
      avgProgress,
      speedScore: Math.round(speedScore * 100) / 100
    };
  }).sort((a, b) => b.speedScore - a.speedScore).slice(0, 10);

  return Response.json({
    ok: true,
    viewer: { name: viewer.name, role: viewer.role, email: viewer.email || '' },
    rows,
    metrics,
    leaderboard,
    myPolicies,
    policyMetrics,
    innerCircle: (users || []).filter((u) => u.active).map((u) => ({ name: u.name, role: u.role }))
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = normalize(body?.action || '');
  const actorName = clean(body?.actorName || '');
  const actor = findInnerUser(actorName);
  if (!actor) return Response.json({ ok: false, error: 'invalid_actor' }, { status: 401 });

  if (action !== 'delegate_referrer') {
    return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
  }

  if (normalize(actor.role) !== 'admin') {
    return Response.json({ ok: false, error: 'admin_only' }, { status: 403 });
  }

  const pKey = clean(body?.personKey || '');
  const delegateTo = clean(body?.delegateTo || '');
  if (!pKey || !delegateTo) return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });

  const toUser = findInnerUser(delegateTo);
  if (!toUser) return Response.json({ ok: false, error: 'delegate_not_found' }, { status: 404 });

  const delegationsRaw = await loadJsonFile(DELEGATIONS_PATH, []);
  const delegations = Array.isArray(delegationsRaw) ? delegationsRaw : [];
  const idx = delegations.findIndex((d) => clean(d.personKey) === pKey);
  const row = {
    personKey: pKey,
    delegateTo: toUser.name,
    delegatedBy: actor.name,
    updatedAt: nowIso(),
    createdAt: idx >= 0 ? clean(delegations[idx].createdAt || nowIso()) : nowIso()
  };

  if (idx >= 0) delegations[idx] = row;
  else delegations.push(row);

  await saveJsonFile(DELEGATIONS_PATH, delegations);
  return Response.json({ ok: true, row });
}
