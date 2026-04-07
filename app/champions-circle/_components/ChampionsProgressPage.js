'use client';

import { useEffect, useMemo, useState } from 'react';

const INNER_SESSION_KEY = 'inner_circle_hub_member_v1';
const LICENSED_TOKEN_KEY = 'licensed_backoffice_token';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function firstLastSig(v = '') { const p = normalize(v).split(' ').filter(Boolean); if (!p.length) return ''; if (p.length===1) return p[0]; return `${p[0]} ${p[p.length-1]}`; }
function samePerson(a = '', b = '') { return normalize(a) === normalize(b) || firstLastSig(a) === firstLastSig(b); }
function isoMonth(iso = '') { const d = new Date(iso || 0); if (Number.isNaN(d.getTime())) return ''; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }

function money(n = 0) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n || 0));
}

function num(n = 0) {
  return new Intl.NumberFormat('en-US').format(Number(n || 0));
}

function ProgressBar({ label = '', pct = 0, right = '' }) {
  const safe = Math.max(0, Math.min(100, Number(pct || 0)));
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <small className="muted">{label}</small>
        <small className="muted">{right}</small>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: '#1f2937', overflow: 'hidden', border: '1px solid #334155' }}>
        <div style={{ width: `${safe}%`, height: '100%', background: 'linear-gradient(90deg,#3b82f6,#22d3ee)' }} />
      </div>
    </div>
  );
}

function Ring({ label = '', value = 0, suffix = '%', color = '#22d3ee' }) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - ((safe / 100) * c);
  return (
    <div style={{ border: '1px solid #334155', borderRadius: 14, padding: 12, background: '#0b1220', display: 'grid', justifyItems: 'center', gap: 8 }}>
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} stroke="#1f2937" strokeWidth="10" fill="none" />
        <circle cx="48" cy="48" r={r} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 48 48)" />
        <text x="48" y="53" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="700">{Math.round(safe)}{suffix}</text>
      </svg>
      <small className="muted" style={{ textAlign: 'center' }}>{label}</small>
    </div>
  );
}

export default function ChampionsProgressPage({ group = 'licensed', title = 'Progress' }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [month, setMonth] = useState('');
  const [quarter, setQuarter] = useState('');
  const [identity, setIdentity] = useState({ name: '', email: '', source: '' });
  const [homeHref, setHomeHref] = useState(group === 'inner' ? '/inner-circle-hub' : '/licensed-backoffice');
  const [breakdown, setBreakdown] = useState({ production: 0, sponsorship: 0, community: 0, submission: 0, total: 0 });
  const [policyRows, setPolicyRows] = useState([]);
  const [receiptCopied, setReceiptCopied] = useState(false);
  const [monthLock, setMonthLock] = useState({ locked: false });

  useEffect(() => {
    let mounted = true;

    async function resolveIdentity() {
      let licensedProfile = null;
      let innerMember = null;

      if (typeof window !== 'undefined') {
        try {
          const token = clean(window.localStorage.getItem(LICENSED_TOKEN_KEY) || '');
          if (token) {
            const meRes = await fetch('/api/licensed-backoffice/auth/me', {
              headers: { Authorization: `Bearer ${token}` },
              cache: 'no-store'
            });
            const meJson = meRes.ok ? await meRes.json().catch(() => ({})) : {};
            if (meJson?.ok && meJson?.profile) licensedProfile = meJson.profile;
          }
        } catch {
          // ignore
        }

        try {
          const localInner = JSON.parse(window.localStorage.getItem(INNER_SESSION_KEY) || 'null');
          if (localInner && localInner?.active) innerMember = localInner;
        } catch {
          // ignore
        }
      }

      const persona = licensedProfile?.name ? 'licensed' : ((innerMember?.applicantName || innerMember?.name) ? 'inner' : 'none');
      if (persona === 'none') {
        return { ok: false, error: 'Please sign in to your back office first.' };
      }

      if (persona !== group) {
        return {
          ok: false,
          error: persona === 'licensed'
            ? 'Licensed accounts can only view the Licensed Incentive page.'
            : 'Inner Circle accounts can only view the Inner Circle Incentive page.'
        };
      }

      if (persona === 'licensed') {
        return {
          ok: true,
          name: clean(licensedProfile?.name || ''),
          email: clean(licensedProfile?.email || '').toLowerCase(),
          source: 'licensed'
        };
      }

      return {
        ok: true,
        name: clean(innerMember?.applicantName || innerMember?.name || ''),
        email: clean(innerMember?.email || '').toLowerCase(),
        source: 'inner'
      };
    }

    async function load() {
      setLoading(true);
      setError('');

      if (typeof window !== 'undefined') {
        try {
          const qp = new URLSearchParams(window.location.search || '');
          const rawHome = clean(qp.get('home') || '');
          if (rawHome && rawHome.startsWith('/')) setHomeHref(rawHome);
        } catch {
          // ignore
        }
      }

      const id = await resolveIdentity();
      if (!mounted) return;
      if (!id?.ok) {
        setError(id?.error || 'Access required.');
        setRows([]);
        setBreakdown({ production: 0, sponsorship: 0, community: 0, submission: 0, total: 0 });
        setMonthLock({ locked: false });
        setLoading(false);
        return;
      }

      setIdentity({ name: id.name, email: id.email, source: id.source });

      try {
        const url = `/api/champions-circle?group=${encodeURIComponent(group)}&self=true&name=${encodeURIComponent(id.name)}&email=${encodeURIComponent(id.email)}`;
        const [res, policyRes] = await Promise.all([
          fetch(url, { cache: 'no-store' }),
          fetch('/api/policy-submissions', { cache: 'no-store' })
        ]);
        const data = await res.json().catch(() => ({}));
        const policyData = policyRes.ok ? await policyRes.json().catch(() => ({})) : {};
        if (!mounted) return;

        if (!res.ok || !data?.ok) {
          setError(data?.error || 'Could not load progress.');
          setRows([]);
          setPolicyRows([]);
          setMonthLock({ locked: false });
          return;
        }

        const safeRows = Array.isArray(data.rows) ? data.rows : [];
        setRows(safeRows);
        setPolicyRows(Array.isArray(policyData?.rows) ? policyData.rows : []);
        setMonth(String(data.month || ''));
        setQuarter(String(data.quarter || ''));
        setMonthLock(data?.monthLock || { locked: false });

        const me = safeRows[0] || {};
        setBreakdown({
          production: Number(me?.productionBonusTier?.payout || 0),
          sponsorship: Number(me?.sponsorshipBonusTier?.payout || 0),
          community: Number(me?.communityBonusTier?.payout || 0),
          submission: Number(me?.submissionRewardPayout || 0),
          total: Number(me?.monthlyCashPayout || 0)
        });
      } catch {
        if (mounted) setError('Could not load progress.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 60000);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, [group]);

  const totals = useMemo(() => rows.reduce((acc, r) => {
    acc.credits += Number(r?.totalCreditsMonth || 0);
    acc.payout += Number(r?.monthlyCashPayout || 0);
    return acc;
  }, { credits: 0, payout: 0 }), [rows]);

  const me = useMemo(() => rows[0] || {}, [rows]);

  const composition = useMemo(() => {
    const parts = [
      { label: 'Production', value: Number(breakdown.production || 0), color: '#60a5fa' },
      { label: 'Sponsorship', value: Number(breakdown.sponsorship || 0), color: '#22d3ee' },
      { label: 'Submission', value: Number(breakdown.submission || 0), color: '#34d399' },
      { label: 'Community', value: Number(breakdown.community || 0), color: '#f59e0b' }
    ];
    const total = Math.max(1, parts.reduce((s, p) => s + p.value, 0));
    return { parts, total };
  }, [breakdown]);

  const nextUnlock = useMemo(() => {
    if (!me?.agent) return 'No active milestones yet.';
    if (!me?.productionBonusTier?.unlocked) {
      const need = Math.max(0, 8 - Number(me?.monthSponsorshipPolicies || 0));
      return `${need} more approved/issued sponsorship policies to unlock 3% production bonus.`;
    }
    if (me?.sponsorshipProgress?.next?.threshold) {
      const need = Math.max(0, Number(me.sponsorshipProgress.next.threshold) - Number(me?.monthSponsorshipPolicies || 0));
      return `${need} more approved/issued sponsorship policies to hit next sponsorship tier.`;
    }
    if (me?.communityProgress?.next?.threshold) {
      const need = Math.max(0, Number(me.communityProgress.next.threshold) - Number(me?.monthServiceHours || 0));
      return `${need.toFixed(1)} more community hours for next community reward tier.`;
    }
    return 'You are currently at top unlocked monthly milestones. Keep scaling AP.';
  }, [me]);

  const badges = useMemo(() => {
    if (!me?.agent) return [];
    return [
      { label: 'Submission Starter', on: Number(me?.monthPolicySubmissions || 0) >= 5 },
      { label: 'Submission Momentum', on: Number(me?.monthPolicySubmissions || 0) >= 15 },
      { label: 'Production 3% Unlocked', on: Boolean(me?.productionBonusTier?.unlocked) },
      { label: 'Sponsorship Tier 1', on: Number(me?.monthSponsorshipPolicies || 0) >= 5 },
      { label: 'Sponsorship Tier 2', on: Number(me?.monthSponsorshipPolicies || 0) >= 10 },
      { label: 'Sponsorship Tier 3', on: Number(me?.monthSponsorshipPolicies || 0) >= 15 }
    ];
  }, [me]);


  const countedPolicies = useMemo(() => {
    if (!identity?.name || !month) return { approvedIssued: [], submissions: [] };

    const isSponsorshipLike = (row = {}) => {
      const t = normalize(row?.policyType || row?.appType || '');
      if (t.includes('sponsorship')) return true;
      return !t && clean(row?.referredByName || '');
    };

    const approvedIssued = (policyRows || [])
      .filter((row) => {
        if (!isSponsorshipLike(row)) return false;
        const status = normalize(row?.status || '');
        const payout = normalize(row?.payoutStatus || '');
        if (payout.includes('reversed')) return false;
        if (!samePerson(row?.referredByName || '', identity.name)) return false;
        if (!(status.includes('approved') || status.includes('issued') || status.includes('placed'))) return false;
        const ts = row?.approvedAt || row?.updatedAt || row?.submittedAt || row?.createdAt || '';
        return isoMonth(ts) === month;
      })
      .sort((a, b) => new Date(b?.approvedAt || b?.updatedAt || b?.submittedAt || 0).getTime() - new Date(a?.approvedAt || a?.updatedAt || a?.submittedAt || 0).getTime());

    const submissions = (policyRows || [])
      .filter((row) => {
        if (!samePerson(row?.policyWriterName || '', identity.name)) return false;
        const ts = row?.submittedAt || row?.createdAt || row?.updatedAt || '';
        return isoMonth(ts) === month;
      })
      .sort((a, b) => new Date(b?.submittedAt || b?.createdAt || b?.updatedAt || 0).getTime() - new Date(a?.submittedAt || a?.createdAt || a?.updatedAt || 0).getTime());

    return { approvedIssued, submissions };
  }, [identity, month, policyRows]);

  const payoutReady = useMemo(() => {
    const categories = [];
    if (Number(breakdown.production || 0) > 0) categories.push('Production 3%');
    if (Number(breakdown.sponsorship || 0) > 0) categories.push('Sponsorship Tier');
    if (Number(breakdown.submission || 0) > 0) categories.push('Submission Reward');
    if (Number(breakdown.community || 0) > 0) categories.push('Community');
    return {
      ready: Number(breakdown.total || 0) > 0 && categories.length > 0,
      categories
    };
  }, [breakdown]);

  const receiptText = useMemo(() => {
    const lines = [
      'Legacy Link Champions Circle — Bonus Receipt',
      `Agent: ${identity?.name || '—'}`,
      `Track: ${group === 'inner' ? 'Inner Circle' : 'Licensed'}`,
      `Month: ${month || '—'}  Quarter: ${quarter || '—'}`,
      `Production Bonus (3% unlocked): ${money(breakdown.production)}`,
      `Sponsorship Policy Bonus: ${money(breakdown.sponsorship)}`,
      `Policy Submission Reward: ${money(breakdown.submission)}`,
      `Community Bonus: ${money(breakdown.community)}`,
      `TOTAL PROJECTED PAYOUT: ${money(breakdown.total)}`,
      '',
      `Counted Sponsorship Policies (Approved/Issued): ${countedPolicies.approvedIssued.length}`,
      ...countedPolicies.approvedIssued.map((r) => ` - ${r.applicantName || '—'} | ${r.status || '—'} | ${r.approvedAt || '—'} | ${r.id || '—'}`),
      '',
      `Counted Policy Submissions ($50 each): ${countedPolicies.submissions.length}`,
      ...countedPolicies.submissions.map((r) => ` - ${r.applicantName || '—'} | ${r.status || '—'} | ${r.submittedAt || '—'} | ${r.id || '—'}`)
    ];
    return lines.join('\\n');
  }, [identity, group, month, quarter, breakdown, countedPolicies]);

  async function copyReceipt() {
    try {
      await navigator.clipboard.writeText(receiptText);
      setReceiptCopied(true);
      setTimeout(() => setReceiptCopied(false), 1600);
    } catch {
      // ignore clipboard failures
    }
  }

  return (
    <main style={{ minHeight: '100vh', padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      <style>{`@keyframes pulseGlow{0%{box-shadow:0 0 0 rgba(34,211,238,.0)}50%{box-shadow:0 0 18px rgba(34,211,238,.35)}100%{box-shadow:0 0 0 rgba(34,211,238,.0)}}`}</style>

      <div className="panel" style={{ borderColor: '#1d4ed8', background: 'linear-gradient(135deg,#07132b,#0c1f3f)' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href={homeHref} className="ghost" style={{ textDecoration: 'none' }}>Home</a>
          {group === 'licensed' ? (
            <a href="/champions-circle/licensed" className="publicPrimaryBtn" style={{ textDecoration: 'none' }}>Licensed</a>
          ) : (
            <a href="/champions-circle/inner-circle" className="publicPrimaryBtn" style={{ textDecoration: 'none' }}>Inner Circle</a>
          )}
          <a href="/champions-circle/incentive-guide" className="ghost" style={{ textDecoration: 'none' }}>Incentive Guide</a>
        </div>
        <h3 style={{ marginBottom: 6 }}>{title}</h3>
        <p className="muted" style={{ margin: 0 }}>
          Signed-in view only • Agent: <strong>{identity.name || '—'}</strong> • Track: <strong>{group === 'inner' ? 'Inner Circle' : 'Licensed'}</strong> • Month: <strong>{month || '—'}</strong> • Quarter: <strong>{quarter || '—'}</strong>
        </p>
        <div style={{ marginTop: 10, display: 'inline-flex', gap: 8, alignItems: 'center', border: payoutReady.ready ? '1px solid #22c55e' : '1px solid #475569', borderRadius: 999, padding: '6px 10px', background: payoutReady.ready ? 'rgba(34,197,94,.15)' : '#0b1220' }}>
          <strong style={{ color: payoutReady.ready ? '#86efac' : '#cbd5e1' }}>{payoutReady.ready ? 'Ready to Pay' : 'Not Ready Yet'}</strong>
          <small className="muted">{payoutReady.categories.length ? payoutReady.categories.join(' • ') : 'No payout categories hit yet'}</small>
        </div>
        <div style={{ marginTop: 8, display: 'inline-flex', gap: 8, alignItems: 'center', border: monthLock?.locked ? '1px solid #eab308' : '1px solid #334155', borderRadius: 999, padding: '6px 10px', background: monthLock?.locked ? 'rgba(234,179,8,.14)' : '#0b1220' }}>
          <strong style={{ color: monthLock?.locked ? '#fde047' : '#cbd5e1' }}>{monthLock?.locked ? 'Month Finalized' : 'Month Open'}</strong>
          <small className="muted">{monthLock?.locked ? `${monthLock?.finalizedBy || 'Admin'} • ${monthLock?.finalizedAt ? new Date(monthLock.finalizedAt).toLocaleString() : ''}` : 'Numbers can still move until month is finalized.'}</small>
        </div>
      </div>

      <div className="grid4" style={{ marginTop: 12 }}>
        <div className="card"><p>Records</p><h2>{rows.length}</h2></div>
        <div className="card"><p>Month Credits</p><h2>{num(Math.round(totals.credits))}</h2></div>
        <div className="card">
          <p>Monthly Bonus (Projected)</p>
          <h2>{money(breakdown.total)}</h2>
          <small className="muted">Production (3% unlocked): {money(breakdown.production)} • Sponsorship policy bonus: {money(breakdown.sponsorship)} • Policy submissions: {money(breakdown.submission)} • Community: {money(breakdown.community)}</small>
        </div>
        <div className="card">
          <p>Quarterly Bonus (Current)</p>
          <h2>{me?.quarterTierHit?.label ? `${me.quarterTierHit.label} • ${money(me?.quarterTierHit?.payout || 0)}` : 'In Progress'}</h2>
          <small className="muted">Quarter tiers: Bronze $1,500 • Silver $3,500 • Gold $7,500</small>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        <Ring label="Production Unlock" value={Number(me?.productionProgress?.pct || 0)} color="#60a5fa" />
        <Ring label="Sponsorship Tier Progress" value={Number(me?.sponsorshipProgress?.pct || 0)} color="#22d3ee" />
        <Ring label="Community Tier Progress" value={Number(me?.communityProgress?.pct || 0)} color="#f59e0b" />
        <div style={{ border: '1px solid #334155', borderRadius: 14, padding: 12, background: '#0b1220' }}>
          <small className="muted">Next Unlock</small>
          <p style={{ margin: '8px 0 0', color: '#e2e8f0', fontWeight: 600 }}>{nextUnlock}</p>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Bonus Composition Graph</h4>
        <div style={{ height: 14, borderRadius: 999, overflow: 'hidden', border: '1px solid #334155', display: 'flex' }}>
          {composition.parts.map((p) => (
            <div key={p.label} title={`${p.label}: ${money(p.value)}`} style={{ width: `${(p.value / composition.total) * 100}%`, background: p.color }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          {composition.parts.map((p) => (
            <small key={p.label} className="muted">{p.label}: <strong style={{ color: p.color }}>{money(p.value)}</strong></small>
          ))}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Milestone Badges</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {badges.map((b) => (
            <span
              key={b.label}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: b.on ? '1px solid #22d3ee' : '1px solid #334155',
                background: b.on ? 'rgba(34,211,238,.12)' : '#0b1220',
                color: b.on ? '#67e8f9' : '#94a3b8',
                animation: b.on ? 'pulseGlow 1.6s ease-in-out infinite' : 'none'
              }}
            >
              {b.on ? '🏆' : '•'} {b.label}
            </span>
          ))}
        </div>
      </div>


      <div className="panel" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Bonus Receipt</h4>
        <p className="muted" style={{ marginTop: 0 }}>Generate a clean payout summary for this signed-in agent.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={copyReceipt}>Copy Bonus Receipt</button>
          <button type="button" className="ghost" onClick={() => window.print()}>Print / Save PDF</button>
          {receiptCopied ? <small className="muted">Copied.</small> : null}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Counted Policy Records (This Month)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>
          <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 10, background: '#0b1220' }}>
            <strong>Sponsorship Policies Counted (Approved/Issued): {countedPolicies.approvedIssued.length}</strong>
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              {countedPolicies.approvedIssued.slice(0, 12).map((r) => (
                <small key={`ai-${r.id}`} className="muted">
                  {r.applicantName || '—'} • {r.status || '—'} • {r.approvedAt ? new Date(r.approvedAt).toLocaleDateString() : '—'} • ID: {r.id || '—'}
                </small>
              ))}
              {!countedPolicies.approvedIssued.length ? <small className="muted">No approved/issued sponsorship policies counted yet this month.</small> : null}
            </div>
          </div>

          <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 10, background: '#0b1220' }}>
            <strong>Policy Submissions Counted ($50 each): {countedPolicies.submissions.length}</strong>
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              {countedPolicies.submissions.slice(0, 12).map((r) => (
                <small key={`sub-${r.id}`} className="muted">
                  {r.applicantName || '—'} • {r.status || '—'} • {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '—'} • ID: {r.id || '—'}
                </small>
              ))}
              {!countedPolicies.submissions.length ? <small className="muted">No submissions counted yet this month.</small> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ overflowX: 'auto', marginTop: 12 }}>
        {loading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="muted">{error}</p> : null}

        {!loading && !error ? (
          <table className="table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Progress</th>
                <th>Monthly Snapshot</th>
                <th>Quarter</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${group}-${r.agent}`}>
                  <td>
                    <strong>{r.agent}</strong>
                    <div className="muted">Credits: {num(Math.round(r.totalCreditsMonth || 0))}</div>
                  </td>
                  <td style={{ minWidth: 320 }}>
                    <ProgressBar
                      label="Production Unlock"
                      pct={r.productionProgress?.pct || 0}
                      right={r.productionProgress?.next ? `${num(r.monthSponsorshipPolicies)} / ${num(r.productionProgress.next.threshold)} approved/issued` : `Unlocked • 3% of ${money(r.monthProductionAp)}`}
                    />
                    <div style={{ height: 8 }} />
                    <ProgressBar
                      label="Sponsorship Policies (Approved/Issued)"
                      pct={r.sponsorshipProgress?.pct || 0}
                      right={r.sponsorshipProgress?.next ? `${num(r.monthSponsorshipPolicies)} / ${num(r.sponsorshipProgress.next.threshold)}` : 'Top tier hit'}
                    />
                    <div style={{ height: 8 }} />
                    <ProgressBar
                      label="Community"
                      pct={r.communityProgress?.pct || 0}
                      right={r.communityProgress?.next ? `${r.monthServiceHours?.toFixed?.(1) || 0}h / ${r.communityProgress.next.threshold}h` : 'Top tier hit'}
                    />
                  </td>
                  <td>
                    <div className="muted">Production (3%): {r.productionBonusTier ? money(r.productionBonusTier.payout) : '$0'}</div>
                    <div className="muted">Sponsorship approved/issued policies ({num(r.monthSponsorshipPolicies)}): {r.sponsorshipBonusTier ? money(r.sponsorshipBonusTier.payout) : '$0'}</div>
                    <div className="muted">Policy submissions ({num(r.monthPolicySubmissions)}): {money(r.submissionRewardPayout || 0)}</div>
                    <div className="muted">Community: {r.communityBonusTier ? money(r.communityBonusTier.payout) : '$0'}</div>
                    <strong>Total: {money(r.monthlyCashPayout || 0)}</strong>
                  </td>
                  <td>
                    {r.quarterTierHit ? (
                      <>
                        <strong>{r.quarterTierHit.label}</strong>
                        <div className="muted">{money(r.quarterTierHit.payout)}</div>
                      </>
                    ) : <span className="muted">In progress</span>}
                  </td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={4} className="muted">No qualifying activity yet for this signed-in account.</td></tr> : null}
            </tbody>
          </table>
        ) : null}
      </div>
    </main>
  );
}
