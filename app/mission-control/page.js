'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { loadRuntimeConfig } from '../../lib/runtimeConfig';
import { applyReferralCorrections, loadReferralCorrections } from '../../lib/referralCorrections';

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

export default function MissionControl() {
  const [config, setConfig] = useState(DEFAULTS);
  const [rows, setRows] = useState([]);
  const [revenueRows, setRevenueRows] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [scope, setScope] = useState('today');

  useEffect(() => {
    setConfig(loadRuntimeConfig());
    setCorrections(loadReferralCorrections());
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [leaderboardRes, revenueRes] = await Promise.all([
          fetch(config.leaderboardUrl, { cache: 'no-store' }),
          fetch(config.revenueUrl, { cache: 'no-store' })
        ]);

        if (!leaderboardRes.ok) throw new Error(`Leaderboard HTTP ${leaderboardRes.status}`);

        const leaderboardJson = await leaderboardRes.json();
        const revenueJson = revenueRes.ok ? await revenueRes.json() : null;

        if (!mounted) return;
        setRows(normalizeRows(leaderboardJson));
        setRevenueRows(normalizeRows(revenueJson));
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
  }, [config.leaderboardUrl, config.revenueUrl, config.refreshIntervalSec]);

  const team = useMemo(() => {
    const baseReferralsByAgent = {};

    config.agents.forEach((agent) => {
      const match = rows.find((r) => cleanName(r.agent_name ?? r.agentName ?? r.name) === cleanName(agent));
      const revenueMatch = revenueRows.find((r) => cleanName(r.agent_name ?? r.agentName ?? r.name) === cleanName(agent));

      const leaderboardReferrals =
        scope === 'month'
          ? Number(byScope(match, 'monthly', ['referral_count', 'referrals'])) ?? 0
          : Number(match?.referral_count ?? match?.referrals ?? (match?.event_type === 'referral' ? 1 : 0) ?? 0) || 0;
      const fallbackReferrals = Number(revenueMatch?.activity_bonus ?? 0) || 0;
      baseReferralsByAgent[agent] = Math.max(leaderboardReferrals, fallbackReferrals);
    });

    const adjustedReferralsByAgent = applyReferralCorrections(baseReferralsByAgent, corrections);

    return config.agents.map((agent) => {
      const match = rows.find((r) => cleanName(r.agent_name ?? r.agentName ?? r.name) === cleanName(agent));

      const referrals = Number(adjustedReferralsByAgent[agent] || 0);
      const apps =
        scope === 'month'
          ? Number(byScope(match, 'monthly', ['app_submitted_count', 'apps_submitted', 'apps'])) ?? 0
          : Number(match?.app_submitted_count ?? match?.apps_submitted ?? match?.apps ?? (match?.event_type === 'app_submitted' ? 1 : 0) ?? 0) || 0;

      const lastActivity = match?.last_activity ?? match?.lastActivity ?? match?.created_date ?? match?.timestamp ?? null;

      return {
        name: agent,
        referrals,
        apps,
        lastActivity,
        status: getStatus(referrals, apps)
      };
    });
  }, [rows, revenueRows, config.agents, corrections, scope]);

  const totals = useMemo(
    () =>
      team.reduce(
        (acc, row) => ({
          referrals: acc.referrals + row.referrals,
          apps: acc.apps + row.apps,
          active: acc.active + (row.referrals + row.apps >= 1 ? 1 : 0)
        }),
        { referrals: 0, apps: 0, active: 0 }
      ),
    [team]
  );

  const scopeLabel = scope === 'today' ? 'Today' : 'This Month';

  const dataConfidence = useMemo(() => {
    if (error) return { label: 'Low', tone: 'offpace', score: 35 };
    const roster = Math.max(1, config.agents.length);
    const rowCoverage = Math.min(1, (rows.length + revenueRows.length) / roster);
    const activityCoverage = team.filter((t) => t.referrals + t.apps > 0).length / roster;
    const score = Math.round((rowCoverage * 0.6 + activityCoverage * 0.4) * 100);
    if (score >= 75) return { label: 'High', tone: 'onpace', score };
    if (score >= 45) return { label: 'Medium', tone: 'atrisk', score };
    return { label: 'Low', tone: 'offpace', score };
  }, [error, config.agents.length, rows.length, revenueRows.length, team]);

  return (
    <AppShell title="Mission Control">
      <div className="panelRow" style={{ gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0 }}>Mission Control Overview</h3>
          <p className="muted" style={{ margin: 0 }}>
            Metrics below update when you switch the execution window.
          </p>
        </div>
        <div className="leaderboardTabs" style={{ marginLeft: 'auto' }}>
          <button className={scope === 'today' ? 'active' : ''} onClick={() => setScope('today')}>
            Today
          </button>
          <button className={scope === 'month' ? 'active' : ''} onClick={() => setScope('month')}>
            Month
          </button>
        </div>
      </div>

      <div className="grid4">
        <div className="card">
          <p>Sponsorship Referrals ({scopeLabel})</p>
          <h2>{totals.referrals}</h2>
          <span className="pill onpace">Source: Leaderboard + Revenue approvals</span>
        </div>
        <div className="card">
          <p>Apps Submitted ({scopeLabel})</p>
          <h2>{totals.apps}</h2>
          <span className="pill onpace">Source: Base44 leaderboard</span>
        </div>
        <div className="card">
          <p>Agents Active ({scopeLabel})</p>
          <h2>{totals.active}/{config.agents.length}</h2>
          <span className={`pill ${totals.active >= 1 ? 'onpace' : 'offpace'}`}>{totals.active >= 1 ? 'On Pace' : 'Off Pace'}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panelRow">
          <h3>Sync Health</h3>
          <span className={`pill ${error ? 'offpace' : 'onpace'}`}>{error ? 'Issue Detected' : 'Connected'}</span>
        </div>
        <p className="muted">Last Successful Sync: {lastSyncAt ? toLocalTime(lastSyncAt, config.timezone) : 'No successful sync yet'}</p>
        <p className="muted">Sources: Leaderboard endpoint + Revenue endpoint + Correction ledger.</p>
        <p className={`pill ${dataConfidence.tone}`} style={{ display: 'inline-block' }}>
          Data Confidence: {dataConfidence.score}% ({dataConfidence.label})
        </p>
      </div>

      <div className="panel">
        <div className="panelRow" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3>Inner Circle Scoreboard</h3>
            <span className="muted">
              Status rule: any activity {scope === 'today' ? 'today' : 'this month'} = On Pace
            </span>
          </div>
        </div>

        {error ? <p className="red">{error}</p> : null}

        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Referrals</th>
              <th>Apps Submitted</th>
              <th>Last Activity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {team.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.referrals}</td>
                <td>{row.apps}</td>
                <td>{toLocalTime(row.lastActivity, config.timezone)}</td>
                <td>
                  <span className={`pill ${row.status === 'On Pace' ? 'onpace' : 'offpace'}`}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
