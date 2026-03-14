'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'legacy_lead_claim_manager_portal_user_v1';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

function fmtDate(iso = '') {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

const ZONE_OFFSET = { ET: -5, CT: -6, MT: -7, PT: -8, AKT: -9, HT: -10, AT: -4 };

function parseRequested(raw = '') {
  const m = String(raw || '').trim().match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  const [, date, hhRaw, mmRaw, apRaw] = m;
  let hh = Number(hhRaw || 0);
  const ap = String(apRaw || '').toUpperCase();
  if (ap === 'PM' && hh !== 12) hh += 12;
  if (ap === 'AM' && hh === 12) hh = 0;
  return { date, hh, mm: Number(mmRaw || 0) };
}

function bookingUtcMs(row = {}) {
  const parsed = parseRequested(row?.requested_at_est || '');
  if (!parsed) return NaN;

  const zone = String(row?.booking_timezone || 'ET').trim().toUpperCase();
  const offset = Number(ZONE_OFFSET[zone] ?? -5);
  const [y, mo, d] = String(parsed.date || '').split('-').map((n) => Number(n));
  if (!y || !mo || !d) return NaN;

  return Date.UTC(y, mo - 1, d, parsed.hh, parsed.mm, 0, 0) - offset * 60 * 60 * 1000;
}

function isExpiredUnclaimed(row = {}) {
  const isClaimed = Boolean(clean(row?.claimed_by));
  if (isClaimed) return false;
  const whenMs = bookingUtcMs(row);
  if (Number.isNaN(whenMs)) return false;
  return whenMs < Date.now();
}

function sourceLabel(row = {}) {
  if (clean(row.source)) return clean(row.source);
  if (clean(row.source_type) === 'bonus') return 'Bonus Booking';
  if (clean(row.source_type) === 'sponsorship') return 'Sponsorship';
  return 'CSV Import';
}

function maskPhone(v = '') {
  const digits = clean(v).replace(/\D/g, '');
  if (!digits) return '123-***-****';
  return `${digits.slice(0, 3).padEnd(3, '*')}-***-****`;
}

function maskEmail(v = '') {
  const email = clean(v).toLowerCase();
  if (!email.includes('@')) return 'j***@***.com';
  const [left, right] = email.split('@');
  const first = left?.[0] || 'j';
  const domainParts = String(right || '***.com').split('.');
  const tld = domainParts.length > 1 ? domainParts[domainParts.length - 1] : 'com';
  return `${first}***@***.${tld}`;
}

export default function LeadClaimsPortalPage() {
  const [auth, setAuth] = useState({ name: '', role: '' });
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [rows, setRows] = useState([]);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [rescheduleEmailingId, setRescheduleEmailingId] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('available');
  const [overrideById, setOverrideById] = useState({});
  const [weeklyClaimCap, setWeeklyClaimCap] = useState(2);
  const [viewerClaimedThisWeek, setViewerClaimedThisWeek] = useState(0);

  const isAdmin = useMemo(() => normalize(auth.role) === 'admin', [auth.role]);
  const isManager = useMemo(() => ['admin', 'manager'].includes(normalize(auth.role)), [auth.role]);

  const loadRows = useCallback(async (silent = false) => {
    if (!auth.name) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/lead-claims?viewer=${encodeURIComponent(auth.name)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load leads');
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setRoster(Array.isArray(data.roster) ? data.roster : []);
      setWeeklyClaimCap(Number(data?.settings?.weeklyClaimCap || 2));
      setViewerClaimedThisWeek(Number(data?.viewerClaimedThisWeek || 0));
      if (data?.viewer?.name && data?.viewer?.role) {
        setAuth({ name: data.viewer.name, role: data.viewer.role });
      }
    } catch (err) {
      setMessage(err?.message || 'Load failed');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [auth.name]);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      if (saved?.name) setAuth({ name: saved.name, role: saved.role || '' });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!auth.name) return;
    loadRows();
    const timer = setInterval(() => loadRows(true), 15000);
    return () => clearInterval(timer);
  }, [auth.name, loadRows]);

  const saveWeeklyCap = async () => {
    if (!isManager) return;
    const cap = Math.max(1, Number(weeklyClaimCap || 2));
    const res = await fetch('/api/lead-claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_weekly_claim_cap', actorName: auth.name, weeklyClaimCap: cap })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setMessage(data?.error || 'Could not save weekly cap');
      return;
    }
    setWeeklyClaimCap(Number(data?.settings?.weeklyClaimCap || cap));
    setMessage(`Weekly fairness cap saved: ${Number(data?.settings?.weeklyClaimCap || cap)}`);
    await loadRows(true);
  };

  const login = async () => {
    setLoginError('');
    setMessage('');
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

    const next = { name: data.user.name, role: data.user.role };
    setAuth(next);
    setPassword('');
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  };

  const claimLead = async (leadId) => {
    if (!auth.name || !leadId) return;
    setSavingId(leadId);
    setMessage('');

    const prior = rows;
    setRows((prev) => prev.filter((r) => clean(r.id) !== clean(leadId)));

    try {
      const res = await fetch('/api/lead-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim', bookingId: leadId, actorName: auth.name })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setRows(prior);
        const text = data?.error === 'priority_window_locked'
          ? `Claim locked by ${data?.priorityAgent || 'referrer'} until ${fmtDate(data?.priorityExpiresAt)}`
          : data?.error === 'weekly_claim_cap_reached'
            ? `Weekly fairness limit reached: ${data?.claimedThisWeek || 0}/${data?.cap || 2} claimed this week.`
            : data?.error || 'Claim failed';
        setMessage(text);
        return;
      }

      setMessage('Appointment claimed successfully. Open your CRM pipeline to continue follow-up.');
      setTimeout(() => {
        if (typeof window !== 'undefined') window.location.assign('/pipeline');
      }, 2000);
    } finally {
      setSavingId('');
    }
  };

  const assignAppointment = async (leadId) => {
    const targetName = clean(overrideById[leadId]);
    if (!isManager || !leadId || !targetName) return;

    setSavingId(leadId);
    setMessage('');
    try {
      const res = await fetch('/api/lead-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'override', bookingId: leadId, actorName: auth.name, targetName })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMessage(data?.error || 'Assign failed');
        return;
      }
      const emailStatus = data?.assignmentEmail === 'sent'
        ? 'Email sent for confirmation.'
        : `Assigned, but email failed${data?.assignmentEmailError ? `: ${data.assignmentEmailError}` : '.'}`;
      setMessage(`Assigned to ${targetName}. ${emailStatus}`);
      await loadRows(true);
    } finally {
      setSavingId('');
    }
  };


  const confirmAssignment = async (leadId) => {
    if (!leadId) return;
    setSavingId(leadId);
    setMessage('');
    try {
      const res = await fetch('/api/lead-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_assignment', bookingId: leadId, actorName: auth.name })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMessage(data?.error || 'Confirmation failed');
        return;
      }
      setMessage('Assignment confirmed. Removed from pending queue.');
      await loadRows(true);
    } finally {
      setSavingId('');
    }
  };

  const reopenAssignment = async (leadId) => {
    if (!isManager || !leadId) return;
    setSavingId(leadId);
    setMessage('');
    try {
      const res = await fetch('/api/lead-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reopen_assignment', bookingId: leadId, actorName: auth.name })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMessage(data?.error || 'Re-open failed');
        return;
      }
      setMessage('Appointment moved back to available queue.');
      await loadRows(true);
    } finally {
      setSavingId('');
    }
  };

  const deleteAppointment = async (leadId, applicantName = '') => {
    if (!isAdmin || !leadId) return;
    const ok = typeof window === 'undefined'
      ? true
      : window.confirm(`Delete ${applicantName || 'this appointment'} from queue? This cannot be undone.`);
    if (!ok) return;

    setSavingId(leadId);
    setMessage('');
    try {
      const res = await fetch('/api/lead-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', bookingId: leadId, actorName: auth.name })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        const msg = data?.error === 'delete_not_eligible_yet'
          ? 'Delete is only available 24+ hours after the appointment time.'
          : data?.error || 'Delete failed';
        setMessage(msg);
        return;
      }
      setMessage('Appointment removed from queue.');
      await loadRows(true);
    } finally {
      setSavingId('');
    }
  };

  const sendRescheduleEmail = async (leadId) => {
    if (!isManager || !leadId) return;
    setRescheduleEmailingId(leadId);
    setMessage('');

    try {
      const res = await fetch('/api/lead-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_reschedule_email', bookingId: leadId, actorName: auth.name })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        const msg = data?.error === 'not_expired_unclaimed'
          ? 'This lead is not expired + unclaimed yet.'
          : data?.error === 'missing_applicant_email'
            ? 'No applicant email on file for this lead.'
            : data?.error || 'Reschedule email failed';
        setMessage(msg);
        return;
      }

      setMessage('Reschedule email sent.');
      await loadRows(true);
    } finally {
      setRescheduleEmailingId('');
    }
  };

  const filterRowsByQuery = useCallback((list = []) => {
    const q = normalize(query);
    if (!q) return list;
    return list.filter((r) => {
      const blob = [
        r.applicant_name,
        r.applicant_state,
        r.referred_by,
        r.claimed_by,
        r.assignment_status,
        sourceLabel(r)
      ].map((x) => normalize(x)).join(' ');
      return blob.includes(q);
    });
  }, [query]);

  const pendingConfirmRows = useMemo(
    () => rows.filter((r) => clean(r.assignment_status) === 'pending_confirmation'),
    [rows]
  );

  const availableRows = useMemo(
    () => rows.filter((r) => !clean(r.claimed_by) || clean(r.assignment_status) === 'pending_confirmation'),
    [rows]
  );

  const availableToClaimRows = useMemo(
    () => filterRowsByQuery(availableRows.filter((r) => clean(r.assignment_status) !== 'pending_confirmation')),
    [availableRows, filterRowsByQuery]
  );

  const myClaims = useMemo(
    () => filterRowsByQuery(rows.filter((r) => normalize(r.claimed_by) === normalize(auth.name))),
    [rows, auth.name, filterRowsByQuery]
  );

  const pendingConfirmFilteredRows = useMemo(
    () => filterRowsByQuery(pendingConfirmRows),
    [pendingConfirmRows, filterRowsByQuery]
  );

  const teamClaimedRows = useMemo(
    () => filterRowsByQuery(rows.filter((r) => clean(r.claimed_by))),
    [rows, filterRowsByQuery]
  );

  const expiredUnclaimedRows = useMemo(
    () => filterRowsByQuery(rows.filter((r) => isExpiredUnclaimed(r))),
    [rows, filterRowsByQuery]
  );

  const displayedRows = view === 'claimed'
    ? myClaims
    : view === 'pending'
      ? pendingConfirmFilteredRows
      : view === 'team'
        ? teamClaimedRows
        : view === 'expired'
          ? expiredUnclaimedRows
          : availableToClaimRows;

  if (!auth.name) {
    return (
      <main className="claimsPortal claimsPortalMarketplace">
        <section className="claimsAuthCard">
          <h2 className="claimsWordmark">The Legacy Link</h2>
          <p className="claimsQuote">Booked Appointment Queue • Manager View</p>
          <input placeholder="Full name" value={loginName} onChange={(e) => setLoginName(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} />
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
          <h1>Booked Appointment Queue — Manager</h1>
          <p>These are booked appointments waiting for an agent to complete the sponsorship application through F&G. {auth.name} • {auth.role}</p>
        </div>
        <button type="button" className="ghost" onClick={() => loadRows()}>Refresh</button>
      </section>

      {isManager ? (
        <section className="claimsMessage" style={{ background: '#fff8e1', borderColor: '#fde68a', color: '#854d0e' }}>
          Debug: total={rows.length} • available={availableRows.length}
        </section>
      ) : null}

      {message ? <section className="claimsMessage">{message}</section> : null}

      

      <section className="claimsRoster">
        <div className="claimsQuickTools" style={{ display: 'grid', gap: 8 }}>
          <div className="claimsMiniClaimed" style={{ borderColor: '#d1fae5', background: '#ecfdf5' }}>
            <strong>Fairness:</strong> Weekly claim cap is {weeklyClaimCap}. You claimed {viewerClaimedThisWeek}/{weeklyClaimCap} this week.
          </div>
          {isManager ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label>
                Weekly cap
                <input
                  type="number"
                  min={1}
                  value={weeklyClaimCap}
                  onChange={(e) => setWeeklyClaimCap(Number(e.target.value || 1))}
                  style={{ marginLeft: 6, width: 70 }}
                />
              </label>
              <button type="button" className="ghost" onClick={saveWeeklyCap}>Save Fairness Cap</button>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={view === 'available' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setView('available')}>
              Available to Claim ({availableToClaimRows.length})
            </button>
            <button type="button" className={view === 'pending' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setView('pending')}>
              Awaiting Confirmation ({pendingConfirmRows.length})
            </button>
            <button type="button" className={view === 'claimed' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setView('claimed')}>
              My Claimed Leads ({myClaims.length})
            </button>
            {isManager ? (
              <button type="button" className={view === 'team' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setView('team')}>
                Team Claimed ({teamClaimedRows.length})
              </button>
            ) : null}
            {isManager ? (
              <button type="button" className={view === 'expired' ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setView('expired')}>
                Expired • Never Claimed ({expiredUnclaimedRows.length})
              </button>
            ) : null}
          </div>
          {myClaims.length ? (
            <div className="claimsMiniClaimed">
              <strong>Claimed by you today:</strong> {myClaims.slice(0, 3).map((r) => clean(r.applicant_name)).filter(Boolean).join(' • ')}
            </div>
          ) : null}
          {pendingConfirmRows.length ? (
            <div className="claimsMiniClaimed" style={{ borderColor: '#fcd34d', background: '#fffbeb' }}>
              <strong>Awaiting confirmation:</strong> {pendingConfirmRows.length} appointment{pendingConfirmRows.length > 1 ? 's' : ''}.
            </div>
          ) : null}
          <input placeholder="Search leads..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </section>

      <section className="claimsCards">
        {loading ? <p>Loading...</p> : null}

        {!displayedRows.length && !loading ? (
          <div className="claimsEmptyState">
            <div className="icon">🛍️</div>
            <h3>
              {view === 'claimed'
                ? 'No claimed leads yet'
                : view === 'pending'
                  ? 'No pending confirmations'
                  : view === 'team'
                    ? 'No team-claimed leads yet'
                    : view === 'expired'
                      ? 'No expired unclaimed leads'
                      : 'No available leads'}
            </h3>
            <p className="muted">
              {view === 'claimed'
                ? 'Once you claim leads, they will show here.'
                : view === 'pending'
                  ? 'Assignments waiting for agent confirmation will appear here.'
                  : view === 'team'
                    ? 'When agents claim booked appointments, they will show here.'
                    : view === 'expired'
                      ? 'If a lead was never claimed and the appointment time passed, it will appear here for reschedule.'
                      : (isManager ? 'Add new leads in admin tools to populate the queue.' : 'Check back soon for fresh booked appointments.')}
            </p>
          </div>
        ) : null}

        <div className="claimsLeadGrid marketplaceGrid">
          {displayedRows.map((row) => {
            const inPriority = Boolean(row.is_priority_window_open && !row.claimed_by);
            const canClaim = Boolean(row.can_claim);
            const isClaimedView = view === 'claimed' || view === 'team';
            const isPendingConfirmation = clean(row.assignment_status) === 'pending_confirmation';
            const isClaimOwner = normalize(row.claimed_by) === normalize(auth.name);
            const isExpiredQueue = view === 'expired';
            const expired = isExpiredUnclaimed(row);
            const maskedPhone = isClaimedView ? clean(row.applicant_phone || '—') : maskPhone(row.applicant_phone);
            const maskedEmail = isClaimedView ? clean(row.applicant_email || '—') : maskEmail(row.applicant_email);
            const isVip = Boolean(row.is_vip);
            const referredBy = clean(row.referred_by || '—');
            const myName = normalize(auth.name);
            const refNorm = normalize(referredBy);
            const isMyReferral = Boolean(
              referredBy && (
                refNorm === myName ||
                (myName && refNorm.includes(myName)) ||
                (myName && myName.includes(refNorm)) ||
                (myName.includes('kimora') && (refNorm === 'link' || refNorm.includes('kimora link') || refNorm.includes('kimora_link')))
              )
            );

            return (
              <article key={row.id} className={`claimCard claimCardV2 marketplaceCard ${isMyReferral ? 'myReferral' : ''}`}>
                <div className="claimTop">
                  <div>
                    <h3>{row.applicant_name || 'Lead'}</h3>
                    <p className="muted">{sourceLabel(row)} — Referred by {referredBy}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {isAdmin && row.delete_eligible ? (
                      <button
                        type="button"
                        className="ghost"
                        disabled={savingId === row.id}
                        onClick={() => deleteAppointment(row.id, row.applicant_name)}
                        style={{ padding: '4px 8px', fontSize: 12, color: '#b91c1c', borderColor: '#fecaca' }}
                        title="Delete appointment"
                      >
                        {savingId === row.id ? 'Deleting...' : 'Delete'}
                      </button>
                    ) : null}
                    {isMyReferral ? <span className="pill myReferralPill">⭐ Your Referral</span> : null}
                    {isVip ? <span className="pill" style={{ background: '#f59e0b', color: '#fff' }}>VIP</span> : null}
                  </div>
                </div>

                <p className="muted" style={{ margin: '6px 0 0' }}>{row.applicant_state || '—'} • {clean(row.requested_at_est) || 'No booking time yet'}</p>
                {inPriority && isMyReferral ? <p className="muted" style={{ margin: '4px 0 0', color: '#92400e' }}>24h priority lock is active for your referral.</p> : null}
                {isPendingConfirmation ? <p className="muted" style={{ margin: '4px 0 0', color: '#92400e' }}>🟨 Waiting for confirmation from {row.claimed_by || 'assigned agent'}.</p> : null}
                {isClaimedView ? <p className="muted" style={{ margin: '4px 0 0' }}>Claimed by: {row.claimed_by || '—'} • {fmtDate(row.claimed_at)}</p> : null}
                {isExpiredQueue && expired ? <p className="muted" style={{ margin: '4px 0 0', color: '#b45309' }}>⚠️ Appointment time passed with no claim. Needs reschedule outreach.</p> : null}
                {isExpiredQueue && row.reschedule_email_sent_at ? (
                  <p className="muted" style={{ margin: '4px 0 0', color: '#166534' }}>
                    ✅ Reschedule email sent by {row.reschedule_email_sent_by || 'Team'} on {fmtDate(row.reschedule_email_sent_at)}
                  </p>
                ) : null}

                <div className="claimPrivate" style={{ marginTop: 10 }}>
                  <p><strong>Phone:</strong> {maskedPhone}</p>
                  <p><strong>Email:</strong> {maskedEmail}</p>
                </div>


                {!isClaimedView ? <p className="claimPrivateHint">Full contact details revealed after claiming.</p> : null}

                {!isClaimedView ? (
                  <>
                    <button
                      type="button"
                      className="publicPrimaryBtn publicBtnBlock"
                      disabled={!canClaim || isPendingConfirmation || savingId === row.id}
                      onClick={() => claimLead(row.id)}
                    >
                      {savingId === row.id
                        ? 'Claiming...'
                        : isPendingConfirmation
                          ? 'Awaiting Confirmation'
                          : canClaim
                            ? (isExpiredQueue && expired ? 'Claim + Reschedule' : 'Claim Appointment')
                            : inPriority
                              ? 'Claim Locked'
                              : 'Unavailable'}
                    </button>

                    {isManager && isExpiredQueue ? (
                      <button
                        type="button"
                        className="ghost publicBtnBlock"
                        disabled={rescheduleEmailingId === row.id}
                        onClick={() => sendRescheduleEmail(row.id)}
                        style={{ marginTop: 8 }}
                      >
                        {rescheduleEmailingId === row.id ? 'Sending Reschedule Email...' : 'Send Reschedule Email'}
                      </button>
                    ) : null}

                    {isManager ? (
                      <div style={{ display: 'grid', gap: 6, marginTop: 8 }} className={isPendingConfirmation ? 'pendingAssignBox' : ''}>
                        <select value={overrideById[row.id] || ''} onChange={(e) => setOverrideById((prev) => ({ ...prev, [row.id]: e.target.value }))}>
                          <option value="">Admin assign to...</option>
                          {roster.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                        </select>
                        <button
                          type="button"
                          className="ghost publicBtnBlock"
                          disabled={!overrideById[row.id] || savingId === row.id}
                          onClick={() => assignAppointment(row.id)}
                        >
                          Assign Appointment (Admin)
                        </button>
                        {isPendingConfirmation ? (
                          <button type="button" className="ghost publicBtnBlock" disabled={savingId === row.id} onClick={() => reopenAssignment(row.id)}>
                            Re-Open Queue (No Confirm)
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <button type="button" className="ghost publicBtnBlock" onClick={() => (typeof window !== 'undefined' ? window.location.assign('/pipeline') : null)}>
                      Open in Pipeline
                    </button>
                    {isPendingConfirmation && (isClaimOwner || isManager) ? (
                      <button type="button" className="publicPrimaryBtn publicBtnBlock" disabled={savingId === row.id} onClick={() => confirmAssignment(row.id)} style={{ marginTop: 8 }}>
                        {isClaimOwner ? 'Confirm I Can Complete This' : 'Admin Confirm Assignment'}
                      </button>
                    ) : null}
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
