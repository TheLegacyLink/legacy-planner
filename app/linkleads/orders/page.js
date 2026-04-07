'use client';

import { useEffect, useMemo, useState } from 'react';

function money(v = 0) {
  return `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmt(v = '') {
  const d = new Date(v || 0);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function LinkLeadsOrdersPage() {
  const [auth, setAuth] = useState({ name: '', role: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const canManage = auth.role === 'manager' || auth.role === 'admin';

  async function loadRows() {
    if (!canManage) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotice('');
    try {
      const res = await fetch(`/api/linkleads/orders?actorRole=${encodeURIComponent(auth.role)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setNotice(data?.error || 'Could not load orders');
        return;
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const session = JSON.parse(sessionStorage.getItem('legacy_lead_marketplace_user_v1') || '{}');
      setAuth({ name: String(session?.name || ''), role: String(session?.role || '') });
    } catch {
      setAuth({ name: '', role: '' });
    }
  }, []);

  useEffect(() => {
    if (!auth.role) return;
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.role]);

  async function act(orderId, action) {
    if (!canManage || !orderId) return;
    setBusyId(orderId + ':' + action);
    setNotice('');
    try {
      const res = await fetch('/api/linkleads/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action, actorRole: auth.role, actorName: auth.name })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setNotice(data?.error || 'Could not update order');
        return;
      }
      setNotice(action === 'delivered'
        ? 'Order marked delivered and buyer email sent.'
        : 'Order marked setup started.');
      await loadRows();
    } finally {
      setBusyId('');
    }
  }

  const stats = useMemo(() => {
    const revenue = rows.reduce((s, r) => s + Number(r?.amountTotalUsd || 0), 0);
    const leads = rows.reduce((s, r) => s + Number(r?.quantity || 0), 0);
    const pending = rows.filter((r) => (r?.fulfillmentStatus || 'setup_pending') === 'setup_pending').length;
    const started = rows.filter((r) => r?.fulfillmentStatus === 'setup_started').length;
    const delivered = rows.filter((r) => r?.fulfillmentStatus === 'delivered').length;
    return { orders: rows.length, revenue, leads, pending, started, delivered };
  }, [rows]);

  const leadTypeOptions = useMemo(() => {
    const set = new Set(rows.map((r) => String(r?.leadLabel || '').trim()).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    return rows.filter((r) => {
      const status = String(r?.fulfillmentStatus || 'setup_pending');
      const type = String(r?.leadLabel || '');
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (typeFilter !== 'all' && type !== typeFilter) return false;

      if (!q) return true;
      const hay = [
        r?.orderId,
        r?.buyerName,
        r?.buyerEmail,
        r?.buyerNpn,
        r?.leadLabel,
        r?.leadType,
        status
      ].map((x) => String(x || '').toLowerCase()).join(' | ');

      return hay.includes(q);
    });
  }, [rows, search, statusFilter, typeFilter]);

  if (!canManage) {
    return (
      <main className="publicPage" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#020617' }}>
        <div className="panel" style={{ maxWidth: 640 }}>
          <h1 style={{ marginTop: 0 }}>Link Leads Orders</h1>
          <p className="muted">Manager access required. Please sign in with a manager/admin account.</p>
          <a href="/session/new?next=/linkleads/orders"><button type="button">Sign In</button></a>
        </div>
      </main>
    );
  }

  return (
    <main className="publicPage" style={{ background: '#020617', minHeight: '100vh', paddingBottom: 30 }}>
      <div className="panel" style={{ maxWidth: 1160 }}>
        <div className="panelRow" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <h1 style={{ margin: 0 }}>Link Leads Orders</h1>
          <button type="button" className="ghost" onClick={loadRows} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
        </div>

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
          <Stat label="Orders" value={stats.orders} />
          <Stat label="Revenue" value={money(stats.revenue)} />
          <Stat label="Leads Sold" value={stats.leads} />
          <Stat label="Setup Pending" value={stats.pending} />
          <Stat label="Setup Started" value={stats.started} />
          <Stat label="Delivered" value={stats.delivered} />
        </div>

        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '2fr 1fr 1fr auto', marginTop: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <small className="muted">Search</small>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="order id, buyer, email, NPN, lead type"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <small className="muted">Status</small>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="setup_pending">Setup Pending</option>
              <option value="setup_started">Setup Started</option>
              <option value="delivered">Delivered</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <small className="muted">Lead Type</small>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {leadTypeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt === 'all' ? 'All' : opt}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setTypeFilter('all');
            }}
          >
            Clear
          </button>
        </div>

        <small className="muted" style={{ display: 'block', marginTop: 8 }}>
          Showing {filteredRows.length} of {rows.length} orders
        </small>

        {notice ? <p style={{ color: '#c7d2fe', marginTop: 10 }}>{notice}</p> : null}

        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {filteredRows.map((r) => {
            const status = r?.fulfillmentStatus || 'setup_pending';
            const canStart = status === 'setup_pending';
            const canDeliver = status !== 'delivered';
            return (
              <div key={r.orderId} style={{ border: '1px solid #24314f', borderRadius: 12, background: '#0b1220', padding: 12 }}>
                <div className="panelRow" style={{ justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div>
                    <strong>{r.leadLabel || 'Lead Order'}</strong>
                    <div className="muted" style={{ marginTop: 2 }}>Order #{r.orderId} • {fmt(r.createdAt)}</div>
                    <div className="muted">Buyer: {r.buyerName || '—'} ({r.buyerEmail || '—'})</div>
                  </div>
                  <span className="pill">{status.replace(/_/g, ' ')}</span>
                </div>

                <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', marginTop: 8 }}>
                  <small className="muted">Quantity: <strong style={{ color: '#e2e8f0' }}>{r.quantity || 0}</strong></small>
                  <small className="muted">Amount: <strong style={{ color: '#e2e8f0' }}>{money(r.amountTotalUsd)}</strong></small>
                  <small className="muted">NPN: <strong style={{ color: '#e2e8f0' }}>{r.buyerNpn || '—'}</strong></small>
                  <small className="muted">Paid: <strong style={{ color: '#e2e8f0' }}>{fmt(r.paidAt)}</strong></small>
                  <small className="muted">Policy Accepted: <strong style={{ color: '#e2e8f0' }}>{r.policyAccepted ? fmt(r.policyAcceptedAt || r.paidAt) : 'No'}</strong></small>
                  <small className="muted">Licensed States: <strong style={{ color: '#e2e8f0' }}>{r.setupLicensedStatesCount || 0}</strong></small>
                  <small className="muted">Daily Cap: <strong style={{ color: '#e2e8f0' }}>{r.setupDailyLeadCap || '-'}</strong></small>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <button
                    type="button"
                    className="ghost"
                    disabled={!canStart || busyId === `${r.orderId}:setup_started`}
                    onClick={() => act(r.orderId, 'setup_started')}
                  >
                    {busyId === `${r.orderId}:setup_started` ? 'Saving...' : 'Mark Setup Started'}
                  </button>
                  <button
                    type="button"
                    disabled={!canDeliver || busyId === `${r.orderId}:delivered`}
                    onClick={() => act(r.orderId, 'delivered')}
                  >
                    {busyId === `${r.orderId}:delivered` ? 'Sending Email...' : 'Mark Delivered + Email Buyer'}
                  </button>
                </div>
              </div>
            );
          })}

          {!filteredRows.length && !loading ? (
            <div className="muted">No orders match the current filters.</div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ border: '1px solid #24314f', borderRadius: 10, background: '#0b1220', padding: 10 }}>
      <small className="muted">{label}</small>
      <div style={{ fontWeight: 800, color: '#e2e8f0', marginTop: 4 }}>{value}</div>
    </div>
  );
}
