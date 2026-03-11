'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadRuntimeConfig } from '../../lib/runtimeConfig';

const REWARDS = {
  sponsorshipApp: 1,
  bookedAppointment: 5,
  cleanInsuranceApp: 10,
  paidPlacedCase: 500
};

const PAYOUT_LABELS = ['Pending Review', 'Approved', 'Paid', 'Reversed', 'Ineligible'];

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function normalizePhone(v = '') {
  return clean(v).replace(/\D/g, '');
}

function personKey(row = {}) {
  const email = normalize(row?.email || row?.applicantEmail || row?.applicant_email || '');
  const phone = normalizePhone(row?.phone || row?.applicantPhone || row?.applicant_phone || '');
  const name = normalize(
    row?.name ||
      row?.applicantName ||
      row?.applicant_name ||
      `${row?.firstName || ''} ${row?.lastName || ''}`
  ).replace(/[^a-z0-9]/g, '');

  if (email) return `e:${email}`;
  if (phone) return `p:${phone}`;
  if (name) return `n:${name}`;
  return '';
}

function toTs(v = '') {
  const t = new Date(v || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function isToday(ts = 0) {
  if (!ts) return false;
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function isThisWeek(ts = 0) {
  if (!ts) return false;
  const d = new Date(ts);
  const n = new Date();
  const start = new Date(n);
  start.setDate(n.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return d >= start;
}

function isThisMonth(ts = 0) {
  if (!ts) return false;
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}

function money(n = 0) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n || 0));
}

function monthKeyFromTs(ts = 0) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeyFromOffset(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + Number(offset || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabelFromKey(key = '') {
  const [y, m] = String(key || '').split('-').map((v) => Number(v));
  if (!y || !m) return key || '—';
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function uniqueBy(rows = [], keyFn) {
  const seen = new Set();
  const out = [];
  for (const r of rows || []) {
    const k = keyFn(r);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function matchAgentFromReferrer(referrer, agents = []) {
  const ref = normalize(referrer);
  if (!ref) return '';

  let best = '';
  let bestScore = 0;

  for (const a of agents) {
    const agent = normalize(a);
    if (!agent) continue;
    if (ref.includes(agent)) return a;

    const parts = agent.split(' ').filter((p) => p.length >= 3);
    const score = parts.reduce((acc, p) => (ref.includes(p) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }

  return bestScore > 0 ? best : '';
}

function mapToAgent(row = {}, agents = []) {
  const direct = row?.referredBy || row?.referred_by || row?.referralName || row?.referredByName || row?.policyWriterName || row?.submittedBy || '';
  const fromDirect = matchAgentFromReferrer(direct, agents);
  if (fromDirect) return fromDirect;

  const code = clean(row?.refCode || row?.referral_code || '').replace(/[_-]+/g, ' ');
  return matchAgentFromReferrer(code, agents);
}

function qualifiesSponsorshipApp(row = {}) {
  const status = normalize(row?.status || '');
  const bucket = normalize(row?.decision_bucket || '');

  if (bucket.includes('duplicate') || bucket.includes('fake') || bucket.includes('invalid')) return false;
  if (status.includes('fake') || status.includes('duplicate') || status.includes('invalid')) return false;

  const hasCore = clean(row?.firstName || row?.name) && clean(row?.lastName || row?.name);
  const hasContact = normalize(row?.email) || normalizePhone(row?.phone || '').length >= 10;
  return Boolean(hasCore && hasContact);
}

function qualifiesBooking(row = {}, validAppKeys = new Set()) {
  const status = normalize(row?.booking_status || row?.status || 'booked');
  if (!['booked', 'confirmed', 'completed'].some((s) => status.includes(s))) return false;
  if (status.includes('cancel')) return false;

  const sourceId = clean(row?.source_application_id || '');
  const key = personKey({
    name: row?.applicant_name,
    email: row?.applicant_email,
    phone: row?.applicant_phone
  });

  return Boolean((sourceId && validAppKeys.has(`id:${sourceId}`)) || (key && validAppKeys.has(key)));
}

function qualifiesCleanInsuranceApp(row = {}) {
  const status = normalize(row?.status || 'submitted');
  if (status.includes('incomplete') || status.includes('invalid') || status.includes('duplicate') || status.includes('junk')) return false;
  return Boolean(clean(row?.applicantName || row?.name) && (clean(row?.state) || clean(row?.policyNumber)));
}

function qualifiesPaidPlaced(row = {}) {
  const status = normalize(row?.status || '');
  const payout = normalize(row?.payoutStatus || '');
  const hasPremium = Number(row?.monthlyPremium || row?.premium || 0) > 0;

  if (normalize(row?.complianceStatus || '').includes('issue')) return false;
  if (normalize(row?.agentStatus || '').includes('inactive') || normalize(row?.agentStatus || '').includes('suspend')) return false;

  const approved = status.includes('approved');
  const paidPlaced = payout.includes('paid') || status.includes('paid') || status.includes('placed');
  return Boolean(approved && paidPlaced && hasPremium);
}

function buildStreak(activityDates = []) {
  const set = new Set(activityDates.map((d) => new Date(d).toDateString()));
  if (!set.size) return 0;
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const key = cursor.toDateString();
    if (!set.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function InnerCircleHubRewardsPage() {
  const [config, setConfig] = useState(loadRuntimeConfig());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [apps, setApps] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [policies, setPolicies] = useState([]);

  useEffect(() => {
    setConfig(loadRuntimeConfig());
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [appRes, bookingRes, policyRes] = await Promise.all([
          fetch('/api/sponsorship-applications', { cache: 'no-store' }),
          fetch('/api/sponsorship-bookings', { cache: 'no-store' }),
          fetch('/api/policy-submissions', { cache: 'no-store' })
        ]);

        const appJson = appRes.ok ? await appRes.json().catch(() => ({})) : {};
        const bookingJson = bookingRes.ok ? await bookingRes.json().catch(() => ({})) : {};
        const policyJson = policyRes.ok ? await policyRes.json().catch(() => ({})) : {};

        if (!mounted) return;
        setApps(Array.isArray(appJson?.rows) ? appJson.rows : []);
        setBookings(Array.isArray(bookingJson?.rows) ? bookingJson.rows : []);
        setPolicies(Array.isArray(policyJson?.rows) ? policyJson.rows : []);
      } catch {
        if (mounted) setError('Could not load live reward data right now.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, Math.max(20, Number(config.refreshIntervalSec || 60)) * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [config.refreshIntervalSec]);

  const computed = useMemo(() => {
    const validAppsRaw = (apps || []).filter(qualifiesSponsorshipApp).map((r) => ({
      ...r,
      ts: toTs(r?.submitted_at || r?.createdAt || r?.updatedAt),
      person: personKey({
        name: `${r?.firstName || ''} ${r?.lastName || ''}`,
        email: r?.email,
        phone: r?.phone
      }),
      agent: mapToAgent(r, config.agents)
    }));

    const validApps = uniqueBy(validAppsRaw, (r) => r.person || `id:${clean(r?.id)}`);
    const monthValidApps = validApps.filter((r) => isThisMonth(r.ts));
    const validAppKeySet = new Set(validApps.flatMap((r) => [r.person, `id:${clean(r?.id)}`]).filter(Boolean));

    const validBookingsRaw = (bookings || [])
      .filter((r) => qualifiesBooking(r, validAppKeySet))
      .map((r) => ({
        ...r,
        ts: toTs(r?.updated_at || r?.created_at || r?.createdAt),
        person: personKey({ name: r?.applicant_name, email: r?.applicant_email, phone: r?.applicant_phone }),
        agent: mapToAgent(r, config.agents)
      }));

    const validBookings = uniqueBy(validBookingsRaw, (r) => `${r.agent}|${r.person || clean(r?.id)}`);
    const monthValidBookings = validBookings.filter((r) => isThisMonth(r.ts));

    const cleanPoliciesRaw = (policies || [])
      .filter(qualifiesCleanInsuranceApp)
      .map((r) => ({
        ...r,
        ts: toTs(r?.submittedAt || r?.createdAt || r?.updatedAt),
        person: personKey({ name: r?.applicantName, email: r?.applicantEmail, phone: r?.applicantPhone }),
        agent: mapToAgent(r, config.agents)
      }));

    const cleanPolicies = uniqueBy(cleanPoliciesRaw, (r) => `${r.agent}|${r.person || clean(r?.id)}`);
    const monthCleanPolicies = cleanPolicies.filter((r) => isThisMonth(r.ts));

    const paidPlacedCasesRaw = cleanPolicies.filter(qualifiesPaidPlaced);
    const paidPlacedCases = uniqueBy(paidPlacedCasesRaw, (r) => `${r.agent}|${r.person || clean(r?.id)}`);
    const monthPaidPlacedCases = paidPlacedCases.filter((r) => isThisMonth(r.ts));

    const periodCounts = (filterFn) => {
      const appCount = validApps.filter((r) => filterFn(r.ts)).length;
      const bookingCount = validBookings.filter((r) => filterFn(r.ts)).length;
      const cleanCount = cleanPolicies.filter((r) => filterFn(r.ts)).length;
      const caseCount = paidPlacedCases.filter((r) => filterFn(r.ts)).length;
      const earned =
        appCount * REWARDS.sponsorshipApp +
        bookingCount * REWARDS.bookedAppointment +
        cleanCount * REWARDS.cleanInsuranceApp +
        caseCount * REWARDS.paidPlacedCase;
      return { appCount, bookingCount, cleanCount, caseCount, earned };
    };

    const today = periodCounts(isToday);
    const week = periodCounts(isThisWeek);
    const month = periodCounts(isThisMonth);

    const currentMonthKey = monthKeyFromOffset(0);
    const previousMonthKey = monthKeyFromOffset(-1);

    const monthCounts = (monthKey = '') => {
      const appCount = validApps.filter((r) => monthKeyFromTs(r.ts) === monthKey).length;
      const bookingCount = validBookings.filter((r) => monthKeyFromTs(r.ts) === monthKey).length;
      const cleanCount = cleanPolicies.filter((r) => monthKeyFromTs(r.ts) === monthKey).length;
      const caseCount = paidPlacedCases.filter((r) => monthKeyFromTs(r.ts) === monthKey).length;
      const earned =
        appCount * REWARDS.sponsorshipApp +
        bookingCount * REWARDS.bookedAppointment +
        cleanCount * REWARDS.cleanInsuranceApp +
        caseCount * REWARDS.paidPlacedCase;
      return { appCount, bookingCount, cleanCount, caseCount, earned };
    };

    const currentMonthPayout = monthCounts(currentMonthKey);
    const previousMonthPayout = monthCounts(previousMonthKey);

    const previousMonthByAgent = Object.fromEntries((config.agents || []).map((a) => [a, { apps: 0, bookings: 0, cleanApps: 0, paidPlaced: 0, earnings: 0 }]));
    for (const r of validApps) {
      if (monthKeyFromTs(r.ts) !== previousMonthKey || !previousMonthByAgent[r.agent]) continue;
      previousMonthByAgent[r.agent].apps += 1;
    }
    for (const r of validBookings) {
      if (monthKeyFromTs(r.ts) !== previousMonthKey || !previousMonthByAgent[r.agent]) continue;
      previousMonthByAgent[r.agent].bookings += 1;
    }
    for (const r of cleanPolicies) {
      if (monthKeyFromTs(r.ts) !== previousMonthKey || !previousMonthByAgent[r.agent]) continue;
      previousMonthByAgent[r.agent].cleanApps += 1;
    }
    for (const r of paidPlacedCases) {
      if (monthKeyFromTs(r.ts) !== previousMonthKey || !previousMonthByAgent[r.agent]) continue;
      previousMonthByAgent[r.agent].paidPlaced += 1;
    }

    const previousMonthAgentPayouts = Object.entries(previousMonthByAgent)
      .map(([agent, v]) => ({
        agent,
        ...v,
        earnings:
          v.apps * REWARDS.sponsorshipApp +
          v.bookings * REWARDS.bookedAppointment +
          v.cleanApps * REWARDS.cleanInsuranceApp +
          v.paidPlaced * REWARDS.paidPlacedCase
      }))
      .filter((r) => r.earnings > 0)
      .sort((a, b) => b.earnings - a.earnings);

    const baseByAgent = Object.fromEntries((config.agents || []).map((a) => [a, {
      apps: 0,
      bookings: 0,
      cleanApps: 0,
      paidPlaced: 0,
      earnings: 0,
      activityDates: []
    }]));

    for (const r of monthValidApps) {
      if (!baseByAgent[r.agent]) continue;
      baseByAgent[r.agent].apps += 1;
      if (r.ts) baseByAgent[r.agent].activityDates.push(r.ts);
    }
    for (const r of monthValidBookings) {
      if (!baseByAgent[r.agent]) continue;
      baseByAgent[r.agent].bookings += 1;
      if (r.ts) baseByAgent[r.agent].activityDates.push(r.ts);
    }
    for (const r of monthCleanPolicies) {
      if (!baseByAgent[r.agent]) continue;
      baseByAgent[r.agent].cleanApps += 1;
      if (r.ts) baseByAgent[r.agent].activityDates.push(r.ts);
    }
    for (const r of monthPaidPlacedCases) {
      if (!baseByAgent[r.agent]) continue;
      baseByAgent[r.agent].paidPlaced += 1;
      if (r.ts) baseByAgent[r.agent].activityDates.push(r.ts);
    }

    const agents = Object.entries(baseByAgent).map(([agent, v]) => {
      const earnings =
        v.apps * REWARDS.sponsorshipApp +
        v.bookings * REWARDS.bookedAppointment +
        v.cleanApps * REWARDS.cleanInsuranceApp +
        v.paidPlaced * REWARDS.paidPlacedCase;
      const streak = buildStreak(v.activityDates);

      const badges = {
        firstApp: v.apps >= 1,
        firstBooking: v.bookings >= 1,
        firstInsuranceApp: v.cleanApps >= 1,
        firstApproval: v.paidPlaced >= 1,
        first500: earnings >= 500,
        momentumBuilder: streak >= 3,
        consistencyLeader: streak >= 7,
        topBooker: false,
        topProducer: false,
        eliteInnerCircleProducer: earnings >= 2500
      };

      return { agent, ...v, earnings, streak, badges };
    });

    const topBookings = Math.max(0, ...agents.map((a) => a.bookings));
    const topEarnings = Math.max(0, ...agents.map((a) => a.earnings));

    const rankedByEarnings = [...agents].sort((a, b) => b.earnings - a.earnings || b.paidPlaced - a.paidPlaced || b.cleanApps - a.cleanApps);

    rankedByEarnings.forEach((a, idx) => {
      a.rank = idx + 1;
      a.badges.topBooker = topBookings > 0 && a.bookings === topBookings;
      a.badges.topProducer = topEarnings > 0 && a.earnings === topEarnings;
    });

    const duplicateApps = Math.max(0, validAppsRaw.filter((r) => isThisMonth(r.ts)).length - monthValidApps.length);
    const duplicateBookings = Math.max(0, validBookingsRaw.filter((r) => isThisMonth(r.ts)).length - monthValidBookings.length);
    const pendingReview = (apps || []).filter((r) => normalize(r?.status || '').includes('pending review')).length;

    const payoutStatusCounts = { pending: 0, approved: 0, paid: 0, reversed: 0, ineligible: 0 };
    for (const r of policies || []) {
      const p = normalize(r?.payoutStatus || r?.status || '');
      if (p.includes('revers')) payoutStatusCounts.reversed += 1;
      else if (p.includes('paid')) payoutStatusCounts.paid += 1;
      else if (p.includes('approved')) payoutStatusCounts.approved += 1;
      else if (p.includes('ineligible')) payoutStatusCounts.ineligible += 1;
      else payoutStatusCounts.pending += 1;
    }

    const fridayWinners = {
      topSponsorshipSubmitter: [...agents].sort((a, b) => b.apps - a.apps)[0]?.agent || '—',
      topBooker: [...agents].sort((a, b) => b.bookings - a.bookings)[0]?.agent || '—',
      topCleanInsuranceSubmitter: [...agents].sort((a, b) => b.cleanApps - a.cleanApps)[0]?.agent || '—',
      topProducer: [...agents].sort((a, b) => b.paidPlaced - a.paidPlaced)[0]?.agent || '—',
      biggestMover: [...agents].sort((a, b) => b.streak - a.streak)[0]?.agent || '—'
    };

    const monthlyWinners = {
      topActivityLeader: [...agents].sort((a, b) => (b.apps + b.bookings + b.cleanApps + b.paidPlaced) - (a.apps + a.bookings + a.cleanApps + a.paidPlaced))[0]?.agent || '—',
      topBookingLeader: [...agents].sort((a, b) => b.bookings - a.bookings)[0]?.agent || '—',
      topAppLeader: [...agents].sort((a, b) => b.cleanApps - a.cleanApps)[0]?.agent || '—',
      topProducer: [...agents].sort((a, b) => b.paidPlaced - a.paidPlaced)[0]?.agent || '—',
      highestEarnings: [...agents].sort((a, b) => b.earnings - a.earnings)[0]?.agent || '—'
    };

    return {
      today,
      week,
      month,
      currentMonthKey,
      previousMonthKey,
      currentMonthPayout,
      previousMonthPayout,
      previousMonthAgentPayouts,
      agents: rankedByEarnings,
      admin: {
        pendingReview,
        flaggedDuplicates: duplicateApps + duplicateBookings,
        qualifiesForPayouts: rankedByEarnings.filter((a) => a.earnings > 0).length,
        payoutStatusCounts
      },
      fridayWinners,
      monthlyWinners
    };
  }, [apps, bookings, policies, config.agents]);

  const leaderboard = useMemo(() => {
    const agents = computed.agents || [];
    return {
      mostSponsorshipApps: [...agents].sort((a, b) => b.apps - a.apps),
      mostBookedAppointments: [...agents].sort((a, b) => b.bookings - a.bookings),
      mostCleanInsuranceApps: [...agents].sort((a, b) => b.cleanApps - a.cleanApps),
      mostPaidPlacedCases: [...agents].sort((a, b) => b.paidPlaced - a.paidPlaced),
      highestTotalEarnings: [...agents].sort((a, b) => b.earnings - a.earnings),
      highestActivityStreak: [...agents].sort((a, b) => b.streak - a.streak)
    };
  }, [computed.agents]);

  const badgeList = [
    'First App',
    'First Booking',
    'First Insurance App',
    'First Approval',
    'First $500',
    'Momentum Builder',
    'Consistency Leader',
    'Top Booker',
    'Top Producer',
    'Elite Inner Circle Producer'
  ];

  return (
    <main className="publicPage hubRewards" style={{ minHeight: "100vh", background: "#020617", color: "#e5e7eb" }}>
      <div className="panel" style={{ maxWidth: 1120, margin: '22px auto', padding: 10, border: "1px solid #1e3a8a", background: "linear-gradient(180deg,#020617 0%, #030b1a 100%)", boxShadow: '0 20px 60px rgba(2,6,23,.65)' }}>
      <div className="panel" style={{ borderColor: '#2563eb', background: 'linear-gradient(135deg,#0b1f4a 0%, #0b1730 60%, #0a1020 100%)' }}>
        <h3 style={{ marginTop: 0, color: '#ffffff' }}>Welcome to Inner Circle Activity Rewards.</h3>
        <p style={{ marginBottom: 8, color: '#ffffff' }}>Every valid action creates momentum. Every clean submission counts. Every real result gets rewarded. Stay active, stay compliant, and stay moving.</p>
        <p style={{ margin: 0, color: '#ffffff' }}>This system rewards activity, consistency, quality, and real production — not random motion.</p>
      </div>

      <div className="panel" style={{ borderColor: '#3b82f6', background: 'linear-gradient(135deg, rgba(44,99,173,0.96) 0%, rgba(18,53,96,0.92) 100%)' }}>
        <strong style={{ color: '#ffffff' }}>Scoring Scope</strong>
        <p style={{ margin: '6px 0 0', color: '#eff6ff' }}>Leaderboard, agent ranking, streaks, and winner callouts are calculated from current month validated activity only (duplicates excluded).</p>
      </div>

      <div className="panel" style={{ display: 'grid', gap: 8 }}>
        <strong style={{ color: '#ffffff' }}>Internal Reward Summary</strong>
        <p style={{ margin: 0, color: '#ffffff' }}>• $1 per complete sponsorship app</p>
        <p style={{ margin: 0, color: '#ffffff' }}>• $5 per booked sponsorship appointment</p>
        <p style={{ margin: 0, color: '#ffffff' }}>• $10 per clean insurance app submitted in good order</p>
        <p style={{ margin: 0, color: '#ffffff' }}>• $500 per approved, paid-and-placed case</p>
      </div>


      <div className="panel" style={{ borderColor: '#15803d', background: 'linear-gradient(135deg,#082516 0%, #052012 100%)' }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Monthly Payout Window</h3>
        <p className="muted" style={{ margin: '0 0 6px' }}>
          Current Month ({monthLabelFromKey(computed.currentMonthKey)}): <strong>{money(computed.currentMonthPayout.earned)}</strong>
        </p>
        <p className="muted" style={{ margin: '0 0 6px' }}>
          Last Month ({monthLabelFromKey(computed.previousMonthKey)}): <strong>{money(computed.previousMonthPayout.earned)}</strong>
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Payout totals reset automatically each new month. Last month totals stay visible here so you can review payout before processing.
        </p>
        {(computed.previousMonthAgentPayouts || []).length ? (
          <div style={{ marginTop: 10 }}>
            <strong style={{ color: '#fff' }}>Last Month Payout Breakdown</strong>
            <ol style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {(computed.previousMonthAgentPayouts || []).slice(0, 10).map((r) => (
                <li key={`last-month-${r.agent}`} style={{ color: '#cbd5e1' }}>{r.agent} — {money(r.earnings)}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>

      {loading ? <div className="panel"><p>Loading rewards dashboard…</p></div> : null}
      {error ? <div className="panel" style={{ borderColor: '#7f1d1d', background: '#2a0d0d' }}>{error}</div> : null}

      <div className="kpiGrid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        {[
          { label: "Today’s Rewards", v: computed.today },
          { label: "This Week’s Rewards", v: computed.week },
          { label: "This Month’s Rewards", v: computed.month }
        ].map((block) => (
          <div className="panel" key={block.label}>
            <h3>{block.label}</h3>
            <p className="muted">Sponsorship apps: {block.v.appCount}</p>
            <p className="muted">Bookings: {block.v.bookingCount}</p>
            <p className="muted">Policies submitted (Closes): {block.v.cleanCount}</p>
            <p className="muted">Approved paid-and-placed cases: {block.v.caseCount}</p>
            <p style={{ marginBottom: 0 }}><strong>Total earned: {money(block.v.earned)}</strong></p>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>Leaderboard (Live)</h3>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
          {[
            ['Most Sponsorship Apps', leaderboard.mostSponsorshipApps, 'apps'],
            ['Most Booked Appointments', leaderboard.mostBookedAppointments, 'bookings'],
            ['Most Clean Insurance Apps (Closes)', leaderboard.mostCleanInsuranceApps, 'cleanApps'],
            ['Most Approved Paid-and-Placed Cases', leaderboard.mostPaidPlacedCases, 'paidPlaced'],
            ['Highest Total Earnings', leaderboard.highestTotalEarnings, 'earnings'],
            ['Highest Activity Streak', leaderboard.highestActivityStreak, 'streak']
          ].map(([title, rows, key]) => (
            <div key={title} style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 12, background: '#020617' }}>
              <strong>{title}</strong>
              <ol style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {(rows || []).slice(0, 3).map((r) => (
                  <li key={`${title}-${r.agent}`} style={{ color: '#cbd5e1' }}>{r.agent} — {key === 'earnings' ? money(r[key]) : r[key]}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>Badges</h3>
        <p className="muted" style={{ marginTop: 0 }}>{badgeList.join(' • ')}</p>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
        <div className="panel">
          <h3>Fast Start Friday</h3>
          <p className="muted">Top sponsorship app submitter: {computed.fridayWinners.topSponsorshipSubmitter}</p>
          <p className="muted">Top booker: {computed.fridayWinners.topBooker}</p>
          <p className="muted">Top clean insurance app submitter: {computed.fridayWinners.topCleanInsuranceSubmitter}</p>
          <p className="muted">Top producer: {computed.fridayWinners.topProducer}</p>
          <p className="muted" style={{ marginBottom: 0 }}>Biggest mover of the week: {computed.fridayWinners.biggestMover}</p>
        </div>

        <div className="panel">
          <h3>Inner Circle Monthly Winners</h3>
          <p className="muted">Top Activity Leader: {computed.monthlyWinners.topActivityLeader}</p>
          <p className="muted">Top Booking Leader: {computed.monthlyWinners.topBookingLeader}</p>
          <p className="muted">Top App Leader: {computed.monthlyWinners.topAppLeader}</p>
          <p className="muted">Top Producer: {computed.monthlyWinners.topProducer}</p>
          <p className="muted" style={{ marginBottom: 0 }}>Highest Earnings This Month: {computed.monthlyWinners.highestEarnings}</p>
        </div>
      </div>

      <div className="panel">
        <h3>Agent View</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Agent</th>
                <th align="left">Sponsorship Apps</th>
                <th align="left">Booked</th>
                <th align="left">Policies Submitted (Closes)</th>
                <th align="left">Approved Paid-and-Placed</th>
                <th align="left">Earned</th>
                <th align="left">Streak</th>
                <th align="left">Rank</th>
              </tr>
            </thead>
            <tbody>
              {(computed.agents || []).map((a) => (
                <tr key={a.agent}>
                  <td style={{ padding: '8px 0' }}>{a.agent}</td>
                  <td>{a.apps}</td>
                  <td>{a.bookings}</td>
                  <td>{a.cleanApps}</td>
                  <td>{a.paidPlaced}</td>
                  <td>{money(a.earnings)}</td>
                  <td>{a.streak} day(s)</td>
                  <td>#{a.rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" style={{ borderColor: '#334155' }}>
        <h3 style={{ marginTop: 0 }}>Rules & Qualification</h3>
        <p className="muted">Active and In Good Standing is required. No duplicate submissions. No fake submissions. No self-generated fake traffic. No payout on incomplete or invalid activity. All activity must be legitimate and verifiable. Payout decisions are subject to internal review and may be reversed or offset if paid in error.</p>
        <p className="muted" style={{ marginBottom: 0 }}>How To Win: Submit valid sponsorship apps, get real appointments booked, turn activity into policies submitted (closes), and focus on approved paid-and-placed business.</p>
      </div>

      <div className="panel" style={{ borderColor: '#1f2937', background: '#0b1220' }}>
        <small className="muted">Footer Note: All rewards are subject to verification, compliance review, and active member status. Invalid, duplicate, incomplete, fake, canceled, or non-qualifying activity does not count. Approved, paid-and-placed business is required for the $500 producer reward.</small>
        <small className="muted" style={{ display: 'block', marginTop: 6 }}>Payout Status Labels: {PAYOUT_LABELS.join(' • ')}</small>
      </div>

      <style jsx global>{`
        .hubRewards {
          background:
            radial-gradient(1200px 600px at 15% -10%, rgba(37, 99, 235, 0.20), transparent 60%),
            radial-gradient(900px 500px at 95% 5%, rgba(14, 165, 233, 0.10), transparent 55%),
            #020617;
          padding: 10px 14px 22px;
        }
        .hubRewards .panel {
          background: linear-gradient(180deg, #0c1426 0%, #0a1222 100%);
          border: 1px solid #243244;
          color: #f8fafc;
          border-radius: 14px;
          box-shadow: 0 10px 30px rgba(2, 6, 23, 0.35);
          transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hubRewards .panel:hover {
          border-color: #334b66;
          transform: translateY(-1px);
          box-shadow: 0 14px 34px rgba(2, 6, 23, 0.45);
        }
        .hubRewards .muted {
          color: #c1cde1 !important;
        }
        .hubRewards h1,
        .hubRewards h2,
        .hubRewards h3,
        .hubRewards strong,
        .hubRewards th,
        .hubRewards td {
          color: #f8fafc;
        }
        .hubRewards h3 {
          letter-spacing: 0.2px;
        }
        .hubRewards .kpiGrid .panel h3 {
          color: #dbeafe;
        }
        .hubRewards table {
          border-radius: 10px;
          overflow: hidden;
        }
        .hubRewards table th {
          font-size: 12px;
          letter-spacing: 0.35px;
          text-transform: uppercase;
          color: #bfdbfe;
        }
        .hubRewards table th,
        .hubRewards table td {
          padding: 10px;
          border-bottom: 1px solid #243244;
        }
        .hubRewards table tbody tr:hover {
          background: #0f1b32;
        }
        .hubRewards ol li {
          margin: 4px 0;
        }
      `}</style>
      </div>
    </main>
  );
}
