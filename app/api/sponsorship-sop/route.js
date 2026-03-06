import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

const MEMBERS_PATH = 'stores/sponsorship-program-members.json';
const REQUESTS_PATH = 'stores/sponsorship-sop-requests.json';
const INVITES_PATH = 'stores/sponsorship-sop-invites.json';
const AUTH_USERS_PATH = 'stores/sponsorship-sop-auth-users.json';

const DEFAULT_SKOOL_URL = 'https://www.skool.com/legacylink/about';
const DEFAULT_YOUTUBE_URL = 'https://youtu.be/SVvU9SvCH9o?si=H9BNtEDzglTuvJaI';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function nowIso() {
  return new Date().toISOString();
}

function randomToken(prefix = 'sop') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function randomPassword() {
  const base = Math.random().toString(36).slice(-6).toUpperCase();
  return `LL-${base}`;
}

function plusWeeksIso(iso = '', weeks = 8) {
  const ts = new Date(iso || Date.now()).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return '';
  return new Date(ts + Number(weeks || 8) * 7 * 24 * 60 * 60 * 1000).toISOString();
}

function gatePass(member = {}) {
  return Boolean(
    member?.licensed &&
    clean(member?.npn) &&
    member?.communityServiceApproved &&
    member?.schoolCommunityJoined &&
    member?.youtubeCommentApproved &&
    (member?.contractingStarted || member?.contractingComplete) &&
    member?.sponsorshipScriptAcknowledged &&
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
    npn: clean(raw?.npn || ''),
    onboardingComplete: Boolean(raw?.onboardingComplete),
    sponsorshipScriptAcknowledged: Boolean(raw?.sponsorshipScriptAcknowledged),
    communityServiceApproved: Boolean(raw?.communityServiceApproved),
    schoolCommunityJoined: Boolean(raw?.schoolCommunityJoined),
    youtubeCommentApproved: Boolean(raw?.youtubeCommentApproved),
    contractingStarted: Boolean(raw?.contractingStarted),
    contractingComplete: Boolean(raw?.contractingComplete),
    active: raw?.active !== false,
    tier: clean(raw?.tier || 'TIER_SPONSORSHIP') || 'TIER_SPONSORSHIP',
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

function hasPendingRequest(member = {}, requests = [], stepKey = '') {
  return Boolean((requests || []).find((r) => normalize(r?.memberEmail) === normalize(member?.email) && clean(r?.stepKey) === stepKey && clean(r?.status) === 'pending'));
}

function getStepStatus(member = {}, requests = [], stepKey = '') {
  const req = hasPendingRequest(member, requests, stepKey);

  if (stepKey === 'community_service_submit') return member?.communityServiceApproved ? 'approved' : req ? 'pending' : 'not_started';
  if (stepKey === 'license_verified') return clean(member?.npn) ? 'approved' : req ? 'pending' : 'not_started';
  if (stepKey === 'skool_joined') return member?.schoolCommunityJoined ? 'approved' : req ? 'pending' : 'not_started';
  if (stepKey === 'youtube_comment_approved') return member?.youtubeCommentApproved ? 'approved' : req ? 'pending' : 'not_started';

  if (stepKey === 'contracting_started') {
    const skoolGateOpened = member?.schoolCommunityJoined || hasPendingRequest(member, requests, 'skool_joined');
    if (!skoolGateOpened) return 'locked';
    return (member?.contractingStarted || member?.contractingComplete) ? 'approved' : 'not_started';
  }

  if (stepKey === 'unlicensed_contact_jamal') {
    if (member?.licensed) return 'approved';
    return req ? 'pending' : 'not_started';
  }

  if (stepKey === 'sponsorship_script_ack') {
    if (!member?.licensed) return 'locked';
    const unlocked = Boolean(member?.communityServiceApproved && member?.contractingComplete);
    if (!unlocked) return 'locked';
    return member?.sponsorshipScriptAcknowledged ? 'approved' : 'not_started';
  }

  if (stepKey === 'lead_access_active') return member?.leadAccessActive ? 'approved' : 'locked';

  return req ? 'pending' : 'not_started';
}

function buildSop(member = {}, requests = []) {
  const steps = [
    {
      key: 'community_service_submit',
      title: 'Submit community service proof',
      type: 'approval_required',
      description: 'Upload/submit your community service completion for approval.'
    },
    {
      key: 'license_verified',
      title: 'License verification (NPN)',
      type: 'self_or_review',
      description: 'Enter your National Producer Number (NPN). This is required for licensed-track lead access.'
    },
    ...(!member?.licensed ? [{
      key: 'unlicensed_contact_jamal',
      title: 'Unlicensed: Contact Jamal to start licensing',
      type: 'approval_required',
      description: 'If you are not licensed, request this step and connect with Jamal to start your licensing process. Once licensed, this step is confirmed.'
    }] : []),
    {
      key: 'skool_joined',
      title: 'Join SKOOL community',
      type: 'approval_required',
      description: 'Request-only gate: submit your SKOOL join request to unlock contracting start.'
    },
    {
      key: 'contracting_started',
      title: 'Contracting process started',
      type: 'self_or_review',
      description: 'This unlocks only after SKOOL request is submitted. Mark started when you begin F&G contracting.'
    },
    {
      key: 'youtube_comment_approved',
      title: 'Watch “Whatever It Takes” + comment approved',
      type: 'approval_required',
      description: 'Watch the required YouTube video and leave a comment. Admin must approve after manual review.'
    },
    {
      key: 'sponsorship_script_ack',
      title: 'Sponsorship script acknowledged (licensed only)',
      type: 'self_or_review',
      description: 'Unlocked only after community service approved + F&G contracting approved. Confirm you reviewed the sponsorship script.'
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

function findInvite(invites = [], token = '') {
  const tk = clean(token);
  if (!tk) return null;
  return (invites || []).find((i) => clean(i?.token) === tk && clean(i?.status || 'active') === 'active') || null;
}

function upsertInvite(invites = [], member = {}) {
  const em = normalize(member?.email || '');
  const nm = normalize(member?.name || '');
  const existingIdx = (invites || []).findIndex((i) => normalize(i?.memberEmail) === em || (nm && normalize(i?.memberName) === nm));

  const invite = {
    id: `spi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    token: randomToken('sop'),
    memberName: clean(member?.name),
    memberEmail: clean(member?.email).toLowerCase(),
    status: 'active',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  if (existingIdx >= 0) {
    invites[existingIdx] = {
      ...invites[existingIdx],
      ...invite,
      id: invites[existingIdx].id,
      createdAt: invites[existingIdx].createdAt || invite.createdAt
    };
    return invites[existingIdx];
  }

  invites.push(invite);
  return invite;
}

function upsertAuthUser(authUsers = [], member = {}) {
  const email = clean(member?.email).toLowerCase();
  const name = clean(member?.name);
  const idx = authUsers.findIndex((u) => normalize(u?.email) === normalize(email));

  if (idx >= 0) {
    authUsers[idx] = { ...authUsers[idx], name, email, active: true, updatedAt: nowIso() };
    return { user: authUsers[idx], plainPassword: '', created: false };
  }

  const password = randomPassword();
  const user = {
    id: `sau_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    email,
    role: 'agent',
    password,
    active: true,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  authUsers.push(user);
  return { user, plainPassword: password, created: true };
}

function demoMember(mode = 'unlicensed') {
  if (mode === 'licensed') {
    const m = defaultMember({
      id: 'demo_licensed',
      name: 'Demo Licensed Agent',
      email: 'demo.licensed@innercirclelink.com',
      licensed: true,
      npn: '12345678',
      onboardingComplete: true,
      sponsorshipScriptAcknowledged: true,
      communityServiceApproved: true,
      schoolCommunityJoined: true,
      youtubeCommentApproved: true,
      contractingStarted: true,
      contractingComplete: true,
      active: true,
      tier: 'TIER_SPONSORSHIP',
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
    tier: 'TIER_SPONSORSHIP',
    commissionNonSponsoredPct: 50
  });
  m.leadAccessActive = false;
  return m;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const demo = normalize(searchParams.get('demo') || '');
  const inviteToken = clean(searchParams.get('invite') || '');
  const viewer = {
    name: clean(searchParams.get('viewerName') || ''),
    email: clean(searchParams.get('viewerEmail') || '').toLowerCase()
  };

  const [membersRaw, requestsRaw, invitesRaw] = await Promise.all([
    loadJsonFile(MEMBERS_PATH, []),
    loadJsonFile(REQUESTS_PATH, []),
    loadJsonFile(INVITES_PATH, [])
  ]);

  const members = (Array.isArray(membersRaw) ? membersRaw : []).map((m) => defaultMember(m));
  const requests = Array.isArray(requestsRaw) ? requestsRaw : [];
  const invites = Array.isArray(invitesRaw) ? invitesRaw : [];

  const invite = findInvite(invites, inviteToken);
  const invitedViewer = invite ? { name: invite.memberName, email: invite.memberEmail } : viewer;

  const member = demo ? demoMember(demo) : findMember(members, invitedViewer);
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
      skoolUrl: clean(process.env.SPONSORSHIP_SKOOL_URL || DEFAULT_SKOOL_URL),
      youtubeUrl: clean(process.env.SPONSORSHIP_YOUTUBE_URL || DEFAULT_YOUTUBE_URL),
      jamalContact: clean(process.env.SPONSORSHIP_JAMAL_CONTACT || 'Jamal')
    },
    inviteToken: invite ? invite.token : ''
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = normalize(body?.action || '');

  const [membersRaw, requestsRaw, invitesRaw] = await Promise.all([
    loadJsonFile(MEMBERS_PATH, []),
    loadJsonFile(REQUESTS_PATH, []),
    loadJsonFile(INVITES_PATH, [])
  ]);

  const members = (Array.isArray(membersRaw) ? membersRaw : []).map((m) => defaultMember(m));
  const requests = Array.isArray(requestsRaw) ? requestsRaw : [];
  const invites = Array.isArray(invitesRaw) ? invitesRaw : [];

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

  if (action === 'generate_invite') {
    const memberName = clean(body?.memberName);
    const memberEmail = clean(body?.memberEmail).toLowerCase();
    if (!memberName || !memberEmail) return Response.json({ ok: false, error: 'missing_member_identity' }, { status: 400 });

    const member = findMember(members, { name: memberName, email: memberEmail });
    if (!member) return Response.json({ ok: false, error: 'member_not_found' }, { status: 404 });

    const invite = upsertInvite(invites, member);
    await saveJsonFile(INVITES_PATH, invites);

    const origin = clean(body?.origin) || clean(process.env.NEXT_PUBLIC_APP_URL) || 'https://innercirclelink.com';
    const inviteUrl = `${origin.replace(/\/$/, '')}/sponsorship-sop?invite=${encodeURIComponent(invite.token)}`;
    return Response.json({ ok: true, invite, inviteUrl });
  }

  if (action === 'self_complete_step') {
    const memberName = clean(body?.memberName);
    const memberEmail = clean(body?.memberEmail).toLowerCase();
    const stepKey = clean(body?.stepKey);
    if (!memberName || !memberEmail || !stepKey) return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });

    const idx = members.findIndex((m) => normalize(m?.email) === normalize(memberEmail) || normalize(m?.name) === normalize(memberName));
    if (idx < 0) return Response.json({ ok: false, error: 'member_not_found' }, { status: 404 });

    const row = members[idx];

    if (stepKey === 'contracting_started') {
      const skoolGateOpened = Boolean(row?.schoolCommunityJoined || hasPendingRequest(row, requests, 'skool_joined'));
      if (!skoolGateOpened) return Response.json({ ok: false, error: 'skool_request_required_first' }, { status: 400 });
      members[idx] = defaultMember({ ...row, contractingStarted: true });
      await saveJsonFile(MEMBERS_PATH, members);
      return Response.json({ ok: true, member: members[idx] });
    }

    if (stepKey === 'sponsorship_script_ack') {
      if (!row?.licensed) return Response.json({ ok: false, error: 'licensed_only_step' }, { status: 400 });
      if (!(row?.communityServiceApproved && row?.contractingComplete)) {
        return Response.json({ ok: false, error: 'locked_until_community_and_contracting_approved' }, { status: 400 });
      }
      members[idx] = defaultMember({ ...row, sponsorshipScriptAcknowledged: true });
      await saveJsonFile(MEMBERS_PATH, members);
      return Response.json({ ok: true, member: members[idx] });
    }

    return Response.json({ ok: false, error: 'step_not_self_completable' }, { status: 400 });
  }

  if (action === 'update_profile_fields') {
    const memberName = clean(body?.memberName);
    const memberEmail = clean(body?.memberEmail).toLowerCase();
    const npn = clean(body?.npn);
    if (!memberName || !memberEmail) return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });

    const idx = members.findIndex((m) => normalize(m?.email) === normalize(memberEmail) || normalize(m?.name) === normalize(memberName));
    if (idx < 0) return Response.json({ ok: false, error: 'member_not_found' }, { status: 404 });

    members[idx] = defaultMember({ ...members[idx], npn });
    await saveJsonFile(MEMBERS_PATH, members);
    return Response.json({ ok: true, member: members[idx] });
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
