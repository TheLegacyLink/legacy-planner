'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

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

function countdownLabel(ms = 0) {
  if (ms <= 0) return 'Due now';
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin % (60 * 24)) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h ${m}m`;
}

function urgencyForRow(row, nowMs) {
  const due = new Date(row?.payoutDueAt || 0);
  if (Number.isNaN(due.getTime())) return { level: 'none', label: 'No due date', color: '#64748b', diffMs: 0 };

  const diffMs = due.getTime() - nowMs;
  if (diffMs <= 0) return { level: 'overdue', label: 'Overdue', color: '#dc2626', diffMs };
  if (diffMs <= 24 * 60 * 60 * 1000) return { level: 'today', label: 'Pay Today', color: '#ef4444', diffMs };
  if (diffMs <= 7 * 24 * 60 * 60 * 1000) return { level: 'week', label: 'Due This Week', color: '#f59e0b', diffMs };
  if (diffMs <= 14 * 24 * 60 * 60 * 1000) return { level: 'next', label: 'Due Next Week', color: '#eab308', diffMs };
  return { level: 'track', label: 'On Track', color: '#16a34a', diffMs };
}

export default function PayoutQueuePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/policy-submissions', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setRows(Array.isArray(data.rows) ? data.rows : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const queue = useMemo(() => {
    const list = rows
      .filter((r) => String(r.status || '').toLowerCase() === 'approved')
      .filter((r) => String(r.payoutStatus || 'Unpaid').toLowerCase() !== 'paid')
      .map((r) => ({ ...r, urgency: urgencyForRow(r, nowMs) }));

    list.sort((a, b) => {
      const ad = new Date(a.payoutDueAt || 0).getTime() || Number.MAX_SAFE_INTEGER;
      const bd = new Date(b.payoutDueAt || 0).getTime() || Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });
    return list;
  }, [rows, nowMs]);

  const counts = useMemo(() => {
    const out = { overdue: 0, today: 0, week: 0, next: 0, track: 0, none: 0 };
    queue.forEach((r) => { out[r.urgency.level] = (out[r.urgency.level] || 0) + 1; });
    return out;
  }, [queue]);

  async function markPaid(row) {
    setSavingId(row.id);
    try {
      const res = await fetch('/api/policy-submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          patch: {
            payoutStatus: 'Paid',
            payoutPaidAt: new Date().toISOString(),
            payoutPaidBy: 'Kimora'
          }
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...data.row } : r)));
        setMsg(`Marked paid: ${row.applicantName || row.id}`);
      } else {
        setMsg(`Could not mark paid: ${data?.error || 'unknown error'}`);
      }
    } finally {
      setSavingId('');
    }
  }

  return (
    <AppShell title="Payout Queue">
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Approved + Unpaid (Don’t Miss Payroll)</h3>
        <p className="muted">Countdown and urgency view for upcoming payout obligations.</p>

        <div className="grid4" style={{ marginTop: 8 }}>
          <div className="card"><p>Overdue</p><h2>{counts.overdue}</h2></div>
          <div className="card"><p>Pay Today</p><h2>{counts.today}</h2></div>
          <div className="card"><p>Due This Week</p><h2>{counts.week}</h2></div>
          <div className="card"><p>Due Next Week</p><h2>{counts.next}</h2></div>
        </div>
        {msg ? <p className="muted">{msg}</p> : null}
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        {loading ? <p className="muted">Loading...</p> : (
          <table className="table">
            <thead>
              <tr>
                <th>Urgency</th>
                <th>Countdown</th>
                <th>Client</th>
                <th>Referred By</th>
                <th>Writer</th>
                <th>Payout Due</th>
                <th>Payout $</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span style={{ fontWeight: 700, color: r.urgency.color }}>{r.urgency.label}</span>
                  </td>
                  <td>{countdownLabel(r.urgency.diffMs)}</td>
                  <td>{r.applicantName || '—'}</td>
                  <td>{r.referredByName || '—'}</td>
                  <td>{r.policyWriterName || '—'}</td>
                  <td>{fmtDate(r.payoutDueAt)}</td>
                  <td>{money(r.payoutAmount)}</td>
                  <td>
                    <button type="button" onClick={() => markPaid(r)} disabled={savingId === r.id}>
                      {savingId === r.id ? 'Saving...' : 'Mark Paid'}
                    </button>
                  </td>
                </tr>
              ))}
              {!queue.length ? (
                <tr><td colSpan={8} className="muted">No approved unpaid policies in queue.</td></tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
