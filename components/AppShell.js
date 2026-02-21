'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/mission-control', label: 'Mission Control' },
  { href: '/policy-rescue', label: 'Policy Rescue' },
  { href: '/planner', label: 'Planner' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/content-ops', label: 'Content Ops' },
  { href: '/scoreboard', label: 'Scoreboard' },
  { href: '/licensed-agents', label: 'Licensed Agents' },
  { href: '/sponsorships', label: 'Sponsorships' },
  { href: '/sponsorship-signup', label: 'Sponsor Signup' },
  { href: '/inner-circle-app-submit', label: 'App Submit' },
  { href: '/inner-circle-links', label: 'Inner Circle Links' },
  { href: '/fng-policies', label: 'F&G Policies' },
  { href: '/badges', label: 'Badges' },
  { href: '/settings', label: 'Settings' }
];

export default function AppShell({ title, children }) {
  const pathname = usePathname();

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
