'use client';

import { useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import licensedAgents from '../../data/licensedAgents.json';

function normalize(value = '') {
  return String(value).trim().toUpperCase();
}

export default function LicensedAgentsPage() {
  const [stateFilter, setStateFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const states = useMemo(() => {
    const set = new Set(licensedAgents.map((row) => normalize(row.state_code)).filter(Boolean));
    return ['ALL', ...Array.from(set).sort()];
  }, []);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return licensedAgents
      .filter((row) => (stateFilter === 'ALL' ? true : normalize(row.state_code) === stateFilter))
      .filter((row) => {
        if (!term) return true;
        return [row.full_name, row.email, row.phone, row.city, row.state_code, row.agent_id]
          .join(' ')
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [stateFilter, search]);

  return (
    <AppShell title="Licensed Agents Directory">
      <div className="panel">
        <div className="panelRow" style={{ marginBottom: '10px', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Legacy Link Licensing Directory</h3>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              Search by state to instantly see who is licensed and how to contact them.
            </p>
          </div>
          <span className="pill onpace">{filteredRows.length} Matches</span>
        </div>

        <div className="panelRow" style={{ gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ display: 'grid', gap: '6px' }}>
            <span className="muted">State</span>
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: '6px', minWidth: '300px', flex: 1 }}>
            <span className="muted">Search (name, city, phone, email)</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a name, city, phone, or email"
            />
          </label>
        </div>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Licensed State</th>
              <th>Home State</th>
              <th>Phone</th>
              <th>Email</th>
              <th>City</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={`${row.agent_id}-${row.state_code}`}>
                <td>{row.full_name || '—'}</td>
                <td>{row.state_code || '—'}</td>
                <td>{row.home_state || '—'}</td>
                <td>{row.phone || '—'}</td>
                <td>{row.email || '—'}</td>
                <td>{row.city || '—'}</td>
                <td>
                  <span className={`pill ${String(row.license_status).toLowerCase() === 'active' ? 'onpace' : 'atrisk'}`}>
                    {row.license_status || 'Unknown'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
