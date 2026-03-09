'use client';

import Image from 'next/image';

const KIMORA_IMAGE = process.env.NEXT_PUBLIC_KIMORA_PROGRAM_IMAGE || '/kimora-profile.png';
const TESTIMONIALS = [
  {
    name: 'Dr. Breanna',
    embed: 'https://www.loom.com/embed/9242feaac8f1468da2db14ca57110f43',
    quote: 'Inner Circle gave me structure, support, and momentum. I stopped guessing and started executing.'
  },
  {
    name: 'Testimonial #2',
    embed: 'https://www.loom.com/embed/d2a24146f39e4cdda4d34cee71f9a58d',
    quote: 'Real support. Real execution. Real movement.'
  }
];

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

          <h1 style={{ margin: 0, fontSize: 'clamp(30px, 7vw, 40px)', lineHeight: 1.08, color: '#fff' }}>Inner Circle Program Details</h1>
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
              style={{ width: '100%', height: 360, objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
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
        <h3 style={{ marginTop: 0, color: '#fff' }}>What You Actually Get Inside Inner Circle</h3>
        <p style={{ marginTop: -2, color: '#cbd5e1' }}>
          This isn’t just leads. It’s a full growth system built to help serious people move faster, stay organized, and create real revenue.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 12 }}>
          {[
            ['60 Referral Leads', 'Consistent opportunity flow designed to keep your pipeline active and producing.'],
            ['Your Own CRM with Full Pipeline Visibility', 'Track every lead, every conversation, and every opportunity in one place.'],
            ['Business Phone Number', 'A professional business line for cleaner communication and stronger follow-up.'],
            ['AI Follow-Up + Automation', 'Use AI and automation to keep momentum high and improve speed-to-conversation.'],
            ['Mentorship + Strategy Support', 'Direct support and strategic guidance from people who understand production.'],
            ['Social Media Direction', 'Position yourself better online with support around branding, messaging, and content direction.'],
            ['First Policy Payback Bonus', 'Earn $1,200 on your first personally produced, paid-and-placed policy, then $500 on every paid-and-placed policy after that.'],
            ['Built-Out Business Infrastructure', 'Plug into systems, workflows, and backend support already set up to help you move faster.'],
            ['Scripts + Follow-Up Support', 'Know what to say, how to respond, and how to move conversations toward action.'],
            ['Accountability + Execution Structure', 'Stay focused, stay active, and stay moving with a structure built for consistency.'],
            ['Pipeline Visibility to Track Opportunities and Leaks', 'Quickly identify where opportunities are progressing or leaking.'],
            ['Appointment-Booking Momentum Support', 'Increase the number of real conversations happening with smarter follow-up.']
          ].map(([title, desc]) => (
            <div key={title} style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 12, background: '#030a17' }}>
              <strong style={{ color: '#f8fafc', display: 'block', marginBottom: 4 }}>{title}</strong>
              <small style={{ color: '#94a3b8' }}>{desc}</small>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 12, color: '#93c5fd', fontWeight: 600 }}>Qualified applicants will be invited to a one-on-one strategy call with Kimora.</p>
      </div>

      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #1e293b', background: '#071126' }}>
        <h3 style={{ marginTop: 0, color: '#fff' }}>What This Can Realistically Look Like</h3>
        <p style={{ marginTop: -2, color: '#cbd5e1' }}>
          Based on our current internal numbers, a 60-lead cycle can realistically produce around 12 people moving forward.
          At $500 per referral, that creates the potential for approximately $6,000 in gross revenue.
        </p>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <div className="pill" style={{ justifyContent: 'center', padding: 12, background: '#111827', color: '#f9fafb' }}>Conservative model: $6,000 gross potential</div>
          <div className="pill" style={{ justifyContent: 'center', padding: 12, background: '#111827', color: '#f9fafb' }}>Projected model range: 5x–7x gross</div>
          <div className="pill" style={{ justifyContent: 'center', padding: 12, background: '#111827', color: '#f9fafb' }}>32 referral bonuses this month</div>
          <div className="pill" style={{ justifyContent: 'center', padding: 12, background: '#111827', color: '#f9fafb' }}>6 applications submitted this week</div>
        </div>
        <small style={{ display: 'block', marginTop: 8, color: '#94a3b8' }}>
          Results vary based on consistency, responsiveness, follow-up, and execution.
        </small>
      </div>

      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #1e293b', background: '#071126' }}>
        <h3 style={{ marginTop: 0, color: '#fff' }}>Real Movement. Not Theory.</h3>
        <p style={{ margin: 0, color: '#cbd5e1' }}>
          This is not just an idea. This is a working system. The combination of lead flow, AI-assisted follow-up,
          automation, and real support is helping serious people move faster.
        </p>
      </div>

      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #1e293b', background: '#071126' }}>
        <h3 style={{ marginTop: 0, color: '#fff' }}>Real Results. Real People.</h3>
        <p style={{ marginTop: -2, color: '#cbd5e1' }}>Proof from the field. Real experience, real movement.</p>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
          {TESTIMONIALS.map((t) => (
            <div key={t.embed} style={{ border: '1px solid #1f2937', borderRadius: 12, padding: 10, background: '#030a17' }}>
              <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 10, overflow: 'hidden', border: '1px solid #1f2937' }}>
                <iframe
                  src={t.embed}
                  title={`${t.name} Testimonial`}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: '0' }}
                />
              </div>
              <blockquote style={{ margin: '10px 0 0', color: '#dbeafe', borderLeft: '3px solid #3b82f6', paddingLeft: 10 }}>
                “{t.quote}” — <strong>{t.name}</strong>
              </blockquote>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #854d0e', background: 'linear-gradient(180deg,#1f1302 0%, #140d02 100%)' }}>
        <h3 style={{ marginTop: 0, color: '#fff' }}>First Policy Payback Bonus</h3>
        <p style={{ margin: 0, color: '#fde68a', fontWeight: 700, fontSize: 17 }}>
          Close your first personally produced, paid-and-placed policy and earn $1,200. Every paid-and-placed policy after that earns $500.
          One close can cover your full entry.
        </p>
        <small style={{ display: 'block', marginTop: 8, color: '#fcd34d' }}>
          Active member status requires consistent follow-up, attendance on core coaching calls, and execution of assigned action steps.
          Bonus applies only to active members in good standing. Incomplete, canceled, charged-back, or non-placed business does not qualify.
        </small>
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

      <div className="publicStickyBar" style={{ maxWidth: 1100 }}>
        <strong style={{ color: '#0f172a', fontSize: 13 }}>Ready to move?</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/inner-circle-application">Apply</a>
          <a href="/inner-circle-booking">Book Call</a>
        </div>
      </div>
    </main>
  );
}
