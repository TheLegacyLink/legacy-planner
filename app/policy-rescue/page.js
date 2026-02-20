'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { loadRuntimeConfig } from '../../lib/runtimeConfig';

const BOARD_STORAGE_KEY = 'legacy-planner-policy-rescue-board-v1';
const SESSION_STORAGE_KEY = 'legacy-planner-policy-rescue-unlocked';

const seedLeads = [
  {
    id: 'lead-1',
    name: 'Leticia Wright',
    phone: '2149013884',
    referredBy: 'Kimora Link',
    ownerCredit: 'Kimora Link',
    policyWriter: 'Jamal',
    approvedDate: '2026-02-19',
    dueDate: '2026-02-20',
    status: 'appt_set',
    nextActionAt: '2026-02-20T17:00',
    notes: 'Set policy app between 5-7 PM.'
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function normalizeStatus(raw = '') {
  const value = String(raw).toLowerCase();
  if (value.includes('complete')) return 'policy_complete';
  if (value.includes('appt')) return 'appt_set';
  if (value.includes('contact')) return 'contacted';
  if (value.includes('overdue')) return 'overdue';
  if (value.includes('default')) return 'defaulted';
  return 'new_approved';
}

function pick(row, keys = []) {
  for (const key of keys) {
    if (row?.[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim();
  }
  return '';
}

function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });
}

function normalizeRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.leads)) return payload.leads;
  return [];
}

function mapExternalLead(row, index) {
  const referredBy = pick(row, ['referredBy', 'referred_by', 'Referred By', 'referred by']);
  const ownerFromFeed = pick(row, ['ownerCredit', 'owner', 'Owner']);
  return {
    id: pick(row, ['id', 'ID']) || `sheet-${Date.now()}-${index}`,
    name: pick(row, ['name', 'Name', 'client_name']) || 'Unnamed Lead',
    phone: pick(row, ['phone', 'Phone']),
    referredBy,
    ownerCredit: referredBy || ownerFromFeed,
    policyWriter: pick(row, ['policyWriter', 'policy_writer', 'policy_writer_name', 'Policy Writer', 'Writer']),
    approvedDate: pick(row, ['approvedDate', 'approved_date', 'Approved Date', 'approved date']),
    dueDate: pick(row, ['dueDate', 'due_date', 'Due Date', 'Due Date (24h)']),
    status: normalizeStatus(pick(row, ['status', 'Status', '24hr Status'])),
    nextActionAt: pick(row, ['nextActionAt', 'next_action_at', 'Next Action', 'next action']),
    notes: pick(row, ['notes', 'Notes', 'comment', 'Comment'])
  };
}

export default function PolicyRescuePage() {
  const [passcodeInput, setPasscodeInput] = useState('');
  const [savedPasscode, setSavedPasscode] = useState('legacylink');
  const [unlocked, setUnlocked] = useState(false);
  const [authError, setAuthError] = useState('');

  const [readUrl, setReadUrl] = useState('');
  const [writeUrl, setWriteUrl] = useState('');
  const [syncNotice, setSyncNotice] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [filter, setFilter] = useState('all');
  const [leads, setLeads] = useState(seedLeads);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    referredBy: '',
    policyWriter: '',
    approvedDate: '',
    dueDate: '',
    status: 'new_approved',
    nextActionAt: '',
    notes: ''
  });

  const loadFromSource = useCallback(async () => {
    if (!readUrl) return;
    setSyncing(true);
    try {
      const res = await fetch(readUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();

      let rows = [];
      const trimmed = text.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        rows = normalizeRows(parsed);
      } else {
        rows = parseCsv(text);
      }

      const mapped = rows.map(mapExternalLead);
      if (mapped.length) {
        setLeads(mapped);
        localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(mapped));
        setDirty(false);
        setSyncNotice(`Loaded ${mapped.length} leads from Google source.`);
      } else {
        setSyncNotice('Connected, but no rows found in source feed.');
      }
    } catch (err) {
      setSyncNotice(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }, [readUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cfg = loadRuntimeConfig();
    setReadUrl(cfg.policyRescue?.readUrl || '');
    setWriteUrl(cfg.policyRescue?.writeUrl || '');
    setSavedPasscode(cfg.policyRescue?.passcode || 'legacylink');

    const unlockedSession = sessionStorage.getItem(SESSION_STORAGE_KEY) === '1';
    setUnlocked(unlockedSession);

    const board = localStorage.getItem(BOARD_STORAGE_KEY);
    if (board) {
      try {
        const parsed = JSON.parse(board);
        if (Array.isArray(parsed) && parsed.length) setLeads(parsed);
      } catch {
        // ignore bad local data
      }
    }
  }, []);

  useEffect(() => {
    if (readUrl) loadFromSource();
  }, [readUrl, loadFromSource]);

  function updateLead(id, patch) {
    setDirty(true);
    setLeads((prev) => prev.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead)));
  }

  async function saveChanges() {
    setSyncing(true);
    try {
      localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(leads));
      if (writeUrl) {
        const res = await fetch(writeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updatedAt: new Date().toISOString(), leads })
        });
        if (!res.ok) throw new Error(`Write endpoint HTTP ${res.status}`);
        setSyncNotice('Saved to Google source successfully.');
      } else {
        setSyncNotice('Saved locally. Add Policy Rescue Write URL in Settings for live Google writeback.');
      }
      setDirty(false);
    } catch (err) {
      setSyncNotice(`Save failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

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

  function addLead(e) {
    e.preventDefault();
    if (!form.name || !form.referredBy || !form.approvedDate || !form.dueDate) return;

    const next = {
      id: `lead-${Date.now()}`,
      name: form.name,
      phone: form.phone,
      referredBy: form.referredBy,
      ownerCredit: form.referredBy,
      policyWriter: form.policyWriter,
      approvedDate: form.approvedDate,
      dueDate: form.dueDate,
      status: form.status,
      nextActionAt: form.nextActionAt,
      notes: form.notes
    };

    setDirty(true);
    setLeads((prev) => [next, ...prev]);
    setForm({
      name: '',
      phone: '',
      referredBy: '',
      policyWriter: '',
      approvedDate: '',
      dueDate: '',
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
          <p className="muted" style={{ margin: 0 }}>
            Owner credit is always the referral owner. Policy writer is tracked separately.
          </p>
          {syncNotice ? <p className="muted" style={{ margin: '6px 0 0' }}>{syncNotice}</p> : null}
        </div>
        <div className="rowActions">
          <button onClick={loadFromSource} disabled={!readUrl || syncing}>{syncing ? 'Syncing…' : 'Sync from Google'}</button>
          <button onClick={saveChanges} disabled={syncing || !dirty}>{dirty ? 'Save Changes' : 'Saved'}</button>
        </div>
      </div>

      <div className="grid4">
        <div className="card"><p>Active</p><h2>{metrics.active}</h2></div>
        <div className="card"><p>Overdue</p><h2>{metrics.overdue}</h2><span className="pill offpace">Action now</span></div>
        <div className="card"><p>Appt Set</p><h2>{metrics.apptSet}</h2><span className="pill atrisk">Needs follow-through</span></div>
        <div className="card"><p>Policy Complete</p><h2>{metrics.complete}</h2><span className="pill onpace">Win logged</span></div>
      </div>

      <div className="panelRow" style={{ marginBottom: 8 }}>
        <div className="leaderboardTabs">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'overdue' ? 'active' : ''} onClick={() => setFilter('overdue')}>Overdue</button>
          <button className={filter === 'today' ? 'active' : ''} onClick={() => setFilter('today')}>Due Today</button>
          <button className={filter === 'complete' ? 'active' : ''} onClick={() => setFilter('complete')}>Complete</button>
        </div>
        <span className={`pill ${readUrl ? 'onpace' : 'atrisk'}`}>{readUrl ? 'Google Sync Configured' : 'Local Mode'}</span>
      </div>

      <div className="panel">
        <div className="panelRow"><h3>Add New Approved Lead</h3></div>
        <form className="logForm" onSubmit={addLead}>
          <label>Name<input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
          <label>Phone<input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></label>
          <label>Referred By (Owner Credit)
            <input value={form.referredBy} onChange={(e) => setForm((f) => ({ ...f, referredBy: e.target.value }))} />
          </label>
          <label>Policy Writer
            <input value={form.policyWriter} onChange={(e) => setForm((f) => ({ ...f, policyWriter: e.target.value }))} />
          </label>
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
              <th>Owner Credit</th>
              <th>Policy Writer</th>
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
                    <div className="muted">{lead.phone || '—'}</div>
                    <input
                      placeholder="Referred by"
                      value={lead.referredBy || ''}
                      onChange={(e) => updateLead(lead.id, { referredBy: e.target.value, ownerCredit: e.target.value })}
                    />
                  </td>
                  <td>
                    <span className="pill onpace">{lead.ownerCredit || '—'}</span>
                  </td>
                  <td>
                    <input
                      value={lead.policyWriter || ''}
                      onChange={(e) => updateLead(lead.id, { policyWriter: e.target.value })}
                    />
                  </td>
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
