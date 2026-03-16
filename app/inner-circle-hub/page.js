'use client';

import { useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'inner_circle_hub_member_v1';

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

function normName(v = '') {
  return clean(v).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function nameSig(v = '') {
  const parts = normName(v).split(' ').filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]}_${parts[parts.length - 1]}`;
}
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
  const all = [
    { key: 'dashboard', label: 'The Lounge' },
    { key: 'faststart', label: 'Fast Start' },
    { key: 'scripts', label: 'Script Vault' },
    { key: 'execution', label: 'Daily Execution' },
    { key: 'vault', label: 'Resource Vault' },
    { key: 'tracker', label: 'KPI Tracker' },
    { key: 'production', label: 'My Production' },
    { key: 'team', label: 'Team Tree' },
    { key: 'rewards', label: 'VIP Rewards' },
    { key: 'academy', label: 'IUL Academy' },
    { key: 'awards', label: 'Achievement Center' },
    { key: 'links', label: 'My VIP Links' }
  ];
  return all.filter((t) => modules?.[t.key] !== false);
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
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetDone, setResetDone] = useState(false);

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
  const [onboardingDecisionRows, setOnboardingDecisionRows] = useState([]);
  const [teamHierarchyRows, setTeamHierarchyRows] = useState([]);
  const [teamExpanded, setTeamExpanded] = useState({});
  const [hubMembers, setHubMembers] = useState([]);
  const [assignParentByChild, setAssignParentByChild] = useState({});
  const [assigningChildKey, setAssigningChildKey] = useState('');
  const [productionFilter, setProductionFilter] = useState('all');
  const [productionWindow, setProductionWindow] = useState('month');
  const [pointsHistoryOpen, setPointsHistoryOpen] = useState(false);
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
  const [savingTracker, setSavingTracker] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  const gate = useMemo(() => onboardingState(member || {}), [member]);
  const unlocked = gate.active;
  const tabs = useMemo(() => availableTabs(member || {}), [member]);

  const filteredScripts = useMemo(() => {
    if (scriptFilter === 'all') return scripts;
    return (scripts || []).filter((s) => clean(s?.category).toLowerCase() === scriptFilter);
  }, [scripts, scriptFilter]);

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
        const submitted = toNum(r?.trackerTotals?.sponsorshipApps);
        const approved = toNum(r?.kpi?.sponsorshipApprovedThisMonth);
        const fng = toNum(r?.trackerTotals?.fngSubmittedApps);
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

      const licenseEvidence = (policyRows || [])
        .filter((p) => {
          const applicantName = normName(p?.applicantName || '');
          const applicantEmail = clean(p?.applicantEmail || '').toLowerCase();
          return (childEmail && applicantEmail && childEmail === applicantEmail) || (childNorm && applicantName === childNorm);
        })
        .sort((a, b) => rowTs(b) - rowTs(a));
      const latestLicenseRaw = clean(licenseEvidence[0]?.applicantLicensedStatus || licenseEvidence[0]?.agentLicensedStatus || '');
      const licenseTag = normalizeLicenseFlag(latestLicenseRaw);

      const submitted30 = activity.filter((a) => inDays(rowTs(a), 30)).length;
      const submitted7 = activity.filter((a) => inDays(rowTs(a), 7)).length;
      const latest = activity[0] || null;
      const latestType = latest ? normalizePolicyTypeLabel(latest?.policyType || latest?.appType || 'App') : 'No app yet';
      const descendants = countDescendants(clean(r?.childKey));
      const coachRating = Number(r?.rating || 0) || 0;

      const score = Math.min(100,
        (submitted30 * 15)
        + (submitted7 > 0 ? 20 : 0)
        + Math.min(20, descendants * 5)
        + (coachRating * 8)
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
        coachRating,
        score,
        momentumLabel,
        licenseTag
      };
    });

    return cards.sort((a, b) => b.score - a.score || b.submitted30 - a.submitted30 || a.childName.localeCompare(b.childName));
  }, [teamHierarchyRows, policyRows, member?.applicantName, member?.name, member?.email]);

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

    const options = Array.from(parentMap.values()).sort((a, b) => clean(a?.name).localeCompare(clean(b?.name)));

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
      const fgNlg = isFgNlgRow(r);
      const points = Number((r?.__effectivePoints ?? computeEffectivePoints(r)) || 0);
      const amount = Number((r?.__effectiveAdvance ?? computeEffectiveAdvance(r, points)) || 0);
      const expectedPayoutAt = clean(r?.payoutDueAt || (approved && fgNlg ? followingWeekFridayIso(approvedAt || submittedAt) : (approvedAt ? new Date(new Date(approvedAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : '')));
      return {
        id: clean(r?.id || `prod_${i}`),
        applicant: clean(r?.applicantName || 'Applicant'),
        policyType: clean(r?.policyType || r?.appType || ''),
        sourceType,
        status: paid ? 'paid' : 'pending',
        amount,
        points,
        approved,
        fgNlg,
        submittedAt,
        qualifiedAt: approvedAt,
        paidAt,
        expectedPayoutAt
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
    const thisMonthPending = events.filter((e) => e.status === 'pending' && isThisMonth(e.qualifiedAt || e.submittedAt)).reduce((a, e) => a + e.amount, 0);

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
    return [
      {
        name: 'Inner Circle Contract (IUL Agreement)',
        url: toAbsoluteLink(process.env.NEXT_PUBLIC_DOCUSIGN_IUL_ICA_URL || '/iul-agreement')
      },
      {
        name: 'Contract Agreement Page',
        url: toAbsoluteLink('/contract-agreement')
      }
    ];
  }, [siteBase, toAbsoluteLink]);

  const vipPdfLinks = useMemo(() => {
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
      }
    ];
  }, [toAbsoluteLink]);

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

        const [kpiRes, dailyRes, scriptsRes, vaultRes, activityRes, progressRes, policiesRes, onboardingRes, teamRes, membersRes] = await Promise.all([
          fetch(kpiUrl, { cache: 'no-store' }),
          fetch(dailyUrl, { cache: 'no-store' }),
          fetch('/api/inner-circle-hub-scripts', { cache: 'no-store' }),
          fetch('/api/inner-circle-hub-vault', { cache: 'no-store' }),
          fetch(activityUrl, { cache: 'no-store' }),
          fetch('/api/inner-circle-hub-progress', { cache: 'no-store' }),
          fetch('/api/policy-submissions', { cache: 'no-store' }),
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
        const onboardingData = await onboardingRes.json().catch(() => ({}));
        const teamData = await teamRes.json().catch(() => ({}));
        const membersData = await membersRes.json().catch(() => ({}));

        if (!canceled && kpiRes.ok && kpiData?.ok) setKpi(kpiData.kpi || null);
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

  useEffect(() => {
    if (typeof window === 'undefined' || member) return;
    const params = new URLSearchParams(window.location.search || '');
    const token = clean(params.get('reset'));
    const mail = clean(params.get('email'));
    if (token) {
      setForgotMode(true);
      setResetToken(token);
      if (mail) setEmail(mail);
    }
  }, [member]);

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
    e.preventDefault();
    setError('');
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
        setError(reason === 'onboarding_locked' ? 'Your hub is not active yet. Complete contract + payment + password setup with your advisor.' : 'Invalid login. Check email/password.');
        return;
      }
      setMember(data.member);
      localStorage.setItem(SESSION_KEY, JSON.stringify(data.member));
    } finally {
      setLoading(false);
    }
  }

  async function requestPasswordReset(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setForgotSent(false);
    try {
      await fetch('/api/inner-circle-hub-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_password_reset', email, origin: window?.location?.origin || '' })
      });
      setForgotSent(true);
    } catch {
      setError('Could not send reset email right now. Try again in a minute.');
    } finally {
      setLoading(false);
    }
  }

  async function submitPasswordReset(e) {
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

    setLoading(true);
    try {
      const res = await fetch('/api/inner-circle-hub-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_password', email, token: resetToken, password: newPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError('Reset link is invalid or expired. Tap Forgot Password to request a new one.');
        return;
      }
      setResetDone(true);
      setForgotMode(false);
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setMember(null);
    localStorage.removeItem(SESSION_KEY);
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

  async function saveTeamRating(row = {}, rating = 0) {
    const id = clean(row?.id || '');
    if (!id) return;
    const nextRating = Number(rating || 0) || 0;
    setTeamHierarchyRows((prev) => (Array.isArray(prev) ? prev.map((r) => clean(r?.id) === id ? { ...r, rating: nextRating } : r) : prev));
    await fetch('/api/team-hierarchy', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, rating: nextRating })
    }).catch(() => null);
  }

  async function assignTeamParent(candidate = {}, source = 'admin_manual_assign') {
    const childKey = clean(candidate?.key || candidate?.childKey || '');
    const parentKey = clean(assignParentByChild?.[childKey] || '');
    if (!childKey || !parentKey) return;
    const parent = (teamAdminData?.options || []).find((o) => clean(o?.key) === parentKey);
    if (!parent) return;

    setAssigningChildKey(childKey);
    try {
      await fetch('/api/team-hierarchy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: parent?.name || '',
          parentEmail: parent?.email || '',
          childName: candidate?.name || candidate?.childName || '',
          childEmail: candidate?.email || candidate?.childEmail || '',
          source
        })
      });

      const teamUrl = `/api/team-hierarchy?viewerName=${encodeURIComponent(member?.applicantName || member?.name || '')}&viewerEmail=${encodeURIComponent(member?.email || '')}`;
      const res = await fetch(teamUrl, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) setTeamHierarchyRows(Array.isArray(data?.rows) ? data.rows : []);
    } finally {
      setAssigningChildKey('');
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
          {!forgotMode ? (
            <form onSubmit={login} className="settingsGrid" style={{ rowGap: 12 }}>
              <label style={{ color: '#e2e8f0' }}>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} /></label>
              <label style={{ color: '#e2e8f0' }}>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} /></label>
              <button type="submit" className="publicPrimaryBtn" disabled={loading}>{loading ? 'Signing in...' : 'Enter Hub'}</button>
              <button type="button" className="ghost" onClick={() => { setForgotMode(true); setError(''); setForgotSent(false); setResetDone(false); }}>
                Forgot Password?
              </button>
              {resetDone ? <p style={{ marginTop: 4, color: '#86efac' }}>Password updated. You can now sign in with your new password.</p> : null}
              {error ? <p className="red" style={{ marginTop: 4 }}>{error}</p> : null}
            </form>
          ) : (
            <form onSubmit={resetToken ? submitPasswordReset : requestPasswordReset} className="settingsGrid" style={{ rowGap: 12 }}>
              <label style={{ color: '#e2e8f0' }}>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} /></label>

              {resetToken ? (
                <>
                  <label style={{ color: '#e2e8f0' }}>New Password<input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} /></label>
                  <label style={{ color: '#e2e8f0' }}>Confirm Password<input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" required style={{ color: '#e5e7eb', background: '#0b1220', borderColor: '#334155' }} /></label>
                  <button type="submit" className="publicPrimaryBtn" disabled={loading}>{loading ? 'Updating...' : 'Set New Password'}</button>
                </>
              ) : (
                <>
                  <button type="submit" className="publicPrimaryBtn" disabled={loading}>{loading ? 'Sending...' : 'Email Reset Link'}</button>
                  <p className="muted" style={{ marginTop: 4 }}>We’ll send a secure reset link to your email.</p>
                  {forgotSent ? <p style={{ marginTop: 4, color: '#86efac' }}>Check your inbox for the reset email.</p> : null}
                </>
              )}

              <button type="button" className="ghost" onClick={() => { setForgotMode(false); setResetToken(''); setError(''); }}>
                Back to Login
              </button>
              {error ? <p className="red" style={{ marginTop: 4 }}>{error}</p> : null}
            </form>
          )}
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
          </div>
          <button type="button" className="ghost" onClick={logout}>Logout</button>
        </div>

        {!unlocked ? (
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
            <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
              {tabs.map((t) => <button key={t.key} type="button" className={tab === t.key ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTab(t.key)}>{t.label}</button>)}
            </div>

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
                          <div style={{ color: '#d1d5db', fontSize: 12, marginTop: 6 }}>Sponsorship Submitted {row.submitted} • Booked {row.bookings} • F&G Submitted {row.fng} • F&G Approved {row.completed} • Sponsorship Approved {row.approved}</div>
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
                  <small className="muted">Scoring: Sponsorship Submitted (1) • Booked (3) • F&G Submitted (10) • F&G Approved (500). Sponsorship Approved and Leads are tracked but not scored.</small>
                  <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                    {monthlyTopPerformers.map((row, idx) => (
                      <div key={`leader_${idx}_${row?.name || 'unknown'}`} style={{ border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', background: '#111827', color: '#e5e7eb' }}>
                        <span style={{ color: '#c8a96b', fontWeight: 800, marginRight: 8 }}>#{idx + 1}</span>
                        <strong style={{ color: '#f8fafc', fontWeight: 800 }}>{row?.name || 'Member'}</strong>
                        <span style={{ color: '#e2e8f0', fontWeight: 700 }}> • {row.points} pts • ${row.dollars}</span>
                        <div style={{ color: '#cbd5e1', fontSize: 12, marginTop: 4 }}>Sponsorship Submitted {row.submitted} • Booked {row.bookings} • F&G Submitted {row.fng} • F&G Approved {row.completed} • Sponsorship Approved {row.approved}</div>
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
                    <button type="button" className={activityType === 'fng' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setActivityType('fng')}>FNG Submitted ({activitySummary.fng || 0})</button>
                    <button type="button" className={activityType === 'completed' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setActivityType('completed')}>Application Approved ({activitySummary.completed || 0})</button>
                  </div>

                  <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <small className="muted">Legend:</small>
                    <span className="pill onpace">Booked</span>
                    <span className="pill" style={{ background: '#1e3a8a', color: '#dbeafe', border: '1px solid #1d4ed8' }}>Sponsorship</span>
                    <span className="pill offpace">FNG Submitted</span>
                    <span className="pill onpace">Application Approved</span>
                  </div>

                  <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                    {(filteredActivityRows || []).map((row, idx) => {
                      const toneClass = row?.type === 'booked' || row?.type === 'completed'
                        ? 'onpace'
                        : row?.type === 'decision'
                          ? ''
                          : 'offpace';
                      const label = row?.type === 'booked'
                        ? 'Booked'
                        : row?.type === 'decision'
                          ? (row?.decision === 'declined' ? 'Declined' : 'Approved')
                          : row?.type === 'completed'
                            ? 'Application Approved'
                            : 'FNG Submitted';
                      const fngHref = `/inner-circle-app-submit?name=${encodeURIComponent(row?.name || '')}&email=${encodeURIComponent(row?.email || '')}&phone=${encodeURIComponent(row?.phone || '')}&referredBy=${encodeURIComponent(member?.applicantName || '')}`;
                      return (
                        <div key={`${row?.type}_${row?.name}_${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 8, border: row?.type === 'booked' ? '1px solid #22c55e' : '1px solid #1f2937', boxShadow: row?.type === 'booked' ? '0 0 0 1px rgba(34,197,94,0.25), 0 0 14px rgba(34,197,94,0.20)' : 'none', borderRadius: 8, padding: '8px 10px', background: '#030a17' }}>
                          {row?.type === 'decision' ? (
                            <span className="pill" style={{ background: '#1e3a8a', color: '#dbeafe', border: '1px solid #1d4ed8' }}>{label}</span>
                          ) : (
                            <span className={`pill ${toneClass}`}>{label}</span>
                          )}
                          <div style={{ color: '#e2e8f0', fontSize: 14, flex: 1 }}>{row?.name || 'Unknown'}</div>
                          {row?.showFngButton ? (
                            <a href={fngHref} className="ghost" style={{ textDecoration: 'none', marginLeft: 'auto', fontSize: 12 }}>Submit App</a>
                          ) : null}
                        </div>
                      );
                    })}
                    {!filteredActivityRows.length ? <small className="muted">No activity yet.</small> : null}
                  </div>
                </div>
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

            {tab === 'tracker' ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 14, background: '#020617' }}>
  
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 16 }}>
                  <div style={{ border: '1px solid #2A3142', borderRadius: 16, background: 'rgba(168, 85, 247, 0.14)', padding: 20, minHeight: 150 }}>
                    <div style={{ color: '#C4B5FD', fontSize: 14, marginBottom: 8 }}>All-Time Paid</div>
                    <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.08 }}>${productionFinancials.allTimePaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div style={{ border: '1px solid #2A3142', borderRadius: 16, background: 'rgba(245, 158, 11, 0.14)', padding: 20, minHeight: 150 }}>
                    <div style={{ color: '#FCD34D', fontSize: 14, marginBottom: 8 }}>All-Time Pending</div>
                    <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.08 }}>${productionFinancials.allTimePending.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div style={{ border: '1px solid #2A3142', borderRadius: 16, background: 'rgba(34, 197, 94, 0.14)', padding: 20, minHeight: 150 }}>
                    <div style={{ color: '#86EFAC', fontSize: 14, marginBottom: 8 }}>This Month Paid</div>
                    <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.08 }}>${productionFinancials.thisMonthPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div style={{ border: '1px solid #2A3142', borderRadius: 16, background: 'rgba(59, 130, 246, 0.14)', padding: 20, minHeight: 150 }}>
                    <div style={{ color: '#93C5FD', fontSize: 14, marginBottom: 8 }}>This Month Pending</div>
                    <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.08 }}>${productionFinancials.thisMonthPending.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                </div>

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
                    <label style={{ color: '#dbeafe', fontWeight: 600 }}>FNG Submitted (Auto)<input type="number" min="0" value={periodTotals.fngSubmittedApps} disabled readOnly style={{ background: '#111827', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px' }} /></label>
                  </div>
                  <button type="button" className="publicPrimaryBtn" onClick={saveTracker} disabled={savingTracker} style={{ marginTop: 10 }}>{savingTracker ? 'Saving...' : 'Save Daily Calls'}</button>
                </div>

                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
                  <strong style={{ color: '#fff' }}>{trackerPeriod === 'daily' ? 'Daily Totals' : trackerPeriod === 'weekly' ? 'Weekly Totals' : 'Monthly Totals'}</strong>
                  <p className="muted" style={{ marginBottom: 8 }}>
                    Calls: {periodTotals.calls} • Bookings: {periodTotals.bookings}
                  </p>
                  <p className="muted" style={{ marginTop: 0 }}>
                    Sponsorship Submitted: {periodTotals.sponsorshipApps} • Sponsorship Approved: {periodTotals.sponsorshipApproved} • FNG Submitted: {periodTotals.fngSubmittedApps} • App Total: {periodTotals.appsTotal}
                  </p>
                  <small className="muted">Entries Loaded: {dailyRows.length}</small>
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
                              <div style={{ color: '#fff', fontWeight: 700 }}>{card.childName}</div>
                              {card.licenseTag === 'licensed' ? <span className="pill" style={{ background: '#064e3b', color: '#d1fae5', border: '1px solid #10b981' }}>Licensed</span> : null}
                              {card.licenseTag === 'unlicensed' ? <span className="pill" style={{ background: '#7f1d1d', color: '#fee2e2', border: '1px solid #ef4444' }}>Unlicensed</span> : null}
                            </div>
                            <small className="muted">{card.childEmail || 'No email on file'}</small>
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
                          <label style={{ color: '#cbd5e1', fontSize: 12 }}>Coach Rating
                            <select value={Number(card.coachRating || 0)} onChange={(e) => saveTeamRating(card, Number(e.target.value || 0))} style={{ marginLeft: 8, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '6px 8px' }}>
                              <option value={0}>Unrated</option>
                              <option value={1}>1</option>
                              <option value={2}>2</option>
                              <option value={3}>3</option>
                              <option value={4}>4</option>
                              <option value={5}>5</option>
                            </select>
                          </label>
                          {children.length ? (
                            <button type="button" className="ghost" onClick={() => setTeamExpanded((p) => ({ ...p, [card.id]: !expanded }))}>
                              {expanded ? 'Hide Children' : `View Children (${children.length})`}
                            </button>
                          ) : null}
                        </div>

                        {expanded && children.length ? (
                          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                            {children.map((c) => (
                              <div key={c.id} style={{ border: '1px solid #334155', borderRadius: 10, background: '#111827', padding: '8px 10px', color: '#e2e8f0', fontSize: 13 }}>
                                {c?.childName || 'Member'}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {!teamCards.length ? <small className="muted">No team links yet. As referred apps are submitted, your team tree will populate automatically.</small> : null}
                </div>

                <div style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', padding: 14 }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ color: '#fff' }}>Unassigned Queue (Admin Assist)</strong>
                    <small className="muted">Assign members not yet linked under an upline</small>
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {(teamAdminData?.candidates || []).slice(0, 20).map((c) => (
                      <div key={c.key} style={{ border: '1px solid #334155', borderRadius: 10, background: '#111827', padding: '10px 12px', display: 'grid', gap: 8 }}>
                        <div>
                          <div style={{ color: '#fff', fontWeight: 700 }}>{c.name}</div>
                          <small className="muted">{c.email || 'No email on file'}</small>
                        </div>
                        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
                          <select value={assignParentByChild?.[c.key] || ''} onChange={(e) => setAssignParentByChild((p) => ({ ...p, [c.key]: e.target.value }))} style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 8px', minWidth: 220 }}>
                            <option value="">Assign under...</option>
                            {(teamAdminData?.options || []).map((o) => (
                              <option key={o.key} value={o.key}>{o.name}{o.email ? ` (${o.email})` : ''}</option>
                            ))}
                          </select>
                          <button type="button" className="publicPrimaryBtn" disabled={!assignParentByChild?.[c.key] || assigningChildKey === c.key} onClick={() => assignTeamParent(c)}>
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
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {(teamManageRows || []).slice(0, 40).map((r) => {
                      const childKey = clean(r?.childKey || '');
                      const currentParentKey = clean(r?.parentKey || '');
                      const selectedParent = clean(assignParentByChild?.[childKey] || currentParentKey);
                      return (
                        <div key={`mv-${r.id}`} style={{ border: '1px solid #334155', borderRadius: 10, background: '#111827', padding: '10px 12px', display: 'grid', gap: 8 }}>
                          <div>
                            <div style={{ color: '#fff', fontWeight: 700 }}>{r?.childName || 'Member'}</div>
                            <small className="muted">Current upline: {r?.parentLabel || 'Unassigned'}</small>
                          </div>
                          <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
                            <select value={selectedParent} onChange={(e) => setAssignParentByChild((p) => ({ ...p, [childKey]: e.target.value }))} style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 8px', minWidth: 220 }}>
                              {(teamAdminData?.options || []).map((o) => (
                                <option key={`mv-opt-${r.id}-${o.key}`} value={o.key} disabled={clean(o?.key) === childKey}>{o.name}{o.email ? ` (${o.email})` : ''}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="publicPrimaryBtn"
                              disabled={!selectedParent || selectedParent === currentParentKey || selectedParent === childKey || assigningChildKey === childKey}
                              onClick={() => assignTeamParent({ childKey, childName: r?.childName, childEmail: r?.childEmail }, 'admin_reassign')}
                            >
                              {assigningChildKey === childKey ? 'Moving...' : 'Move'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {!(teamManageRows || []).length ? <small className="muted">No assigned members found yet.</small> : null}
                  </div>
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
                    <div style={{ color: '#CBD5E1', marginTop: 6, fontSize: 13 }}>$1 sponsorship approvals + $50 F&G/NLG submissions from {monthShortFromKey(productionFinancials.previousMonthKey)} pay out around {productionFinancials.monthlyIncentivePayoutWindow}.</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      <span className="pill neutral">Sponsorship Submitted: {monthlyLicensedIncentive.submitted}</span>
                      <span className="pill offpace">Apps Submitted: {monthlyLicensedIncentive.appSubmitted}</span>
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
                  <strong style={{ color: '#fff' }}>Quick Access</strong>
                  <p style={{ color: '#cbd5e1', margin: '8px 0 0' }}>Use the links below to copy and share your key resources.</p>
                </div>

                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
                <div style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617', display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 8 }}>
                  <strong style={{ color: '#fff' }}>Personal Sponsorship Link</strong>
                  <img src={qrUrl(sponsorshipLink)} alt="Sponsorship QR" width={118} height={118} style={{ borderRadius: 8, border: '1px solid #334155', background: '#fff' }} />
                  <button type="button" className="ghost" onClick={() => copyLink(sponsorshipLink, 'sponsor')}>
                    {copiedKey === 'sponsor' ? 'Copied' : 'Copy Link'}
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

                {vipPdfLinks.map((item) => (
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
      `}</style>
    </main>
  );
}
