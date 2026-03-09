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

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

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

function normalizePhone(v = '') {
  return String(v || '').replace(/\D/g, '');
}

export default function SponsorshipReviewPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewRow, setReviewRow] = useState(null);
  const [bookedSet, setBookedSet] = useState(new Set());
  const [fgSubmittedSet, setFgSubmittedSet] = useState(new Set());
  const [bookingRows, setBookingRows] = useState([]);
  const [touchMap, setTouchMap] = useState({});
  const [savingTouchKey, setSavingTouchKey] = useState('');

  async function load() {
    try {
      const [appsRes, bookingsRes, policyRes, touchesRes] = await Promise.all([
        fetch('/api/sponsorship-applications', { cache: 'no-store' }),
        fetch('/api/sponsorship-bookings', { cache: 'no-store' }),
        fetch('/api/policy-submissions', { cache: 'no-store' }),
        fetch('/api/sponsorship-review-touches', { cache: 'no-store' })
      ]);

      const appsData = await appsRes.json().catch(() => ({}));
      const bookingsData = await bookingsRes.json().catch(() => ({}));
      const policyData = await policyRes.json().catch(() => ({}));
      const touchesData = await touchesRes.json().catch(() => ({}));

      if (appsRes.ok && appsData?.ok) setRows(appsData.rows || []);

      if (bookingsRes.ok && bookingsData?.ok) {
        const rows = Array.isArray(bookingsData.rows) ? bookingsData.rows : [];
        setBookingRows(rows);
        const set = new Set();
        for (const b of rows) {
          const sourceId = clean(b?.source_application_id);
          const name = normalize(b?.applicant_name || '');
          const email = normalize(b?.applicant_email || '');
          const phone = normalizePhone(b?.applicant_phone || '');
          if (sourceId) set.add(`id:${sourceId}`);
          if (name) set.add(`n:${name}`);
          if (email) set.add(`e:${email}`);
          if (phone) set.add(`p:${phone}`);
        }
        setBookedSet(set);
      }

      if (policyRes.ok && policyData?.ok) {
        const submitted = new Set();
        const rows = Array.isArray(policyData.rows) ? policyData.rows : [];
        for (const p of rows) {
          const name = normalize(p?.applicantName || p?.applicant_name || '');
          const email = normalize(p?.applicantEmail || p?.applicant_email || p?.email || '');
          const phone = normalizePhone(p?.applicantPhone || p?.applicant_phone || p?.phone || '');
          if (name) submitted.add(`n:${name}`);
          if (email) submitted.add(`e:${email}`);
          if (phone) submitted.add(`p:${phone}`);
        }
        setFgSubmittedSet(submitted);
      }

      if (touchesRes.ok && touchesData?.ok) {
        const map = {};
        for (const t of (touchesData.rows || [])) {
          const k = clean(t?.key);
          if (!k) continue;
          map[k] = t;
        }
        setTouchMap(map);
      }
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

  const displayRows = useMemo(() => {
    const byRecency = [...rows].sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime());
    const seenNames = new Set();
    const seenEmails = new Set();
    const seenPhones = new Set();
    const out = [];

    for (const r of byRecency) {
      const name = normalize(`${r?.firstName || ''} ${r?.lastName || ''}`);
      const email = normalize(r?.email || '');
      const phone = normalizePhone(r?.phone || '');

      // Deduplicate if ANY of name/email/phone already exists.
      if ((name && seenNames.has(name)) || (email && seenEmails.has(email)) || (phone && seenPhones.has(phone))) {
        continue;
      }

      if (name) seenNames.add(name);
      if (email) seenEmails.add(email);
      if (phone) seenPhones.add(phone);
      out.push(r);
    }

    return out;
  }, [rows]);

  const pending = useMemo(() => displayRows.filter((r) => String(r.decision_bucket).toLowerCase() === 'manual_review'), [displayRows]);
  const approved = useMemo(() => displayRows.filter((r) => String(r.status).toLowerCase().includes('approved')), [displayRows]);

  function isBooked(r = {}) {
    const id = clean(r?.id || '');
    const name = normalize(`${r?.firstName || ''} ${r?.lastName || ''}`);
    const email = normalize(r?.email || '');
    const phone = normalizePhone(r?.phone || '');
    return (id && bookedSet.has(`id:${id}`))
      || (name && bookedSet.has(`n:${name}`))
      || (email && bookedSet.has(`e:${email}`))
      || (phone && bookedSet.has(`p:${phone}`));
  }

  function isFgSubmitted(r = {}) {
    const name = normalize(`${r?.firstName || ''} ${r?.lastName || ''}`);
    const email = normalize(r?.email || '');
    const phone = normalizePhone(r?.phone || '');
    return (name && fgSubmittedSet.has(`n:${name}`))
      || (email && fgSubmittedSet.has(`e:${email}`))
      || (phone && fgSubmittedSet.has(`p:${phone}`));
  }

  function touchKeyFor(r = {}) {
    const id = clean(r?.id || '');
    if (id) return `id:${id}`;
    const email = normalize(r?.email || '');
    if (email) return `e:${email}`;
    const phone = normalizePhone(r?.phone || '');
    if (phone) return `p:${phone}`;
    const name = normalize(`${r?.firstName || ''} ${r?.lastName || ''}`);
    return name ? `n:${name}` : '';
  }

  function canTrackTouches(r = {}) {
    const approvedStatus = normalize(r?.status || '').includes('approved');
    return approvedStatus && !isBooked(r) && !isFgSubmitted(r);
  }

  async function markTouch(r = {}, channel = 'text') {
    const key = touchKeyFor(r);
    if (!key) return;
    setSavingTouchKey(key);
    try {
      const res = await fetch('/api/sponsorship-review-touches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'increment', key, channel })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.row) return;
      setTouchMap((prev) => ({ ...prev, [key]: data.row }));
    } finally {
      setSavingTouchKey('');
    }
  }

  const bookedCount = displayRows.filter((r) => isBooked(r)).length;
  const submittedCount = displayRows.filter((r) => isFgSubmitted(r)).length;
  const bookedTodayCount = useMemo(() => {
    const now = new Date();
    return (bookingRows || []).filter((b) => {
      const ts = new Date(b?.created_at || b?.booked_at || b?.updated_at || 0);
      if (Number.isNaN(ts.getTime())) return false;
      return ts.toDateString() === now.toDateString();
    }).length;
  }, [bookingRows]);

  return (
    <AppShell title="Sponsorship Review Queue">
      <div className="panelRow" style={{ marginBottom: 10 }}>
        <span className="pill atrisk">Pending Review: {pending.length}</span>
        <span className="pill onpace">Approved: {approved.length}</span>
        <span className="pill" style={{ background: '#dbeafe', color: '#1e40af' }}>💙⭐⭐⭐ F&G App Submitted: {submittedCount}</span>
        <span className="pill" style={{ background: '#dcfce7', color: '#166534' }}>📅 Booked Today: {bookedTodayCount}</span>
        <span className="pill" style={{ background: '#fef3c7', color: '#92400e' }}>⭐ Booked: {bookedCount}</span>
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
          {displayRows.map((r) => {
            const booked = isBooked(r);
            const submitted = isFgSubmitted(r);
            const trackable = canTrackTouches(r);
            const touchKey = touchKeyFor(r);
            const touch = touchMap[touchKey] || { textCount: 0, emailCount: 0 };
            const approvedBg = String(r.status).toLowerCase().includes('approved') ? { background: 'rgba(34,197,94,0.12)' } : {};
            const bookedGlow = booked ? { boxShadow: 'inset 0 0 0 2px rgba(250,204,21,0.55)', background: 'rgba(251,191,36,0.14)' } : {};
            const submittedGlow = submitted ? { boxShadow: 'inset 0 0 0 2px rgba(59,130,246,0.55)', background: 'rgba(59,130,246,0.10)' } : {};
            return (
            <tr key={r.id} style={{ ...approvedBg, ...(booked ? bookedGlow : submittedGlow) }}>
              <td>
                <div style={{ display: 'grid', gap: 3 }}>
                  <small className="muted">Sponsor: {sponsorNameFromRow(r)}</small>
                  <strong>{booked ? '⭐ ' : submitted ? '💙⭐⭐⭐ ' : ''}{r.firstName} {r.lastName}</strong>
                  {booked ? <small style={{ color: '#a16207', fontWeight: 700 }}>Booked Appointment</small> : null}
                  {!booked && submitted ? <small style={{ color: '#1d4ed8', fontWeight: 700 }}>F&G Application Submitted</small> : null}
                  {trackable ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
                      <small style={{ color: '#0f172a', fontWeight: 700 }}>SMS {Number(touch.textCount || 0)}/5</small>
                      <small style={{ color: '#334155' }}>Email {Number(touch.emailCount || 0)}</small>
                      <button
                        type="button"
                        className="ghost"
                        style={{ padding: '2px 8px', fontSize: 12 }}
                        disabled={savingTouchKey === touchKey || Number(touch.textCount || 0) >= 5}
                        onClick={() => markTouch(r, 'text')}
                      >
                        +Text
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        style={{ padding: '2px 8px', fontSize: 12 }}
                        disabled={savingTouchKey === touchKey}
                        onClick={() => markTouch(r, 'email')}
                      >
                        +Email
                      </button>
                    </div>
                  ) : null}
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
            );
          })}
          {!displayRows.length ? (
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
                <div style={{ color: '#0f172a', whiteSpace: 'pre-wrap', fontWeight: 500 }}>{String(value || '—')}</div>
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
