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

function productionNumberFromAgent(agent) {
  return String(agent?.agent_id || '').trim() || 'Pending Assignment';
}

function buildWelcomeMessage(agent) {
  const display = toDisplayName(agent.full_name);
  const first = firstNameFromDisplay(display);
  const productionNumber = productionNumberFromAgent(agent);

  return [
    `Hi ${first},`,
    '',
    'Congratulations and welcome to The Legacy Link.',
    'Your contracting is complete, and we are excited to support your growth.',
    '',
    `Production Number: ${productionNumber}`,
    '',
    'To build momentum immediately, please complete the following this week:',
    '1) Attend all required onboarding and team meetings',
    '2) Stay active in team communication and accountability channels',
    '3) Use scripts, training, and systems daily',
    '4) Maintain fast follow-up and consistent activity',
    '',
    'You now have access to the full Legacy Link support system. We are here to help you execute at a high level.',
    '',
    'Welcome aboard,',
    'The Legacy Link Team'
  ].join('\n');
}

function buildWelcomeHtml(agent) {
  const display = toDisplayName(agent.full_name);
  const first = firstNameFromDisplay(display);
  const productionNumber = productionNumberFromAgent(agent);

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;line-height:1.6;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;background:#0f172a;color:#ffffff;">
        <h2 style="margin:0;font-size:20px;">Welcome to The Legacy Link</h2>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;">Hi ${first},</p>
        <p style="margin:0 0 12px;">Congratulations and welcome to <strong>The Legacy Link</strong>. Your contracting is complete, and we are excited to support your growth.</p>
        <p style="margin:0 0 16px;"><strong>Production Number:</strong> ${productionNumber}</p>
        <p style="margin:0 0 12px;">To build momentum immediately, please complete the following this week:</p>
        <ol style="margin:0 0 16px 20px;padding:0;">
          <li>Attend all required onboarding and team meetings</li>
          <li>Stay active in team communication and accountability channels</li>
          <li>Use scripts, training, and systems daily</li>
          <li>Maintain fast follow-up and consistent activity</li>
        </ol>
        <p style="margin:0 0 12px;">You now have access to the full Legacy Link support system. We are here to help you execute at a high level.</p>
        <p style="margin:20px 0 0;">Welcome aboard,<br/><strong>The Legacy Link Team</strong></p>
      </div>
    </div>
  </div>`;
}

export default function LicensedAgentsPage() {
  const [stateFilter, setStateFilter] = useState('ALL');
  const [carrierFilter, setCarrierFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sendingEmailFor, setSendingEmailFor] = useState('');

  const groupedAgents = useMemo(() => {
    const map = new Map();

    for (const [index, row] of licensedAgents.entries()) {
      const rawAgentId = String(row.agent_id || '').trim();
      const fallbackKey = String(row.email || row.full_name || index).trim().toUpperCase();
      const mapKey = rawAgentId || `MISSING-${fallbackKey}`;

      if (!map.has(mapKey)) {
        map.set(mapKey, {
          row_key: mapKey,
          agent_id: rawAgentId,
          missingAgentId: !rawAgentId,
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

      const agent = map.get(mapKey);
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

    if (!String(agent?.agent_id || '').trim()) {
      window.alert('Missing Agent ID. Add Agent ID in the sheet before sending welcome email.');
      return;
    }

    setSendingEmailFor(agent.row_key || agent.agent_id);
    try {
      const first = firstNameFromDisplay(toDisplayName(agent.full_name));
      const subject = `Welcome to The Legacy Link, ${first}`;
      const text = buildWelcomeMessage(agent);
      const html = buildWelcomeHtml(agent);

      const res = await fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text, html })
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
              One row per agent. Agent ID is used as the production number. Filter by state to instantly find who can write in that state and see carrier contracts. Agents in their first 14 days from effective date are flagged as NEW.
              Add missing Agent IDs in the source sheet before sending welcome emails. Use “Send via Gmail” after setting Gmail env vars in Vercel.
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
              <th>Agent ID</th>
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

              return (
                <tr key={row.row_key || row.agent_id} style={isNew ? { background: 'rgba(34, 197, 94, 0.10)' } : undefined}>
                  <td>
                    <div>{toDisplayName(row.full_name)}</div>
                    {isNew ? <span className="pill onpace">NEW</span> : null}
                  </td>
                  <td>
                    {row.agent_id ? (
                      <code>{row.agent_id}</code>
                    ) : (
                      <span className="pill atrisk">Missing Agent ID</span>
                    )}
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
                        disabled={!row.email || !row.agent_id || sendingEmailFor === (row.row_key || row.agent_id)}
                      >
                        {sendingEmailFor === (row.row_key || row.agent_id) ? 'Sending...' : 'Send via Gmail'}
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
