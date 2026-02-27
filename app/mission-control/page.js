'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { loadRuntimeConfig } from '../../lib/runtimeConfig';
import { loadSponsorshipBookings, saveSponsorshipBookings } from '../../lib/sponsorshipBookings';

const DEFAULTS = loadRuntimeConfig();

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
  const direct = row?.referralName || row?.referred_by || row?.referredBy || '';
  let mapped = matchAgentFromReferrer(direct, agents);
  if (mapped) return mapped;

  const refCode = String(row?.refCode || row?.referral_code || '').replace(/[_-]+/g, ' ');
  mapped = matchAgentFromReferrer(refCode, agents);
  return mapped || null;
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
  const [sponsorshipSyncIssue, setSponsorshipSyncIssue] = useState('');
  const [manualReviewCount, setManualReviewCount] = useState(0);
  const [bookingQueue, setBookingQueue] = useState([]);
  const [claimBy, setClaimBy] = useState('');
  const [detailsModal, setDetailsModal] = useState({ open: false, type: '' });
  const [contactsVaultSummary, setContactsVaultSummary] = useState({ total: 0, withEmail: 0, withoutEmail: 0 });
  const [contactsVaultUpdatedAt, setContactsVaultUpdatedAt] = useState('');
  const [contactsCsvMsg, setContactsCsvMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const scopeLabel = 'This Month';

  useEffect(() => {
    const cfg = loadRuntimeConfig();
    setConfig(cfg);
    setBookingQueue(loadSponsorshipBookings());
    setClaimBy(cfg.agents?.[0] || '');

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
        const [leaderboardRes, revenueRes, sponsorshipRes, manualReviewRes, policySubmissionsRes] = await Promise.all([
          fetch(config.leaderboardUrl, { cache: 'no-store' }),
          fetch(config.revenueUrl, { cache: 'no-store' }),
          fetch(config.sponsorshipTrackerUrl, { cache: 'no-store' }),
          fetch('/api/sponsorship-applications', { cache: 'no-store' }),
          fetch('/api/policy-submissions', { cache: 'no-store' })
        ]);

        if (!leaderboardRes.ok) throw new Error(`Leaderboard HTTP ${leaderboardRes.status}`);

        const leaderboardJson = await leaderboardRes.json();
        const revenueJson = revenueRes.ok ? await revenueRes.json() : null;

        const monthlyApprovals = {};
        const todayApprovals = {};
        const todayDetails = [];
        let sponsorshipIssue = '';
        let reviewCount = 0;
        const monthlyApps = {};
        const todayApps = {};

        if (manualReviewRes.ok) {
          const reviewJson = await manualReviewRes.json().catch(() => ({}));
          const reviewRows = Array.isArray(reviewJson?.rows) ? reviewJson.rows : [];
          reviewCount = reviewRows.filter((r) => String(r?.decision_bucket || '').toLowerCase() === 'manual_review').length;

          for (const r of reviewRows) {
            const submitted = new Date(r?.submitted_at || r?.createdAt || r?.updatedAt || 0);
            if (Number.isNaN(submitted.getTime())) continue;
            const mapped = mapApplicationToAgent(r, config.agents);
            if (!mapped) continue;

            if (sameMonthYear(submitted)) {
              monthlyApps[mapped] = Number(monthlyApps[mapped] || 0) + 1;
            }
            if (sameDay(submitted)) {
              todayApps[mapped] = Number(todayApps[mapped] || 0) + 1;
            }
          }
        }

        // Include policy-submission app flow so Mission Control reflects real same-day app submissions.
        if (policySubmissionsRes.ok) {
          const policyJson = await policySubmissionsRes.json().catch(() => ({}));
          const policyRows = Array.isArray(policyJson?.rows) ? policyJson.rows : [];

          for (const r of policyRows) {
            const submitted = new Date(r?.submittedAt || r?.createdAt || r?.updatedAt || 0);
            if (Number.isNaN(submitted.getTime())) continue;

            const mapped =
              matchAgentFromReferrer(r?.referredByName || '', config.agents) ||
              matchAgentFromReferrer(r?.submittedBy || '', config.agents) ||
              matchAgentFromReferrer(r?.policyWriterName || '', config.agents);
            if (!mapped) continue;

            if (sameMonthYear(submitted)) {
              monthlyApps[mapped] = Number(monthlyApps[mapped] || 0) + 1;
            }
            if (sameDay(submitted)) {
              todayApps[mapped] = Number(todayApps[mapped] || 0) + 1;
            }
          }
        }

        if (sponsorshipRes.ok) {
          const sponsorshipText = await sponsorshipRes.text();
          const payload = parseGvizPayload(sponsorshipText);
          const cols = (payload?.table?.cols || []).map((c) => (c?.label || '').trim());
          const cName = cols.indexOf('Name');
          const cRef = cols.indexOf('Referred By');
          const cApproved = cols.indexOf('Approved Date');

          for (const row of payload?.table?.rows || []) {
            const cells = row.c || [];
            const approved = parseGvizDate(cells[cApproved]?.v || '');
            if (!sameMonthYear(approved)) continue;

            const ref = cells[cRef]?.v ? String(cells[cRef].v) : '';
            const name = cells[cName]?.v ? String(cells[cName].v) : 'Unknown';
            const mapped = matchAgentFromReferrer(ref, config.agents);
            if (!mapped) continue;
            monthlyApprovals[mapped] = Number(monthlyApprovals[mapped] || 0) + 1;
            if (sameDay(approved)) {
              todayApprovals[mapped] = Number(todayApprovals[mapped] || 0) + 1;
              todayDetails.push({
                name,
                referredBy: ref || '—',
                mappedAgent: mapped,
                approvedDate: approved
              });
            }
          }
        } else {
          sponsorshipIssue = `Sponsorship tracker HTTP ${sponsorshipRes.status}`;
        }

        if (!mounted) return;
        setRows(normalizeRows(leaderboardJson));
        setRevenueRows(normalizeRows(revenueJson));
        setSponsorshipApprovalsByAgent(monthlyApprovals);
        setSponsorshipTodayApprovalsByAgent(todayApprovals);
        setSponsorshipAppsByAgent(monthlyApps);
        setSponsorshipTodayAppsByAgent(todayApps);
        setTodaySponsorshipDetails(todayDetails);
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

      const base44MonthlyAppsByAgent = byScope(match, 'monthly', ['app_submitted_count', 'apps_submitted', 'apps']);
      const base44MonthApps =
        base44MonthlyAppsByAgent !== null
          ? base44MonthlyAppsByAgent
          : Number(match?.app_submitted_count ?? match?.apps_submitted ?? match?.apps ?? (match?.event_type === 'app_submitted' ? 1 : 0) ?? 0) || 0;

      const base44TodayApps = Number(match?.apps_submitted_count_today ?? match?.app_submitted_count_today ?? match?.apps_today ?? 0) || 0;
      const localMonthApps = Number(sponsorshipAppsByAgent[agent] || 0);
      const localTodayApps = Number(sponsorshipTodayAppsByAgent[agent] || 0);

      // Sponsorship referrals are counted as completed sponsorship applications (Base44 + local app form).
      const monthReferrals = base44MonthApps + localMonthApps;
      const monthApps = monthReferrals;
      const todayReferrals = base44TodayApps + localTodayApps;
      const todayApps = todayReferrals;

      const sheetApprovals = Number(sponsorshipApprovalsByAgent[agent] || 0);
      const sheetTodayApprovals = Number(sponsorshipTodayApprovalsByAgent[agent] || 0);
      const pendingRevenueSync = Math.max(sheetApprovals - monthReferrals, 0);
      const todayPendingSync = Math.max(sheetTodayApprovals - todayReferrals, 0);

      // Today should reflect true same-day sponsorship approvals from Sponsorship Tracker,
      // not potentially cumulative values from leaderboard "today" fields.
      const effectiveTodayReferrals = sheetTodayApprovals;
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

  const todayAppDetails = useMemo(
    () => team.filter((t) => t.todayApps > 0).map((t) => ({ agent: t.name, count: t.todayApps })),
    [team]
  );

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

  const claimBooking = (bookingId, claimer) => {
    if (!claimer) return;
    const now = new Date().toISOString();
    const next = bookingQueue.map((item) => {
      if (item.id !== bookingId) return item;

      const withinPriority = isWithinPriorityWindow(item);
      if (withinPriority && item.priority_agent && cleanName(claimer) !== cleanName(item.priority_agent)) {
        return item;
      }

      return {
        ...item,
        claim_status: 'Claimed',
        claimed_by: claimer,
        claimed_at: now
      };
    });
    setBookingQueue(next);
    saveSponsorshipBookings(next);
  };

  const openBookingToOthers = (bookingId) => {
    const next = bookingQueue.map((item) =>
      item.id === bookingId
        ? {
            ...item,
            priority_released: true,
            claim_status: item.claim_status === 'Claimed' ? item.claim_status : 'Open'
          }
        : item
    );
    setBookingQueue(next);
    saveSponsorshipBookings(next);
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
          <span className="pill onpace">Source: Sponsorship app submissions (Base44 + local)</span>
        </div>
        <div className="card">
          <p>Apps Submitted ({scopeLabel})</p>
          <h2>{totals.month.apps}</h2>
          <span className="pill onpace">Source: Base44 leaderboard</span>
        </div>
        <div className="card">
          <p>Agents Active ({scopeLabel})</p>
          <h2>{totals.month.active}/{config.agents.length}</h2>
          <span className={`pill ${totals.month.active >= 1 ? 'onpace' : 'offpace'}`}>{totals.month.active >= 1 ? 'On Pace' : 'Off Pace'}</span>
        </div>
        <div className="card">
          <p>Approved Pending Revenue Sync</p>
          <h2>{totals.month.pendingSync}</h2>
          <span className={`pill ${totals.month.pendingSync > 0 ? 'atrisk' : 'onpace'}`}>
            {totals.month.pendingSync > 0 ? 'Needs Sync Follow-up' : 'Fully Synced'}
          </span>
        </div>
      </div>

      <div className="grid4">
        <div className="card">
          <p>Sponsorship Referrals (Today)</p>
          <h2>{totals.today.referrals}</h2>
          <span className={`pill ${totals.today.pendingSync > 0 ? 'atrisk' : 'onpace'}`}>
            {totals.today.pendingSync > 0 ? `${totals.today.pendingSync} pending Base44 sync` : 'Daily app submissions'}
          </span>
          <div style={{ marginTop: 8 }}>
            <button type="button" className="ghost" onClick={() => setDetailsModal({ open: true, type: 'referrals' })}>
              View names below
            </button>
          </div>
        </div>
        <div className="card">
          <p>Apps Submitted (Today)</p>
          <h2>{totals.today.apps}</h2>
          <span className="pill onpace">Daily app submissions</span>
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
              <th>Apps Submitted</th>
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
                {detailsModal.type === 'referrals' ? 'Today Sponsorship Referrals' : 'Today Applications Submitted'}
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
                      <th>Approved</th>
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
            ) : todayAppDetails.length ? (
              <>
                <table>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Apps Today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayAppDetails.map((item) => (
                      <tr key={item.agent}>
                        <td>{item.agent}</td>
                        <td>{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="muted" style={{ marginTop: 10 }}>
                  Note: Base44 leaderboard currently returns app counts by agent, not individual applicant names.
                </p>
              </>
            ) : (
              <p className="muted">No applications submitted today yet.</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div className="panelRow" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3>Sponsorship Booking Queue</h3>
            <span className="muted">Claim this appointment workflow</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="muted">Claim as</span>
            <select value={claimBy} onChange={(e) => setClaimBy(e.target.value)}>
              {config.agents.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
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
                <th>Licensed</th>
                <th>Requested (EST)</th>
                <th>Eligible Closers</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {bookingQueue.map((b) => (
                <tr key={b.id}>
                  <td>{b.referred_by || '—'}</td>
                  <td>{b.applicant_name || '—'}</td>
                  <td>{b.applicant_state || '—'}</td>
                  <td>{b.licensed_status || '—'}</td>
                  <td>{b.requested_at_est || '—'}</td>
                  <td>{Array.isArray(b.eligible_closers) && b.eligible_closers.length ? b.eligible_closers.join(', ') : 'Not mapped'}</td>
                  <td>
                    {(() => {
                      const withinPriority = isWithinPriorityWindow(b);
                      if (b.claim_status === 'Claimed') {
                        return <span className="pill onpace">{`Claimed by ${b.claimed_by}`}</span>;
                      }
                      if (withinPriority) {
                        return <span className="pill atrisk">Reserved for {b.priority_agent} (24h)</span>;
                      }
                      return <span className="pill atrisk">Open</span>;
                    })()}
                  </td>
                  <td>
                    {b.claim_status === 'Claimed' ? '—' : (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => claimBooking(b.id, claimBy)}
                          disabled={isWithinPriorityWindow(b) && cleanName(claimBy) !== cleanName(b.priority_agent || '')}
                        >
                          Claim
                        </button>
                        {isWithinPriorityWindow(b) && cleanName(claimBy) === cleanName(b.priority_agent || '') ? (
                          <button type="button" className="ghost" onClick={() => openBookingToOthers(b.id)}>Open to Others</button>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </AppShell>
  );
}
