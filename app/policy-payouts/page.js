'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

const LOCAL_KEY = 'legacy-inner-circle-policy-apps-v1';

function money(v = 0) {
  const n = Number(v || 0) || 0;
  return `$${n.toFixed(2)}`;
}

function fmtDate(iso = '') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function PolicyPayoutsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [savingId, setSavingId] = useState('');
  const [syncMsg, setSyncMsg] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/policy-submissions', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) setRows(Array.isArray(data.rows) ? data.rows : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && String(r.payoutStatus || 'Unpaid').toLowerCase() !== status) return false;
      if (!query) return true;
      const hay = [r.applicantName, r.referredByName, r.policyWriterName, r.submittedBy, r.state, r.policyNumber]
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }, [rows, q, status]);

  const totals = useMemo(() => {
    let unpaid = 0;
    let paid = 0;
    for (const r of filtered) {
      const amt = Number(r.payoutAmount || 0) || 0;
      if (String(r.payoutStatus || 'Unpaid').toLowerCase() === 'paid') paid += amt;
      else unpaid += amt;
    }
    return { unpaid, paid, total: paid + unpaid, count: filtered.length };
  }, [filtered]);

  async function patchRow(id, patch) {
    setSavingId(id);
    try {
      const res = await fetch('/api/policy-submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, patch })
      });
      if (res.ok) await load();
    } finally {
      setSavingId('');
    }
  }

  async function syncLocalBackup() {
    setSyncMsg('Syncing local backup...');
    let local = [];
    try {
      local = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    } catch {
      local = [];
    }
    if (!Array.isArray(local) || !local.length) {
      setSyncMsg('No local backup records found.');
      return;
    }

    let count = 0;
    for (const rec of local) {
      await fetch('/api/policy-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'upsert', record: rec })
      }).catch(() => null);
      count += 1;
    }

    await load();
    setSyncMsg(`Synced ${count} local records.`);
  }

  return (
    <AppShell title="Policy Payout Ledger">
      <div className="panel">
        <div className="panelRow" style={{ gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Submitted Policies + Payout Tracker</h3>
          <button type="button" onClick={syncLocalBackup}>Sync Local App Submit Backup</button>
        </div>
        {syncMsg ? <p className="muted">{syncMsg}</p> : null}

        <div className="settingsGrid" style={{ marginTop: 8 }}>
          <label>
            Search
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client, referred by, writer, state..." />
          </label>
          <label>
            Payout Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </label>
        </div>

        <div className="grid4" style={{ marginTop: 10 }}>
          <div className="card"><p>Policies</p><h2>{totals.count}</h2></div>
          <div className="card"><p>Unpaid</p><h2>{money(totals.unpaid)}</h2></div>
          <div className="card"><p>Paid</p><h2>{money(totals.paid)}</h2></div>
          <div className="card"><p>Total</p><h2>{money(totals.total)}</h2></div>
        </div>
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        {loading ? <p className="muted">Loading...</p> : (
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Referred By</th>
                <th>Policy Writer</th>
                <th>Monthly</th>
                <th>State</th>
                <th>Submitted</th>
                <th>Payout $</th>
                <th>Status</th>
                <th>Paid At</th>
                <th>Paid By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.applicantName || '—'}</td>
                  <td>{r.referredByName || '—'}</td>
                  <td>{r.policyWriterName || '—'}</td>
                  <td>{money(r.monthlyPremium)}</td>
                  <td>{r.state || '—'}</td>
                  <td>{fmtDate(r.submittedAt)}</td>
                  <td>
                    <input
                      style={{ width: 92 }}
                      defaultValue={Number(r.payoutAmount || 0)}
                      onBlur={(e) => patchRow(r.id, { payoutAmount: Number(e.target.value || 0) || 0 })}
                    />
                  </td>
                  <td>
                    <select
                      value={r.payoutStatus || 'Unpaid'}
                      onChange={(e) => patchRow(r.id, {
                        payoutStatus: e.target.value,
                        payoutPaidAt: e.target.value === 'Paid' ? new Date().toISOString() : '',
                        payoutPaidBy: e.target.value === 'Paid' ? 'Kimora' : ''
                      })}
                    >
                      <option value="Unpaid">Unpaid</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </td>
                  <td>{fmtDate(r.payoutPaidAt)}</td>
                  <td>{r.payoutPaidBy || '—'}</td>
                </tr>
              ))}
              {!filtered.length ? (
                <tr><td colSpan={10} className="muted">No policy submissions found yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        )}
        {savingId ? <p className="muted">Saving {savingId}...</p> : null}
      </div>
    </AppShell>
  );
}
