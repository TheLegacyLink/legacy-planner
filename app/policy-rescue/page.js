'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

const PASSCODE_STORAGE_KEY = 'legacy-planner-policy-rescue-passcode';
const BOARD_STORAGE_KEY = 'legacy-planner-policy-rescue-board-v1';
const SESSION_STORAGE_KEY = 'legacy-planner-policy-rescue-unlocked';

const DEFAULT_PASSCODE = 'legacylink';

const seedLeads = [
  {
    id: 'lead-1',
    name: 'Leticia Wright',
    phone: '2149013884',
    referredBy: 'Leticia Wright',
    approvedDate: '2026-02-19',
    dueDate: '2026-02-20',
    owner: 'Jamal',
    status: 'appt_set',
    nextActionAt: '2026-02-20T17:00',
    notes: 'Set policy app between 5-7 PM.'
  },
  {
    id: 'lead-2',
    name: 'Dakarai Nichols',
    phone: '3139822683',
    referredBy: 'Kimora Link',
    approvedDate: '2026-02-19',
    dueDate: '2026-02-20',
    owner: 'Reggie',
    status: 'contacted',
    nextActionAt: '2026-02-20T11:30',
    notes: 'Needs follow-up to lock time.'
  },
  {
    id: 'lead-3',
    name: 'Kristal Bowdry',
    phone: '8509389591',
    referredBy: 'Kimora Link',
    approvedDate: '2026-02-18',
    dueDate: '2026-02-19',
    owner: 'Jamal',
    status: 'policy_complete',
    nextActionAt: '',
    notes: 'Policy complete.'
  }
];

const statusOptions = [
  { value: 'new_approved', label: 'New Approved' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'appt_set', label: 'Appt Set' },
  { value: 'policy_complete', label: 'Policy Complete' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'defaulted', label: 'Defaulted' }
];

function statusTone(status) {
  if (status === 'policy_complete') return 'onpace';
  if (status === 'appt_set' || status === 'contacted') return 'atrisk';
  if (status === 'new_approved') return 'pending';
  return 'offpace';
}

function isOverdue(lead) {
  if (!lead.dueDate) return false;
  if (lead.status === 'policy_complete' || lead.status === 'defaulted') return false;
  const due = new Date(`${lead.dueDate}T23:59:59`);
  return due.getTime() < Date.now();
}

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function PolicyRescuePage() {
  const [passcodeInput, setPasscodeInput] = useState('');
  const [savedPasscode, setSavedPasscode] = useState(DEFAULT_PASSCODE);
  const [unlocked, setUnlocked] = useState(false);
  const [authError, setAuthError] = useState('');

  const [filter, setFilter] = useState('all');
  const [leads, setLeads] = useState(seedLeads);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    referredBy: '',
    approvedDate: '',
    dueDate: '',
    owner: '',
    status: 'new_approved',
    nextActionAt: '',
    notes: ''
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromStorage = localStorage.getItem(PASSCODE_STORAGE_KEY);
    if (fromStorage) setSavedPasscode(fromStorage);

    const unlockedSession = sessionStorage.getItem(SESSION_STORAGE_KEY) === '1';
    setUnlocked(unlockedSession);

    const board = localStorage.getItem(BOARD_STORAGE_KEY);
    if (board) {
      try {
        const parsed = JSON.parse(board);
        if (Array.isArray(parsed)) setLeads(parsed);
      } catch {
        // ignore bad local data
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(leads));
  }, [leads]);

  const sortedLeads = useMemo(() => {
    const enriched = leads.map((lead) => ({ ...lead, overdue: isOverdue(lead) || lead.status === 'overdue' }));

    const filtered = enriched.filter((lead) => {
      if (filter === 'all') return true;
      if (filter === 'overdue') return lead.overdue;
      if (filter === 'today') {
        const today = new Date().toISOString().slice(0, 10);
        return lead.dueDate === today;
      }
      if (filter === 'complete') return lead.status === 'policy_complete';
      return true;
    });

    return filtered.sort((a, b) => {
      const aPriority = a.overdue ? 0 : a.status === 'new_approved' ? 1 : a.status === 'appt_set' ? 2 : 3;
      const bPriority = b.overdue ? 0 : b.status === 'new_approved' ? 1 : b.status === 'appt_set' ? 2 : 3;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return (a.dueDate || '').localeCompare(b.dueDate || '');
    });
  }, [leads, filter]);

  const metrics = useMemo(() => {
    const overdue = leads.filter((l) => isOverdue(l) || l.status === 'overdue').length;
    const complete = leads.filter((l) => l.status === 'policy_complete').length;
    const apptSet = leads.filter((l) => l.status === 'appt_set').length;
    const active = leads.length - complete;
    return { overdue, complete, apptSet, active };
  }, [leads]);

  function handleUnlock(e) {
    e.preventDefault();
    if ((passcodeInput || '').trim().toLowerCase() !== (savedPasscode || '').trim().toLowerCase()) {
      setAuthError('Incorrect passcode.');
      return;
    }
    setAuthError('');
    setUnlocked(true);
    sessionStorage.setItem(SESSION_STORAGE_KEY, '1');
  }

  function updateLead(id, patch) {
    setLeads((prev) => prev.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead)));
  }

  function addLead(e) {
    e.preventDefault();
    if (!form.name || !form.owner || !form.approvedDate || !form.dueDate) return;

    const next = {
      id: `lead-${Date.now()}`,
      ...form
    };
    setLeads((prev) => [next, ...prev]);
    setForm({
      name: '',
      phone: '',
      referredBy: '',
      approvedDate: '',
      dueDate: '',
      owner: '',
      status: 'new_approved',
      nextActionAt: '',
      notes: ''
    });
  }

  if (!unlocked) {
    return (
      <AppShell title="Policy Rescue Board">
        <div className="authGate panel">
          <h3>Team Access</h3>
          <p className="muted">Enter passcode to open today’s rescue board.</p>
          <form className="inlineForm" onSubmit={handleUnlock}>
            <input
              type="password"
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              placeholder="Enter passcode"
            />
            <button type="submit">Unlock</button>
          </form>
          {authError ? <p className="red" style={{ marginTop: 8 }}>{authError}</p> : null}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Policy Rescue Board">
      <div className="panelRow" style={{ marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>Approved → Contact → Close Tracker</h3>
          <p className="muted" style={{ margin: 0 }}>Color-coded, owner-driven, daily execution board.</p>
        </div>
        <div className="leaderboardTabs">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'overdue' ? 'active' : ''} onClick={() => setFilter('overdue')}>Overdue</button>
          <button className={filter === 'today' ? 'active' : ''} onClick={() => setFilter('today')}>Due Today</button>
          <button className={filter === 'complete' ? 'active' : ''} onClick={() => setFilter('complete')}>Complete</button>
        </div>
      </div>

      <div className="grid4">
        <div className="card"><p>Active</p><h2>{metrics.active}</h2></div>
        <div className="card"><p>Overdue</p><h2>{metrics.overdue}</h2><span className="pill offpace">Action now</span></div>
        <div className="card"><p>Appt Set</p><h2>{metrics.apptSet}</h2><span className="pill atrisk">Needs follow-through</span></div>
        <div className="card"><p>Policy Complete</p><h2>{metrics.complete}</h2><span className="pill onpace">Win logged</span></div>
      </div>

      <div className="panel">
        <div className="panelRow"><h3>Add New Approved Lead</h3></div>
        <form className="logForm" onSubmit={addLead}>
          <label>Name<input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
          <label>Phone<input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></label>
          <label>Referred By<input value={form.referredBy} onChange={(e) => setForm((f) => ({ ...f, referredBy: e.target.value }))} /></label>
          <label>Owner<input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} /></label>
          <label>Approved Date<input type="date" value={form.approvedDate} onChange={(e) => setForm((f) => ({ ...f, approvedDate: e.target.value }))} /></label>
          <label>Due Date (24h)<input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></label>
          <label>Status
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label>Next Action
            <input type="datetime-local" value={form.nextActionAt} onChange={(e) => setForm((f) => ({ ...f, nextActionAt: e.target.value }))} />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>Notes
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>
          <button type="submit">Add Lead</button>
        </form>
      </div>

      <div className="panel">
        <div className="panelRow"><h3>Execution Board</h3></div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Owner</th>
              <th>Approved</th>
              <th>Due</th>
              <th>Status</th>
              <th>Next Action</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {sortedLeads.map((lead) => {
              const overdue = isOverdue(lead) || lead.status === 'overdue';
              const tone = overdue ? 'offpace' : statusTone(lead.status);
              return (
                <tr key={lead.id} style={overdue ? { background: 'rgba(160, 32, 44, 0.2)' } : undefined}>
                  <td>
                    <strong>{lead.name}</strong>
                    <div className="muted">{lead.phone || '—'} • Referred by {lead.referredBy || '—'}</div>
                  </td>
                  <td>{lead.owner}</td>
                  <td>{fmtDate(lead.approvedDate)}</td>
                  <td>{fmtDate(lead.dueDate)}</td>
                  <td>
                    <select
                      value={overdue && lead.status !== 'policy_complete' ? 'overdue' : lead.status}
                      onChange={(e) => updateLead(lead.id, { status: e.target.value })}
                    >
                      {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <div style={{ marginTop: 6 }}><span className={`pill ${tone}`}>{overdue ? 'Overdue' : statusOptions.find((s) => s.value === lead.status)?.label}</span></div>
                  </td>
                  <td>
                    <input
                      type="datetime-local"
                      value={lead.nextActionAt || ''}
                      onChange={(e) => updateLead(lead.id, { nextActionAt: e.target.value })}
                    />
                  </td>
                  <td>
                    <textarea
                      value={lead.notes || ''}
                      onChange={(e) => updateLead(lead.id, { notes: e.target.value })}
                      style={{ minHeight: 64 }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
