'use client';

import { useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'legacy_lead_marketplace_user_v1';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

function fmtDate(iso = '') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function LeadMarketplacePage() {
  const [auth, setAuth] = useState({ name: '', email: '', role: '' });
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [settings, setSettings] = useState({ sponsorshipTier1Price: 50, sponsorshipTier2Price: 89 });
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [notice, setNotice] = useState('');
  const [buyingLeadKey, setBuyingLeadKey] = useState('');

  const allowedRoles = useMemo(() => new Set(['agent', 'manager', 'admin']), []);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      if (saved?.name) setAuth({ name: saved.name, email: saved.email || '', role: saved.role || '' });
    } catch {
      // ignore
    }
  }, []);

  async function load() {
    if (!auth.name) return;

    const params = new URLSearchParams({
      viewerName: auth.name,
      viewerEmail: auth.email || '',
      viewerRole: auth.role || ''
    });

    const res = await fetch(`/api/lead-marketplace?${params.toString()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.ok) {
      setRows(Array.isArray(data.agentRows) ? data.agentRows : []);
      setSettings({
        sponsorshipTier1Price: Number(data?.settings?.sponsorshipTier1Price || 50),
        sponsorshipTier2Price: Number(data?.settings?.sponsorshipTier2Price || 89)
      });
    }
  }

  useEffect(() => {
    if (!auth.name) {
      setLoading(false);
      return;
    }

    let active = true;

    async function refresh() {
      if (!active) return;
      setLoading(true);
      await load();
      if (active) setLoading(false);
    }

    refresh();
    const timer = setInterval(refresh, 20000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [auth.name, auth.email, auth.role]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (checkout === 'success') {
      setNotice('Payment successful. Unlocking your lead now...');
      load();
    } else if (checkout === 'cancel') {
      setNotice('Checkout canceled. No charge made.');
    }
  }, []);

  async function login() {
    setLoginError('');

    const name = clean(loginName);
    if (!name || !password) {
      setLoginError('Enter your name and password.');
      return;
    }

    const res = await fetch('/api/lead-claims-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setLoginError('Invalid login.');
      return;
    }

    const role = normalize(data?.user?.role);
    if (!allowedRoles.has(role)) {
      setLoginError('This page is for Legacy Link agents only.');
      return;
    }

    const next = { name: data.user.name, email: data.user.email || '', role: data.user.role };
    setAuth(next);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setPassword('');
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAuth({ name: '', email: '', role: '' });
    setRows([]);
    setLoginName('');
    setPassword('');
    setNotice('');
  }

  async function purchaseLead(row) {
    if (!row?.key || !auth.name) return;

    setNotice('');
    setBuyingLeadKey(row.key);
    try {
      const res = await fetch('/api/lead-marketplace/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadKey: row.key,
          buyerName: auth.name,
          buyerEmail: auth.email || '',
          buyerRole: auth.role || 'agent',
          origin: window.location.origin
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.url) {
        setNotice(data?.error === 'lead_already_sold' ? 'That lead was already sold.' : 'Unable to start checkout right now.');
        await load();
        return;
      }

      window.location.href = data.url;
    } finally {
      setBuyingLeadKey('');
    }
  }

  const filteredRows = useMemo(() => {
    const byTier = tierFilter === 'tier1'
      ? rows.filter((r) => r.tier === 'tier1')
      : tierFilter === 'tier2'
        ? rows.filter((r) => r.tier === 'tier2')
        : rows;

    const q = normalize(query);
    if (!q) return byTier;
    return byTier.filter((r) => normalize(`${r.state} ${r.engagement} ${r.tier}`).includes(q));
  }, [rows, query, tierFilter]);

  const counts = useMemo(() => ({
    total: rows.length,
    tier1: rows.filter((r) => r.tier === 'tier1').length,
    tier2: rows.filter((r) => r.tier === 'tier2').length
  }), [rows]);

  if (!auth.name) {
    return (
      <main className="claimsPortal claimsPortalMarketplace">
        <section className="claimsAuthCard">
          <h2 className="claimsWordmark">The Legacy Link</h2>
          <p className="claimsQuote">Agent Lead Marketplace</p>
          <input placeholder="Full name" value={loginName} onChange={(e) => setLoginName(e.target.value)} />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
          />
          <button type="button" className="publicPrimaryBtn" onClick={login}>Enter Marketplace</button>
          {loginError ? <small className="errorCheck">{loginError}</small> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="claimsPortal claimsPortalMarketplace">
      <section className="claimsHeader marketplaceHeader">
        <div>
          <h1>Sponsorship Lead Inventory</h1>
          <p>Approved but not booked leads. Contact details unlock after payment. {auth.name} • {auth.role}</p>
        </div>
        <button type="button" className="ghost" onClick={logout}>Logout</button>
      </section>

      {notice ? (
        <section className="claimsRoster" style={{ marginTop: 8 }}>
          <div className="pill" style={{ background: '#dbeafe', color: '#1e3a8a' }}>{notice}</div>
        </section>
      ) : null}

      <section className="claimsRoster" style={{ marginTop: 8 }}>
        <div className="claimsQuickTools" style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill" style={{ background: '#1d4ed8', color: '#fff' }}>Tier 1 • ${settings.sponsorshipTier1Price}</span>
            <span className="pill" style={{ background: '#166534', color: '#fff' }}>Tier 2 • ${settings.sponsorshipTier2Price}</span>
            <span className="pill">Inventory: {counts.total}</span>
            <span className="pill">Tier 1: {counts.tier1}</span>
            <span className="pill">Tier 2: {counts.tier2}</span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={tierFilter === 'all' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTierFilter('all')}>
              All ({counts.total})
            </button>
            <button type="button" className={tierFilter === 'tier1' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTierFilter('tier1')}>
              Tier 1 ({counts.tier1})
            </button>
            <button type="button" className={tierFilter === 'tier2' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setTierFilter('tier2')}>
              Tier 2 ({counts.tier2})
            </button>
          </div>

          <input placeholder="Filter by state or engagement..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </section>

      <section className="claimsCards">
        {loading ? <p>Loading...</p> : null}

        {!filteredRows.length && !loading ? (
          <div className="claimsEmptyState">
            <div className="icon">📦</div>
            <h3>No leads in this view</h3>
            <p className="muted">Check back soon for newly approved non-booked sponsorship leads.</p>
          </div>
        ) : null}

        <div className="claimsLeadGrid marketplaceGrid">
          {filteredRows.map((row) => {
            const soldColor = row.soldToViewer ? '#166534' : row.sold ? '#7f1d1d' : '#1d4ed8';
            return (
              <article key={row.key} className="claimCard claimCardV2 marketplaceCard">
                <div className="claimTop">
                  <div>
                    <h3>{row.applicant || 'Private Lead'}</h3>
                    <p className="muted">{row.state || '—'} • {row.engagement}</p>
                  </div>
                  <span className="pill" style={{ background: row.tier === 'tier2' ? '#166534' : '#1d4ed8', color: '#fff' }}>
                    {row.tier === 'tier2' ? `Tier 2 • $${row.price}` : `Tier 1 • $${row.price}`}
                  </span>
                </div>

                <p className="muted" style={{ margin: '6px 0 0' }}>Approved: {fmtDate(row.approvedAt)}</p>

                <div className="claimPrivate" style={{ marginTop: 10 }}>
                  <p><strong>Name:</strong> {row.applicant}</p>
                  <p><strong>Email:</strong> {row.email}</p>
                  <p><strong>Phone:</strong> {row.phone}</p>
                </div>

                <p className="claimPrivateHint">
                  {row.unlocked ? 'Lead unlocked for your account.' : 'Contact details are masked until purchase is completed.'}
                </p>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="pill" style={{ background: soldColor, color: '#fff' }}>{row.soldLabel}</span>
                  {row.soldAt ? <small className="muted">{fmtDate(row.soldAt)}</small> : null}
                </div>

                {row.sold ? (
                  row.soldToViewer ? (
                    <button type="button" className="publicPrimaryBtn publicBtnBlock" disabled>
                      Purchased • Unlocked
                    </button>
                  ) : (
                    <button type="button" className="publicPrimaryBtn publicBtnBlock" disabled>
                      Sold
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="publicPrimaryBtn publicBtnBlock"
                    disabled={buyingLeadKey === row.key}
                    onClick={() => purchaseLead(row)}
                  >
                    {buyingLeadKey === row.key ? 'Redirecting...' : `Purchase • $${row.price}`}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
