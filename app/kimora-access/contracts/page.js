'use client';

import { useEffect, useState } from 'react';

const MASTER_PASS = process.env.NEXT_PUBLIC_CONTRACT_ADMIN_TOKEN || 'LegacyLink216';

function clean(v = '') { return String(v || '').trim(); }
function fmtDate(ts = '') {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return ts; }
}

const bg = {
  minHeight: '100vh',
  background: 'radial-gradient(1100px 520px at 8% -8%, rgba(59,130,246,.22), transparent 58%), #020617',
  padding: 20,
  color: '#F8FAFC'
};
const card = {
  maxWidth: 1100, margin: '0 auto',
  background: '#081124', border: '1px solid #1F2A44', borderRadius: 16, padding: 22
};
const tbl = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const th = { padding: '8px 10px', borderBottom: '1px solid #1E3A5F', color: '#94A3B8', textAlign: 'left', fontWeight: 700 };
const td = { padding: '8px 10px', borderBottom: '1px solid #0F1F3A', verticalAlign: 'top' };
const btnSm = { padding: '5px 12px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', background: '#1651AE', color: '#fff' };
const btnSmGray = { ...btnSm, background: '#1E3A5F' };

export default function KimoraContractsPage() {
  const [pass, setPass] = useState('');
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [countersigning, setCountersigning] = useState('');

  function login() {
    if (clean(pass) === clean(MASTER_PASS)) {
      setAuthed(true);
      setError('');
    } else {
      setError('Incorrect password.');
    }
  }

  async function loadContracts() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/esign-contract/list?adminToken=${encodeURIComponent(clean(MASTER_PASS))}&filter=${filter}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) { setError('Failed to load contracts.'); return; }
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (authed) loadContracts();
  }, [authed, filter]);

  async function countersign(email = '') {
    setCountersigning(email);
    setNotice(''); setError('');
    try {
      const res = await fetch('/api/esign-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer admin` },
        body: JSON.stringify({ action: 'kimora_countersign', adminToken: clean(MASTER_PASS), email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) { setError('Countersign failed: ' + (data?.error || 'unknown')); return; }
      setNotice(`✅ Countersigned for ${email}`);
      loadContracts();
    } finally { setCountersigning(''); }
  }

  if (!authed) {
    return (
      <main style={bg}>
        <div style={{ ...card, maxWidth: 400, margin: '60px auto' }}>
          <h2 style={{ margin: '0 0 14px' }}>Contract Admin Access</h2>
          <input
            type="password"
            placeholder="Master password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            style={{ width: '100%', background: '#0B1220', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px', color: '#F8FAFC', fontSize: 15, boxSizing: 'border-box', marginBottom: 10 }}
          />
          {error && <p style={{ color: '#F87171', fontSize: 13, margin: '0 0 8px' }}>{error}</p>}
          <button onClick={login} style={{ ...btnSm, width: '100%', padding: '11px 0', fontSize: 14 }}>Enter</button>
        </div>
      </main>
    );
  }

  const pendingCount = rows.filter((r) => r?.candidateSignedAt && !r?.kimuraSignedAt).length;

  return (
    <main style={bg}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>Contract Signatures</h1>
            <p style={{ margin: '4px 0 0', color: '#94A3B8', fontSize: 13 }}>
              Internal e-sign audit trail. {pendingCount > 0 && <strong style={{ color: '#FBBF24' }}>{pendingCount} pending your countersign.</strong>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ background: '#0B1220', border: '1px solid #334155', borderRadius: 8, color: '#CBD5E1', padding: '7px 10px', fontSize: 13 }}
            >
              <option value="all">All</option>
              <option value="pending_countersign">Pending Countersign</option>
              <option value="finalized">Finalized</option>
            </select>
            <button style={btnSmGray} onClick={loadContracts} disabled={loading}>{loading ? 'Loading…' : '↻ Refresh'}</button>
          </div>
        </div>

        {notice && <p style={{ color: '#86EFAC', fontSize: 13, margin: '0 0 10px' }}>{notice}</p>}
        {error && <p style={{ color: '#F87171', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}

        {rows.length === 0 && !loading && (
          <p style={{ color: '#64748B', fontSize: 14 }}>No contracts found for this filter.</p>
        )}

        {rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Email</th>
                  <th style={th}>Track</th>
                  <th style={th}>Typed Signature</th>
                  <th style={th}>Signed</th>
                  <th style={th}>Countersigned</th>
                  <th style={th}>Envelope ID</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r?.envelopeId || r?.email}>
                    <td style={td}>{clean(r?.name) || '—'}</td>
                    <td style={td}>{clean(r?.email) || '—'}</td>
                    <td style={td}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: r?.trackType === 'licensed' ? '#1651AE22' : '#16653222',
                        color: r?.trackType === 'licensed' ? '#93C5FD' : '#86EFAC',
                        border: `1px solid ${r?.trackType === 'licensed' ? '#1651AE' : '#166532'}`
                      }}>
                        {clean(r?.trackType) || 'unlicensed'}
                      </span>
                    </td>
                    <td style={td}>{clean(r?.typedName) || '—'}</td>
                    <td style={td}>{fmtDate(r?.candidateSignedAt)}</td>
                    <td style={td}>
                      {r?.kimuraSignedAt
                        ? <span style={{ color: '#86EFAC', fontWeight: 700 }}>✓ {fmtDate(r?.kimuraSignedAt)}</span>
                        : <span style={{ color: '#FBBF24' }}>Pending</span>
                      }
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{clean(r?.envelopeId) || '—'}</td>
                    <td style={td}>
                      {r?.candidateSignedAt && !r?.kimuraSignedAt && (
                        <button
                          style={btnSm}
                          onClick={() => countersign(r?.email)}
                          disabled={countersigning === r?.email}
                        >
                          {countersigning === r?.email ? 'Signing…' : 'Countersign'}
                        </button>
                      )}
                      {r?.kimuraSignedAt && (
                        <span style={{ color: '#64748B', fontSize: 12 }}>Done</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 16, borderTop: '1px solid #1E3A5F', paddingTop: 12 }}>
          <a href="/kimora-access" style={{ color: '#60A5FA', fontSize: 13 }}>← Back to Kimora Access</a>
        </div>
      </div>
    </main>
  );
}
