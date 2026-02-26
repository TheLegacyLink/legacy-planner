'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const tabs = [
  { href: '/mission-control', label: 'Mission Control' },
  { href: '/sponsorship-ops', label: 'Sponsorship Ops' },
  { href: '/contacts-vault', label: 'Contacts Vault' },
  { href: '/bonus-bookings', label: 'Bonus Bookings' },
  { href: '/policy-rescue', label: 'Policy Rescue' },
  { href: '/planner', label: 'Planner' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/content-ops', label: 'Content Ops' },
  { href: '/scoreboard', label: 'Scoreboard' },
  { href: '/licensed-agents', label: 'Licensed Agents' },
  { href: '/sponsorships', label: 'Sponsorships' },
  { href: '/sponsorship-review', label: 'Sponsorship Review' },
  { href: '/lead-router', label: 'Lead Router' },
  { href: '/sponsorship-signup', label: 'Sponsor Signup' },
  { href: '/inner-circle-app-submit', label: 'App Submit' },
  { href: '/policy-payouts', label: 'Policy Payouts' },
  { href: '/payout-queue', label: 'Payout Queue' },
  { href: '/kimora-access', label: 'Kimora Access' },
  { href: '/inner-circle-links', label: 'Inner Circle Links' },
  { href: '/sponsorship-booking', label: 'Booking Hub' },
  { href: '/fng-policies', label: 'F&G Policies' },
  { href: '/badges', label: 'Badges' },
  { href: '/settings', label: 'Settings' }
];

const OWNER_ACCESS_KEY = 'legacy_planner_owner_access_v1';
const OWNER_PASSCODE = 'KimoraOnly!2026';

export default function AppShell({ title, children }) {
  const pathname = usePathname();
  const [accessGranted, setAccessGranted] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passError, setPassError] = useState('');

  useEffect(() => {
    try {
      if (localStorage.getItem(OWNER_ACCESS_KEY) === 'ok') {
        setAccessGranted(true);
      }
    } catch {
      // ignore storage access issues
    }
  }, []);

  function unlockOwnerAccess() {
    if (passcodeInput.trim() === OWNER_PASSCODE) {
      localStorage.setItem(OWNER_ACCESS_KEY, 'ok');
      setAccessGranted(true);
      setPassError('');
      return;
    }
    setPassError('Incorrect owner passcode.');
  }

  function lockOwnerAccess() {
    localStorage.removeItem(OWNER_ACCESS_KEY);
    setAccessGranted(false);
  }

  if (!accessGranted) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#080f1f', color: '#fff', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 440, border: '1px solid #334155', borderRadius: 14, padding: 22, background: '#0f172a' }}>
          <h2 style={{ marginTop: 0 }}>Owner Access Required</h2>
          <p style={{ color: '#cbd5e1' }}>This dashboard is restricted to Kimora only.</p>
          <input
            type="password"
            value={passcodeInput}
            onChange={(e) => setPasscodeInput(e.target.value)}
            placeholder="Owner passcode"
            style={{ width: '100%', marginBottom: 10 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') unlockOwnerAccess();
            }}
          />
          <button type="button" onClick={unlockOwnerAccess}>Unlock Dashboard</button>
          {passError ? <p style={{ color: '#fca5a5' }}>{passError}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brandWrap">
          <div className="brandMark">🔗</div>
          <div>
            <div className="brand">Legacy Planner</div>
            <small className="brandSub">The Legacy Link • Mission OS</small>
          </div>
        </div>

        <nav className="tabs">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`tab ${pathname === tab.href ? 'active' : ''}`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="actions">
          <button>+ New Task</button>
          <button>Log KPI</button>
          <button>Approve Post</button>
          <button type="button" className="ghost" onClick={lockOwnerAccess}>Lock</button>
        </div>
      </header>

      <div className="subbar">
        <div className="subbarLeft">Kimora • Today • Inner Circle</div>
        <div className="toggles">
          <button>Today</button>
          <button>Week</button>
          <button>Month</button>
        </div>
        <div className="subbarRight">Sync: Live</div>
      </div>

      <div className="execStrip">
        <div>
          <span className="execLabel">Priority</span>
          <strong>Referral + Application Production</strong>
        </div>
        <div>
          <span className="execLabel">Focus Window</span>
          <strong>Power Hour + Follow-up Blocks</strong>
        </div>
        <div>
          <span className="execLabel">Standard</span>
          <strong>No Zero Activity Days</strong>
        </div>
      </div>

      <main className="layout">
        <aside className="sidebar">
          <h3>Top 3 Today</h3>
          <ol>
            <li>Sponsorship asks before noon</li>
            <li>Applications submitted by 6 PM</li>
            <li>9 PM closeout accountability</li>
          </ol>

          <h4>Standards</h4>
          <ul className="sideMeta">
            <li>Any activity = On Pace</li>
            <li>Missed day = corrective plan</li>
            <li>Leaderboard updates every minute</li>
          </ul>
        </aside>

        <section className="content">
          <h1>{title}</h1>
          {children}
        </section>
      </main>
    </div>
  );
}
