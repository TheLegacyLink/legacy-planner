'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

function clean(v = '') {
  return String(v || '').trim();
}

function fmt(iso = '') {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function SmsRepliesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const res = await fetch('/api/ghl-sms-replies', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Failed to load SMS replies');
        return;
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const summary = useMemo(() => {
    const total = rows.length;
    const today = rows.filter((r) => {
      const d = new Date(r.receivedAt || 0);
      if (Number.isNaN(d.getTime())) return false;
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    return { total, today };
  }, [rows]);

  return (
    <AppShell title="SMS Replies">
      <div className="panelRow" style={{ marginBottom: 10 }}>
        <span className="pill onpace">Total Replies: {summary.total}</span>
        <span className="pill onpace">Today: {summary.today}</span>
        <button type="button" className="ghost" onClick={load}>Refresh</button>
      </div>

      <div className="panel">
        <div className="panelRow">
          <h3 style={{ margin: 0 }}>Inbound SMS Replies</h3>
          <small className="muted">Auto-refreshes every 30 seconds</small>
        </div>

        {loading ? <p className="muted">Loading...</p> : null}
        {error ? <p className="red">{error}</p> : null}

        <table>
          <thead>
            <tr>
              <th>Received</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{fmt(r.receivedAt)}</td>
                <td>{clean(r.name) || '—'}</td>
                <td>{clean(r.phone) || '—'}</td>
                <td>{clean(r.email) || '—'}</td>
                <td style={{ maxWidth: 520, whiteSpace: 'pre-wrap' }}>{clean(r.text) || '—'}</td>
              </tr>
            ))}
            {!rows.length && !loading ? (
              <tr><td colSpan={5} className="muted">No inbound SMS replies yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
