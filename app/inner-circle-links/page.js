'use client';

import { useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { loadRuntimeConfig } from '../../lib/runtimeConfig';

const FIXED_REF_CODES = {
  'Kimora Link': 'kimora_link',
  'Jamal Holmes': 'jamal_holmes',
  'Mahogany Burns': 'mahogany_burns',
  'Madalyn Adams': 'madalyn_adams',
  'Kelin Brown': 'kelin_brown',
  'Leticia Wright': 'leticia_wright',
  'Breanna James': 'breanna_james',
  'Dr. Brianna': 'dr_brianna'
};

function fallbackRefCode(name = '') {
  return String(name).toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, '_');
}

function defaultRefCode(agent) {
  return FIXED_REF_CODES[agent] || fallbackRefCode(agent);
}

export default function InnerCircleLinksPage() {
  const cfg = useMemo(() => loadRuntimeConfig(), []);
  const [origin, setOrigin] = useState('https://innercirclelink.com');
  const [codesByAgent, setCodesByAgent] = useState(() => {
    const map = {};
    (cfg.agents || []).forEach((agent) => {
      map[agent] = defaultRefCode(agent);
    });
    return map;
  });

  const setCode = (agent, value) => setCodesByAgent((prev) => ({ ...prev, [agent]: value }));

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <AppShell title="Inner Circle Personal Links">
      <div className="panel">
        <div className="panelRow">
          <h3>Personal Referral Links</h3>
          <span className="muted">Use these for attribution-locked submissions</span>
        </div>

        <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
          Base URL
          <input value={origin} onChange={(e) => setOrigin(e.target.value)} />
        </label>

        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Ref Code</th>
              <th>Sponsorship Link</th>
              <th>Application Link</th>
            </tr>
          </thead>
          <tbody>
            {(cfg.agents || []).map((agent) => {
              const ref = codesByAgent[agent] || '';
              const sponsorLink = `${origin}/sponsorship-signup?ref=${encodeURIComponent(ref)}`;
              const appLink = `${origin}/inner-circle-app-submit?ref=${encodeURIComponent(ref)}`;

              return (
                <tr key={agent}>
                  <td>{agent}</td>
                  <td>
                    <input value={ref} onChange={(e) => setCode(agent, e.target.value)} />
                  </td>
                  <td>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <small className="muted">{sponsorLink}</small>
                      <button type="button" className="ghost" onClick={() => copy(sponsorLink)}>Copy</button>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <small className="muted">{appLink}</small>
                      <button type="button" className="ghost" onClick={() => copy(appLink)}>Copy</button>
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
