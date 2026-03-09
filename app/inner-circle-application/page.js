'use client';

import { useMemo, useState } from 'react';

const CALENDAR_URL = process.env.NEXT_PUBLIC_INNER_CIRCLE_CALENDAR_URL || '/inner-circle-booking';
const PREP_TRACK_URL = '/sponsorship-signup';
const BREANNA_TESTIMONIAL_EMBED = 'https://www.loom.com/embed/9242feaac8f1468da2db14ca57110f43';

const INITIAL = {
  fullName: '',
  email: '',
  phone: '',
  state: '',

  licensedStatus: '',
  activelyLooking: '',
  hoursPerWeek: '',
  consistentFollowUp: '',

  coachable: '',
  openToAi: '',
  businessOrInfo: '',

  financialReady: '',
  phoneInternetReady: '',
  whyNow: '',

  incomeGoal90: '',
  whatStopping: '',
  whatChanges: ''
};

const TEXTAREA_STYLE = { minHeight: 120 };

function Field({ label, required = false, children }) {
  return (
    <label style={{ display: 'grid', gap: 8, color: '#cbd5e1', alignSelf: 'start', padding: 10, border: '1px solid #172032', borderRadius: 10, background: '#030a17' }}>
      <strong style={{ fontSize: 14, lineHeight: 1.35, color: '#e5e7eb' }}>{label}{required ? ' *' : ''}</strong>
      {children}
    </label>
  );
}

function Divider() {
  return <div style={{ maxWidth: 1100, height: 1, background: 'linear-gradient(90deg,transparent,#334155,transparent)', margin: '8px auto' }} />;
}

export default function InnerCircleApplicationPage() {
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const update = (key, value) => setForm((s) => ({ ...s, [key]: value }));

  const canSubmit = useMemo(() => {
    return Object.values(form).every((v) => String(v || '').trim());
  }, [form]);

  const answeredCount = useMemo(
    () => Object.values(form).filter((v) => String(v || '').trim()).length,
    [form]
  );
  const totalQuestions = Object.keys(INITIAL).length;
  const progressPct = Math.round((answeredCount / totalQuestions) * 100);

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/inner-circle-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Could not submit application.');
        return;
      }

      setResult({
        qualified: Boolean(data?.qualified),
        score: Number(data?.score || 0),
        reason: data?.reason || '',
        applicationId: data?.id || ''
      });

      if (Boolean(data?.qualified)) {
        setForm(INITIAL);
      }
    } catch {
      setError('Could not submit application right now. Please retry.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="publicPage" style={{ background: '#030712', minHeight: '100vh', color: '#e5e7eb' }}>
      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #1f2937', background: 'linear-gradient(180deg,#0b1220 0%, #040814 100%)' }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill" style={{ background: '#312e81', color: '#e0e7ff' }}>Application Only</span>
            <span className="pill" style={{ background: '#1f2937', color: '#d1d5db' }}>Limited Access</span>
            <span className="pill" style={{ background: '#7c2d12', color: '#ffedd5' }}>Serious People Only</span>
          </div>

          <h1 style={{ fontSize: 'clamp(30px, 7vw, 42px)', lineHeight: 1.05, margin: 0, color: '#ffffff' }}>
            Plug Into a Real Growth System
          </h1>
          <p style={{ margin: 0, color: '#cbd5e1', maxWidth: 820, fontSize: 18 }}>
            60 leads, your own CRM, your own business phone number, AI-assisted follow-up, automation,
            mentorship, and accountability — built for people who are ready to execute.
          </p>

          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))' }}>
            <div className="pill" style={{ justifyContent: 'center', padding: 10, background: '#111827', color: '#f9fafb' }}>32 referral bonuses this month</div>
            <div className="pill" style={{ justifyContent: 'center', padding: 10, background: '#111827', color: '#f9fafb' }}>6 applications submitted this week</div>
            <div className="pill" style={{ justifyContent: 'center', padding: 10, background: '#111827', color: '#f9fafb' }}>Over $500K produced in recent months</div>
          </div>
        </div>
      </div>

      <Divider />

      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #334155', background: 'linear-gradient(180deg,#0a1324 0%, #081427 100%)' }}>
        <h3 style={{ marginTop: 0, color: '#fff' }}>Projected Inner Circle Economics</h3>
        <p style={{ marginTop: -4, color: '#cbd5e1' }}>
          Based on current real performance, a 60-lead cycle typically projects in the <strong style={{ color: '#f8fafc' }}>5x to 7x gross return range</strong> depending on follow-up execution.
        </p>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <div style={{ border: '1px solid #1e293b', borderRadius: 10, padding: 12, background: '#020617' }}>
            <small style={{ color: '#94a3b8' }}>Conservative Model</small>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#e2e8f0' }}>$6,000 Gross</div>
            <small style={{ color: '#94a3b8' }}>About 12 people moving forward from 60 leads</small>
          </div>
          <div style={{ border: '1px solid #1e293b', borderRadius: 10, padding: 12, background: '#020617' }}>
            <small style={{ color: '#94a3b8' }}>Based on Current Output</small>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#e2e8f0' }}>$9,150 Gross</div>
            <small style={{ color: '#94a3b8' }}>Scaled from current month-to-date performance</small>
          </div>
          <div style={{ border: '1px solid #1e293b', borderRadius: 10, padding: 12, background: '#020617' }}>
            <small style={{ color: '#94a3b8' }}>Return Expectation</small>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#e2e8f0' }}>5x to 7x Gross</div>
            <small style={{ color: '#94a3b8' }}>Results vary with consistency, follow-up, and execution.</small>
          </div>
        </div>
      </div>

      <Divider />

      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #1f2937', background: '#060d1a' }}>
        <h3 style={{ marginTop: 0, color: '#fff' }}>What You Actually Get Inside Inner Circle</h3>
        <p style={{ marginTop: -2, color: '#cbd5e1' }}>
          This isn’t just leads. It’s a full growth system built to help serious people move faster, stay organized, and create real revenue.
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
          {[
            '60 referral leads',
            'Your own CRM (lead pipeline + visibility)',
            'Business phone number',
            'AI follow-up + automation',
            'Mentorship + strategy support',
            'Social media direction',
            '$500 referral bonus potential',
            'Built-out business infrastructure',
            'Scripts + follow-up support',
            'Accountability + execution structure',
            'Pipeline visibility to track wins/leaks',
            'Appointment-booking momentum support'
          ].map((item) => (
            <li key={item} style={{ color: '#e2e8f0', lineHeight: 1.5 }}>{item}</li>
          ))}
        </ul>
        <p style={{ marginTop: 12, color: '#93c5fd', fontWeight: 600 }}>Only qualified applicants are invited to a one-on-one strategy call with Kimora.</p>
      </div>

      <Divider />

      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #1f2937', background: '#060d1a' }}>
        <h3 style={{ marginTop: 0, color: '#fff' }}>Real Testimonial — Dr. Breanna</h3>
        <p style={{ marginTop: -2, color: '#cbd5e1' }}>Proof from the field. Real experience, real movement.</p>
        <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', border: '1px solid #1f2937' }}>
          <iframe
            src={BREANNA_TESTIMONIAL_EMBED}
            title="Dr. Breanna Testimonial"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: '0' }}
          />
        </div>
        <blockquote style={{ margin: '10px 0 0', color: '#dbeafe', borderLeft: '3px solid #3b82f6', paddingLeft: 10 }}>
          “Inner Circle gave me structure, support, and momentum. I stopped guessing and started executing.” — <strong>Dr. Breanna</strong>
        </blockquote>
      </div>

      <Divider />

      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #1f2937', background: '#060d1a' }}>
        <h3 style={{ marginTop: 0, color: '#fff' }}>Inner Circle Qualification Application</h3>
        <p style={{ marginTop: -4, color: '#94a3b8' }}>Complete all questions. This is reviewed for fit, readiness, and execution capacity.</p>
        <p style={{ marginTop: 0, color: '#94a3b8' }}>Every submission is saved in the system, including applicants not yet qualified.</p>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <small style={{ color: '#93c5fd', fontWeight: 700 }}>Application Progress</small>
            <small style={{ color: '#cbd5e1' }}>{answeredCount}/{totalQuestions} completed • {progressPct}%</small>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: '#0f172a', border: '1px solid #1f2937', overflow: 'hidden' }}>
            <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg,#2563eb,#22c55e)', transition: 'width .25s ease' }} />
          </div>
        </div>

        <form className="settingsGrid" style={{ rowGap: 18, columnGap: 18, alignItems: 'start' }} onSubmit={submit}>
          <Field label="Full Name" required>
            <input value={form.fullName} onChange={(e) => update('fullName', e.target.value)} placeholder="Your full name" />
          </Field>

          <Field label="Email" required>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@email.com" />
          </Field>

          <Field label="Phone" required>
            <input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Best number" />
          </Field>

          <Field label="State" required>
            <input value={form.state} onChange={(e) => update('state', e.target.value.toUpperCase())} placeholder="TX" maxLength={2} />
          </Field>

          <Field label="1) Are you currently licensed, or are you looking to get started in the business?" required>
            <select value={form.licensedStatus} onChange={(e) => update('licensedStatus', e.target.value)}>
              <option value="">Select</option>
              <option value="licensed">Currently licensed</option>
              <option value="in_progress">Getting licensed</option>
              <option value="not_started">Not started yet</option>
            </select>
          </Field>

          <Field label="2) Are you actively looking to build real income, or just exploring?" required>
            <select value={form.activelyLooking} onChange={(e) => update('activelyLooking', e.target.value)}>
              <option value="">Select</option>
              <option value="real_income">Actively building real income now</option>
              <option value="exploring">Still exploring</option>
            </select>
          </Field>

          <Field label="3) How many hours/week can you realistically commit?" required>
            <input type="number" min={1} max={80} value={form.hoursPerWeek} onChange={(e) => update('hoursPerWeek', e.target.value)} placeholder="Example: 12" />
          </Field>

          <Field label="4) Are you comfortable following up consistently with leads?" required>
            <select value={form.consistentFollowUp} onChange={(e) => update('consistentFollowUp', e.target.value)}>
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>

          <Field label="5) Are you coachable and willing to follow a proven system?" required>
            <select value={form.coachable} onChange={(e) => update('coachable', e.target.value)}>
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>

          <Field label="6) Are you open to using AI and automation to move faster?" required>
            <select value={form.openToAi} onChange={(e) => update('openToAi', e.target.value)}>
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>

          <Field label="7) Are you looking for a real business, or just information?" required>
            <select value={form.businessOrInfo} onChange={(e) => update('businessOrInfo', e.target.value)}>
              <option value="">Select</option>
              <option value="business">A real business</option>
              <option value="info">Just information</option>
            </select>
          </Field>

          <Field label="8) If accepted, are you financially prepared to invest in growth and start now?" required>
            <select value={form.financialReady} onChange={(e) => update('financialReady', e.target.value)}>
              <option value="">Select</option>
              <option value="ready_now">Yes, ready now</option>
              <option value="soon">Need 2–4 weeks</option>
              <option value="not_ready">Not ready yet</option>
            </select>
          </Field>

          <Field label="9) Do you have phone + internet and can communicate consistently with prospects?" required>
            <select value={form.phoneInternetReady} onChange={(e) => update('phoneInternetReady', e.target.value)}>
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>

          <Field label="10) Why is now the right time for you to take this seriously?" required>
            <textarea rows={4} style={TEXTAREA_STYLE} value={form.whyNow} onChange={(e) => update('whyNow', e.target.value)} placeholder="Your reason" />
          </Field>

          <Field label="11) What is your income goal over the next 90 days?" required>
            <input value={form.incomeGoal90} onChange={(e) => update('incomeGoal90', e.target.value)} placeholder="Example: $20,000" />
          </Field>

          <Field label="12) What has been stopping you from reaching that goal on your own?" required>
            <textarea rows={4} style={TEXTAREA_STYLE} value={form.whatStopping} onChange={(e) => update('whatStopping', e.target.value)} placeholder="Biggest current blockers" />
          </Field>

          <Field label="13) What would change in your life if you had real systems and support behind you?" required>
            <textarea rows={4} style={TEXTAREA_STYLE} value={form.whatChanges} onChange={(e) => update('whatChanges', e.target.value)} placeholder="Expected impact" />
          </Field>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill" style={{ background: '#0f172a', color: '#cbd5e1' }}>Private application</span>
            <span className="pill" style={{ background: '#0f172a', color: '#cbd5e1' }}>Reviewed within 24 hours</span>
            <span className="pill" style={{ background: '#0f172a', color: '#cbd5e1' }}>No spam</span>
          </div>

          <div className="rowActions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="publicPrimaryBtn" disabled={!canSubmit || submitting}>
              {submitting ? 'Submitting Application...' : 'See If You Qualify'}
            </button>
          </div>
        </form>

        {error ? <p className="red">{error}</p> : null}

        {result ? (
          <div className="panel" style={{ marginTop: 12, borderColor: result.qualified ? '#16a34a' : '#f59e0b', background: result.qualified ? '#052e16' : '#451a03' }}>
            <h4 style={{ marginTop: 0, color: '#fff' }}>
              {result.qualified ? 'Qualified — Next Step Unlocked' : 'Application Received'}
            </h4>
            <p style={{ margin: 0, color: '#e5e7eb' }}>
              {result.qualified
                ? 'You are qualified for one-on-one strategy call review with Kimora. Book your call now to lock your spot.'
                : 'You are not qualified for one-on-one yet. We saved your information and can route you into a preparation track.'}
            </p>
            <small style={{ color: '#d1d5db', display: 'block', marginTop: 6 }}>Qualification score: {result.score}/8</small>
            <small style={{ color: '#d1d5db', display: 'block', marginTop: 2 }}>{result.reason}</small>

            <div style={{ marginTop: 10, padding: 10, border: '1px solid rgba(255,255,255,0.16)', borderRadius: 8 }}>
              <strong style={{ color: '#fff', fontSize: 13 }}>Next steps</strong>
              <ul style={{ margin: '6px 0 0 16px', color: '#e5e7eb' }}>
                {result.qualified ? (
                  <>
                    <li>Book your Inner Circle strategy call now.</li>
                    <li>Watch for confirmation details after booking.</li>
                    <li>Come prepared with your 90-day target and action plan.</li>
                  </>
                ) : (
                  <>
                    <li>Start the preparation track to strengthen readiness.</li>
                    <li>Maintain consistency and improve follow-up capacity.</li>
                    <li>Reapply after completing preparation milestones.</li>
                  </>
                )}
              </ul>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {result.qualified ? (
                <a
                  href={`${CALENDAR_URL}${result?.applicationId ? `${String(CALENDAR_URL).includes('?') ? '&' : '?'}id=${encodeURIComponent(result.applicationId)}` : ''}`}
                  className="publicPrimaryBtn"
                  style={{ textDecoration: 'none' }}
                >
                  Book 1-on-1 Strategy Call
                </a>
              ) : (
                <a href={PREP_TRACK_URL} className="publicPrimaryBtn" style={{ textDecoration: 'none' }}>
                  Start Preparation Track
                </a>
              )}
              <a href="/inner-circle-program" className="ghost" style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 8 }}>
                View Program Details
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
