'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

function money(v = 0) {
  const n = Number(v || 0) || 0;
  return `$${n.toFixed(2)}`;
}

function fmtDate(iso = '') {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}


function normalize(v = '') {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function toChicagoDay(ms) {
  return new Date(ms).toLocaleDateString('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'
  });
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

function effectivePayoutAmount(row) {
  const explicit = Number(row?.payoutAmount || 0) || 0;
  if (explicit > 0) return explicit;
  return bonusSplit(row).totalRecommended;
}

function countdownLabel(urgency) {
  if (urgency.level === 'today') return 'Today';
  if (urgency.level === 'overdue') return 'Overdue';
  const ms = urgency.diffMs;
  if (ms <= 0) return 'Due now';
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin % (60 * 24)) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h ${m}m`;
}

function thisWeekFridayIso() {
  const now = new Date();
  const day = now.getDay(); // 0 Sun ... 6 Sat
  const mondayOffset = (day + 6) % 7;
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - mondayOffset);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4); // this week's Friday
  friday.setHours(12, 0, 0, 0);
  return friday.toISOString();
}

function urgencyForRow(row, nowMs) {
  const due = new Date(row?.payoutDueAt || 0);
  if (Number.isNaN(due.getTime())) return { level: 'none', label: 'No due date', color: '#64748b', diffMs: 0 };

  const diffMs = due.getTime() - nowMs;
  const dueDay = toChicagoDay(due.getTime());
  const todayDay = toChicagoDay(nowMs);

  // Same CST calendar day = Pay Today (full 12am-11:59pm window, regardless of exact time)
  if (dueDay === todayDay) return { level: 'today', label: 'Pay Today', color: '#ef4444', diffMs };
  if (diffMs <= 0) return { level: 'overdue', label: 'Overdue', color: '#dc2626', diffMs };
  if (diffMs <= 7 * 24 * 60 * 60 * 1000) return { level: 'week', label: 'Due This Week', color: '#f59e0b', diffMs };
  if (diffMs <= 14 * 24 * 60 * 60 * 1000) return { level: 'next', label: 'Due Next Week', color: '#eab308', diffMs };
  return { level: 'track', label: 'On Track', color: '#16a34a', diffMs };
}

const IC_NET_PCT = 0.75; // IC member receives 75%; 25% goes toward program balance

// Elite IC program config — mirrors ELITE_IC_REFERRERS in api/policy-submissions/route.js
const ELITE_IC_CONFIG = [
  { name: 'Leticia Wright', totalProgramValue: 40000, initialDeposit: 3000, effectiveFrom: '2026-06-01' },
];

function computeIcBalance(memberName, allRows) {
  const config = ELITE_IC_CONFIG.find((c) => normalize(c.name) === normalize(memberName));
  if (!config) return null;
  const icNorm = normalize(memberName);
  const cumulativePolicyPayouts = allRows
    .filter((r) => String(r.payoutStatus || '').toLowerCase() === 'paid')
    .filter((r) => normalize(r.referredByName || '') === icNorm || normalize(r.policyWriterName || '') === icNorm)
    .reduce((s, r) => s + (Number(r.payoutAmount || 0) * IC_NET_PCT), 0);
  const totalPaid = config.initialDeposit + cumulativePolicyPayouts;
  const remaining = config.totalProgramValue - totalPaid;
  return {
    totalProgramValue: config.totalProgramValue,
    initialDeposit: config.initialDeposit,
    cumulativePolicyPayouts,
    totalPaid,
    remaining,
  };
}

function icRole(row, memberName) {
  const n = normalize(memberName);
  const isRef = normalize(row?.referredByName || '') === n;
  const isWriter = normalize(row?.policyWriterName || '') === n;
  if (isRef && isWriter) return 'Referral + Policy Writer';
  if (isWriter) return 'Policy Writer';
  return 'Referral';
}

export default function PayoutQueuePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());
  const [msg, setMsg] = useState('');
  const [selectedIds, setSelectedIds] = useState({});
  const [batchSaving, setBatchSaving] = useState('');
  const [movingId, setMovingId] = useState('');

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

  // Group ALL approved+unpaid IC-member payouts (not just today's)
  const icBatchGroups = useMemo(() => {
    const pending = rows
      .filter((r) => String(r.status || '').toLowerCase() === 'approved')
      .filter((r) => String(r.payoutStatus || 'Unpaid').toLowerCase() !== 'paid')
      .filter((r) => Boolean(r.icPayee));
    const byMember = {};
    pending.forEach((r) => { const m = r.icPayee; if (!byMember[m]) byMember[m] = []; byMember[m].push(r); });
    return Object.entries(byMember).map(([name, items]) => ({
      name,
      rows: items.slice().sort((a, b) => {
        const ad = new Date(a.payoutDueAt || 0).getTime() || Number.MAX_SAFE_INTEGER;
        const bd = new Date(b.payoutDueAt || 0).getTime() || Number.MAX_SAFE_INTEGER;
        return ad - bd;
      }),
    }));
  }, [rows]);

  async function handleBatchPay(group) {
    deselectAll(group.name); // auto-clear immediately on click
    setBatchSaving(group.name);
    setMsg('');
    try {
      const res = await fetch('/api/policy-submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batch_mark_paid', ids: group.rows.map((r) => r.id), icMemberName: group.name })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        await load();
        setSelectedIds((prev) => { const n = { ...prev }; delete n[group.name]; return n; });
        setMsg(`✅ ${group.name} — ${data.updated} payout${data.updated !== 1 ? 's' : ''} marked paid. Email sent.`);
      } else {
        setMsg(`❌ Batch pay failed: ${data?.error || 'unknown error'}`);
      }
    } finally {
      setBatchSaving('');
    }
  }

  function toggleBatchId(groupName, id) {
    setSelectedIds((prev) => {
      const cur = new Set(prev[groupName] || []);
      if (cur.has(id)) cur.delete(id); else cur.add(id);
      return { ...prev, [groupName]: cur };
    });
  }

  function selectAll(groupName, groupRows) {
    setSelectedIds((prev) => ({ ...prev, [groupName]: new Set(groupRows.map((r) => r.id)) }));
  }

  function deselectAll(groupName) {
    setSelectedIds((prev) => ({ ...prev, [groupName]: new Set() }));
  }

  async function moveToThisWeek(row) {
    setMovingId(row.id);
    setMsg('');
    try {
      const newDue = thisWeekFridayIso();
      const res = await fetch('/api/policy-submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, patch: { payoutDueAt: newDue } })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...data.row } : r)));
        setMsg(`📅 Moved to this week: ${row.applicantName || row.id}`);
      } else {
        setMsg(`❌ Could not move: ${data?.error || 'unknown error'}`);
      }
    } finally {
      setMovingId('');
    }
  }

  async function markPaid(row) {
    setSavingId(row.id);
    try {
      const res = await fetch('/api/policy-submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          patch: {
            payoutAmount: effectivePayoutAmount(row),
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
        <h3 style={{ marginTop: 0 }}>Approved + Unpaid (Don&apos;t Miss Payroll)</h3>
        <p className="muted">Urgency view for upcoming payout obligations. &ldquo;Pay Today&rdquo; = same calendar day (CST, 12am &ndash; 11:59pm).</p>

        <div className="grid4" style={{ marginTop: 8 }}>
          <div className="card"><p>Overdue</p><h2>{counts.overdue}</h2></div>
          <div className="card"><p>Pay Today</p><h2>{counts.today}</h2></div>
          <div className="card"><p>Due This Week</p><h2>{counts.week}</h2></div>
          <div className="card"><p>Due Next Week</p><h2>{counts.next}</h2></div>
        </div>
        {msg ? <p className="muted">{msg}</p> : null}
      </div>

      {icBatchGroups.length > 0 && (
        <div className="panel" style={{ border: '2px solid #0047AB' }}>
          <h3 style={{ marginTop: 0, color: '#0047AB' }}>💰 Inner Circle Payout Queue</h3>
          <p className="muted" style={{ marginBottom: 16 }}>All approved + unpaid payouts for IC members. 25% of each payout is applied toward their program balance. Select all for a member and click &ldquo;Mark All Paid&rdquo; to process and send one consolidated email.</p>
          {icBatchGroups.map((group) => {
            const sel = selectedIds[group.name] || new Set();
            const allSelected = group.rows.every((r) => sel.has(r.id));
            const totalNet = group.rows
              .filter((r) => sel.has(r.id))
              .reduce((s, r) => s + effectivePayoutAmount(r) * IC_NET_PCT, 0);
            const balance = computeIcBalance(group.name, rows);
            return (
              <div key={group.name} style={{ marginBottom: 24, background: '#f1f5f9', borderRadius: 8, padding: 16, color: '#0f172a' }}>
                {balance && (
                  <div style={{ marginBottom: 14, padding: '12px 16px', background: '#0f172a', borderRadius: 8, color: '#f8fafc' }}>
                    <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: '.8px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>IC Program Balance — {group.name}</div>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 14 }}>
                      <span>Program Total: <strong>${balance.totalProgramValue.toLocaleString()}</strong></span>
                      <span>Deposit Paid: <strong style={{ color: '#f87171' }}>-${balance.initialDeposit.toLocaleString()}</strong></span>
                      <span>Policy Payouts (75%): <strong style={{ color: '#f87171' }}>-${balance.cumulativePolicyPayouts.toFixed(2)}</strong></span>
                      <span>Total Applied: <strong style={{ color: '#f87171' }}>-${balance.totalPaid.toFixed(2)}</strong></span>
                      <span style={{ borderLeft: '1px solid #334155', paddingLeft: 24 }}>Remaining: <strong style={{ fontSize: 17, color: '#4ade80' }}>${balance.remaining.toFixed(2)}</strong></span>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <strong style={{ fontSize: 15, color: '#0f172a' }}>{group.name} — {group.rows.length} payout{group.rows.length !== 1 ? 's' : ''} pending</strong>
                  <span style={{ gap: 8, display: 'flex' }}>
                    <button type="button" style={{ fontSize: 12 }} onClick={() => selectAll(group.name, group.rows)}>Select All</button>
                    <button type="button" style={{ fontSize: 12 }} onClick={() => deselectAll(group.name)}>Clear</button>
                  </span>
                </div>
                <table style={{ fontSize: 13, width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ width: 32, padding: '8px 6px', textAlign: 'left', color: '#475569' }}></th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: '#0f172a', fontWeight: 700 }}>Client</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: '#0f172a', fontWeight: 700 }}>Urgency</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: '#0f172a', fontWeight: 700 }}>Role</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>Gross</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>Less 25%</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>Net Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((r) => {
                      const gross = effectivePayoutAmount(r);
                      const net = gross * IC_NET_PCT;
                      const role = icRole(r, group.name);
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px 6px' }}><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleBatchId(group.name, r.id)} /></td>
                          <td style={{ padding: '10px 10px', fontWeight: 700, color: '#0f172a' }}>{r.applicantName || '—'}</td>
                          <td style={{ padding: '10px 10px' }}><span style={{ fontWeight: 700, fontSize: 12, color: urgencyForRow(r, nowMs).color }}>{urgencyForRow(r, nowMs).label}</span></td>
                          <td style={{ padding: '10px 10px', color: '#334155', fontSize: 12 }}>{role}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#0f172a' }}>${gross.toFixed(2)}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#dc2626' }}>-${(gross * 0.25).toFixed(2)}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>${net.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10 }}>
                  <span style={{ fontSize: 14, color: '#0f172a' }}>Selected net total: <strong>${totalNet.toFixed(2)}</strong></span>
                  <button
                    type="button"
                    disabled={!allSelected || batchSaving === group.name}
                    onClick={() => handleBatchPay(group)}
                    style={{ background: allSelected ? '#0047AB' : '#94a3b8', color: '#fff', fontWeight: 700, padding: '8px 18px', borderRadius: 8, border: 'none', cursor: allSelected ? 'pointer' : 'not-allowed' }}
                  >
                    {batchSaving === group.name ? 'Processing...' : `Mark All Paid + Send Email →`}
                  </button>
                  {!allSelected && (
                    <span className="muted" style={{ fontSize: 12 }}>Select all {group.rows.length} to enable</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                  <td>{countdownLabel(r.urgency)}</td>
                  <td>{r.applicantName || '-'}</td>
                  <td>{r.referredByName || '-'}</td>
                  <td>{r.policyWriterName || '-'}</td>
                  <td>{fmtDate(r.payoutDueAt)}</td>
                  <td>{money(effectivePayoutAmount(r))}</td>
                  <td style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => markPaid(r)} disabled={savingId === r.id}>
                      {savingId === r.id ? 'Saving...' : 'Mark Paid'}
                    </button>
                    {(r.urgency.level === 'next' || r.urgency.level === 'track') && (
                      <button
                        type="button"
                        onClick={() => moveToThisWeek(r)}
                        disabled={movingId === r.id}
                        title="Move this payout into the current week"
                        style={{ background: '#0047AB', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                      >
                        {movingId === r.id ? '...' : '→ This Week'}
                      </button>
                    )}
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
