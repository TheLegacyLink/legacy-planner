'use client';

import { useEffect, useMemo, useState } from 'react';

const ACCESS_KEY = 'caller_emani_access_v1';
const DATA_KEY = 'caller_emani_pipeline_v1';
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

const MOVE_FORWARD_STAGE = 'Onboarding Started';

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

export default function CallerEmaniPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    licensedStatus: 'Unknown',
    source: 'Kimora Day-in-the-Life Lead',
    notes: ''
  });

  useEffect(() => {
    try {
      if (localStorage.getItem(ACCESS_KEY) === 'ok') setUnlocked(true);
      const raw = localStorage.getItem(DATA_KEY);
      if (raw) setRows(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  function persist(next) {
    setRows(next);
    localStorage.setItem(DATA_KEY, JSON.stringify(next));
  }

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

  function addLead(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const now = new Date().toISOString();
    const next = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
        updatedAt: now,
        dayKey: todayKey(),
        stage: 'New',
        calledAt: '',
        connectedAt: '',
        qualifiedAt: '',
        formSentAt: '',
        formCompletedAt: '',
        policyStartedAt: '',
        approvedAt: '',
        onboardingStartedAt: '',
        movedForwardAt: '',
        ...form
      },
      ...rows
    ];
    persist(next);
    setForm({ name: '', phone: '', licensedStatus: 'Unknown', source: 'Kimora Day-in-the-Life Lead', notes: '' });
  }

  function updateRow(id, patch) {
    const now = new Date().toISOString();
    const next = rows.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: now } : r));
    persist(next);
  }

  function setStage(row, stage) {
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
    updateRow(row.id, { stage, ...stampPatch });
  }

  function removeLead(id) {
    const next = rows.filter((r) => r.id !== id);
    persist(next);
  }

  function exportCsv() {
    const headers = [
      'name', 'phone', 'licensedStatus', 'stage', 'source', 'notes',
      'calledAt', 'connectedAt', 'qualifiedAt', 'formSentAt', 'formCompletedAt',
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
    const today = todayKey();
    const todayRows = rows.filter((r) => r.dayKey === today);
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

  if (!unlocked) {
    return (
      <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #172554 0%, #0b1220 60%)', display: 'grid', placeItems: 'center', padding: 16, color: '#fff' }}>
        <div style={{ width: '100%', maxWidth: 440, background: '#0f172a', border: '1px solid #334155', borderRadius: 14, padding: 22 }}>
          <h2 style={{ marginTop: 0 }}>Emani Calling Portal</h2>
          <p style={{ color: '#cbd5e1' }}>Enter your password to access your calling dashboard.</p>
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
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: 16, color: '#0f172a' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: 14 }}>
        <div style={{ background: '#0f172a', color: '#fff', borderRadius: 14, padding: 18, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>Emani Calling Portal</h2>
            <p style={{ margin: '6px 0 0', color: '#cbd5e1' }}>Lead-to-Onboarding tracking for The Legacy Link</p>
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
            ['Moved Forward', stats.movedForward]
          ].map(([label, value]) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
              <div style={{ color: '#64748b', fontSize: 12 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Add New Lead</h3>
          <form onSubmit={addLead} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
            <input placeholder="Full Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
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
                  {['Name', 'Phone', 'Licensed', 'Stage', 'Quick Update', 'Notes', 'Updated', 'Actions'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: 8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>{row.name}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>{row.phone || '—'}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>{row.licensedStatus}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}><strong>{row.stage}</strong></td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                      <select value={row.stage} onChange={(e) => setStage(row, e.target.value)}>
                        {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                      <input value={row.notes || ''} onChange={(e) => updateRow(row.id, { notes: e.target.value })} placeholder="Context" />
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>{fmtDateTime(row.updatedAt)}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                      <button type="button" className="ghost" onClick={() => removeLead(row.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 14, color: '#64748b' }}>No leads yet. Add first lead above.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 10 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
            <h3 style={{ marginTop: 0 }}>Live Call Script (Use Exactly)</h3>
            <p><strong>STEP 1 — Opener:</strong> “Hey ___, this is ___ from The Legacy Link. You watched Kimora’s video about the day in the life of an insurance agent and requested more information — did I catch you at a quick minute?”</p>
            <p><strong>STEP 2 — Frame:</strong> “This isn’t just an insurance agency. We’re building leaders, serving the community, and helping people build something real. I just need two quick questions to see if it makes sense to move you forward.”</p>
            <p><strong>Q1:</strong> Licensed or unlicensed?</p>
            <p><strong>Licensed close:</strong> Send next step in 5 minutes.</p>
            <p><strong>Unlicensed close:</strong> Sponsorship form + 1 hour community service requirement.</p>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
            <h3 style={{ marginTop: 0 }}>Caller SOP & Pay Model</h3>
            <ul>
              <li>5 days/week, calling window 9AM–9PM CST</li>
              <li>Goal: 5–15 calls/day</li>
              <li>Speed-to-call target: first attempt within 5 minutes</li>
              <li>Flat pay option: approx $50/day (hour/shift based)</li>
              <li>Referral-based option: $300 per lead that <strong>moves forward</strong> (approved + onboarding started)</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
