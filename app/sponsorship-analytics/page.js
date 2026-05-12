'use client';

import { useEffect, useState, useCallback } from 'react';
import AppShell from '../../components/AppShell';

function pct(num, den) {
  if (!den) return '—';
  return `${Math.round((num / den) * 100)}%`;
}

function bar(value, max, color = '#2563eb') {
  const w = max ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden', minWidth: 80 }}>
      <div style={{ width: `${w}%`, height: '100%', background: color, transition: 'width .3s ease', borderRadius: 999 }} />
    </div>
  );
}

export default function SponsorshipAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/sponsorship-analytics?days=${days}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load');
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const maxViews = data?.agentStats?.length ? Math.max(...data.agentStats.map((a) => a.pageViews)) : 1;

  return (
    <AppShell title="Sponsorship Analytics">

      {/* Header */}
      <div className="panelRow" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Sponsorship Funnel Analytics</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button type="button" className="ghost" onClick={load}>Refresh</button>
        </div>
      </div>

      {error ? <p className="pill" style={{ background: '#fee2e2', color: '#991b1b' }}>{error}</p> : null}
      {loading ? <p className="muted">Loading analytics…</p> : null}

      {data && !loading && (
        <>
          {/* Funnel Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div className="panel" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#1e3a8a' }}>{data.totals.pageViews}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Landing Page Views</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Visited sponsorship-signup</div>
            </div>
            <div className="panel" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#0f766e' }}>{data.totals.formStarts}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Form Starts</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                {pct(data.totals.formStarts, data.totals.pageViews)} clicked through
              </div>
            </div>
            <div className="panel" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#7c3aed' }}>{data.totals.submissions}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Completed Applications</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                {pct(data.totals.submissions, data.totals.formStarts)} of form starts finished
              </div>
            </div>
            <div className="panel" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: data.totals.pageViews > 0 ? '#d97706' : '#94a3b8' }}>
                {pct(data.totals.submissions, data.totals.pageViews)}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Overall Conversion</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>View → Completed Application</div>
            </div>
          </div>

          {/* Funnel Visual */}
          <div className="panel" style={{ marginBottom: 20 }}>
            <h3 style={{ marginTop: 0, marginBottom: 14 }}>Conversion Funnel</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                { label: 'Landed on Page', value: data.totals.pageViews, color: '#2563eb' },
                { label: 'Started Application', value: data.totals.formStarts, color: '#0f766e' },
                { label: 'Submitted Application', value: data.totals.submissions, color: '#7c3aed' }
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 60px', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: '#475569' }}>{label}</span>
                  <div style={{ height: 10, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                    <div style={{
                      width: data.totals.pageViews ? `${Math.round((value / data.totals.pageViews) * 100)}%` : '0%',
                      height: '100%',
                      background: color,
                      borderRadius: 999,
                      transition: 'width .4s ease'
                    }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color, textAlign: 'right' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Trend */}
          {data.trend?.length > 0 && (
            <div className="panel" style={{ marginBottom: 20, overflowX: 'auto' }}>
              <h3 style={{ marginTop: 0, marginBottom: 14 }}>Daily Activity ({Math.min(days, 14)}-day view)</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Page Views</th>
                    <th>Form Starts</th>
                    <th>Submissions</th>
                    <th>Start Rate</th>
                    <th>Submit Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trend.map((d) => (
                    <tr key={d.label}>
                      <td style={{ fontWeight: 600 }}>{d.label}</td>
                      <td>{d.pageViews}</td>
                      <td>{d.formStarts}</td>
                      <td>{d.submissions}</td>
                      <td>{pct(d.formStarts, d.pageViews)}</td>
                      <td>{pct(d.submissions, d.formStarts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Per-Agent Breakdown */}
          <div className="panel" style={{ overflowX: 'auto' }}>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>Agent Link Performance</h3>
            <p className="muted" style={{ marginTop: 0, marginBottom: 14 }}>
              Who&apos;s driving traffic — and how well is it converting?
            </p>
            {data.agentStats?.length === 0 ? (
              <p className="muted">No data yet. Traffic will appear here once people start visiting via agent links.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Ref Code</th>
                    <th>Page Views</th>
                    <th>Reach</th>
                    <th>Form Starts</th>
                    <th>Click-Through</th>
                    <th>Submitted</th>
                    <th>Conversion</th>
                    <th>Drop-Off</th>
                    <th>Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.agentStats.map((a) => {
                    const dropOff = a.formStarts - a.submissions;
                    return (
                      <tr key={a.refCode}>
                        <td style={{ fontWeight: 700 }}>{a.agentName}</td>
                        <td><code style={{ fontSize: 12, color: '#64748b' }}>{a.refCode}</code></td>
                        <td>
                          <div style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontWeight: 700 }}>{a.pageViews}</span>
                            {bar(a.pageViews, maxViews, '#2563eb')}
                          </div>
                        </td>
                        <td>{pct(a.pageViews, data.totals.pageViews)} of total</td>
                        <td style={{ fontWeight: 600, color: '#0f766e' }}>{a.formStarts}</td>
                        <td>{pct(a.formStarts, a.pageViews)}</td>
                        <td style={{ fontWeight: 700, color: '#7c3aed' }}>{a.submissions}</td>
                        <td>
                          <span
                            className="pill"
                            style={{
                              background: a.submissions / (a.pageViews || 1) >= 0.3 ? '#dcfce7' : a.submissions / (a.pageViews || 1) >= 0.1 ? '#fef3c7' : '#fee2e2',
                              color: a.submissions / (a.pageViews || 1) >= 0.3 ? '#166534' : a.submissions / (a.pageViews || 1) >= 0.1 ? '#92400e' : '#991b1b'
                            }}
                          >
                            {pct(a.submissions, a.pageViews)}
                          </span>
                        </td>
                        <td style={{ color: dropOff > 0 ? '#b91c1c' : '#94a3b8' }}>
                          {dropOff > 0 ? `${dropOff} dropped off` : '—'}
                        </td>
                        <td style={{ fontSize: 12, color: '#94a3b8' }}>
                          {a.lastActivity ? new Date(a.lastActivity).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
