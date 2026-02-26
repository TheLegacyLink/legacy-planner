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

function summarize(rows = []) {
  const total = rows.length;
  const withEmail = rows.filter((r) => displayEmail(r)).length;
  return { total, withEmail, withoutEmail: Math.max(0, total - withEmail) };
}

export default function ContactsVaultPage() {
  const [rows, setRows] = useState([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [summary, setSummary] = useState({ total: 0, withEmail: 0, withoutEmail: 0 });
  const [msg, setMsg] = useState('');
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

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

    const res = await fetch('/api/contacts-vault', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.ok) {
      const serverRows = Array.isArray(data.rows) ? data.rows : [];
      // Prefer whichever source currently has more rows so user never sees "0" after upload.
      if (serverRows.length >= local.rows.length) {
        setRows(serverRows);
        setUpdatedAt(data.updatedAt || '');
        setSummary(data.summary || summarize(serverRows));
      } else {
        setRows(local.rows);
        setUpdatedAt(local.updatedAt || data.updatedAt || '');
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = `${displayName(r)}`.toLowerCase();
      const email = `${displayEmail(r)}`.toLowerCase();
      const phone = `${displayPhone(r)}`.toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [rows, query]);

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

        const parsedRows = Array.isArray(parsed.data) ? parsed.data.filter((r) => Object.values(r || {}).some((v) => String(v || '').trim())) : [];

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
              Internal-only storage for outreach/promotions and email lookups.
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
          <h3 style={{ margin: 0 }}>Contacts Preview</h3>
          <input
            placeholder="Search name/email/phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ maxWidth: 280 }}
          />
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((r, i) => (
              <tr key={`r-${i}`}>
                <td>{displayName(r) || '—'}</td>
                <td>{displayEmail(r) || '—'}</td>
                <td>{displayPhone(r) || '—'}</td>
              </tr>
            ))}
            {!preview.length ? <tr><td colSpan={3} className="muted">No contacts loaded yet.</td></tr> : null}
          </tbody>
        </table>
        {filtered.length > 200 ? <p className="muted">Showing first 200 of {filtered.length} matches.</p> : null}
      </div>
    </AppShell>
  );
}
