import { loadJsonFile, saveJsonFile, loadJsonStore } from '../../../lib/blobJsonStore';

const APPLICATIONS_PATH = 'stores/sponsorship-applications.json';
const BOOKINGS_PATH = 'stores/sponsorship-bookings.json';
const MARKETPLACE_PATH = 'stores/lead-marketplace.json';
const MEMBERS_PATH = 'stores/sponsorship-program-members.json';
const CLAIMS_PATH = 'stores/sponsorship-program-claims.json';
const EVENTS_PATH = 'stores/sponsorship-program-events.json';

const DEFAULT_OWNER_TAG = 'link';
const TIER0_WEEKLY_CAP = 5;
const TIER0_DURATION_WEEKS = 8;
const SLA_MINUTES = 10;

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function normalizePhone(v = '') {
  return String(v || '').replace(/\D/g, '');
}

function nowIso() {
  return new Date().toISOString();
}

function plusWeeksIso(iso = '', weeks = 8) {
  const ts = new Date(iso || Date.now()).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return '';
  return new Date(ts + Number(weeks || 8) * 7 * 24 * 60 * 60 * 1000).toISOString();
}

function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function weekKeyFromIso(iso = '') {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return '';
  return weekKey(d);
}

function minutesBetween(a = '', b = '') {
  const at = new Date(a || 0).getTime();
  const bt = new Date(b || 0).getTime();
  if (!Number.isFinite(at) || !Number.isFinite(bt)) return 0;
  return Math.floor((bt - at) / 60000);
}

function leadKey(row = {}) {
  const id = clean(row.id);
  if (id) return id;
  return `${normalize(row.applicant)}|${normalize(row.email)}|${normalize(row.phone)}`;
}

function fullName(row = {}) {
  return clean(`${row.firstName || ''} ${row.lastName || ''}`);
}

function isApprovedStatus(status = '') {
  return normalize(status).includes('approved');
}

function isOwnedByMarketplace(app = {}, ownerTagRaw = DEFAULT_OWNER_TAG) {
  const ownerTag = normalize(ownerTagRaw || DEFAULT_OWNER_TAG);
  if (!ownerTag) return true;

  const referral = normalize(app?.referralName || app?.referred_by || app?.refCode || app?.referral_code || '');
  const reviewedBy = normalize(app?.reviewedBy || app?.assignedTo || app?.assigned_to || '');

  return referral.includes(ownerTag) || reviewedBy.includes(ownerTag);
}

function normalizeMarketStore(raw = {}) {
  return {
    settings: {
      marketplaceOwnerTag: DEFAULT_OWNER_TAG,
      ...(raw?.settings || {})
    },
    engagementByLeadId: raw?.engagementByLeadId && typeof raw.engagementByLeadId === 'object' ? raw.engagementByLeadId : {},
    soldByLeadId: raw?.soldByLeadId && typeof raw.soldByLeadId === 'object' ? raw.soldByLeadId : {},
    hiddenLeadKeys: raw?.hiddenLeadKeys && typeof raw.hiddenLeadKeys === 'object' ? raw.hiddenLeadKeys : {},
    upsellBySourceSessionId: raw?.upsellBySourceSessionId && typeof raw.upsellBySourceSessionId === 'object' ? raw.upsellBySourceSessionId : {}
  };
}

function buildApprovedNotBooked(apps = [], bookings = [], ownerTag = DEFAULT_OWNER_TAG) {
  const bookingBySourceId = new Map();
  const bookingByName = new Map();

  for (const b of bookings || []) {
    const sourceId = clean(b?.source_application_id);
    if (sourceId) bookingBySourceId.set(sourceId, b);

    const name = normalize(b?.applicant_name);
    if (name && !bookingByName.has(name)) bookingByName.set(name, b);
  }

  const list = [];
  const seen = new Set();

  for (const app of apps || []) {
    if (!isApprovedStatus(app?.status)) continue;
    if (!isOwnedByMarketplace(app, ownerTag)) continue;

    const applicant = fullName(app);
    const sourceId = clean(app?.id);
    const hasBookingById = sourceId && bookingBySourceId.has(sourceId);
    const hasBookingByName = applicant && bookingByName.has(normalize(applicant));
    if (hasBookingById || hasBookingByName) continue;

    const row = {
      id: sourceId,
      applicant,
      email: clean(app?.email),
      phone: clean(app?.phone),
      state: clean(app?.state),
      approvedAt: clean(app?.reviewedAt || app?.updatedAt || app?.submitted_at || '')
    };

    const dedupeKey = `${normalize(row.applicant)}|${normalize(row.email)}|${normalize(row.phone)}`;
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    list.push(row);
  }

  return list.sort((a, b) => new Date(b.approvedAt || 0).getTime() - new Date(a.approvedAt || 0).getTime());
}

function formatLeadForQueue(row = {}, market = {}) {
  const key = leadKey(row);
  const engagement = market?.engagementByLeadId?.[key] === 'replied' ? 'Replied' : 'No Reply';
  return {
    ...row,
    key,
    engagement,
    maskedName: `${clean(row?.applicant || 'Lead').slice(0, 1) || 'L'}***`,
    maskedEmail: `${clean(row?.email || 'lead').slice(0, 1) || 'l'}***@***.com`,
    maskedPhone: `${normalizePhone(row?.phone || '').slice(0, 3).padEnd(3, '*')}-***-****`
  };
}

function normalizeMember(raw = {}) {
  const name = clean(raw?.name);
  const startedAt = clean(raw?.tier0StartAt || raw?.startedAt || nowIso());
  const tier0EndAt = clean(raw?.tier0EndAt || plusWeeksIso(startedAt, TIER0_DURATION_WEEKS));

  const member = {
    id: clean(raw?.id || `spm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    name,
    email: clean(raw?.email).toLowerCase(),
    licensed: Boolean(raw?.licensed),
    onboardingComplete: Boolean(raw?.onboardingComplete),
    communityServiceApproved: Boolean(raw?.communityServiceApproved),
    schoolCommunityJoined: Boolean(raw?.schoolCommunityJoined),
    youtubeCommentApproved: Boolean(raw?.youtubeCommentApproved),
    contractingStarted: Boolean(raw?.contractingStarted),
    contractingComplete: Boolean(raw?.contractingComplete),
    leadAccessActive: Boolean(raw?.leadAccessActive),
    tier: clean(raw?.tier || 'PROGRAM_TIER_0') || 'PROGRAM_TIER_0',
    tier0StartAt: startedAt,
    tier0EndAt,
    tier0WeeklyCap: Number(raw?.tier0WeeklyCap || TIER0_WEEKLY_CAP),
    commissionNonSponsoredPct: Number(raw?.commissionNonSponsoredPct || 50),
    active: raw?.active !== false,
    notes: clean(raw?.notes || ''),
    updatedAt: nowIso(),
    createdAt: clean(raw?.createdAt || nowIso())
  };

  const gatePass = member.licensed && member.onboardingComplete && member.communityServiceApproved && member.schoolCommunityJoined && member.youtubeCommentApproved && (member.contractingStarted || member.contractingComplete);
  member.leadAccessActive = gatePass && member.active;

  return member;
}

function findMember(members = [], { name = '', email = '' } = {}) {
  const nm = normalize(name);
  const em = normalize(email);
  return members.find((m) => (em && normalize(m?.email) === em) || (nm && normalize(m?.name) === nm));
}

function countMemberGrabsThisWeek(events = [], member = {}, now = new Date()) {
  const key = weekKey(now);
  return (events || []).filter((e) => clean(e?.type) === 'lead_grabbed' && normalize(e?.memberName) === normalize(member?.name) && clean(e?.weekKey) === key).length;
}

function memberTierPolicy(member = {}, now = new Date(), events = []) {
  const tier = clean(member?.tier || 'PROGRAM_TIER_0');
  const out = {
    tier,
    capPerWeek: null,
    windowActive: true,
    weeklyUsed: 0,
    weeklyRemaining: null,
    eligible: Boolean(member?.leadAccessActive),
    reason: ''
  };

  if (!out.eligible) {
    out.reason = 'gate_not_passed';
    return out;
  }

  if (tier !== 'PROGRAM_TIER_0') return out;

  const start = new Date(member?.tier0StartAt || 0).getTime();
  const end = new Date(member?.tier0EndAt || 0).getTime();
  const nowTs = new Date(now).getTime();

  out.capPerWeek = Number(member?.tier0WeeklyCap || TIER0_WEEKLY_CAP);
  out.weeklyUsed = countMemberGrabsThisWeek(events, member, now);
  out.weeklyRemaining = Math.max(0, out.capPerWeek - out.weeklyUsed);

  if (!start || !end || nowTs < start || nowTs > end) {
    out.windowActive = false;
    out.eligible = false;
    out.reason = 'tier0_window_inactive';
    return out;
  }

  if (out.weeklyRemaining <= 0) {
    out.eligible = false;
    out.reason = 'weekly_cap_reached';
  }

  return out;
}

function enforceSlaExpiry(claims = [], events = [], now = new Date()) {
  let changed = false;

  for (const c of claims || []) {
    if (clean(c?.status) !== 'grabbed') continue;
    if (clean(c?.firstContactAt)) continue;

    const mins = minutesBetween(c?.grabbedAt, now.toISOString());
    if (mins < SLA_MINUTES) continue;

    c.status = 'released_sla_miss';
    c.releasedAt = now.toISOString();
    c.releaseReason = 'sla_miss';
    c.updatedAt = now.toISOString();
    changed = true;

    events.push({
      id: `spe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'sla_missed_reassigned',
      claimId: c.id,
      leadKey: c.leadKey,
      memberName: c.memberName,
      memberEmail: c.memberEmail,
      timestamp: now.toISOString(),
      weekKey: weekKey(now),
      minutesToMiss: mins
    });
  }

  return changed;
}

function recentClaimsForMember(claims = [], member = {}, sinceIso = '') {
  const cutoff = new Date(sinceIso || 0).getTime();
  return (claims || []).filter((c) => {
    const sameMember = normalize(c?.memberName) === normalize(member?.name) || normalize(c?.memberEmail) === normalize(member?.email);
    if (!sameMember) return false;
    if (!cutoff) return true;
    return new Date(c?.grabbedAt || 0).getTime() >= cutoff;
  });
}

function commissionForTier(tier = 'PROGRAM_TIER_0') {
  if (tier === 'PROGRAM_TIER_1') return 60;
  if (tier === 'PROGRAM_TIER_2') return 70;
  if (tier === 'PROGRAM_TIER_3') return 80;
  return 50;
}

function buildUpgradeRecommendations(members = [], claims = [], now = new Date()) {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  return (members || []).map((member) => {
    const recent = recentClaimsForMember(claims, member, since);
    const grabs = recent.length;
    const contactLogged = recent.filter((c) => clean(c?.status) === 'contact_logged').length;
    const slaMetCount = recent.filter((c) => c?.slaMet === true).length;
    const avgFirstContact = contactLogged
      ? Math.round(recent.filter((c) => clean(c?.status) === 'contact_logged').reduce((acc, c) => acc + Number(c?.minutesToFirstContact || 0), 0) / Math.max(1, contactLogged))
      : null;
    const slaRate = contactLogged ? Math.round((slaMetCount / contactLogged) * 100) : 0;

    let recommendTier = '';
    let price = '';
    let commission = member?.commissionNonSponsoredPct || commissionForTier(member?.tier);
    let rationale = 'Continue current tier until more activity logs in.';
    let urgency = 'monitor';

    if (!member?.leadAccessActive) {
      rationale = 'Complete gate requirements first (license/onboarding/community/contracting-started).';
      urgency = 'hold';
    } else if (member?.tier === 'PROGRAM_TIER_0') {
      if (contactLogged >= 8 && slaRate >= 80) {
        recommendTier = 'PROGRAM_TIER_1';
        price = '$97';
        commission = 60;
        rationale = 'Consistent contact volume + SLA discipline. Ready for first paid activation.';
        urgency = 'promote';
      } else {
        rationale = 'Needs 8+ logged contacts in 30d and 80%+ SLA to trigger Tier 1 recommendation.';
      }
    } else if (member?.tier === 'PROGRAM_TIER_1') {
      if (contactLogged >= 20 && slaRate >= 85) {
        recommendTier = 'PROGRAM_TIER_2';
        price = '$497';
        commission = 70;
        rationale = 'Strong operating discipline and production behavior support Tier 2.';
        urgency = 'promote';
      } else if (contactLogged >= 10 && slaRate < 65) {
        rationale = 'SLA quality is dropping. Coach before upgrade.';
        urgency = 'coach';
      } else {
        rationale = 'Needs 20+ logged contacts and 85%+ SLA for Tier 2 recommendation.';
      }
    } else if (member?.tier === 'PROGRAM_TIER_2') {
      if (contactLogged >= 45 && slaRate >= 90) {
        recommendTier = 'PROGRAM_TIER_3';
        price = '$1,200';
        commission = 80;
        rationale = 'High consistency + speed supports scale package activation.';
        urgency = 'promote';
      } else if (contactLogged >= 15 && slaRate < 70) {
        rationale = 'Fix SLA consistency before moving to Tier 3.';
        urgency = 'coach';
      } else {
        rationale = 'Needs 45+ logged contacts and 90%+ SLA for Tier 3 recommendation.';
      }
    } else {
      rationale = 'Top tier active. Maintain SLA and conversion discipline.';
      urgency = 'maintain';
    }

    return {
      memberId: member.id,
      memberName: member.name,
      currentTier: member.tier,
      recommendTier,
      recommendPrice: price,
      projectedCommissionPct: commission,
      grabs30d: grabs,
      contactLogged30d: contactLogged,
      slaMet30d: slaMetCount,
      slaRate30d: slaRate,
      avgFirstContactMin: avgFirstContact,
      urgency,
      rationale
    };
  }).sort((a, b) => {
    const order = { promote: 0, coach: 1, monitor: 2, maintain: 3, hold: 4 };
    const ao = order[a.urgency] ?? 9;
    const bo = order[b.urgency] ?? 9;
    if (ao !== bo) return ao - bo;
    return clean(a.memberName).localeCompare(clean(b.memberName));
  });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const viewer = {
    name: clean(searchParams.get('viewerName') || ''),
    email: clean(searchParams.get('viewerEmail') || '').toLowerCase(),
    role: clean(searchParams.get('viewerRole') || '')
  };

  const [apps, bookings, rawMarket, rawMembers, rawClaims, rawEvents] = await Promise.all([
    loadJsonStore(APPLICATIONS_PATH, []),
    loadJsonStore(BOOKINGS_PATH, []),
    loadJsonFile(MARKETPLACE_PATH, {}),
    loadJsonFile(MEMBERS_PATH, []),
    loadJsonFile(CLAIMS_PATH, []),
    loadJsonFile(EVENTS_PATH, [])
  ]);

  const market = normalizeMarketStore(rawMarket);
  const members = (Array.isArray(rawMembers) ? rawMembers : []).map((m) => normalizeMember(m));
  const claims = Array.isArray(rawClaims) ? rawClaims : [];
  const events = Array.isArray(rawEvents) ? rawEvents : [];

  const slaChanged = enforceSlaExpiry(claims, events, new Date());
  if (slaChanged) {
    await Promise.all([
      saveJsonFile(CLAIMS_PATH, claims),
      saveJsonFile(EVENTS_PATH, events.slice(-5000))
    ]);
  }

  const ownerTag = market?.settings?.marketplaceOwnerTag || DEFAULT_OWNER_TAG;
  const baseRows = buildApprovedNotBooked(apps, bookings, ownerTag).map((r) => formatLeadForQueue(r, market));

  const claimedActive = new Set(claims.filter((c) => clean(c?.status) === 'grabbed').map((c) => clean(c?.leadKey)));
  const soldKeys = new Set(Object.keys(market?.soldByLeadId || {}));

  const queueRows = baseRows.filter((r) => !soldKeys.has(r.key) && !claimedActive.has(r.key));

  const member = findMember(members, viewer);
  const policy = member ? memberTierPolicy(member, new Date(), events) : { eligible: false, reason: 'member_not_found' };

  const myClaims = claims
    .filter((c) => normalize(c?.memberName) === normalize(viewer.name) || normalize(c?.memberEmail) === normalize(viewer.email))
    .sort((a, b) => new Date(b?.grabbedAt || 0).getTime() - new Date(a?.grabbedAt || 0).getTime())
    .map((c) => {
      const lead = baseRows.find((r) => r.key === c.leadKey);
      return {
        ...c,
        applicant: lead?.applicant || c?.leadApplicant || 'Lead',
        email: lead?.email || c?.leadEmail || '',
        phone: lead?.phone || c?.leadPhone || '',
        state: lead?.state || c?.state || ''
      };
    });

  const recommendations = buildUpgradeRecommendations(members, claims, new Date());

  return Response.json({
    ok: true,
    config: {
      slaMinutes: SLA_MINUTES,
      tier0WeeklyCap: TIER0_WEEKLY_CAP,
      tier0DurationWeeks: TIER0_DURATION_WEEKS
    },
    member,
    policy,
    queue: queueRows.map((r) => ({
      key: r.key,
      state: r.state,
      engagement: r.engagement,
      approvedAt: r.approvedAt,
      maskedName: r.maskedName,
      maskedEmail: r.maskedEmail,
      maskedPhone: r.maskedPhone
    })),
    myClaims,
    admin: {
      members,
      claims: claims.sort((a, b) => new Date(b?.grabbedAt || 0).getTime() - new Date(a?.grabbedAt || 0).getTime()).slice(0, 500),
      recentEvents: events.sort((a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime()).slice(0, 200),
      recommendations
    }
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = normalize(body?.action || '');

  const [apps, bookings, rawMarket, rawMembers, rawClaims, rawEvents] = await Promise.all([
    loadJsonStore(APPLICATIONS_PATH, []),
    loadJsonStore(BOOKINGS_PATH, []),
    loadJsonFile(MARKETPLACE_PATH, {}),
    loadJsonFile(MEMBERS_PATH, []),
    loadJsonFile(CLAIMS_PATH, []),
    loadJsonFile(EVENTS_PATH, [])
  ]);

  const market = normalizeMarketStore(rawMarket);
  const members = (Array.isArray(rawMembers) ? rawMembers : []).map((m) => normalizeMember(m));
  const claims = Array.isArray(rawClaims) ? rawClaims : [];
  const events = Array.isArray(rawEvents) ? rawEvents : [];

  enforceSlaExpiry(claims, events, new Date());

  if (action === 'upsert_member') {
    const incoming = normalizeMember({
      ...(body?.member || {}),
      id: clean(body?.member?.id)
    });

    if (!incoming.name || !incoming.email) {
      return Response.json({ ok: false, error: 'missing_member_identity' }, { status: 400 });
    }

    const idx = members.findIndex((m) => normalize(m?.email) === normalize(incoming.email) || normalize(m?.name) === normalize(incoming.name));
    if (idx >= 0) {
      const existing = members[idx];
      members[idx] = normalizeMember({ ...existing, ...incoming, id: existing.id, createdAt: existing.createdAt });
    } else {
      members.push(incoming);
    }

    events.push({
      id: `spe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'member_upserted',
      memberName: incoming.name,
      memberEmail: incoming.email,
      actor: clean(body?.actorName || 'Admin'),
      timestamp: nowIso(),
      weekKey: weekKey(new Date())
    });

    await Promise.all([
      saveJsonFile(MEMBERS_PATH, members),
      saveJsonFile(CLAIMS_PATH, claims),
      saveJsonFile(EVENTS_PATH, events.slice(-5000))
    ]);

    return Response.json({ ok: true, members });
  }

  if (action === 'grab_lead') {
    const viewer = {
      name: clean(body?.viewerName),
      email: clean(body?.viewerEmail).toLowerCase()
    };

    const member = findMember(members, viewer);
    if (!member) return Response.json({ ok: false, error: 'member_not_found' }, { status: 404 });

    const policy = memberTierPolicy(member, new Date(), events);
    if (!policy.eligible) return Response.json({ ok: false, error: policy.reason || 'not_eligible' }, { status: 409 });

    const requestedLeadKey = clean(body?.leadKey);
    if (!requestedLeadKey) return Response.json({ ok: false, error: 'missing_lead_key' }, { status: 400 });

    const ownerTag = market?.settings?.marketplaceOwnerTag || DEFAULT_OWNER_TAG;
    const queueRows = buildApprovedNotBooked(apps, bookings, ownerTag).map((r) => formatLeadForQueue(r, market));
    const lead = queueRows.find((r) => r.key === requestedLeadKey);
    if (!lead) return Response.json({ ok: false, error: 'lead_not_found' }, { status: 404 });

    if (market?.soldByLeadId?.[requestedLeadKey]) {
      return Response.json({ ok: false, error: 'lead_unavailable' }, { status: 409 });
    }

    const activeClaim = claims.find((c) => c.leadKey === requestedLeadKey && clean(c?.status) === 'grabbed');
    if (activeClaim) return Response.json({ ok: false, error: 'already_grabbed' }, { status: 409 });

    const claim = {
      id: `spc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      leadKey: requestedLeadKey,
      leadApplicant: lead.applicant,
      leadEmail: lead.email,
      leadPhone: lead.phone,
      state: lead.state,
      engagement: lead.engagement,
      memberName: member.name,
      memberEmail: member.email,
      memberTier: member.tier,
      grabbedAt: nowIso(),
      firstContactAt: '',
      status: 'grabbed',
      updatedAt: nowIso()
    };

    claims.push(claim);

    market.hiddenLeadKeys[requestedLeadKey] = {
      hiddenAt: nowIso(),
      hiddenBy: member.name,
      reason: 'sponsorship_queue_grab'
    };

    events.push({
      id: `spe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'lead_grabbed',
      claimId: claim.id,
      leadKey: requestedLeadKey,
      memberName: member.name,
      memberEmail: member.email,
      timestamp: claim.grabbedAt,
      weekKey: weekKey(new Date())
    });

    await Promise.all([
      saveJsonFile(CLAIMS_PATH, claims),
      saveJsonFile(EVENTS_PATH, events.slice(-5000)),
      saveJsonFile(MARKETPLACE_PATH, market)
    ]);

    return Response.json({ ok: true, claim });
  }

  if (action === 'mark_first_contact') {
    const claimId = clean(body?.claimId);
    const viewerName = clean(body?.viewerName);
    const viewerEmail = clean(body?.viewerEmail).toLowerCase();
    if (!claimId) return Response.json({ ok: false, error: 'missing_claim_id' }, { status: 400 });

    const idx = claims.findIndex((c) => c.id === claimId);
    if (idx < 0) return Response.json({ ok: false, error: 'claim_not_found' }, { status: 404 });

    const claim = claims[idx];
    const canAct = normalize(claim?.memberName) === normalize(viewerName) || normalize(claim?.memberEmail) === normalize(viewerEmail);
    if (!canAct) return Response.json({ ok: false, error: 'not_claim_owner' }, { status: 403 });

    const firstContactAt = nowIso();
    const mins = minutesBetween(claim.grabbedAt, firstContactAt);
    const slaMet = mins <= SLA_MINUTES;

    claims[idx] = {
      ...claim,
      firstContactAt,
      status: 'contact_logged',
      slaMet,
      minutesToFirstContact: mins,
      updatedAt: nowIso()
    };

    events.push({
      id: `spe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'first_contact_logged',
      claimId: claim.id,
      leadKey: claim.leadKey,
      memberName: claim.memberName,
      memberEmail: claim.memberEmail,
      timestamp: firstContactAt,
      weekKey: weekKey(new Date()),
      slaMet,
      minutesToFirstContact: mins
    });

    await Promise.all([
      saveJsonFile(CLAIMS_PATH, claims),
      saveJsonFile(EVENTS_PATH, events.slice(-5000))
    ]);

    return Response.json({ ok: true, claim: claims[idx] });
  }

  return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
}
