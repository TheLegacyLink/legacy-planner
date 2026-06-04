'use client';

import AppShell from '../../components/AppShell';
import { useEffect, useState } from 'react';

const GOLD = '#C8A96B';
const STATUS_COLORS = {
  pending:     { bg: '#1c1a07', border: '#a16207', text: '#fde68a', label: 'Pending' },
  in_progress: { bg: '#0c1a2e', border: '#1d4ed8', text: '#bfdbfe', label: 'In Progress' },
  fulfilled:   { bg: '#052e16', border: '#16a34a', text: '#bbf7d0', label: 'Fulfilled' },
  on_hold:     { bg: '#1c0a0a', border: '#b91c1c', text: '#fecaca', label: 'On Hold' },
};

function fmt(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

function OrderCard({ order, onUpdate }) {
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(order.notes || '');
  const [notesEdit, setNotesEdit] = useState(false);
  const [msg, setMsg] = useState('');

  function getAdminToken() {
    try {
      if (localStorage.getItem('legacy_planner_owner_access_v1') === 'ok') return 'LegacyLink2026';
    } catch {}
    return localStorage.getItem('store_admin_token') || '';
  }

  async function patch(fields) {
    setBusy(true);
    setMsg('');
    try {
      const token = getAdminToken();
      const res = await fetch('/api/card-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': token },
        body: JSON.stringify({ ref: order.ref, ...fields }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { setMsg(data.error || 'Update failed'); return; }
      setMsg('Saved.');
      onUpdate(data.order);
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(''), 2500);
    }
  }

  const submitMode = order.submitMode || 'email';
  const hasPhotoUrl = !!order.photoUrl;
  const saidHasPhoto = !!order.hasPhoto;

  return (
    <div style={{ border: '1px solid #1e293b', borderRadius: 14, background: '#0b1220', padding: '18px 20px', marginBottom: 14 }}>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ color: '#f1f5f9', fontSize: 17 }}>{order.name || '—'}</strong>
            <StatusBadge status={order.status || 'pending'} />
            {order.qty && (
              <span style={{ background: '#0f172a', border: '1px solid #334155', color: '#94a3b8', borderRadius: 6, padding: '3px 9px', fontSize: 12 }}>
                {Number(order.qty).toLocaleString()} cards
              </span>
            )}
          </div>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
            Ref: {order.ref || '—'} &nbsp;•&nbsp; Submitted: {fmt(order.submittedAt)}
            {order.updatedAt ? <>&nbsp;•&nbsp; Updated: {fmt(order.updatedAt)}</> : null}
            {order.fulfilledAt ? <>&nbsp;•&nbsp; Fulfilled: {fmt(order.fulfilledAt)}</> : null}
          </div>
        </div>
      </div>

      {/* Photo section */}
      <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: '#060d1a', border: '1px solid #1e293b' }}>
        <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Photo / Headshot
        </div>
        {hasPhotoUrl ? (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={order.photoUrl} alt="Card photo" style={{ maxWidth: 220, maxHeight: 220, borderRadius: 8, border: '1px solid #334155', display: 'block', marginBottom: 8 }} />
            <a href={order.photoUrl} target="_blank" rel="noreferrer" style={{ color: GOLD, fontSize: 13 }}>Open full size ↗</a>
          </div>
        ) : submitMode === 'email' ? (
          <div style={{ color: '#fde68a', fontSize: 13 }}>
            📧 Agent chose to email photo — check <strong>support@thelegacylink.com</strong> for incoming photo from {order.name}.
          </div>
        ) : saidHasPhoto ? (
          <div style={{ color: '#fca5a5', fontSize: 13 }}>
            ⚠️ Upload was marked complete but no photo URL was saved — the file may not have uploaded successfully. Ask agent to resend photo to <strong>support@thelegacylink.com</strong>.
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: 13 }}>No photo submitted.</div>
        )}
      </div>

      {/* Notes section */}
      <div style={{ marginTop: 12 }}>
        {notesEdit ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes..."
              style={{ flex: 1, minWidth: 200, padding: '8px 10px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 13, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button type="button" disabled={busy} onClick={() => { patch({ notes }); setNotesEdit(false); }} style={{ padding: '7px 14px', background: GOLD, color: '#0b1220', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                Save Notes
              </button>
              <button type="button" onClick={() => { setNotes(order.notes || ''); setNotesEdit(false); }} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: order.notes ? '#cbd5e1' : '#475569', fontSize: 13 }}>
              {order.notes || 'No notes yet.'}
            </span>
            <button type="button" onClick={() => setNotesEdit(true)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              {order.notes ? 'Edit' : '+ Note'}
            </button>
          </div>
        )}
      </div>

      {/* Status actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
        <span style={{ color: '#64748b', fontSize: 12 }}>Update status:</span>
        {Object.entries(STATUS_COLORS).map(([key, val]) => (
          <button
            key={key}
            type="button"
            disabled={busy || order.status === key}
            onClick={() => patch({ status: key })}
            style={{
              padding: '6px 13px',
              borderRadius: 7,
              border: `1px solid ${order.status === key ? val.border : '#334155'}`,
              background: order.status === key ? val.bg : 'transparent',
              color: order.status === key ? val.text : '#94a3b8',
              cursor: order.status === key ? 'default' : 'pointer',
              fontSize: 12,
              fontWeight: order.status === key ? 700 : 400,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {val.label}
          </button>
        ))}
        {msg ? <span style={{ color: msg === 'Saved.' ? '#86efac' : '#fca5a5', fontSize: 12 }}>{msg}</span> : null}
      </div>
    </div>
  );
}

export default function CardOrdersAdmin() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');

  function getAdminToken() {
    // If AppShell already verified owner access, use skeleton password directly
    try {
      if (localStorage.getItem('legacy_planner_owner_access_v1') === 'ok') return 'LegacyLink2026';
    } catch {}
    return localStorage.getItem('store_admin_token') || '';
  }

  async function load() {
    setLoading(true);
    setErr('');
    const token = getAdminToken();
    try {
      const res = await fetch('/api/card-orders', { headers: { 'x-admin-key': token }, cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { setErr(data.error || 'Could not load orders'); return; }
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch {
      setErr('Network error loading orders.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleUpdate(updated) {
    setOrders(prev => prev.map(o => o.ref === updated.ref ? updated : o));
  }

  const counts = {
    all: orders.length,
    pending: orders.filter(o => (o.status || 'pending') === 'pending').length,
    in_progress: orders.filter(o => o.status === 'in_progress').length,
    fulfilled: orders.filter(o => o.status === 'fulfilled').length,
    on_hold: orders.filter(o => o.status === 'on_hold').length,
  };

  const filtered = filter === 'all' ? orders : orders.filter(o => (o.status || 'pending') === filter);

  return (
    <AppShell title="Business Card Orders">
      <div style={{ maxWidth: 860 }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { key: 'all',         label: 'Total Orders',  color: '#e2e8f0' },
            { key: 'pending',     label: 'Pending',       color: '#fde68a' },
            { key: 'in_progress', label: 'In Progress',   color: '#bfdbfe' },
            { key: 'fulfilled',   label: 'Fulfilled',     color: '#bbf7d0' },
            { key: 'on_hold',     label: 'On Hold',       color: '#fecaca' },
          ].map(({ key, label, color }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              style={{ border: `1px solid ${filter === key ? GOLD : '#1e293b'}`, borderRadius: 10, background: filter === key ? '#12192b' : '#0b1220', padding: '10px 12px', textAlign: 'left', cursor: 'pointer' }}
            >
              <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>{label}</div>
              <div style={{ color, fontWeight: 800, fontSize: 22 }}>{counts[key]}</div>
            </button>
          ))}
        </div>

        {/* Refresh */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button type="button" className="ghost" onClick={load} disabled={loading} style={{ fontSize: 13 }}>
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        </div>

        {err ? <p style={{ color: '#fca5a5' }}>{err}</p> : null}

        {!loading && filtered.length === 0 && (
          <div style={{ color: '#475569', padding: '28px 0' }}>No orders{filter !== 'all' ? ` with status "${filter}"` : ''} yet.</div>
        )}

        {filtered.map(order => (
          <OrderCard key={order.ref || order.submittedAt} order={order} onUpdate={handleUpdate} />
        ))}
      </div>
    </AppShell>
  );
}
