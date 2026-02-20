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

  const groupedAgents = useMemo(() => {
    const map = new Map();

    for (const row of licensedAgents) {
      const id = row.agent_id;
      if (!id) continue;

      if (!map.has(id)) {
        map.set(id, {
          agent_id: id,
          full_name: row.full_name || '',
          email: row.email || '',
          phone: row.phone || '',
          city: row.city || '',
          home_state: row.home_state || '',
          states: new Set(),
          hasActive: false
        });
      }

      const agent = map.get(id);
      const st = normalize(row.state_code);
      if (st) agent.states.add(st);
      if (String(row.license_status).toLowerCase() === 'active') {
        agent.hasActive = true;
      }
    }

    return Array.from(map.values())
      .map((agent) => ({
        ...agent,
        states: Array.from(agent.states).sort()
      }))
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, []);

  const states = useMemo(() => {
    const set = new Set();
    for (const agent of groupedAgents) {
      for (const st of agent.states) set.add(st);
    }
    return ['ALL', ...Array.from(set).sort()];
  }, [groupedAgents]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return groupedAgents
      .filter((agent) => (stateFilter === 'ALL' ? true : agent.states.includes(stateFilter)))
      .filter((agent) => {
        if (!term) return true;
        return [
          agent.full_name,
          agent.email,
          agent.phone,
          agent.city,
          agent.home_state,
          agent.agent_id,
          agent.states.join(', ')
        ]
          .join(' ')
          .toLowerCase()
          .includes(term);
      });
  }, [groupedAgents, stateFilter, search]);

  return (
    <AppShell title="Licensed Agents Directory">
      <div className="panel">
        <div className="panelRow" style={{ marginBottom: '10px', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Legacy Link Licensing Directory</h3>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              One row per agent. Filter by state to instantly find who can write in that state.
            </p>
          </div>
          <span className="pill onpace">{filteredRows.length} Agents</span>
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
            <span className="muted">Search (name, city, phone, email, states)</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a name, city, phone, email, or state"
            />
          </label>
        </div>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Licensed States</th>
              <th>Home State</th>
              <th>Phone</th>
              <th>Email</th>
              <th>City</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.agent_id}>
                <td>{row.full_name || '—'}</td>
                <td>{row.states.length ? row.states.join(', ') : '—'}</td>
                <td>{row.home_state || '—'}</td>
                <td>{row.phone || '—'}</td>
                <td>{row.email || '—'}</td>
                <td>{row.city || '—'}</td>
                <td>
                  <span className={`pill ${row.hasActive ? 'onpace' : 'atrisk'}`}>{row.hasActive ? 'Active' : 'Unknown'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
