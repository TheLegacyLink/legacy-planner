'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

const STORAGE_KEY = 'legacy-planner-mission-control-v2';

const TEAM_SEED = [
  { name: 'Kimora', calls: 22, followUps: 35, appointments: 6, apps: 2 },
  { name: 'Ari', calls: 18, followUps: 28, appointments: 4, apps: 1 },
  { name: 'Noel', calls: 12, followUps: 17, appointments: 3, apps: 1 },
  { name: 'Jade', calls: 8, followUps: 11, appointments: 1, apps: 0 }
];

const TARGETS = {
  calls: 100,
  followUps: 200,
  appointments: 40,
  apps: 15
};

const DEFAULT_PREVIEW = `FRIDAY LEADERBOARD + RECOGNITION
🏆 Top Sponsorship Referrals:
📄 Top Apps Submitted:
🌟 Most Improved:

Celebrate winners. Study what worked. Run it back stronger next week.`;

function getPaceStatus(value, target) {
  const pct = value / target;
  if (pct >= 0.9) return 'On Pace';
  if (pct >= 0.65) return 'At Risk';
  return 'Off Pace';
}

export default function MissionControl() {
  const [team, setTeam] = useState(TEAM_SEED);
  const [fridayPreview, setFridayPreview] = useState(DEFAULT_PREVIEW);
  const [savedStamp, setSavedStamp] = useState('');
  const [form, setForm] = useState({
    agent: 'Kimora',
    calls: 0,
    followUps: 0,
    appointments: 0,
    apps: 0
  });

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.team?.length) setTeam(parsed.team);
      if (typeof parsed.fridayPreview === 'string') setFridayPreview(parsed.fridayPreview);
      if (parsed.savedStamp) setSavedStamp(parsed.savedStamp);
    } catch {
      // Ignore bad local state
    }
  }, []);

  const totals = useMemo(
    () =>
      team.reduce(
        (acc, row) => ({
          calls: acc.calls + row.calls,
          followUps: acc.followUps + row.followUps,
          appointments: acc.appointments + row.appointments,
          apps: acc.apps + row.apps
        }),
        { calls: 0, followUps: 0, appointments: 0, apps: 0 }
      ),
    [team]
  );

  const cards = useMemo(
    () => [
      {
        title: 'Today Activity',
        value: totals.calls,
        target: TARGETS.calls,
        status: getPaceStatus(totals.calls, TARGETS.calls)
      },
      {
        title: 'Follow-ups Sent',
        value: totals.followUps,
        target: TARGETS.followUps,
        status: getPaceStatus(totals.followUps, TARGETS.followUps)
      },
      {
        title: 'Appointments Set',
        value: totals.appointments,
        target: TARGETS.appointments,
        status: getPaceStatus(totals.appointments, TARGETS.appointments)
      },
      {
        title: 'Submitted Apps',
        value: totals.apps,
        target: TARGETS.apps,
        status: getPaceStatus(totals.apps, TARGETS.apps)
      }
    ],
    [totals]
  );

  const alerts = useMemo(() => {
    const nowHour = new Date().getHours();
    const noActivity = totals.calls + totals.followUps + totals.appointments + totals.apps === 0;

    return [
      {
        label: '11:00 AM No-Activity Check',
        state: nowHour < 11 ? 'Pending' : noActivity ? 'Action Now' : 'Clear'
      },
      {
        label: '1:00 PM Pace Check',
        state:
          nowHour < 13
            ? 'Pending'
            : cards.every((card) => card.status !== 'Off Pace')
            ? 'On Track'
            : 'Action Now'
      },
      {
        label: '9:00 PM Closeout Check',
        state: nowHour < 21 ? 'Pending' : cards.some((card) => card.status === 'Off Pace') ? 'Review Needed' : 'Clear'
      }
    ];
  }, [cards, totals]);

  const saveState = (nextTeam = team, nextPreview = fridayPreview) => {
    const stamp = new Date().toLocaleString('en-US', { hour12: true });
    setSavedStamp(stamp);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        team: nextTeam,
        fridayPreview: nextPreview,
        savedStamp: stamp
      })
    );
  };

  const handleLogActivity = (event) => {
    event.preventDefault();

    const nextTeam = team.map((row) =>
      row.name !== form.agent
        ? row
        : {
            ...row,
            calls: row.calls + Number(form.calls || 0),
            followUps: row.followUps + Number(form.followUps || 0),
            appointments: row.appointments + Number(form.appointments || 0),
            apps: row.apps + Number(form.apps || 0)
          }
    );

    setTeam(nextTeam);
    setForm({ ...form, calls: 0, followUps: 0, appointments: 0, apps: 0 });
    saveState(nextTeam, fridayPreview);
  };

  const handleSavePreview = () => {
    saveState(team, fridayPreview);
  };

  return (
    <AppShell title="Mission Control">
      <div className="grid4">
        {cards.map((card) => (
          <div className="card" key={card.title}>
            <p>{card.title}</p>
            <h2>
              {card.value}/{card.target}
            </h2>
            <span className={`pill ${card.status.replace(/\s/g, '').toLowerCase()}`}>{card.status}</span>
          </div>
        ))}
      </div>

      <div className="split">
        <div className="panel">
          <div className="panelRow">
            <h3>Team Pace</h3>
            <span className="muted">Live Model • API-ready shape</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Calls</th>
                <th>Follow-ups</th>
                <th>Apps</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {team.map((row) => {
                const status = getPaceStatus(row.calls, 25);
                return (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{row.calls}</td>
                    <td>{row.followUps}</td>
                    <td>{row.apps}</td>
                    <td>
                      <span className={`pill ${status.replace(/\s/g, '').toLowerCase()}`}>{status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h3>Alert Engine</h3>
          <ul className="alerts">
            {alerts.map((alert) => (
              <li key={alert.label}>
                <span>{alert.label}</span>
                <strong className={alert.state.includes('Action') || alert.state.includes('Review') ? 'red' : 'green'}>
                  {alert.state}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <h3>Log Activity</h3>
          <form className="logForm" onSubmit={handleLogActivity}>
            <label>
              Agent
              <select
                value={form.agent}
                onChange={(e) => setForm((prev) => ({ ...prev, agent: e.target.value }))}
              >
                {team.map((row) => (
                  <option key={row.name} value={row.name}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Calls
              <input
                type="number"
                min="0"
                value={form.calls}
                onChange={(e) => setForm((prev) => ({ ...prev, calls: e.target.value }))}
              />
            </label>
            <label>
              Follow-ups
              <input
                type="number"
                min="0"
                value={form.followUps}
                onChange={(e) => setForm((prev) => ({ ...prev, followUps: e.target.value }))}
              />
            </label>
            <label>
              Appointments
              <input
                type="number"
                min="0"
                value={form.appointments}
                onChange={(e) => setForm((prev) => ({ ...prev, appointments: e.target.value }))}
              />
            </label>
            <label>
              Apps
              <input
                type="number"
                min="0"
                value={form.apps}
                onChange={(e) => setForm((prev) => ({ ...prev, apps: e.target.value }))}
              />
            </label>
            <button type="submit">Save KPI Log</button>
          </form>
        </div>

        <div className="panel">
          <div className="panelRow">
            <h3>Friday Preview</h3>
            <button className="ghost" onClick={handleSavePreview}>
              Save Preview
            </button>
          </div>
          <textarea value={fridayPreview} onChange={(e) => setFridayPreview(e.target.value)} />
          <p className="muted">{savedStamp ? `Last saved: ${savedStamp}` : 'Not saved yet'}</p>
        </div>
      </div>
    </AppShell>
  );
}
