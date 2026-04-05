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

  return [
    `Hi ${first},`,
    '',
    'You are approved on the licensed track. Execute these steps in order:',
    '',
    '1) Back Office Access (Start Here):',
    'https://innercirclelink.com/licensed-backoffice',
    'Sign in and follow the guided onboarding steps.',
    'If prompted, sign company contract before continuing.',
    '',
    '2) Contracting:',
    'See PDF: https://innercirclelink.com/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf',
    '',
    '3) Skool Community:',
    'https://www.skool.com/legacylink/about',
    '',
    '4) YouTube (Whatever It Takes):',
    'https://youtu.be/SVvU9SvCH9o?si=nzgjgEa7DfGQlxmX',
    '',
    'Welcome aboard,',
    'Legacy Link Support Team'
  ].join('\n');
}

function buildWelcomeHtml(agent) {
  const display = toDisplayName(agent.full_name);
  const first = firstNameFromDisplay(display);

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#040B23;padding:24px;color:#E5E7EB;line-height:1.6;">
    <div style="max-width:860px;margin:0 auto;background:#0B1534;border:1px solid #1E3A8A;border-radius:18px;overflow:hidden;box-shadow:0 14px 34px rgba(0,0,0,0.35);">
      <div style="padding:18px 24px;background:#1651AE;text-align:center;">
        <div style="color:#FFFFFF;font-weight:800;font-size:58px;line-height:1;letter-spacing:1px;">THE LEGACY LINK</div>
      </div>
      <div style="padding:28px 30px;">
        <h2 style="margin:0 0 14px;font-size:50px;line-height:1.1;color:#F8FAFC;">Licensed Approval — Execute Your Next Steps</h2>
        <p style="margin:0 0 14px;color:#E2E8F0;font-size:36px;">Hi ${first},</p>
        <p style="margin:0 0 18px;color:#CBD5E1;font-size:32px;">You are approved on the licensed track. Complete your next steps in order so you can move into production quickly.</p>

        <div style="background:#071235;border:1px solid #294B8D;border-radius:14px;padding:18px 20px;">
          <p style="margin:0 0 14px;color:#FB923C;font-weight:800;font-size:34px;">Execute these steps in order</p>
          <ol style="margin:0;padding-left:28px;color:#E2E8F0;font-size:33px;line-height:1.45;">
            <li style="margin-bottom:12px;"><strong>Back Office Access (Start Here):</strong><br/>
              <a href="https://innercirclelink.com/licensed-backoffice" target="_blank" rel="noopener noreferrer" style="color:#FB923C;text-decoration:underline;font-weight:700;">https://innercirclelink.com/licensed-backoffice</a><br/>
              Sign in and follow the guided onboarding steps. If prompted, sign company contract before continuing.
            </li>
            <li style="margin-bottom:12px;"><strong>Contracting:</strong><br/>See PDF attached:<br/>
              <a href="https://innercirclelink.com/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf" target="_blank" rel="noopener noreferrer" style="color:#FB923C;text-decoration:underline;font-weight:700;">Licensed Agent Onboarding PDF</a>
            </li>
            <li style="margin-bottom:12px;"><strong>Skool Community:</strong><br/>
              <a href="https://www.skool.com/legacylink/about" target="_blank" rel="noopener noreferrer" style="color:#FB923C;text-decoration:underline;font-weight:700;">https://www.skool.com/legacylink/about</a>
            </li>
            <li><strong>YouTube (Whatever It Takes):</strong><br/>
              <a href="https://youtu.be/SVvU9SvCH9o?si=nzgjgEa7DfGQlxmX" target="_blank" rel="noopener noreferrer" style="color:#FB923C;text-decoration:underline;font-weight:700;">https://youtu.be/SVvU9SvCH9o?si=nzgjgEa7DfGQlxmX</a>
            </li>
          </ol>
        </div>
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
