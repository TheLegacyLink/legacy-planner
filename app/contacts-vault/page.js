'use client';

import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import AppShell from '../../components/AppShell';

const LOCAL_FALLBACK_KEY = 'legacy-contacts-vault-local-v1';

function pick(row, keys = []) {
  for (const k of keys) {
    if (row?.[k]) return String(row[k]);
  }
  return '';
}

function toLocal(iso = '') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function normalize(v = '') {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function nameKey(v = '') {
  return normalize(v).replace(/[^a-z0-9]/g, '');
}

function phoneKey(v = '') {
  return String(v || '').replace(/[^0-9]/g, '');
}

function displayName(row = {}) {
  const full = pick(row, ['full_name', 'fullName', 'Name', 'name']);
  if (full) return full;
  const first = pick(row, ['First Name', 'first_name', 'firstName', 'firstname']);
  const last = pick(row, ['Last Name', 'last_name', 'lastName', 'lastname']);
  return `${first} ${last}`.trim();
}

function displayEmail(row = {}) {
  return pick(row, ['Email', 'email', 'email_address', 'E-mail']);
}

function displayPhone(row = {}) {
  return pick(row, ['Phone', 'phone', 'Phone Number', 'phone_number', 'mobile', 'Mobile Phone', 'Number']);
}

function firstNameValue(row = {}) {
  return pick(row, ['First Name', 'first_name', 'firstName', 'firstname']);
}

function lastNameValue(row = {}) {
  return pick(row, ['Last Name', 'last_name', 'lastName', 'lastname']);
}

function isValidUnassignedLead(rowMeta = {}) {
  const first = String(firstNameValue(rowMeta.raw) || '').trim();
  const last = String(lastNameValue(rowMeta.raw) || '').trim();
  const email = String(rowMeta.email || '').trim();

  if (!email) return false;
  if (!last) return false;
  if (first.length <= 1) return false;
  return true;
}

function assignedRaw(row = {}) {
  return pick(row, ['Assigned To', 'assigned_to', 'AssignedTo', 'Assigned', 'Lead Owner', 'Owner', 'Agent']);
}

function leadDate(row = {}) {
  const v = pick(row, ['Created At', 'created_at', 'Date Added', 'Lead Date', 'Timestamp', 'Date', 'Submitted At']);
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function summarize(rows = []) {
  const total = rows.length;
  const withEmail = rows.filter((r) => displayEmail(r)).length;
  return { total, withEmail, withoutEmail: Math.max(0, total - withEmail) };
}

function scoreAssignee(raw = '', userName = '') {
  const r = normalize(raw);
  const u = normalize(userName);
  if (!r || !u) return 0;
  if (r === u) return 100;

  const uParts = u.split(' ');
  const first = uParts[0] || '';
  const last = uParts[uParts.length - 1] || '';

  let score = 0;
  if (first && r.includes(first)) score += 50;
  if (last && r.includes(last)) score += 45;

  // tolerate minor misspellings for first name (e.g., Kellen vs Kelin)
  if (!r.includes(first) && first && r[0] === first[0]) score += 15;

  return score;
}

function matchInnerCircleAssignee(raw = '', users = []) {
  const r = normalize(raw);
  if (!r) return '';

  let best = '';
  let bestScore = 0;
  for (const u of users) {
    const name = String(u?.name || '').trim();
    const sc = scoreAssignee(r, name);
    if (sc > bestScore) {
      bestScore = sc;
      best = name;
    }
  }

  return bestScore >= 50 ? best : '';
}

export default function ContactsVaultPage() {
  const [rows, setRows] = useState([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [summary, setSummary] = useState({ total: 0, withEmail: 0, withoutEmail: 0 });
  const [msg, setMsg] = useState('');
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [users, setUsers] = useState([]);
  const [sponsorshipApps, setSponsorshipApps] = useState([]);
  const [policySubs, setPolicySubs] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [assigneeView, setAssigneeView] = useState('inner');

  function loadLocalFallback() {
    try {
      const cached = JSON.parse(localStorage.getItem(LOCAL_FALLBACK_KEY) || '{}');
      const localRows = Array.isArray(cached?.rows) ? cached.rows : [];
      const localUpdated = cached?.updatedAt || '';
      return { rows: localRows, updatedAt: localUpdated };
    } catch {
      return { rows: [], updatedAt: '' };
    }
  }

  function saveLocalFallback(localRows) {
    try {
      localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify({ rows: localRows, updatedAt: new Date().toISOString() }));
    } catch {
      // ignore local errors
    }
  }

  async function load() {
    const local = loadLocalFallback();

    const [vaultRes, usersRes, appsRes, policyRes, bookingsRes] = await Promise.all([
      fetch('/api/contacts-vault', { cache: 'no-store' }),
      fetch('/api/inner-circle-auth', { cache: 'no-store' }),
      fetch('/api/sponsorship-applications', { cache: 'no-store' }),
      fetch('/api/policy-submissions', { cache: 'no-store' }),
      fetch('/api/sponsorship-bookings', { cache: 'no-store' })
    ]);
    const vaultData = await vaultRes.json().catch(() => ({}));
    const usersData = await usersRes.json().catch(() => ({}));
    const appsData = await appsRes.json().catch(() => ({}));
    const policyData = await policyRes.json().catch(() => ({}));
    const bookingsData = await bookingsRes.json().catch(() => ({}));

    if (usersRes.ok && usersData?.ok) {
      setUsers(Array.isArray(usersData.users) ? usersData.users : []);
    }
    if (appsRes.ok && appsData?.ok) {
      setSponsorshipApps(Array.isArray(appsData.rows) ? appsData.rows : []);
    }
    if (policyRes.ok && policyData?.ok) {
      setPolicySubs(Array.isArray(policyData.rows) ? policyData.rows : []);
    }
    if (bookingsRes.ok && bookingsData?.ok) {
      setBookings(Array.isArray(bookingsData.rows) ? bookingsData.rows : []);
    }

    if (vaultRes.ok && vaultData?.ok) {
      const serverRows = Array.isArray(vaultData.rows) ? vaultData.rows : [];
      // Prefer whichever source currently has more rows so user never sees "0" after upload.
      if (serverRows.length >= local.rows.length) {
        setRows(serverRows);
        setUpdatedAt(vaultData.updatedAt || '');
        setSummary(vaultData.summary || summarize(serverRows));
      } else {
        setRows(local.rows);
        setUpdatedAt(local.updatedAt || vaultData.updatedAt || '');
        setSummary(summarize(local.rows));
        setMsg('Using local cached contacts view.');
      }
      return;
    }

    // API failed → fallback local
    setRows(local.rows);
    setUpdatedAt(local.updatedAt || '');
    setSummary(summarize(local.rows));
    if (local.rows.length) setMsg('Server unavailable — showing local cached contacts.');
  }

  useEffect(() => { load(); }, []);

  const processRefs = useMemo(() => {
    const emailSet = new Set();
    const phoneSet = new Set();
    const nameSet = new Set();

    sponsorshipApps.forEach((a) => {
      const nm = `${a?.firstName || ''} ${a?.lastName || ''}`.trim();
      if (nm) nameSet.add(nameKey(nm));
      if (a?.email) emailSet.add(normalize(a.email));
      if (a?.phone) phoneSet.add(phoneKey(a.phone));
    });

    policySubs.forEach((p) => {
      if (p?.applicantName) nameSet.add(nameKey(p.applicantName));
      if (p?.email) emailSet.add(normalize(p.email));
      if (p?.phone) phoneSet.add(phoneKey(p.phone));
    });

    bookings.forEach((b) => {
      if (b?.applicant_name) nameSet.add(nameKey(b.applicant_name));
      if (b?.applicant_email) emailSet.add(normalize(b.applicant_email));
      if (b?.applicant_phone) phoneSet.add(phoneKey(b.applicant_phone));
    });

    return { emailSet, phoneSet, nameSet };
  }, [sponsorshipApps, policySubs, bookings]);

  const rowsWithMeta = useMemo(() => {
    return rows.map((r, idx) => {
      const parsedDate = leadDate(r);
      const nm = displayName(r);
      const email = displayEmail(r);
      const phone = displayPhone(r);
      const inProcess =
        (email && processRefs.emailSet.has(normalize(email))) ||
        (phone && processRefs.phoneSet.has(phoneKey(phone))) ||
        (nm && processRefs.nameSet.has(nameKey(nm)));

      return {
        raw: r,
        idx,
        name: nm,
        email,
        phone,
        assignedText: assignedRaw(r),
        assignedTo: matchInnerCircleAssignee(assignedRaw(r), users),
        inProcess,
        dateObj: parsedDate,
        dateTs: parsedDate ? parsedDate.getTime() : 0
      };
    });
  }, [rows, users, processRefs]);

  const assignmentCounts = useMemo(() => {
    const map = new Map();
    users.forEach((u) => map.set(u.name, 0));
    rowsWithMeta.forEach((r) => {
      if (r.assignedTo && map.has(r.assignedTo)) {
        map.set(r.assignedTo, Number(map.get(r.assignedTo) || 0) + 1);
      }
    });
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [rowsWithMeta, users]);

  const allAssigneeCounts = useMemo(() => {
    const map = new Map();
    rowsWithMeta.forEach((r) => {
      const label = String(r.assignedTo || r.assignedText || '').trim();
      if (!label) return;
      map.set(label, Number(map.get(label) || 0) + 1);
    });
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [rowsWithMeta]);

  const assigneeCountsToShow = assigneeView === 'all' ? allAssigneeCounts : assignmentCounts;

  const latestUnassigned = useMemo(() => {
    return rowsWithMeta
      .filter((r) => !r.assignedTo)
      .filter((r) => isValidUnassignedLead(r))
      .sort((a, b) => {
        if (b.dateTs !== a.dateTs) return b.dateTs - a.dateTs;
        // Fallback CSV order: prefer top rows as newer imports.
        return a.idx - b.idx;
      })
      .slice(0, 200);
  }, [rowsWithMeta]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scoped = assigneeFilter
      ? rowsWithMeta.filter((r) => String(r.assignedTo || r.assignedText || '').trim() === assigneeFilter)
      : rowsWithMeta;

    if (!q) return scoped;
    return scoped.filter((r) => {
      const hay = `${r.name} ${r.email} ${r.phone} ${r.assignedTo || r.assignedText}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rowsWithMeta, query, assigneeFilter]);

  const preview = useMemo(() => filtered.slice(0, 200), [filtered]);

  const onUpload = (file) => {
    setMsg('');
    setProgress(0);
    if (!file) return;

    setUploading(true);

    const reader = new FileReader();
    reader.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      setProgress(Math.max(5, Math.round((evt.loaded / evt.total) * 60))); // reading stage
    };

    reader.onload = async () => {
      try {
        const text = String(reader.result || '');
        setProgress(70); // parsing stage

        const parsed = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => String(h || '').trim()
        });

        if (parsed.errors?.length) {
          setMsg(`CSV parsed with ${parsed.errors.length} warning(s). Continuing...`);
        }

        const parsedRows = Array.isArray(parsed.data)
          ? parsed.data.filter((r) => Object.values(r || {}).some((v) => String(v || '').trim()))
          : [];

        // immediate UI + local cache so user sees progress even if server storage is slow/unavailable
        setRows(parsedRows);
        setSummary(summarize(parsedRows));
        const now = new Date().toISOString();
        setUpdatedAt(now);
        saveLocalFallback(parsedRows);
        setProgress(85); // upload stage

        const res = await fetch('/api/contacts-vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: parsedRows, source: file.name || 'contacts.csv' })
        });
        const data = await res.json().catch(() => ({}));

        setProgress(100);
        if (!res.ok || !data?.ok) {
          setMsg(`Loaded locally (${parsedRows.length} rows). Server save failed: ${data?.error || 'unknown error'}`);
        } else {
          setMsg(`Uploaded ${Number(data?.summary?.total || parsedRows.length)} contacts successfully.`);
        }
      } catch {
        setMsg('Could not parse CSV. Please check format.');
      } finally {
        setUploading(false);
      }
    };

    reader.onerror = () => {
      setUploading(false);
      setMsg('File read failed.');
    };

    reader.readAsText(file);
  };

  return (
    <AppShell title="Contacts Vault">
      <div className="panel">
        <div className="panelRow" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Upload Contacts File (CSV)</h3>
            <p className="muted" style={{ margin: 0 }}>
              Internal-only storage for outreach/promotions and lead assignment visibility.
            </p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <input type="file" accept=".csv,text/csv" onChange={(e) => onUpload(e.target.files?.[0])} />
          </div>
        </div>

        {uploading ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 10, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: '#2563eb', transition: 'width .2s ease' }} />
            </div>
            <p className="muted" style={{ marginTop: 6 }}>Processing file... {progress}%</p>
          </div>
        ) : null}

        <div className="grid4" style={{ marginTop: 10 }}>
          <div className="card"><p>Total Contacts</p><h2>{summary.total}</h2></div>
          <div className="card"><p>With Email</p><h2>{summary.withEmail}</h2></div>
          <div className="card"><p>Missing Email</p><h2>{summary.withoutEmail}</h2></div>
          <div className="card"><p>Last Update</p><h2 style={{ fontSize: 16 }}>{toLocal(updatedAt)}</h2></div>
        </div>

        {msg ? <p className="muted" style={{ marginTop: 10 }}>{msg}</p> : null}
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <div className="panelRow" style={{ marginBottom: 8 }}>
          <h3 style={{ marginTop: 0 }}>Assigned Lead Counts</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={assigneeView === 'inner' ? '' : 'ghost'} onClick={() => setAssigneeView('inner')}>Inner Circle Only</button>
            <button type="button" className={assigneeView === 'all' ? '' : 'ghost'} onClick={() => setAssigneeView('all')}>All Assignees</button>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>{assigneeView === 'all' ? 'Assigned To' : 'Agent'}</th>
              <th>Assigned Leads</th>
            </tr>
          </thead>
          <tbody>
            {assigneeCountsToShow.map((a) => (
              <tr key={a.name}>
                <td>{a.name}</td>
                <td>{a.count}</td>
              </tr>
            ))}
            {!assigneeCountsToShow.length ? <tr><td colSpan={2} className="muted">No assignment data found.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Latest Unassigned Leads (Newest First • Cleaned • Cross-Referenced)</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Date</th>
              <th>Process</th>
              <th>Process Match</th>
              <th>Assigned Field</th>
            </tr>
          </thead>
          <tbody>
            {latestUnassigned.map((r, i) => (
              <tr key={`u-${i}`}>
                <td>{r.name || '—'}</td>
                <td>{r.email || '—'}</td>
                <td>{r.phone || '—'}</td>
                <td>{r.dateObj ? r.dateObj.toLocaleString() : '—'}</td>
                <td>{r.inProcess ? '✅ Already in process' : '—'}</td>
                <td>{r.assignedText || '—'}</td>
              </tr>
            ))}
            {!latestUnassigned.length ? <tr><td colSpan={6} className="muted">No unassigned leads found.</td></tr> : null}
          </tbody>
        </table>
        {latestUnassigned.length >= 200 ? <p className="muted">Showing first 200 latest unassigned leads.</p> : null}
        <p className="muted">Cross-reference checks against sponsorship applications, sponsorship bookings, and policy submissions.</p>
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <div className="panelRow" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Contacts Preview</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value="">All assignees</option>
              {(assigneeView === 'all' ? allAssigneeCounts : assignmentCounts).map((u) => <option key={u.name} value={u.name}>{u.name}</option>)}
            </select>
            <input
              placeholder="Search name/email/phone"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ maxWidth: 280 }}
            />
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Assigned To</th>
              <th>Date</th>
              <th>Process</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((r, i) => (
              <tr key={`r-${i}`}>
                <td>{r.name || '—'}</td>
                <td>{r.email || '—'}</td>
                <td>{r.phone || '—'}</td>
                <td>{r.assignedTo || r.assignedText || '—'}</td>
                <td>{r.dateObj ? r.dateObj.toLocaleString() : '—'}</td>
                <td>{r.inProcess ? '✅ In process' : '—'}</td>
              </tr>
            ))}
            {!preview.length ? <tr><td colSpan={6} className="muted">No contacts loaded yet.</td></tr> : null}
          </tbody>
        </table>
        {filtered.length > 200 ? <p className="muted">Showing first 200 of {filtered.length} matches.</p> : null}
      </div>
    </AppShell>
  );
}
