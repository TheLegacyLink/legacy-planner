'use client';

import { useMemo, useState } from 'react';

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

function Field({ label, required = false, children }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <strong style={{ fontSize: 14 }}>{label}{required ? ' *' : ''}</strong>
      {children}
    </label>
  );
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
        reason: data?.reason || ''
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

          <h1 style={{ fontSize: 42, lineHeight: 1.05, margin: 0, color: '#ffffff' }}>
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

      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #1f2937', background: '#060d1a' }}>
        <h3 style={{ marginTop: 0, color: '#fff' }}>What You Get Inside Inner Circle</h3>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, color: '#d1d5db' }}>
          <li>60 leads each month</li>
          <li>Your own CRM system + lead pipeline structure</li>
          <li>Your own business phone number</li>
          <li>AI support for follow-up and objection handling</li>
          <li>Automation that keeps conversations moving</li>
          <li>Strategy support, accountability, and producer-level guidance</li>
          <li>Social media / branding direction</li>
          <li>A real system to submit referrals and track production</li>
        </ul>
        <p className="muted" style={{ marginTop: 10 }}>Only qualified applicants are invited to a one-on-one strategy call with Kimora.</p>
      </div>

      <div className="panel" style={{ maxWidth: 1100, border: '1px solid #1f2937', background: '#060d1a' }}>
        <h3 style={{ marginTop: 0, color: '#fff' }}>Inner Circle Qualification Application</h3>
        <p className="muted" style={{ marginTop: -4 }}>Complete all questions. This is reviewed for fit, readiness, and execution capacity.</p>

        <form className="settingsGrid" onSubmit={submit}>
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
            <textarea rows={4} value={form.whyNow} onChange={(e) => update('whyNow', e.target.value)} placeholder="Your reason" />
          </Field>

          <Field label="11) What is your income goal over the next 90 days?" required>
            <input value={form.incomeGoal90} onChange={(e) => update('incomeGoal90', e.target.value)} placeholder="Example: $20,000" />
          </Field>

          <Field label="12) What has been stopping you from reaching that goal on your own?" required>
            <textarea rows={4} value={form.whatStopping} onChange={(e) => update('whatStopping', e.target.value)} placeholder="Biggest current blockers" />
          </Field>

          <Field label="13) What would change in your life if you had real systems and support behind you?" required>
            <textarea rows={4} value={form.whatChanges} onChange={(e) => update('whatChanges', e.target.value)} placeholder="Expected impact" />
          </Field>

          <div className="rowActions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="publicPrimaryBtn" disabled={!canSubmit || submitting}>
              {submitting ? 'Submitting Application...' : 'See If You Qualify'}
            </button>
          </div>
        </form>

        {error ? <p className="red">{error}</p> : null}

        {result ? (
          <div className="panel" style={{ marginTop: 10, borderColor: result.qualified ? '#16a34a' : '#f59e0b', background: result.qualified ? '#052e16' : '#451a03' }}>
            <h4 style={{ marginTop: 0, color: '#fff' }}>
              {result.qualified ? 'Qualified — Next Step Unlocked' : 'Application Received'}
            </h4>
            <p style={{ margin: 0, color: '#e5e7eb' }}>
              {result.qualified
                ? 'You are qualified for one-on-one strategy call review with Kimora. Our team will contact you with next steps.'
                : 'Thank you. Your application was received. If needed, we may route you through preparation steps before one-on-one review.'}
            </p>
            <small style={{ color: '#d1d5db' }}>Qualification score: {result.score}/8</small>
          </div>
        ) : null}
      </div>
    </main>
  );
}
