'use client';

export default function ChampionsIncentiveGuidePage() {
  return (
    <main style={{ minHeight: '100vh', padding: 16, maxWidth: 1000, margin: '0 auto' }}>
      <div className="panel" style={{ borderColor: '#1d4ed8', background: '#07132b', display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="/champions-circle" className="ghost" style={{ textDecoration: 'none' }}>Home</a>
          <a href="/champions-circle/licensed" className="ghost" style={{ textDecoration: 'none' }}>Licensed</a>
          <a href="/champions-circle/inner-circle" className="ghost" style={{ textDecoration: 'none' }}>Inner Circle</a>
          <button type="button" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
        <h3 style={{ margin: 0 }}>Legacy Link Champions Circle — Official Incentive Guide (V1)</h3>
        <p className="muted" style={{ margin: 0 }}>Premium guide format. Use Print / Save PDF to export.</p>
      </div>

      <div className="panel" style={{ lineHeight: 1.65 }}>
        <h3>Legacy Credits</h3>
        <ul>
          <li>1 credit per $1 Net Placed AP</li>
          <li>4,000 credits per sponsorship policy (placed + paid)</li>
          <li>500 credits per verified community service hour</li>
          <li>Service credit cap: 4 hours/month (2,000 credits max for credit calculations)</li>
        </ul>

        <h3>Monthly Bonuses (Current Live Model)</h3>
        <p><strong>Production:</strong> 3% of monthly Net Placed AP, unlocked when agent reaches 8 sponsorship approvals in the month</p>
        <p><strong>Sponsorship policy bonus (approved/issued sponsorship policies):</strong> 5 = $1,000 • 10 = $3,000 • 15 = $5,000</p>
        <p><strong>Policy submission reward:</strong> $50 per policy submission</p>
        <p><strong>Community:</strong> 4h = recognition • 8h = $250/marketing credit • 12h = $500 + spotlight</p>

        <h3>Quarterly All-Around</h3>
        <p><strong>Bronze:</strong> $40k AP + 3 sponsorship + 6 service = $1,500</p>
        <p><strong>Silver:</strong> $75k AP + 5 sponsorship + 10 service = $3,500</p>
        <p><strong>Gold:</strong> $120k AP + 8 sponsorship + 12 service = $7,500</p>

        <h3>Calculation Integrity Rules</h3>
        <ul>
          <li>Only net placed AP counts</li>
          <li>Sponsorship credit requires placed + paid status</li>
          <li>Community hours must be verified</li>
          <li>Attribution uses internal agent IDs + carrier-specific agent IDs when available</li>
          <li>Chargebacks/rescissions/lapses can reverse prior payouts</li>
        </ul>
      </div>
    </main>
  );
}
