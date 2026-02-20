'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../../components/AppShell';
import fngPolicies from '../../data/fngPolicies.json';

const CUTOFF_DEFAULT = '2025-11-01';
const THRESHOLD_DEFAULT = 300;

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

export default function FngPoliciesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [cutoffDate, setCutoffDate] = useState(CUTOFF_DEFAULT);
  const [threshold, setThreshold] = useState(THRESHOLD_DEFAULT);
  const [programOverrides, setProgramOverrides] = useState({});
  const importRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fng_program_overrides_v1');
      if (raw) setProgramOverrides(JSON.parse(raw));
    } catch {
      setProgramOverrides({});
    }
  }, []);

  function persistOverrides(next) {
    setProgramOverrides(next);
    localStorage.setItem('fng_program_overrides_v1', JSON.stringify(next));
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
    const cutoff = cutoffDate ? new Date(cutoffDate + 'T00:00:00') : null;

    return fngPolicies.map((p) => {
      const months = monthsSince(p.policy_effective_date);
      const modal = typeof p.modal_premium === 'number' ? p.modal_premium : 0;
      const issued = p.policy_issued_date ? new Date(p.policy_issued_date + 'T00:00:00') : null;
      const autoProgram = cutoff && issued && issued >= cutoff && modal > Number(threshold) ? 'sponsorship' : 'regular';
      const manual = programOverrides[p.policy_number];
      const programType = manual || autoProgram;

      const windowMonth = months !== null && months >= 10 && months <= 12 ? months : null;
      const payWindowRelevant = windowMonth !== null && programType === 'regular';

      return {
        ...p,
        status_bucket: statusBucket(p.policy_status),
        months_since_effective: months,
        window_month: windowMonth,
        program_type: programType,
        auto_program_type: autoProgram,
        pay_window_relevant: payWindowRelevant
      };
    });
  }, [cutoffDate, threshold, programOverrides]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched
      .filter((p) => (statusFilter === 'all' ? true : p.status_bucket === statusFilter))
      .filter((p) => (programFilter === 'all' ? true : p.program_type === programFilter))
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
  }, [enriched, statusFilter, programFilter, search]);

  const stats = useMemo(() => {
    const out = {
      total: filtered.length,
      active: 0,
      pendingLapse: 0,
      nonActive: 0,
      payWindow: 0,
      sponsorshipMonthly: 0,
      sponsorshipPeople: 0
    };
    const sponsoredPeople = new Set();

    for (const p of filtered) {
      if (p.status_bucket === 'active') out.active += 1;
      else if (p.status_bucket === 'pending_lapse') out.pendingLapse += 1;
      else out.nonActive += 1;
      if (p.pay_window_relevant) out.payWindow += 1;
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
          <span className="pill onpace">Sponsorship Monthly: ${stats.sponsorshipMonthly.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          <span className="pill onpace">Sponsored People: {stats.sponsorshipPeople}</span>
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
          <span className="muted">Tag edits auto-save on this browser. Export/import to carry to another device.</span>
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
            <span className="muted">Sponsorship cutoff</span>
            <input type="date" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span className="muted">Sponsorship premium &gt;</span>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value || 0))}
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
              <th>Issued/Eff Date</th>
              <th>Modal Premium</th>
              <th>Program</th>
              <th>10/11/12</th>
              <th>Owner</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.policy_number}>
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
