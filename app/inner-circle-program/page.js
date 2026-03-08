'use client';

import Image from 'next/image';

const KIMORA_IMAGE = process.env.NEXT_PUBLIC_KIMORA_PROGRAM_IMAGE || '/kimora-profile.jpg';

export default function InnerCircleProgramPage() {
  return (
    <main className="publicPage" style={{ background: '#020617', minHeight: '100vh', color: '#e2e8f0' }}>
      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #1e293b', background: 'linear-gradient(180deg,#0b1220 0%, #0a1930 100%)' }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill" style={{ background: '#4338ca', color: '#e0e7ff' }}>Inner Circle</span>
            <span className="pill" style={{ background: '#0f766e', color: '#ccfbf1' }}>High Performance</span>
            <span className="pill" style={{ background: '#9a3412', color: '#ffedd5' }}>Execution Focused</span>
          </div>

          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.08, color: '#fff' }}>Inner Circle Program Details</h1>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: 18, maxWidth: 860 }}>
            This is a growth system for serious people ready to build with structure, speed, and accountability.
            You are not buying random leads — you are plugging into infrastructure.
          </p>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #1e293b', background: '#071126' }}>
        <h3 style={{ marginTop: 0, color: '#fff' }}>Founder Spotlight — Kimora Link</h3>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', alignItems: 'start' }}>
          <div style={{ border: '1px solid #1f2937', borderRadius: 12, overflow: 'hidden', background: '#030a17' }}>
            <Image
              src={KIMORA_IMAGE}
              alt="Kimora Link"
              width={900}
              height={1200}
              style={{ width: '100%', height: 340, objectFit: 'cover', display: 'block' }}
            />
          </div>

          <div>
            <p style={{ marginTop: 0, color: '#dbeafe', fontSize: 17, lineHeight: 1.45 }}>
              You’re learning from active production and real execution — not theory.
            </p>

            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
              {[
                ['Over $500K produced', 'In recent months across active production.'],
                ['32 referral bonuses', 'Generated this month through system execution.'],
                ['6 applications submitted', 'Already submitted this week.'],
                ['5x–7x gross model range', 'Based on current output + follow-up execution.']
              ].map(([title, desc]) => (
                <div key={title} style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 12, background: '#030a17' }}>
                  <strong style={{ color: '#f8fafc', display: 'block', marginBottom: 4 }}>{title}</strong>
                  <small style={{ color: '#94a3b8' }}>{desc}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #1e293b', background: '#071126' }}>
        <h3 style={{ marginTop: 0, color: '#fff' }}>What You Get</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 12 }}>
          {[
            ['60 Leads', 'Consistent lead flow to keep your pipeline active.'],
            ['Your Own CRM', 'Track every prospect and stop money from leaking.'],
            ['Business Phone Number', 'Professional communication setup for follow-up.'],
            ['AI + Automation', 'Keep momentum and improve speed-to-conversation.'],
            ['Mentorship + Strategy', 'Direct guidance for execution and production.'],
            ['Social Media Direction', 'Positioning and content support for growth.']
          ].map(([title, desc]) => (
            <div key={title} style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 12, background: '#030a17' }}>
              <strong style={{ color: '#f8fafc', display: 'block', marginBottom: 4 }}>{title}</strong>
              <small style={{ color: '#94a3b8' }}>{desc}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #1e293b', background: '#071126' }}>
        <h3 style={{ marginTop: 0, color: '#fff' }}>What We’re Producing</h3>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <div className="pill" style={{ justifyContent: 'center', padding: 12, background: '#111827', color: '#f9fafb' }}>32 referral bonuses this month</div>
          <div className="pill" style={{ justifyContent: 'center', padding: 12, background: '#111827', color: '#f9fafb' }}>6 applications submitted this week</div>
          <div className="pill" style={{ justifyContent: 'center', padding: 12, background: '#111827', color: '#f9fafb' }}>Over $500K produced in recent months</div>
          <div className="pill" style={{ justifyContent: 'center', padding: 12, background: '#111827', color: '#f9fafb' }}>Projected 5x–7x gross return range</div>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #1e293b', background: '#071126' }}>
        <h3 style={{ marginTop: 0, color: '#fff' }}>Who This Is For</h3>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
          {[
            'Action-takers who are ready to execute daily',
            'People open to structure, coaching, and accountability',
            'People committed to follow-up, consistency, and growth'
          ].map((line) => <li key={line} style={{ color: '#e2e8f0' }}>{line}</li>)}
        </ul>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <a href="/inner-circle-application" className="publicPrimaryBtn" style={{ textDecoration: 'none' }}>Apply / Continue Application</a>
          <a href="/inner-circle-booking" className="ghost" style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 8 }}>Book Inner Circle Call</a>
        </div>
      </div>
    </main>
  );
}
