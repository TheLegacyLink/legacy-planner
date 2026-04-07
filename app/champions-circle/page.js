'use client';

import { useEffect, useState } from 'react';

const INNER_SESSION_KEY = 'inner_circle_hub_member_v1';
const LICENSED_TOKEN_KEY = 'licensed_backoffice_token';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase(); }

export default function ChampionsCircleHomePage() {
  const [who, setWho] = useState({ licensed: false, inner: false, name: '' });
  const [manager, setManager] = useState({ loading: false, ready: [], totalProjected: 0, quarterReady: 0, month: '', monthLock: { locked: false } });
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeMsg, setFinalizeMsg] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadManagerPreview() {
      setManager((m) => ({ ...m, loading: true }));
      try {
        const [licRes, innerRes] = await Promise.all([
          fetch('/api/champions-circle?group=licensed', { cache: 'no-store' }),
          fetch('/api/champions-circle?group=inner', { cache: 'no-store' })
        ]);
        const lic = licRes.ok ? await licRes.json().catch(() => ({})) : {};
        const inn = innerRes.ok ? await innerRes.json().catch(() => ({})) : {};
        const rows = [...(Array.isArray(lic?.rows) ? lic.rows : []), ...(Array.isArray(inn?.rows) ? inn.rows : [])];
        const ready = rows
          .filter((r) => Number(r?.monthlyCashPayout || 0) > 0)
          .sort((a, b) => Number(b?.monthlyCashPayout || 0) - Number(a?.monthlyCashPayout || 0));
        const totalProjected = ready.reduce((sum, r) => sum + Number(r?.monthlyCashPayout || 0), 0);
        const quarterReady = rows.filter((r) => Boolean(r?.quarterTierHit)).length;
        const month = String(lic?.month || inn?.month || '');
        const monthLock = lic?.monthLock || inn?.monthLock || { locked: false };
        setManager({ loading: false, ready: ready.slice(0, 8), totalProjected, quarterReady, month, monthLock });
      } catch {
        setManager({ loading: false, ready: [], totalProjected: 0, quarterReady: 0, month: '', monthLock: { locked: false } });
      }
    }

    async function boot() {
      let licensed = false;
      let licensedName = '';
      let inner = false;
      let innerName = '';

      if (typeof window !== 'undefined') {
        try {
          const token = clean(window.localStorage.getItem(LICENSED_TOKEN_KEY) || '');
          if (token) {
            const res = await fetch('/api/licensed-backoffice/auth/me', {
              headers: { Authorization: `Bearer ${token}` },
              cache: 'no-store'
            });
            const json = res.ok ? await res.json().catch(() => ({})) : {};
            if (json?.ok && json?.profile) {
              licensed = true;
              licensedName = clean(json.profile?.name || '');
            }
          }
        } catch {
          // ignore
        }

        try {
          const localInner = JSON.parse(window.localStorage.getItem(INNER_SESSION_KEY) || 'null');
          if (localInner?.active) {
            inner = true;
            innerName = clean(localInner?.applicantName || localInner?.name || '');
          }
        } catch {
          // ignore
        }
      }

      if (!mounted) return;

      // Mutually exclusive display: licensed first, otherwise inner.
      if (licensed) {
        setWho({ licensed: true, inner: false, name: licensedName || '' });
      } else {
        setWho({ licensed: false, inner, name: innerName || '' });
      }
    }

    boot();
    loadManagerPreview();
    return () => { mounted = false; };
  }, []);

  async function finalizeMonth() {
    if (!manager?.month) return;
    const ok = window.confirm(`Finalize ${manager.month}? This will lock monthly payout numbers for audit.`);
    if (!ok) return;
    setFinalizing(true);
    setFinalizeMsg('');
    try {
      const res = await fetch('/api/champions-circle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finalize_month_snapshot', month: manager.month, actorName: who.name || 'Kimora Link' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setFinalizeMsg(`Finalize failed: ${data?.error || 'unknown_error'}`);
        return;
      }
      setFinalizeMsg(data?.alreadyLocked ? 'Month is already finalized.' : `Month ${manager.month} finalized successfully.`);
      // Refresh manager card
      const [licRes, innerRes] = await Promise.all([
        fetch('/api/champions-circle?group=licensed', { cache: 'no-store' }),
        fetch('/api/champions-circle?group=inner', { cache: 'no-store' })
      ]);
      const lic = licRes.ok ? await licRes.json().catch(() => ({})) : {};
      const inn = innerRes.ok ? await innerRes.json().catch(() => ({})) : {};
      const rows = [...(Array.isArray(lic?.rows) ? lic.rows : []), ...(Array.isArray(inn?.rows) ? inn.rows : [])];
      const ready = rows.filter((r) => Number(r?.monthlyCashPayout || 0) > 0).sort((a, b) => Number(b?.monthlyCashPayout || 0) - Number(a?.monthlyCashPayout || 0));
      const totalProjected = ready.reduce((sum, r) => sum + Number(r?.monthlyCashPayout || 0), 0);
      const quarterReady = rows.filter((r) => Boolean(r?.quarterTierHit)).length;
      const month = String(lic?.month || inn?.month || '');
      const monthLock = lic?.monthLock || inn?.monthLock || { locked: false };
      setManager({ loading: false, ready: ready.slice(0, 8), totalProjected, quarterReady, month, monthLock });
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', padding: 16, maxWidth: 1000, margin: '0 auto' }}>
      <div className="panel" style={{ borderColor: '#1d4ed8', background: '#07132b' }}>
        <h2 style={{ marginTop: 0 }}>Legacy Link Champions Circle</h2>
        <p className="muted" style={{ marginBottom: 6 }}>
          Incentive progress for signed-in agents only. Each agent only sees their own stats.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Signed in as: <strong>{who.name || 'Not detected yet'}</strong>
        </p>
      </div>

      <div className="panel" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {who.licensed ? (
            <a href="/champions-circle/licensed" className="publicPrimaryBtn" style={{ textDecoration: 'none' }}>
              Open Licensed Incentive Progress
            </a>
          ) : null}

          {!who.licensed && who.inner ? (
            <a href="/champions-circle/inner-circle" className="publicPrimaryBtn" style={{ textDecoration: 'none' }}>
              Open Inner Circle Incentive Progress
            </a>
          ) : null}

          <a href="/champions-circle/incentive-guide" className="ghost" style={{ textDecoration: 'none' }}>
            Open Incentive Guide (PDF Style)
          </a>
        </div>

        <p className="muted" style={{ margin: 0 }}>
          Track detected: <strong>{who.licensed ? 'Licensed' : (who.inner ? 'Inner Circle' : 'Not signed in')}</strong>
        </p>
      </div>

      {normalize(who.name) === 'kimora link' ? (
        <div className="panel" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Manager Alert Card</h3>
          <p className="muted" style={{ marginTop: 0 }}>Monthly payout-ready agents: {manager.ready.length} • Monthly projected total: <strong>${Number(manager.totalProjected || 0).toLocaleString()}</strong> • Quarterly qualifiers: <strong>{Number(manager.quarterReady || 0)}</strong></p>
          {manager.loading ? <p className="muted">Loading manager preview…</p> : null}
          <div style={{ display: 'grid', gap: 6 }}>
            {manager.ready.map((r) => (
              <small key={`${r.group}-${r.agent}`} className="muted">
                {r.agent} • {r.group === 'inner' ? 'Inner Circle' : 'Licensed'} • ${Number(r.monthlyCashPayout || 0).toLocaleString()} projected
              </small>
            ))}
            {!manager.loading && !manager.ready.length ? <small className="muted">No payout-ready agents detected yet.</small> : null}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ padding: '6px 10px', borderRadius: 999, border: manager?.monthLock?.locked ? '1px solid #eab308' : '1px solid #334155', background: manager?.monthLock?.locked ? 'rgba(234,179,8,.14)' : '#0b1220', color: manager?.monthLock?.locked ? '#fde047' : '#cbd5e1' }}>
              {manager?.monthLock?.locked ? `Month Locked (${manager.month})` : `Month Open (${manager.month || '—'})`}
            </span>
            <button type="button" onClick={finalizeMonth} disabled={finalizing || !normalize(who.name || '').includes('kimora') || manager?.monthLock?.locked}>
              {finalizing ? 'Finalizing…' : 'Finalize Month (Lock Snapshot)'}
            </button>
            {finalizeMsg ? <small className="muted">{finalizeMsg}</small> : null}
          </div>

          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href="/policy-payouts" className="ghost" style={{ textDecoration: 'none' }}>Open Policy Payout Ledger</a>
            <a href="/champions-circle" className="ghost" style={{ textDecoration: 'none' }}>Refresh Preview</a>
          </div>
        </div>
      ) : null}
    </main>
  );
}
