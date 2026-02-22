'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function SponsorshipReviewPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch('/api/sponsorship-applications', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) setRows(data.rows || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  async function review(id, decision) {
    const res = await fetch('/api/sponsorship-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'review', id, decision, reviewedBy: 'Kimora' })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      alert(`Review update failed: ${data?.error || 'unknown_error'}`);
      return;
    }
    load();
  }

  const pending = useMemo(() => rows.filter((r) => String(r.decision_bucket).toLowerCase() === 'manual_review'), [rows]);
  const approved = useMemo(() => rows.filter((r) => String(r.status).toLowerCase().includes('approved')), [rows]);

  return (
    <AppShell title="Sponsorship Review Queue">
      <div className="panelRow" style={{ marginBottom: 10 }}>
        <span className="pill atrisk">Pending Review: {pending.length}</span>
        <span className="pill onpace">Approved: {approved.length}</span>
      </div>

      {loading ? <p className="muted">Loading review queue…</p> : null}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Status</th>
            <th>Score</th>
            <th>Submitted</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={String(r.status).toLowerCase().includes('approved') ? { background: 'rgba(34,197,94,0.12)' } : undefined}>
              <td>{r.firstName} {r.lastName}</td>
              <td>{r.email || '—'}</td>
              <td>{r.phone || '—'}</td>
              <td>{r.status}</td>
              <td>{r.application_score ?? '—'}</td>
              <td>{fmt(r.submitted_at)}</td>
              <td>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => review(r.id, 'approve')}>Approve</button>
                  <button type="button" className="ghost" onClick={() => review(r.id, 'decline')}>Decline</button>
                </div>
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr><td colSpan={7} className="muted">No applications in server review queue yet.</td></tr>
          ) : null}
        </tbody>
      </table>
    </AppShell>
  );
}
