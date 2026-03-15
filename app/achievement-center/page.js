'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const MASTER_BADGES = [
  { id: 'identity_licensed', name: 'Licensed & Activated', description: 'Automatically unlocked when your licensed profile is active.', category: 'Performance', emoji: '🪪', badge_key: 'identity.licensed' },

  { id: 'performance_first_submission', name: 'First Victory', description: 'Submit your first policy (any status)', category: 'Performance', emoji: '🏅', badge_key: 'performance.first_submission' },
  { id: 'performance_first_policy', name: 'First Steps', description: 'Issue your very first policy', category: 'Performance', emoji: '🎯', badge_key: 'performance.first_policy' },
  { id: 'performance_policies_5', name: 'Getting Started', description: 'Issue 5 policies', category: 'Performance', emoji: '⭐', badge_key: 'performance.policies_5' },
  { id: 'performance_policies_10', name: 'Momentum Builder', description: 'Issue 10 policies', category: 'Performance', emoji: '🚀', badge_key: 'performance.policies_10' },
  { id: 'performance_strong_link', name: 'Strong Link', description: 'Prove consistency by issuing 10+ policies', category: 'Performance', emoji: '🔗', badge_key: 'performance.strong_link' },
  { id: 'performance_crm_learned', name: 'CRM Master', description: 'Learn the CRM system (SOP step)', category: 'Performance', emoji: '📊', badge_key: 'performance.crm_learned' },
  { id: 'performance_official_link', name: 'Official Link', description: 'Complete all 13 SOP steps and become certified', category: 'Performance', emoji: '✅', badge_key: 'performance.official_link' },

  { id: 'income_earnings_1k', name: '1K Starter', description: 'Earn $1,000 in commissions', category: 'Income', emoji: '💵', badge_key: 'income.earnings_1k' },
  { id: 'income_earnings_5k', name: '5K Builder', description: 'Earn $5,000 in commissions', category: 'Income', emoji: '💰', badge_key: 'income.earnings_5k' },
  { id: 'income_earnings_10k', name: '10K Earner', description: 'Earn $10,000 in commissions', category: 'Income', emoji: '💸', badge_key: 'income.earnings_10k' },
  { id: 'income_earnings_25k', name: '25K Milestone', description: 'Earn $25,000 in commissions', category: 'Income', emoji: '💎', badge_key: 'income.earnings_25k' },
  { id: 'income_earnings_50k', name: '50K Producer', description: 'Earn $50,000 in commissions', category: 'Income', emoji: '🏆', badge_key: 'income.earnings_50k' },
  { id: 'income_earnings_75k', name: '75K Producer', description: 'Earn $75,000 in commissions', category: 'Income', emoji: '🥇', badge_key: 'income.earnings_75k' },
  { id: 'income_earnings_100k', name: 'Six-Figure Earner', description: 'Achieve $100,000 in net income (after chargebacks)', category: 'Income', emoji: '💯', badge_key: 'income.earnings_100k' },

  { id: 'community_plugged_in', name: 'Plugged In', description: 'Join the Skool community (SOP step)', category: 'Community', emoji: '🔌', badge_key: 'community.plugged_in' },
  { id: 'community_first_service', name: 'I Served My Community', description: 'Complete your first community service submission', category: 'Community', emoji: '🌟', badge_key: 'community.first_service' },
  { id: 'community_service_5h', name: 'Community Helper', description: 'Complete 5 hours of community service', category: 'Community', emoji: '❤️', badge_key: 'community.service_5h' },
  { id: 'community_service_20h', name: 'Community Champion', description: 'Complete 20 hours of community service', category: 'Community', emoji: '🏅', badge_key: 'community.service_20h' },

  { id: 'team_team_10', name: 'Build a Team of 10', description: 'Reach a total downline size of 10', category: 'Team', emoji: '👥', badge_key: 'team.team_10' },
  { id: 'team_team_50', name: 'Build a Team of 50', description: 'Reach a total downline size of 50', category: 'Team', emoji: '👥', badge_key: 'team.team_50' },
  { id: 'team_team_100', name: 'Build a Team of 100', description: 'Reach a total downline size of 100', category: 'Team', emoji: '👥', badge_key: 'team.team_100' },

  { id: 'bonus_wheel_qualifier', name: 'Bonus Wheel Qualifier', description: '8+ issued policies in a month', category: 'Bonus', emoji: '🎰', badge_key: 'bonus.wheel_qualifier' },

  { id: 'seasonal_summer_surge', name: 'Summer Surge', description: 'Crush your summer activity goals', category: 'Seasonal', emoji: '🌞', badge_key: 'seasonal.summer_surge' },
  { id: 'seasonal_holiday_hero', name: 'Holiday Hero', description: 'Finish the year strong during the holidays', category: 'Seasonal', emoji: '🎄', badge_key: 'seasonal.holiday_hero' },
  { id: 'seasonal_new_year_starter', name: 'New Year Starter', description: 'Kick off the new year with momentum', category: 'Seasonal', emoji: '🎉', badge_key: 'seasonal.new_year_starter' },
  { id: 'seasonal_spring_surge', name: 'Spring Surge', description: 'Spring push to help more families', category: 'Seasonal', emoji: '🌸', badge_key: 'seasonal.spring_surge' },
  { id: 'seasonal_back_to_school', name: 'Back-to-School Push', description: 'Help families protect more during back-to-school season', category: 'Seasonal', emoji: '🎒', badge_key: 'seasonal.back_to_school' },
  { id: 'seasonal_fall_finish', name: 'Fall Finish Strong', description: 'Drive a strong close to Q4', category: 'Seasonal', emoji: '🍂', badge_key: 'seasonal.fall_finish' },
];

const CATEGORY_CONFIG = {
  Performance: { emoji: '🎯', color: '#3B82F6' },
  Income: { emoji: '💰', color: '#10B981' },
  Community: { emoji: '❤️', color: '#EC4899' },
  Team: { emoji: '👥', color: '#8B5CF6' },
  Bonus: { emoji: '🎁', color: '#F59E0B' },
  Seasonal: { emoji: '🌞', color: '#FACC15' },
};

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase(); }
function toNum(v = 0) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function normName(v = '') {
  return normalize(v).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function nameSig(v = '') {
  const parts = normName(v).split(' ').filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]}_${parts[parts.length - 1]}`;
}

function monthKeyFromIso(iso = '') {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isIssuedStatus(status = '') {
  const s = normalize(status);
  return s.includes('issued') || s.includes('approved');
}

function isPaidRow(row = {}) {
  const payout = normalize(row?.payoutStatus || '');
  return payout.includes('paid') || Boolean(clean(row?.payoutPaidAt || ''));
}

const UNLOCK_RULES = [
  { badge_key: 'identity.licensed', check: (s) => s.isLicensed === true },
  { badge_key: 'performance.first_submission', check: (s) => s.policiesSubmitted >= 1 },
  { badge_key: 'performance.first_policy', check: (s) => s.policiesIssued >= 1 },
  { badge_key: 'performance.policies_5', check: (s) => s.policiesIssued >= 5 },
  { badge_key: 'performance.policies_10', check: (s) => s.policiesIssued >= 10 },
  { badge_key: 'performance.strong_link', check: (s) => s.policiesIssued >= 10 },
  { badge_key: 'performance.crm_learned', check: (s) => s.sopStepsCompleted >= 1 },
  { badge_key: 'performance.official_link', check: (s) => s.sopStepsCompleted >= 13 },

  { badge_key: 'income.earnings_1k', check: (s) => s.lifetimeEarnings >= 1000 },
  { badge_key: 'income.earnings_5k', check: (s) => s.lifetimeEarnings >= 5000 },
  { badge_key: 'income.earnings_10k', check: (s) => s.lifetimeEarnings >= 10000 },
  { badge_key: 'income.earnings_25k', check: (s) => s.lifetimeEarnings >= 25000 },
  { badge_key: 'income.earnings_50k', check: (s) => s.lifetimeEarnings >= 50000 },
  { badge_key: 'income.earnings_75k', check: (s) => s.lifetimeEarnings >= 75000 },
  { badge_key: 'income.earnings_100k', check: (s) => s.lifetimeNetIncome >= 100000 },

  { badge_key: 'community.plugged_in', check: (s) => s.joinedSkool === true },
  { badge_key: 'community.first_service', check: (s) => s.communityServicesApproved >= 1 },
  { badge_key: 'community.service_5h', check: (s) => s.communityServiceHours >= 5 },
  { badge_key: 'community.service_20h', check: (s) => s.communityServiceHours >= 20 },

  { badge_key: 'team.team_10', check: (s) => s.downlineCount >= 10 },
  { badge_key: 'team.team_50', check: (s) => s.downlineCount >= 50 },
  { badge_key: 'team.team_100', check: (s) => s.downlineCount >= 100 },

  { badge_key: 'bonus.wheel_qualifier', check: (s) => s.policiesIssuedThisMonth >= 8 },

  { badge_key: 'seasonal.summer_surge', check: () => false },
  { badge_key: 'seasonal.holiday_hero', check: () => false },
  { badge_key: 'seasonal.new_year_starter', check: () => false },
  { badge_key: 'seasonal.spring_surge', check: () => false },
  { badge_key: 'seasonal.back_to_school', check: () => false },
  { badge_key: 'seasonal.fall_finish', check: () => false },
];

const PROGRESS_RULES = {
  'identity.licensed': { label: 'Licensed status', target: 1, value: (s) => (s.isLicensed ? 1 : 0), type: 'count' },

  'performance.first_submission': { label: 'Policies submitted', target: 1, value: (s) => s.policiesSubmitted || 0, type: 'count' },
  'performance.first_policy': { label: 'Policies issued', target: 1, value: (s) => s.policiesIssued || 0, type: 'count' },
  'performance.policies_5': { label: 'Policies issued', target: 5, value: (s) => s.policiesIssued || 0, type: 'count' },
  'performance.policies_10': { label: 'Policies issued', target: 10, value: (s) => s.policiesIssued || 0, type: 'count' },
  'performance.strong_link': { label: 'Policies issued', target: 10, value: (s) => s.policiesIssued || 0, type: 'count' },
  'performance.crm_learned': { label: 'SOP steps', target: 1, value: (s) => s.sopStepsCompleted || 0, type: 'count' },
  'performance.official_link': { label: 'SOP steps', target: 13, value: (s) => s.sopStepsCompleted || 0, type: 'count' },

  'income.earnings_1k': { label: 'Lifetime earnings', target: 1000, value: (s) => s.lifetimeEarnings || 0, type: 'money' },
  'income.earnings_5k': { label: 'Lifetime earnings', target: 5000, value: (s) => s.lifetimeEarnings || 0, type: 'money' },
  'income.earnings_10k': { label: 'Lifetime earnings', target: 10000, value: (s) => s.lifetimeEarnings || 0, type: 'money' },
  'income.earnings_25k': { label: 'Lifetime earnings', target: 25000, value: (s) => s.lifetimeEarnings || 0, type: 'money' },
  'income.earnings_50k': { label: 'Lifetime earnings', target: 50000, value: (s) => s.lifetimeEarnings || 0, type: 'money' },
  'income.earnings_75k': { label: 'Lifetime earnings', target: 75000, value: (s) => s.lifetimeEarnings || 0, type: 'money' },
  'income.earnings_100k': { label: 'Lifetime net income', target: 100000, value: (s) => s.lifetimeNetIncome || 0, type: 'money' },

  'community.plugged_in': { label: 'Skool joined', target: 1, value: (s) => (s.joinedSkool ? 1 : 0), type: 'count' },
  'community.first_service': { label: 'Service entries', target: 1, value: (s) => s.communityServicesApproved || 0, type: 'count' },
  'community.service_5h': { label: 'Service hours', target: 5, value: (s) => s.communityServiceHours || 0, type: 'count' },
  'community.service_20h': { label: 'Service hours', target: 20, value: (s) => s.communityServiceHours || 0, type: 'count' },

  'team.team_10': { label: 'Downline', target: 10, value: (s) => s.downlineCount || 0, type: 'count' },
  'team.team_50': { label: 'Downline', target: 50, value: (s) => s.downlineCount || 0, type: 'count' },
  'team.team_100': { label: 'Downline', target: 100, value: (s) => s.downlineCount || 0, type: 'count' },

  'bonus.wheel_qualifier': { label: 'Issued this month', target: 8, value: (s) => s.policiesIssuedThisMonth || 0, type: 'count' },
};

function fmtProgressValue(value = 0, type = 'count') {
  if (type === 'money') return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return String(Number(value || 0));
}

function progressForBadge(badgeKey = '', stats = {}) {
  const rule = PROGRESS_RULES[badgeKey];
  if (!rule) return { pct: 0, current: 0, target: 0, label: 'Manual unlock', type: 'count', manual: true };
  const current = Number(rule.value(stats) || 0);
  const target = Number(rule.target || 0);
  const pct = target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;
  return { pct, current, target, label: rule.label, type: rule.type, manual: false };
}


function BadgeCard({ badge, isUnlocked, isNew, progress }) {
  const color = CATEGORY_CONFIG[badge.category]?.color || '#64748b';
  const progressPct = Number(progress?.pct || 0);
  return (
    <div style={{
      border: isUnlocked ? `2px solid ${color}` : '1px solid #334155',
      borderRadius: 16,
      padding: 18,
      background: isUnlocked ? 'linear-gradient(180deg,#10223f,#0b1730)' : '#0b1220',
      boxShadow: isUnlocked ? `0 10px 26px ${color}33` : '0 4px 12px rgba(2,6,23,.25)',
      display: 'grid',
      gap: 8,
      placeItems: 'center',
      textAlign: 'center',
      position: 'relative',
      transform: isNew ? 'scale(1.02)' : 'scale(1)',
      transition: 'all .22s ease'
    }}>
      {isNew ? <span className="pill onpace" style={{ position: 'absolute', top: 8, right: 8 }}>NEW</span> : null}
      <div style={{ width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 32, background: isUnlocked ? '#0b1220' : '#111827' }}>
        {isUnlocked ? badge.emoji : '🔒'}
      </div>
      <div style={{ fontWeight: 800, color: isUnlocked ? '#F8FAFC' : '#CBD5E1' }}>{badge.name}</div>
      <div style={{ fontSize: 12, color: '#94A3B8', minHeight: 34 }}>{badge.description}</div>

      {!isUnlocked ? (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#93A3B8', marginBottom: 4 }}>
            <span>{progress?.manual ? 'Manual' : progress?.label}</span>
            {!progress?.manual ? <span>{fmtProgressValue(progress?.current, progress?.type)} / {fmtProgressValue(progress?.target, progress?.type)}</span> : <span>Admin only</span>}
          </div>
          <div style={{ height: 8, borderRadius: 999, background: '#1F2937', overflow: 'hidden' }}>
            <div style={{ width: `${progressPct}%`, height: '100%', background: `linear-gradient(90deg, ${color}, #60A5FA)`, transition: 'width .3s ease' }} />
          </div>
        </div>
      ) : null}

      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '4px 10px', borderRadius: 999, border: `1px solid ${isUnlocked ? color : '#475569'}`, color: isUnlocked ? '#fff' : '#94A3B8', fontSize: 12 }}>
        <span>{CATEGORY_CONFIG[badge.category]?.emoji}</span>
        <span>{badge.category}</span>
        {isUnlocked ? <span>✅</span> : null}
      </div>
    </div>
  );
}

function ConfettiBurst({ show = false }) {
  if (!show) return null;
  const pieces = Array.from({ length: 22 }).map((_, i) => ({
    left: `${5 + (i * 4.2)}%`,
    delay: `${(i % 6) * 0.06}s`,
    emoji: ['🎉','✨','🏅','💙','⭐'][i % 5]
  }));
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 120 }}>
      <style>{`@keyframes fallConfetti{0%{transform:translateY(-20px) scale(.8);opacity:0}12%{opacity:1}100%{transform:translateY(68vh) rotate(360deg);opacity:0}}`}</style>
      {pieces.map((p, idx) => (
        <span key={`cf-${idx}`} style={{ position: 'absolute', left: p.left, top: '-10px', fontSize: 20, animation: `fallConfetti 1.6s ease-out ${p.delay}` }}>{p.emoji}</span>
      ))}
    </div>
  );
}

export default function AchievementCenterPage() {
  const [identity, setIdentity] = useState({ name: '', email: '', isLicensed: false });
  const [policyRows, setPolicyRows] = useState([]);
  const [sponsorshipRows, setSponsorshipRows] = useState([]);
  const [storedUnlocked, setStoredUnlocked] = useState(new Set());
  const [manualUnlocked, setManualUnlocked] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [justUnlocked, setJustUnlocked] = useState([]);
  const [checking, setChecking] = useState(false);
  const [toast, setToast] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminManualKeys, setAdminManualKeys] = useState(new Set());
  const bootRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const qp = new URLSearchParams(window.location.search || '');
      setAdminMode(qp.get('admin') === '1');
    }

    let canceled = false;

    async function load() {
      setLoading(true);
      try {
        const localMember = typeof window !== 'undefined' ? JSON.parse(window.localStorage.getItem('inner_hub_member_v1') || 'null') : null;
        const token = typeof window !== 'undefined' ? clean(window.localStorage.getItem('licensed_backoffice_token') || '') : '';

        let licensedProfile = null;
        if (token) {
          const meRes = await fetch('/api/licensed-backoffice/auth/me', { headers: { Authorization: `Bearer ${token}` } });
          const meData = meRes.ok ? await meRes.json().catch(() => ({})) : {};
          if (meData?.ok && meData?.profile) licensedProfile = meData.profile;
        }

        const idName = clean(licensedProfile?.name || localMember?.applicantName || localMember?.name || '');
        const idEmail = clean(licensedProfile?.email || localMember?.email || '').toLowerCase();

        const [policyRes, sponsorRes, badgeRes] = await Promise.all([
          fetch('/api/policy-submissions', { cache: 'no-store' }),
          fetch('/api/sponsorship-applications', { cache: 'no-store' }),
          fetch(`/api/achievement-center?email=${encodeURIComponent(idEmail)}&name=${encodeURIComponent(idName)}`, { cache: 'no-store' })
        ]);

        const policyData = policyRes.ok ? await policyRes.json().catch(() => ({})) : {};
        const sponsorData = sponsorRes.ok ? await sponsorRes.json().catch(() => ({})) : {};
        const badgeData = badgeRes.ok ? await badgeRes.json().catch(() => ({})) : {};

        if (canceled) return;
        setIdentity({ name: idName, email: idEmail, isLicensed: Boolean(licensedProfile?.email) });
        setPolicyRows(Array.isArray(policyData?.rows) ? policyData.rows : []);
        setSponsorshipRows(Array.isArray(sponsorData?.rows) ? sponsorData.rows : []);
        setStoredUnlocked(new Set(Array.isArray(badgeData?.row?.unlockedKeys) ? badgeData.row.unlockedKeys : []));
        const manual = new Set(Array.isArray(badgeData?.row?.manualKeys) ? badgeData.row.manualKeys : []);
        setManualUnlocked(manual);
        setAdminManualKeys(new Set(manual));
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    load();
    return () => { canceled = true; };
  }, []);

  const stats = useMemo(() => {
    const name = identity.name;
    const email = identity.email;
    const sig = nameSig(name);
    const currentMonth = monthKeyFromIso(new Date().toISOString());

    const isMinePolicy = (r = {}) => {
      const nameCandidates = [r?.policyWriterName, r?.submittedBy, r?.referredByName, r?.referredBy, r?.agent, r?.agentName, r?.owner].map(clean).filter(Boolean);
      const emailCandidates = [r?.policyWriterEmail, r?.submittedByEmail, r?.agentEmail, r?.ownerEmail, r?.email].map((v) => normalize(v)).filter(Boolean);
      if (email && emailCandidates.some((e) => e === email)) return true;
      return nameCandidates.some((n) => nameSig(n) === sig || normName(n) === normName(name));
    };

    const minePolicies = (policyRows || []).filter(isMinePolicy);
    const policiesSubmitted = minePolicies.length;
    const issuedRows = minePolicies.filter((r) => isIssuedStatus(r?.status || ''));
    const policiesIssued = issuedRows.length;
    const policiesIssuedThisMonth = issuedRows.filter((r) => monthKeyFromIso(clean(r?.approvedAt || r?.updatedAt || r?.submittedAt || r?.createdAt || '')) === currentMonth).length;

    const lifetimeEarnings = minePolicies.filter((r) => isPaidRow(r)).reduce((a, r) => a + toNum(r?.advancePayout || r?.payoutAmount || 0), 0);

    const isMineSponsorship = (r = {}) => {
      const refCandidates = [r?.referredBy, r?.referred_by, r?.referredByName, r?.agentName, r?.agent, r?.owner].map(clean).filter(Boolean);
      const emailCandidates = [r?.referredByEmail, r?.agentEmail, r?.ownerEmail, r?.email].map((v) => normalize(v)).filter(Boolean);
      if (email && emailCandidates.some((e) => e === email)) return true;
      return refCandidates.some((n) => nameSig(n) === sig || normName(n) === normName(name));
    };

    const mySponsorship = (sponsorshipRows || []).filter(isMineSponsorship);
    const downlineCount = new Set(mySponsorship.map((r) => `${normName(`${r?.firstName || ''} ${r?.lastName || ''}`)}|${normalize(r?.email || '')}`).filter(Boolean)).size;

    return {
      isLicensed: identity.isLicensed,
      policiesSubmitted,
      policiesIssued,
      policiesIssuedThisMonth,
      lifetimeEarnings,
      lifetimeNetIncome: lifetimeEarnings,
      sopStepsCompleted: 0,
      joinedSkool: false,
      communityServicesApproved: 0,
      communityServiceHours: 0,
      downlineCount,
    };
  }, [policyRows, sponsorshipRows, identity]);

  const autoUnlocked = useMemo(() => {
    const keys = [];
    for (const r of UNLOCK_RULES) {
      try { if (r.check(stats)) keys.push(r.badge_key); } catch {}
    }
    return new Set(keys);
  }, [stats]);

  const unlockedKeys = useMemo(() => new Set([...storedUnlocked, ...manualUnlocked, ...autoUnlocked]), [storedUnlocked, manualUnlocked, autoUnlocked]);

  const groupedBadges = useMemo(() => {
    const out = {};
    for (const b of MASTER_BADGES) {
      if (!out[b.category]) out[b.category] = [];
      out[b.category].push(b);
    }
    return out;
  }, []);

  async function runUnlockCheck(source = 'manual_check') {
    if (!identity.name && !identity.email) return;
    setChecking(true);
    const keys = [...autoUnlocked];
    try {
      const res = await fetch('/api/achievement-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'merge_unlocks', email: identity.email, name: identity.name, unlockedKeys: keys, source })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        const merged = new Set(Array.isArray(data?.row?.unlockedKeys) ? data.row.unlockedKeys : keys);
        setStoredUnlocked(merged);
        const newly = Array.isArray(data?.newUnlocked) ? data.newUnlocked : [];
        setJustUnlocked(newly);
        if (newly.length) {
          setToast(`🎉 ${newly.length} new badge${newly.length > 1 ? 's' : ''} unlocked!`);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 1800);
        }
        else setToast('No new badges yet — keep pushing!');
        setTimeout(() => setToast(''), 3000);
      }
    } finally {
      setChecking(false);
    }
  }



  async function saveManualSeasonal() {
    if (!adminMode) return;
    setAdminSaving(true);
    try {
      const keys = [...adminManualKeys];
      const res = await fetch('/api/achievement-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_manual', email: identity.email, name: identity.name, manualKeys: keys })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        const manual = new Set(Array.isArray(data?.row?.manualKeys) ? data.row.manualKeys : keys);
        const stored = new Set(Array.isArray(data?.row?.unlockedKeys) ? data.row.unlockedKeys : []);
        setManualUnlocked(manual);
        setStoredUnlocked(stored);
        setToast('Seasonal badges updated.');
        setTimeout(() => setToast(''), 2200);
      }
    } finally {
      setAdminSaving(false);
    }
  }

  useEffect(() => {
    if (bootRef.current) return;
    if (loading) return;
    bootRef.current = true;
    runUnlockCheck('auto_load');
  }, [loading]);

  const unlockedCount = unlockedKeys.size;
  const totalCount = MASTER_BADGES.length;
  const completionPct = totalCount ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <>
    <ConfettiBurst show={showConfetti} />
    <main className="publicPage" style={{ background: 'radial-gradient(1200px 540px at 8% -10%, rgba(59,130,246,.25), transparent 60%), radial-gradient(900px 520px at 94% 8%, rgba(16,185,129,.16), transparent 55%), #020617', minHeight: '100vh' }}>
      <div className="panel" style={{ maxWidth: 1220, margin: '20px auto', padding: 16, border: '1px solid #1f2f48', background: 'linear-gradient(180deg,#081124 0%,#070d1c 100%)' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 44 }}>🏆</div>
          <h1 style={{ margin: '4px 0 0', color: '#fff' }}>Achievement Center</h1>
          <p style={{ color: '#9FB3CC', margin: 0 }}>Interactive badges across Licensed + Inner Circle</p>
          {identity.name ? <small style={{ color: '#93C5FD' }}>Profile: {identity.name}</small> : null}
        </div>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', marginBottom: 18 }}>
          <div className="panel" style={{ background: '#0B1220', border: '1px solid #334155', textAlign: 'center' }}><div style={{ color: '#F8FAFC', fontSize: 30, fontWeight: 900 }}>{unlockedCount}</div><small className="muted">Unlocked</small></div>
          <div className="panel" style={{ background: '#0B1220', border: '1px solid #334155', textAlign: 'center' }}><div style={{ color: '#F8FAFC', fontSize: 30, fontWeight: 900 }}>{totalCount}</div><small className="muted">Total Available</small></div>
          <div className="panel" style={{ background: '#0B1220', border: '1px solid #334155', textAlign: 'center' }}><div style={{ color: '#F8FAFC', fontSize: 30, fontWeight: 900 }}>{completionPct}%</div><small className="muted">Completion</small></div>
          <button type="button" onClick={() => runUnlockCheck('button_check')} disabled={checking} className="publicPrimaryBtn" style={{ borderRadius: 14, fontWeight: 800 }}>{checking ? 'Checking…' : 'Check for New Badges'}</button>
        </div>

        {toast ? <div className="panel" style={{ border: '1px solid #334155', background: '#0B1220', color: '#BFDBFE' }}>{toast}</div> : null}

        {adminMode ? (
          <div className="panel" style={{ border: '1px solid #334155', background: '#0B1220' }}>
            <strong style={{ color: '#F8FAFC' }}>Admin Mini Panel — Seasonal Badges</strong>
            <p className="muted" style={{ marginTop: 6 }}>Manual awards for seasonal badges only.</p>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
              {MASTER_BADGES.filter((b) => b.category === 'Seasonal').map((b) => (
                <label key={`adm-${b.badge_key}`} style={{ display: 'flex', gap: 8, alignItems: 'center', border: '1px solid #334155', borderRadius: 10, padding: '8px 10px', color: '#CBD5E1' }}>
                  <input
                    type="checkbox"
                    checked={adminManualKeys.has(b.badge_key)}
                    onChange={(e) => setAdminManualKeys((prev) => { const n = new Set(prev); if (e.target.checked) n.add(b.badge_key); else n.delete(b.badge_key); return n; })}
                  />
                  <span>{b.emoji} {b.name}</span>
                </label>
              ))}
            </div>
            <button type="button" className="publicPrimaryBtn" style={{ marginTop: 10 }} onClick={saveManualSeasonal} disabled={adminSaving}>{adminSaving ? 'Saving…' : 'Save Seasonal Awards'}</button>
          </div>
        ) : null}

        {Object.entries(groupedBadges).map(([category, badges]) => (
          <section key={category} style={{ marginTop: 18 }}>
            <h2 style={{ color: '#F8FAFC', marginBottom: 10 }}>{CATEGORY_CONFIG[category]?.emoji} {category}</h2>
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
              {badges.map((badge) => (
                <BadgeCard
                  key={badge.id}
                  badge={badge}
                  isUnlocked={unlockedKeys.has(badge.badge_key)}
                  isNew={justUnlocked.includes(badge.badge_key)}
                  progress={progressForBadge(badge.badge_key, stats)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
    </>
  );
}
