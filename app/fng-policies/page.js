'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../../components/AppShell';
import fngPolicies from '../../data/fngPolicies.json';
import requirementsFollowup from '../../data/sponsorshipRequirementsFollowup.json';

const THRESHOLD_DEFAULT = 500;

function monthsSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  return Math.max(months, 0);
}

function statusBucket(status = '') {
  const s = status.toLowerCase();
  if (s === 'active') return 'active';
  if (s.includes('pending lapse')) return 'pending_lapse';
  return 'non_active';
}

function addMonths(dateStr, monthsToAdd) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const out = new Date(d);
  out.setMonth(out.getMonth() + monthsToAdd);
  return out;
}

function formatDate(dateLike) {
  if (!dateLike) return '—';
  const d = typeof dateLike === 'string' ? new Date(dateLike + 'T00:00:00') : dateLike;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

export default function FngPoliciesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [queueFilter, setQueueFilter] = useState('all');
  const [threshold, setThreshold] = useState(THRESHOLD_DEFAULT);
  const [programOverrides, setProgramOverrides] = useState({});
  const [syncStatus, setSyncStatus] = useState('');
  const importRef = useRef(null);

  const requirementsMap = useMemo(() => {
    const map = new Map();
    (requirementsFollowup || []).forEach((row) => {
      const policy = String(row.policy_number || '').toUpperCase().trim();
      if (policy) map.set(policy, row);
    });
    return map;
  }, []);

  async function persistRemote(nextThreshold, nextOverrides) {
    try {
      await fetch('/api/fng-program-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: nextThreshold, overrides: nextOverrides })
      });
      setSyncStatus('Saved across devices');
    } catch {
      setSyncStatus('Saved locally (sync issue)');
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      let localOverrides = {};
      try {
        const raw = localStorage.getItem('fng_program_overrides_v1');
        if (raw) localOverrides = JSON.parse(raw);
      } catch {
        localOverrides = {};
      }

      try {
        const res = await fetch('/api/fng-program-overrides', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!mounted || !res.ok || !data?.ok) throw new Error('remote_load_failed');

        const remoteOverrides = data.overrides || {};
        const mergedOverrides = Object.keys(remoteOverrides).length ? remoteOverrides : localOverrides;

        setThreshold(Number(data.threshold || THRESHOLD_DEFAULT));
        setProgramOverrides(mergedOverrides);
        localStorage.setItem('fng_program_overrides_v1', JSON.stringify(mergedOverrides));

        // One-time seed if remote empty but local had data
        if (!Object.keys(remoteOverrides).length && Object.keys(localOverrides).length) {
          persistRemote(Number(data.threshold || THRESHOLD_DEFAULT), mergedOverrides);
        }

        setSyncStatus('Saved across devices');
      } catch {
        setProgramOverrides(localOverrides);
        setSyncStatus('Saved locally (sync issue)');
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  function persistOverrides(next) {
    setProgramOverrides(next);
    localStorage.setItem('fng_program_overrides_v1', JSON.stringify(next));
    persistRemote(threshold, next);
  }

  function setOverride(policyNumber, value) {
    const next = { ...programOverrides };
    if (value === 'auto') {
      delete next[policyNumber];
    } else {
      next[policyNumber] = value;
    }
    persistOverrides(next);
  }

  function setThresholdAndPersist(nextThreshold) {
    const normalized = Number(nextThreshold || 0);
    setThreshold(normalized);
    persistRemote(normalized, programOverrides);
  }

  function exportOverrides() {
    const payload = {
      exportedAt: new Date().toISOString(),
      overrides: programOverrides
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fng-program-overrides.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importOverrides(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incoming = parsed?.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {};
      const cleaned = {};
      for (const [policy, type] of Object.entries(incoming)) {
        if (!policy) continue;
        if (['regular', 'sponsorship', 'jumpstart'].includes(String(type).toLowerCase())) {
          cleaned[policy] = String(type).toLowerCase();
        }
      }
      persistOverrides(cleaned);
    } catch {
      alert('Import failed. Please upload a valid fng-program-overrides.json file.');
    }
  }

  const enriched = useMemo(() => {
    return fngPolicies.map((p) => {
      const months = monthsSince(p.policy_effective_date);
      const monthsSinceIssue = monthsSince(p.policy_issued_date);
      const monthsToAnnual = monthsSinceIssue === null ? null : Math.max(12 - monthsSinceIssue, 0);
      const annualDate = addMonths(p.policy_issued_date, 12);

      let annualReminder = 'No issue date';
      let annualReminderLevel = 'muted';
      if (monthsSinceIssue !== null) {
        if (monthsSinceIssue < 11) {
          annualReminder = `${12 - monthsSinceIssue} mo to annual`;
          annualReminderLevel = 'onpace';
        } else if (monthsSinceIssue === 11) {
          annualReminder = '1 mo to annual';
          annualReminderLevel = 'atrisk';
        } else if (monthsSinceIssue === 12) {
          annualReminder = 'Annual month now';
          annualReminderLevel = 'atrisk';
        } else {
          annualReminder = `${monthsSinceIssue - 12} mo past annual`;
          annualReminderLevel = 'atrisk';
        }
      }

      const modal = typeof p.modal_premium === 'number' ? p.modal_premium : 0;
      const autoProgram = modal >= Number(threshold) ? 'sponsorship' : 'regular';
      const manual = programOverrides[p.policy_number];
      const programType = manual || autoProgram;

      const windowMonth = months !== null && months >= 10 && months <= 12 ? months : null;
      const payWindowRelevant = windowMonth !== null && programType === 'regular';

      const req = requirementsMap.get(String(p.policy_number || '').toUpperCase().trim()) || null;

      return {
        ...p,
        status_bucket: statusBucket(p.policy_status),
        months_since_effective: months,
        months_since_issue: monthsSinceIssue,
        months_to_annual: monthsToAnnual,
        annual_date: annualDate,
        annual_reminder: annualReminder,
        annual_reminder_level: annualReminderLevel,
        annual_due_in_one_month: monthsSinceIssue === 11,
        annual_month_now: monthsSinceIssue === 12,
        annual_past_due: monthsSinceIssue !== null && monthsSinceIssue > 12,
        window_month: windowMonth,
        program_type: programType,
        auto_program_type: autoProgram,
        pay_window_relevant: payWindowRelevant,
        requirements_pending: !!req,
        requirements_count: Number(req?.pending || 0),
        requirements_name: req?.name || ''
      };
    });
  }, [threshold, programOverrides, requirementsMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched
      .filter((p) => (statusFilter === 'all' ? true : p.status_bucket === statusFilter))
      .filter((p) => (programFilter === 'all' ? true : p.program_type === programFilter))
      .filter((p) => (queueFilter === 'all' ? true : p.requirements_pending))
      .filter((p) => {
        if (!q) return true;
        return [
          p.writing_agent_name,
          p.writing_agent_number,
          p.policy_number,
          p.owner_name,
          p.policy_status,
          p.issued_state,
          p.product_name
        ]
          .join(' ')
          .toLowerCase()
          .includes(q);
      });
  }, [enriched, statusFilter, programFilter, queueFilter, search]);

  const stats = useMemo(() => {
    const out = {
      total: filtered.length,
      active: 0,
      pendingLapse: 0,
      nonActive: 0,
      payWindow: 0,
      annualDueInOneMonth: 0,
      annualMonthNow: 0,
      annualPastDue: 0,
      sponsorshipMonthly: 0,
      sponsorshipPeople: 0,
      requirementsQueue: 0
    };
    const sponsoredPeople = new Set();

    for (const p of filtered) {
      if (p.status_bucket === 'active') out.active += 1;
      else if (p.status_bucket === 'pending_lapse') out.pendingLapse += 1;
      else out.nonActive += 1;
      if (p.pay_window_relevant) out.payWindow += 1;
      if (p.annual_due_in_one_month) out.annualDueInOneMonth += 1;
      if (p.annual_month_now) out.annualMonthNow += 1;
      if (p.annual_past_due) out.annualPastDue += 1;
      if (p.requirements_pending) out.requirementsQueue += 1;
      if (p.program_type === 'sponsorship') {
        if (typeof p.modal_premium === 'number') out.sponsorshipMonthly += p.modal_premium;
        const personKey = (p.owner_name || p.policy_number || '').trim().toUpperCase();
        if (personKey) sponsoredPeople.add(personKey);
      }
    }

    out.sponsorshipPeople = sponsoredPeople.size;
    return out;
  }, [filtered]);

  return (
    <AppShell title="F&G Book of Business">
      <div className="panel">
        <div className="panelRow" style={{ marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
          <span className="pill onpace">Total: {stats.total}</span>
          <span className="pill">Active: {stats.active}</span>
          <span className="pill atrisk">Pending Lapse: {stats.pendingLapse}</span>
          <span className="pill">Non-Active: {stats.nonActive}</span>
          <span className="pill">10/11/12-Mo Pay Window: {stats.payWindow}</span>
          <span className="pill atrisk">Annual in 1 Month: {stats.annualDueInOneMonth}</span>
          <span className="pill atrisk">Annual This Month: {stats.annualMonthNow}</span>
          <span className="pill atrisk">Past Annual: {stats.annualPastDue}</span>
          <span className="pill onpace">Sponsorship Monthly: ${stats.sponsorshipMonthly.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          <span className="pill onpace">Sponsored People: {stats.sponsorshipPeople}</span>
          <span className="pill atrisk">Requirements Queue: {stats.requirementsQueue}</span>
        </div>

        <div className="panelRow" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <button type="button" onClick={exportOverrides}>Export Tags</button>
          <button type="button" onClick={() => importRef.current?.click()}>Import Tags</button>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => importOverrides(e.target.files?.[0])}
          />
          <span className="muted">{syncStatus || 'Saving changes…'}</span>
        </div>

        <div className="panelRow" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="muted">Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="pending_lapse">Pending Lapse</option>
              <option value="non_active">Non-Active</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span className="muted">Program Type</span>
            <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="regular">Regular</option>
              <option value="sponsorship">Sponsorship</option>
              <option value="jumpstart">JumpStart</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span className="muted">Requirements Tab</span>
            <select value={queueFilter} onChange={(e) => setQueueFilter(e.target.value)}>
              <option value="all">All Policies</option>
              <option value="requirements">Needs Requirements</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span className="muted">Sponsorship premium &gt;</span>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThresholdAndPersist(Number(e.target.value || 0))}
              style={{ maxWidth: 120 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6, minWidth: 280, flex: 1 }}>
            <span className="muted">Search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Agent, policy #, owner, state..."
            />
          </label>
        </div>

        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Policy #</th>
              <th>Status</th>
              <th>Issued/Eff Date + 12-Mo Annual</th>
              <th>Modal Premium</th>
              <th>Program</th>
              <th>Requirements</th>
              <th>10/11/12</th>
              <th>Owner</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.policy_number} style={p.requirements_pending ? { background: 'rgba(239,68,68,0.10)' } : undefined}>
                <td>
                  <strong>{p.writing_agent_name || '—'}</strong>
                  <div className="muted">{p.writing_agent_number || ''}</div>
                </td>
                <td>{p.policy_number}</td>
                <td>
                  <span className={`pill ${p.status_bucket === 'active' ? 'onpace' : 'atrisk'}`}>{p.policy_status}</span>
                </td>
                <td>
                  <div>{p.policy_issued_date || '—'}</div>
                  <div className="muted">Eff: {p.policy_effective_date || '—'}</div>
                  <div className="muted">12-Mo: {formatDate(p.annual_date)}</div>
                  {p.months_to_annual !== null ? (
                    <span className={`pill ${p.annual_reminder_level === 'atrisk' ? 'atrisk' : 'onpace'}`}>
                      {p.annual_reminder}
                    </span>
                  ) : (
                    <span className="muted">No reminder</span>
                  )}
                </td>
                <td>{p.modal_premium != null ? `$${p.modal_premium.toLocaleString()}` : '—'}</td>
                <td>
                  <select
                    value={programOverrides[p.policy_number] || 'auto'}
                    onChange={(e) => setOverride(p.policy_number, e.target.value)}
                  >
                    <option value="auto">Auto ({p.auto_program_type})</option>
                    <option value="regular">Regular</option>
                    <option value="sponsorship">Sponsorship</option>
                    <option value="jumpstart">JumpStart</option>
                  </select>
                  <div className="muted">Using: {p.program_type}</div>
                </td>
                <td>
                  {p.requirements_pending ? (
                    <span className="pill atrisk">Needs docs ({p.requirements_count})</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {p.window_month ? (
                    <span className={`pill ${p.pay_window_relevant ? 'atrisk' : 'onpace'}`}>
                      M{p.window_month} {p.pay_window_relevant ? 'Pay Agent' : 'Legacy Link'}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{p.owner_name || '—'}</td>
                <td>{p.issued_state_code || p.issued_state || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
