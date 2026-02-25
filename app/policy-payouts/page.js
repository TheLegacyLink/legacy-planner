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

function normalize(v = '') {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function bonusSplit(row) {
  const monthly = Number(row?.monthlyPremium || 0) || 0;
  const maxBonus = Math.min(monthly, 700);
  const referred = normalize(row?.referredByName || '');
  const writer = normalize(row?.policyWriterName || '');
  const writerEligible = !!writer && !!referred && writer !== referred;
  const writerBonus = writerEligible ? Math.min(100, maxBonus) : 0;
  const referralBonus = Math.max(maxBonus - writerBonus, 0);
  return { referralBonus, writerBonus, totalRecommended: maxBonus };
}

export default function PolicyPayoutsPage() {
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [savingId, setSavingId] = useState('');
  const [syncMsg, setSyncMsg] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [rowsRes, usersRes] = await Promise.all([
        fetch('/api/policy-submissions', { cache: 'no-store' }),
        fetch('/api/inner-circle-auth', { cache: 'no-store' })
      ]);
      const rowsData = await rowsRes.json().catch(() => ({}));
      const usersData = await usersRes.json().catch(() => ({}));

      if (rowsRes.ok && rowsData?.ok) setRows(Array.isArray(rowsData.rows) ? rowsData.rows : []);
      if (usersRes.ok && usersData?.ok) setUsers(Array.isArray(usersData.users) ? usersData.users : []);
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


  const monthlyEarnings = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const map = new Map();

    const add = (name, amount) => {
      const n = String(name || '').trim();
      const amt = Number(amount || 0) || 0;
      if (!n || amt <= 0) return;
      map.set(n, Number(map.get(n) || 0) + amt);
    };

    rows.forEach((r) => {
      if (String(r.payoutStatus || '').toLowerCase() !== 'paid') return;
      const paidAt = r.payoutPaidAt ? new Date(r.payoutPaidAt) : null;
      if (!paidAt || Number.isNaN(paidAt.getTime())) return;
      if (paidAt.getMonth() !== month || paidAt.getFullYear() !== year) return;

      const split = bonusSplit(r);
      add(r.referredByName, split.referralBonus);
      if (split.writerBonus > 0) add(r.policyWriterName, split.writerBonus);
      if (split.writerBonus === 0 && split.referralBonus === 0) {
        // fallback for legacy rows paid before split logic
        add(r.referredByName || r.policyWriterName, Number(r.payoutAmount || 0) || 0);
      }
    });

    return [...map.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [rows]);

  async function patchRow(id, patch) {
    setSavingId(id);
    try {
      const res = await fetch('/api/policy-submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, patch })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await load();
        if (data?.email?.ok) setSyncMsg('Saved. Approval notification sent to agent.');
        else setSyncMsg('Saved successfully.');
      } else {
        setSyncMsg(`Save failed: ${data?.error || 'unknown error'}`);
      }
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

  async function importBase44InnerCircle() {
    setSyncMsg('Importing Base44 Inner Circle app submissions...');
    const res = await fetch('/api/policy-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'import_base44' })
    });
    const data = await res.json().catch(() => ({}));
    await load();
    if (res.ok) setSyncMsg(`Imported ${Number(data.imported || 0)} Base44 Inner Circle records.`);
    else setSyncMsg(`Import failed: ${data?.error || 'unknown'}`);
  }


  async function applyRecommendedToAllUnpaid() {
    const targets = rows.filter((r) => String(r.payoutStatus || 'Unpaid').toLowerCase() !== 'paid');
    if (!targets.length) {
      setSyncMsg('No unpaid rows found.');
      return;
    }

    setSyncMsg(`Applying recommended payouts to ${targets.length} unpaid rows...`);
    for (const r of targets) {
      const split = bonusSplit(r);
      await fetch('/api/policy-submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, patch: { payoutAmount: split.totalRecommended } })
      }).catch(() => null);
    }

    await load();
    setSyncMsg(`Applied recommended payout amounts to ${targets.length} unpaid rows.`);
  }

  return (
    <AppShell title="Policy Payout Ledger">
      <div className="panel">
        <div className="panelRow" style={{ gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Submitted Policies + Payout Tracker</h3>
          <button type="button" onClick={syncLocalBackup}>Sync Local App Submit Backup</button>
          <button type="button" onClick={importBase44InnerCircle}>Import Base44 (Inner Circle Only)</button>
          <button type="button" onClick={applyRecommendedToAllUnpaid}>Apply Recommended to All Unpaid</button>
        </div>
        {syncMsg ? <p className="muted">{syncMsg}</p> : null}
        <p className="muted" style={{ marginTop: 6 }}>
          Bonus logic: payout max is monthly premium capped at $700. If writing agent differs from referred owner, writer gets $100 and referral owner gets remaining amount.
        </p>

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
        <h3 style={{ marginTop: 0 }}>Inner Circle Earnings This Month (Paid)</h3>
        {monthlyEarnings.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Paid This Month</th>
              </tr>
            </thead>
            <tbody>
              {monthlyEarnings.map((e) => (
                <tr key={e.name}>
                  <td>{e.name}</td>
                  <td>{money(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">No paid records this month yet.</p>}
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
                <th>Referral Bonus</th>
                <th>Writer Bonus</th>
                <th>Recommended Total</th>
                <th>State</th>
                <th>Submitted</th>
                <th>Approval</th>
                <th>Payout Due</th>
                <th>Payout $</th>
                <th>Payout Status</th>
                <th>Paid At</th>
                <th>Paid By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const split = bonusSplit(r);
                return (
                  <tr key={r.id}>
                    <td>{r.applicantName || '—'}</td>
                    <td>{r.referredByName || '—'}</td>
                    <td>
                      <select
                        value={r.policyWriterName || ''}
                        onChange={(e) => patchRow(r.id, { policyWriterName: e.target.value })}
                      >
                        <option value="">Select writer</option>
                        {users.map((u) => <option key={`writer-${u.name}`} value={u.name}>{u.name}</option>)}
                        <option value="Other">Other</option>
                      </select>
                    </td>
                    <td>{money(r.monthlyPremium)}</td>
                    <td>{money(split.referralBonus)}</td>
                    <td>{money(split.writerBonus)}</td>
                    <td>{money(split.totalRecommended)}</td>
                    <td>{r.state || '—'}</td>
                    <td>{fmtDate(r.submittedAt)}</td>
                    <td>
                      {String(r.status || '').toLowerCase() === 'approved' ? (
                        <span className="pill onpace">Approved</span>
                      ) : (
                        <button type="button" onClick={() => patchRow(r.id, { status: 'Approved' })}>Approve + Notify</button>
                      )}
                    </td>
                    <td>{fmtDate(r.payoutDueAt)}</td>
                    <td>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <input
                          style={{ width: 92 }}
                          defaultValue={Number(r.payoutAmount || 0)}
                          onBlur={(e) => patchRow(r.id, { payoutAmount: Number(e.target.value || 0) || 0 })}
                        />
                        <button type="button" className="ghost" onClick={() => patchRow(r.id, { payoutAmount: split.totalRecommended })}>
                          Use calc
                        </button>
                      </div>
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
                );
              })}
              {!filtered.length ? (
                <tr><td colSpan={15} className="muted">No policy submissions found yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        )}
        {savingId ? <p className="muted">Saving {savingId}...</p> : null}
      </div>
    </AppShell>
  );
}
