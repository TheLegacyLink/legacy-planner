'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

function parseCsvRows(text = '') {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (vals[i] || '').trim();
    });
    return row;
  });
}

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

export default function ContactsVaultPage() {
  const [rows, setRows] = useState([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [summary, setSummary] = useState({ total: 0, withEmail: 0, withoutEmail: 0 });
  const [msg, setMsg] = useState('');
  const [query, setQuery] = useState('');

  async function load() {
    const res = await fetch('/api/contacts-vault', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setUpdatedAt(data.updatedAt || '');
      setSummary(data.summary || { total: 0, withEmail: 0, withoutEmail: 0 });
    }
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
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = parseCsvRows(String(reader.result || ''));
        const res = await fetch('/api/contacts-vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: parsed, source: file.name || 'contacts.csv' })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          setMsg(`Upload failed: ${data?.error || 'unknown error'}`);
          return;
        }
        await load();
        setMsg(`Uploaded ${Number(data?.summary?.total || 0)} contacts.`);
      } catch {
        setMsg('Could not parse CSV. Please check format.');
      }
    };
    reader.onerror = () => setMsg('File read failed.');
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
