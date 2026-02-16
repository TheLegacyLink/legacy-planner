import AppShell from '../../components/AppShell';

const cards = [
  ['Calls Made', '0/100', 'Off Pace'],
  ['Follow-ups Sent', '0/200', 'Off Pace'],
  ['Appointments Set', '0/40', 'Off Pace'],
  ['Apps + Referrals', '0/15 • 0/25', 'Off Pace']
];

export default function MissionControl() {
  return (
    <AppShell title="Mission Control">
      <div className="grid4">
        {cards.map(([title, value, status]) => (
          <div className="card" key={title}>
            <p>{title}</p>
            <h2>{value}</h2>
            <span className="red">{status}</span>
          </div>
        ))}
      </div>

      <div className="split">
        <div className="panel">
          <h3>Team Pace</h3>
          <table>
            <thead><tr><th>Agent</th><th>Calls</th><th>Apps</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>No data yet</td><td>-</td><td>-</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3>Alerts</h3>
          <ul>
            <li>No activity by 11:00 AM</li>
            <li>Pace check at 1:00 PM</li>
            <li>Closeout check at 9:00 PM</li>
          </ul>
        </div>
      </div>

      <div className="panel">
        <h3>Friday Post Preview</h3>
        <textarea readOnly value={'FRIDAY LEADERBOARD + RECOGNITION\n🏆 Top Sponsorship Referrals:\n📄 Top Apps Submitted:\n🌟 Most Improved:\n\nCelebrate winners. Study what worked. Run it back stronger next week.'} />
      </div>
    </AppShell>
  );
}
