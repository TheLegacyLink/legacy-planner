'use client';

import { useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import licensedAgents from '../../data/licensedAgents.json';

function normalize(value = '') {
  return String(value).trim().toUpperCase();
}

const STATE_CODE_TO_NAME = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming'
};

const STATE_NAME_TO_CODE = {
  ALABAMA: 'AL',
  ALASKA: 'AK',
  ARIZONA: 'AZ',
  ARKANSAS: 'AR',
  CALIFORNIA: 'CA',
  CALI: 'CA',
  COLORADO: 'CO',
  CONNECTICUT: 'CT',
  DELAWARE: 'DE',
  'DISTRICT OF COLUMBIA': 'DC',
  DC: 'DC',
  FLORIDA: 'FL',
  GEORGIA: 'GA',
  HAWAII: 'HI',
  IDAHO: 'ID',
  ILLINOIS: 'IL',
  INDIANA: 'IN',
  IOWA: 'IA',
  KANSAS: 'KS',
  KENTUCKY: 'KY',
  LOUISIANA: 'LA',
  MAINE: 'ME',
  MARYLAND: 'MD',
  MASSACHUSETTS: 'MA',
  MICHIGAN: 'MI',
  MINNESOTA: 'MN',
  MISSISSIPPI: 'MS',
  MISSOURI: 'MO',
  MONTANA: 'MT',
  NEBRASKA: 'NE',
  NEVADA: 'NV',
  'NEW HAMPSHIRE': 'NH',
  'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM',
  'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC',
  'NORTH DAKOTA': 'ND',
  OHIO: 'OH',
  OKLAHOMA: 'OK',
  OREGON: 'OR',
  PENNSYLVANIA: 'PA',
  RHODEISLAND: 'RI',
  'RHODE ISLAND': 'RI',
  'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD',
  TENNESSEE: 'TN',
  TEXAS: 'TX',
  UTAH: 'UT',
  VERMONT: 'VT',
  VIRGINIA: 'VA',
  WASHINGTON: 'WA',
  'WEST VIRGINIA': 'WV',
  WISCONSIN: 'WI',
  WYOMING: 'WY'
};

function resolveStateInput(raw = '') {
  const normalized = normalize(raw).replace(/\./g, '');
  if (!normalized) return '';

  if (normalized.length === 2) return normalized;

  return STATE_NAME_TO_CODE[normalized] || '';
}

function parseEffectiveDate(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parts = raw.split('-');
  if (parts.length !== 3) return null;
  const [mm, dd, yyyy] = parts.map((x) => Number(x));
  const dt = new Date(yyyy, (mm || 1) - 1, dd || 1);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatEffectiveDate(value = '') {
  const dt = parseEffectiveDate(value);
  if (!dt) return '—';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysSince(value = '') {
  const dt = parseEffectiveDate(value);
  if (!dt) return null;
  const now = new Date();
  const diff = now.getTime() - dt.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function toDisplayName(raw = '') {
  const value = String(raw || '').trim();
  if (!value) return '—';
  if (value.includes(',')) {
    const [last, first] = value.split(',').map((x) => x.trim());
    const full = `${first} ${last}`.trim();
    return full.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
  }
  return value.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

function firstNameFromDisplay(name = '') {
  return String(name || '').trim().split(' ')[0] || 'Agent';
}

function buildWelcomeMessage(agent) {
  const display = toDisplayName(agent.full_name);
  const first = firstNameFromDisplay(display);
  return [
    `Subject: Welcome to Legacy Link — You’re Contracted, ${first}!`,
    '',
    `Hey ${first},`,
    '',
    "Congratulations — you’re now officially contracted with The Legacy Link.",
    "We’re excited to have you and we’re expecting big execution from you.",
    '',
    'Next steps to build immediate momentum:',
    '1) Tap into all required meetings this week',
    '2) Stay active in communication and accountability',
    '3) Use scripts, training, and systems daily',
    '4) Be consistent with follow-up and speed-to-lead',
    '',
    'You now have access to structure, support, and opportunity — now execute.',
    '',
    'Let’s win big.',
    '— The Legacy Link'
  ].join('\n');
}

export default function LicensedAgentsPage() {
  const [stateFilter, setStateFilter] = useState('ALL');
  const [carrierFilter, setCarrierFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sendingEmailFor, setSendingEmailFor] = useState('');

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
          carriers: new Set(),
          hasActive: false,
          effective_date: ''
        });
      }

      const agent = map.get(id);
      const st = normalize(row.state_code);
      if (st) agent.states.add(st);
      const carrierList = Array.isArray(row.carriers_all) ? row.carriers_all : [];
      for (const carrier of carrierList) {
        if (carrier) agent.carriers.add(carrier);
      }

      if (String(row.license_status).toLowerCase() === 'active') {
        agent.hasActive = true;
      }

      if (row.effective_date) {
        if (!agent.effective_date) {
          agent.effective_date = row.effective_date;
        } else {
          const current = parseEffectiveDate(agent.effective_date);
          const incoming = parseEffectiveDate(row.effective_date);
          if (current && incoming && incoming < current) {
            agent.effective_date = row.effective_date;
          }
        }
      }
    }

    return Array.from(map.values())
      .map((agent) => ({
        ...agent,
        states: Array.from(agent.states).sort(),
        carriers: Array.from(agent.carriers).sort()
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

  const carriers = useMemo(() => {
    const set = new Set();
    for (const agent of groupedAgents) {
      for (const c of agent.carriers || []) set.add(c);
    }
    return ['ALL', ...Array.from(set).sort()];
  }, [groupedAgents]);

  const filteredRows = useMemo(() => {
    const term = search.trim();
    const normalizedTerm = term.toLowerCase();
    const stateFromSearch = resolveStateInput(term);

    return groupedAgents
      .filter((agent) => (stateFilter === 'ALL' ? true : agent.states.includes(stateFilter)))
      .filter((agent) => (carrierFilter === 'ALL' ? true : (agent.carriers || []).includes(carrierFilter)))
      .filter((agent) => {
        // If search looks like a state code/name, enforce exact state match only.
        if (stateFromSearch) {
          return agent.states.includes(stateFromSearch);
        }

        if (!normalizedTerm) return true;

        return [
          agent.full_name,
          agent.email,
          agent.phone,
          agent.city,
          agent.home_state,
          agent.agent_id,
          agent.carriers.join(' ')
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedTerm);
      });
  }, [groupedAgents, stateFilter, carrierFilter, search]);



  const sendWelcomeEmail = async (agent) => {
    const to = String(agent?.email || '').trim();
    if (!to) {
      window.alert('No email found for this agent.');
      return;
    }

    setSendingEmailFor(agent.agent_id);
    try {
      const subject = `Welcome to Legacy Link — You’re Contracted, ${firstNameFromDisplay(toDisplayName(agent.full_name))}!`;
      const text = buildWelcomeMessage(agent);

      const res = await fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        window.alert(`Email failed: ${data?.error || 'unknown_error'}`);
        return;
      }

      window.alert(`Welcome email sent to ${to}`);
    } catch (error) {
      window.alert(`Email failed: ${error?.message || 'send_failed'}`);
    } finally {
      setSendingEmailFor('');
    }
  };

  return (
    <AppShell title="Licensed Agents Directory">
      <div className="panel">
        <div className="panelRow" style={{ marginBottom: '10px', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Legacy Link Licensing Directory</h3>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              One row per agent. Filter by state to instantly find who can write in that state and see carrier contracts. Agents in their first 14 days from effective date are flagged as NEW.
              Use “Send via Gmail” after setting Gmail env vars in Vercel.
            </p>
          </div>
          <span className="pill onpace">{filteredRows.length} Agents</span>
        </div>

        <div className="panelRow" style={{ gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ display: 'grid', gap: '6px' }}>
            <span className="muted">State Filter (full name helper)</span>
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state === 'ALL' ? 'All States' : `${state} — ${STATE_CODE_TO_NAME[state] || state}`}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: '6px' }}>
            <span className="muted">Carrier</span>
            <select value={carrierFilter} onChange={(e) => setCarrierFilter(e.target.value)}>
              {carriers.map((carrier) => (
                <option key={carrier} value={carrier}>
                  {carrier === 'ALL' ? 'All Carriers' : carrier}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: '6px', minWidth: '300px', flex: 1 }}>
            <span className="muted">Search (name, city, phone, email, or state code/name)</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Try: CA, California, Jamal Holmes, Atlanta"
            />
          </label>
        </div>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Licensed States</th>
              <th>Home State</th>
              <th>Carriers</th>
              <th>Effective Date</th>
              <th>Phone</th>
              <th>Email</th>
              <th>City</th>
              <th>Status</th>
              <th>Welcome</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const ageDays = daysSince(row.effective_date);
              const isNew = ageDays !== null && ageDays >= 0 && ageDays <= 14;

            

  const sendWelcomeEmail = async (agent) => {
    const to = String(agent?.email || '').trim();
    if (!to) {
      window.alert('No email found for this agent.');
      return;
    }

    setSendingEmailFor(agent.agent_id);
    try {
      const subject = `Welcome to Legacy Link — You’re Contracted, ${firstNameFromDisplay(toDisplayName(agent.full_name))}!`;
      const text = buildWelcomeMessage(agent);

      const res = await fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        window.alert(`Email failed: ${data?.error || 'unknown_error'}`);
        return;
      }

      window.alert(`Welcome email sent to ${to}`);
    } catch (error) {
      window.alert(`Email failed: ${error?.message || 'send_failed'}`);
    } finally {
      setSendingEmailFor('');
    }
  };

  return (
                <tr key={row.agent_id} style={isNew ? { background: 'rgba(34, 197, 94, 0.10)' } : undefined}>
                  <td>
                    <div>{toDisplayName(row.full_name)}</div>
                    {isNew ? <span className="pill onpace">NEW</span> : null}
                  </td>
                  <td>{row.states.length ? row.states.join(', ') : '—'}</td>
                  <td>{row.home_state || '—'}</td>
                  <td>{row.carriers?.length ? row.carriers.join(', ') : '—'}</td>
                  <td>{formatEffectiveDate(row.effective_date)}</td>
                  <td>{row.phone || '—'}</td>
                  <td>{row.email || '—'}</td>
                  <td>{row.city || '—'}</td>
                  <td>
                    <span className={`pill ${row.hasActive ? 'onpace' : 'atrisk'}`}>{row.hasActive ? 'Active' : 'Unknown'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => navigator.clipboard.writeText(buildWelcomeMessage(row))}
                      >
                        Copy Welcome
                      </button>
                      <button
                        type="button"
                        onClick={() => sendWelcomeEmail(row)}
                        disabled={!row.email || sendingEmailFor === row.agent_id}
                      >
                        {sendingEmailFor === row.agent_id ? 'Sending...' : 'Send via Gmail'}
                      </button>
                    </div>
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
