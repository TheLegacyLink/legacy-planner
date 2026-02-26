'use client';

import AppShell from '../../components/AppShell';

const MASTER_PASS = 'LegacyLink216';

const links = [
  { label: 'Mission Control', href: '/mission-control' },
  { label: 'Contacts Vault', href: '/contacts-vault' },
  { label: 'Policy Payout Ledger', href: '/policy-payouts' },
  { label: 'Payout Queue', href: '/payout-queue' },
  { label: 'Inner Circle App Submit', href: '/inner-circle-app-submit' },
  { label: 'Book Your Bonus', href: '/book-your-bonus' },
  { label: 'Policy Rescue', href: '/policy-rescue' },
  { label: 'FNG Policies', href: '/fng-policies' },
  { label: 'Sponsorships', href: '/sponsorships' },
  { label: 'Caller - Emani', href: '/caller-emani' },
  { label: 'Inner Circle Links', href: '/inner-circle-links' }
];

function absolute(href = '') {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  return `https://innercirclelink.com${href}`;
}

export default function KimoraAccessPage() {
  async function copyMaster() {
    try {
      await navigator.clipboard.writeText(MASTER_PASS);
      window.alert('Master access copied.');
    } catch {
      window.alert('Copy failed.');
    }
  }

  return (
    <AppShell title="Kimora Access Card">
      <div className="panel" style={{ maxWidth: 980 }}>
        <h3 style={{ marginTop: 0 }}>Kimora Access Card</h3>
        <p className="muted" style={{ marginTop: -2 }}>
          One place for your core links and master access.
        </p>

        <div className="panel" style={{ marginTop: 8 }}>
          <p style={{ margin: 0 }}><strong>Master Access:</strong> {MASTER_PASS}</p>
          <p className="muted" style={{ margin: '6px 0 0 0' }}>
            Use this for your own access points. Inner Circle member passwords remain individual.
          </p>
          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={copyMaster}>Copy Master Access</button>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 10, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Area</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {links.map((item) => (
                <tr key={item.href}>
                  <td>{item.label}</td>
                  <td>
                    <a href={absolute(item.href)} target="_blank" rel="noreferrer">
                      {absolute(item.href)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
