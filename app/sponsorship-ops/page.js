'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function fullName(row = {}) {
  return clean(`${row.firstName || ''} ${row.lastName || ''}`);
}

function fmtDate(iso = '') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function isApprovedStatus(status = '') {
  const s = normalize(status);
  return s.includes('approved');
}

export default function SponsorshipOpsPage() {
  const [apps, setApps] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [appsRes, bookingsRes] = await Promise.all([
        fetch('/api/sponsorship-applications', { cache: 'no-store' }),
        fetch('/api/sponsorship-bookings', { cache: 'no-store' })
      ]);
      const appsJson = await appsRes.json().catch(() => ({}));
      const bookingsJson = await bookingsRes.json().catch(() => ({}));

      if (appsRes.ok && appsJson?.ok) setApps(Array.isArray(appsJson.rows) ? appsJson.rows : []);
      if (bookingsRes.ok && bookingsJson?.ok) setBookings(Array.isArray(bookingsJson.rows) ? bookingsJson.rows : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const bookingBySourceId = useMemo(() => {
    const map = new Map();
    bookings.forEach((b) => {
      const key = clean(b.source_application_id);
      if (key) map.set(key, b);
    });
    return map;
  }, [bookings]);

  const bookingByName = useMemo(() => {
    const map = new Map();
    bookings.forEach((b) => {
      const name = normalize(b.applicant_name);
      if (name && !map.has(name)) map.set(name, b);
    });
    return map;
  }, [bookings]);

  const bookedRows = useMemo(() => {
    const deduped = new Map();
    bookings.forEach((b) => {
      const orphanUnknown =
        !clean(b.source_application_id) &&
        normalize(b.applicant_name) === 'unknown' &&
        normalize(b.referred_by) === 'unknown';
      if (orphanUnknown || normalize(b.claim_status) === 'invalid') return;

      const applicant = clean(b.applicant_name);
      const requestedAt = clean(b.requested_at_est);
      const dedupeKey = `${normalize(applicant)}|${normalize(requestedAt)}`;
      const row = {
        id: b.id,
        applicant,
        state: clean(b.applicant_state),
        requestedAt,
        referredBy: clean(b.referred_by),
        claimStatus: clean(b.claim_status || 'Open'),
        claimedBy: clean(b.claimed_by || ''),
        createdAt: clean(b.created_at)
      };

      if (!deduped.has(dedupeKey)) {
        deduped.set(dedupeKey, row);
        return;
      }

      const prev = deduped.get(dedupeKey);
      const prevTs = new Date(prev.createdAt || 0).getTime();
      const curTs = new Date(row.createdAt || 0).getTime();
      if (curTs > prevTs) deduped.set(dedupeKey, row);
    });

    return Array.from(deduped.values());
  }, [bookings]);

  const approvedNotBooked = useMemo(() => {
    const list = [];
    const seen = new Set();

    apps.forEach((a) => {
      if (!isApprovedStatus(a.status)) return;

      const idMatch = bookingBySourceId.get(clean(a.id));
      const nameMatch = bookingByName.get(normalize(fullName(a)));
      if (idMatch || nameMatch) return;

      const applicant = fullName(a);
      const dedupeKey = `${normalize(applicant)}|${normalize(a.email)}|${normalize(a.phone)}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      list.push({
        id: a.id,
        applicant,
        firstName: clean(a.firstName),
        lastName: clean(a.lastName),
        email: clean(a.email),
        phone: clean(a.phone),
        state: clean(a.state),
        status: clean(a.status),
        referredBy: clean(a.referralName || a.referred_by || a.refCode || ''),
        approvedAt: clean(a.reviewedAt || a.updatedAt || a.submitted_at)
      });
    });

    list.sort((x, y) => new Date(y.approvedAt || 0).getTime() - new Date(x.approvedAt || 0).getTime());
    return list;
  }, [apps, bookingBySourceId, bookingByName]);

  const bookedFiltered = useMemo(() => {
    const q = normalize(query);
    if (!q) return bookedRows;
    return bookedRows.filter((r) => normalize(`${r.applicant} ${r.state} ${r.referredBy} ${r.claimedBy}`).includes(q));
  }, [bookedRows, query]);

  const approvedFiltered = useMemo(() => {
    const q = normalize(query);
    if (!q) return approvedNotBooked;
    return approvedNotBooked.filter((r) => normalize(`${r.applicant} ${r.email} ${r.phone} ${r.referredBy}`).includes(q));
  }, [approvedNotBooked, query]);

  return (
    <AppShell title="Sponsorship Ops">
      <div className="panel">
        <div className="panelRow" style={{ gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Sponsorship Appointment Visibility</h3>
          <button type="button" onClick={load}>Refresh</button>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          See who booked sponsorship appointments and who is approved but still not booked.
        </p>
        <p className="pill onpace" style={{ marginTop: 8 }}>
          Email queued: Approved-not-booked follow-up sends Thu 9:00 AM EST.
        </p>

        <div className="settingsGrid" style={{ marginTop: 8 }}>
          <label>
            Search
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email, phone, referred by..." />
          </label>
        </div>

        <div className="grid4" style={{ marginTop: 10 }}>
          <div className="card"><p>Booked Appointments</p><h2>{bookedRows.length}</h2></div>
          <div className="card"><p>Approved Not Booked</p><h2>{approvedNotBooked.length}</h2></div>
          <div className="card"><p>Filtered Booked</p><h2>{bookedFiltered.length}</h2></div>
          <div className="card"><p>Filtered Follow-Up</p><h2>{approvedFiltered.length}</h2></div>
        </div>
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Who Has Booked</h3>
        {loading ? <p className="muted">Loading...</p> : (
          <table className="table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>State</th>
                <th>Booked Time (EST)</th>
                <th>Referred By</th>
                <th>Claim Status</th>
                <th>Claimed By</th>
              </tr>
            </thead>
            <tbody>
              {bookedFiltered.map((r) => (
                <tr key={r.id}>
                  <td>{r.applicant || '—'}</td>
                  <td>{r.state || '—'}</td>
                  <td>{r.requestedAt || '—'}</td>
                  <td>{r.referredBy || '—'}</td>
                  <td>{r.claimStatus || '—'}</td>
                  <td>{r.claimedBy || '—'}</td>
                </tr>
              ))}
              {!bookedFiltered.length ? <tr><td colSpan={6} className="muted">No bookings found.</td></tr> : null}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Approved But Not Booked (Follow-Up List)</h3>
        {loading ? <p className="muted">Loading...</p> : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>State</th>
                <th>Referred By</th>
                <th>Approved At</th>
              </tr>
            </thead>
            <tbody>
              {approvedFiltered.map((r) => (
                <tr key={r.id}>
                  <td>{r.applicant || '—'}</td>
                  <td>{r.email || '—'}</td>
                  <td>{r.phone || '—'}</td>
                  <td>{r.state || '—'}</td>
                  <td>{r.referredBy || '—'}</td>
                  <td>{fmtDate(r.approvedAt)}</td>
                </tr>
              ))}
              {!approvedFiltered.length ? <tr><td colSpan={6} className="muted">No approved-unbooked records right now.</td></tr> : null}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
