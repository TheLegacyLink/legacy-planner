'use client';

import { useEffect, useMemo, useState } from 'react';
import licensedAgents from '../../data/licensedAgents.json';
import CommunityServiceTab from './community-service-tab';
import LinkBlendBuilderTab from './tools-link-blend-builder';
import DailyDrive from '../../components/DailyDrive';

const SESSION_KEY = 'inner_circle_hub_member_v1';
const LINK_LEADS_SESSION_KEY = 'legacy_lead_marketplace_user_v1';
const INNER_CIRCLE_DEFAULT_PASSWORD = 'InnerCircle#2026';

function clean(v = '') { return String(v || '').trim(); }
function readSession() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
function firstNameFromMember(member = {}) {
  return clean(member?.applicantName || member?.email).split(/\s+/)[0] || 'Member';
}
function onboardingState(member = {}) {
  const contract = Boolean(member?.contractSignedAt);
  const payment = Boolean(member?.paymentReceivedAt);
  const password = Boolean(member?.hasPassword);
  const active = Boolean(member?.active);
  const pct = Math.round(([contract, payment, password].filter(Boolean).length / 3) * 100);
  return { contract, payment, password, active, pct };
}
function todayDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function toNum(v = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function formatUsPhone(v = '') {
  const digits = String(v || '').replace(/\D+/g, '');
  const core = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (core.length !== 10) return clean(v);
  return `${core.slice(0, 3)}-${core.slice(3, 6)}-${core.slice(6)}`;
}

function normName(v = '') {
  return clean(v).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function nameSig(v = '') {
  const parts = normName(v).split(' ').filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]}_${parts[parts.length - 1]}`;
}

function slugify(v = '') {
  return clean(v)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function licensedDisplayName(row = {}) {
  const full = clean(row?.full_name || row?.name || '');
  if (!full) return '';
  if (!full.includes(',')) return full;
  const [last, first] = full.split(',').map((x) => clean(x));
  return clean(`${first} ${last}`);
}

const LICENSED_NAME_OVERRIDES = new Set([
  'angelique lassiter',
  'angelic lassiter',
  'shannon maxwell'
]);

const INNER_CIRCLE_NAME_OVERRIDES = new Set([
  'mahogany burn',
  'mahogany burns',
  'shannon maxwell'
]);

function rowTs(row = {}) {
  const raw = row?.approvedAt || row?.submittedAt || row?.updatedAt || row?.createdAt || row?.created_at || row?.approved_at || '';
  const t = new Date(raw || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function monthShortFromKey(key = '') {
  const m = String(key || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return key || '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short' });
}

function followingWeekFridayIso(fromIso = '') {
  const d = new Date(fromIso || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDay();
  const mondayOffset = (day + 6) % 7;
  const monday = new Date(d);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - mondayOffset);
  const nextWeekFriday = new Date(monday);
  nextWeekFriday.setDate(monday.getDate() + 11);
  nextWeekFriday.setHours(12, 0, 0, 0);
  return nextWeekFriday.toISOString();
}

function monthKeyFromIso(iso = '') {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function normalizePolicyTypeLabel(v = '') {
  const t = clean(v).toLowerCase();
  if (t.includes('sponsorship')) return 'Sponsorship Policy';
  if (t.includes('bonus')) return 'Bonus Policy';
  if (t.includes('inner circle')) return 'Inner Circle Policy';
  if (t.includes('juvenile')) return 'Juvenile Policy';
  if (t.includes('regular')) return 'Regular Policy';
  return clean(v);
}

function normalizeLicenseFlag(v = '') {
  const t = clean(v).toLowerCase();
  if (!t) return '';
  if (t.includes('licensed') || t === 'yes' || t === 'true') return 'licensed';
  if (t.includes('unlicensed') || t === 'no' || t === 'false') return 'unlicensed';
  return '';
}

function parseMoveNote(note = '') {
  const raw = clean(note);
  if (!raw.startsWith('prev_parent:')) return null;
  const json = raw.slice('prev_parent:'.length);
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function isApprovedStatus(status = '') {
  return clean(status).toLowerCase().includes('approved');
}

function isFgNlgRow(row = {}) {
  const carrier = clean(row?.carrier || '').toLowerCase();
  const product = clean(row?.productName || '').toLowerCase();
  const type = normalizePolicyTypeLabel(row?.policyType || row?.appType || '').toLowerCase();
  return carrier.includes('f&g')
    || carrier.includes('f and g')
    || carrier.includes('fidelity')
    || carrier.includes('national life')
    || carrier.includes('nlg')
    || product.includes('nlg')
    || product.includes('f&g')
    || product.includes('f and g')
    || type.includes('inner circle');
}

function computeEffectivePoints(row = {}) {
  const existing = Number(row?.pointsEarned || 0) || 0;
  const statusApproved = isApprovedStatus(row?.status || '');
  const type = normalizePolicyTypeLabel(row?.policyType || row?.appType || '');

  // Sponsorship approval is always 1 point.
  if (type === 'Sponsorship Policy') return statusApproved ? 1 : 0;

  // F&G / NLG submission = 50, approval = 500.
  if (isFgNlgRow(row)) {
    if (statusApproved) return 500;
    return 50;
  }

  if (existing > 0) return existing;
  return statusApproved ? existing : 0;
}

function computeEffectiveAdvance(row = {}, points = 0) {
  const existing = Number(row?.advancePayout || row?.payoutAmount || 0) || 0;
  if (existing > 0) return existing;
  const type = normalizePolicyTypeLabel(row?.policyType || row?.appType || '');
  if (type === 'Sponsorship Policy') return isApprovedStatus(row?.status || '') ? 1 : 0;
  if (isFgNlgRow(row)) return Number(points || 0);
  if (!isApprovedStatus(row?.status || '')) return 0;
  return Number(points || 0);
}

function inWindow(ts = 0, windowKey = 'all') {
  if (!ts || windowKey === 'all') return Boolean(ts);
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  if (windowKey === 'month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (windowKey === 'lastMonth') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
  }
  return true;
}
function availableTabs(member = {}) {
  const modules = member?.modules || {};
  const email = clean(member?.email || '').toLowerCase();
  const isKimora = email === 'kimora@thelegacylink.com';
  const all = [
    { key: 'dashboard', label: 'The Lounge' },
    { key: 'dailydrive', label: 'Daily Drive' },
    { key: 'faststart', label: 'Fast Start' },
    { key: 'growth', label: 'Growth Hub' },
    { key: 'scripts2', label: 'Script Vault 2.0' },
    { key: 'execution', label: 'Daily Execution' },
    { key: 'vault', label: 'Resource Vault' },
    { key: 'media', label: 'VIP Media Vault' },
    { key: 'tracker', label: 'KPI Tracker' },
    { key: 'onboarding', label: 'Onboarding Tracker' },
    { key: 'production', label: 'My Production' },
    { key: 'submitapp', label: 'Submit App' },
    { key: 'team', label: 'Team Tree' },
    { key: 'community', label: 'Community Service' },
    { key: 'incentives', label: 'Champions Circle' },
    { key: 'tools', label: 'Tools' },
    ...(isKimora ? [{ key: 'contracts', label: 'Contract Queue' }] : []),
    { key: 'rewards', label: 'VIP Rewards' },
    { key: 'academy', label: 'IUL Academy' },
    { key: 'awards', label: 'Achievement Center' },
    { key: 'links', label: 'My VIP Links' },
    { key: 'library', label: 'PDF Library' },
    { key: 'licensedstates', label: 'My Licensed States' }
  ];
  return all.filter((t) => modules?.[t.key] !== false);
}

function masterDisabledKey(email = '') {
  return `legacy-inner-circle-master-disabled:${String(email || '').trim().toLowerCase()}`;
}

function markMasterDisabled(email = '') {
  if (typeof window === 'undefined') return;
  const key = masterDisabledKey(email);
  if (!key) return;
  try { window.localStorage.setItem(key, '1'); } catch {}
}

function isMasterDisabled(email = '') {
  if (typeof window === 'undefined') return false;
  const key = masterDisabledKey(email);
  if (!key) return false;
  try { return window.localStorage.getItem(key) === '1'; } catch { return false; }
}

function qrUrl(value = '') {
  const data = encodeURIComponent(value || '');
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${data}`;
}

export default function InnerCircleHubPage() {
  const [member, setMember] = useState(() => readSession());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const [kpi, setKpi] = useState(null);
  const [scripts, setScripts] = useState([]);
  const [scriptFilter, setScriptFilter] = useState('all');
  const [vault, setVault] = useState({ content: [], calls: [], onboarding: [] });
  const [leaderboard, setLeaderboard] = useState({ month: '', rows: [] });

  const [tab, setTab] = useState('dashboard');
  const [dailyRows, setDailyRows] = useState([]);
  const [trackerPeriod, setTrackerPeriod] = useState('daily');
  const [activityType, setActivityType] = useState('all');
  const [activityRows, setActivityRows] = useState([]);
  const [policyRows, setPolicyRows] = useState([]);
  const [sponsorshipRows, setSponsorshipRows] = useState([]);
  const [leadClaimRows, setLeadClaimRows] = useState([]);
  const [onboardingDecisionRows, setOnboardingDecisionRows] = useState([]);
  const [teamHierarchyRows, setTeamHierarchyRows] = useState([]);
  const [teamExpanded, setTeamExpanded] = useState({});
  const [hubMembers, setHubMembers] = useState([]);
  const [startIntakeRows, setStartIntakeRows] = useState([]);
  const [startIntakeLoading, setStartIntakeLoading] = useState(false);
  const [startIntakeFilter, setStartIntakeFilter] = useState('pending');
  const [startIntakeSearch, setStartIntakeSearch] = useState('');
  const [startIntakeNotice, setStartIntakeNotice] = useState('');
  const [startIntakeCheckingId, setStartIntakeCheckingId] = useState('');
  const [activityDetail, setActivityDetail] = useState(null);
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaProgress, setMediaProgress] = useState({});
  const [mediaFilter, setMediaFilter] = useState('all');
  const [mediaNotice, setMediaNotice] = useState('');
  const [mediaForm, setMediaForm] = useState({ id: '', type: 'video', title: '', description: '', url: '', tag: 'inner-circle', featured: false, required: false, sortOrder: 100 });
  const [mediaCommentDrafts, setMediaCommentDrafts] = useState({});
  const [assignParentByChild, setAssignParentByChild] = useState({});
  const [assigningChildKey, setAssigningChildKey] = useState('');
  const [moveSearch, setMoveSearch] = useState('');
  const [bulkParentKey, setBulkParentKey] = useState('');
  const [bulkMoveMap, setBulkMoveMap] = useState({});
  const [bulkMoving, setBulkMoving] = useState(false);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const [removingChildKey, setRemovingChildKey] = useState('');
  const [undoingMove, setUndoingMove] = useState(false);
  const [teamParentSearch, setTeamParentSearch] = useState('');
  const [moveParentSearch, setMoveParentSearch] = useState('');
  const [teamAssignNotice, setTeamAssignNotice] = useState('');
  const [productionFilter, setProductionFilter] = useState('all');
  const [productionWindow, setProductionWindow] = useState('month');
  const [pointsHistoryOpen, setPointsHistoryOpen] = useState(false);
  const [pendingBreakdownOpen, setPendingBreakdownOpen] = useState(false);
  const [activitySummary, setActivitySummary] = useState({ submitted: 0, approved: 0, declined: 0, booked: 0, fng: 0, completed: 0 });
  const [activityStats, setActivityStats] = useState({
    daily: { bookings: 0, sponsorshipSubmitted: 0, sponsorshipApproved: 0, fngSubmitted: 0 },
    weekly: { bookings: 0, sponsorshipSubmitted: 0, sponsorshipApproved: 0, fngSubmitted: 0 },
    monthly: { bookings: 0, sponsorshipSubmitted: 0, sponsorshipApproved: 0, fngSubmitted: 0 }
  });
  const [tracker, setTracker] = useState({
    dateKey: todayDateKey(),
    calls: 0,
    bookings: 0,
    sponsorshipApps: 0,
    fngSubmittedApps: 0,
    checklist: {
      workNewLeads: false,
      followUpWarmLeads: false,
      bookOneConversation: false,
      postContent: false,
      updateTracker: false
    }
  });
  const [incomePlanner, setIncomePlanner] = useState({
    monthlyGoal: '5000'
  });
  const [savingTracker, setSavingTracker] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const [uplineUnreadCount, setUplineUnreadCount] = useState(0);
  const [licensedStates, setLicensedStates] = useState([]);
  const [licensedStatesBusy, setLicensedStatesBusy] = useState(false);
  const [licensedStatesMsg, setLicensedStatesMsg] = useState('');

  const gate = useMemo(() => onboardingState(member || {}), [member]);
  const unlocked = gate.active;
  const tabs = useMemo(() => availableTabs(member || {}), [member]);

  useEffect(() => {
    const name = clean(member?.applicantName || member?.name || '');
    const email = clean(member?.email || '').toLowerCase();
    if (!name && !email) {
      setUplineUnreadCount(0);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const qs = new URLSearchParams({ mode: 'inbox', name, email, profileType: 'licensed' });
        const res = await fetch(`/api/upline-support?${qs.toString()}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (!res.ok || !data?.ok) {
          setUplineUnreadCount(0);
          return;
        }
        setUplineUnreadCount(Number(data?.unreadTotal || 0));
      } catch {
        if (mounted) setUplineUnreadCount(0);
      }
    })();

    return () => { mounted = false; };
  }, [member?.applicantName, member?.name, member?.email]);

  const leadMarketplaceHref = useMemo(() => {
    const params = new URLSearchParams();
    const displayName = clean(member?.applicantName || member?.name || '');
    const email = clean(member?.email || '');
    const npn = clean(member?.npnId || member?.npn || member?.agentNpn || '').replace(/\D/g, '');
    const statesRaw = Array.isArray(member?.licensedStates)
      ? member.licensedStates
      : String(member?.licensedStates || member?.licensedState || member?.state || '').split(',');
    const states = statesRaw.map((s) => clean(s)).filter(Boolean);

    if (displayName) params.set('name', displayName);
    if (email) params.set('email', email);
    if (npn) params.set('npn', npn);
    if (states.length) params.set('states', states.join(','));
    params.set('role', 'agent');

    return `/linkleads/order-builder${params.toString() ? `?${params.toString()}` : ''}`;
  }, [member]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const name = clean(member?.applicantName || member?.name || '');
    const email = clean(member?.email || '');
    if (!name && !email) return;
    try {
      window.sessionStorage.setItem(
        LINK_LEADS_SESSION_KEY,
        JSON.stringify({
          name: name || email,
          email,
          role: 'agent'
        })
      );
    } catch {}
  }, [member?.applicantName, member?.name, member?.email]);

  const filteredScripts = useMemo(() => {
    if (scriptFilter === 'all') return scripts;
    return (scripts || []).filter((s) => clean(s?.category).toLowerCase() === scriptFilter);
  }, [scripts, scriptFilter]);

  const filteredStartIntakeRows = useMemo(() => {
    const q = clean(startIntakeSearch).toLowerCase();
    let rows = Array.isArray(startIntakeRows) ? [...startIntakeRows] : [];
    if (startIntakeFilter === 'pending') rows = rows.filter((r) => clean(r?.contractStatus).toLowerCase() !== 'signed');
    if (startIntakeFilter === 'signed') rows = rows.filter((r) => clean(r?.contractStatus).toLowerCase() === 'signed');
    if (q) {
      rows = rows.filter((r) => {
        const n = clean(`${r?.firstName || ''} ${r?.lastName || ''}`).toLowerCase();
        const e = clean(r?.email || '').toLowerCase();
        const p = clean(r?.phone || '').toLowerCase();
        return n.includes(q) || e.includes(q) || p.includes(q);
      });
    }
    return rows;
  }, [startIntakeRows, startIntakeFilter, startIntakeSearch]);

  const filteredMediaItems = useMemo(() => {
    const all = Array.isArray(mediaItems) ? mediaItems : [];
    if (mediaFilter === 'all') return all;
    return all.filter((i) => clean(i?.type).toLowerCase() === mediaFilter);
  }, [mediaItems, mediaFilter]);

  const featuredMediaItems = useMemo(() => {
    return (Array.isArray(mediaItems) ? mediaItems : []).filter((i) => Boolean(i?.featured));
  }, [mediaItems]);

  const checklistDoneCount = useMemo(() => {
    const c = tracker?.checklist || {};
    return [c.workNewLeads, c.followUpWarmLeads, c.bookOneConversation, c.postContent, c.updateTracker].filter(Boolean).length;
  }, [tracker?.checklist]);

  const vipTier = useMemo(() => {
    const closes = toNum(kpi?.closesThisMonth);
    const bookings = toNum(kpi?.bookingsThisMonth);
    if (closes >= 5) return 'Chairman Elite';
    if (closes >= 2 || bookings >= 8) return 'Momentum Pro';
    return 'Founding Member';
  }, [kpi?.closesThisMonth, kpi?.bookingsThisMonth]);

  const monthlyTopPerformers = useMemo(() => {
    const rows = Array.isArray(leaderboard?.rows) ? leaderboard.rows : [];
    const scoredRaw = rows
      .filter((r) => Boolean(r?.inInnerCircle) && clean(r?.applicantName))
      .map((r) => {
        const leads = toNum(r?.kpi?.leadsReceived);
        const bookings = toNum(r?.kpi?.bookingsThisMonth);
        const submitted = Math.max(
          toNum(r?.trackerTotals?.sponsorshipApps),
          toNum(r?.kpi?.sponsorshipSubmittedThisMonth)
        );
        const approved = toNum(r?.kpi?.sponsorshipApprovedThisMonth);
        const fng = Math.max(
          toNum(r?.trackerTotals?.fngSubmittedApps),
          toNum(r?.kpi?.policySubmittedThisMonth)
        );
        const completed = toNum(r?.kpi?.closesThisMonth);
        return {
          name: clean(r?.applicantName),
          leads,
          bookings,
          submitted,
          approved,
          fng,
          completed
        };
      })
      .filter((r) => (r.leads + r.bookings + r.submitted + r.approved + r.fng + r.completed) > 0);

    const deduped = new Map();
    for (const row of scoredRaw) {
      const key = clean(row?.name).toLowerCase();
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, { ...row });
        continue;
      }
      deduped.set(key, {
        ...existing,
        leads: Math.max(existing.leads, row.leads),
        bookings: Math.max(existing.bookings, row.bookings),
        submitted: Math.max(existing.submitted, row.submitted),
        approved: Math.max(existing.approved, row.approved),
        fng: Math.max(existing.fng, row.fng),
        completed: Math.max(existing.completed, row.completed)
      });
    }

    const scored = Array.from(deduped.values())
      .map((r) => {
        const points = (r.submitted * 1) + (r.bookings * 3) + (r.fng * 10) + (r.completed * 500);
        return {
          ...r,
          points,
          dollars: points
        };
      })
      .sort((a, b) => b.points - a.points || b.completed - a.completed || b.fng - a.fng || b.bookings - a.bookings || a.name.localeCompare(b.name));

    return scored.slice(0, 5);
  }, [leaderboard]);

  const topThreePerformers = monthlyTopPerformers.slice(0, 3);

  const filteredActivityRows = useMemo(() => {
    if (activityType === 'all') return activityRows;
    if (activityType === 'decision') return (activityRows || []).filter((r) => clean(r?.type) === 'decision');
    return (activityRows || []).filter((r) => clean(r?.type) === activityType);
  }, [activityRows, activityType]);

  const personalProduction = useMemo(() => {
    const ownerNames = [
      clean(member?.applicantName || ''),
      clean(member?.name || '')
    ].filter(Boolean);
    const ownerEmail = clean(member?.email || '').toLowerCase();
    const ownerNorm = new Set(ownerNames.map(normName).filter(Boolean));
    const ownerSig = new Set(ownerNames.map(nameSig).filter(Boolean));

    const matchesOwnerByEmailOrName = (emails = [], names = []) => {
      const emailList = emails.map((v) => clean(v).toLowerCase()).filter(Boolean);
      const nameList = names.map(clean).filter(Boolean);
      if (ownerEmail && emailList.some((e) => e === ownerEmail)) return true;
      for (const c of nameList) {
        const n = normName(c);
        const sig = nameSig(c);
        if ((n && ownerNorm.has(n)) || (sig && ownerSig.has(sig))) return true;
      }
      return false;
    };

    const minePolicies = (policyRows || []).map((r) => {
      const ownerIsSubmitter = matchesOwnerByEmailOrName(
        [r?.policyWriterEmail, r?.submittedByEmail, r?.agentEmail, r?.ownerEmail, r?.email],
        [r?.policyWriterName, r?.assignedInnerCircleAgent, r?.submittedBy, r?.owner, r?.agent, r?.agentName]
      );
      const ownerIsReferrer = matchesOwnerByEmailOrName(
        [r?.referredByEmail],
        [r?.referredByName, r?.referredBy, r?.referrer]
      );
      if (!ownerIsSubmitter && !ownerIsReferrer) return null;
      return {
        ...r,
        __ownerIsSubmitter: ownerIsSubmitter,
        __ownerIsReferrer: ownerIsReferrer
      };
    }).filter(Boolean);

    const existingApprovedSponsorshipKeys = new Set(
      minePolicies
        .filter((r) => clean(r?.status || '').toLowerCase().includes('approved'))
        .filter((r) => clean(r?.policyType || r?.appType || '').toLowerCase().includes('sponsorship'))
        .map((r) => nameSig(r?.applicantName || r?.name || ''))
        .filter(Boolean)
    );

    const syntheticSponsorshipApprovals = (activityRows || [])
      .filter((r) => clean(r?.type || '').toLowerCase() === 'decision')
      .filter((r) => clean(r?.decision || '').toLowerCase() === 'approved' || clean(r?.detail || '').toLowerCase().includes('approved'))
      .map((r, idx) => {
        const personName = clean(r?.name || 'Applicant');
        const key = nameSig(personName);
        if (!key || existingApprovedSponsorshipKeys.has(key)) return null;
        return {
          id: `syn_sp_${key}_${idx}`,
          applicantName: personName,
          policyType: 'Sponsorship Policy',
          appType: 'Sponsorship Policy',
          status: 'Approved',
          pointsEarned: 1,
          advancePayout: 1,
          payoutAmount: 1,
          commissionRate: 0,
          remainingBalance: 0,
          month10Payout: 0,
          month11Payout: 0,
          month12Payout: 0,
          approvedAt: clean(r?.at || ''),
          submittedAt: clean(r?.at || ''),
          source: 'sponsorship_approval',
          __ownerIsSubmitter: false,
          __ownerIsReferrer: true
        };
      })
      .filter(Boolean);

    const mine = [...minePolicies, ...syntheticSponsorshipApprovals].map((row) => {
      const approved = isApprovedStatus(row?.status || '');
      const fgNlg = isFgNlgRow(row);
      const submitterCredit = Boolean(row?.__ownerIsSubmitter);

      let effectivePoints = Number(computeEffectivePoints(row) || 0);
      if (fgNlg && !approved) {
        // Submission credit belongs to whoever submitted the policy app.
        effectivePoints = submitterCredit ? 50 : 0;
      }

      const effectiveAdvance = Number(computeEffectiveAdvance(row, effectivePoints) || 0);
      return {
        ...row,
        __effectivePoints: effectivePoints,
        __effectiveAdvance: effectiveAdvance
      };
    });

    const byType = {
      sponsorship: 0,
      bonus: 0,
      innerCircle: 0,
      regular: 0,
      juvenile: 0
    };

    let totalPoints = 0;
    let advanceTotal = 0;

    for (const row of mine) {
      const t = clean(row?.policyType || row?.appType || '').toLowerCase();
      if (t.includes('sponsorship')) byType.sponsorship += 1;
      else if (t.includes('bonus')) byType.bonus += 1;
      else if (t.includes('inner circle')) byType.innerCircle += 1;
      else if (t.includes('regular')) byType.regular += 1;
      else if (t.includes('juvenile')) byType.juvenile += 1;
      totalPoints += Number((row?.__effectivePoints ?? computeEffectivePoints(row)) || 0);
      advanceTotal += Number((row?.__effectiveAdvance ?? computeEffectiveAdvance(row, Number((row?.__effectivePoints ?? computeEffectivePoints(row)) || 0))) || 0);
    }

    const sorted = [...mine].sort((a, b) => rowTs(b) - rowTs(a));

    return {
      rows: sorted,
      byType,
      totalPoints,
      advanceTotal
    };
  }, [policyRows, activityRows, member?.applicantName, member?.name, member?.email]);

  const productionWindowRows = useMemo(() => {
    const rows = personalProduction.rows || [];
    return rows.filter((row) => inWindow(rowTs(row), productionWindow));
  }, [personalProduction.rows, productionWindow]);

  const productionByType = useMemo(() => {
    const byType = { sponsorship: 0, bonus: 0, innerCircle: 0, regular: 0, juvenile: 0 };
    for (const row of (productionWindowRows || [])) {
      const t = clean(row?.policyType || row?.appType || '').toLowerCase();
      if (t.includes('sponsorship')) byType.sponsorship += 1;
      else if (t.includes('bonus')) byType.bonus += 1;
      else if (t.includes('inner circle')) byType.innerCircle += 1;
      else if (t.includes('regular')) byType.regular += 1;
      else if (t.includes('juvenile')) byType.juvenile += 1;
    }
    return byType;
  }, [productionWindowRows]);

  const filteredProductionRows = useMemo(() => {
    if (productionFilter === 'all') return productionWindowRows;
    return (productionWindowRows || []).filter((row) => {
      const t = clean(row?.policyType || row?.appType || '').toLowerCase();
      return t.includes(productionFilter);
    });
  }, [productionWindowRows, productionFilter]);

  const skippedAppDecisions = useMemo(() => {
    const nameNorm = clean(member?.applicantName || member?.name || '').toLowerCase();
    const emailNorm = clean(member?.email || '').toLowerCase();
    const rows = Array.isArray(onboardingDecisionRows) ? onboardingDecisionRows : [];
    return rows.filter((r) => {
      const decision = clean(r?.decision || '').toLowerCase();
      if (!decision.includes('skip')) return false;
      const ref = clean(r?.referredByName || '').toLowerCase();
      const writer = clean(r?.policyWriterName || '').toLowerCase();
      const em = clean(r?.applicantEmail || '').toLowerCase();
      if (emailNorm && em === emailNorm) return true;
      return Boolean(nameNorm && (ref === nameNorm || writer === nameNorm));
    });
  }, [onboardingDecisionRows, member?.applicantName, member?.name, member?.email]);

  const teamIdentityMeta = useMemo(() => {
    const rows = Array.isArray(teamHierarchyRows) ? teamHierarchyRows : [];
    const map = new Map();
    if (!rows.length) return map;

    const licensedEmailSet = new Set();
    const licensedNameSigSet = new Set();

    for (const a of (Array.isArray(licensedAgents) ? licensedAgents : [])) {
      const status = clean(a?.license_status || 'active').toLowerCase();
      if (status && !(status.includes('active') || status.includes('licensed'))) continue;
      const em = clean(a?.email || '').toLowerCase();
      const nm = licensedDisplayName(a);
      if (em) licensedEmailSet.add(em);
      if (nm) licensedNameSigSet.add(nameSig(nm));
    }

    const innerCircleEmailSet = new Set();
    const innerCircleNameSigSet = new Set();
    for (const m of (Array.isArray(hubMembers) ? hubMembers : [])) {
      if (m?.active === false) continue;
      const n = clean(m?.applicantName || m?.name || '');
      const e = clean(m?.email || '').toLowerCase();
      if (e) innerCircleEmailSet.add(e);
      if (n) innerCircleNameSigSet.add(nameSig(n));
    }

    for (const r of rows) {
      const childKey = clean(r?.childKey || '');
      const childName = clean(r?.childName || '');
      const childEmail = clean(r?.childEmail || '').toLowerCase();
      const childNorm = normName(childName);

      const matchedMember = (Array.isArray(hubMembers) ? hubMembers : []).find((m) => {
        const em = clean(m?.email || '').toLowerCase();
        const nm = clean(m?.applicantName || m?.name || '');
        return (childEmail && em && childEmail === em) || (childNorm && nameSig(nm) === nameSig(childName));
      }) || null;
      const childPhone = clean(matchedMember?.phone || '');

      const licenseEvidence = (policyRows || [])
        .filter((p) => {
          const applicantName = normName(p?.applicantName || '');
          const applicantEmail = clean(p?.applicantEmail || '').toLowerCase();
          return (childEmail && applicantEmail && childEmail === applicantEmail) || (childNorm && applicantName === childNorm);
        })
        .sort((a, b) => rowTs(b) - rowTs(a));

      const latestLicenseRaw = clean(licenseEvidence[0]?.applicantLicensedStatus || licenseEvidence[0]?.agentLicensedStatus || '');
      const fromPolicy = normalizeLicenseFlag(latestLicenseRaw);
      const fromRoster = (childEmail && licensedEmailSet.has(childEmail)) || licensedNameSigSet.has(nameSig(childName));
      const fromLicensedOverride = LICENSED_NAME_OVERRIDES.has(normName(childName));

      const licenseTag = (fromRoster || fromLicensedOverride) ? 'licensed' : fromPolicy;
      const isInnerCircle = (childEmail && innerCircleEmailSet.has(childEmail)) || innerCircleNameSigSet.has(nameSig(childName)) || INNER_CIRCLE_NAME_OVERRIDES.has(normName(childName));

      map.set(childKey || `${childName}|${childEmail}`, { licenseTag, isInnerCircle, childPhone });
    }

    return map;
  }, [teamHierarchyRows, hubMembers, policyRows]);

  const teamCards = useMemo(() => {
    const makeKey = (name = '', email = '') => {
      const em = clean(email).toLowerCase();
      if (em) return `em:${em}`;
      const nm = normName(name).replace(/\s+/g, '_');
      return nm ? `nm:${nm}` : '';
    };

    const viewerKey = makeKey(member?.applicantName || member?.name || '', member?.email || '');
    const rows = Array.isArray(teamHierarchyRows) ? teamHierarchyRows : [];
    if (!viewerKey || !rows.length) return [];

    const byParent = new Map();
    for (const r of rows) {
      const p = clean(r?.parentKey);
      if (!p) continue;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p).push(r);
    }

    const direct = byParent.get(viewerKey) || [];
    const now = Date.now();
    const inDays = (ts = 0, d = 30) => ts > 0 && (now - ts) <= d * 24 * 60 * 60 * 1000;

    const countDescendants = (childKey = '') => {
      if (!childKey) return 0;
      const stack = [...(byParent.get(childKey) || [])];
      let n = 0;
      while (stack.length) {
        const cur = stack.pop();
        n += 1;
        const kids = byParent.get(clean(cur?.childKey)) || [];
        if (kids.length) stack.push(...kids);
      }
      return n;
    };

    const cards = direct.map((r) => {
      const childName = clean(r?.childName || 'Member');
      const childEmail = clean(r?.childEmail || '').toLowerCase();
      const childNorm = normName(childName);
      const activity = (policyRows || [])
        .filter((p) => {
          const candidates = [p?.submittedBy, p?.policyWriterName, p?.assignedInnerCircleAgent].map(normName).filter(Boolean);
          return candidates.includes(childNorm);
        })
        .sort((a, b) => rowTs(b) - rowTs(a));

      const meta = teamIdentityMeta.get(clean(r?.childKey || '')) || teamIdentityMeta.get(`${childName}|${childEmail}`) || {};
      const licenseTag = clean(meta?.licenseTag || '');
      const isInnerCircle = Boolean(meta?.isInnerCircle);

      const submitted30 = activity.filter((a) => inDays(rowTs(a), 30)).length;
      const submitted7 = activity.filter((a) => inDays(rowTs(a), 7)).length;
      const latest = activity[0] || null;
      const latestType = latest ? normalizePolicyTypeLabel(latest?.policyType || latest?.appType || 'App') : 'No app yet';
      const descendants = countDescendants(clean(r?.childKey));

      const score = Math.min(100,
        (submitted30 * 15)
        + (submitted7 > 0 ? 20 : 0)
        + Math.min(20, descendants * 5)
      );

      const momentumLabel = score >= 70 ? 'Lean In' : score >= 35 ? 'Build' : 'Reconnect';

      return {
        ...r,
        childName,
        submitted30,
        submitted7,
        latestType,
        latestAt: latest ? (latest?.submittedAt || latest?.updatedAt || latest?.createdAt || '') : '',
        descendants,
        childPhone: formatUsPhone(meta?.childPhone || ''),
        score,
        momentumLabel,
        licenseTag,
        isInnerCircle
      };
    });

    return cards.sort((a, b) => b.score - a.score || b.submitted30 - a.submitted30 || a.childName.localeCompare(b.childName));
  }, [teamHierarchyRows, policyRows, teamIdentityMeta, member?.applicantName, member?.name, member?.email]);

  const loungeTeamSnapshotRows = useMemo(() => {
    const norm = (v = '') => clean(v).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const ts = (v = '') => {
      const t = Date.parse(v || '');
      return Number.isNaN(t) ? 0 : t;
    };

    return (teamCards || []).map((card) => {
      const name = clean(card?.childName || '');
      const email = clean(card?.childEmail || '').toLowerCase();
      const nameNorm = norm(name);

      const apps = (sponsorshipRows || [])
        .filter((r) => {
          const re = clean(r?.email || '').toLowerCase();
          const rn = norm(`${r?.firstName || ''} ${r?.lastName || ''}`);
          return (email && re && email === re) || (nameNorm && rn === nameNorm);
        })
        .sort((a, b) => ts(b?.submitted_at || b?.updatedAt) - ts(a?.submitted_at || a?.updatedAt));

      const latestApp = apps[0] || null;
      const sponsorshipCompletedAt = clean(latestApp?.submitted_at || '');
      const approvalAt = clean(latestApp?.approved_at || '');
      const state = clean(latestApp?.state || '');

      const claims = (leadClaimRows || [])
        .filter((r) => {
          const re = clean(r?.applicant_email || '').toLowerCase();
          const rn = norm(r?.applicant_name || `${r?.applicant_first_name || ''} ${r?.applicant_last_name || ''}`);
          return (email && re && email === re) || (nameNorm && rn === nameNorm);
        })
        .sort((a, b) => ts(b?.updated_at || b?.created_at) - ts(a?.updated_at || a?.created_at));

      const latestClaim = claims[0] || null;
      const scheduledAt = clean(latestClaim?.requested_at_est || '');
      const hasMeetingScheduled = Boolean(scheduledAt);

      return {
        ...card,
        sponsorshipCompletedAt,
        approvalAt,
        state: state || clean(latestClaim?.applicant_state || ''),
        hasMeetingScheduled,
        scheduledAt,
      };
    });
  }, [teamCards, sponsorshipRows, leadClaimRows]);

  const teamAdminData = useMemo(() => {
    const makeKey = (name = '', email = '') => {
      const em = clean(email).toLowerCase();
      if (em) return `em:${em}`;
      const nm = normName(name).replace(/\s+/g, '_');
      return nm ? `nm:${nm}` : '';
    };

    const rows = Array.isArray(teamHierarchyRows) ? teamHierarchyRows : [];
    const childKeys = new Set(rows.map((r) => clean(r?.childKey)).filter(Boolean));

    const parentMap = new Map();
    const viewerName = clean(member?.applicantName || member?.name || '');
    const viewerEmail = clean(member?.email || '').toLowerCase();
    const viewerKey = makeKey(viewerName, viewerEmail);
    if (viewerKey) parentMap.set(viewerKey, { key: viewerKey, name: viewerName || 'You', email: viewerEmail });

    for (const r of rows) {
      const key = clean(r?.parentKey);
      if (!key) continue;
      if (!parentMap.has(key)) {
        parentMap.set(key, { key, name: clean(r?.parentName || 'Agent'), email: clean(r?.parentEmail || '') });
      }
    }

    for (const m of (Array.isArray(hubMembers) ? hubMembers : [])) {
      const name = clean(m?.applicantName || m?.name || '');
      const email = clean(m?.email || '').toLowerCase();
      const key = makeKey(name, email);
      if (!key) continue;
      if (!parentMap.has(key)) parentMap.set(key, { key, name: name || email || 'Member', email });
    }

    const options = Array.from(parentMap.values())
      .sort((a, b) => clean(a?.name || a?.email).localeCompare(clean(b?.name || b?.email)) || clean(a?.email).localeCompare(clean(b?.email)));

    const candidatesMap = new Map();
    for (const m of (Array.isArray(hubMembers) ? hubMembers : [])) {
      const name = clean(m?.applicantName || '');
      const email = clean(m?.email || '').toLowerCase();
      const key = makeKey(name, email);
      if (!key || key === viewerKey || childKeys.has(key)) continue;
      candidatesMap.set(key, { key, name: name || email || 'Member', email });
    }

    return { options, candidates: Array.from(candidatesMap.values()) };
  }, [teamHierarchyRows, hubMembers, member?.applicantName, member?.name, member?.email]);

  const filteredParentOptions = useMemo(() => {
    const q = clean(teamParentSearch).toLowerCase();
    const all = teamAdminData?.options || [];
    if (!q) return all;
    return all.filter((o) => {
      const n = clean(o?.name).toLowerCase();
      const e = clean(o?.email).toLowerCase();
      return n.includes(q) || e.includes(q);
    });
  }, [teamAdminData, teamParentSearch]);

  const filteredMoveParentOptions = useMemo(() => {
    const q = clean(moveParentSearch).toLowerCase();
    const all = teamAdminData?.options || [];
    if (!q) return all;
    return all.filter((o) => {
      const n = clean(o?.name).toLowerCase();
      const e = clean(o?.email).toLowerCase();
      return n.includes(q) || e.includes(q);
    });
  }, [teamAdminData, moveParentSearch]);

  const teamManageRows = useMemo(() => {
    const options = teamAdminData?.options || [];
    const byParent = new Map(options.map((o) => [clean(o?.key), clean(o?.name || 'Agent')]));
    return (Array.isArray(teamHierarchyRows) ? teamHierarchyRows : [])
      .map((r) => ({
        ...r,
        parentLabel: clean(r?.parentName || byParent.get(clean(r?.parentKey)) || 'Unassigned')
      }))
      .sort((a, b) => clean(a?.childName).localeCompare(clean(b?.childName)));
  }, [teamHierarchyRows, teamAdminData]);

  const filteredTeamManageRows = useMemo(() => {
    const q = clean(moveSearch).toLowerCase();
    if (!q) return teamManageRows;
    return (teamManageRows || []).filter((r) => {
      const child = clean(r?.childName).toLowerCase();
      const email = clean(r?.childEmail).toLowerCase();
      const parent = clean(r?.parentLabel).toLowerCase();
      return child.includes(q) || email.includes(q) || parent.includes(q);
    });
  }, [teamManageRows, moveSearch]);

  const recentReassignments = useMemo(() => {
    return (teamManageRows || [])
      .filter((r) => {
        const s = clean(r?.source).toLowerCase();
        return s === 'admin_reassign' || s === 'admin_reassign_bulk' || s === 'admin_reassign_undo';
      })
      .sort((a, b) => rowTs(b) - rowTs(a))
      .slice(0, 10);
  }, [teamManageRows]);

  const productionStats = useMemo(() => {
    const rows = filteredProductionRows || [];
    const approved = rows.filter((r) => clean(r?.status).toLowerCase().includes('approved')).length;
    const approvalRate = rows.length ? Math.round((approved / rows.length) * 100) : 0;

    const totals = rows.reduce((acc, row) => {
      const points = Number((row?.__effectivePoints ?? computeEffectivePoints(row)) || 0);
      const advance = Number((row?.__effectiveAdvance ?? computeEffectiveAdvance(row, points)) || 0);
      return {
        points: acc.points + points,
        advance: acc.advance + advance,
        remaining: acc.remaining + (Number(row?.remainingBalance || 0) || Math.max(0, Number(points || 0) - Number(advance || 0)) )
      };
    }, { points: 0, advance: 0, remaining: 0 });

    return { ...totals, count: rows.length, approved, approvalRate };
  }, [filteredProductionRows]);

  const productionFinancials = useMemo(() => {
    const rows = personalProduction.rows || [];
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthKey = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const events = rows.map((r, i) => {
      const t = clean(r?.policyType || r?.appType || '').toLowerCase();
      const sourceType = t.includes('sponsorship') ? 'sponsorship' : (t.includes('inner circle') ? 'inner_circle' : 'other');
      const approvedAt = clean(r?.approvedAt || r?.updatedAt || r?.submittedAt || r?.createdAt || '');
      const submittedAt = clean(r?.submittedAt || r?.createdAt || r?.updatedAt || approvedAt || '');
      const paidAt = clean(r?.payoutPaidAt || '');
      const payoutStatus = clean(r?.payoutStatus || '').toLowerCase();
      const paid = payoutStatus === 'paid' || Boolean(paidAt);
      const approved = isApprovedStatus(r?.status || '');
      const deliveryRequired = Boolean(r?.deliveryRequirementNeeded) || clean(r?.deliveryRequirementStatus || '').toLowerCase() === 'required';
      const deliveryCompleted = clean(r?.deliveryRequirementStatus || '').toLowerCase() === 'completed';
      const fgNlg = isFgNlgRow(r);
      const points = Number((r?.__effectivePoints ?? computeEffectivePoints(r)) || 0);
      const amount = Number((r?.__effectiveAdvance ?? computeEffectiveAdvance(r, points)) || 0);
      const expectedPayoutAt = clean(r?.payoutDueAt || (approved && fgNlg ? followingWeekFridayIso(approvedAt || submittedAt) : (approvedAt ? new Date(new Date(approvedAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : '')));
      const pendingStage = paid
        ? 'paid'
        : ((deliveryRequired && !deliveryCompleted) ? 'delivery_requirement' : 'pending');

      return {
        id: clean(r?.id || `prod_${i}`),
        applicant: clean(r?.applicantName || 'Applicant'),
        policyType: clean(r?.policyType || r?.appType || ''),
        sourceType,
        status: paid ? 'paid' : 'pending',
        pendingStage,
        amount,
        points,
        approved,
        fgNlg,
        submittedAt,
        qualifiedAt: approvedAt,
        paidAt,
        expectedPayoutAt,
        deliveryRequirementNeeded: deliveryRequired,
        deliveryRequirementStatus: clean(r?.deliveryRequirementStatus || (deliveryRequired ? 'required' : 'none')),
        deliveryRequirementNote: clean(r?.deliveryRequirementNote || '')
      };
    });

    const allTimePaid = events.filter((e) => e.status === 'paid').reduce((a, e) => a + e.amount, 0);
    const allTimePending = events.filter((e) => e.status === 'pending').reduce((a, e) => a + e.amount, 0);

    const isThisMonth = (iso = '') => {
      const d = new Date(iso || 0);
      if (Number.isNaN(d.getTime())) return false;
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };

    const thisMonthPaid = events.filter((e) => e.status === 'paid' && isThisMonth(e.paidAt || e.qualifiedAt)).reduce((a, e) => a + e.amount, 0);
    const thisMonthPendingEntries = events.filter((e) => e.status === 'pending' && isThisMonth(e.qualifiedAt || e.submittedAt));
    const thisMonthPending = thisMonthPendingEntries.reduce((a, e) => a + e.amount, 0);

    const byMonth = new Map();
    for (const e of events) {
      const d = new Date((e.status === 'paid' ? (e.paidAt || e.qualifiedAt) : (e.qualifiedAt || e.submittedAt)) || 0);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) || 0) + Number(e.amount || 0));
    }
    const trend = [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-6)
      .map(([key, amount]) => ({ key, label: monthShortFromKey(key), amount: Number(amount || 0) }));

    const sourceTotals = {
      sponsorship: events.filter((e) => e.sourceType === 'sponsorship').reduce((a, e) => a + e.amount, 0),
      inner_circle: events.filter((e) => e.sourceType === 'inner_circle').reduce((a, e) => a + e.amount, 0),
      other: events.filter((e) => e.sourceType === 'other').reduce((a, e) => a + e.amount, 0)
    };
    const sourceSum = sourceTotals.sponsorship + sourceTotals.inner_circle + sourceTotals.other;

    const upcoming = events
      .filter((e) => e.status === 'pending')
      .sort((a, b) => new Date(a.expectedPayoutAt || a.qualifiedAt || a.submittedAt || 0).getTime() - new Date(b.expectedPayoutAt || b.qualifiedAt || b.submittedAt || 0).getTime())
      .slice(0, 8);

    const monthTotal = thisMonthPaid + thisMonthPending;
    const paidRatio = monthTotal > 0 ? Math.round((thisMonthPaid / monthTotal) * 100) : 0;
    const nextPayout = upcoming[0] || null;

    // Incentive payout (1st-5th): prior month sponsorship approvals ($1) + F&G/NLG submissions ($50)
    const incentiveRowsPrevMonth = rows.filter((r) => {
      const type = normalizePolicyTypeLabel(r?.policyType || r?.appType || '').toLowerCase();
      const approved = isApprovedStatus(r?.status || '');
      if (type.includes('sponsorship') && approved) {
        const k = monthKeyFromIso(clean(r?.approvedAt || r?.updatedAt || r?.submittedAt || r?.createdAt || ''));
        return k === previousMonthKey;
      }
      if (isFgNlgRow(r)) {
        const k = monthKeyFromIso(clean(r?.submittedAt || r?.createdAt || r?.updatedAt || ''));
        return k === previousMonthKey && Boolean(r?.__ownerIsSubmitter);
      }
      return false;
    });
    const prevMonthSponsorshipApprovalsCount = incentiveRowsPrevMonth.filter((r) => normalizePolicyTypeLabel(r?.policyType || r?.appType || '').toLowerCase().includes('sponsorship')).length;
    const prevMonthFngSubmittedCount = incentiveRowsPrevMonth.filter((r) => !normalizePolicyTypeLabel(r?.policyType || r?.appType || '').toLowerCase().includes('sponsorship')).length;
    const monthlyIncentiveAmount = (prevMonthSponsorshipApprovalsCount * 1) + (prevMonthFngSubmittedCount * 50);
    const monthlyIncentivePayoutWindow = `${now.toLocaleDateString('en-US', { month: 'short' })} 1-${now.toLocaleDateString('en-US', { month: 'short' })} 5`;

    // Weekly approval payout: F&G/NLG approvals paid following Friday
    const approvalPending = events
      .filter((e) => e.fgNlg && e.approved && e.status !== 'paid')
      .sort((a, b) => new Date(a.expectedPayoutAt || 0).getTime() - new Date(b.expectedPayoutAt || 0).getTime());

    const nextApprovalPayoutDate = approvalPending[0]?.expectedPayoutAt || '';
    const nextApprovalPayoutAmount = nextApprovalPayoutDate
      ? approvalPending.filter((e) => (monthKeyFromIso(e.expectedPayoutAt) === monthKeyFromIso(nextApprovalPayoutDate)) && (new Date(e.expectedPayoutAt).toDateString() === new Date(nextApprovalPayoutDate).toDateString())).reduce((a, e) => a + Number(e.amount || 0), 0)
      : 0;

    const pointsByMonth = new Map();
    for (const e of events) {
      const key = monthKeyFromIso(e.qualifiedAt || e.submittedAt || e.paidAt || '');
      if (!key) continue;
      pointsByMonth.set(key, (pointsByMonth.get(key) || 0) + Number(e.points || 0));
    }
    const fullPointsHistory = [...pointsByMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, points]) => ({ key, label: monthShortFromKey(key), points: Number(points || 0) }));

    const pointsHistory = fullPointsHistory.slice(0, 6);

    const thisMonthPoints = Number(pointsByMonth.get(currentMonthKey) || 0);
    const lastMonthPoints = Number(pointsByMonth.get(previousMonthKey) || 0);
    const lifetimePoints = events.reduce((a, e) => a + Number(e.points || 0), 0);

    return {
      allTimePaid,
      allTimePending,
      thisMonthPaid,
      thisMonthPending,
      thisMonthPendingEntries,
      trend,
      sourceTotals,
      sourceSum,
      upcoming,
      monthTotal,
      paidRatio,
      nextPayout,
      monthlyIncentiveAmount,
      monthlyIncentivePayoutWindow,
      prevMonthSponsorshipApprovalsCount,
      prevMonthFngSubmittedCount,
      previousMonthKey,
      currentMonthKey,
      nextApprovalPayoutDate,
      nextApprovalPayoutAmount,
      thisMonthPoints,
      lastMonthPoints,
      lifetimePoints,
      pointsHistory,
      fullPointsHistory
    };
  }, [personalProduction.rows]);



  const monthlyLicensedIncentive = useMemo(() => {
    return {
      submitted: Number(productionFinancials?.prevMonthSponsorshipApprovalsCount || 0) || 0,
      appSubmitted: Number(productionFinancials?.prevMonthFngSubmittedCount || 0) || 0,
      total: Number(productionFinancials?.monthlyIncentiveAmount || 0)
    };
  }, [productionFinancials]);

  const trackerUpcomingSummary = useMemo(() => {
    const upcoming = Array.isArray(productionFinancials?.upcoming) ? productionFinancials.upcoming : [];
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endToday = startToday + (24 * 60 * 60 * 1000) - 1;
    const endNext7 = startToday + (7 * 24 * 60 * 60 * 1000);

    let dueToday = 0;
    let dueNext7 = 0;
    let delayedByDelivery = 0;
    for (const e of upcoming) {
      if (e?.pendingStage === 'delivery_requirement') delayedByDelivery += 1;
      const dueTs = new Date(e?.expectedPayoutAt || e?.qualifiedAt || e?.submittedAt || 0).getTime();
      if (!Number.isFinite(dueTs)) continue;
      if (dueTs >= startToday && dueTs <= endToday) dueToday += 1;
      if (dueTs >= startToday && dueTs <= endNext7) dueNext7 += 1;
    }

    return { dueToday, dueNext7, delayedByDelivery };
  }, [productionFinancials]);

  const pendingBreakdown = useMemo(() => {
    const entries = Array.isArray(productionFinancials?.thisMonthPendingEntries) ? productionFinancials.thisMonthPendingEntries : [];

    const sponsorshipPoliciesCount = entries.filter((e) => e?.sourceType === 'sponsorship').length;
    const applicationsWrittenCount = entries.filter((e) => e?.sourceType !== 'sponsorship').length;

    const policyApprovals = entries
      .filter((e) => e?.sourceType !== 'sponsorship' && Boolean(e?.approved))
      .sort((a, b) => new Date(a?.expectedPayoutAt || a?.qualifiedAt || a?.submittedAt || 0).getTime() - new Date(b?.expectedPayoutAt || b?.qualifiedAt || b?.submittedAt || 0).getTime());

    return {
      sponsorshipPoliciesCount,
      applicationsWrittenCount,
      policyApprovals
    };
  }, [productionFinancials]);

  const incomePlannerStats = useMemo(() => {
    const MONTH_WEEKS = 4.333;
    const REFERRAL_PAYOUT = 500;

    const monthlyGoal = toNum(incomePlanner?.monthlyGoal || 0);
    const requiredMonthlyConversations = monthlyGoal > 0 ? Math.ceil(monthlyGoal / 150) : 0;
    const requiredWeeklyConversations = requiredMonthlyConversations > 0 ? Math.ceil(requiredMonthlyConversations / MONTH_WEEKS) : 0;

    const targetInterested = Math.ceil(requiredWeeklyConversations * 0.8);
    const targetMoveForward = Math.ceil(targetInterested * 0.75);
    const targetBooked = Math.ceil(targetMoveForward * 0.667);
    const targetShowed = Math.ceil(targetBooked * 0.75);
    const targetPaidReferrals = targetShowed;

    const targetWeeklyRevenue = targetPaidReferrals * REFERRAL_PAYOUT;
    const monthlyProjectedRevenue = Math.round(targetWeeklyRevenue * MONTH_WEEKS);
    const annualProjectedRevenue = monthlyProjectedRevenue * 12;

    const expectedPayoutStartIso = followingWeekFridayIso(new Date().toISOString());
    const expectedPayoutEndIso = followingWeekFridayIso(new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString());

    const coaching = [];
    if (requiredWeeklyConversations > 0) {
      coaching.push(`To hit ${monthlyGoal.toLocaleString()} monthly, target at least ${requiredWeeklyConversations} conversations per week.`);
      coaching.push(`Daily pace target: ${Math.ceil(requiredWeeklyConversations / 7)} conversation(s) per day minimum.`);
      coaching.push('Protect your show rate with same-day reminder + 2-hour confirmation touch.');
    } else {
      coaching.push('Set a monthly income goal to auto-build your weekly execution targets.');
    }

    return {
      monthlyGoal,
      requiredMonthlyConversations,
      requiredWeeklyConversations,
      target: {
        interested: targetInterested,
        moveForward: targetMoveForward,
        booked: targetBooked,
        showed: targetShowed,
        paidReferrals: targetPaidReferrals,
        weeklyRevenue: targetWeeklyRevenue
      },
      projections: {
        monthly: monthlyProjectedRevenue,
        annual: annualProjectedRevenue
      },
      payoutLag: {
        expectedEarned: targetWeeklyRevenue,
        windowStart: expectedPayoutStartIso,
        windowEnd: expectedPayoutEndIso
      },
      coaching
    };
  }, [incomePlanner]);

  const periodTotals = useMemo(() => {
    const key = trackerPeriod === 'weekly' ? 'weekly' : trackerPeriod === 'monthly' ? 'monthly' : 'daily';
    const s = activityStats?.[key] || {};

    const now = new Date();
    const today = todayDateKey();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const calls = (Array.isArray(dailyRows) ? dailyRows : []).reduce((acc, r) => {
      const dk = clean(r?.dateKey);
      if (!dk) return acc;
      const d = new Date(`${dk}T00:00:00`);
      if (Number.isNaN(d.getTime())) return acc;
      if (key === 'daily' && dk !== today) return acc;
      if (key === 'weekly' && d < weekStart) return acc;
      if (key === 'monthly' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return acc;
      return acc + toNum(r?.calls);
    }, 0);

    return {
      calls,
      bookings: toNum(s?.bookings),
      sponsorshipApps: toNum(s?.sponsorshipSubmitted),
      sponsorshipApproved: toNum(s?.sponsorshipApproved),
      fngSubmittedApps: toNum(s?.fngSubmitted),
      appsTotal: toNum(s?.sponsorshipSubmitted) + toNum(s?.fngSubmitted)
    };
  }, [activityStats, trackerPeriod, dailyRows]);

  const siteBase = useMemo(() => {
    const envBase = clean(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '');
    if (envBase) return envBase.replace(/\/$/, '');
    if (typeof window !== 'undefined' && window?.location?.origin) return window.location.origin.replace(/\/$/, '');
    return 'https://innercirclelink.com';
  }, []);

  function toAbsoluteLink(value = '') {
    const v = clean(value);
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    return `${siteBase}${v.startsWith('/') ? '' : '/'}${v}`;
  }

  const sponsorshipLink = useMemo(() => {
    const base = toAbsoluteLink(process.env.NEXT_PUBLIC_SPONSORSHIP_LINK_BASE || '/sponsorship-signup');
    const ref = encodeURIComponent(member?.email || member?.id || 'member');
    return base.includes('?') ? `${base}&ref=${ref}` : `${base}?ref=${ref}`;
  }, [member?.email, member?.id, siteBase, toAbsoluteLink]);

  const personalCoverageLink = useMemo(() => {
    const configured = clean(process.env.NEXT_PUBLIC_COVERAGE_LINK_BASE || 'https://coverage.thelegacylink.com/life-insurance');
    const base = toAbsoluteLink(configured).replace(/\/$/, '');
    const slug = slugify(member?.applicantName || member?.name || member?.email?.split('@')?.[0] || 'member') || 'member';
    return `${base}/${slug}`;
  }, [member?.applicantName, member?.name, member?.email, toAbsoluteLink]);

  const onboardingPlaybookUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_INNER_CIRCLE_PLAYBOOK_URL || '/docs/inner-circle/legacy-link-inner-circle-onboarding-playbook-v3.pdf';
  }, []);

  const onboardingLibraryLinks = useMemo(() => {
    return [
      {
        name: 'Inner Circle Playbook (VIP)',
        url: process.env.NEXT_PUBLIC_INNER_CIRCLE_PLAYBOOK_URL || '/docs/inner-circle/legacy-link-inner-circle-onboarding-playbook-v3.pdf'
      },
      {
        name: 'Licensed Agent Playbook',
        url: '/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf'
      },
      {
        name: 'Unlicensed Agent Playbook',
        url: '/docs/onboarding/legacy-link-unlicensed-onboarding-playbook.pdf'
      },
      {
        name: 'Sponsorship Application Call SOP',
        url: '/docs/onboarding/legacy-link-sponsorship-phone-application-sop-2026-03-16.pdf'
      }
    ].map((item) => ({ ...item, url: toAbsoluteLink(item.url) }));
  }, [toAbsoluteLink]);

  const contractLinks = useMemo(() => {
    const agentGatewayUrl = toAbsoluteLink(process.env.NEXT_PUBLIC_AGENT_GATEWAY_URL || '/start');
    return [
      {
        name: 'Contract Agreement Page',
        url: toAbsoluteLink('/contract-agreement')
      },
      {
        name: 'Agent Gateway (Licensed / Unlicensed)',
        url: agentGatewayUrl
      }
    ];
  }, [toAbsoluteLink]);

  const sponsorshipSubmissionsCount = Number(activitySummary?.submitted || 0) || 0;
  const isAdminUser = ['admin', 'manager'].includes(clean(member?.role || '').toLowerCase());
  const canManageHierarchy = clean(member?.email || '').toLowerCase() === 'kimora@thelegacylink.com';

  const vipPdfLinks = useMemo(() => {
    const pathwaysLocked = !isAdminUser && sponsorshipSubmissionsCount < 10;
    return [
      {
        name: 'Licensed Agent Onboarding PDF',
        url: toAbsoluteLink('/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf')
      },
      {
        name: 'Unlicensed Agent Onboarding PDF',
        url: toAbsoluteLink('/docs/onboarding/legacy-link-unlicensed-onboarding-playbook.pdf')
      },
      {
        name: 'Sponsorship Application Call SOP PDF',
        url: toAbsoluteLink('/docs/onboarding/legacy-link-sponsorship-phone-application-sop-2026-03-16.pdf')
      },
      {
        name: 'Legacy Link Pathways SOP PDF',
        url: toAbsoluteLink('/docs/onboarding/legacy_link_pathways_sop.pdf'),
        locked: pathwaysLocked,
        unlockAt: 10,
        current: sponsorshipSubmissionsCount,
        lockReason: 'Submit 10 sponsorship apps to unlock this training resource.'
      }
    ];
  }, [toAbsoluteLink, sponsorshipSubmissionsCount, isAdminUser]);

  useEffect(() => {
    if (!member?.email && !member?.applicantName) return;
    let canceled = false;

    async function loadAll() {
      try {
        const kpiUrl = `/api/inner-circle-hub-kpi?name=${encodeURIComponent(member?.applicantName || '')}&email=${encodeURIComponent(member?.email || '')}`;
        const dailyUrl = `/api/inner-circle-hub-daily?memberId=${encodeURIComponent(member?.id || '')}&email=${encodeURIComponent(member?.email || '')}`;

        const activityUrl = `/api/inner-circle-hub-activity?name=${encodeURIComponent(member?.applicantName || '')}&email=${encodeURIComponent(member?.email || '')}`;

        const onboardingUrl = `/api/onboarding-decisions?name=${encodeURIComponent(member?.applicantName || '')}&email=${encodeURIComponent(member?.email || '')}`;
        const teamUrl = `/api/team-hierarchy?viewerName=${encodeURIComponent(member?.applicantName || member?.name || '')}&viewerEmail=${encodeURIComponent(member?.email || '')}`;

        const leadClaimsUrl = `/api/lead-claims?viewer=${encodeURIComponent(member?.applicantName || member?.name || '')}`;
        const mediaUrl = `/api/inner-circle-media-vault?email=${encodeURIComponent(member?.email || '')}&name=${encodeURIComponent(member?.applicantName || member?.name || '')}`;

        const [kpiRes, dailyRes, scriptsRes, vaultRes, activityRes, progressRes, policiesRes, sponsorshipRes, leadClaimsRes, mediaRes, onboardingRes, teamRes, membersRes] = await Promise.all([
          fetch(kpiUrl, { cache: 'no-store' }),
          fetch(dailyUrl, { cache: 'no-store' }),
          fetch('/api/inner-circle-hub-scripts', { cache: 'no-store' }),
          fetch('/api/inner-circle-hub-vault', { cache: 'no-store' }),
          fetch(activityUrl, { cache: 'no-store' }),
          fetch('/api/inner-circle-hub-progress', { cache: 'no-store' }),
          fetch('/api/policy-submissions', { cache: 'no-store' }),
          fetch('/api/sponsorship-applications', { cache: 'no-store' }),
          fetch(leadClaimsUrl, { cache: 'no-store' }),
          fetch(mediaUrl, { cache: 'no-store' }),
          fetch(onboardingUrl, { cache: 'no-store' }),
          fetch(teamUrl, { cache: 'no-store' }),
          fetch('/api/inner-circle-hub-members', { cache: 'no-store' })
        ]);

        const kpiData = await kpiRes.json().catch(() => ({}));
        const dailyData = await dailyRes.json().catch(() => ({}));
        const scriptsData = await scriptsRes.json().catch(() => ({}));
        const vaultData = await vaultRes.json().catch(() => ({}));
        const activityData = await activityRes.json().catch(() => ({}));
        const progressData = await progressRes.json().catch(() => ({}));
        const policiesData = await policiesRes.json().catch(() => ({}));
        const sponsorshipData = await sponsorshipRes.json().catch(() => ({}));
        const leadClaimsData = await leadClaimsRes.json().catch(() => ({}));
        const mediaData = await mediaRes.json().catch(() => ({}));
        const onboardingData = await onboardingRes.json().catch(() => ({}));
        const teamData = await teamRes.json().catch(() => ({}));
        const membersData = await membersRes.json().catch(() => ({}));

        if (!canceled && kpiRes.ok && kpiData?.ok) {
          let nextKpi = kpiData.kpi || null;
          const maybeKimora = ['kimora@thelegacylink.com', 'investalinkinsurance@gmail.com'].includes(clean(member?.email || '').toLowerCase()) || clean(member?.applicantName || '').toLowerCase().includes('kimora');
          const looksEmpty = !nextKpi || (
            Number(nextKpi?.leadsReceived || 0) === 0
            && Number(nextKpi?.bookingsThisMonth || 0) === 0
            && Number(nextKpi?.closesThisMonth || 0) === 0
          );

          if (maybeKimora && looksEmpty) {
            try {
              const fallbackRes = await fetch('/api/inner-circle-hub-kpi?name=Kimora%20Link&email=kimora@thelegacylink.com', { cache: 'no-store' });
              const fallbackData = await fallbackRes.json().catch(() => ({}));
              if (fallbackRes.ok && fallbackData?.ok && fallbackData?.kpi) {
                nextKpi = fallbackData.kpi;
              }
            } catch {}
          }

          setKpi(nextKpi);
        }
        if (!canceled && dailyRes.ok && dailyData?.ok) {
          const rows = Array.isArray(dailyData.rows) ? dailyData.rows : [];
          setDailyRows(rows);
          const today = rows.find((r) => clean(r?.dateKey) === todayDateKey());
          if (today) {
            setTracker((p) => ({
              ...p,
              dateKey: today.dateKey || p.dateKey,
              calls: today.calls ?? p.calls,
              bookings: today.bookings ?? p.bookings,
              sponsorshipApps: today.sponsorshipApps ?? p.sponsorshipApps,
              fngSubmittedApps: today.fngSubmittedApps ?? p.fngSubmittedApps,
              checklist: {
                workNewLeads: Boolean(today?.checklist?.workNewLeads),
                followUpWarmLeads: Boolean(today?.checklist?.followUpWarmLeads),
                bookOneConversation: Boolean(today?.checklist?.bookOneConversation),
                postContent: Boolean(today?.checklist?.postContent),
                updateTracker: Boolean(today?.checklist?.updateTracker)
              }
            }));
          }
        }
        if (!canceled && scriptsRes.ok && scriptsData?.ok) setScripts(Array.isArray(scriptsData.rows) ? scriptsData.rows : []);
        if (!canceled && vaultRes.ok && vaultData?.ok) setVault(vaultData.vault || { content: [], calls: [], onboarding: [] });
        if (!canceled && activityRes.ok && activityData?.ok) {
          setActivityRows(Array.isArray(activityData.rows) ? activityData.rows : []);
          setActivitySummary(activityData.summary || { submitted: 0, approved: 0, declined: 0, booked: 0, fng: 0, completed: 0 });
          setActivityStats(activityData.stats || {
            daily: { bookings: 0, sponsorshipSubmitted: 0, sponsorshipApproved: 0, fngSubmitted: 0 },
            weekly: { bookings: 0, sponsorshipSubmitted: 0, sponsorshipApproved: 0, fngSubmitted: 0 },
            monthly: { bookings: 0, sponsorshipSubmitted: 0, sponsorshipApproved: 0, fngSubmitted: 0 }
          });
        }
        if (!canceled && progressRes.ok && progressData?.ok) {
          setLeaderboard({ month: clean(progressData?.month), rows: Array.isArray(progressData?.rows) ? progressData.rows : [] });
        }
        if (!canceled && policiesRes.ok && policiesData?.ok) {
          setPolicyRows(Array.isArray(policiesData?.rows) ? policiesData.rows : []);
        }
        if (!canceled && sponsorshipRes.ok && sponsorshipData?.ok) {
          setSponsorshipRows(Array.isArray(sponsorshipData?.rows) ? sponsorshipData.rows : []);
        }
        if (!canceled && leadClaimsRes.ok && leadClaimsData?.ok) {
          setLeadClaimRows(Array.isArray(leadClaimsData?.rows) ? leadClaimsData.rows : []);
        }
        if (!canceled && mediaRes.ok && mediaData?.ok) {
          setMediaItems(Array.isArray(mediaData?.items) ? mediaData.items : []);
          setMediaProgress(mediaData?.myProgress && typeof mediaData.myProgress === 'object' ? mediaData.myProgress : {});
          setMediaCommentDrafts(Object.fromEntries(Object.entries(mediaData?.myProgress || {}).map(([k, v]) => [k, clean(v?.comment || '')])));
        }
        if (!canceled && onboardingRes.ok && onboardingData?.ok) {
          setOnboardingDecisionRows(Array.isArray(onboardingData?.rows) ? onboardingData.rows : []);
        }
        if (!canceled && teamRes.ok && teamData?.ok) {
          setTeamHierarchyRows(Array.isArray(teamData?.rows) ? teamData.rows : []);
        }
        if (!canceled && membersRes.ok && membersData?.ok) {
          setHubMembers(Array.isArray(membersData?.rows) ? membersData.rows : []);
        }
      } catch {
        if (!canceled) {
          setKpi(null);
          setDailyRows([]);
          setScripts([]);
          setVault({ content: [], calls: [], onboarding: [] });
          setLeaderboard({ month: '', rows: [] });
          setPolicyRows([]);
          setSponsorshipRows([]);
          setLeadClaimRows([]);
          setMediaItems([]);
          setMediaProgress({});
          setOnboardingDecisionRows([]);
          setTeamHierarchyRows([]);
          setHubMembers([]);
        }
      }
    }

    loadAll();
    return () => { canceled = true; };
  }, [member?.id, member?.email, member?.applicantName, member?.name]);

  useEffect(() => {
    if (!tabs.find((t) => t.key === tab) && tabs[0]) setTab(tabs[0].key);
  }, [tabs, tab]);

  async function loadStartIntakeQueue() {
    if (clean(member?.email || '').toLowerCase() !== 'kimora@thelegacylink.com') return;
    setStartIntakeLoading(true);
    setStartIntakeNotice('');
    try {
      const res = await fetch('/api/start-intake', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setStartIntakeNotice('Could not load contract queue.');
        setStartIntakeRows([]);
        return;
      }
      setStartIntakeRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch {
      setStartIntakeNotice('Could not load contract queue.');
      setStartIntakeRows([]);
    } finally {
      setStartIntakeLoading(false);
    }
  }

  async function markStartIntakeContract(row = {}, signed = true) {
    const actorEmail = clean(member?.email || '').toLowerCase();
    if (actorEmail !== 'kimora@thelegacylink.com') return;
    setStartIntakeNotice('');
    try {
      const res = await fetch('/api/start-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_mark_contract',
          actorEmail,
          id: clean(row?.id || ''),
          email: clean(row?.email || ''),
          signed
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setStartIntakeNotice(data?.error || 'Could not update contract status.');
        return;
      }
      const updated = data?.row || {};
      setStartIntakeRows((prev) => (Array.isArray(prev) ? prev.map((r) => (clean(r?.id) === clean(updated?.id) ? updated : r)) : prev));
      setStartIntakeNotice(signed ? 'Marked as signed.' : 'Marked as pending.');
    } catch {
      setStartIntakeNotice('Could not update contract status.');
    }
  }

  async function checkStartIntakeSignature(row = {}) {
    const id = clean(row?.id || row?.email || '');
    if (!id) return;
    setStartIntakeCheckingId(id);
    setStartIntakeNotice('');
    try {
      const email = clean(row?.email || '');
      const name = clean(`${row?.firstName || ''} ${row?.lastName || ''}`);
      const qs = new URLSearchParams();
      if (email) qs.set('email', email);
      if (name) qs.set('name', name);
      const res = await fetch(`/api/contract-signatures?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setStartIntakeNotice('Could not verify signature record right now.');
        return;
      }

      if (data?.signed) {
        const signedAt = clean(data?.row?.signedAt || '');
        await markStartIntakeContract(row, true);
        await loadStartIntakeQueue();
        setStartIntakeNotice(`Signature found${signedAt ? ` (${new Date(signedAt).toLocaleString()})` : ''} and auto-marked signed.`);
      } else {
        setStartIntakeNotice('No signature record found yet for this person.');
      }
    } catch {
      setStartIntakeNotice('Could not verify signature record right now.');
    } finally {
      setStartIntakeCheckingId('');
    }
  }

  async function refreshMediaVault() {
    const memberName = clean(member?.applicantName || member?.name || '');
    const memberEmail = clean(member?.email || '');
    const url = `/api/inner-circle-media-vault?email=${encodeURIComponent(memberEmail)}&name=${encodeURIComponent(memberName)}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) throw new Error('media_fetch_failed');
    setMediaItems(Array.isArray(data?.items) ? data.items : []);
    const my = data?.myProgress && typeof data.myProgress === 'object' ? data.myProgress : {};
    setMediaProgress(my);
    setMediaCommentDrafts(Object.fromEntries(Object.entries(my).map(([k, v]) => [k, clean(v?.comment || '')])));
  }

  async function saveMediaProgress(itemId = '', patch = {}) {
    const memberName = clean(member?.applicantName || member?.name || '');
    const memberEmail = clean(member?.email || '').toLowerCase();
    if (!itemId || (!memberName && !memberEmail)) return;

    const existing = mediaProgress?.[itemId] || {};
    const completed = typeof patch?.completed === 'boolean' ? patch.completed : Boolean(existing?.completed);
    const comment = typeof patch?.comment === 'string' ? patch.comment : clean(existing?.comment || '');

    const res = await fetch('/api/inner-circle-media-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_progress', itemId, memberName, memberEmail, completed, comment })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) throw new Error(data?.error || 'save_failed');

    setMediaProgress((prev) => ({ ...prev, [itemId]: { completed, comment, updatedAt: new Date().toISOString() } }));
  }

  async function adminSaveMediaItem() {
    const actorEmail = clean(member?.email || '').toLowerCase();
    if (actorEmail !== 'kimora@thelegacylink.com') return;
    setMediaNotice('');
    try {
      const res = await fetch('/api/inner-circle-media-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_upsert_item', actorEmail, ...mediaForm })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMediaNotice(data?.error || 'Could not save media item.');
        return;
      }
      setMediaForm({ id: '', type: 'video', title: '', description: '', url: '', tag: 'inner-circle', featured: false, required: false, sortOrder: 100 });
      setMediaNotice('Media item saved.');
      await refreshMediaVault();
    } catch {
      setMediaNotice('Could not save media item.');
    }
  }

  async function adminDeleteMediaItem(itemId = '') {
    const actorEmail = clean(member?.email || '').toLowerCase();
    if (actorEmail !== 'kimora@thelegacylink.com' || !itemId) return;
    setMediaNotice('');
    try {
      const res = await fetch('/api/inner-circle-media-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_delete_item', actorEmail, id: itemId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMediaNotice(data?.error || 'Could not delete item.');
        return;
      }
      setMediaNotice('Item removed.');
      await refreshMediaVault();
    } catch {
      setMediaNotice('Could not delete item.');
    }
  }

  function openActivityFlowDetail(row = {}) {
    const norm = (v = '') => clean(v).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const ts = (v = '') => { const t = Date.parse(v || ''); return Number.isNaN(t) ? 0 : t; };
    const fuzzyNameMatch = (a = '', b = '') => {
      const na = norm(a);
      const nb = norm(b);
      if (!na || !nb) return false;
      if (na === nb) return true;
      if (na.includes(nb) || nb.includes(na)) return true;
      const aFirst = na.split(' ')[0] || '';
      const bFirst = nb.split(' ')[0] || '';
      return Boolean(aFirst && bFirst && aFirst === bFirst);
    };

    const rowEmail = clean(row?.email || row?.applicantEmail || '').toLowerCase();
    const rowPhone = clean(row?.phone || row?.applicantPhone || '');
    const rowName = norm(row?.name || row?.applicantName || '');

    const appRows = (sponsorshipRows || [])
      .filter((r) => {
        const e = clean(r?.email || '').toLowerCase();
        const n = norm(`${r?.firstName || ''} ${r?.lastName || ''}`);
        return (rowEmail && e && rowEmail === e) || fuzzyNameMatch(rowName, n);
      })
      .sort((a, b) => ts(b?.submitted_at || b?.updatedAt) - ts(a?.submitted_at || a?.updatedAt));

    const claimRows = (leadClaimRows || [])
      .filter((r) => {
        const e = clean(r?.applicant_email || '').toLowerCase();
        const p = clean(r?.applicant_phone || '');
        const n = norm(r?.applicant_name || `${r?.applicant_first_name || ''} ${r?.applicant_last_name || ''}`);
        return (rowEmail && e && rowEmail === e) || (rowPhone && p && rowPhone === p) || fuzzyNameMatch(rowName, n);
      })
      .sort((a, b) => ts(b?.updated_at || b?.created_at) - ts(a?.updated_at || a?.created_at));

    const app = appRows[0] || null;
    const claim = claimRows[0] || null;

    setActivityDetail({
      name: clean(row?.name || claim?.applicant_name || `${app?.firstName || ''} ${app?.lastName || ''}`) || 'Member',
      approvalAt: clean(app?.approved_at || ''),
      state: clean(app?.state || claim?.applicant_state || ''),
      email: clean(rowEmail || claim?.applicant_email || app?.email || ''),
      phone: clean(rowPhone || claim?.applicant_phone || app?.phone || '')
    });
  }

  useEffect(() => {
    if (tab !== 'contracts') return;
    if (clean(member?.email || '').toLowerCase() !== 'kimora@thelegacylink.com') return;
    loadStartIntakeQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, member?.email]);

  useEffect(() => {
    if (tab !== 'media') return;
    refreshMediaVault().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, member?.email, member?.applicantName, member?.name]);

  useEffect(() => {
    if (typeof window === 'undefined' || member) return;
    let canceled = false;

    async function tryLicensedSession() {
      const token = clean(window.localStorage.getItem('licensed_backoffice_token') || '');
      if (!token) return;

      try {
        const res = await fetch('/api/inner-circle-hub-members', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ action: 'authenticate_from_licensed' })
        });

        const data = await res.json().catch(() => ({}));
        if (!canceled && res.ok && data?.ok && data?.member) {
          setMember(data.member);
          localStorage.setItem(SESSION_KEY, JSON.stringify(data.member));
          setError('');
        }
      } catch {
        // silent fallback to manual login
      }
    }

    tryLicensedSession();
    return () => { canceled = true; };
  }, [member]);

  async function login(e) {
    if (e?.preventDefault) e.preventDefault();
    setError('');
    if (password === INNER_CIRCLE_DEFAULT_PASSWORD && isMasterDisabled(email)) {
      setError('Please use your personal password. The default password is disabled on this device for your account.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/inner-circle-hub-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'authenticate', email, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        const reason = String(data?.error || '').toLowerCase();
        if (reason === 'onboarding_locked') {
          setError('Your hub is not active yet. Complete contract + payment + password setup with your advisor.');
        } else if (reason === 'personal_password_required') {
          setError('Please use your personal password. The shared default password has been disabled for your account.');
        } else {
          setError('Invalid login. Check email/password.');
        }
        return;
      }
      setMember(data.member);
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(data.member)); } catch {}
      setMustChangePassword(Boolean(data?.mustChangePassword));
      setLoginPassword(password);
      if (Boolean(data?.mustChangePassword)) {
        setNewPassword('');
        setConfirmPassword('');
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitRequiredPasswordChange(e) {
    e.preventDefault();
    setError('');
    if (!newPassword || newPassword.length < 8) {
      setError('Use at least 8 characters for your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/inner-circle-hub-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'self_change_password',
          email: member?.email || email,
          currentPassword: loginPassword,
          newPassword
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError('Could not update password. Try again.');
        return;
      }
      setMustChangePassword(false);
      setLoginPassword(newPassword);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      markMasterDisabled(member?.email || email);
    } finally {
      setChangingPassword(false);
    }
  }

  function logout() {
    setMember(null);
    setMustChangePassword(false);
    setLoginPassword('');
    setNewPassword('');
    setConfirmPassword('');
    try { localStorage.removeItem(SESSION_KEY); } catch {}
  }

  // ── Licensed States ─────────────────────────────────────────────────────
  useEffect(() => {
    const memberEmail = clean(member?.email || '').toLowerCase();
    if (!memberEmail) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/agent-licensed-states?email=${encodeURIComponent(memberEmail)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data?.ok) {
          setLicensedStates(Array.isArray(data.states) ? data.states : []);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [member?.email]);

  async function saveLicensedStates() {
    const memberEmail = clean(member?.email || '').toLowerCase();
    if (!memberEmail) return;
    setLicensedStatesBusy(true);
    setLicensedStatesMsg('');
    try {
      const sessionToken = clean(member?.token || '');
      const res = await fetch('/api/agent-licensed-states', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
        body: JSON.stringify({ email: memberEmail, states: licensedStates })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setLicensedStatesMsg('Save failed. Please try again.');
        return;
      }
      setLicensedStatesMsg('Licensed states updated ✅');
      setTimeout(() => setLicensedStatesMsg(''), 3500);
    } catch {
      setLicensedStatesMsg('Save failed. Please try again.');
    } finally {
      setLicensedStatesBusy(false);
    }
  }

  function toggleLicensedState(code) {
    setLicensedStates((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code]
    );
  }

  async function copyLink(value = '', key = '') {
    try {
      if (!value) return;
      await navigator.clipboard.writeText(value);
      setCopiedKey(key || value);
      setTimeout(() => setCopiedKey(''), 1500);
    } catch {
      setCopiedKey('');
    }
  }

  async function saveTracker() {
    if (!member?.email || !tracker.dateKey) return;
    setSavingTracker(true);
    try {
      await fetch('/api/inner-circle-hub-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          memberId: member?.id || '',
          email: member?.email || '',
          dateKey: tracker.dateKey,
          calls: toNum(tracker.calls),
          checklist: tracker.checklist || {}
        })
      });

      const dailyUrl = `/api/inner-circle-hub-daily?memberId=${encodeURIComponent(member?.id || '')}&email=${encodeURIComponent(member?.email || '')}`;
      const res = await fetch(dailyUrl, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setDailyRows(Array.isArray(data.rows) ? data.rows : []);
      }
    } finally {
      setSavingTracker(false);
    }
  }

  async function refreshTeamHierarchy() {
    const teamUrl = `/api/team-hierarchy?viewerName=${encodeURIComponent(member?.applicantName || member?.name || '')}&viewerEmail=${encodeURIComponent(member?.email || '')}`;
    const res = await fetch(teamUrl, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) setTeamHierarchyRows(Array.isArray(data?.rows) ? data.rows : []);
  }

  async function assignTeamParent(candidate = {}, source = 'admin_manual_assign') {
    if (!canManageHierarchy) return;
    const childKey = clean(candidate?.key || candidate?.childKey || '');
    const parentKey = clean(assignParentByChild?.[childKey] || '');
    if (!childKey || !parentKey) return;
    const parent = (teamAdminData?.options || []).find((o) => clean(o?.key) === parentKey);
    if (!parent) return;

    const existing = (teamManageRows || []).find((r) => clean(r?.childKey) === childKey);
    const previous = existing ? {
      key: clean(existing?.parentKey || ''),
      name: clean(existing?.parentName || existing?.parentLabel || ''),
      email: clean(existing?.parentEmail || '')
    } : null;

    const shouldTrackPrevious = source === 'admin_reassign' || source === 'admin_reassign_bulk';
    const note = shouldTrackPrevious && previous?.key
      ? `prev_parent:${JSON.stringify(previous)}`
      : clean(existing?.note || '');

    setAssigningChildKey(childKey);
    setTeamAssignNotice('');
    try {
      const res = await fetch('/api/team-hierarchy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: parent?.name || '',
          parentEmail: parent?.email || '',
          childName: candidate?.name || candidate?.childName || '',
          childEmail: candidate?.email || candidate?.childEmail || '',
          source,
          note,
          actorEmail: member?.email || ''
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setTeamAssignNotice(`Assign failed: ${clean(data?.error || 'unknown_error')}`);
        return;
      }

      await refreshTeamHierarchy();
      setTeamAssignNotice('Assigned successfully.');
    } finally {
      setAssigningChildKey('');
    }
  }

  async function bulkMoveSelected() {
    if (!canManageHierarchy) return;
    const parent = (teamAdminData?.options || []).find((o) => clean(o?.key) === clean(bulkParentKey));
    if (!parent) return;
    const selectedKeys = Object.entries(bulkMoveMap || {}).filter(([, v]) => Boolean(v)).map(([k]) => clean(k)).filter(Boolean);
    if (!selectedKeys.length) return;

    setBulkMoving(true);
    setTeamAssignNotice('');
    try {
      const selectedRows = (teamManageRows || []).filter((r) => selectedKeys.includes(clean(r?.childKey)));
      for (const r of selectedRows) {
        const childKey = clean(r?.childKey || '');
        if (!childKey || childKey === clean(parent?.key || '') || clean(r?.parentKey || '') === clean(parent?.key || '')) continue;
        await fetch('/api/team-hierarchy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentName: parent?.name || '',
            parentEmail: parent?.email || '',
            childName: r?.childName || '',
            childEmail: r?.childEmail || '',
            source: 'admin_reassign_bulk',
            note: clean(r?.parentKey)
              ? `prev_parent:${JSON.stringify({ key: clean(r?.parentKey), name: clean(r?.parentName || r?.parentLabel || ''), email: clean(r?.parentEmail || '') })}`
              : '',
            actorEmail: member?.email || ''
          })
        });
      }
      await refreshTeamHierarchy();
      setBulkMoveMap({});
      setBulkParentKey('');
      setTeamAssignNotice('Bulk move complete.');
    } finally {
      setBulkMoving(false);
    }
  }

  async function removeTeamLink(row = {}) {
    if (!canManageHierarchy) return;
    const childKey = clean(row?.childKey || '');
    if (!childKey) return;

    setRemovingChildKey(childKey);
    setTeamAssignNotice('');
    try {
      const res = await fetch('/api/team-hierarchy', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clean(row?.id || ''),
          childKey,
          actorEmail: member?.email || ''
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setTeamAssignNotice(`Remove failed: ${clean(data?.error || 'unknown_error')}`);
        return;
      }
      await refreshTeamHierarchy();
      setTeamAssignNotice('Member removed from hierarchy (now unassigned).');
    } finally {
      setRemovingChildKey('');
    }
  }

  async function bulkRemoveSelected() {
    if (!canManageHierarchy) return;
    const selectedKeys = Object.entries(bulkMoveMap || {}).filter(([, v]) => Boolean(v)).map(([k]) => clean(k)).filter(Boolean);
    if (!selectedKeys.length) return;

    setBulkRemoving(true);
    setTeamAssignNotice('');
    try {
      const selectedRows = (teamManageRows || []).filter((r) => selectedKeys.includes(clean(r?.childKey)));
      for (const r of selectedRows) {
        await fetch('/api/team-hierarchy', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: clean(r?.id || ''),
            childKey: clean(r?.childKey || ''),
            actorEmail: member?.email || ''
          })
        });
      }
      await refreshTeamHierarchy();
      setBulkMoveMap({});
      setTeamAssignNotice('Bulk remove complete. Selected members are now unassigned.');
    } finally {
      setBulkRemoving(false);
    }
  }

  async function undoLastMove() {
    if (!canManageHierarchy) return;
    const latest = (recentReassignments || []).find((r) => parseMoveNote(r?.note));
    if (!latest) return;

    const prev = parseMoveNote(latest?.note);
    if (!prev?.key) return;

    setUndoingMove(true);
    try {
      await fetch('/api/team-hierarchy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: prev?.name || '',
          parentEmail: prev?.email || '',
          childName: latest?.childName || '',
          childEmail: latest?.childEmail || '',
          source: 'admin_reassign_undo',
          actorEmail: member?.email || ''
        })
      });
      await refreshTeamHierarchy();
    } finally {
      setUndoingMove(false);
    }
  }

  if (!member) {
    return (
      <main className="publicPage" style={{ minHeight: '100vh', background: 'radial-gradient(circle at top,#17120a 0%,#0b1020 42%, #05070f 100%)', color: '#e5e7eb' }}>
        <div className="panel" style={{ maxWidth: 460, border: '1px solid #3a2f1a', background: 'linear-gradient(180deg,#111827 0%, #0b1020 100%)', boxShadow: '0 20px 80px rgba(0,0,0,0.45)' }}>
          <p style={{ margin: 0, color: '#c8a96b', fontWeight: 700, letterSpacing: '.06em' }}>THE LEGACY LINK</p>
          <h2 style={{ marginTop: 8, marginBottom: 6, color: '#fff' }}>Inner Circle — VIP Lounge</h2>
          <p style={{ marginTop: 0, color: '#cbd5e1' }}>Member Login</p>
          <p style={{ marginTop: -4, color: '#93c5fd', fontSize: 13 }}>If you’re already signed into Licensed Back Office, this page will auto-connect.</p>
          <form onSubmit={login} className="settingsGrid" style={{ rowGap: 12 }}>
            <label style={{ color: '#e2e8f0' }}>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} /></label>
            <label style={{ color: '#e2e8f0' }}>Password<input value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') login(e); }} type="password" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} /></label>
            <button type="button" onClick={login} className="publicPrimaryBtn" disabled={loading}>{loading ? 'Signing in...' : 'Enter Hub'}</button>
            <p className="muted" style={{ marginTop: 4 }}>Password resets are disabled. On first login with the default password, you will be prompted to create your own personal password.</p>
            {error ? <p className="red" style={{ marginTop: 4 }}>{error}</p> : null}
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="publicPage" style={{ minHeight: '100vh', background: 'radial-gradient(circle at top,#17120a 0%,#0b1020 42%, #05070f 100%)', color: '#e5e7eb' }}>
      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #3a2f1a', background: 'linear-gradient(180deg,#0f172a 0%, #0b1020 100%)', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>
        <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, color: '#c8a96b', fontWeight: 700, letterSpacing: '.06em' }}>THE LEGACY LINK</p>
            <h2 style={{ marginTop: 6, color: '#fff' }}>Inner Circle VIP Lounge</h2>
            <p className="muted" style={{ marginTop: -8 }}>Welcome back, {firstNameFromMember(member)} • Premium Member Access</p>
            <small style={{ color: '#94a3b8' }}>Signed in as: {clean(member?.email || 'unknown')}</small>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a
              href={`/upline-inbox?name=${encodeURIComponent(clean(member?.applicantName || member?.name || ''))}&email=${encodeURIComponent(clean(member?.email || ''))}`}
              target="_blank"
              rel="noreferrer"
              className="publicPrimaryBtn"
              style={{ textDecoration: 'none', background: '#B91C1C', borderColor: '#FCA5A5', padding: '8px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <span>Messages</span>
              {Number(uplineUnreadCount || 0) > 0 ? (
                <span style={{ minWidth: 22, height: 22, borderRadius: 999, background: '#C8A96B', color: '#0B1020', fontWeight: 900, fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
                  {Number(uplineUnreadCount || 0)}
                </span>
              ) : null}
            </a>
            <a href={leadMarketplaceHref} target="_blank" rel="noreferrer" className="publicPrimaryBtn" style={{ textDecoration: 'none' }}>Lead Marketplace</a>
            <button type="button" className="ghost" onClick={() => setTab('dashboard')} style={{ marginRight: 4 }}>🏠 Home</button>
            <button type="button" className="ghost" onClick={logout}>Logout</button>
          </div>
        </div>

        {mustChangePassword ? (
          <div className="panel" style={{ borderColor: '#f59e0b', background: '#1f2937' }}>
            <h3 style={{ marginTop: 0, color: '#fde68a' }}>Security Step Required</h3>
            <p style={{ marginTop: 0 }}>Create your personal password now. After this step, the default password will no longer work for your account.</p>
            <form onSubmit={submitRequiredPasswordChange} className="settingsGrid" style={{ rowGap: 12, maxWidth: 520 }}>
              <label style={{ color: '#e2e8f0' }}>New Password<input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} /></label>
              <label style={{ color: '#e2e8f0' }}>Confirm Password<input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} /></label>
              <button type="submit" className="publicPrimaryBtn" disabled={changingPassword}>{changingPassword ? 'Saving...' : 'Save My Password'}</button>
            </form>
            {error ? <p className="red" style={{ marginTop: 8 }}>{error}</p> : null}
          </div>
        ) : !unlocked ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="panel" style={{ borderColor: '#f59e0b', background: '#451a03' }}>
              <h3 style={{ marginTop: 0 }}>Onboarding Locked</h3>
              <p style={{ margin: 0 }}>Your hub unlocks after all setup items are complete.</p>
            </div>
            <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#020617' }}>
              <strong style={{ color: '#fff' }}>Unlock Checklist ({gate.pct}% complete)</strong>
              <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#dbeafe', display: 'grid', gap: 6 }}>
                <li>{gate.contract ? '✅' : '⬜️'} Contract signed</li>
                <li>{gate.payment ? '✅' : '⬜️'} Payment received</li>
                <li>{gate.password ? '✅' : '⬜️'} Password set</li>
              </ul>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {(() => {
              const PINNED_KEYS = ['dashboard', 'dailydrive', 'onboarding', 'production', 'submitapp'];
              const pinnedTabs = PINNED_KEYS.map((k) => tabs.find((t) => t.key === k)).filter(Boolean);
              const overflowTabs = tabs.filter((t) => !PINNED_KEYS.includes(t.key)).sort((a, b) => a.label.localeCompare(b.label));

              function handleTabClick(t) {
                setMoreMenuOpen(false);
                if (t.key === 'incentives') { if (typeof window !== 'undefined') window.open('/champions-circle/inner-circle?home=/inner-circle-hub', '_blank', 'noopener,noreferrer'); return; }
                if (t.key === 'scripts2') { if (typeof window !== 'undefined') window.open('/inner-circle-scripts?home=/inner-circle-hub', '_blank', 'noopener,noreferrer'); return; }
                if (t.key === 'submitapp') { const me = clean(member?.applicantName || member?.name || ''); const href = `/inner-circle-app-submit?referredBy=${encodeURIComponent(me)}&policyWriter=${encodeURIComponent(me)}&source=inner-circle-hub`; if (typeof window !== 'undefined') window.open(href, '_blank', 'noopener,noreferrer'); return; }
                setTab(t.key);
              }

              return (
                <div style={{ position: 'relative' }}>
                  <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {pinnedTabs.map((t) => (
                      <button key={t.key} type="button"
                        className={tab === t.key ? 'publicPrimaryBtn' : 'ghost'}
                        onClick={() => handleTabClick(t)}
                      >{t.label}</button>
                    ))}
                    {overflowTabs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMoreMenuOpen((o) => !o)}
                        style={{
                          padding: '8px 14px', borderRadius: 8, border: `1px solid #c8a96b`,
                          background: moreMenuOpen ? '#c8a96b' : 'rgba(17,24,39,0.55)',
                          color: moreMenuOpen ? '#0b1020' : '#c8a96b',
                          fontWeight: 700, cursor: 'pointer', fontSize: 14
                        }}
                      >More ›</button>
                    )}
                  </div>

                  {/* Overflow popover — desktop dropdown + mobile slide-up */}
                  {moreMenuOpen && overflowTabs.length > 0 && (
                    <>
                      {/* Backdrop */}
                      <div
                        onClick={() => setMoreMenuOpen(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 50 }}
                      />
                      {/* Desktop dropdown */}
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                        zIndex: 60, background: '#0f172a',
                        border: '1px solid #3a2f1a',
                        borderRadius: 12, padding: '8px 0',
                        minWidth: 220, boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
                        display: 'flex', flexDirection: 'column',
                        maxHeight: '60vh', overflowY: 'auto',
                        '@media (max-width: 640px)': { display: 'none' }
                      }} className="more-dropdown">
                        {overflowTabs.map((t) => (
                          <button key={t.key} type="button"
                            onClick={() => handleTabClick(t)}
                            style={{
                              padding: '10px 18px', background: tab === t.key ? '#1f2937' : 'transparent',
                              border: 'none', color: tab === t.key ? '#c8a96b' : '#e2e8f0',
                              textAlign: 'left', cursor: 'pointer', fontWeight: tab === t.key ? 700 : 500,
                              fontSize: 14, borderLeft: tab === t.key ? '3px solid #c8a96b' : '3px solid transparent'
                            }}
                          >{t.label}</button>
                        ))}
                      </div>

                      {/* Mobile slide-up */}
                      <div style={{
                        position: 'fixed', bottom: 0, left: 0, right: 0,
                        zIndex: 60, background: '#0f172a',
                        borderTop: '2px solid #3a2f1a',
                        borderRadius: '16px 16px 0 0',
                        padding: '12px 0 24px',
                        display: 'flex', flexDirection: 'column',
                        maxHeight: '60vh', overflowY: 'auto',
                      }} className="more-slideup">
                        <div style={{ padding: '4px 18px 10px', color: '#c8a96b', fontWeight: 700, fontSize: 15, borderBottom: '1px solid #1f2937' }}>More tabs</div>
                        {overflowTabs.map((t) => (
                          <button key={t.key} type="button"
                            onClick={() => handleTabClick(t)}
                            style={{
                              padding: '13px 18px', background: tab === t.key ? '#1f2937' : 'transparent',
                              border: 'none', color: tab === t.key ? '#c8a96b' : '#e2e8f0',
                              textAlign: 'left', cursor: 'pointer', fontWeight: tab === t.key ? 700 : 500,
                              fontSize: 15, borderLeft: tab === t.key ? '3px solid #c8a96b' : '3px solid transparent'
                            }}
                          >{t.label}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {tab === 'dashboard' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ border: '1px solid #5f4a23', borderRadius: 14, padding: 16, background: 'linear-gradient(135deg,#1f2937 0%,#0b1020 55%,#111827 100%)' }}>
                  <small style={{ color: '#c8a96b', letterSpacing: '.06em', fontWeight: 700 }}>WELCOME TO THE INNER CIRCLE</small>
                  <h3 style={{ color: '#fff', margin: '6px 0 8px' }}>Private access. Elite strategy. Real execution.</h3>
                  <p style={{ color: '#d1d5db', margin: 0 }}>Your next move is simple: execute today’s priorities, stay coachable, and stack momentum.</p>
                </div>

                <div style={{ border: '1px solid #3a2f1a', borderRadius: 12, padding: 14, background: '#0b1020' }}>
                  <strong style={{ color: '#fff', fontSize: 16 }}>Today’s Priority</strong>
                  <div style={{ display: 'grid', gap: 10, marginTop: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
                    <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' }}><small style={{ color: '#c8a96b', fontWeight: 700 }}>WATCH THIS</small><div style={{ color: '#e5e7eb', marginTop: 6 }}>Review one script and run a live rep today.</div></div>
                    <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' }}><small style={{ color: '#c8a96b', fontWeight: 700 }}>DO THIS</small><div style={{ color: '#e5e7eb', marginTop: 6 }}>Book at least one conversation before end of day.</div></div>
                    <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' }}><small style={{ color: '#c8a96b', fontWeight: 700 }}>POST THIS</small><div style={{ color: '#e5e7eb', marginTop: 6 }}>Publish one authority post to generate new leads.</div></div>
                  </div>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#020617' }}>
                  <strong style={{ color: '#fff', fontSize: 16 }}>KPI Dashboard (This Month)</strong>
                  <div style={{ display: 'grid', gap: 10, marginTop: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
                    <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Leads</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{kpi?.leadsReceived ?? 0}</div></div>
                    <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Bookings</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{kpi?.bookingsThisMonth ?? 0}</div></div>
                    <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Closes</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>{kpi?.closesThisMonth ?? 0}</div><small className="muted">Close Rate: {kpi?.closeRate ?? 0}%</small></div>
                    <div style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}><small className="muted">Potential</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>${kpi?.potentialEarned ?? kpi?.grossEarned ?? 0}</div></div>
                  </div>
                </div>
                <div style={{ border: '1px solid #3a2f1a', borderRadius: 12, padding: 14, background: '#0f172a' }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#fff', fontSize: 16 }}>Member Status</strong>
                    <span className="pill" style={{ background: '#3a2f1a', color: '#f3e8d1', border: '1px solid #5f4a23' }}>{vipTier}</span>
                  </div>
                  <p style={{ color: '#d1d5db', margin: '8px 0 10px' }}>You’re in the room. Keep stacking daily actions and your badge climbs automatically with performance.</p>
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
                    <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' }}><small className="muted">Current Tier</small><div style={{ color: '#fff', fontWeight: 800 }}>{vipTier}</div></div>
                    <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' }}><small className="muted">Checklist Progress</small><div style={{ color: '#fff', fontWeight: 800 }}>{checklistDoneCount}/5 today</div></div>
                    <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' }}><small className="muted">Tracker Days</small><div style={{ color: '#fff', fontWeight: 800 }}>{dailyRows.length}</div></div>
                  </div>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#061126' }}>
                  <strong style={{ color: '#fff', fontSize: 16 }}>Onboarding Playbooks Library</strong>
                  <p style={{ color: '#cbd5e1', marginTop: 8, marginBottom: 10 }}>Your back office has all onboarding PDFs in one place.</p>
                  <a
                    href={onboardingPlaybookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="publicPrimaryBtn"
                    style={{ display: 'inline-block', textDecoration: 'none', marginBottom: 10 }}
                  >
                    Open VIP Playbook
                  </a>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {onboardingLibraryLinks.map((link) => (
                      <a
                        key={link.name}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ghost"
                        style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'left' }}
                      >
                        {link.name}
                      </a>
                    ))}
                  </div>
                </div>

                <div style={{ border: '1px solid #5f4a23', borderRadius: 12, padding: 14, background: '#111827' }}>
                  <strong style={{ color: '#fff', fontSize: 16 }}>Concierge Desk</strong>
                  <p style={{ color: '#d1d5db', margin: '8px 0 0' }}>Need support? Message your advisor or coach for your next best move. Premium members move faster with quick feedback loops.</p>
                </div>

                <div style={{ border: '1px solid #7a5d25', borderRadius: 12, padding: 14, background: 'linear-gradient(135deg,#2b2110 0%,#111827 55%,#1f2937 100%)' }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#fff' }}>Top 3 Performers of the Month</strong>
                    <span className="pill" style={{ background: '#c8a96b', color: '#0b1020', border: '1px solid #e6d1a6', fontWeight: 800 }}>Monthly Spotlight</span>
                  </div>
                  {topThreePerformers.length ? (
                    <div style={{ display: 'grid', gap: 8, marginTop: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))' }}>
                      {topThreePerformers.map((row, idx) => (
                        <div key={`top3_${idx}_${row?.name || 'member'}`} style={{ border: '1px solid #5f4a23', borderRadius: 10, padding: 10, background: '#0f172a' }}>
                          <div style={{ color: '#c8a96b', fontWeight: 800 }}>#{idx + 1}</div>
                          <div style={{ color: '#f8fafc', fontWeight: 800, marginTop: 2 }}>{row?.name || 'Member'}</div>
                          <div style={{ marginTop: 4, color: '#f3e8d1', fontWeight: 700 }}>{row.points} points • ${row.dollars}</div>
                          <div style={{ color: '#d1d5db', fontSize: 12, marginTop: 6 }}>Sponsorship Submitted {row.submitted} • Booked {row.bookings} • Policy Submitted {row.fng} • Policy Approved {row.completed} • Sponsorship Approved {row.approved}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <small className="muted">No top performers yet this month.</small>
                  )}
                </div>

                <div style={{ border: '1px solid #3a2f1a', borderRadius: 12, padding: 12, background: '#0f172a' }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#fff' }}>Monthly Leaderboard</strong>
                    <small className="muted">Top 5 Inner Circle • {leaderboard?.month || 'Current Month'}</small>
                  </div>
                  <small className="muted">Scoring: Sponsorship Submitted (1) • Booked (3) • Policy Submitted (10) • Policy Approved (500). Sponsorship Approved and Leads are tracked but not scored.</small>
                  <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                    {monthlyTopPerformers.map((row, idx) => (
                      <div key={`leader_${idx}_${row?.name || 'unknown'}`} style={{ border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', background: '#111827', color: '#e5e7eb' }}>
                        <span style={{ color: '#c8a96b', fontWeight: 800, marginRight: 8 }}>#{idx + 1}</span>
                        <strong style={{ color: '#f8fafc', fontWeight: 800 }}>{row?.name || 'Member'}</strong>
                        <span style={{ color: '#e2e8f0', fontWeight: 700 }}> • {row.points} pts • ${row.dollars}</span>
                        <div style={{ color: '#cbd5e1', fontSize: 12, marginTop: 4 }}>Sponsorship Submitted {row.submitted} • Booked {row.bookings} • Policy Submitted {row.fng} • Policy Approved {row.completed} • Sponsorship Approved {row.approved}</div>
                      </div>
                    ))}
                    {!monthlyTopPerformers.length ? <small className="muted">No qualifying performance yet this month.</small> : null}
                  </div>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#fff' }}>Activity Flow</strong>
                  </div>

                  <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <button type="button" className={activityType === 'all' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setActivityType('all')}>All</button>
                    <button type="button" className={activityType === 'booked' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setActivityType('booked')}>Booked ({activitySummary.booked || 0})</button>
                    <button type="button" className={activityType === 'decision' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setActivityType('decision')}>Sponsorship ({(activitySummary.approved || 0) + (activitySummary.declined || 0)})</button>
                    <button type="button" className={activityType === 'fng' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setActivityType('fng')}>Policy Submitted ({activitySummary.fng || 0})</button>
                    <button type="button" className={activityType === 'completed' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setActivityType('completed')}>Application Approved ({activitySummary.completed || 0})</button>
                  </div>

                  <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <small className="muted">Legend:</small>
                    <span className="pill" style={{ background: '#7f1d1d', color: '#fee2e2', border: '1px solid #ef4444' }}>Sponsorship Approved</span>
                    <span className="pill" style={{ background: '#fef9c3', color: '#854d0e', border: '1px solid #facc15' }}>Booked</span>
                    <span className="pill" style={{ background: '#1e3a8a', color: '#dbeafe', border: '1px solid #2563eb' }}>Application Submitted</span>
                    <span className="pill" style={{ background: '#14532d', color: '#dcfce7', border: '1px solid #22c55e' }}>Application Approved ★★★ (Green Highlight)</span>
                  </div>

                  <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                    {(filteredActivityRows || []).map((row, idx) => {
                      const label = row?.type === 'booked'
                        ? 'Booked'
                        : row?.type === 'decision'
                          ? (row?.decision === 'declined' ? 'Declined' : 'Sponsorship Approved')
                          : row?.type === 'completed'
                            ? 'Application Approved'
                            : 'Application Submitted';

                      const isBooked = row?.type === 'booked';
                      const isSponsorDecision = row?.type === 'decision';
                      const isAppSubmitted = row?.type === 'fng';
                      const isAppApproved = row?.type === 'completed';

                      const pillStyle = isBooked
                        ? { background: '#fef9c3', color: '#854d0e', border: '1px solid #facc15' }
                        : isSponsorDecision
                          ? { background: '#7f1d1d', color: '#fee2e2', border: '1px solid #ef4444' }
                          : isAppSubmitted
                            ? { background: '#1e3a8a', color: '#dbeafe', border: '1px solid #2563eb' }
                            : { background: '#14532d', color: '#dcfce7', border: '1px solid #22c55e' };

                      const rowStyle = isAppApproved
                        ? { border: '1px solid #22c55e', boxShadow: '0 0 0 1px rgba(34,197,94,0.20), 0 0 12px rgba(34,197,94,0.16)' }
                        : { border: '1px solid #1f2937', boxShadow: 'none' };

                      const fngHref = `/inner-circle-app-submit?name=${encodeURIComponent(row?.name || '')}&email=${encodeURIComponent(row?.email || '')}&phone=${encodeURIComponent(row?.phone || '')}&referredBy=${encodeURIComponent(member?.applicantName || '')}`;
                      return (
                        <button
                          key={`${row?.type}_${row?.name}_${idx}`}
                          type="button"
                          onClick={() => openActivityFlowDetail(row)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', ...rowStyle, borderRadius: 8, padding: '8px 10px', background: '#030a17', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <span className="pill" style={pillStyle}>{label}</span>
                          <div style={{ color: '#e2e8f0', fontSize: 14, flex: 1 }}>
                            {row?.name || 'Unknown'}{isAppApproved ? <span title="Application Approved" style={{ marginLeft: 8, color: '#fbbf24', textShadow: '0 0 8px rgba(251,191,36,0.45)', letterSpacing: 1.5 }}>⭐⭐⭐</span> : null}
                          </div>
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <small className="muted" style={{ whiteSpace: 'nowrap' }}>Tap for details</small>
                            {row?.showFngButton ? (
                              <a href={fngHref} onClick={(e) => e.stopPropagation()} className="ghost" style={{ textDecoration: 'none', fontSize: 12, whiteSpace: 'nowrap' }}>Submit App</a>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                    {!filteredActivityRows.length ? <small className="muted">No activity yet.</small> : null}
                  </div>
                </div>

                {activityDetail ? (
                  <div role="dialog" aria-modal="true" onClick={() => setActivityDetail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.62)', zIndex: 85, display: 'grid', placeItems: 'center' }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 95vw)', background: '#0B1220', border: '1px solid #334155', borderRadius: 12, padding: 14 }}>
                      <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: '#fff' }}>{activityDetail.name}</strong>
                        <button type="button" className="ghost" onClick={() => setActivityDetail(null)}>Close</button>
                      </div>
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#111827', padding: 10 }}><small className="muted">Approval Date</small><div style={{ color: '#fff', fontWeight: 700 }}>{activityDetail.approvalAt ? new Date(activityDetail.approvalAt).toLocaleString() : '—'}</div></div>
                        <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#111827', padding: 10 }}><small className="muted">State</small><div style={{ color: '#fff', fontWeight: 700 }}>{activityDetail.state || '—'}</div></div>
                        <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#111827', padding: 10 }}><small className="muted">Email</small><div style={{ color: '#fff', fontWeight: 700 }}>{activityDetail.email || '—'}</div></div>
                        <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#111827', padding: 10 }}><small className="muted">Phone</small><div style={{ color: '#fff', fontWeight: 700 }}>{activityDetail.phone || '—'}</div></div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {tab === 'faststart' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ border: '1px solid #5f4a23', borderRadius: 12, padding: 16, background: '#111827' }}>
                  <strong style={{ color: '#fff', fontSize: 18 }}>VIP First 7 Days</strong>
                  <p style={{ color: '#e5e7eb', marginTop: 8, marginBottom: 10, fontSize: 15 }}>Your premium onboarding sprint. Keep this simple and complete one block per day.</p>
                  <ul style={{ margin: '10px 0 0', paddingLeft: 0, listStyle: 'none', color: '#F8FAFC', display: 'grid', gap: 10, fontWeight: 700, lineHeight: 1.6, fontSize: 16 }}>
                    <li style={{ background: '#1f2937', border: '1px solid #334155', borderRadius: 10, padding: '10px 12px', color: '#F8FAFC', fontSize: 16, lineHeight: 1.6 }}><span style={{ color: '#FDE68A' }}>Day 1:</span> Login, set environment, review scripts, save tracker baseline</li>
                    <li style={{ background: '#1f2937', border: '1px solid #334155', borderRadius: 10, padding: '10px 12px', color: '#F8FAFC', fontSize: 16, lineHeight: 1.6 }}><span style={{ color: '#FDE68A' }}>Day 2:</span> Start 25+ outbound conversations</li>
                    <li style={{ background: '#1f2937', border: '1px solid #334155', borderRadius: 10, padding: '10px 12px', color: '#F8FAFC', fontSize: 16, lineHeight: 1.6 }}><span style={{ color: '#FDE68A' }}>Day 3:</span> Book your first conversation and tighten follow-up</li>
                    <li style={{ background: '#1f2937', border: '1px solid #334155', borderRadius: 10, padding: '10px 12px', color: '#F8FAFC', fontSize: 16, lineHeight: 1.6 }}><span style={{ color: '#FDE68A' }}>Day 4:</span> Run discovery flow + objection handling reps</li>
                    <li style={{ background: '#1f2937', border: '1px solid #334155', borderRadius: 10, padding: '10px 12px', color: '#F8FAFC', fontSize: 16, lineHeight: 1.6 }}><span style={{ color: '#FDE68A' }}>Day 5:</span> Push for sponsorship submit and FNG action</li>
                    <li style={{ background: '#1f2937', border: '1px solid #334155', borderRadius: 10, padding: '10px 12px', color: '#F8FAFC', fontSize: 16, lineHeight: 1.6 }}><span style={{ color: '#FDE68A' }}>Day 6:</span> Fill pipeline gaps and post authority content</li>
                    <li style={{ background: '#1f2937', border: '1px solid #334155', borderRadius: 10, padding: '10px 12px', color: '#F8FAFC', fontSize: 16, lineHeight: 1.6 }}><span style={{ color: '#FDE68A' }}>Day 7:</span> Review KPI, plan week two, set stretch target</li>
                  </ul>
                </div>

                <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 16, background: '#071022' }}>
                  <strong style={{ color: '#fff', fontSize: 18 }}>Days 8–14 Fast Track</strong>
                  <p style={{ color: '#cbd5e1', marginTop: 8, marginBottom: 10, fontSize: 15 }}>Move in sequence. Execute daily. Keep momentum high.</p>
                  <ul style={{ margin: '10px 0 0', paddingLeft: 0, listStyle: 'none', color: '#F8FAFC', display: 'grid', gap: 10, fontWeight: 700, lineHeight: 1.6, fontSize: 16 }}>
                    <li style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 10, padding: '11px 13px', color: '#0F172A', fontWeight: 800, lineHeight: 1.65 }}><span style={{ color: '#1D4ED8' }}>Day 8–10:</span> <span style={{ color: '#0F172A' }}>Scale outbound and stack booked calls</span></li>
                    <li style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 10, padding: '11px 13px', color: '#0F172A', fontWeight: 800, lineHeight: 1.65 }}><span style={{ color: '#1D4ED8' }}>Day 11–12:</span> <span style={{ color: '#0F172A' }}>Submit additional apps and recover warm leads</span></li>
                    <li style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 10, padding: '11px 13px', color: '#0F172A', fontWeight: 800, lineHeight: 1.65 }}><span style={{ color: '#1D4ED8' }}>Day 13–14:</span> <span style={{ color: '#0F172A' }}>Tighten close rate, lock in consistency</span></li>
                  </ul>
                </div>
              </div>
            ) : null}

            {tab === 'growth' ? (
              <div style={{ border: '1px solid #334155', borderRadius: 14, overflow: 'hidden', background: '#0B1220' }}>
                <iframe title="Growth Hub" src="/growth-hub" style={{ width: '100%', minHeight: 980, border: 0, background: '#020617' }} />
              </div>
            ) : null}

            {tab === 'scripts' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <p style={{ color: '#cbd5e1', margin: 0 }}>Filter scripts by conversation type.</p>
                <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className={scriptFilter === 'all' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setScriptFilter('all')}>All</button>
                  <button type="button" className={scriptFilter === 'sponsorship' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setScriptFilter('sponsorship')}>Sponsorship</button>
                  <button type="button" className={scriptFilter === 'life-insurance' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setScriptFilter('life-insurance')}>Life Insurance</button>
                </div>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
                  {(filteredScripts || []).map((item) => (
                    <div key={item?.id} style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                      <strong style={{ color: '#fff' }}>{item?.title || 'Untitled'}</strong>
                      <small className="muted" style={{ display: 'block', textTransform: 'uppercase', marginTop: 4 }}>{item?.category || 'general'}</small>
                      <p className="muted" style={{ marginBottom: 0 }}>{item?.text || ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {tab === 'execution' ? (
              <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 14, background: '#071022' }}>
                <strong style={{ color: '#fff', fontSize: 17 }}>Today Action Checklist</strong>
                <p style={{ color: '#dbeafe', marginTop: 8, marginBottom: 6, fontSize: 15 }}>Date: {tracker.dateKey || todayDateKey()}</p>
                <p style={{ color: '#93c5fd', marginTop: 0, fontWeight: 700, fontSize: 15 }}>Progress: {checklistDoneCount}/5 complete</p>
                <div style={{ display: 'grid', gap: 8 }}>
                  {[
                    ['workNewLeads', 'Work new leads'],
                    ['followUpWarmLeads', 'Follow up warm leads'],
                    ['bookOneConversation', 'Book at least one conversation'],
                    ['postContent', 'Post content for lead generation'],
                    ['updateTracker', 'Update tracker before end of day']
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#f1f5f9', fontWeight: 600, fontSize: 15 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(tracker?.checklist?.[key])}
                        onChange={(e) => setTracker((p) => ({ ...p, checklist: { ...(p?.checklist || {}), [key]: e.target.checked } }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <button type="button" className="publicPrimaryBtn" onClick={saveTracker} disabled={savingTracker} style={{ marginTop: 10 }}>
                  {savingTracker ? 'Saving...' : 'Save Checklist'}
                </button>
              </div>
            ) : null}

            {tab === 'vault' ? (
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
                {[
                  ['Content Vault', vault?.content || []],
                  ['Call Vault', vault?.calls || []],
                  ['Onboarding Vault', vault?.onboarding || []]
                ].map(([title, items]) => (
                  <div key={title} style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                    <strong style={{ color: '#fff' }}>{title}</strong>
                    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                      {(items || []).map((item) => (
                        <div key={item?.id} style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 10, background: '#030a17' }}>
                          <div style={{ color: '#fff', fontWeight: 700 }}>{item?.title || 'Untitled'}</div>
                          <small className="muted" style={{ textTransform: 'uppercase' }}>{item?.tag || 'general'}</small>
                          <p className="muted" style={{ marginBottom: 0 }}>{item?.body || ''}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === 'media' ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ border: '1px solid #5f4a23', borderRadius: 14, padding: 14, background: 'linear-gradient(135deg,#1f2937 0%,#0b1020 55%,#111827 100%)' }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ color: '#fff', fontSize: 17 }}>VIP Media Vault</strong>
                    <div className="panelRow" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" className={mediaFilter === 'all' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setMediaFilter('all')}>All</button>
                      <button type="button" className={mediaFilter === 'video' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setMediaFilter('video')}>Videos</button>
                      <button type="button" className={mediaFilter === 'audio' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setMediaFilter('audio')}>Audios</button>
                      <button type="button" className={mediaFilter === 'reading' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setMediaFilter('reading')}>Reading</button>
                      <button type="button" className="ghost" onClick={() => refreshMediaVault().catch(() => setMediaNotice('Could not refresh media vault.'))}>Refresh</button>
                    </div>
                  </div>
                  {mediaNotice ? <small className="muted" style={{ color: '#93c5fd', marginTop: 8, display: 'block' }}>{mediaNotice}</small> : null}
                </div>

                {canManageHierarchy ? (
                  <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 12, background: '#0B1220', display: 'grid', gap: 8 }}>
                    <strong style={{ color: '#fff' }}>Admin Upload (Kimora only)</strong>
                    <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <select value={mediaForm.type} onChange={(e) => setMediaForm((p) => ({ ...p, type: e.target.value }))} style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 8px' }}>
                        <option value="video">Video</option>
                        <option value="audio">Audio</option>
                        <option value="reading">Reading</option>
                      </select>
                      <input value={mediaForm.title} onChange={(e) => setMediaForm((p) => ({ ...p, title: e.target.value }))} placeholder="Title" style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', minWidth: 220 }} />
                      <input value={mediaForm.url} onChange={(e) => setMediaForm((p) => ({ ...p, url: e.target.value }))} placeholder="URL" style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', minWidth: 280 }} />
                    </div>
                    <input value={mediaForm.description} onChange={(e) => setMediaForm((p) => ({ ...p, description: e.target.value }))} placeholder="Short description" style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px' }} />
                    <div className="panelRow" style={{ gap: 12, flexWrap: 'wrap' }}>
                      <label style={{ color: '#cbd5e1', fontSize: 13 }}><input type="checkbox" checked={Boolean(mediaForm.featured)} onChange={(e) => setMediaForm((p) => ({ ...p, featured: e.target.checked }))} /> Featured</label>
                      <label style={{ color: '#cbd5e1', fontSize: 13 }}><input type="checkbox" checked={Boolean(mediaForm.required)} onChange={(e) => setMediaForm((p) => ({ ...p, required: e.target.checked }))} /> Required</label>
                      <label style={{ color: '#cbd5e1', fontSize: 13 }}>Sort Order <input type="number" value={mediaForm.sortOrder} onChange={(e) => setMediaForm((p) => ({ ...p, sortOrder: Number(e.target.value || 0) }))} style={{ marginLeft: 6, width: 90, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '5px 8px' }} /></label>
                    </div>
                    <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="publicPrimaryBtn" onClick={adminSaveMediaItem}>{mediaForm.id ? 'Update Item' : 'Add Item'}</button>
                      {mediaForm.id ? <button type="button" className="ghost" onClick={() => setMediaForm({ id: '', type: 'video', title: '', description: '', url: '', tag: 'inner-circle', featured: false, required: false, sortOrder: 100 })}>Clear</button> : null}
                    </div>
                  </div>
                ) : null}

                {(featuredMediaItems || []).length ? (
                  <div style={{ border: '1px solid #5f4a23', borderRadius: 12, padding: 12, background: '#0B1220', display: 'grid', gap: 8 }}>
                    <strong style={{ color: '#fff' }}>Featured This Week</strong>
                    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
                      {(featuredMediaItems || []).slice(0, 3).map((f) => (
                        <a key={`feat-${f.id}`} href={f?.url || '#'} target="_blank" rel="noreferrer" style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, textDecoration: 'none', background: '#111827' }}>
                          <small className="muted">{clean(f?.type || 'media').toUpperCase()}</small>
                          <div style={{ color: '#fff', fontWeight: 700, marginTop: 4 }}>{f?.title || 'Untitled'}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
                  {(filteredMediaItems || []).map((item) => {
                    const id = clean(item?.id || '');
                    const progress = mediaProgress?.[id] || {};
                    const completed = Boolean(progress?.completed);
                    const draftComment = mediaCommentDrafts?.[id] ?? clean(progress?.comment || '');
                    return (
                      <div key={id} style={{ border: '1px solid #334155', borderRadius: 12, padding: 12, background: '#0B1220', display: 'grid', gap: 8 }}>
                        <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div className="panelRow" style={{ gap: 6, flexWrap: 'wrap' }}>
                            <span className={`pill ${item?.type === 'video' ? 'onpace' : item?.type === 'audio' ? 'neutral' : 'atrisk'}`}>{clean(item?.type || 'media').toUpperCase()}</span>
                            {item?.featured ? <span className="pill onpace">Featured</span> : null}
                            {item?.required ? <span className="pill atrisk">Required</span> : null}
                          </div>
                          <span className={`pill ${completed ? 'onpace' : 'neutral'}`}>{completed ? 'Completed' : 'Not Completed'}</span>
                        </div>
                        <strong style={{ color: '#fff' }}>{item?.title || 'Untitled'}</strong>
                        <small className="muted">{item?.description || '—'}</small>
                        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
                          <a href={item?.url || '#'} target="_blank" rel="noreferrer" className="ghost" style={{ textDecoration: 'none' }}>Open</a>
                          <button type="button" className={completed ? 'ghost' : 'publicPrimaryBtn'} onClick={() => saveMediaProgress(id, { completed: !completed }).catch(() => setMediaNotice('Could not save completion.'))}>{completed ? 'Mark Incomplete' : 'Mark Complete'}</button>
                          {canManageHierarchy ? <button type="button" className="ghost" onClick={() => setMediaForm({ id, type: item?.type || 'video', title: item?.title || '', description: item?.description || '', url: item?.url || '', tag: item?.tag || 'inner-circle', featured: Boolean(item?.featured), required: Boolean(item?.required), sortOrder: Number(item?.sortOrder ?? 100) })}>Edit</button> : null}
                          {canManageHierarchy ? <button type="button" className="ghost" onClick={() => adminDeleteMediaItem(id)}>Delete</button> : null}
                        </div>
                        <textarea value={draftComment} onChange={(e) => setMediaCommentDrafts((p) => ({ ...p, [id]: e.target.value }))} placeholder="Comment (honor system)" style={{ width: '100%', minHeight: 68, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', boxSizing: 'border-box' }} />
                        <button type="button" className="ghost" onClick={() => saveMediaProgress(id, { comment: clean(mediaCommentDrafts?.[id] || '') }).catch(() => setMediaNotice('Could not save comment.'))}>Save Comment</button>
                      </div>
                    );
                  })}
                  {!(filteredMediaItems || []).length ? <small className="muted">No media items yet.</small> : null}
                </div>
              </div>
            ) : null}

            {tab === 'onboarding' ? (
              <div style={{ border: '1px solid #2A3142', borderRadius: 12, overflow: 'hidden', background: '#0F172A' }}>
                <iframe
                  title="Licensed Onboarding Tracker"
                  src={`/licensed-onboarding-tracker?track=inner-circle&viewerName=${encodeURIComponent(clean(member?.applicantName || member?.name || ''))}&viewerEmail=${encodeURIComponent(clean(member?.email || ''))}&viewerRole=${encodeURIComponent(clean(member?.role || 'agent'))}`}
                  style={{ width: '100%', minHeight: 1450, border: 0, background: '#020617' }}
                />
              </div>
            ) : null}

            {tab === 'tracker' ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#020617' }}>
  
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 16 }}>
                  <div style={{ border: '1px solid #2A3142', borderRadius: 16, background: 'rgba(168, 85, 247, 0.14)', padding: 20, minHeight: 150 }}>
                    <div style={{ color: '#C4B5FD', fontSize: 14, marginBottom: 8 }}>All-Time Paid</div>
                    <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.08 }}>${productionFinancials.allTimePaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div style={{ border: '1px solid #2A3142', borderRadius: 16, background: 'rgba(245, 158, 11, 0.14)', padding: 20, minHeight: 150 }}>
                    <div style={{ color: '#FCD34D', fontSize: 14, marginBottom: 8 }}>Upcoming (Next 7 Days)</div>
                    <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.08 }}>{trackerUpcomingSummary.dueNext7}</div>
                    <small className="muted">Due Today: {trackerUpcomingSummary.dueToday}</small>
                  </div>
                  <div style={{ border: '1px solid #2A3142', borderRadius: 16, background: 'rgba(34, 197, 94, 0.14)', padding: 20, minHeight: 150 }}>
                    <div style={{ color: '#86EFAC', fontSize: 14, marginBottom: 8 }}>This Month Paid</div>
                    <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.08 }}>${productionFinancials.thisMonthPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingBreakdownOpen(true)}
                    style={{ border: '1px solid #2A3142', borderRadius: 16, background: 'rgba(59, 130, 246, 0.14)', padding: 20, minHeight: 150, textAlign: 'left', color: '#fff', cursor: 'pointer' }}
                  >
                    <div style={{ color: '#93C5FD', fontSize: 14, marginBottom: 8 }}>This Month Pending</div>
                    <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.08 }}>${productionFinancials.thisMonthPending.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <small className="muted">Tap to view breakdown</small>
                  </button>
                </div>

                <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 14, background: '#020617' }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ color: '#fff', fontSize: 16 }}>KPI + Sponsorship Income Planner</strong>
                    <span className="pill neutral">Default: 10 conv → 3 paid referrals → $1,500</span>
                  </div>

                  <div style={{ display: 'grid', gap: 10, marginTop: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Monthly Income Goal
                      <input type="number" min="0" value={incomePlanner.monthlyGoal} onChange={(e) => setIncomePlanner((p) => ({ ...p, monthlyGoal: e.target.value }))} style={{ background: '#0b1220', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }} />
                    </label>
                    <div style={{ border: '1px solid #334155', borderRadius: 8, padding: '10px', background: '#0b1220' }}>
                      <small className="muted">Required Conversations</small>
                      <div style={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>{incomePlannerStats.requiredWeeklyConversations}/week</div>
                      <small className="muted">{incomePlannerStats.requiredMonthlyConversations}/month to hit goal</small>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#0f172a' }}>
                    <strong style={{ color: '#fff' }}>Auto-Filled Weekly Targets</strong>
                    <div style={{ marginTop: 8, overflowX: 'auto' }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Stage</th>
                            <th>Target</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr><td>Conversations</td><td>{incomePlannerStats.requiredWeeklyConversations}</td></tr>
                          <tr><td>Interested</td><td>{incomePlannerStats.target.interested}</td></tr>
                          <tr><td>Move Forward</td><td>{incomePlannerStats.target.moveForward}</td></tr>
                          <tr><td>Booked</td><td>{incomePlannerStats.target.booked}</td></tr>
                          <tr><td>Showed</td><td>{incomePlannerStats.target.showed}</td></tr>
                          <tr><td>Paid Referrals</td><td>{incomePlannerStats.target.paidReferrals}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 10, marginTop: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                    <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#0f172a' }}>
                      <small className="muted">Weekly Revenue Target</small>
                      <div style={{ color: '#86EFAC', fontWeight: 800, fontSize: 24 }}>${incomePlannerStats.target.weeklyRevenue.toLocaleString()}</div>
                    </div>
                    <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#0f172a' }}>
                      <small className="muted">Monthly Projected Revenue</small>
                      <div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>${incomePlannerStats.projections.monthly.toLocaleString()}</div>
                    </div>
                    <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#0f172a' }}>
                      <small className="muted">Annual Projected Revenue</small>
                      <div style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>${incomePlannerStats.projections.annual.toLocaleString()}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#0f172a' }}>
                    <strong style={{ color: '#fff' }}>Payout Lag Awareness</strong>
                    <p className="muted" style={{ marginTop: 8 }}>
                      Expected earned this week: <strong>${incomePlannerStats.payoutLag.expectedEarned.toLocaleString()}</strong>.
                      Estimated payout timing: {incomePlannerStats.payoutLag.windowStart ? new Date(incomePlannerStats.payoutLag.windowStart).toLocaleDateString() : '—'} to {incomePlannerStats.payoutLag.windowEnd ? new Date(incomePlannerStats.payoutLag.windowEnd).toLocaleDateString() : '—'}.
                    </p>
                  </div>

                  <div style={{ marginTop: 12, border: '1px solid #f59e0b', borderRadius: 10, padding: 10, background: '#111827' }}>
                    <strong style={{ color: '#fef3c7' }}>Coaching Insights</strong>
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#f8fafc', display: 'grid', gap: 6, lineHeight: 1.5 }}>
                      {incomePlannerStats.coaching.map((tip, idx) => <li key={`coach-tip-${idx}`} style={{ color: '#f8fafc' }}>{tip}</li>)}
                    </ul>
                  </div>
                </div>

                {pendingBreakdownOpen ? (
                  <div role="dialog" aria-modal="true" onClick={() => setPendingBreakdownOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.62)', zIndex: 82, display: 'grid', placeItems: 'center' }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(760px, 95vw)', maxHeight: '84vh', overflow: 'auto', background: '#0B1220', border: '1px solid #334155', borderRadius: 12, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <strong style={{ color: '#fff' }}>This Month Pending Breakdown</strong>
                        <button type="button" className="ghost" onClick={() => setPendingBreakdownOpen(false)}>Close</button>
                      </div>

                      <div style={{ display: 'grid', gap: 10, marginTop: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                        <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' }}>
                          <small className="muted">Sponsorship Policies (Pending)</small>
                          <div style={{ color: '#fff', fontWeight: 800, fontSize: 26, marginTop: 4 }}>{pendingBreakdown.sponsorshipPoliciesCount}</div>
                          <small className="muted">Names hidden intentionally</small>
                        </div>
                        <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' }}>
                          <small className="muted">Applications Written (Pending)</small>
                          <div style={{ color: '#fff', fontWeight: 800, fontSize: 26, marginTop: 4 }}>{pendingBreakdown.applicationsWrittenCount}</div>
                        </div>
                      </div>

                      <div style={{ marginTop: 12, border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#0f172a' }}>
                        <strong style={{ color: '#fff' }}>Policy Approvals Pending Payout</strong>
                        {pendingBreakdown.policyApprovals.length ? (
                          <div style={{ marginTop: 8, overflowX: 'auto' }}>
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>Client</th>
                                  <th>Type</th>
                                  <th>Est. Pay Date</th>
                                  <th>Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pendingBreakdown.policyApprovals.map((e) => {
                                  const due = new Date(e?.expectedPayoutAt || e?.qualifiedAt || e?.submittedAt || 0);
                                  return (
                                    <tr key={`pending-approval-${e.id}`}>
                                      <td>{e?.applicant || 'Applicant'}</td>
                                      <td>{e?.policyType || 'Policy'}</td>
                                      <td>{Number.isNaN(due.getTime()) ? '—' : due.toLocaleDateString()}</td>
                                      <td>${Number(e?.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="muted" style={{ marginTop: 8 }}>- None</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>
                  <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#020617' }}>
                    <strong style={{ color: '#fff' }}>Monthly Earnings Trend</strong>
                    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                      {productionFinancials.trend.map((t) => {
                        const max = Math.max(...productionFinancials.trend.map((x) => Number(x.amount || 0)), 1);
                        const w = Math.max(4, Math.round((Number(t.amount || 0) / max) * 100));
                        return (
                          <div key={`prod-trend-${t.key}`} style={{ display: 'grid', gridTemplateColumns: '42px 1fr 100px', gap: 8, alignItems: 'center' }}>
                            <span style={{ color: '#9CA3AF', fontSize: 12 }}>{t.label}</span>
                            <div style={{ height: 10, borderRadius: 999, background: '#1F2937', overflow: 'hidden' }}><div style={{ width: `${w}%`, height: '100%', background: 'linear-gradient(90deg,#2563EB,#60A5FA)' }} /></div>
                            <span style={{ color: '#E5E7EB', fontSize: 12, textAlign: 'right' }}>${Number(t.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          </div>
                        );
                      })}
                      {!productionFinancials.trend.length ? <small className="muted">No trend data yet.</small> : null}
                    </div>
                  </div>

                  <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#020617' }}>
                    <strong style={{ color: '#fff' }}>Income Source Breakdown</strong>
                    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                      {[
                        ['Sponsorship', 'sponsorship', '#10B981'],
                        ['Inner Circle', 'inner_circle', '#3B82F6'],
                        ['Other Policies', 'other', '#F59E0B']
                      ].map(([label, key, color]) => {
                        const amt = Number(productionFinancials.sourceTotals[key] || 0);
                        const pct = productionFinancials.sourceSum > 0 ? Math.round((amt / productionFinancials.sourceSum) * 100) : 0;
                        return (
                          <div key={`prod-src-${key}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                              <span>{label}</span>
                              <span>{pct}% • ${amt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div style={{ height: 8, borderRadius: 999, background: '#1F2937', overflow: 'hidden' }}><div style={{ width: `${Math.max(2, pct)}%`, height: '100%', background: color }} /></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <strong style={{ color: '#fff', fontSize: 17 }}>Production Tracker</strong>
                    <div className="panelRow" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" className={trackerPeriod === 'daily' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTrackerPeriod('daily')}>Daily</button>
                      <button type="button" className={trackerPeriod === 'weekly' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTrackerPeriod('weekly')}>Weekly</button>
                      <button type="button" className={trackerPeriod === 'monthly' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTrackerPeriod('monthly')}>Monthly</button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 10, marginTop: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Date<input type="date" value={tracker.dateKey} onChange={(e) => setTracker((p) => ({ ...p, dateKey: e.target.value }))} style={{ background: '#0b1220', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }} /></label>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Calls<input type="number" min="0" value={tracker.calls} onChange={(e) => setTracker((p) => ({ ...p, calls: e.target.value }))} style={{ background: '#0b1220', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }} /></label>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Bookings (Auto)<input type="number" min="0" value={periodTotals.bookings} disabled readOnly style={{ background: '#111827', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }} /></label>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Sponsorship Submitted (Auto)<input type="number" min="0" value={periodTotals.sponsorshipApps} disabled readOnly style={{ background: '#111827', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }} /></label>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Sponsorship Approved (Auto)<input type="number" min="0" value={periodTotals.sponsorshipApproved} disabled readOnly style={{ background: '#111827', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }} /></label>
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>Policy Submitted (Auto)<input type="number" min="0" value={periodTotals.fngSubmittedApps} disabled readOnly style={{ background: '#111827', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }} /></label>
                  </div>
                  <button type="button" className="publicPrimaryBtn" onClick={saveTracker} disabled={savingTracker} style={{ marginTop: 10 }}>{savingTracker ? 'Saving...' : 'Save Daily Calls'}</button>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ color: '#fff' }}>Upcoming Payments</strong>
                    <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <span className="pill neutral">Today: {trackerUpcomingSummary.dueToday}</span>
                      <span className="pill onpace">Next 7 Days: {trackerUpcomingSummary.dueNext7}</span>
                      <span className="pill offpace">Delivery Delay: {trackerUpcomingSummary.delayedByDelivery}</span>
                    </div>
                  </div>
                  {!productionFinancials.upcoming.length ? (
                    <p className="muted" style={{ marginTop: 8 }}>No pending payouts in the queue right now.</p>
                  ) : (
                    <div style={{ marginTop: 10, overflowX: 'auto' }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Pay Date</th>
                            <th>Who It’s For</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productionFinancials.upcoming.map((e) => {
                            const dueIso = e?.expectedPayoutAt || e?.qualifiedAt || e?.submittedAt || '';
                            const due = new Date(dueIso || 0);
                            const validDate = !Number.isNaN(due.getTime());
                            return (
                              <tr key={`tracker-upcoming-${e.id}`}>
                                <td>{validDate ? due.toLocaleDateString() : '—'}</td>
                                <td>{e?.applicant || 'Applicant'}</td>
                                <td>{e?.policyType || 'Policy'}</td>
                                <td>
                                  {e?.pendingStage === 'delivery_requirement' ? 'Delivery Requirement' : 'Pending'}
                                  {e?.pendingStage === 'delivery_requirement' && e?.deliveryRequirementNote ? (
                                    <div style={{ color: '#94A3B8', fontSize: 12 }}>{e.deliveryRequirementNote}</div>
                                  ) : null}
                                </td>
                                <td>${Number(e?.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {tab === 'team' ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ border: '1px solid #5f4a23', borderRadius: 14, padding: 16, background: 'linear-gradient(135deg,#1f2937 0%,#0b1020 55%,#111827 100%)' }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <strong style={{ color: '#fff', fontSize: 17 }}>Team Tree (Interactive)</strong>
                    <small className="muted">Focus on who is taking steps toward you</small>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    <span className="pill neutral">Direct Team: {teamCards.length}</span>
                    <span className="pill onpace">Total Downline: {teamCards.reduce((a, c) => a + Number(c?.descendants || 0), 0)}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
                  {teamCards.map((card) => {
                    const expanded = Boolean(teamExpanded?.[card.id]);
                    const children = (teamHierarchyRows || []).filter((r) => clean(r?.parentKey) === clean(card?.childKey));
                    return (
                      <div key={card.id} style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', padding: 14 }}>
                        <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div>
                            <div className="panelRow" style={{ gap: 6, flexWrap: 'wrap' }}>
                              <div style={{ color: '#fff', fontWeight: 700 }}>
                                {card.childName}{card.isInnerCircle ? <span title="Inner Circle" style={{ marginLeft: 6, color: '#facc15' }}>★</span> : null}
                              </div>
                              {card.licenseTag === 'licensed' ? <span className="pill" style={{ background: '#064e3b', color: '#d1fae5', border: '1px solid #10b981' }}>Licensed</span> : null}
                              {card.licenseTag === 'unlicensed' ? <span className="pill" style={{ background: '#7f1d1d', color: '#fee2e2', border: '1px solid #ef4444' }}>Unlicensed</span> : null}
                            </div>
                            <small className="muted">{card.childEmail || 'No email on file'}</small>
                            <small className="muted">{card.childPhone || 'No phone on file'}</small>
                          </div>
                          <span className={`pill ${card.score >= 70 ? 'onpace' : card.score >= 35 ? 'neutral' : 'offpace'}`}>{card.momentumLabel} • {card.score}</span>
                        </div>

                        <div style={{ marginTop: 8, color: '#cbd5e1', fontSize: 13 }}>
                          Latest App: <strong style={{ color: '#f8fafc' }}>{card.latestType}</strong>
                          {card.latestAt ? <span style={{ color: '#94a3b8' }}> • {new Date(card.latestAt).toLocaleDateString()}</span> : null}
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                          <span className="pill neutral">7d Apps: {card.submitted7}</span>
                          <span className="pill neutral">30d Apps: {card.submitted30}</span>
                          <span className="pill neutral">Downline: {card.descendants}</span>
                        </div>

                        <div className="panelRow" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                          {children.length ? (
                            <button type="button" className="ghost" onClick={() => setTeamExpanded((p) => ({ ...p, [card.id]: !expanded }))}>
                              {expanded ? 'Hide Downlink' : `View Downlink (${children.length})`}
                            </button>
                          ) : null}
                        </div>

                        {expanded && children.length ? (
                          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                            {children.map((c) => {
                              const meta = teamIdentityMeta.get(clean(c?.childKey || '')) || teamIdentityMeta.get(`${clean(c?.childName || '')}|${clean(c?.childEmail || '').toLowerCase()}`) || {};
                              const licenseTag = clean(meta?.licenseTag || '');
                              const isInnerCircle = Boolean(meta?.isInnerCircle);
                              return (
                                <div key={c.id} style={{ border: '1px solid #334155', borderRadius: 10, background: '#111827', padding: '8px 10px', color: '#e2e8f0', fontSize: 13 }}>
                                  <div className="panelRow" style={{ gap: 6, flexWrap: 'wrap' }}>
                                    <span>{c?.childName || 'Member'}{isInnerCircle ? <span title="Inner Circle" style={{ marginLeft: 6, color: '#facc15' }}>★</span> : null}</span>
                                    {licenseTag === 'licensed' ? <span className="pill" style={{ background: '#064e3b', color: '#d1fae5', border: '1px solid #10b981' }}>Licensed</span> : null}
                                    {licenseTag === 'unlicensed' ? <span className="pill" style={{ background: '#7f1d1d', color: '#fee2e2', border: '1px solid #ef4444' }}>Unlicensed</span> : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {!teamCards.length ? <small className="muted">No team links yet. As referred apps are submitted, your team tree will populate automatically.</small> : null}
                  {!canManageHierarchy ? <small className="muted">Admin controls are hidden. You can view your downline cards and performance only.</small> : null}
                </div>

                {canManageHierarchy ? (
                <>
                <div style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', padding: 14 }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ color: '#fff' }}>Unassigned Queue (Admin Assist)</strong>
                    <small className="muted">Assign members not yet linked under an upline</small>
                  {!canManageHierarchy ? <small style={{ color: '#fca5a5' }}>Only Kimora can reassign team hierarchy.</small> : null}
                  </div>
                  <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <input
                      value={teamParentSearch}
                      onChange={(e) => setTeamParentSearch(e.target.value)}
                      placeholder="Search assign-under names/email..."
                      style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', minWidth: 280 }}
                    />
                    <small className="muted">Assign-under options: {filteredParentOptions.length}</small>
                  </div>
                  {teamAssignNotice ? <small className="muted" style={{ color: teamAssignNotice.toLowerCase().includes('failed') ? '#fca5a5' : '#86efac' }}>{teamAssignNotice}</small> : null}
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {(teamAdminData?.candidates || []).slice(0, 20).map((c) => (
                      <div key={c.key} style={{ border: '1px solid #334155', borderRadius: 10, background: '#111827', padding: '10px 12px', display: 'grid', gap: 8 }}>
                        <div>
                          <div style={{ color: '#fff', fontWeight: 700 }}>{c.name}</div>
                          <small className="muted">{c.email || 'No email on file'}</small>
                        </div>
                        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
                          <select disabled={!canManageHierarchy} value={assignParentByChild?.[c.key] || ''} onChange={(e) => setAssignParentByChild((p) => ({ ...p, [c.key]: e.target.value }))} style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 8px', minWidth: 220 }}>
                            <option value="">Assign under...</option>
                            {(filteredParentOptions || []).map((o) => (
                              <option key={o.key} value={o.key}>{o.name}{o.email ? ` (${o.email})` : ''}</option>
                            ))}
                          </select>
                          <button type="button" className="publicPrimaryBtn" disabled={!canManageHierarchy || !assignParentByChild?.[c.key] || assigningChildKey === c.key} onClick={() => assignTeamParent(c)}>
                            {assigningChildKey === c.key ? 'Assigning...' : 'Assign'}
                          </button>
                        </div>
                      </div>
                    ))}
                    {!(teamAdminData?.candidates || []).length ? <small className="muted">No unassigned members found right now.</small> : null}
                  </div>
                </div>

                <div style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', padding: 14 }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ color: '#fff' }}>Hierarchy Reassignment (Admin)</strong>
                    <small className="muted">Move member under a different upline</small>
                  </div>

                  <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    <input
                      value={moveSearch}
                      onChange={(e) => setMoveSearch(e.target.value)}
                      placeholder="Search member, email, or current upline..."
                      style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', minWidth: 260 }}
                    />
                    <input
                      value={moveParentSearch}
                      onChange={(e) => setMoveParentSearch(e.target.value)}
                      placeholder="Search move-to name/email..."
                      style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', minWidth: 240 }}
                    />
                    <small className="muted">Move-to options: {filteredMoveParentOptions.length}</small>
                    <select disabled={!canManageHierarchy} value={bulkParentKey} onChange={(e) => setBulkParentKey(e.target.value)} style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 8px', minWidth: 230 }}>
                      <option value="">Bulk move selected under...</option>
                      {(filteredMoveParentOptions || []).map((o) => (
                        <option key={`bulk-opt-${o.key}`} value={o.key}>{o.name}{o.email ? ` (${o.email})` : ''}</option>
                      ))}
                    </select>
                    <button type="button" className="publicPrimaryBtn" disabled={!canManageHierarchy || !bulkParentKey || bulkMoving || !Object.values(bulkMoveMap || {}).some(Boolean)} onClick={bulkMoveSelected}>
                      {bulkMoving ? 'Bulk Moving...' : 'Bulk Move Selected'}
                    </button>
                    <button type="button" className="ghost" disabled={!canManageHierarchy || bulkRemoving || !Object.values(bulkMoveMap || {}).some(Boolean)} onClick={bulkRemoveSelected}>
                      {bulkRemoving ? 'Bulk Removing...' : 'Bulk Remove Selected'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {(filteredTeamManageRows || []).slice(0, 60).map((r) => {
                      const childKey = clean(r?.childKey || '');
                      const currentParentKey = clean(r?.parentKey || '');
                      const selectedParent = clean(assignParentByChild?.[childKey] || currentParentKey);
                      return (
                        <div key={`mv-${r.id}`} style={{ border: '1px solid #334155', borderRadius: 10, background: '#111827', padding: '10px 12px', display: 'grid', gap: 8 }}>
                          <div className="panelRow" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ color: '#fff', fontWeight: 700 }}>{r?.childName || 'Member'}</div>
                              <small className="muted">Current upline: {r?.parentLabel || 'Unassigned'}</small>
                            </div>
                            <label className="panelRow" style={{ gap: 6, color: '#cbd5e1', fontSize: 12 }}>
                              <input type="checkbox" disabled={!canManageHierarchy} checked={Boolean(bulkMoveMap?.[childKey])} onChange={(e) => setBulkMoveMap((p) => ({ ...p, [childKey]: e.target.checked }))} />
                              Select
                            </label>
                          </div>
                          <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
                            <select disabled={!canManageHierarchy} value={selectedParent} onChange={(e) => setAssignParentByChild((p) => ({ ...p, [childKey]: e.target.value }))} style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 8px', minWidth: 220 }}>
                              {(filteredMoveParentOptions || []).map((o) => (
                                <option key={`mv-opt-${r.id}-${o.key}`} value={o.key} disabled={clean(o?.key) === childKey}>{o.name}{o.email ? ` (${o.email})` : ''}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="publicPrimaryBtn"
                              disabled={!canManageHierarchy || !selectedParent || selectedParent === currentParentKey || selectedParent === childKey || assigningChildKey === childKey}
                              onClick={() => assignTeamParent({ childKey, childName: r?.childName, childEmail: r?.childEmail }, 'admin_reassign')}
                            >
                              {assigningChildKey === childKey ? 'Moving...' : 'Move'}
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              disabled={!canManageHierarchy || removingChildKey === childKey}
                              onClick={() => removeTeamLink(r)}
                            >
                              {removingChildKey === childKey ? 'Removing...' : 'Remove'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {!(filteredTeamManageRows || []).length ? <small className="muted">No matching members found.</small> : null}
                  </div>

                  <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#111827', padding: '10px 12px', marginTop: 10 }}>
                    <div className="panelRow" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ color: '#fff', fontSize: 13 }}>Recent Moves</strong>
                      <button type="button" className="ghost" disabled={!canManageHierarchy || undoingMove || !(recentReassignments || []).some((r) => parseMoveNote(r?.note))} onClick={undoLastMove}>
                        {undoingMove ? 'Undoing...' : 'Undo Last Move'}
                      </button>
                    </div>
                    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                      {(recentReassignments || []).map((r) => (
                        <small key={`audit-${r.id}-${r.updatedAt}`} className="muted">
                          {r?.childName || 'Member'} → {r?.parentLabel || 'Upline'} ({r?.updatedAt ? new Date(r.updatedAt).toLocaleString() : 'just now'})
                        </small>
                      ))}
                      {!(recentReassignments || []).length ? <small className="muted">No recent moves yet.</small> : null}
                    </div>
                  </div>
                </div>
                </>
                ) : null}

              </div>
            ) : null}

            {tab === 'community' ? (
              <CommunityServiceTab member={member} hubMembers={hubMembers} isAdmin={canManageHierarchy} />
            ) : null}

            {tab === 'tools' ? (
              <LinkBlendBuilderTab member={member} />
            ) : null}

            {tab === 'contracts' ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', padding: 14 }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ color: '#fff' }}>Contract Queue (Signed vs Pending)</strong>
                    <button type="button" className="ghost" onClick={loadStartIntakeQueue} disabled={startIntakeLoading}>
                      {startIntakeLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>
                  <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    <input
                      value={startIntakeSearch}
                      onChange={(e) => setStartIntakeSearch(e.target.value)}
                      placeholder="Search name, email, phone..."
                      style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', minWidth: 260 }}
                    />
                    <button type="button" className={startIntakeFilter === 'all' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setStartIntakeFilter('all')}>All</button>
                    <button type="button" className={startIntakeFilter === 'pending' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setStartIntakeFilter('pending')}>Pending</button>
                    <button type="button" className={startIntakeFilter === 'signed' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setStartIntakeFilter('signed')}>Signed</button>
                    <span className="pill neutral">Visible: {filteredStartIntakeRows.length}</span>
                    <span className="pill onpace">Signed: {(startIntakeRows || []).filter((r) => clean(r?.contractStatus).toLowerCase() === 'signed').length}</span>
                    <span className="pill atrisk">Pending: {(startIntakeRows || []).filter((r) => clean(r?.contractStatus).toLowerCase() !== 'signed').length}</span>
                  </div>
                  {startIntakeNotice ? <small className="muted" style={{ color: '#93c5fd', marginTop: 8, display: 'block' }}>{startIntakeNotice}</small> : null}
                </div>

                <div style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', padding: 12, display: 'grid', gap: 8 }}>
                  {(filteredStartIntakeRows || []).slice(0, 200).map((r) => {
                    const fullName = clean(`${r?.firstName || ''} ${r?.lastName || ''}`) || 'Member';
                    const signed = clean(r?.contractStatus || '').toLowerCase() === 'signed';
                    return (
                      <div key={`start-row-${r?.id || r?.email}`} style={{ border: '1px solid #334155', borderRadius: 10, background: '#111827', padding: '10px 12px', display: 'grid', gap: 8 }}>
                        <div className="panelRow" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ color: '#fff', fontWeight: 700 }}>{fullName}</div>
                            <small className="muted">{clean(r?.email || '—')} • {clean(r?.phone || '—')} • {clean(r?.trackType || '—')}</small>
                          </div>
                          <span className={`pill ${signed ? 'onpace' : 'atrisk'}`}>{signed ? 'Signed' : 'Pending'}</span>
                        </div>
                        <small className="muted">Signed At: {r?.contractSignedAt ? new Date(r.contractSignedAt).toLocaleString() : '—'} {r?.contractOverrideAt ? `• Last override: ${new Date(r.contractOverrideAt).toLocaleString()}` : ''}</small>
                        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" className="publicPrimaryBtn" onClick={() => markStartIntakeContract(r, true)}>Mark Signed</button>
                          <button type="button" className="ghost" onClick={() => markStartIntakeContract(r, false)}>Mark Pending</button>
                          <button type="button" className="ghost" onClick={() => checkStartIntakeSignature(r)} disabled={startIntakeCheckingId === clean(r?.id || r?.email || '')}>
                            {startIntakeCheckingId === clean(r?.id || r?.email || '') ? 'Checking...' : 'Check Signature Log'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!(filteredStartIntakeRows || []).length ? <small className="muted">No matching rows.</small> : null}
                </div>
              </div>
            ) : null}

            {tab === 'production' ? (
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ border: '1px solid #5f4a23', borderRadius: 14, padding: 16, background: 'linear-gradient(135deg,#1f2937 0%,#0b1020 55%,#111827 100%)' }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <strong style={{ color: '#fff', fontSize: 17 }}>My Production Back Office</strong>
                    <small className="muted">Private view • only your personal production</small>
                  </div>
                  <p style={{ color: '#cbd5e1', margin: '8px 0 0' }}>Filter by policy type to quickly see flat-rate vs commission-based production.</p>
                </div>

                <div style={{ display: 'grid', gap: 10, border: '1px solid #243046', borderRadius: 14, background: '#0B1220', padding: 12 }}>
                  <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className={productionFilter === 'all' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setProductionFilter('all')}>All Policies</button>
                    <button type="button" className={productionFilter === 'sponsorship' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setProductionFilter('sponsorship')}>Sponsorship</button>
                    <button type="button" className={productionFilter === 'bonus' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setProductionFilter('bonus')}>Bonus</button>
                    <button type="button" className={productionFilter === 'regular' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setProductionFilter('regular')}>Regular</button>
                    <button type="button" className={productionFilter === 'inner circle' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setProductionFilter('inner circle')}>Inner Circle</button>
                    <button type="button" className={productionFilter === 'juvenile' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setProductionFilter('juvenile')}>Juvenile</button>
                  </div>
                  <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="button" className={productionWindow === 'month' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setProductionWindow('month')}>This Month</button>
                    <button type="button" className={productionWindow === 'lastMonth' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setProductionWindow('lastMonth')}>Last Month</button>
                    <button type="button" className={productionWindow === 'all' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setProductionWindow('all')}>All Time</button>
                    {productionFinancials.nextPayout ? <span className="pill neutral">Next Payout: {new Date(productionFinancials.nextPayout.expectedPayoutAt || productionFinancials.nextPayout.qualifiedAt).toLocaleDateString()} • ${Number(productionFinancials.nextPayout.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> : <span className="pill neutral">Next Payout: —</span>}
                    <span className="pill onpace">Paid Ratio: {productionFinancials.paidRatio}%</span>
                  </div>
                </div>

                <small className="muted" style={{ marginTop: -2 }}>Showing: {productionWindow === 'month' ? 'This Month' : productionWindow === 'lastMonth' ? 'Last Month' : 'All Time'} • {productionFilter === 'all' ? 'All Policy Types' : productionFilter}</small>

                <div style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', padding: 12 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className="pill neutral">Decision: Submitted App</span>
                    <span className="pill offpace">Skipped Apps: {skippedAppDecisions.length}</span>
                    <span className="pill onpace">Policy Payout: Every Friday</span>
                    <span className="pill neutral">Licensed Incentive: Monthly</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
                  <div style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', padding: 14 }}>
                    <div style={{ color: '#fff', fontWeight: 700 }}>Licensed Monthly Incentive Tracker</div>
                    <div style={{ color: '#CBD5E1', marginTop: 6, fontSize: 13 }}>$1 sponsorship approvals + $50 policy submissions from {monthShortFromKey(productionFinancials.previousMonthKey)} pay out around {productionFinancials.monthlyIncentivePayoutWindow}.</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      <span className="pill neutral">Sponsorship Submitted: {monthlyLicensedIncentive.submitted}</span>
                      <span className="pill offpace">Policy Submitted: {monthlyLicensedIncentive.appSubmitted}</span>
                      <span className="pill onpace">Est. Payout (1st-5th): ${monthlyLicensedIncentive.total}</span>
                    </div>
                  </div>

                  <div style={{ border: '1px solid #334155', borderRadius: 12, background: '#0B1220', padding: 12 }}>
                    <div style={{ color: '#fff', fontWeight: 700 }}>Weekly Approval Payout (Following Friday)</div>
                    <div style={{ color: '#CBD5E1', marginTop: 6, fontSize: 13 }}>F&G/NLG approvals are queued for payout the following Friday.</div>
                    <div style={{ color: '#94A3B8', marginTop: 4, fontSize: 12 }}>Cutoff: approvals logged by Thursday 11:59 PM CT roll into the next Friday cycle.</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      <span className="pill neutral">Next Friday: {productionFinancials.nextApprovalPayoutDate ? new Date(productionFinancials.nextApprovalPayoutDate).toLocaleDateString() : '—'}</span>
                      <span className="pill onpace">Est. Approval Payout: ${Number(productionFinancials.nextApprovalPayoutAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                </div>

                <div style={{ border: '1px solid #334155', borderRadius: 12, background: '#0B1220', padding: 12 }}>
                  <div style={{ color: '#fff', fontWeight: 700 }}>Points Rule</div>
                  <div style={{ color: '#CBD5E1', marginTop: 6, fontSize: 13 }}>Sponsorship approval = 1 point • F&G/NLG approval = 500 points.</div>
                  <div style={{ color: '#CBD5E1', marginTop: 4, fontSize: 13 }}>F&G/NLG submission = 50 points to the submitting agent (policy writer), even if the referrer is different.</div>
                </div>

                <div style={{ border: '1px solid #334155', borderRadius: 12, background: '#0B1220', padding: 12 }}>
                  <div style={{ color: '#fff', fontWeight: 700 }}>Monthly Points Rollover</div>
                  <div style={{ color: '#CBD5E1', marginTop: 6, fontSize: 13 }}>Points reset every month for leaderboard pacing, but previous month totals are always retained for history.</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <span className="pill onpace">This Month: {Number(productionFinancials.thisMonthPoints || 0).toLocaleString()}</span>
                    <span className="pill neutral">Last Month: {Number(productionFinancials.lastMonthPoints || 0).toLocaleString()}</span>
                    <span className="pill offpace">Lifetime: {Number(productionFinancials.lifetimePoints || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(productionFinancials.pointsHistory || []).map((m) => (
                      <span key={`pts-${m.key}`} className="pill neutral">{m.label}: {Number(m.points || 0).toLocaleString()}</span>
                    ))}
                  </div>
                  <button type="button" className="ghost" style={{ marginTop: 10 }} onClick={() => setPointsHistoryOpen(true)}>View Full Monthly History</button>
                </div>

                {pointsHistoryOpen ? (
                  <div role="dialog" aria-modal="true" onClick={() => setPointsHistoryOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.62)', zIndex: 80, display: 'grid', placeItems: 'center' }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 95vw)', maxHeight: '82vh', overflow: 'auto', background: '#0B1220', border: '1px solid #334155', borderRadius: 12, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <strong style={{ color: '#fff' }}>Full Monthly Points History</strong>
                        <button type="button" className="ghost" onClick={() => setPointsHistoryOpen(false)}>Close</button>
                      </div>
                      <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 6 }}>Points reset monthly for current leaderboard pacing, but all prior months are retained.</p>
                      <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                        {(productionFinancials.fullPointsHistory || []).map((m) => (
                          <div key={`full-pts-${m.key}`} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', background: '#0f172a' }}>
                            <span style={{ color: '#cbd5e1' }}>{m.key}</span>
                            <strong style={{ color: '#fff' }}>{Number(m.points || 0).toLocaleString()} pts</strong>
                          </div>
                        ))}
                        {!(productionFinancials.fullPointsHistory || []).length ? <small className="muted">No monthly history yet.</small> : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))' }}>
                  <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 14, background: '#111827', boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.25)' }}><small className="muted">Total Policies</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24, marginTop: 4 }}>{productionStats.count}</div></div>
                  <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 14, background: '#111827', boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.25)' }}><small className="muted">Points Earned</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24, marginTop: 4 }}>{productionStats.points.toFixed(2)}</div></div>
                  <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 14, background: '#111827', boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.25)' }}><small className="muted">Advance Payout</small><div style={{ color: '#86efac', fontWeight: 800, fontSize: 24, marginTop: 4 }}>${productionStats.advance.toFixed(2)}</div></div>
                  <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 14, background: '#111827', boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.25)' }}><small className="muted">Deferred Balance</small><div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 24, marginTop: 4 }}>${productionStats.remaining.toFixed(2)}</div></div>
                  <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 14, background: '#111827', boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.25)' }}><small className="muted">Approval Rate</small><div style={{ color: '#fff', fontWeight: 800, fontSize: 24, marginTop: 4 }}>{productionStats.approvalRate}%</div></div>
                </div>

                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
                  <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                    <strong style={{ color: '#fff' }}>Policy Type Breakdown</strong>
                    <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                      <div style={{ border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', background: '#0b1220', color: '#e2e8f0' }}>Sponsorship Policies: <strong style={{ color: '#f8fafc' }}>{productionByType.sponsorship}</strong> <small className="muted">(flat 500 pts to referrer)</small></div>
                      <div style={{ border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', background: '#0b1220', color: '#e2e8f0' }}>Bonus Policies: <strong style={{ color: '#f8fafc' }}>{productionByType.bonus}</strong> <small className="muted">(flat 500 pts licensed only)</small></div>
                      <div style={{ border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', background: '#0b1220', color: '#e2e8f0' }}>Inner Circle Policies: <strong style={{ color: '#f8fafc' }}>{productionByType.innerCircle}</strong> <small className="muted">(flat 1,200 pts / $1,200)</small></div>
                      <div style={{ border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', background: '#0b1220', color: '#e2e8f0' }}>Regular Policies: <strong style={{ color: '#f8fafc' }}>{productionByType.regular}</strong> <small className="muted">(70% commission model)</small></div>
                      <div style={{ border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', background: '#0b1220', color: '#e2e8f0' }}>Juvenile Policies: <strong style={{ color: '#f8fafc' }}>{productionByType.juvenile}</strong> <small className="muted">(50% commission model)</small></div>
                    </div>
                  </div>

                  <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                    <strong style={{ color: '#fff' }}>Payout Structure Snapshot</strong>
                    <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                      <div style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 8, padding: 10 }}>
                        <small className="muted">Advance (75%)</small>
                        <div style={{ height: 10, background: '#1f2937', borderRadius: 8, marginTop: 6 }}><div style={{ width: '75%', height: '100%', background: 'linear-gradient(90deg,#22c55e,#16a34a)', borderRadius: 8 }} /></div>
                      </div>
                      <div style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 8, padding: 10 }}>
                        <small className="muted">Deferred (Months 10/11/12)</small>
                        <div style={{ height: 10, background: '#1f2937', borderRadius: 8, marginTop: 6 }}><div style={{ width: '25%', height: '100%', background: 'linear-gradient(90deg,#c8a96b,#a78647)', borderRadius: 8 }} /></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 14, padding: 14, background: '#020617' }}>
                  <strong style={{ color: '#fff' }}>Policy Activity Table</strong>
                  <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                    {filteredProductionRows.slice(0, 30).map((row) => {
                      const typeLabel = normalizePolicyTypeLabel(row?.policyType || row?.appType || 'Policy');
                      const typeNorm = clean(typeLabel).toLowerCase();
                      const isInner = typeNorm.includes('inner circle');
                      const isSponsorship = typeNorm.includes('sponsorship');
                      const approved = isApprovedStatus(row?.status || '');
                      const fgApproved = approved && isFgNlgRow(row);
                      const commissionPct = Math.round((Number(row?.commissionRate || 0) || 0) * 100);
                      const points = Number((row?.__effectivePoints ?? computeEffectivePoints(row)) || 0);
                      const advance = Number((row?.__effectiveAdvance ?? computeEffectiveAdvance(row, points)) || 0);

                      return (
                        <div
                          key={row?.id}
                          style={{
                            border: fgApproved ? '1px solid #22c55e' : '1px solid #334155',
                            boxShadow: fgApproved ? '0 0 0 1px rgba(34,197,94,0.28), 0 0 20px rgba(34,197,94,0.16)' : 'none',
                            borderRadius: 12,
                            padding: 12,
                            background: fgApproved ? 'linear-gradient(180deg,#0b1620 0%,#0b1220 100%)' : '#0b1220'
                          }}
                        >
                          <div style={{ color: '#f8fafc', fontWeight: 700, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                            <span>{row?.applicantName || 'Applicant'} • {typeLabel}</span>
                            {isSponsorship ? (
                              <span className="pill" style={{ background: '#064e3b', color: '#d1fae5', border: '1px solid #10b981' }}>Sponsorship</span>
                            ) : null}
                            {isInner ? (
                              <span className="pill" style={{ background: '#1e3a8a', color: '#dbeafe', border: '1px solid #3b82f6' }}>Inner Circle</span>
                            ) : null}
                            <span className={`pill ${fgApproved ? 'onpace' : (approved ? 'neutral' : 'atrisk')}`}>{approved ? 'Approved' : (row?.status || 'Submitted')}</span>
                            <span className="pill neutral">Decision: Submitted App</span>
                            {isFgNlgRow(row) && !approved ? (
                              <span className={`pill ${row?.__ownerIsSubmitter ? 'onpace' : 'neutral'}`}>
                                {row?.__ownerIsSubmitter ? 'Submission Credit: +50 (You submitted)' : 'Submission Credit: 0 (Referrer view)'}
                              </span>
                            ) : null}
                          </div>
                          <div style={{ color: '#cbd5e1', fontSize: 12, marginTop: 6 }}>
                            Commission: <strong style={{ color: '#f8fafc' }}>{commissionPct}%</strong> • Points: <strong style={{ color: '#f8fafc' }}>{points.toFixed(2)}</strong> • Advance: <strong style={{ color: '#86efac' }}>${advance.toFixed(2)}</strong>
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 3 }}>
                            Remaining: ${Number(row?.remainingBalance || 0).toFixed(2)} • M10: ${Number(row?.month10Payout || 0).toFixed(2)} • M11: ${Number(row?.month11Payout || 0).toFixed(2)} • M12: ${Number(row?.month12Payout || 0).toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                    {!filteredProductionRows.length ? <small className="muted">No personal production records for this filter yet.</small> : null}
                    {skippedAppDecisions.length ? (
                      <div style={{ marginTop: 8, border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#0b1220' }}>
                        <strong style={{ color: '#fff' }}>Skipped App Decisions (No Production Credit)</strong>
                        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                          {skippedAppDecisions.slice(0, 8).map((r) => (
                            <div key={`skip-${r?.id || r?.createdAt}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                              <span style={{ color: '#CBD5E1' }}>{r?.applicantName || 'Applicant'}</span>
                              <span className="pill offpace">Skipped App</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'rewards' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 12, background: '#071022' }}>
                  <strong style={{ color: '#fff' }}>Inner Circle Activity Rewards</strong>
                  <p style={{ color: '#cbd5e1', margin: '8px 0 0' }}>This is your live point system and leaderboard inside the Production Hub back office.</p>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, overflow: 'hidden', background: '#020617' }}>
                  <iframe
                    title="Inner Circle Activity Rewards"
                    src="/inner-circle-hub-rewards"
                    style={{ width: '100%', minHeight: '1200px', border: 0, background: '#020617' }}
                  />
                </div>
              </div>
            ) : null}

            {tab === 'academy' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 12, background: '#071022' }}>
                  <strong style={{ color: '#fff' }}>IUL Learning Academy</strong>
                  <p style={{ color: '#cbd5e1', margin: '8px 0 0' }}>Structured Beginner → Expert training with progress save and badge unlocks.</p>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, overflow: 'hidden', background: '#020617' }}>
                  <iframe
                    title="IUL Academy"
                    src={`/iul-learning-academy?name=${encodeURIComponent(member?.applicantName || member?.name || '')}&email=${encodeURIComponent(member?.email || '')}&licensed=1&v=20260315-3`}
                    style={{ width: '100%', minHeight: '1450px', border: 0, background: '#020617' }}
                  />
                </div>
              </div>
            ) : null}

            {tab === 'awards' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 12, background: '#071022' }}>
                  <strong style={{ color: '#fff' }}>Achievement Center</strong>
                  <p style={{ color: '#cbd5e1', margin: '8px 0 0' }}>Auto badge unlocks + progress tracking synced across Licensed and Inner Circle.</p>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, overflow: 'hidden', background: '#020617' }}>
                  <iframe
                    title="Achievement Center"
                    src={`/achievement-center?name=${encodeURIComponent(member?.applicantName || member?.name || '')}&email=${encodeURIComponent(member?.email || '')}&licensed=1`}
                    style={{ width: '100%', minHeight: '1350px', border: 0, background: '#020617' }}
                  />
                </div>
              </div>
            ) : null}

            {tab === 'links' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 12, background: '#071022' }}>
                  <strong style={{ color: '#fff' }}>Quick Access Links</strong>
                  <p style={{ color: '#cbd5e1', margin: '8px 0 0' }}>Use these core links in daily conversations and onboarding flow.</p>
                </div>

                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
                  <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617', display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 8 }}>
                    <strong style={{ color: '#fff' }}>Personal Sponsorship Link</strong>
                    <small className="muted" style={{ marginTop: -2 }}>Use this to share the sponsorship application with prospects.</small>
                    <img src={qrUrl(sponsorshipLink)} alt="Sponsorship QR" width={118} height={118} style={{ borderRadius: 8, border: '1px solid #334155', background: '#fff' }} />
                    <button type="button" className="ghost" onClick={() => copyLink(sponsorshipLink, 'sponsor')}>
                      {copiedKey === 'sponsor' ? 'Copied' : 'Copy Link'}
                    </button>
                  </div>

                  <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617', display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 8 }}>
                    <strong style={{ color: '#fff' }}>Personal Life Insurance Page</strong>
                    <small className="muted" style={{ marginTop: -2 }}>Share this direct page so prospects land on your personal quote flow.</small>
                    <img src={qrUrl(personalCoverageLink)} alt="Coverage QR" width={118} height={118} style={{ borderRadius: 8, border: '1px solid #334155', background: '#fff' }} />
                    <button type="button" className="ghost" onClick={() => copyLink(personalCoverageLink, 'coverage')}>
                      {copiedKey === 'coverage' ? 'Copied' : 'Copy Link'}
                    </button>
                  </div>

                  {contractLinks.map((item) => (
                    <div key={item.name} style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617', display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 8 }}>
                      <strong style={{ color: '#fff' }}>{item.name}</strong>
                      <img src={qrUrl(item.url)} alt={`${item.name} QR`} width={118} height={118} style={{ borderRadius: 8, border: '1px solid #334155', background: '#fff' }} />
                      <button type="button" className="ghost" onClick={() => copyLink(item.url, item.name)}>
                        {copiedKey === item.name ? 'Copied' : 'Copy Link'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {tab === 'library' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 12, background: '#071022' }}>
                  <strong style={{ color: '#fff' }}>PDF Library</strong>
                  <p style={{ color: '#cbd5e1', margin: '8px 0 0' }}>Training documents for onboarding, call execution, and pathway presentation. Legacy Link Pathways SOP unlocks after 10 sponsorship submissions.</p>
                </div>

                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
                  {vipPdfLinks.map((item) => {
                    const locked = Boolean(item?.locked);
                    return (
                      <div key={`lib-${item.name}`} title={locked ? 'Unlocks after 10 submitted sponsorship apps.' : ''} style={{ border: `1px solid ${locked ? '#475569' : '#1f2937'}`, borderRadius: 12, padding: 12, background: locked ? '#0f172a' : '#020617', display: 'grid', gap: 8, opacity: locked ? 0.72 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <strong style={{ color: '#fff' }}>{item.name}</strong>
                          {locked ? <span className="pill" style={{ background: '#374151', color: '#e5e7eb', border: '1px solid #6b7280' }}>Locked</span> : <span className="pill onpace">Unlocked</span>}
                        </div>

                        {locked ? (
                          <small className="muted">Unlocked at {Number(item?.unlockAt || 10)} submitted sponsorship apps ({Number(item?.current || 0)}/{Number(item?.unlockAt || 10)}).</small>
                        ) : (
                          <small className="muted">Ready to use.</small>
                        )}

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" className="ghost" disabled={locked} onClick={() => copyLink(item.url, item.name)}>
                            {locked ? `Unlock at ${Number(item?.unlockAt || 10)} Apps` : copiedKey === item.name ? 'Copied' : 'Copy PDF Link'}
                          </button>
                          <a href={item.url} target="_blank" rel="noreferrer" className="ghost" style={{ padding: '8px 12px', textDecoration: 'none', pointerEvents: locked ? 'none' : 'auto', opacity: locked ? 0.55 : 1 }}>
                            Open PDF
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {tab === 'dailydrive' ? (
              <DailyDrive email={member?.email || ''} tier="inner_circle" />
            ) : null}

            {tab === 'licensedstates' ? (() => {
              const ALL_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
              return (
                <div style={{ border: '1px solid #334155', borderRadius: 14, background: '#071022', padding: 18, display: 'grid', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 22, color: '#fff' }}>My Licensed States</h3>
                      <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 14 }}>Click states where you hold an active license. These update your lead eligibility.</p>
                    </div>
                    <span style={{ border: '1px solid #C8A96B', borderRadius: 999, padding: '4px 14px', color: '#C8A96B', fontWeight: 700, fontSize: 14 }}>
                      {licensedStates.length} selected
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 8 }}>
                    {ALL_STATES.map((code) => {
                      const selected = licensedStates.includes(code);
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => toggleLicensedState(code)}
                          style={{
                            padding: '10px 0',
                            borderRadius: 8,
                            border: '1.5px solid #C8A96B',
                            background: selected ? '#C8A96B' : '#1F2937',
                            color: selected ? '#0B1020' : '#C8A96B',
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: 'pointer',
                            transition: 'all .15s ease'
                          }}
                        >
                          {code}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={saveLicensedStates}
                      disabled={licensedStatesBusy}
                      style={{ padding: '12px 22px', borderRadius: 10, border: 0, background: '#C8A96B', color: '#0B1020', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}
                    >
                      {licensedStatesBusy ? 'Saving…' : 'Save My Licensed States'}
                    </button>
                    {licensedStatesMsg ? (
                      <span style={{ color: licensedStatesMsg.includes('✅') ? '#86EFAC' : '#FCA5A5', fontWeight: 600 }}>
                        {licensedStatesMsg}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })() : null}
          </div>
        )}
      </div>
      <style jsx global>{`
        .publicPrimaryBtn {
          background: linear-gradient(135deg, #c8a96b 0%, #a78647 100%) !important;
          color: #0b1020 !important;
          border: 1px solid #d6bd8d !important;
          font-weight: 700;
        }
        .publicPrimaryBtn:hover {
          filter: brightness(1.05);
        }
        .ghost {
          border-color: #5f4a23 !important;
          color: #f3e8d1 !important;
          background: rgba(17, 24, 39, 0.55) !important;
        }
        /* More menu: desktop shows dropdown, mobile shows slide-up */
        @media (min-width: 641px) {
          .more-slideup { display: none !important; }
        }
        @media (max-width: 640px) {
          .more-dropdown { display: none !important; }
        }
      `}</style>
    </main>
  );
}
