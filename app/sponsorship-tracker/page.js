'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// ─── Auth ──────────────────────────────────────────────────────────────────────
const VIEWER_PASSWORDS = ['LegacyReview2026', 'LegacyTracker2026', 'LinkReview2026'];
const AUTH_KEY = 'spon_tracker_auth_v1';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase(); }
function normPhone(v = '') { return clean(v).replace(/\D/g, ''); }

function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fullName(r) {
  return clean(`${r.firstName || ''} ${r.lastName || ''}`);
}

// ─── Login Gate ────────────────────────────────────────────────────────────────
function LoginGate({ onAuth }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  function tryLogin() {
    if (VIEWER_PASSWORDS.includes(pw.trim())) {
      localStorage.setItem(AUTH_KEY, pw.trim());
      onAuth();
    } else {
      setErr('Incorrect password.');
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#06090f', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420, border: '1px solid #1e293b', borderRadius: 16, padding: 32, background: '#0b1220' }}>
        <div style={{ color: '#C8A96B', fontWeight: 800, fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 6 }}>The Legacy Link</div>
        <h2 style={{ color: '#f1f5f9', margin: '0 0 6px', fontSize: 22 }}>Sponsorship Tracker</h2>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Authorized access only.</p>
        <input
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && tryLogin()}
          placeholder="Enter password"
          autoFocus
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#060d1a', color: '#f1f5f9', fontSize: 15, marginBottom: 10, boxSizing: 'border-box' }}
        />
        <button
          type="button"
          onClick={tryLogin}
          style={{ width: '100%', padding: '11px', background: '#C8A96B', color: '#06090f', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}
        >
          Enter
        </button>
        {err ? <p style={{ color: '#fca5a5', marginTop: 10, fontSize: 13 }}>{err}</p> : null}
      </div>
    </div>
  );
}

// ─── Note Cell ─────────────────────────────────────────────────────────────────
function NoteCell({ touchKey, initialNote, onSaved }) {
  const [note, setNote] = useState(initialNote || '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const taRef = useRef(null);

  useEffect(() => { setNote(initialNote || ''); }, [initialNote]);
  useEffect(() => { if (editing && taRef.current) taRef.current.focus(); }, [editing]);

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/sponsorship-review-touches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_note', key: touchKey, note }),
      });
      onSaved(touchKey, note);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
        <textarea
          ref={taRef}
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #334155', background: '#060d1a', color: '#e2e8f0', fontSize: 12, resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" disabled={saving} onClick={save} style={{ flex: 1, padding: '5px 10px', background: '#C8A96B', color: '#06090f', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            {saving ? '...' : 'Save'}
          </button>
          <button type="button" onClick={() => { setNote(initialNote || ''); setEditing(false); }} style={{ padding: '5px 10px', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      title="Click to add/edit note"
      style={{ cursor: 'pointer', color: note ? '#cbd5e1' : '#475569', fontSize: 12, minWidth: 140, padding: '4px 6px', borderRadius: 6, border: '1px solid transparent', transition: 'border .15s' }}
      onMouseEnter={e => e.currentTarget.style.border = '1px solid #334155'}
      onMouseLeave={e => e.currentTarget.style.border = '1px solid transparent'}
    >
      {note || <span style={{ color: '#334155' }}>+ note</span>}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SponsorshipTracker() {
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState([]);
  const [bookedSet, setBookedSet] = useState(new Set());
  const [fgSet, setFgSet] = useState(new Set());
  const [touchMap, setTouchMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);

  // Check auth on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_KEY);
      if (VIEWER_PASSWORDS.includes(stored)) setAuthed(true);
    } catch {}
  }, []);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const [appsRes, bookingsRes, policyRes, touchesRes] = await Promise.all([
        fetch('/api/sponsorship-applications', { cache: 'no-store' }),
        fetch('/api/sponsorship-bookings', { cache: 'no-store' }),
        fetch('/api/policy-submissions', { cache: 'no-store' }),
        fetch('/api/sponsorship-review-touches', { cache: 'no-store' }),
      ]);

      const appsData = await appsRes.json().catch(() => ({}));
      if (appsData?.ok) {
        const sorted = [...(appsData.rows || [])].sort(
          (a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0)
        );
        setRows(sorted);
      }

      // Build booked set — match by id, email, name, phone
      if (bookingsRes.ok) {
        const bData = await bookingsRes.json().catch(() => ({}));
        const bRows = Array.isArray(bData.rows) ? bData.rows : [];
        const set = new Set();
        for (const b of bRows) {
          const sid = clean(b?.source_application_id);
          const email = norm(b?.applicant_email);
          const name = norm(b?.applicant_name || `${b?.applicant_first_name || ''} ${b?.applicant_last_name || ''}`.trim());
          const phone = normPhone(b?.applicant_phone);
          if (sid) set.add(`id:${sid}`);
          if (email) set.add(`e:${email}`);
          if (name) set.add(`n:${name}`);
          if (phone && phone.length >= 10) set.add(`p:${phone}`);
        }
        setBookedSet(set);
      }

      // Build F&G/NLG submitted set — match by email/phone only (avoid name collisions)
      if (policyRes.ok) {
        const pData = await policyRes.json().catch(() => ({}));
        const pRows = Array.isArray(pData.rows) ? pData.rows : [];
        const set = new Set();
        for (const p of pRows) {
          const email = norm(p?.applicantEmail || p?.applicant_email || p?.email);
          const phone = normPhone(p?.applicantPhone || p?.applicant_phone || p?.phone);
          if (email) set.add(`e:${email}`);
          if (phone && phone.length >= 10) set.add(`p:${phone}`);
        }
        setFgSet(set);
      }

      // Build touch map: key → touch object
      if (touchesRes.ok) {
        const tData = await touchesRes.json().catch(() => ({}));
        const tRows = Array.isArray(tData.rows) ? tData.rows : [];
        const map = {};
        for (const t of tRows) {
          if (t?.key) map[t.key] = t;
        }
        setTouchMap(map);
      }
    } catch (e) {
      setErr('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (authed) load(); }, [authed]);

  function isBooked(r) {
    const id = clean(r?.id);
    const email = norm(r?.email);
    const name = norm(fullName(r));
    const phone = normPhone(r?.phone);
    return (id && bookedSet.has(`id:${id}`))
      || (email && bookedSet.has(`e:${email}`))
      || (name && bookedSet.has(`n:${name}`))
      || (phone && phone.length >= 10 && bookedSet.has(`p:${phone}`));
  }

  function isFgSubmitted(r) {
    const email = norm(r?.email);
    const phone = normPhone(r?.phone);
    return (email && fgSet.has(`e:${email}`))
      || (phone && phone.length >= 10 && fgSet.has(`p:${phone}`));
  }

  function touchKey(r) {
    return clean(r?.id) || norm(fullName(r)).replace(/\s+/g, '_');
  }

  function handleNoteSaved(key, note) {
    setTouchMap(prev => ({ ...prev, [key]: { ...(prev[key] || { key }), note } }));
  }

  // Filter + search
  const filtered = useMemo(() => {
    let out = rows;

    if (filter === 'booked') out = out.filter(r => isBooked(r));
    else if (filter === 'fg') out = out.filter(r => isFgSubmitted(r));
    else if (filter === 'approved') out = out.filter(r => norm(r?.status || '').includes('approved'));
    else if (filter === 'pending') out = out.filter(r => !norm(r?.status || '').includes('approved'));
    else if (filter === 'noted') out = out.filter(r => !!touchMap[touchKey(r)]?.note);

    if (search.trim()) {
      const q = norm(search);
      out = out.filter(r => {
        const hay = [fullName(r), r.email, r.phone, r.state, r.sponsorDisplayName, r.referralName, r.refCode, r.status]
          .map(v => norm(v)).join(' ');
        return hay.includes(q);
      });
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter, search, bookedSet, fgSet, touchMap]);

  const stats = useMemo(() => ({
    total: rows.length,
    booked: rows.filter(r => isBooked(r)).length,
    fg: rows.filter(r => isFgSubmitted(r)).length,
    approved: rows.filter(r => norm(r?.status || '').includes('approved')).length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rows, bookedSet, fgSet]);

  if (!authed) return <LoginGate onAuth={() => setAuthed(true)} />;

  const GOLD = '#C8A96B';

  return (
    <div style={{ minHeight: '100vh', background: '#06090f', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif', padding: '0 0 60px' }}>

      {/* Header */}
      <div style={{ background: '#0b1220', borderBottom: '1px solid #1e293b', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>The Legacy Link</div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>Sponsorship Tracker</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button type="button" onClick={load} disabled={loading} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
          <button type="button" onClick={() => { localStorage.removeItem(AUTH_KEY); setAuthed(false); }} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid #334155', color: '#64748b', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 16px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Total Applicants', val: stats.total, color: '#e2e8f0' },
            { label: '⭐ Booked a Call', val: stats.booked, color: '#fde68a' },
            { label: '💙 F&G / NLG App', val: stats.fg, color: '#bfdbfe' },
            { label: '✅ Approved', val: stats.approved, color: '#bbf7d0' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ border: '1px solid #1e293b', borderRadius: 10, background: '#0b1220', padding: '12px 14px' }}>
              <div style={{ color: '#475569', fontSize: 11, marginBottom: 4 }}>{label}</div>
              <div style={{ color, fontWeight: 800, fontSize: 26 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Search + filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, phone, sponsor, state..."
            style={{ flex: 1, minWidth: 220, padding: '9px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0b1220', color: '#e2e8f0', fontSize: 14 }}
          />
          {[
            { key: 'all', label: 'All' },
            { key: 'booked', label: '⭐ Booked' },
            { key: 'fg', label: '💙 F&G / NLG' },
            { key: 'approved', label: '✅ Approved' },
            { key: 'pending', label: 'Not Approved' },
            { key: 'noted', label: '📝 Has Notes' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              style={{
                padding: '7px 13px',
                borderRadius: 8,
                border: `1px solid ${filter === key ? GOLD : '#334155'}`,
                background: filter === key ? 'rgba(200,169,107,.15)' : 'transparent',
                color: filter === key ? GOLD : '#94a3b8',
                fontWeight: filter === key ? 700 : 400,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>
          Showing {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} applicants
        </div>

        {err ? <p style={{ color: '#fca5a5' }}>{err}</p> : null}

        {/* Table */}
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #1e293b' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0f1a2e', borderBottom: '1px solid #1e293b' }}>
                {['Name / Email', 'Phone', 'State', 'Sponsor', 'Status', 'Applied', 'Notes'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const booked = isBooked(r);
                const fg = isFgSubmitted(r);
                const approved = norm(r?.status || '').includes('approved');
                const tk = touchKey(r);
                const touch = touchMap[tk] || {};
                const isExpanded = expanded === (r.id || i);

                let rowBg = i % 2 === 0 ? '#0b1220' : '#080f1c';
                if (booked) rowBg = 'rgba(250,204,21,0.07)';
                if (fg && !booked) rowBg = 'rgba(59,130,246,0.07)';
                if (approved && !booked && !fg) rowBg = 'rgba(34,197,94,0.05)';

                const sponsor = clean(r.sponsorDisplayName || r.referralName || r.referredByName || r.refCode || '—');

                return (
                  <tr
                    key={r.id || i}
                    style={{ background: rowBg, borderBottom: '1px solid #111827', cursor: 'pointer', transition: 'background .12s' }}
                    onClick={() => setExpanded(prev => prev === (r.id || i) ? null : (r.id || i))}
                  >
                    {/* Name / Email */}
                    <td style={{ padding: '10px 12px', minWidth: 180 }}>
                      <div style={{ fontWeight: 600, color: '#f1f5f9' }}>
                        {booked ? '⭐ ' : ''}{fg ? '💙 ' : ''}{fullName(r) || '—'}
                      </div>
                      <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{r.email || '—'}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        {booked && <span style={{ background: '#422006', border: '1px solid #92400e', color: '#fde68a', borderRadius: 5, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>Booked</span>}
                        {fg && <span style={{ background: '#0c1a2e', border: '1px solid #1d4ed8', color: '#93c5fd', borderRadius: 5, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>F&G/NLG App</span>}
                        {approved && <span style={{ background: '#052e16', border: '1px solid #16a34a', color: '#86efac', borderRadius: 5, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>Approved</span>}
                      </div>
                      {/* Expanded detail row */}
                      {isExpanded && (
                        <div style={{ marginTop: 10, padding: 10, background: '#060d1a', borderRadius: 8, border: '1px solid #1e293b', fontSize: 12 }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', color: '#94a3b8' }}>
                            {[
                              ['Birthday', r.birthday || r.dateOfBirth],
                              ['Income', r.hasIncome === 'yes' ? (r.incomeSource || 'Yes') : 'No'],
                              ['Licensed', r.isLicensed === 'yes' ? 'Yes' : 'No'],
                              ['Health', r.healthStatus],
                              ['Hours/wk', r.hoursPerWeek],
                              ['Score', r.application_score],
                              ['Decision', r.decision_bucket],
                              ['Heard From', r.heardFrom],
                            ].map(([label, val]) => val ? (
                              <div key={label}><span style={{ color: '#475569' }}>{label}:</span> <strong style={{ color: '#e2e8f0' }}>{val}</strong></div>
                            ) : null)}
                          </div>
                          {r.motivation && <div style={{ marginTop: 8, color: '#94a3b8' }}><span style={{ color: '#475569' }}>Motivation:</span> {r.motivation}</div>}
                          {r.whyJoin && <div style={{ marginTop: 4, color: '#94a3b8' }}><span style={{ color: '#475569' }}>Why Join:</span> {r.whyJoin}</div>}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{r.phone || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{r.state || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', maxWidth: 160 }}>{sponsor}</td>
                    <td style={{ padding: '10px 12px', color: approved ? '#86efac' : '#64748b', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {clean(r.status) || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmt(r.submitted_at)}</td>
                    <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                      <NoteCell
                        touchKey={tk}
                        initialNote={touch.note || ''}
                        onSaved={handleNoteSaved}
                      />
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#475569' }}>No applicants match the current filter.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#475569' }}>Loading applicants...</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 14, color: '#334155', fontSize: 12 }}>
          Click any row to expand details. Click the notes cell to add or edit a note.
        </div>
      </div>
    </div>
  );
}
