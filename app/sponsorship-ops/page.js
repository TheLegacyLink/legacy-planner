'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

const LEAD_MARKET_SETTINGS_KEY = 'lead_market_settings_v1';
const LEAD_ENGAGEMENT_KEY = 'lead_market_engagement_v1';

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

function rowKey(row = {}) {
  return clean(row.id) || `${normalize(row.applicant)}|${normalize(row.email)}|${normalize(row.phone)}`;
}

export default function SponsorshipOpsPage() {
  const [apps, setApps] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [marketSettings, setMarketSettings] = useState({
    sponsorshipTier1Price: 50,
    sponsorshipTier2Price: 89,
    termLifeTier1Price: '',
    termLifeTier2Price: ''
  });
  const [engagementById, setEngagementById] = useState({});

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

  useEffect(() => {
    load();

    try {
      const rawSettings = localStorage.getItem(LEAD_MARKET_SETTINGS_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        setMarketSettings((prev) => ({ ...prev, ...(parsed || {}) }));
      }

      const rawEngagement = localStorage.getItem(LEAD_ENGAGEMENT_KEY);
      if (rawEngagement) {
        const parsed = JSON.parse(rawEngagement);
        if (parsed && typeof parsed === 'object') setEngagementById(parsed);
      }
    } catch {
      // ignore storage read issues
    }
  }, []);

  function patchMarketSettings(patch) {
    const next = { ...marketSettings, ...patch };
    setMarketSettings(next);
    try {
      localStorage.setItem(LEAD_MARKET_SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // ignore storage write issues
    }
  }

  function setEngagement(row, replied) {
    const key = rowKey(row);
    if (!key) return;
    const next = { ...engagementById, [key]: replied ? 'replied' : 'no_reply' };
    setEngagementById(next);
    try {
      localStorage.setItem(LEAD_ENGAGEMENT_KEY, JSON.stringify(next));
    } catch {
      // ignore storage write issues
    }
  }

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

  const sponsorshipTier2Rows = useMemo(() => approvedNotBooked.filter((r) => engagementById[rowKey(r)] === 'replied'), [approvedNotBooked, engagementById]);
  const sponsorshipTier1Rows = useMemo(() => approvedNotBooked.filter((r) => engagementById[rowKey(r)] !== 'replied'), [approvedNotBooked, engagementById]);

  const bookedFiltered = useMemo(() => {
    const q = normalize(query);
    if (!q) return bookedRows;
    return bookedRows.filter((r) => normalize(`${r.applicant} ${r.state} ${r.referredBy} ${r.claimedBy}`).includes(q));
  }, [bookedRows, query]);

  const approvedFiltered = useMemo(() => {
    const q = normalize(query);

    const byTier = tierFilter === 'tier1'
      ? sponsorshipTier1Rows
      : tierFilter === 'tier2'
        ? sponsorshipTier2Rows
        : approvedNotBooked;

    if (!q) return byTier;
    return byTier.filter((r) => normalize(`${r.applicant} ${r.email} ${r.phone} ${r.referredBy}`).includes(q));
  }, [approvedNotBooked, sponsorshipTier1Rows, sponsorshipTier2Rows, query, tierFilter]);

  return (
    <AppShell title="Sponsorship Ops">
      <div className="panel" style={{
        background: 'linear-gradient(135deg, #0b1220 0%, #111827 40%, #1f2937 100%)',
        border: '1px solid #334155',
        color: '#e2e8f0'
      }}>
        <div className="panelRow" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#f8fafc' }}>Lead Marketplace (Elite Build)</h3>
          <button type="button" onClick={load}>Refresh</button>
        </div>
        <p className="muted" style={{ marginTop: 8, color: '#cbd5e1' }}>
          Approved sponsorship leads that did not book are split into sellable tiers.
        </p>

        <div className="grid4" style={{ marginTop: 10 }}>
          <div className="card" style={{ border: '1px solid #334155', background: '#0f172a' }}>
            <p style={{ color: '#93c5fd' }}>Sponsorship Tier 1</p>
            <h2 style={{ color: '#fff' }}>${Number(marketSettings.sponsorshipTier1Price || 50)}</h2>
            <small style={{ color: '#cbd5e1' }}>Approved • No Booking • No Reply</small>
            <p style={{ marginTop: 8 }}>Inventory: <strong>{sponsorshipTier1Rows.length}</strong></p>
          </div>

          <div className="card" style={{ border: '1px solid #334155', background: '#0f172a' }}>
            <p style={{ color: '#86efac' }}>Sponsorship Tier 2</p>
            <h2 style={{ color: '#fff' }}>${Number(marketSettings.sponsorshipTier2Price || 89)}</h2>
            <small style={{ color: '#cbd5e1' }}>Approved • No Booking • Replied to Text</small>
            <p style={{ marginTop: 8 }}>Inventory: <strong>{sponsorshipTier2Rows.length}</strong></p>
          </div>

          <div className="card" style={{ border: '1px dashed #475569', background: '#111827' }}>
            <p style={{ color: '#fcd34d' }}>Term Life Section</p>
            <h2 style={{ color: '#fff' }}>Coming Soon</h2>
            <small style={{ color: '#cbd5e1' }}>Set pricing below when ready.</small>
          </div>

          <div className="card" style={{ border: '1px solid #334155', background: '#0f172a' }}>
            <p style={{ color: '#e2e8f0' }}>Booked Appointments</p>
            <h2 style={{ color: '#fff' }}>{bookedRows.length}</h2>
            <small style={{ color: '#cbd5e1' }}>Not for sale — internal call handling</small>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Pricing Control</h3>
        <div className="settingsGrid" style={{ marginTop: 8 }}>
          <label>
            Sponsorship Tier 1 ($)
            <input
              type="number"
              min={1}
              value={marketSettings.sponsorshipTier1Price}
              onChange={(e) => patchMarketSettings({ sponsorshipTier1Price: Number(e.target.value || 1) })}
            />
          </label>
          <label>
            Sponsorship Tier 2 ($)
            <input
              type="number"
              min={1}
              value={marketSettings.sponsorshipTier2Price}
              onChange={(e) => patchMarketSettings({ sponsorshipTier2Price: Number(e.target.value || 1) })}
            />
          </label>
          <label>
            Term Life Tier 1 ($)
            <input
              type="number"
              min={0}
              placeholder="Set later"
              value={marketSettings.termLifeTier1Price}
              onChange={(e) => patchMarketSettings({ termLifeTier1Price: e.target.value })}
            />
          </label>
          <label>
            Term Life Tier 2 ($)
            <input
              type="number"
              min={0}
              placeholder="Set later"
              value={marketSettings.termLifeTier2Price}
              onChange={(e) => patchMarketSettings({ termLifeTier2Price: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 10 }}>
        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>Sponsorship Lead Inventory</h3>
          <button type="button" className={tierFilter === 'all' ? '' : 'ghost'} onClick={() => setTierFilter('all')}>All</button>
          <button type="button" className={tierFilter === 'tier1' ? '' : 'ghost'} onClick={() => setTierFilter('tier1')}>Tier 1 Only</button>
          <button type="button" className={tierFilter === 'tier2' ? '' : 'ghost'} onClick={() => setTierFilter('tier2')}>Tier 2 Only</button>
        </div>

        <div className="settingsGrid" style={{ marginTop: 8 }}>
          <label>
            Search
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email, phone, referred by..." />
          </label>
        </div>

        <p className="pill onpace" style={{ marginTop: 8 }}>
          Thursday 9:00 AM EST email reminder still runs for approved-not-booked follow-up.
        </p>

        {loading ? <p className="muted">Loading...</p> : (
          <table className="table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>State</th>
                <th>Referred By</th>
                <th>Approved At</th>
                <th>Engagement</th>
                <th>Tier</th>
              </tr>
            </thead>
            <tbody>
              {approvedFiltered.map((r) => {
                const key = rowKey(r);
                const replied = engagementById[key] === 'replied';
                return (
                  <tr key={r.id || key}>
                    <td>{r.applicant || '—'}</td>
                    <td>{r.email || '—'}</td>
                    <td>{r.phone || '—'}</td>
                    <td>{r.state || '—'}</td>
                    <td>{r.referredBy || '—'}</td>
                    <td>{fmtDate(r.approvedAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" className={!replied ? '' : 'ghost'} onClick={() => setEngagement(r, false)}>No Reply</button>
                        <button type="button" className={replied ? '' : 'ghost'} onClick={() => setEngagement(r, true)}>Replied</button>
                      </div>
                    </td>
                    <td>
                      <span className="pill" style={{ background: replied ? '#166534' : '#1d4ed8', color: '#fff' }}>
                        {replied ? `Tier 2 • $${Number(marketSettings.sponsorshipTier2Price || 89)}` : `Tier 1 • $${Number(marketSettings.sponsorshipTier1Price || 50)}`}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!approvedFiltered.length ? <tr><td colSpan={8} className="muted">No matching approved-unbooked leads right now.</td></tr> : null}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Booked Appointments (Not For Sale)</h3>
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
    </AppShell>
  );
}
