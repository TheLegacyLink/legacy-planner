'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

function clean(v = '') {
  return String(v || '').trim();
}

function fmtDate(iso = '') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

const EMPTY = {
  id: '',
  name: '',
  email: '',
  licensed: false,
  onboardingComplete: false,
  communityServiceApproved: false,
  schoolCommunityJoined: false,
  youtubeCommentApproved: false,
  contractingStarted: false,
  contractingComplete: false,
  active: true,
  tier: 'PROGRAM_TIER_0',
  tier0WeeklyCap: 5,
  tier0StartAt: '',
  tier0EndAt: '',
  commissionNonSponsoredPct: 50,
  notes: ''
};

export default function SponsorshipProgramPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [members, setMembers] = useState([]);
  const [claims, setClaims] = useState([]);
  const [events, setEvents] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [form, setForm] = useState(EMPTY);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/sponsorship-program?viewerName=Kimora%20Link&viewerEmail=investalinkinsurance@gmail.com&viewerRole=admin', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.ok) {
        setMembers(Array.isArray(data?.admin?.members) ? data.admin.members : []);
        setClaims(Array.isArray(data?.admin?.claims) ? data.admin.claims : []);
        setEvents(Array.isArray(data?.admin?.recentEvents) ? data.admin.recentEvents : []);
        setRecommendations(Array.isArray(data?.admin?.recommendations) ? data.admin.recommendations : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const sortedMembers = useMemo(() => [...members].sort((a, b) => clean(a.name).localeCompare(clean(b.name))), [members]);

  const pipeline = useMemo(() => {
    const counts = {
      total: members.length,
      licensed: members.filter((m) => m.licensed).length,
      unlicensed: members.filter((m) => !m.licensed).length,
      accessActive: members.filter((m) => m.leadAccessActive).length,
      waitingSkool: members.filter((m) => !m.schoolCommunityJoined).length,
      waitingYoutube: members.filter((m) => !m.youtubeCommentApproved).length,
      waitingContracting: members.filter((m) => !(m.contractingStarted || m.contractingComplete)).length
    };
    return counts;
  }, [members]);

  function editMember(m) {
    setForm({
      ...EMPTY,
      ...m,
      tier0WeeklyCap: Number(m?.tier0WeeklyCap || 5),
      commissionNonSponsoredPct: Number(m?.commissionNonSponsoredPct || 50)
    });
    setMessage(`Editing: ${m?.name}`);
  }

  async function saveMember() {
    if (!clean(form.name) || !clean(form.email)) {
      setMessage('Name and email are required.');
      return;
    }

    setMessage('Saving member...');

    const res = await fetch('/api/sponsorship-program', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert_member', actorName: 'Kimora', member: form })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setMessage(`Save failed: ${data?.error || 'unknown'}`);
      return;
    }

    setMessage('Member saved.');
    setForm(EMPTY);
    await load();
  }

  return (
    <AppShell title="Sponsorship Program Admin">
      <div className="panel">
        <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Phase 1 Gate Engine</h3>
          <button type="button" onClick={load}>Refresh</button>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Tier 0 defaults: 5 leads/week for 8 weeks. SLA: 10 minutes from grab.
        </p>
        {message ? <p className="pill" style={{ background: '#dbeafe', color: '#1e3a8a' }}>{message}</p> : null}
      </div>

      <div className="panel" style={{ marginTop: 10 }}>
        <h3 style={{ marginTop: 0 }}>Intake / Mint Panel</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="pill">Total: {pipeline.total}</span>
          <span className="pill">Licensed: {pipeline.licensed}</span>
          <span className="pill">Unlicensed: {pipeline.unlicensed}</span>
          <span className="pill">Lead Access Active: {pipeline.accessActive}</span>
          <span className="pill">Waiting Skool: {pipeline.waitingSkool}</span>
          <span className="pill">Waiting YouTube: {pipeline.waitingYoutube}</span>
          <span className="pill">Waiting Contracting: {pipeline.waitingContracting}</span>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 10 }}>
        <h3 style={{ marginTop: 0 }}>{form.id ? 'Edit Program Member' : 'Add Program Member'}</h3>
        <div className="settingsGrid">
          <label>Name<input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label>
          <label>Email<input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></label>
          <label>Tier
            <select value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}>
              <option value="PROGRAM_TIER_0">PROGRAM_TIER_0</option>
              <option value="PROGRAM_TIER_1">PROGRAM_TIER_1</option>
              <option value="PROGRAM_TIER_2">PROGRAM_TIER_2</option>
              <option value="PROGRAM_TIER_3">PROGRAM_TIER_3</option>
            </select>
          </label>
          <label>Tier0 Weekly Cap<input type="number" min={1} value={form.tier0WeeklyCap} onChange={(e) => setForm((f) => ({ ...f, tier0WeeklyCap: Number(e.target.value || 1) }))} /></label>
          <label>Tier0 Start At<input type="datetime-local" value={form.tier0StartAt ? form.tier0StartAt.slice(0, 16) : ''} onChange={(e) => setForm((f) => ({ ...f, tier0StartAt: e.target.value ? new Date(e.target.value).toISOString() : '' }))} /></label>
          <label>Tier0 End At<input type="datetime-local" value={form.tier0EndAt ? form.tier0EndAt.slice(0, 16) : ''} onChange={(e) => setForm((f) => ({ ...f, tier0EndAt: e.target.value ? new Date(e.target.value).toISOString() : '' }))} /></label>
          <label>Commission % (non-sponsored)<input type="number" min={0} max={100} value={form.commissionNonSponsoredPct} onChange={(e) => setForm((f) => ({ ...f, commissionNonSponsoredPct: Number(e.target.value || 0) }))} /></label>
          <label>Notes<input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <label><input type="checkbox" checked={form.licensed} onChange={(e) => setForm((f) => ({ ...f, licensed: e.target.checked }))} /> Licensed</label>
          <label><input type="checkbox" checked={form.onboardingComplete} onChange={(e) => setForm((f) => ({ ...f, onboardingComplete: e.target.checked }))} /> Onboarding Complete</label>
          <label><input type="checkbox" checked={form.communityServiceApproved} onChange={(e) => setForm((f) => ({ ...f, communityServiceApproved: e.target.checked }))} /> Community Service Approved</label>
          <label><input type="checkbox" checked={form.schoolCommunityJoined} onChange={(e) => setForm((f) => ({ ...f, schoolCommunityJoined: e.target.checked }))} /> Joined Skool Community</label>
          <label><input type="checkbox" checked={form.youtubeCommentApproved} onChange={(e) => setForm((f) => ({ ...f, youtubeCommentApproved: e.target.checked }))} /> YouTube Comment Approved</label>
          <label><input type="checkbox" checked={form.contractingStarted} onChange={(e) => setForm((f) => ({ ...f, contractingStarted: e.target.checked }))} /> Contracting Started</label>
          <label><input type="checkbox" checked={form.contractingComplete} onChange={(e) => setForm((f) => ({ ...f, contractingComplete: e.target.checked }))} /> Contracting Complete</label>
          <label><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Active</label>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={saveMember}>Save Member</button>
          <button type="button" className="ghost" onClick={() => setForm(EMPTY)}>Clear</button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 10, overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Program Members</h3>
        {loading ? <p className="muted">Loading...</p> : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Tier</th>
                <th>Licensed</th>
                <th>Onboarding</th>
                <th>Community</th>
                <th>Skool</th>
                <th>YouTube</th>
                <th>Contracting</th>
                <th>Access</th>
                <th>Cap</th>
                <th>Commission</th>
                <th>Stage</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((m) => {
                const stage = !m.licensed
                  ? 'Pre-licensing'
                  : !m.onboardingComplete
                    ? 'Onboarding'
                    : !m.communityServiceApproved
                      ? 'Community Service'
                      : !m.schoolCommunityJoined
                        ? 'Join Skool'
                        : !m.youtubeCommentApproved
                          ? 'YouTube Approval'
                          : !(m.contractingStarted || m.contractingComplete)
                            ? 'Start Contracting'
                            : m.leadAccessActive
                              ? 'Lead Access Active'
                              : 'Gate Review';
                return (
                  <tr key={m.id}>
                    <td>{m.name}<br /><small className="muted">{m.email}</small></td>
                    <td>{m.tier}</td>
                    <td>{m.licensed ? '✅' : '—'}</td>
                    <td>{m.onboardingComplete ? '✅' : '—'}</td>
                    <td>{m.communityServiceApproved ? '✅' : '—'}</td>
                    <td>{m.schoolCommunityJoined ? '✅' : '—'}</td>
                    <td>{m.youtubeCommentApproved ? '✅' : '—'}</td>
                    <td>{m.contractingStarted || m.contractingComplete ? '✅' : '—'}</td>
                    <td>{m.leadAccessActive ? 'Active' : 'Hold'}</td>
                    <td>{m.tier0WeeklyCap || 5}</td>
                    <td>{m.commissionNonSponsoredPct || 50}%</td>
                    <td>{stage}</td>
                    <td>{fmtDate(m.createdAt)}</td>
                    <td><button type="button" className="ghost" onClick={() => editMember(m)}>Edit</button></td>
                  </tr>
                );
              })}
              {!sortedMembers.length ? <tr><td colSpan={14} className="muted">No members configured yet.</td></tr> : null}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ marginTop: 10, overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Upgrade Recommendations (Last 30 Days)</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Current</th>
              <th>Recommended</th>
              <th>30d Contacts</th>
              <th>SLA Rate</th>
              <th>Avg First Contact</th>
              <th>Urgency</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map((r) => (
              <tr key={r.memberId}>
                <td>{r.memberName}</td>
                <td>{r.currentTier}</td>
                <td>{r.recommendTier ? `${r.recommendTier} (${r.recommendPrice} • ${r.projectedCommissionPct}%)` : 'Stay'}</td>
                <td>{r.contactLogged30d} / {r.grabs30d}</td>
                <td>{r.slaRate30d}%</td>
                <td>{r.avgFirstContactMin ?? '—'} min</td>
                <td>{r.urgency}</td>
                <td>{r.rationale}</td>
              </tr>
            ))}
            {!recommendations.length ? <tr><td colSpan={8} className="muted">No recommendation data yet.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: 10, overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Recent Claims</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Lead</th>
              <th>Status</th>
              <th>Grabbed</th>
              <th>First Contact</th>
              <th>SLA</th>
            </tr>
          </thead>
          <tbody>
            {claims.slice(0, 80).map((c) => (
              <tr key={c.id}>
                <td>{c.memberName}</td>
                <td>{c.leadApplicant || c.leadKey}</td>
                <td>{c.status}</td>
                <td>{fmtDate(c.grabbedAt)}</td>
                <td>{fmtDate(c.firstContactAt)}</td>
                <td>{c.slaMet === true ? 'Met' : c.slaMet === false ? 'Missed' : '—'}</td>
              </tr>
            ))}
            {!claims.length ? <tr><td colSpan={6} className="muted">No claims yet.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: 10, overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Recent Compliance Events</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Member</th>
              <th>Lead</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 100).map((e) => (
              <tr key={e.id}>
                <td>{fmtDate(e.timestamp)}</td>
                <td>{e.type}</td>
                <td>{e.memberName || '—'}</td>
                <td>{e.leadKey || '—'}</td>
                <td>{e.slaMet === true ? 'SLA met' : e.slaMet === false ? `SLA missed (${e.minutesToFirstContact}m)` : '—'}</td>
              </tr>
            ))}
            {!events.length ? <tr><td colSpan={5} className="muted">No events yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
