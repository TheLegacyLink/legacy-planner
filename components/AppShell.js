'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/mission-control', label: 'Mission Control' },
  { href: '/planner', label: 'Planner' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/content-ops', label: 'Content Ops' },
  { href: '/scoreboard', label: 'Scoreboard' },
  { href: '/settings', label: 'Settings' }
];

export default function AppShell({ title, children }) {
  const pathname = usePathname();
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🔗 Legacy Planner</div>
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
        <div>Kimora • Today</div>
        <div className="toggles">
          <button>Today</button><button>Week</button><button>Month</button>
        </div>
        <div>Sync: Live</div>
      </div>

      <main className="layout">
        <aside className="sidebar">
          <h3>Top 3 Today</h3>
          <ol>
            <li>Calls block</li>
            <li>Follow-up block</li>
            <li>Sponsor outreach</li>
          </ol>
          <h4>Alerts</h4>
          <p className="red">2 Action Now</p>
        </aside>

        <section className="content">
          <h1>{title}</h1>
          {children}
        </section>
      </main>
    </div>
  );
}
