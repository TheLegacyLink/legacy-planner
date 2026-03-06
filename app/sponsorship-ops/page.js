'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function fmtDate(iso = '') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function SponsorshipOpsPage() {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [bookings, setBookings] = useState([]);
  const [settings, setSettings] = useState({
    sponsorshipTier1Price: 50,
    sponsorshipTier2Price: 89,
    termLifeTier1Price: '',
    termLifeTier2Price: ''
  });
  const [adminRows, setAdminRows] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const [marketRes, bookingsRes] = await Promise.all([
        fetch('/api/lead-marketplace', { cache: 'no-store' }),
        fetch('/api/sponsorship-bookings', { cache: 'no-store' })
      ]);

      const marketJson = await marketRes.json().catch(() => ({}));
      const bookingsJson = await bookingsRes.json().catch(() => ({}));

      if (marketRes.ok && marketJson?.ok) {
        setSettings({
          sponsorshipTier1Price: Number(marketJson?.settings?.sponsorshipTier1Price || 50),
          sponsorshipTier2Price: Number(marketJson?.settings?.sponsorshipTier2Price || 89),
          termLifeTier1Price: marketJson?.settings?.termLifeTier1Price ?? '',
          termLifeTier2Price: marketJson?.settings?.termLifeTier2Price ?? ''
        });
        setAdminRows(Array.isArray(marketJson.adminRows) ? marketJson.adminRows : []);
      }

      if (bookingsRes.ok && bookingsJson?.ok) {
        setBookings(Array.isArray(bookingsJson.rows) ? bookingsJson.rows : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveSettings(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);

    await fetch('/api/lead-marketplace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_settings', settings: next })
    });

    await load();
  }

  async function setEngagement(leadKey, replied) {
    if (!leadKey) return;

    await fetch('/api/lead-marketplace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_engagement', leadKey, engagement: replied ? 'replied' : 'no_reply' })
    });

    await load();
  }

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
        claimStatus: clean(b.claim_status || 'Open'),
        claimedBy: clean(b.claimed_by || '')
      };

      if (!deduped.has(dedupeKey)) {
        deduped.set(dedupeKey, row);
        return;
      }

      const prev = deduped.get(dedupeKey);
      const prevTs = new Date(prev.requestedAt || 0).getTime();
      const curTs = new Date(row.requestedAt || 0).getTime();
      if (curTs > prevTs) deduped.set(dedupeKey, row);
    });

    return Array.from(deduped.values());
  }, [bookings]);

  const tier1Rows = useMemo(() => adminRows.filter((r) => r.tier === 'tier1'), [adminRows]);
  const tier2Rows = useMemo(() => adminRows.filter((r) => r.tier === 'tier2'), [adminRows]);

  const approvedFiltered = useMemo(() => {
    const byTier = tierFilter === 'tier1'
      ? tier1Rows
      : tierFilter === 'tier2'
        ? tier2Rows
        : adminRows;

    const q = normalize(query);
    if (!q) return byTier;
    return byTier.filter((r) => normalize(`${r.applicant} ${r.email} ${r.phone} ${r.state}`).includes(q));
  }, [adminRows, tier1Rows, tier2Rows, query, tierFilter]);

  const bookedFiltered = useMemo(() => {
    const q = normalize(query);
    if (!q) return bookedRows;
    return bookedRows.filter((r) => normalize(`${r.applicant} ${r.state} ${r.claimedBy}`).includes(q));
  }, [bookedRows, query]);

  return (
    <AppShell title="Sponsorship Ops">
      <div className="panel" style={{
        background: 'linear-gradient(135deg, #0b1220 0%, #111827 40%, #1f2937 100%)',
        border: '1px solid #334155',
        color: '#e2e8f0'
      }}>
        <div className="panelRow" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#f8fafc' }}>Lead Marketplace (Admin)</h3>
          <button type="button" onClick={load}>Refresh</button>
        </div>
        <p className="muted" style={{ marginTop: 8, color: '#cbd5e1' }}>
          Approved sponsorship leads that did not book are split into sellable tiers.
        </p>

        <div className="grid4" style={{ marginTop: 10 }}>
          <div className="card" style={{ border: '1px solid #334155', background: '#0f172a' }}>
            <p style={{ color: '#93c5fd' }}>Sponsorship Tier 1</p>
            <h2 style={{ color: '#fff' }}>${Number(settings.sponsorshipTier1Price || 50)}</h2>
            <small style={{ color: '#cbd5e1' }}>Approved • No Booking • No Reply</small>
            <p style={{ marginTop: 8 }}>Inventory: <strong>{tier1Rows.length}</strong></p>
          </div>

          <div className="card" style={{ border: '1px solid #334155', background: '#0f172a' }}>
            <p style={{ color: '#86efac' }}>Sponsorship Tier 2</p>
            <h2 style={{ color: '#fff' }}>${Number(settings.sponsorshipTier2Price || 89)}</h2>
            <small style={{ color: '#cbd5e1' }}>Approved • No Booking • Replied to Text</small>
            <p style={{ marginTop: 8 }}>Inventory: <strong>{tier2Rows.length}</strong></p>
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
              value={settings.sponsorshipTier1Price}
              onChange={(e) => saveSettings({ sponsorshipTier1Price: Number(e.target.value || 1) })}
            />
          </label>
          <label>
            Sponsorship Tier 2 ($)
            <input
              type="number"
              min={1}
              value={settings.sponsorshipTier2Price}
              onChange={(e) => saveSettings({ sponsorshipTier2Price: Number(e.target.value || 1) })}
            />
          </label>
          <label>
            Term Life Tier 1 ($)
            <input
              type="number"
              min={0}
              placeholder="Set later"
              value={settings.termLifeTier1Price}
              onChange={(e) => saveSettings({ termLifeTier1Price: e.target.value })}
            />
          </label>
          <label>
            Term Life Tier 2 ($)
            <input
              type="number"
              min={0}
              placeholder="Set later"
              value={settings.termLifeTier2Price}
              onChange={(e) => saveSettings({ termLifeTier2Price: e.target.value })}
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
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email, phone, state..." />
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
                <th>Approved At</th>
                <th>Engagement</th>
                <th>Tier</th>
              </tr>
            </thead>
            <tbody>
              {approvedFiltered.map((r) => {
                const replied = r.engagement === 'Replied';
                return (
                  <tr key={r.key || r.id}>
                    <td>{r.applicant || '—'}</td>
                    <td>{r.email || '—'}</td>
                    <td>{r.phone || '—'}</td>
                    <td>{r.state || '—'}</td>
                    <td>{fmtDate(r.approvedAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" className={!replied ? '' : 'ghost'} onClick={() => setEngagement(r.key, false)}>No Reply</button>
                        <button type="button" className={replied ? '' : 'ghost'} onClick={() => setEngagement(r.key, true)}>Replied</button>
                      </div>
                    </td>
                    <td>
                      <span className="pill" style={{ background: replied ? '#166534' : '#1d4ed8', color: '#fff' }}>
                        {replied ? `Tier 2 • $${Number(settings.sponsorshipTier2Price || 89)}` : `Tier 1 • $${Number(settings.sponsorshipTier1Price || 50)}`}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!approvedFiltered.length ? <tr><td colSpan={7} className="muted">No matching approved-unbooked leads right now.</td></tr> : null}
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
                  <td>{r.claimStatus || '—'}</td>
                  <td>{r.claimedBy || '—'}</td>
                </tr>
              ))}
              {!bookedFiltered.length ? <tr><td colSpan={5} className="muted">No bookings found.</td></tr> : null}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
