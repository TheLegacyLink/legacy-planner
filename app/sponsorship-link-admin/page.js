'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import staticUsers from '../../data/innerCircleUsers.json';

function clean(v = '') {
  return String(v || '').trim();
}

function buildRefCode({ name = '', email = '' } = {}) {
  const n = clean(name).toLowerCase();
  const parts = n
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (parts.length >= 2) return `${parts[0]}_${parts[parts.length - 1]}`;

  const local = clean(email).toLowerCase().split('@')[0] || '';
  if (local) return local.replace(/[^a-z0-9_-]/g, '');

  return 'member';
}

function buildSponsorshipUrl(base = '', ref = '') {
  const b = clean(base) || 'https://innercirclelink.com/sponsorship-signup';
  const code = clean(ref) || 'member';
  const encoded = encodeURIComponent(code);
  return b.includes('?') ? `${b}&ref=${encoded}` : `${b}?ref=${encoded}`;
}

function uniqueByEmailOrName(rows = []) {
  const map = new Map();
  for (const r of rows) {
    const email = clean(r?.email).toLowerCase();
    const name = clean(r?.name || r?.applicantName || r?.fullName || '');
    const key = email || `name:${name.toLowerCase()}`;
    if (!key || key === 'name:') continue;
    if (!map.has(key)) map.set(key, { name, email });
  }
  return Array.from(map.values());
}

export default function SponsorshipLinkAdminPage() {
  const [baseUrl, setBaseUrl] = useState('https://innercirclelink.com/sponsorship-signup');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const fromStatic = (Array.isArray(staticUsers) ? staticUsers : []).map((u) => ({
          name: clean(u?.name),
          email: clean(u?.email)
        }));

        const res = await fetch('/api/inner-circle-hub-members', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        const fromMembers = (Array.isArray(json?.rows) ? json.rows : []).map((m) => ({
          name: clean(m?.applicantName),
          email: clean(m?.email)
        }));

        const merged = uniqueByEmailOrName([...fromStatic, ...fromMembers]);
        if (!cancelled) setRows(merged);
      } catch {
        if (!cancelled) {
          const fromStatic = (Array.isArray(staticUsers) ? staticUsers : []).map((u) => ({
            name: clean(u?.name),
            email: clean(u?.email)
          }));
          setRows(uniqueByEmailOrName(fromStatic));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = clean(search).toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      clean(r?.name).toLowerCase().includes(q) || clean(r?.email).toLowerCase().includes(q)
    );
  }, [rows, search]);

  const customRef = buildRefCode({ name: customName, email: customEmail });
  const customLink = buildSponsorshipUrl(baseUrl, customRef);

  async function copy(text = '') {
    try {
      await navigator.clipboard.writeText(text);
      window.alert('Copied.');
    } catch {
      window.alert('Copy failed.');
    }
  }

  return (
    <AppShell title="Sponsorship Link Finder (Admin)">
      <div className="panel" style={{ maxWidth: 1100 }}>
        <h3 style={{ marginTop: 0 }}>Sponsorship Link Finder</h3>
        <p className="muted" style={{ marginTop: -4 }}>
          Search by name or email, then copy their personal sponsorship link.
        </p>

        <div className="panel" style={{ marginTop: 8, display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            Sponsorship Signup Base URL
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://innercirclelink.com/sponsorship-signup" />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            Search Name or Email
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g., jarkesha@gmail.com" />
          </label>
        </div>

        <div className="panel" style={{ marginTop: 10, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Ref Code</th>
                <th>Sponsorship Link</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="muted">Loading...</td></tr>
              ) : null}
              {!loading && !filtered.length ? (
                <tr><td colSpan={4} className="muted">No matches found.</td></tr>
              ) : null}
              {!loading && filtered.map((r) => {
                const ref = buildRefCode({ name: r.name, email: r.email });
                const link = buildSponsorshipUrl(baseUrl, ref);
                return (
                  <tr key={`${r.email || r.name}`}>
                    <td>{r.name || '—'}</td>
                    <td>{r.email || '—'}</td>
                    <td>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <small>{ref}</small>
                        <button type="button" className="ghost" onClick={() => copy(ref)}>Copy Ref</button>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <small style={{ wordBreak: 'break-all' }}>{link}</small>
                        <button type="button" className="ghost" onClick={() => copy(link)}>Copy Link</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="panel" style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <h4 style={{ margin: 0 }}>Quick Create (if person not listed yet)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Name (optional)" />
            <input value={customEmail} onChange={(e) => setCustomEmail(e.target.value)} placeholder="Email (optional)" />
          </div>
          <small>Ref code: <strong>{customRef}</strong></small>
          <small style={{ wordBreak: 'break-all' }}>{customLink}</small>
          <div>
            <button type="button" onClick={() => copy(customLink)}>Copy Quick Link</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
