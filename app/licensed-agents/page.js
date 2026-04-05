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

function fngAgentIdFromAgent(agent) {
  const pairs = Array.isArray(agent?.carrierAgentIdPairs) ? agent.carrierAgentIdPairs : [];
  const fng = pairs.find((p) => {
    const carrier = String(p?.carrier || '').toLowerCase();
    return carrier.includes('f&g') || carrier.includes('fng');
  });

  const fngId = String(fng?.agentId || '').trim();
  if (fngId && fngId.toLowerCase() !== 'unknown') return fngId;

  return 'Unknown';
}

function buildWelcomeMessage(agent) {
  const display = toDisplayName(agent.full_name);
  const first = firstNameFromDisplay(display);
  const fngAgentId = fngAgentIdFromAgent(agent);

  return [
    `Hi ${first},`,
    '',
    'Congratulations — you are now licensed with The Legacy Link.',
    '',
    `FNG Agent ID: ${fngAgentId}`,
    '',
    'Step 1 — Setup SOP Portal (Back Office):',
    'https://innercirclelink.com/licensed-backoffice#start',
    '',
    'Step 2 — Contracting',
    'Part A (Pinnacle Group flow — Mutual of Omaha, Transamerica, Foresters, American National):',
    'https://surelc.surancebay.com/producer/?gaId=190',
    '',
    'Part B (F&G + National Life Group flow):',
    'https://surelc.surancebay.com/sbweb/login.jsp?branch=InvestaLink&branchEditable=off&branchRequired=on&branchVisible=on&gaId=168&gaName=AIP%20Marketing%20Alliance',
    '',
    'National Life Group only: after completing SureLC, look out for a follow-up email within 48 hours (1–2 business days) to complete an additional required form.',
    '',
    'Part C — Contracting Tutorial (follow along):',
    'https://youtu.be/QVg0rUti1hM',
    '',
    'If your FNG Agent ID shows as Unknown, reply to this email and we will update it for you immediately.',
    '',
    'Welcome aboard,',
    'Legacy Link Support Team'
  ].join('\n');
}

function buildWelcomeHtml(agent) {
  const display = toDisplayName(agent.full_name);
  const first = firstNameFromDisplay(display);
  const fngAgentId = fngAgentIdFromAgent(agent);

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;line-height:1.6;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;background:#0f172a;color:#ffffff;">
        <h2 style="margin:0;font-size:20px;">Premium Professional — Licensed Access</h2>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;">Hi ${first},</p>
        <p style="margin:0 0 12px;">Congratulations — you are now licensed with <strong>The Legacy Link</strong>.</p>
        <p style="margin:0 0 16px;"><strong>FNG Agent ID:</strong> ${fngAgentId}</p>

        <p style="margin:0 0 8px;"><strong>Step 1 — Setup SOP Portal (Back Office):</strong><br/>
          <a href="https://innercirclelink.com/licensed-backoffice#start" target="_blank" rel="noopener noreferrer">https://innercirclelink.com/licensed-backoffice#start</a>
        </p>

        <p style="margin:14px 0 8px;"><strong>Step 2 — Contracting</strong></p>
        <p style="margin:0 0 8px;"><strong>Part A (Pinnacle Group flow — Mutual of Omaha, Transamerica, Foresters, American National):</strong><br/>
          <a href="https://surelc.surancebay.com/producer/?gaId=190" target="_blank" rel="noopener noreferrer">https://surelc.surancebay.com/producer/?gaId=190</a>
        </p>

        <p style="margin:0 0 8px;"><strong>Part B (F&G + National Life Group flow):</strong><br/>
          <a href="https://surelc.surancebay.com/sbweb/login.jsp?branch=InvestaLink&branchEditable=off&branchRequired=on&branchVisible=on&gaId=168&gaName=AIP%20Marketing%20Alliance" target="_blank" rel="noopener noreferrer">SureLC Part B Link</a>
        </p>

        <p style="margin:0 0 8px;">National Life Group only: after completing SureLC, look out for a follow-up email within 48 hours (1–2 business days) to complete an additional required form.</p>

        <p style="margin:0 0 12px;"><strong>Part C — Contracting Tutorial (follow along):</strong><br/>
          <a href="https://youtu.be/QVg0rUti1hM" target="_blank" rel="noopener noreferrer">https://youtu.be/QVg0rUti1hM</a>
        </p>

        <p style="margin:0 0 12px;">If your FNG Agent ID shows as <strong>Unknown</strong>, reply to this email and we will update it for you immediately.</p>
        <p style="margin:20px 0 0;">Welcome aboard,<br/><strong>Legacy Link Support Team</strong></p>
      </div>
    </div>
  </div>`;
}

function referralCodeFromAgent(agent = {}) {
  const name = normalize(toDisplayName(agent?.full_name || '')).replace(/[^a-z0-9 ]/g, '').trim();
  if (!name) return '';
  if (name === 'latricia wright' || name === 'letitia wright') return 'leticia_wright';
  return name.replace(/\s+/g, '_');
}

function sponsorshipLinkForAgent(agent = {}) {
  const ref = referralCodeFromAgent(agent);
  return ref ? `/sponsorship-signup?ref=${encodeURIComponent(ref)}` : '/sponsorship-signup';
}

export default function LicensedAgentsPage() {
  const [stateFilter, setStateFilter] = useState('ALL');
  const [carrierFilter, setCarrierFilter] = useState('ALL');
  const [sortMode, setSortMode] = useState('latest');
  const [search, setSearch] = useState('');
  const [sendingEmailFor, setSendingEmailFor] = useState('');

  const groupedAgents = useMemo(() => {
    const map = new Map();

    for (const [index, row] of licensedAgents.entries()) {
      const rawAgentId = String(row.agent_id || '').trim();
      const mapKey = String(row.email || row.full_name || index).trim().toUpperCase();

      if (!map.has(mapKey)) {
        map.set(mapKey, {
          row_key: mapKey,
          agent_id: '',
          missingAgentId: true,
          full_name: row.full_name || '',
          email: row.email || '',
          phone: row.phone || '',
          city: row.city || '',
          home_state: row.home_state || '',
          states: new Set(),
          carriers: new Set(),
          agentIds: new Set(),
          carrierAgentIds: new Map(),
          hasActive: false,
          effective_date: ''
        });
      }

      const agent = map.get(mapKey);
      const st = normalize(row.state_code);
      if (st) agent.states.add(st);
      if (rawAgentId) agent.agentIds.add(rawAgentId);

      const carrierList = Array.isArray(row.carriers_all) ? row.carriers_all : [];
      for (const carrier of carrierList) {
        const c = String(carrier || '').trim();
        if (!c) continue;
        agent.carriers.add(c);
        const existing = String(agent.carrierAgentIds.get(c) || '').trim();
        if (!existing || existing.toLowerCase() === 'unknown') {
          agent.carrierAgentIds.set(c, rawAgentId || 'Unknown');
        }
      }

      const details = Array.isArray(row.carrier_details) ? row.carrier_details : [];
      for (const detail of details) {
        const c = String(detail?.carrier || '').trim();
        if (!c) continue;
        const carrierId = String(detail?.carrier_agent_id || '').trim() || rawAgentId || 'Unknown';
        agent.carriers.add(c);
        const existing = String(agent.carrierAgentIds.get(c) || '').trim();
        if (!existing || existing.toLowerCase() === 'unknown') {
          agent.carrierAgentIds.set(c, carrierId);
        }
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
      .map((agent) => {
        const agentIds = Array.from(agent.agentIds || []).filter(Boolean).sort();
        const carrierAgentIdPairs = Array.from(agent.carrierAgentIds || []).map(([carrier, carrierAgentId]) => ({
          carrier,
          agentId: String(carrierAgentId || '').trim() || 'Unknown'
        })).sort((a, b) => a.carrier.localeCompare(b.carrier));

        return {
          ...agent,
          agent_id: agentIds[0] || '',
          missingAgentId: !agentIds.length,
          agent_ids: agentIds,
          carrierAgentIdPairs,
          states: Array.from(agent.states).sort(),
          carriers: Array.from(agent.carriers).sort()
        };
      });
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
          (agent.agent_ids || []).join(' '),
          (agent.carrierAgentIdPairs || []).map((x) => `${x.carrier} ${x.agentId}`).join(' '),
          agent.carriers.join(' ')
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedTerm);
      });
  }, [groupedAgents, stateFilter, carrierFilter, search]);

  const sortedRows = useMemo(() => {
    const out = [...filteredRows];

    if (sortMode === 'alphabetical') {
      return out.sort((a, b) => toDisplayName(a.full_name).localeCompare(toDisplayName(b.full_name)));
    }

    // Default: latest first by effective date, then alphabetical fallback.
    return out.sort((a, b) => {
      const ad = parseEffectiveDate(a.effective_date)?.getTime() || 0;
      const bd = parseEffectiveDate(b.effective_date)?.getTime() || 0;
      if (bd !== ad) return bd - ad;
      return toDisplayName(a.full_name).localeCompare(toDisplayName(b.full_name));
    });
  }, [filteredRows, sortMode]);

  const sendWelcomeEmail = async (agent) => {
    const to = String(agent?.email || '').trim();
    if (!to) {
      window.alert('No email found for this agent.');
      return;
    }

    setSendingEmailFor(agent.row_key || agent.agent_id);
    try {
      const first = firstNameFromDisplay(toDisplayName(agent.full_name));
      const subject = `Premium Professional: You’re Licensed + FNG Access, ${first}`;
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
              One row per agent. For now, the directory displays only the <strong>FNG Agent ID</strong> (Unknown when not provided).
              Filter by state to instantly find who can write in that state and see carrier contracts. Agents in their first 14 days from effective date are flagged as NEW.
              Use “Send via Gmail” to send the licensed + FNG access email.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="/sponsorship-signup" className="ghost" style={{ textDecoration: 'none' }}>Open Sponsorship Page</a>
            <span className="pill onpace">{sortedRows.length} Agents</span>
          </div>
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

          <label style={{ display: 'grid', gap: '6px' }}>
            <span className="muted">Sort</span>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
              <option value="latest">Latest Licensed First</option>
              <option value="alphabetical">Alphabetical (A–Z)</option>
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
              <th>FNG Agent ID</th>
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
            {sortedRows.map((row) => {
              const ageDays = daysSince(row.effective_date);
              const isNew = ageDays !== null && ageDays >= 0 && ageDays <= 14;

              return (
                <tr key={row.row_key || row.agent_id} style={isNew ? { background: 'rgba(34, 197, 94, 0.10)' } : undefined}>
                  <td>
                    <div>{toDisplayName(row.full_name)}</div>
                    {isNew ? <span className="pill onpace">NEW</span> : null}
                  </td>
                  <td>
                    {fngAgentIdFromAgent(row) !== 'Unknown' ? (
                      <code>{fngAgentIdFromAgent(row)}</code>
                    ) : (
                      <span className="muted">Unknown</span>
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
                        disabled={!row.email || sendingEmailFor === (row.row_key || row.agent_id)}
                      >
                        {sendingEmailFor === (row.row_key || row.agent_id) ? 'Sending...' : 'Send via Gmail'}
                      </button>
                      <a href={sponsorshipLinkForAgent(row)} className="ghost" style={{ textDecoration: 'none', textAlign: 'center' }}>
                        Personal Sponsorship Link
                      </a>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          const href = sponsorshipLinkForAgent(row);
                          const full = `${window.location.origin}${href}`;
                          navigator.clipboard.writeText(full);
                        }}
                      >
                        Copy Sponsorship Link
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
