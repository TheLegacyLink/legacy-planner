'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

const REF_CODE_TO_SPONSOR = {
  kimora_link: 'Kimora Link',
  jamal_holmes: 'Jamal Holmes',
  mahogany_burns: 'Mahogany Burns',
  madalyn_adams: 'Madalyn Adams',
  kelin_brown: 'Kelin Brown',
  leticia_wright: 'Leticia Wright',
  breanna_james: 'Breanna James',
  dr_brianna: 'Dr. Breanna James',
  latricia_wright: 'Leticia Wright'
};

function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function titleCase(v = '') {
  return String(v || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function sponsorNameFromRow(row = {}) {
  const raw = String(row.refCode || row.ref_code || '').trim().toLowerCase();
  if (!raw) return 'Unattributed';
  if (REF_CODE_TO_SPONSOR[raw]) return REF_CODE_TO_SPONSOR[raw];
  return titleCase(raw.replace(/[_-]+/g, ' '));
}

function answerFields(row = {}) {
  return [
    ['Age', row.age],
    ['State', row.state],
    ['Income Source', row.hasIncome === 'yes' ? (row.incomeSource || 'Yes (not specified)') : 'No'],
    ['Licensed', row.isLicensed === 'yes' ? (row.licenseDetails || 'Yes') : 'No'],
    ['Health Status', row.healthStatus],
    ['Motivation', row.motivation],
    ['Hours/Week', row.hoursPerWeek],
    ['Heard From', row.heardFrom],
    ['Why Join', row.whyJoin],
    ['12-Month Goal', row.goal12Month]
  ];
}

export default function SponsorshipReviewPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewRow, setReviewRow] = useState(null);

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
      return false;
    }
    load();
    return true;
  }

  async function decideFromModal(decision) {
    if (!reviewRow?.id) return;
    const ok = await review(reviewRow.id, decision);
    if (ok) setReviewRow(null);
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
            <th>Applicant</th>
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
              <td>
                <div style={{ display: 'grid', gap: 3 }}>
                  <small className="muted">Sponsor: {sponsorNameFromRow(r)}</small>
                  <strong>{r.firstName} {r.lastName}</strong>
                </div>
              </td>
              <td>{r.email || '—'}</td>
              <td>{r.phone || '—'}</td>
              <td>{r.status}</td>
              <td>{r.application_score ?? '—'}</td>
              <td>{fmt(r.submitted_at)}</td>
              <td>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="ghost" onClick={() => setReviewRow(r)}>Review Answers</button>
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

      {reviewRow ? (
        <div className="panel" style={{ marginTop: 14, borderColor: '#c7d2fe', background: '#f8fbff' }}>
          <div className="panelRow" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Review Answers — {reviewRow.firstName} {reviewRow.lastName}</h3>
            <span className="pill">Sponsor: {sponsorNameFromRow(reviewRow)}</span>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {answerFields(reviewRow).map(([label, value]) => (
              <div key={label} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, background: '#fff' }}>
                <small className="muted" style={{ display: 'block', marginBottom: 4 }}>{label}</small>
                <div>{String(value || '—')}</div>
              </div>
            ))}
          </div>

          <div className="panelRow" style={{ marginTop: 12 }}>
            <small className="muted">Submitted: {fmt(reviewRow.submitted_at)} • Score: {reviewRow.application_score ?? '—'}</small>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => decideFromModal('approve')}>Approve</button>
              <button type="button" className="ghost" onClick={() => decideFromModal('decline')}>Decline</button>
              <button type="button" className="ghost" onClick={() => setReviewRow(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
