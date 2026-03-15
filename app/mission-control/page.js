'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { loadRuntimeConfig } from '../../lib/runtimeConfig';
import licensedAgents from '../../data/licensedAgents.json';

const DEFAULTS = loadRuntimeConfig();
const PAGE_PASSCODE = 'LegacyLink2026';
const PASSCODE_STORAGE_KEY = 'legacy-mission-control-passcode-ok-v1';

function byScope(obj, scope, aliases = []) {
  const prefix = scope === 'monthly' ? 'month' : scope === 'ytd' ? 'ytd' : 'all_time';
  for (const name of aliases) {
    const candidates = [
      `${name}_${prefix}`,
      `${name}${prefix === 'all_time' ? 'AllTime' : prefix === 'ytd' ? 'Ytd' : 'Month'}`,
      `${scope}_${name}`
    ];
    for (const key of candidates) {
      if (obj?.[key] != null) return Number(obj[key]) || 0;
    }
  }
  return null;
}

function cleanName(value = '') {
  return String(value).toLowerCase().replace('dr. ', '').trim();
}

function licensedDisplayName(raw = '') {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (value.includes(',')) {
    const [last, first] = value.split(',').map((x) => String(x || '').trim());
    return `${first} ${last}`.trim();
  }
  return value;
}

function toLocalTime(iso, timezone) {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function normalizeRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.leaders)) return payload.leaders;
  if (Array.isArray(payload.revenue_data)) return payload.revenue_data;
  return [];
}

function getStatus(referrals, apps) {
  return referrals + apps >= 1 ? 'On Pace' : 'Off Pace';
}

function parseGvizPayload(text) {
  const match = String(text || '').match(/setResponse\((.*)\);/s);
  if (!match) return null;
  return JSON.parse(match[1]);
}

function parseGvizDate(value) {
  if (!value || typeof value !== 'string') return null;
  const m = value.match(/Date\((\d+),(\d+),(\d+)/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]), Number(m[3]));
}

function sameMonthYear(date) {
  if (!date || Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function sameDay(date) {
  if (!date || Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function shortDate(date) {
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}


function parseCsvRows(text = '') {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (vals[i] || '').trim();
    });
    return row;
  });
}

function matchAgentFromReferrer(referrer, agents) {
  const ref = cleanName(referrer || '');
  if (!ref) return null;

  let best = null;
  let bestScore = 0;

  for (const agent of agents || []) {
    const agentClean = cleanName(agent);
    if (!agentClean) continue;

    if (ref.includes(agentClean)) {
      return agent;
    }

    const parts = agentClean.split(' ').filter((p) => p.length >= 3);
    const score = parts.reduce((acc, part) => (ref.includes(part) ? acc + 1 : acc), 0);

    if (score > bestScore) {
      bestScore = score;
      best = agent;
    }
  }

  return bestScore > 0 ? best : null;
}

function mapApplicationToAgent(row, agents) {
  const direct = row?.referralName || row?.referred_by || row?.referredBy || row?.referredByName || '';
  let mapped = matchAgentFromReferrer(direct, agents);
  if (mapped) return mapped;

  const refCode = String(row?.refCode || row?.referral_code || '').replace(/[_-]+/g, ' ');
  mapped = matchAgentFromReferrer(refCode, agents);
  if (mapped) return mapped;

  mapped = matchAgentFromReferrer(row?.submittedBy || row?.policyWriterName || '', agents);
  return mapped || null;
}

function applicantNameFromRow(row = {}) {
  const first = String(row?.firstName || row?.first_name || '').trim();
  const last = String(row?.lastName || row?.last_name || '').trim();
  const full = String(row?.applicantName || row?.name || `${first} ${last}`).trim();
  return full || 'Unknown';
}

function applicantKey(row = {}) {
  const email = String(row?.email || row?.applicant_email || '').trim().toLowerCase();
  const phone = String(row?.phone || row?.applicant_phone || '').replace(/\D/g, '');
  const name = cleanName(applicantNameFromRow(row)).replace(/\s+/g, '');

  if (email) return `e:${email}`;
  if (phone) return `p:${phone}`;
  if (name) return `n:${name}`;
  return `id:${String(row?.id || row?.applicantName || '').trim().toLowerCase()}`;
}

function buildAppSubmitPrefillUrl(booking = {}) {
  const qp = new URLSearchParams();
  const push = (k, v) => {
    const val = String(v || '').trim();
    if (val) qp.set(k, val);
  };

  push('ref', booking?.referral_code || '');
  push('firstName', booking?.applicant_first_name || '');
  push('lastName', booking?.applicant_last_name || '');
  push('name', booking?.applicant_name || '');
  push('email', booking?.applicant_email || '');
  push('phone', booking?.applicant_phone || '');
  push('state', booking?.applicant_state || '');
  push('licensed', booking?.licensed_status || '');
  push('referredBy', booking?.referred_by || '');

  return `/inner-circle-app-submit?${qp.toString()}`;
}

export default function MissionControl() {
  const [config, setConfig] = useState(DEFAULTS);
  const [rows, setRows] = useState([]);
  const [revenueRows, setRevenueRows] = useState([]);
  const [sponsorshipApprovalsByAgent, setSponsorshipApprovalsByAgent] = useState({});
  const [sponsorshipTodayApprovalsByAgent, setSponsorshipTodayApprovalsByAgent] = useState({});
  const [sponsorshipAppsByAgent, setSponsorshipAppsByAgent] = useState({});
  const [sponsorshipTodayAppsByAgent, setSponsorshipTodayAppsByAgent] = useState({});
  const [todaySponsorshipDetails, setTodaySponsorshipDetails] = useState([]);
  const [todayApplicationDetails, setTodayApplicationDetails] = useState([]);
  const [sponsorshipSyncIssue, setSponsorshipSyncIssue] = useState('');
  const [manualReviewCount, setManualReviewCount] = useState(0);
  const [bookingQueue, setBookingQueue] = useState([]);
  const [adminTab, setAdminTab] = useState('overview');
  const [payoutPolicyRows, setPayoutPolicyRows] = useState([]);
  const [payoutSponsorshipRows, setPayoutSponsorshipRows] = useState([]);
  const [payoutStatusMap, setPayoutStatusMap] = useState({});
  const [payoutBusyAgent, setPayoutBusyAgent] = useState('');
  const [unlicensedProgressRows, setUnlicensedProgressRows] = useState([]);
  const [unlicensedStageCounts, setUnlicensedStageCounts] = useState({});
  const [detailsModal, setDetailsModal] = useState({ open: false, type: '' });
  const [contactsVaultSummary, setContactsVaultSummary] = useState({ total: 0, withEmail: 0, withoutEmail: 0 });
  const [contactsVaultUpdatedAt, setContactsVaultUpdatedAt] = useState('');
  const [contactsCsvMsg, setContactsCsvMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passError, setPassError] = useState('');
  const [authed, setAuthed] = useState(true);
  const scopeLabel = 'This Month';
  const payoutMonthKey = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    const cfg = loadRuntimeConfig();
    setConfig(cfg);

    try {
      const saved = localStorage.getItem(PASSCODE_STORAGE_KEY);
      if (saved === 'ok') setAuthed(true);
    } catch {
      // ignore storage errors
    }

    fetch('/api/contacts-vault', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          setContactsVaultSummary(d.summary || { total: 0, withEmail: 0, withoutEmail: 0 });
          setContactsVaultUpdatedAt(d.updatedAt || '');
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [leaderboardRes, revenueRes, sponsorshipRes, manualReviewRes, policySubmissionsRes, sponsorshipBookingsRes] = await Promise.all([
          fetch(config.leaderboardUrl, { cache: 'no-store' }),
          fetch(config.revenueUrl, { cache: 'no-store' }),
          fetch(config.sponsorshipTrackerUrl, { cache: 'no-store' }),
          fetch('/api/sponsorship-applications', { cache: 'no-store' }),
          fetch('/api/policy-submissions', { cache: 'no-store' }),
          fetch('/api/sponsorship-bookings', { cache: 'no-store' })
        ]);

        if (!leaderboardRes.ok) throw new Error(`Leaderboard HTTP ${leaderboardRes.status}`);

        const leaderboardJson = await leaderboardRes.json();
        const revenueJson = revenueRes.ok ? await revenueRes.json() : null;

        const monthlyApprovals = {};
        const todayApprovals = {};
        const todayDetails = [];
        const todayAppDetailsRows = [];
        let sponsorshipIssue = '';
        let reviewCount = 0;
        const monthlyApps = {};
        const todayApps = {};

        const monthSeen = new Set();
        const todaySeen = new Set();

        const registerApp = ({ row, mapped, submitted, source }) => {
          if (!mapped || !submitted || Number.isNaN(submitted.getTime())) return;

          const key = applicantKey(row);
          const name = applicantNameFromRow(row);

          if (sameMonthYear(submitted) && !monthSeen.has(key)) {
            monthSeen.add(key);
            monthlyApps[mapped] = Number(monthlyApps[mapped] || 0) + 1;
          }

          if (sameDay(submitted) && !todaySeen.has(key)) {
            todaySeen.add(key);
            todayApps[mapped] = Number(todayApps[mapped] || 0) + 1;
            todayAppDetailsRows.push({
              key,
              name,
              mappedAgent: mapped,
              source,
              submittedAt: submitted
            });
          }
        };

        // Priority 1: internal Policy Submission flow (prevents duplicate credit from later Base44 entries)
        let policyRows = [];
        if (policySubmissionsRes.ok) {
          const policyJson = await policySubmissionsRes.json().catch(() => ({}));
          policyRows = Array.isArray(policyJson?.rows) ? policyJson.rows : [];

          for (const r of policyRows) {
            const submitted = new Date(r?.submittedAt || r?.createdAt || r?.updatedAt || 0);
            const mapped = mapApplicationToAgent(r, config.agents);
            registerApp({ row: r, mapped, submitted, source: 'Internal Policy Submission' });
          }
        }

        // Sponsorship application feed is used for referral quality/manual review counts only.
        // It should NOT count as "App Submitted" (FNG).
        let reviewRows = [];
        if (manualReviewRes.ok) {
          const reviewJson = await manualReviewRes.json().catch(() => ({}));
          reviewRows = Array.isArray(reviewJson?.rows) ? reviewJson.rows : [];
          reviewCount = reviewRows.filter((r) => String(r?.decision_bucket || '').toLowerCase() === 'manual_review').length;

          const monthReferralSeen = new Set();
          const todayReferralSeen = new Set();

          for (const r of reviewRows) {
            const submitted = new Date(r?.submitted_at || r?.createdAt || r?.updatedAt || 0);
            if (Number.isNaN(submitted.getTime())) continue;

            const mapped = mapApplicationToAgent(r, config.agents);
            if (!mapped) continue;

            const key = applicantKey(r);
            const name = applicantNameFromRow(r);
            const ref = r?.referralName || r?.referred_by || r?.referredBy || r?.referredByName || r?.refCode || '—';

            if (sameMonthYear(submitted) && !monthReferralSeen.has(key)) {
              monthReferralSeen.add(key);
              monthlyApprovals[mapped] = Number(monthlyApprovals[mapped] || 0) + 1;
            }

            if (sameDay(submitted) && !todayReferralSeen.has(key)) {
              todayReferralSeen.add(key);
              todayApprovals[mapped] = Number(todayApprovals[mapped] || 0) + 1;
              todayDetails.push({
                name,
                referredBy: ref || '—',
                mappedAgent: mapped,
                approvedDate: submitted
              });
            }
          }
        }

        // Keep sponsorship tracker endpoint health check, but referral counts are based on
        // sponsorship form submissions (not tracker approval dates).
        if (!sponsorshipRes.ok) {
          sponsorshipIssue = `Sponsorship tracker HTTP ${sponsorshipRes.status}`;
        }

        let queueRows = [];
        if (sponsorshipBookingsRes.ok) {
          const bookingsJson = await sponsorshipBookingsRes.json().catch(() => ({}));
          const bookingRows = Array.isArray(bookingsJson?.rows) ? bookingsJson.rows : [];
          queueRows = bookingRows
            .filter((r) => r?.requested_at_est)
            .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        }

        if (!mounted) return;
        setRows(normalizeRows(leaderboardJson));
        setRevenueRows(normalizeRows(revenueJson));
        setSponsorshipApprovalsByAgent(monthlyApprovals);
        setSponsorshipTodayApprovalsByAgent(todayApprovals);
        setSponsorshipAppsByAgent(monthlyApps);
        setSponsorshipTodayAppsByAgent(todayApps);
        setTodaySponsorshipDetails(todayDetails);
        setTodayApplicationDetails(todayAppDetailsRows);
        setBookingQueue(queueRows);
        setPayoutPolicyRows(policyRows);
        setPayoutSponsorshipRows(reviewRows);
        setSponsorshipSyncIssue(sponsorshipIssue);
        setManualReviewCount(reviewCount);
        setLastSyncAt(new Date().toISOString());
      } catch (err) {
        if (!mounted) return;
        setError(`Could not load sync data (${err.message}).`);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, Math.max(15, Number(config.refreshIntervalSec || 60)) * 1000);

      return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [config.leaderboardUrl, config.revenueUrl, config.sponsorshipTrackerUrl, config.refreshIntervalSec, config.agents]);

  const team = useMemo(() => {
    return config.agents.map((agent) => {
      const match = rows.find((r) => cleanName(r.agent_name ?? r.agentName ?? r.name) === cleanName(agent));

      // Referrals = direct sponsorship form submissions (inner-circle links).
      const monthReferrals = Number(sponsorshipApprovalsByAgent[agent] || 0);
      const todayReferrals = Number(sponsorshipTodayApprovalsByAgent[agent] || 0);

      // Apps Submitted = FNG/internal app submit only.
      const monthApps = Number(sponsorshipAppsByAgent[agent] || 0);
      const todayApps = Number(sponsorshipTodayAppsByAgent[agent] || 0);

      const sheetApprovals = monthReferrals;
      const sheetTodayApprovals = todayReferrals;

      const pendingRevenueSync = 0;
      const todayPendingSync = 0;
      const effectiveTodayReferrals = todayReferrals;
      const roi = monthReferrals ? monthApps / monthReferrals : monthApps > 0 ? monthApps : 0;

      return {
        name: agent,
        monthReferrals,
        monthApps,
        sheetApprovals,
        sheetTodayApprovals,
        pendingRevenueSync,
        todayPendingSync,
        todayReferrals: effectiveTodayReferrals,
        todayApps,
        roi,
        status: getStatus(monthReferrals, monthApps)
      };
    });
  }, [rows, sponsorshipApprovalsByAgent, sponsorshipTodayApprovalsByAgent, sponsorshipAppsByAgent, sponsorshipTodayAppsByAgent, config.agents]);

  const totals = useMemo(
    () =>
      team.reduce(
        (acc, row) => {
          acc.month.referrals += row.monthReferrals;
          acc.month.apps += row.monthApps;
          acc.month.sheetApprovals += row.sheetApprovals;
          acc.month.pendingSync += row.pendingRevenueSync;
          acc.month.active += row.monthReferrals + row.monthApps >= 1 ? 1 : 0;
          acc.today.referrals += row.todayReferrals;
          acc.today.pendingSync += row.todayPendingSync;
          acc.today.apps += row.todayApps;
          return acc;
        },
        { month: { referrals: 0, apps: 0, sheetApprovals: 0, pendingSync: 0, active: 0 }, today: { referrals: 0, pendingSync: 0, apps: 0 } }
      ),
    [team]
  );

  const todayAppCountsByAgent = useMemo(() => {
    const map = new Map();
    for (const item of todayApplicationDetails) {
      map.set(item.mappedAgent, Number(map.get(item.mappedAgent) || 0) + 1);
    }
    return [...map.entries()].map(([agent, count]) => ({ agent, count })).sort((a, b) => b.count - a.count);
  }, [todayApplicationDetails]);


  const payoutRows = useMemo(() => {
    const rosterRaw = Array.isArray(licensedAgents) ? licensedAgents : [];
    const roster = [...new Set(rosterRaw.map((r) => cleanName(licensedDisplayName(r?.full_name || r?.name || ''))).filter(Boolean))];
    const innerCircle = new Set((config.agents || []).map((n) => cleanName(n)));
    const owners = new Set(['angelique lassiter', 'jamal holmes']);
    const eligible = roster.filter((n) => !innerCircle.has(n) && !owners.has(n));

    const byAgent = new Map();
    const add = (agent, field, inc = 1) => {
      const key = cleanName(agent);
      if (!key || !eligible.includes(key)) return;
      const prev = byAgent.get(key) || { agent, sponsorshipApps: 0, insuranceApps: 0 };
      prev[field] = Number(prev[field] || 0) + inc;
      byAgent.set(key, prev);
    };

    const sponsorSeen = new Set();
    for (const r of (payoutSponsorshipRows || [])) {
      const dt = new Date(r?.submitted_at || r?.updatedAt || r?.createdAt || 0);
      if (!sameMonthYear(dt)) continue;
      const mapped = mapApplicationToAgent(r, eligible);
      const key = applicantKey(r);
      if (!mapped || sponsorSeen.has(`${mapped}|${key}`)) continue;
      sponsorSeen.add(`${mapped}|${key}`);
      add(mapped, 'sponsorshipApps', 1);
    }

    for (const r of (payoutPolicyRows || [])) {
      const dt = new Date(r?.submittedAt || r?.updatedAt || r?.createdAt || 0);
      if (!sameMonthYear(dt)) continue;
      const mapped = mapApplicationToAgent(r, eligible);
      if (!mapped) continue;
      add(mapped, 'insuranceApps', 1);
    }

    const rows = [...byAgent.values()].map((r) => {
      const s = Number(r.sponsorshipApps || 0);
      const p = Number(r.insuranceApps || 0);
      const sponsorshipDollars = (Math.min(10, s) * 1) + (Math.max(0, s - 10) * 5);
      const insuranceDollars = p * 10;
      return { ...r, sponsorshipDollars, insuranceDollars, estimatedPayout: sponsorshipDollars + insuranceDollars };
    }).sort((a, b) => b.estimatedPayout - a.estimatedPayout || a.agent.localeCompare(b.agent));

    const totals = rows.reduce((acc, r) => {
      acc.sponsorshipApps += Number(r.sponsorshipApps || 0);
      acc.insuranceApps += Number(r.insuranceApps || 0);
      acc.payout += Number(r.estimatedPayout || 0);
      return acc;
    }, { sponsorshipApps: 0, insuranceApps: 0, payout: 0 });

    return { rows, totals };
  }, [payoutPolicyRows, payoutSponsorshipRows, config.agents]);

  useEffect(() => {
    let mounted = true;

    async function loadPayoutStatuses() {
      try {
        const res = await fetch(`/api/payout-queue?month=${encodeURIComponent(payoutMonthKey)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!mounted || !res.ok || !data?.ok) return;
        const map = {};
        for (const r of (Array.isArray(data.rows) ? data.rows : [])) {
          map[cleanName(r?.agent)] = { paid: Boolean(r?.paid), paidAt: r?.paidAt || '', note: r?.note || '' };
        }
        setPayoutStatusMap(map);
      } catch {
        // ignore payout status load failures
      }
    }

    loadPayoutStatuses();
    return () => { mounted = false; };
  }, [payoutMonthKey, payoutRows.rows.length]);

  async function setPayoutPaid(agent = '', paid = true) {
    const a = String(agent || '').trim();
    if (!a) return;
    setPayoutBusyAgent(cleanName(a));
    try {
      const res = await fetch('/api/payout-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: paid ? 'mark_paid' : 'mark_unpaid', month: payoutMonthKey, agent: a })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setPayoutStatusMap((prev) => ({ ...prev, [cleanName(a)]: { paid, paidAt: data?.row?.paidAt || '' } }));
      }
    } catch {
      // ignore save failures here; quick admin action
    } finally {
      setPayoutBusyAgent('');
    }
  }

  function exportPayoutCsv() {
    const header = ['Month', 'Agent', 'Sponsorship Apps', 'Insurance Apps', 'Sponsorship $', 'Insurance $', 'Estimated Payout', 'Status', 'Paid At'];
    const lines = [header.join(',')];
    for (const r of payoutRows.rows) {
      const status = payoutStatusMap[cleanName(r.agent)]?.paid ? 'Paid' : 'Pending';
      const paidAt = payoutStatusMap[cleanName(r.agent)]?.paidAt || '';
      const vals = [
        payoutMonthKey,
        r.agent,
        r.sponsorshipApps,
        r.insuranceApps,
        r.sponsorshipDollars,
        r.insuranceDollars,
        r.estimatedPayout,
        status,
        paidAt
      ].map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`);
      lines.push(vals.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `licensed-payout-queue-${payoutMonthKey}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const dataConfidence = useMemo(() => {
    if (error) return { label: 'Low', tone: 'offpace', score: 35 };
    const roster = Math.max(1, config.agents.length);
    const sponsorshipRows = Object.keys(sponsorshipApprovalsByAgent || {}).length;
    const rowCoverage = Math.min(1, (rows.length + revenueRows.length + sponsorshipRows) / roster);
    const activityCoverage = team.filter((t) => t.monthReferrals + t.monthApps > 0).length / roster;
    let score = Math.round((rowCoverage * 0.6 + activityCoverage * 0.4) * 100);
    if (sponsorshipSyncIssue) score = Math.max(30, score - 20);
    if (score >= 75) return { label: 'High', tone: 'onpace', score };
    if (score >= 45) return { label: 'Medium', tone: 'atrisk', score };
    return { label: 'Low', tone: 'offpace', score };
  }, [error, config.agents.length, rows.length, revenueRows.length, sponsorshipApprovalsByAgent, sponsorshipSyncIssue, team]);


  const isWithinPriorityWindow = (booking) => {
    if (!booking?.priority_agent || booking?.priority_released) return false;
    if (!booking?.priority_expires_at) return false;
    const exp = new Date(booking.priority_expires_at);
    if (Number.isNaN(exp.getTime())) return false;
    return exp.getTime() > Date.now();
  };

  const onContactsCsvUpload = (file) => {
    setContactsCsvMsg('');
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rows = parseCsvRows(String(reader.result || ''));
        const res = await fetch('/api/contacts-vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows, source: file.name || 'contacts.csv' })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) {
          setContactsVaultSummary(data.summary || { total: 0, withEmail: 0, withoutEmail: 0 });
          setContactsVaultUpdatedAt(data.updatedAt || '');
          setContactsCsvMsg(`Loaded ${Number(data?.summary?.total || 0)} contacts. Email matches: ${Number(data?.summary?.withEmail || 0)}.`);
        } else {
          setContactsCsvMsg(`Upload failed: ${data?.error || 'unknown error'}`);
        }
      } catch {
        setContactsCsvMsg('Could not parse CSV.');
      }
    };
    reader.onerror = () => setContactsCsvMsg('CSV read failed.');
    reader.readAsText(file);
  };

  const unlockMissionControl = () => {
    if ((passcodeInput || '').trim() === PAGE_PASSCODE) {
      setAuthed(true);
      setPassError('');
      try {
        localStorage.setItem(PASSCODE_STORAGE_KEY, 'ok');
      } catch {
        // ignore storage errors
      }
      return;
    }
    setPassError('Incorrect passcode.');
  };

  if (!authed) {
    return (
      <AppShell title="Mission Control">
        <div className="panel" style={{ maxWidth: 420, margin: '40px auto' }}>
          <h3 style={{ marginTop: 0 }}>Mission Control Access</h3>
          <p className="muted">Enter passcode to continue.</p>
          <input
            type="password"
            value={passcodeInput}
            onChange={(e) => setPasscodeInput(e.target.value)}
            placeholder="Enter passcode"
            onKeyDown={(e) => {
              if (e.key === 'Enter') unlockMissionControl();
            }}
          />
          <div className="panelRow" style={{ marginTop: 10 }}>
            <button type="button" onClick={unlockMissionControl}>Unlock</button>
          </div>
          {passError ? <p style={{ color: '#dc2626' }}>{passError}</p> : null}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Mission Control">
      <div className="panelRow" style={{ gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0 }}>Mission Control Overview</h3>
          <p className="muted" style={{ margin: 0 }}>
            Metrics below reflect current month-to-date execution.
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/sponsorship-review">
            <button type="button" style={manualReviewCount > 0 ? { background: '#b91c1c', color: '#fff' } : undefined}>
              Sponsorship Review {manualReviewCount > 0 ? `(${manualReviewCount})` : ''}
            </button>
          </a>
          <a href="/sponsorships">
            <button type="button">Open Agency Owner Dashboard</button>
          </a>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
          <strong>Mission Control Tabs:</strong>
          <button type="button" className={adminTab === 'overview' ? '' : 'ghost'} onClick={() => setAdminTab('overview')}>Overview</button>
          <button type="button" className={adminTab === 'payout' ? '' : 'ghost'} onClick={() => setAdminTab('payout')}>Payout Queue</button>
        </div>
      </div>

      <div style={{ display: adminTab === 'overview' ? 'block' : 'none' }}>
      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="panelRow" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Contacts Vault (Internal)</h3>
            <p className="muted" style={{ margin: 0 }}>
              Upload your full contacts CSV here (9,000+ safe storage) for future promotions and email matching.
            </p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <input type="file" accept=".csv,text/csv" onChange={(e) => onContactsCsvUpload(e.target.files?.[0])} />
          </div>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Stored: {contactsVaultSummary.total} contacts • With email: {contactsVaultSummary.withEmail} • Missing email: {contactsVaultSummary.withoutEmail}
          {contactsVaultUpdatedAt ? ` • Updated: ${toLocalTime(contactsVaultUpdatedAt, config.timezone)}` : ''}
        </p>
        {contactsCsvMsg ? <p className="muted">{contactsCsvMsg}</p> : null}
      </div>

      <div className="grid4">
        <div className="card">
          <p>Sponsorship Referrals ({scopeLabel})</p>
          <h2>{totals.month.referrals}</h2>
          <span className="pill onpace">Source: Sponsorship form submissions (referrals)</span>
        </div>
        <div className="card">
          <p>FNG Apps Submitted ({scopeLabel})</p>
          <h2>{totals.month.apps}</h2>
          <span className="pill onpace">Source: Inner Circle App Submit (policy entry)</span>
        </div>
        <div className="card">
          <p>Agents Active ({scopeLabel})</p>
          <h2>{totals.month.active}/{config.agents.length}</h2>
          <span className={`pill ${totals.month.active >= 1 ? 'onpace' : 'offpace'}`}>{totals.month.active >= 1 ? 'On Pace' : 'Off Pace'}</span>
        </div>
        <div className="card">
          <p>Referral Source</p>
          <h2>Direct</h2>
          <span className="pill onpace">Inner Circle personal referral links</span>
        </div>
      </div>

      <div className="grid4">
        <div className="card">
          <p>Sponsorship Referrals (Today)</p>
          <h2>{totals.today.referrals}</h2>
          <span className="pill onpace">
            Direct-link submissions (real-time)
          </span>
          <div style={{ marginTop: 8 }}>
            <button type="button" className="ghost" onClick={() => setDetailsModal({ open: true, type: 'referrals' })}>
              View names below
            </button>
          </div>
        </div>
        <div className="card">
          <p>FNG Apps Submitted (Today)</p>
          <h2>{totals.today.apps}</h2>
          <span className="pill onpace">Inner Circle App Submit entries</span>
          <div style={{ marginTop: 8 }}>
            <button type="button" className="ghost" onClick={() => setDetailsModal({ open: true, type: 'apps' })}>
              View details below
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panelRow">
          <h3>Sync Health</h3>
          <span className={`pill ${error || sponsorshipSyncIssue ? 'offpace' : 'onpace'}`}>
            {error || sponsorshipSyncIssue ? 'Issue Detected' : 'Connected'}
          </span>
        </div>
        <p className="muted">Last Successful Sync: {lastSyncAt ? toLocalTime(lastSyncAt, config.timezone) : 'No successful sync yet'}</p>
        <p className="muted">Sources: Leaderboard endpoint + Revenue endpoint + Sponsorship tracker endpoint + Correction ledger.</p>
        {sponsorshipSyncIssue ? <p className="red">Sponsorship Sync: {sponsorshipSyncIssue}</p> : null}
        <p className={`pill ${dataConfidence.tone}`} style={{ display: 'inline-block' }}>
          Data Confidence: {dataConfidence.score}% ({dataConfidence.label})
        </p>
      </div>

      <div className="panel">
        <div className="panelRow" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3>Inner Circle Scoreboard</h3>
            <span className="muted">
              Status rule: any activity this month = On Pace
            </span>
          </div>
        </div>

        {error ? <p className="red">{error}</p> : null}

        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Referrals</th>
              <th>Approved (Sheet)</th>
              <th>Pending Sync</th>
              <th>FNG Apps Submitted</th>
              <th>ROI</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {team.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.monthReferrals}</td>
                <td>{row.sheetApprovals}</td>
                <td>
                  <span className={`pill ${row.pendingRevenueSync > 0 ? 'atrisk' : 'onpace'}`}>
                    {row.pendingRevenueSync}
                  </span>
                </td>
                <td>{row.monthApps}</td>
                <td>
                  <span className={`pill ${row.roi >= 1 ? 'onpace' : row.roi >= 0.5 ? 'atrisk' : 'offpace'}`}>
                    {row.monthReferrals === 0 && row.monthApps === 0 ? '—' : `${(row.roi || 0).toFixed(2)}x`}
                  </span>
                </td>
                <td>
                  <span className={`pill ${row.status === 'On Pace' ? 'onpace' : 'offpace'}`}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailsModal.open ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50,
            padding: 16
          }}
          onClick={() => setDetailsModal({ open: false, type: '' })}
        >
          <div
            className="panel"
            style={{ width: 'min(860px, 96vw)', maxHeight: '80vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panelRow">
              <h3 style={{ margin: 0 }}>
                {detailsModal.type === 'referrals' ? 'Today Sponsorship Referrals' : 'Today FNG Apps Submitted'}
              </h3>
              <button type="button" onClick={() => setDetailsModal({ open: false, type: '' })}>Close</button>
            </div>

            {detailsModal.type === 'referrals' ? (
              todaySponsorshipDetails.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>Sponsor Name</th>
                      <th>Referred By</th>
                      <th>Credited To</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todaySponsorshipDetails.map((item, idx) => (
                      <tr key={`${item.name}-${idx}`}>
                        <td>{item.name}</td>
                        <td>{item.referredBy}</td>
                        <td>{item.mappedAgent}</td>
                        <td>{shortDate(item.approvedDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">No sponsorship referrals logged today yet.</p>
              )
            ) : todayApplicationDetails.length ? (
              <>
                <table>
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Credited To</th>
                      <th>Source</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayApplicationDetails.map((item, idx) => (
                      <tr key={`${item.key}-${idx}`}>
                        <td>{item.name}</td>
                        <td>{item.mappedAgent}</td>
                        <td>{item.source}</td>
                        <td>{shortDate(item.submittedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <table style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Apps Today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayAppCountsByAgent.map((item) => (
                      <tr key={item.agent}>
                        <td>{item.agent}</td>
                        <td>{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <p className="muted" style={{ marginTop: 10 }}>
                  Duplicate submissions are deduped by applicant (email/phone/name). This list only counts Inner Circle App Submit / policy-entry records.
                </p>
              </>
            ) : (
              <p className="muted">No FNG apps submitted today yet.</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="panelRow" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3>Unlicensed License Sprint Pipeline</h3>
            <span className="muted">Track unlicensed agents by onboarding stage.</span>
          </div>
        </div>

        {Object.keys(unlicensedStageCounts || {}).length ? (
          <div className="panelRow" style={{ gap: '.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {Object.entries(unlicensedStageCounts).map(([label, count]) => (
              <span key={label} className="pill neutral">{label}: {count}</span>
            ))}
          </div>
        ) : null}

        {!unlicensedProgressRows.length ? (
          <p className="muted">No unlicensed progress rows yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Resident State</th>
                <th>Current Stage</th>
                <th>Progress</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {unlicensedProgressRows.slice(0, 50).map((r) => (
                <tr key={`${r.email}-${r.name}`}>
                  <td>{r.name || '—'}</td>
                  <td>{r.email || '—'}</td>
                  <td>{r.residentState || '—'}</td>
                  <td>{r.stageLabel || 'Not Started'}</td>
                  <td>{Number(r.completionPct || 0)}%</td>
                  <td>{fmtDate(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>


      <div className="panel">
        <div className="panelRow" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3>Sponsorship Booking Queue</h3>
            <span className="muted">At-a-glance: booked applicants and assigned policy writer</span>
          </div>
        </div>

        {!bookingQueue.length ? (
          <p className="muted">No bookings yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Referral</th>
                <th>Applicant</th>
                <th>State</th>
                <th>Booked At</th>
                <th>Assigned Policy Writer</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(new Map((bookingQueue || []).map((b) => {
                const key = `${cleanName(b?.applicant_name || '')}|${String(b?.requested_at_est || '').trim()}|${String(b?.source_application_id || '').trim()}`;
                return [key, b];
              })).values()).map((b) => {
                const withinPriority = isWithinPriorityWindow(b);
                const assignedTo = b.claimed_by || b.priority_agent || 'Unassigned';

                return (
                  <tr key={b.id}>
                    <td>{b.referred_by || '—'}</td>
                    <td>{b.applicant_name || '—'}</td>
                    <td>{b.applicant_state || '—'}</td>
                    <td>{b.requested_at_est || '—'}{b.booking_timezone ? ` (${b.booking_timezone})` : ''}</td>
                    <td>{assignedTo}</td>
                    <td>
                      {b.claim_status === 'Claimed' ? (
                        <span className="pill onpace">✅ Booked + Assigned</span>
                      ) : withinPriority ? (
                        <span className="pill atrisk">✅ Booked • Locked (24h Referrer Priority)</span>
                      ) : (
                        <span className="pill atrisk">✅ Booked • Unassigned</span>
                      )}
                    </td>
                    <td>
                      <a href={buildAppSubmitPrefillUrl(b)}>
                        <button type="button" className="ghost">Submit App</button>
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      </div>

      <div style={{ display: adminTab === 'payout' ? 'block' : 'none' }}>
        <div className="panel">
          <div className="panelRow" style={{ gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3>Licensed Incentive Payout Queue ({scopeLabel})</h3>
              <span className="muted">Licensed-only payout preview. Excludes Inner Circle + Agency Owners. Paid monthly.</span>
            </div>
          </div>

          {!payoutRows.rows.length ? (
            <p className="muted">No payout-eligible activity captured yet this month.</p>
          ) : (
            <>
              <div className="panelRow" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <span className="muted">Month key: {payoutMonthKey}</span>
                <button type="button" className="ghost" onClick={exportPayoutCsv}>Export CSV</button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Licensed Agent</th>
                    <th>Sponsorship Apps</th>
                    <th>Insurance Apps</th>
                    <th>Sponsorship $</th>
                    <th>Insurance $</th>
                    <th>Estimated Payout</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutRows.rows.map((r) => (
                    <tr key={r.agent}>
                      <td>{r.agent}</td>
                      <td>{r.sponsorshipApps}</td>
                      <td>{r.insuranceApps}</td>
                      <td>${Number(r.sponsorshipDollars || 0).toLocaleString()}</td>
                      <td>${Number(r.insuranceDollars || 0).toLocaleString()}</td>
                      <td><strong>${Number(r.estimatedPayout || 0).toLocaleString()}</strong></td>
                      <td>
                        {payoutStatusMap[cleanName(r.agent)]?.paid
                          ? <span className="pill onpace">Paid</span>
                          : <span className="pill atrisk">Pending Month-End Payout</span>}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={payoutStatusMap[cleanName(r.agent)]?.paid ? 'ghost' : ''}
                          disabled={payoutBusyAgent === cleanName(r.agent)}
                          onClick={() => setPayoutPaid(r.agent, !payoutStatusMap[cleanName(r.agent)]?.paid)}
                        >
                          {payoutBusyAgent === cleanName(r.agent)
                            ? 'Saving…'
                            : (payoutStatusMap[cleanName(r.agent)]?.paid ? 'Mark Unpaid' : 'Mark Paid')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="muted" style={{ marginTop: 10 }}>
                Totals — Sponsorship Apps: {payoutRows.totals.sponsorshipApps} • Insurance Apps: {payoutRows.totals.insuranceApps} • Estimated Payout: ${Number(payoutRows.totals.payout || 0).toLocaleString()} • Paid: ${Number(payoutRows.rows.filter((r) => payoutStatusMap[cleanName(r.agent)]?.paid).reduce((a, r) => a + Number(r.estimatedPayout || 0), 0)).toLocaleString()} • Pending: ${Number(payoutRows.rows.filter((r) => !payoutStatusMap[cleanName(r.agent)]?.paid).reduce((a, r) => a + Number(r.estimatedPayout || 0), 0)).toLocaleString()}
              </p>
              <p className="muted">Rule logic: $1 per sponsorship app (first 10), then $5 per sponsorship app after 10 in same 30-day window; $10 per submitted insurance application. Guardrails and review holds apply.</p>
            </>
          )}
        </div>
      </div>

    </AppShell>
  );
}
