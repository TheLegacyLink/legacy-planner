'use client';

import { useEffect, useMemo, useState } from 'react';

const ACCESS_KEY = 'caller_emani_access_v1';
const DATA_KEY = 'caller_emani_pipeline_v2';
const HOURS_KEY = 'caller_emani_hours_v1';
const PASSCODE = 'EmaniCalls!2026';

const STAGES = [
  'New',
  'Called',
  'Connected',
  'Qualified',
  'Form Sent',
  'Form Completed',
  'Policy Started',
  'Approved',
  'Onboarding Started'
];

const CALL_RESULTS = [
  'Missed Call',
  'Voicemail Left',
  'Do Not Disturb',
  'No Answer',
  'Wrong Number',
  'Spoke - Follow-Up',
  'Spoke - Booked'
];

const MOVE_FORWARD_STAGE = 'Onboarding Started';
const KIMORA_SPONSORSHIP_LINK = 'https://innercirclelink.com/sponsorship-signup?ref=kimora_link';

function normalizeName(v = '') {
  return String(v || '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizePhone(v = '') {
  return String(v || '').replace(/\D/g, '');
}

function normalizeLicensedValue(v = '') {
  const s = String(v || '').trim().toLowerCase();
  if (['yes', 'licensed', 'true'].includes(s)) return 'Licensed';
  if (['no', 'unlicensed', 'false'].includes(s)) return 'Unlicensed';
  return 'Unknown';
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function csvEscape(v = '') {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowKey(row = {}) {
  return String(row.id || row.externalId || '').trim();
}

function mergeRows(primary = [], secondary = []) {
  const map = new Map();
  for (const r of secondary || []) {
    const k = rowKey(r);
    if (k) map.set(k, r);
  }
  for (const r of primary || []) {
    const k = rowKey(r);
    if (!k) continue;
    map.set(k, { ...(map.get(k) || {}), ...r });
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
}

export default function CallerEmaniPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [sponsorshipRows, setSponsorshipRows] = useState([]);
  const [policyApprovedNames, setPolicyApprovedNames] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [hoursToday, setHoursToday] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    licensedStatus: 'Unknown',
    source: 'Kimora Day-in-the-Life Lead',
    notes: ''
  });

  useEffect(() => {
    try {
      if (localStorage.getItem(ACCESS_KEY) === 'ok') setUnlocked(true);
      const hoursMap = JSON.parse(localStorage.getItem(HOURS_KEY) || '{}');
      setHoursToday(String(hoursMap[todayKey()] || ''));

      const cachedRows = JSON.parse(localStorage.getItem(DATA_KEY) || '[]');
      if (Array.isArray(cachedRows) && cachedRows.length) {
        setRows(cachedRows);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const hoursMap = JSON.parse(localStorage.getItem(HOURS_KEY) || '{}');
      hoursMap[todayKey()] = hoursToday;
      localStorage.setItem(HOURS_KEY, JSON.stringify(hoursMap));
    } catch {
      // ignore
    }
  }, [hoursToday]);

  useEffect(() => {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(rows || []));
    } catch {
      // ignore
    }
  }, [rows]);

  async function fetchRows() {
    try {
      const res = await fetch('/api/caller-leads?owner=Kimora%20Link', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok && Array.isArray(data.rows)) {
        setRows((prev) => mergeRows(data.rows, prev));
      }
    } catch {
      // ignore transient fetch errors
    }
  }

  async function fetchSponsorshipRows() {
    try {
      const res = await fetch('/api/sponsorship-applications', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok && Array.isArray(data.rows)) {
        setSponsorshipRows(data.rows);
      }
    } catch {
      // ignore transient fetch errors
    }
  }

  async function fetchPolicyApprovedNames() {
    try {
      const res = await fetch('/api/policy-approved-names', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok && Array.isArray(data.names)) {
        setPolicyApprovedNames(data.names);
      }
    } catch {
      // ignore transient fetch errors
    }
  }

  async function syncAll() {
    await Promise.all([fetchRows(), fetchSponsorshipRows(), fetchPolicyApprovedNames()]);
  }

  useEffect(() => {
    if (!unlocked) return;
    syncAll();
    const id = setInterval(syncAll, 60000);
    return () => clearInterval(id);
  }, [unlocked]);

  function unlock() {
    if (passcode.trim() !== PASSCODE) {
      setError('Incorrect passcode.');
      return;
    }
    localStorage.setItem(ACCESS_KEY, 'ok');
    setUnlocked(true);
    setError('');
  }

  function lock() {
    localStorage.removeItem(ACCESS_KEY);
    setUnlocked(false);
  }

  async function addLead(e) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSyncing(true);
    try {
      const res = await fetch('/api/caller-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create-manual',
          owner: 'Kimora Link',
          ...form
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        window.alert(`Add lead failed: ${data?.error || 'unknown_error'}`);
        return;
      }

      if (data?.row) {
        setRows((prev) => mergeRows([data.row], prev));
      }

      setForm({ name: '', email: '', phone: '', licensedStatus: 'Unknown', source: 'Kimora Day-in-the-Life Lead', notes: '' });
      await syncAll();
    } catch (error) {
      window.alert(`Add lead failed: ${error?.message || 'request_failed'}`);
    } finally {
      setSyncing(false);
    }
  }

  async function updateRow(id, patch, actor = 'Emani Manual') {
    const res = await fetch('/api/caller-leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, patch, actor })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'update_failed');
    }
    if (data?.row) {
      setRows((prev) => mergeRows([data.row], prev));
    }
    await syncAll();
  }

  async function setStage(row, stage) {
    const stampPatch = {};
    const now = new Date().toISOString();
    if (stage === 'Called') stampPatch.calledAt = now;
    if (stage === 'Connected') stampPatch.connectedAt = now;
    if (stage === 'Qualified') stampPatch.qualifiedAt = now;
    if (stage === 'Form Sent') stampPatch.formSentAt = now;
    if (stage === 'Form Completed') stampPatch.formCompletedAt = now;
    if (stage === 'Policy Started') stampPatch.policyStartedAt = now;
    if (stage === 'Approved') stampPatch.approvedAt = now;
    if (stage === 'Onboarding Started') {
      stampPatch.onboardingStartedAt = now;
      stampPatch.movedForwardAt = now;
    }

    setSyncing(true);
    try {
      await updateRow(row.id, { stage, ...stampPatch }, 'Emani Stage Update');
    } catch (error) {
      window.alert(`Stage update failed: ${error?.message || 'unknown_error'}`);
    } finally {
      setSyncing(false);
    }
  }

  async function logCallResult(row, callResult) {
    if (!callResult) return;
    setSyncing(true);
    try {
      const now = new Date().toISOString();
      await updateRow(row.id, {
        callResult,
        callAttempts: Number(row.callAttempts || 0) + 1,
        lastCallAttemptAt: now,
        calledAt: row.calledAt || now,
        stage: row.stage === 'New' ? 'Called' : row.stage
      }, 'Emani Call Log');
    } catch (error) {
      window.alert(`Call log update failed: ${error?.message || 'unknown_error'}`);
    } finally {
      setSyncing(false);
    }
  }

  async function removeLead(id) {
    if (!confirm('Delete this lead?')) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/caller-leads?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        window.alert(`Delete failed: ${data?.error || 'unknown_error'}`);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      await syncAll();
    } finally {
      setSyncing(false);
    }
  }

  async function sendSponsorshipInvite(row) {
    const to = String(row.email || '').trim().toLowerCase();
    if (!to) {
      window.alert('No email on file for this lead.');
      return;
    }

    const first = String(row.name || '').trim().split(' ')[0] || 'there';
    const subject = `Your Sponsorship Next Step — The Legacy Link`;
    const text = [
      `Hey ${first},`,
      '',
      'Great speaking with you today. Here is your next step link:',
      KIMORA_SPONSORSHIP_LINK,
      '',
      'Please complete it as soon as possible so we can review quickly.',
      '',
      '— The Legacy Link Team'
    ].join('\n');

    setSyncing(true);
    try {
      const res = await fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        window.alert(`Invite failed: ${data?.error || 'unknown_error'}`);
        return;
      }

      try {
        await updateRow(row.id, { inviteSentAt: new Date().toISOString(), stage: row.stage === 'Qualified' ? 'Form Sent' : row.stage });
      } catch {
        // Non-blocking: email already sent successfully.
      }
      window.alert(`Sponsorship invite sent to ${to}`);
    } catch (error) {
      window.alert(`Invite failed: ${error?.message || 'send_failed'}`);
    } finally {
      setSyncing(false);
    }
  }

  function exportCsv() {
    const headers = [
      'name', 'email', 'phone', 'licensedStatus', 'stage', 'callResult', 'callAttempts', 'lastCallAttemptAt', 'source', 'notes',
      'calledAt', 'connectedAt', 'qualifiedAt', 'formSentAt', 'inviteSentAt', 'formCompletedAt',
      'policyStartedAt', 'approvedAt', 'onboardingStartedAt', 'movedForwardAt',
      'createdAt', 'updatedAt'
    ];
    const body = rows
      .map((r) => headers.map((h) => csvEscape(r[h] || '')).join(','))
      .join('\n');
    const csv = `${headers.join(',')}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emani-caller-pipeline-${todayKey()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const stats = useMemo(() => {
    const now = new Date();
    const todayRows = rows.filter((r) => {
      const d = new Date(r.createdAt || r.updatedAt || Date.now());
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    });

    const called = todayRows.filter((r) => r.calledAt).length;
    const connected = todayRows.filter((r) => r.connectedAt).length;
    const qualified = todayRows.filter((r) => r.qualifiedAt).length;
    const movedForward = todayRows.filter((r) => r.stage === MOVE_FORWARD_STAGE).length;
    return {
      total: rows.length,
      todayLeads: todayRows.length,
      called,
      connected,
      qualified,
      movedForward
    };
  }, [rows]);

  const approvedSet = useMemo(() => {
    const set = new Set();
    for (const s of sponsorshipRows) {
      const status = String(s.status || '').toLowerCase();
      if (!status.includes('approved')) continue;
      const n = normalizeName(`${s.firstName || ''} ${s.lastName || ''}`);
      const e = String(s.email || '').trim().toLowerCase();
      const p = normalizePhone(s.phone || '');
      if (n) set.add(`n:${n}`);
      if (e) set.add(`e:${e}`);
      if (p) set.add(`p:${p}`);
    }
    return set;
  }, [sponsorshipRows]);

  const sponsorshipLicenseLookup = useMemo(() => {
    const map = new Map();
    for (const s of sponsorshipRows) {
      const licensed = normalizeLicensedValue(s.isLicensed);
      if (licensed === 'Unknown') continue;
      const n = normalizeName(`${s.firstName || ''} ${s.lastName || ''}`);
      const e = String(s.email || '').trim().toLowerCase();
      const p = normalizePhone(s.phone || '');
      if (n) map.set(`n:${n}`, licensed);
      if (e) map.set(`e:${e}`, licensed);
      if (p) map.set(`p:${p}`, licensed);
    }
    return map;
  }, [sponsorshipRows]);

  const policyApprovedSet = useMemo(() => new Set((policyApprovedNames || []).map((n) => normalizeName(n))), [policyApprovedNames]);

  const payoutTotal = useMemo(() => {
    return rows.reduce((sum, row) => {
      const nameMatch = policyApprovedSet.has(normalizeName(row.name || ''));
      const payout = nameMatch && row.stage === 'Onboarding Started' ? 300 : 0;
      return sum + payout;
    }, 0);
  }, [rows, policyApprovedSet]);

  useEffect(() => {
    if (!unlocked || !rows.length || !sponsorshipRows.length) return;

    const needed = rows
      .filter((row) => !row.licensedStatus || row.licensedStatus === 'Unknown')
      .map((row) => {
        const keys = [
          `e:${String(row.email || '').trim().toLowerCase()}`,
          `p:${normalizePhone(row.phone || '')}`,
          `n:${normalizeName(row.name || '')}`
        ];
        const next = keys.map((k) => sponsorshipLicenseLookup.get(k)).find((v) => v && v !== 'Unknown');
        return next ? { id: row.id, licensedStatus: next } : null;
      })
      .filter(Boolean);

    if (!needed.length) return;

    let cancelled = false;
    async function run() {
      try {
        for (const patch of needed) {
          if (cancelled) return;
          await fetch('/api/caller-leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: patch.id, patch: { licensedStatus: patch.licensedStatus } })
          });
        }
        if (!cancelled) await syncAll();
      } catch {
        // ignore best-effort autofill failures
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [unlocked, rows, sponsorshipRows, sponsorshipLicenseLookup]);

  if (!unlocked) {
    return (
      <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #fde7cf 0%, #f7e2cf 55%, #f6ede4 100%)', display: 'grid', placeItems: 'center', padding: 16, color: '#3f2a1d' }}>
        <div style={{ width: '100%', maxWidth: 440, background: '#fffaf5', border: '1px solid #e7c9ad', borderRadius: 14, padding: 22, boxShadow: '0 12px 28px rgba(139,69,19,0.12)' }}>
          <h2 style={{ marginTop: 0, color: '#7c3f1d' }}>Emani Calling Portal</h2>
          <p style={{ color: '#7a5a45' }}>Enter your password to access your calling dashboard.</p>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Password"
            style={{ width: '100%', padding: 10, marginBottom: 10 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') unlock();
            }}
          />
          <button type="button" onClick={unlock}>Unlock</button>
          {error ? <p style={{ color: '#fca5a5' }}>{error}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#fff7ef', padding: 16, color: '#3f2a1d' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: 14 }}>
        <div style={{ background: 'linear-gradient(120deg, #8b4513 0%, #b35c23 100%)', color: '#fffaf0', borderRadius: 14, padding: 18, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', boxShadow: '0 10px 24px rgba(139,69,19,0.24)' }}>
          <div>
            <h2 style={{ margin: 0 }}>Emani Calling Portal</h2>
            <p style={{ margin: '6px 0 0', color: '#ffe7cf' }}>Lead-to-Onboarding tracking for The Legacy Link</p>
          </div>
          <button type="button" onClick={exportCsv} style={{ marginLeft: 'auto' }}>Export CSV</button>
          <button type="button" className="ghost" onClick={lock}>Lock</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
          {[
            ['Total Leads', stats.total],
            ['Today Leads', stats.todayLeads],
            ['Called', stats.called],
            ['Connected', stats.connected],
            ['Qualified', stats.qualified],
            ['Moved Forward', stats.movedForward],
            ['Payout Earned', `$${payoutTotal}`]
          ].map(([label, value]) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
              <div style={{ color: '#64748b', fontSize: 12 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>Hours Available Today</strong>
          <input
            value={hoursToday}
            onChange={(e) => setHoursToday(e.target.value)}
            placeholder="e.g., 6"
            style={{ maxWidth: 140 }}
          />
          <small className="muted">Used for daily accountability + pay tracking.</small>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Add New Lead</h3>
          <form onSubmit={addLead} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
            <input placeholder="Full Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <select value={form.licensedStatus} onChange={(e) => setForm((f) => ({ ...f, licensedStatus: e.target.value }))}>
              {['Unknown', 'Licensed', 'Unlicensed'].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <input placeholder="Lead Source" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
            <input placeholder="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            <button type="submit">Add Lead</button>
          </form>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Tracking Pipeline</h3>
          <p style={{ marginTop: 0, color: '#475569' }}>
            <strong>Move Forward definition:</strong> lead is counted as moved forward when they are <strong>approved</strong> and <strong>start onboarding</strong>.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Name', 'Email', 'Phone', 'Licensed', 'Stage', 'Call Log', 'Quick Update', 'Notes', 'Updated', 'Payout', 'Actions'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: 8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isApproved = approvedSet.has(`n:${normalizeName(row.name || '')}`) || approvedSet.has(`e:${String(row.email || '').toLowerCase()}`) || approvedSet.has(`p:${normalizePhone(row.phone || '')}`);

                  return (
                  <tr key={row.id} style={isApproved ? { background: 'rgba(34, 197, 94, 0.14)' } : undefined}>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                      <div>{row.name}</div>
                      {isApproved ? <small style={{ color: '#166534', fontWeight: 700 }}>Approved • Stop Calling</small> : null}
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>{row.email || '—'}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>{row.phone || '—'}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                      <select
                        value={row.licensedStatus || 'Unknown'}
                        onChange={(e) => updateRow(row.id, { licensedStatus: e.target.value }).catch(() => {})}
                      >
                        {['Unknown', 'Licensed', 'Unlicensed'].map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                      <strong>{row.stage}</strong>
                      <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>
                        By: {row.stageUpdatedBy || '—'}
                        <br />
                        At: {fmtDateTime(row.stageUpdatedAt)}
                      </div>
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9', minWidth: 210 }}>
                      <select
                        value={row.callResult || ''}
                        onChange={(e) => logCallResult(row, e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <option value="">Log call result…</option>
                        {CALL_RESULTS.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                      <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                        Attempts: <strong>{Number(row.callAttempts || 0)}</strong>
                        <br />
                        Last: {fmtDateTime(row.lastCallAttemptAt)}
                      </div>
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                      <select value={row.stage} onChange={(e) => setStage(row, e.target.value)}>
                        {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                      <input
                        defaultValue={row.notes || ''}
                        onBlur={(e) => updateRow(row.id, { notes: e.target.value }).catch(() => {})}
                        placeholder="Context"
                      />
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>{fmtDateTime(row.updatedAt)}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                      {policyApprovedSet.has(normalizeName(row.name || '')) && row.stage === 'Onboarding Started' ? (
                        <span className="pill onpace" style={{ fontWeight: 700 }}>+$300</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => sendSponsorshipInvite(row)}
                          disabled={isApproved || Boolean(row.inviteSentAt)}
                          style={row.inviteSentAt ? { background: '#94a3b8', cursor: 'not-allowed' } : undefined}
                        >
                          {row.inviteSentAt ? 'Email Sent' : 'Send Sponsor Email'}
                        </button>
                        <button type="button" className="ghost" onClick={() => removeLead(row.id)}>Delete</button>
                        {row.inviteSentAt ? <small style={{ color: '#64748b' }}>Invite sent: {fmtDateTime(row.inviteSentAt)}</small> : null}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {!rows.length ? (
                  <tr>
                    <td colSpan={11} style={{ padding: 14, color: '#64748b' }}>No leads yet. Add first lead above.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Live Call Script (Use Exactly)</h3>
          <p><strong>Opener:</strong> “Hey [Name], thank you for your interest in joining our insurance agency. This will take less than 3 minutes. I have two quick questions to see if you qualify, and if you do, we’ll move to next steps.”</p>
          <p><strong>Question 1:</strong> “How much time can you devote to the insurance business each week?”</p>
          <p><strong>Question 2:</strong> “Are you willing to do one hour of community service each month?”</p>
          <p><strong>Service examples:</strong> soup kitchen, church/mosque volunteering, or donating clothes to Salvation Army.</p>
          <p><strong>Qualification gate:</strong> at least 10 hours/week, willing to serve, and not located in New York.</p>
          <p><strong>Close:</strong> “Perfect — I’m sending your next-step email now. Please complete it right away so we can move quickly.”</p>
        </div>
      </div>
    </main>
  );
}
