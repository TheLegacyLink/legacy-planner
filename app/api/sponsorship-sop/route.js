import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

const MEMBERS_PATH = 'stores/sponsorship-program-members.json';
const REQUESTS_PATH = 'stores/sponsorship-sop-requests.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function nowIso() {
  return new Date().toISOString();
}

function plusWeeksIso(iso = '', weeks = 8) {
  const ts = new Date(iso || Date.now()).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return '';
  return new Date(ts + Number(weeks || 8) * 7 * 24 * 60 * 60 * 1000).toISOString();
}

function gatePass(member = {}) {
  return Boolean(
    member?.licensed &&
    member?.onboardingComplete &&
    member?.communityServiceApproved &&
    member?.schoolCommunityJoined &&
    member?.youtubeCommentApproved &&
    (member?.contractingStarted || member?.contractingComplete) &&
    member?.active !== false
  );
}

function defaultMember(raw = {}) {
  const start = clean(raw?.tier0StartAt || nowIso());
  return {
    id: clean(raw?.id || `spm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    name: clean(raw?.name),
    email: clean(raw?.email).toLowerCase(),
    licensed: Boolean(raw?.licensed),
    onboardingComplete: Boolean(raw?.onboardingComplete),
    communityServiceApproved: Boolean(raw?.communityServiceApproved),
    schoolCommunityJoined: Boolean(raw?.schoolCommunityJoined),
    youtubeCommentApproved: Boolean(raw?.youtubeCommentApproved),
    contractingStarted: Boolean(raw?.contractingStarted),
    contractingComplete: Boolean(raw?.contractingComplete),
    active: raw?.active !== false,
    tier: clean(raw?.tier || 'PROGRAM_TIER_0') || 'PROGRAM_TIER_0',
    tier0StartAt: start,
    tier0EndAt: clean(raw?.tier0EndAt || plusWeeksIso(start, 8)),
    tier0WeeklyCap: Number(raw?.tier0WeeklyCap || 5),
    commissionNonSponsoredPct: Number(raw?.commissionNonSponsoredPct || 50),
    notes: clean(raw?.notes || ''),
    createdAt: clean(raw?.createdAt || nowIso()),
    updatedAt: nowIso(),
    leadAccessActive: gatePass(raw)
  };
}

function getStepStatus(member = {}, requests = [], stepKey = '') {
  const req = (requests || []).find((r) => normalize(r?.memberEmail) === normalize(member?.email) && clean(r?.stepKey) === stepKey && clean(r?.status) === 'pending');

  if (stepKey === 'onboarding_complete') return member?.onboardingComplete ? 'approved' : req ? 'pending' : 'not_started';
  if (stepKey === 'community_service_submit') return member?.communityServiceApproved ? 'approved' : req ? 'pending' : 'not_started';
  if (stepKey === 'license_verified') return member?.licensed ? 'approved' : req ? 'pending' : 'not_started';
  if (stepKey === 'skool_joined') return member?.schoolCommunityJoined ? 'approved' : req ? 'pending' : 'not_started';
  if (stepKey === 'youtube_comment_approved') return member?.youtubeCommentApproved ? 'approved' : req ? 'pending' : 'not_started';
  if (stepKey === 'contracting_started') return (member?.contractingStarted || member?.contractingComplete) ? 'approved' : req ? 'pending' : 'not_started';
  if (stepKey === 'lead_access_active') return member?.leadAccessActive ? 'approved' : 'locked';

  return req ? 'pending' : 'not_started';
}

function buildSop(member = {}, requests = []) {
  const steps = [
    {
      key: 'onboarding_complete',
      title: 'Complete onboarding checklist',
      type: 'self_or_review',
      description: 'Scripts, CRM basics, call expectations, compliance acknowledgement.'
    },
    {
      key: 'community_service_submit',
      title: 'Submit community service proof',
      type: 'approval_required',
      description: 'Upload/submit your community service completion for approval.'
    },
    {
      key: 'license_verified',
      title: 'License verified',
      type: 'approval_required',
      description: 'Licensing verification required before live sponsorship lead access.'
    },
    {
      key: 'skool_joined',
      title: 'Join Skool community',
      type: 'approval_required',
      description: 'Join the Skool community (link will be provided) and request approval.'
    },
    {
      key: 'youtube_comment_approved',
      title: 'Watch “Whatever It Takes” + comment approved',
      type: 'approval_required',
      description: 'Watch the required YouTube video and leave a comment. Admin must approve after manual review.'
    },
    {
      key: 'contracting_started',
      title: 'Contracting process started',
      type: 'approval_required',
      description: 'Full contracting completion is not required to begin sponsored lead access, but process must be started.'
    },
    {
      key: 'lead_access_active',
      title: 'Lead access activated',
      type: 'system',
      description: 'When all required gates pass, lead access becomes active automatically.'
    }
  ].map((s) => ({ ...s, status: getStepStatus(member, requests, s.key) }));

  const approved = steps.filter((s) => s.status === 'approved').length;

  return {
    track: member?.licensed ? 'licensed' : 'unlicensed',
    leadAccessActive: Boolean(member?.leadAccessActive),
    progressPct: Math.round((approved / steps.length) * 100),
    steps
  };
}

function findMember(members = [], { name = '', email = '' } = {}) {
  const nm = normalize(name);
  const em = normalize(email);
  return members.find((m) => (em && normalize(m?.email) === em) || (nm && normalize(m?.name) === nm));
}

function demoMember(mode = 'unlicensed') {
  if (mode === 'licensed') {
    const m = defaultMember({
      id: 'demo_licensed',
      name: 'Demo Licensed Agent',
      email: 'demo.licensed@innercirclelink.com',
      licensed: true,
      onboardingComplete: true,
      communityServiceApproved: true,
      schoolCommunityJoined: true,
      youtubeCommentApproved: true,
      contractingStarted: true,
      active: true,
      tier: 'PROGRAM_TIER_0',
      commissionNonSponsoredPct: 50
    });
    m.leadAccessActive = true;
    return m;
  }

  const m = defaultMember({
    id: 'demo_unlicensed',
    name: 'Demo Unlicensed Agent',
    email: 'demo.unlicensed@innercirclelink.com',
    licensed: false,
    onboardingComplete: true,
    communityServiceApproved: false,
    schoolCommunityJoined: false,
    youtubeCommentApproved: false,
    contractingStarted: false,
    active: true,
    tier: 'PROGRAM_TIER_0',
    commissionNonSponsoredPct: 50
  });
  m.leadAccessActive = false;
  return m;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const demo = normalize(searchParams.get('demo') || '');
  const viewer = {
    name: clean(searchParams.get('viewerName') || ''),
    email: clean(searchParams.get('viewerEmail') || '').toLowerCase()
  };

  const [membersRaw, requestsRaw] = await Promise.all([
    loadJsonFile(MEMBERS_PATH, []),
    loadJsonFile(REQUESTS_PATH, [])
  ]);

  const members = (Array.isArray(membersRaw) ? membersRaw : []).map((m) => defaultMember(m));
  const requests = Array.isArray(requestsRaw) ? requestsRaw : [];

  const member = demo ? demoMember(demo) : findMember(members, viewer);
  if (!member) {
    return Response.json({ ok: false, error: 'member_not_found' }, { status: 404 });
  }

  member.leadAccessActive = gatePass(member);
  const sop = buildSop(member, requests);

  return Response.json({
    ok: true,
    member,
    sop,
    resources: {
      skoolUrl: clean(process.env.SPONSORSHIP_SKOOL_URL || ''),
      youtubeUrl: clean(process.env.SPONSORSHIP_YOUTUBE_URL || '')
    }
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = normalize(body?.action || '');

  const [membersRaw, requestsRaw] = await Promise.all([
    loadJsonFile(MEMBERS_PATH, []),
    loadJsonFile(REQUESTS_PATH, [])
  ]);

  const members = (Array.isArray(membersRaw) ? membersRaw : []).map((m) => defaultMember(m));
  const requests = Array.isArray(requestsRaw) ? requestsRaw : [];

  if (action === 'create_testers') {
    const testers = [
      demoMember('licensed'),
      demoMember('unlicensed')
    ];

    for (const t of testers) {
      const idx = members.findIndex((m) => normalize(m?.email) === normalize(t.email));
      if (idx >= 0) members[idx] = { ...members[idx], ...t, id: members[idx].id, updatedAt: nowIso() };
      else members.push({ ...t, id: `spm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, createdAt: nowIso(), updatedAt: nowIso() });
    }

    await saveJsonFile(MEMBERS_PATH, members);
    return Response.json({ ok: true, testers });
  }

  if (action === 'request_approval') {
    const memberName = clean(body?.memberName);
    const memberEmail = clean(body?.memberEmail).toLowerCase();
    const stepKey = clean(body?.stepKey);
    if (!memberName || !memberEmail || !stepKey) {
      return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }

    const exists = requests.find((r) => normalize(r?.memberEmail) === normalize(memberEmail) && clean(r?.stepKey) === stepKey && clean(r?.status) === 'pending');
    if (!exists) {
      requests.push({
        id: `spr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        memberName,
        memberEmail,
        stepKey,
        status: 'pending',
        requestedAt: nowIso()
      });
      await saveJsonFile(REQUESTS_PATH, requests);
    }

    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
}
