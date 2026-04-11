'use client';
import { useState, useEffect } from 'react';

const GOLD = '#D4AF37';
const BG = '#0E131B';
const CARD = '#141B27';
const CARD2 = '#1A2236';
const TEXT = '#F2F2F2';
const MUTED = '#7B8494';
const BORDER = 'rgba(212,175,55,0.22)';
const DANGER = '#F87171';
const SUCCESS = '#4ADE80';
const WARN = '#FBBF24';

function Badge({ status }) {
  const isReviewed = status === 'reviewed';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: isReviewed ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)',
      border: `1px solid ${isReviewed ? SUCCESS : WARN}44`,
      color: isReviewed ? SUCCESS : WARN,
      borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600,
    }}>
      {isReviewed ? '✓ Reviewed' : '⏳ Pending'}
    </span>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
      padding: '18px 22px', flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      <div style={{ color: color || GOLD, fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 14 }}>
      <span style={{ color: MUTED, minWidth: 160, flexShrink: 0 }}>{label}</span>
      <span style={{ color: TEXT }}>{value}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ color: GOLD, fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, borderBottom: `1px solid ${BORDER}`, paddingBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function AdminPage() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/nlg-submissions');
      const data = await res.json();
      setSubmissions(Array.isArray(data) ? data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) : []);
    } catch { setSubmissions([]); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleStatus(sub) {
    setBusy(true);
    const newStatus = sub.status === 'reviewed' ? 'pending' : 'reviewed';
    try {
      const res = await fetch(`/api/nlg-submissions/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
        if (selected?.id === updated.id) setSelected(updated);
      }
    } catch { }
    setBusy(false);
  }

  async function deleteSubmission(sub) {
    setBusy(true);
    try {
      await fetch(`/api/nlg-submissions/${sub.id}`, { method: 'DELETE' });
      setSubmissions(prev => prev.filter(s => s.id !== sub.id));
      if (selected?.id === sub.id) setSelected(null);
      setDelConfirm(null);
    } catch { }
    setBusy(false);
  }

  const total = submissions.length;
  const pending = submissions.filter(s => s.status === 'pending').length;
  const reviewed = submissions.filter(s => s.status === 'reviewed').length;

  // ─── Detail view ──────────────────────────────────────────────────────────
  if (selected) {
    const s = selected;
    let ownerInfo = {};
    let primaryBenes = [];
    let contingentBenes = [];
    let existingPolicies = [];
    try { ownerInfo = JSON.parse(s.owner_info || '{}'); } catch { }
    try { primaryBenes = JSON.parse(s.primary_beneficiaries || '[]'); } catch { }
    try { contingentBenes = JSON.parse(s.contingent_beneficiaries || '[]'); } catch { }
    try { existingPolicies = JSON.parse(s.existing_policies || '[]'); } catch { }

    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px 80px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>
              ← Back
            </button>
            <div style={{ flex: 1, fontSize: 18, fontWeight: 700, color: TEXT }}>
              {s.first_name} {s.last_name}
            </div>
            <Badge status={s.status} />
            <button
              onClick={() => toggleStatus(s)} disabled={busy}
              style={{
                background: s.status === 'reviewed' ? 'rgba(251,191,36,0.1)' : 'rgba(74,222,128,0.1)',
                border: `1px solid ${s.status === 'reviewed' ? WARN : SUCCESS}44`,
                color: s.status === 'reviewed' ? WARN : SUCCESS,
                borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              {s.status === 'reviewed' ? 'Mark Pending' : 'Mark Reviewed'}
            </button>
            <button
              onClick={() => setDelConfirm(s)}
              style={{ background: 'rgba(248,113,113,0.1)', border: `1px solid ${DANGER}44`, color: DANGER, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}
            >
              🗑 Delete
            </button>
          </div>

          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '24px 28px' }}>
            <Section title="Personal Information">
              <DetailRow label="Carrier" value="National Life Group" />
              <DetailRow label="Full Name" value={[s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ')} />
              <DetailRow label="Date of Birth" value={s.date_of_birth} />
              <DetailRow label="Gender" value={s.gender} />
              <DetailRow label="SSN" value={s.ssn} />
              <DetailRow label="Phone" value={s.phone} />
              <DetailRow label="Email" value={s.email} />
              <DetailRow label="Address" value={[s.street_address, s.city, s.state, s.zip].filter(Boolean).join(', ')} />
              <DetailRow label="Marital Status" value={s.marital_status} />
              <DetailRow label="Citizenship" value={s.citizenship} />
              <DetailRow label="Visa Type" value={s.visa_type} />
              <DetailRow label="Country of Citizenship" value={s.country_of_citizenship} />
              <DetailRow label="Driver's License" value={s.drivers_license_number} />
            </Section>

            <Section title="Employment & Income">
              <DetailRow label="Employer" value={s.employer} />
              <DetailRow label="Occupation" value={s.occupation} />
              <DetailRow label="Work Phone" value={s.work_phone} />
              <DetailRow label="Employer Address" value={[s.employer_street, s.employer_city, s.employer_state, s.employer_zip].filter(Boolean).join(', ')} />
              <DetailRow label="Annual Income" value={s.annual_income ? `$${s.annual_income}` : ''} />
              <DetailRow label="Net Worth" value={s.net_worth ? `$${s.net_worth}` : ''} />
            </Section>

            <Section title="Coverage">
              <DetailRow label="Product" value={s.insurance_type} />
              <DetailRow label="Membership Level" value={s.coverage_purpose} />
              <DetailRow label="Max Coverage" value={s.face_amount} />
              <DetailRow label="Funding" value={s.payment_frequency} />
            </Section>

            <Section title="Beneficiaries">
              {primaryBenes.map((b, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ color: MUTED, fontSize: 12, marginBottom: 3 }}>Primary #{i + 1}</div>
                  <DetailRow label="Name" value={b.fullName} />
                  <DetailRow label="Relationship" value={b.relationship} />
                  <DetailRow label="Percentage" value={b.percentage ? `${b.percentage}%` : ''} />
                  <DetailRow label="DOB" value={b.dateOfBirth} />
                </div>
              ))}
              {contingentBenes.map((b, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ color: MUTED, fontSize: 12, marginBottom: 3 }}>Contingent #{i + 1}</div>
                  <DetailRow label="Name" value={b.fullName} />
                  <DetailRow label="Relationship" value={b.relationship} />
                  <DetailRow label="Percentage" value={b.percentage ? `${b.percentage}%` : ''} />
                </div>
              ))}
              {primaryBenes.length === 0 && <div style={{ color: MUTED, fontSize: 13 }}>None on file</div>}
            </Section>

            <Section title="Policy Owner">
              <DetailRow label="Same as Insured" value={s.owner_same_as_insured === 'yes' ? 'Yes' : 'No'} />
              {s.owner_same_as_insured === 'no' && (
                <>
                  <DetailRow label="Owner Name" value={ownerInfo.fullName || ownerInfo.trustName} />
                  <DetailRow label="Is Trust" value={ownerInfo.isTrust ? 'Yes' : 'No'} />
                  <DetailRow label="Relationship" value={ownerInfo.relationship} />
                </>
              )}
            </Section>

            <Section title="Health & Medical">
              <DetailRow label="Father Alive" value={s.father_alive} />
              <DetailRow label="Father's Age" value={s.father_age || s.father_age_at_death ? (s.father_alive === 'yes' ? s.father_age : `Passed at ${s.father_age_at_death}`) : ''} />
              <DetailRow label="Father Cause" value={s.father_cause_of_death} />
              <DetailRow label="Mother Alive" value={s.mother_alive} />
              <DetailRow label="Mother's Age" value={s.mother_age || s.mother_age_at_death ? (s.mother_alive === 'yes' ? s.mother_age : `Passed at ${s.mother_age_at_death}`) : ''} />
              <DetailRow label="Height" value={s.height_feet && s.height_inches !== undefined ? `${s.height_feet}ft ${s.height_inches}in` : ''} />
              <DetailRow label="Weight" value={s.weight ? `${s.weight} lbs` : ''} />
              <DetailRow label="Tobacco Use" value={s.tobacco_use} />
              <DetailRow label="Tobacco Type" value={s.tobacco_type} />
              <DetailRow label="Medications" value={s.has_medications} />
              <DetailRow label="Medical Conditions" value={s.has_medical_conditions} />
            </Section>

            <Section title="Existing Insurance">
              <DetailRow label="Has Existing Insurance" value={s.has_existing_insurance} />
              {existingPolicies.map((p, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ color: MUTED, fontSize: 12, marginBottom: 3 }}>Policy #{i + 1}</div>
                  <DetailRow label="Company" value={p.companyName} />
                  <DetailRow label="Face Amount" value={p.faceAmount ? `$${p.faceAmount}` : ''} />
                  <DetailRow label="When Issued" value={p.whenIssued} />
                  <DetailRow label="Will Be Replaced" value={p.willBeReplaced} />
                </div>
              ))}
            </Section>

            <Section title="Signature">
              <DetailRow label="Signature" value={s.signature_name} />
              <DetailRow label="Date" value={s.signature_date} />
              <DetailRow label="Submitted" value={fmtDate(s.created_at)} />
            </Section>
          </div>
        </div>

        {/* Delete confirm modal */}
        {delConfirm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28, maxWidth: 420, width: '100%' }}>
              <h3 style={{ color: DANGER, margin: '0 0 12px', fontSize: 18 }}>Confirm Delete</h3>
              <p style={{ color: TEXT, fontSize: 14, marginBottom: 20 }}>
                Permanently delete the submission from <strong>{delConfirm.first_name} {delConfirm.last_name}</strong>? This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDelConfirm(null)} style={{ flex: 1, padding: '10px', border: `1px solid ${BORDER}`, borderRadius: 8, background: 'none', color: TEXT, cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => deleteSubmission(delConfirm)} disabled={busy} style={{ flex: 1, padding: '10px', background: DANGER, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Main table view ──────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px 80px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: GOLD, fontWeight: 800, fontSize: 20, letterSpacing: 1 }}>🛡️ ADMIN DASHBOARD</div>
            <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>The Legacy Link — NLG Submissions</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <a href="/apply" style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, padding: '7px 14px', cursor: 'pointer', fontSize: 13, textDecoration: 'none' }}>
              ← Back to Form
            </a>
            <button onClick={load} style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8, color: GOLD, padding: '7px 14px', cursor: 'pointer', fontSize: 13 }}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
          <StatCard icon="👥" label="Total Submissions" value={total} />
          <StatCard icon="⏳" label="Pending Review" value={pending} color={WARN} />
          <StatCard icon="✅" label="Reviewed" value={reviewed} color={SUCCESS} />
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ color: MUTED, textAlign: 'center', padding: 40 }}>Loading submissions…</div>
        ) : submissions.length === 0 ? (
          <div style={{ color: MUTED, textAlign: 'center', padding: 60, background: CARD, borderRadius: 12, border: `1px solid ${BORDER}` }}>
            No submissions yet.
          </div>
        ) : (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 160px 140px 110px 100px 80px',
              padding: '12px 18px', background: CARD2,
              borderBottom: `1px solid ${BORDER}`,
              fontSize: 12, color: MUTED, fontWeight: 600, letterSpacing: 0.5,
              gap: 12,
            }}>
              <div>#</div>
              <div>APPLICANT</div>
              <div>CARRIER</div>
              <div>MEMBERSHIP</div>
              <div>STATUS</div>
              <div>DATE</div>
              <div>ACTIONS</div>
            </div>
            {/* Rows */}
            {submissions.map((sub, idx) => (
              <div key={sub.id} style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 160px 140px 110px 100px 80px',
                padding: '14px 18px',
                borderBottom: idx < submissions.length - 1 ? `1px solid ${BORDER}` : 'none',
                gap: 12, alignItems: 'center',
                transition: 'background 0.15s',
                cursor: 'pointer',
              }}
                onMouseEnter={e => e.currentTarget.style.background = CARD2}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ color: MUTED, fontSize: 13 }}>{idx + 1}</div>
                <div onClick={() => setSelected(sub)}>
                  <div style={{ color: TEXT, fontWeight: 600, fontSize: 14 }}>{sub.first_name} {sub.last_name}</div>
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{sub.email}</div>
                </div>
                <div style={{ color: MUTED, fontSize: 13 }} onClick={() => setSelected(sub)}>National Life Group</div>
                <div style={{ color: TEXT, fontSize: 13 }} onClick={() => setSelected(sub)}>{sub.coverage_purpose || '—'}</div>
                <div onClick={() => setSelected(sub)}><Badge status={sub.status} /></div>
                <div style={{ color: MUTED, fontSize: 12 }} onClick={() => setSelected(sub)}>{fmtDate(sub.created_at)}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setSelected(sub)}
                    title="View"
                    style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 8px', color: MUTED, cursor: 'pointer', fontSize: 14 }}
                  >
                    👁
                  </button>
                  <button
                    onClick={() => setDelConfirm(sub)}
                    title="Delete"
                    style={{ background: 'none', border: `1px solid ${DANGER}33`, borderRadius: 6, padding: '4px 8px', color: DANGER, cursor: 'pointer', fontSize: 14 }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {delConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28, maxWidth: 420, width: '100%' }}>
            <h3 style={{ color: DANGER, margin: '0 0 12px', fontSize: 18 }}>Confirm Delete</h3>
            <p style={{ color: TEXT, fontSize: 14, marginBottom: 20 }}>
              Permanently delete the submission from <strong>{delConfirm.first_name} {delConfirm.last_name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDelConfirm(null)} style={{ flex: 1, padding: '10px', border: `1px solid ${BORDER}`, borderRadius: 8, background: 'none', color: TEXT, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteSubmission(delConfirm)} disabled={busy} style={{ flex: 1, padding: '10px', background: DANGER, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
