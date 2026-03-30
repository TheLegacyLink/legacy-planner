'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'legacy_setter_backoffice_session_v1';

const STATUS_OPTIONS = [
  'New', 'Called', 'No Answer', 'Voicemail Left', 'Text Sent', 'Spoke To Lead',
  'Follow-Up Needed', 'Booked', 'Rescheduled', 'No-Show', 'Not Interested', 'Bad Number', 'Duplicate', 'Do Not Contact'
];

function clean(v = '') { return String(v || '').trim(); }

function timeAgo(iso = '') {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Math.max(0, Date.now() - d.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function localDateTime(iso = '') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function stateCode(v = '') {
  const raw = clean(v).toUpperCase();
  return raw.slice(0, 2);
}

function attemptCount(lead = {}) {
  return Array.isArray(lead?.attempts) ? lead.attempts.length : 0;
}

function leadNeedsSla(lead = {}, slaMinutes = 5) {
  if (!lead?.createdAt) return false;
  if (attemptCount(lead) > 0) return false;
  const d = new Date(lead.createdAt);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() > Number(slaMinutes || 5) * 60000;
}

function fmtPct(n = 0) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return '0%';
  return `${Math.round(x)}%`;
}

function pillColor(status = '') {
  const s = clean(status).toLowerCase();
  if (s.includes('booked') || s.includes('spoke') || s.includes('called') || s.includes('completed')) return '#16a34a';
  if (s.includes('no-show') || s.includes('bad') || s.includes('not interested')) return '#ef4444';
  if (s.includes('follow') || s.includes('reschedule') || s.includes('voicemail') || s.includes('no answer')) return '#f59e0b';
  return '#3b82f6';
}

export default function AppointmentSetterBackofficePage() {
  const [session, setSession] = useState(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [noteText, setNoteText] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [bookingAt, setBookingAt] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [dragLeadId, setDragLeadId] = useState('');
  const [settingsDraft, setSettingsDraft] = useState({ slaMinutes: 5, assignmentMode: 'smart', adminOverrideEnabled: true, capState: 'CA', capValue: 2 });
  const [newLead, setNewLead] = useState({ fullName: '', phone: '', email: '', state: '', campaignSource: '', productType: '' });
  const [adminUsers, setAdminUsers] = useState([]);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'setter', password: '' });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.name && parsed?.role) setSession(parsed);
      }
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    if (!session?.name) return;
    const res = await fetch('/api/appointment-setter', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      setStore(data.store || null);
    }
    setLoading(false);
  }, [session?.name]);

  useEffect(() => {
    if (!session?.name) {
      setLoading(false);
      return;
    }

    setLoading(true);
    loadData();
    const id = setInterval(loadData, 15000);
    return () => clearInterval(id);
  }, [session?.name, loadData]);

  const leads = useMemo(() => Array.isArray(store?.leads) ? store.leads : [], [store]);
  const agents = useMemo(() => Array.isArray(store?.agents) ? store.agents : [], [store]);
  const notifications = useMemo(() => Array.isArray(store?.notifications) ? store.notifications : [], [store]);
  const slaMinutes = Number(store?.settings?.slaMinutes || 5);

  const selectedLead = useMemo(() => leads.find((l) => clean(l.id) === clean(selectedLeadId)) || null, [leads, selectedLeadId]);

  useEffect(() => {
    setSettingsDraft((prev) => ({
      ...prev,
      slaMinutes: Number(store?.settings?.slaMinutes || prev.slaMinutes || 5),
      assignmentMode: clean(store?.settings?.assignmentMode || prev.assignmentMode || 'smart'),
      adminOverrideEnabled: store?.settings?.adminOverrideEnabled === undefined ? prev.adminOverrideEnabled : Boolean(store?.settings?.adminOverrideEnabled)
    }));
  }, [store?.settings?.slaMinutes, store?.settings?.assignmentMode, store?.settings?.adminOverrideEnabled]);

  useEffect(() => {
    if (session?.role === 'admin') loadAdminUsers();
  }, [session?.role, loadAdminUsers]);

  const filteredLeads = useMemo(() => {
    const q = clean(search).toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== 'all' && clean(lead.status) !== statusFilter) return false;
      if (stateFilter !== 'all' && stateCode(lead.state) !== stateFilter) return false;

      if (q) {
        const hay = `${lead.fullName} ${lead.phone} ${lead.email} ${lead.campaignSource}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, statusFilter, stateFilter]);

  const kpis = useMemo(() => {
    const now = Date.now();
    const today = new Date();
    const dayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

    const isToday = (iso = '') => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return false;
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === dayKey;
    };

    const newToday = leads.filter((l) => isToday(l.createdAt)).length;
    const calledToday = leads.filter((l) => (l.attempts || []).some((a) => isToday(a.at))).length;
    const voicemails = leads.filter((l) => (l.attempts || []).some((a) => isToday(a.at) && a.voicemailLeft)).length;
    const bookedToday = leads.filter((l) => isToday(l?.appointment?.dateTime || '') || (clean(l.status) === 'Booked' && isToday(l.updatedAt || l.createdAt))).length;
    const followUps = leads.filter((l) => ['Follow-Up Needed', 'No Answer', 'Voicemail Left'].includes(clean(l.status))).length;
    const noShows = leads.filter((l) => ['No-Show', 'Rescheduled'].includes(clean(l.status))).length;

    const speeds = leads
      .map((l) => {
        const created = new Date(l.createdAt || 0).getTime();
        const firstAttempt = new Date((l.attempts || [])[0]?.at || 0).getTime();
        if (!created || !firstAttempt || Number.isNaN(created) || Number.isNaN(firstAttempt)) return null;
        return Math.max(0, Math.round((firstAttempt - created) / 60000));
      })
      .filter((n) => Number.isFinite(n));

    const avgSpeed = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;

    const bySetter = {};
    for (const l of leads) {
      const setter = clean(l.assignedSetter || 'Unassigned');
      if (!bySetter[setter]) bySetter[setter] = 0;
      if (clean(l.status) === 'Booked') bySetter[setter] += 1;
    }

    const slaBreaches = leads.filter((l) => leadNeedsSla(l, slaMinutes)).length;

    return {
      newToday,
      calledToday,
      voicemails,
      bookedToday,
      followUps,
      noShows,
      avgSpeed,
      bySetter,
      slaBreaches
    };
  }, [leads, slaMinutes]);

  const bookedUnassigned = useMemo(
    () => leads.filter((l) => clean(l.status) === 'Booked' && !clean(l.assignedAgentId)),
    [leads]
  );

  const stateColumns = useMemo(() => {
    const states = new Set(bookedUnassigned.map((l) => stateCode(l.state)));
    if (!states.size) {
      ['CA', 'TX', 'GA', 'FL'].forEach((s) => states.add(s));
    }
    return [...states];
  }, [bookedUnassigned]);

  const fairnessRows = useMemo(() => {
    const rows = [];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    for (const agent of agents) {
      const byState = {};
      for (const lead of leads) {
        for (const a of (lead.assignmentLog || [])) {
          const at = new Date(a?.at || 0);
          if (Number.isNaN(at.getTime()) || at < weekStart) continue;
          if (clean(a.agentId) !== clean(agent.id)) continue;
          const st = stateCode(lead.state);
          byState[st] = Number(byState[st] || 0) + 1;
        }
      }

      const total = Object.values(byState).reduce((a, b) => a + Number(b || 0), 0);
      rows.push({
        agent,
        total,
        byState
      });
    }

    return rows.sort((a, b) => a.total - b.total);
  }, [agents, leads]);

  const followUpQueue = useMemo(() => {
    return leads
      .filter((l) => ['No Answer', 'Voicemail Left', 'Follow-Up Needed', 'Rescheduled', 'No-Show'].includes(clean(l.status)))
      .sort((a, b) => new Date(a.followUpAt || 0).getTime() - new Date(b.followUpAt || 0).getTime());
  }, [leads]);

  async function login() {
    setLoginError('');
    const res = await fetch('/api/appointment-setter-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setLoginError('Invalid login. Check name/password.');
      return;
    }

    const user = data.user;
    setSession(user);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch {}
    setPassword('');
  }

  function logout() {
    setSession(null);
    try { localStorage.removeItem(SESSION_KEY); } catch {}
  }

  async function act(action, payload = {}) {
    if (!session?.name) return;
    setMessage('Saving...');
    const res = await fetch('/api/appointment-setter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, actorName: session.name, actorRole: session.role, ...payload })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setMessage(`⚠️ ${data?.error || 'Request failed'}`);
      return;
    }
    setMessage('Saved');
    await loadData();
    setTimeout(() => setMessage(''), 1800);
  }

  async function quickCall(lead, outcome, voicemailLeft = false) {
    await act('log_call', {
      leadId: lead.id,
      outcome,
      voicemailLeft,
      status: voicemailLeft ? 'Voicemail Left' : outcome
    });
  }

  async function recommendAssign(lead) {
    await act('auto_assign', { leadId: lead.id });
  }

  async function dropAssign(agentId) {
    if (!dragLeadId || !agentId) return;
    await act('assign_agent', { leadId: dragLeadId, agentId });
    setDragLeadId('');
  }

  async function createLeadManually() {
    if (!clean(newLead.fullName) || !clean(newLead.phone) || !clean(newLead.state)) {
      setMessage('⚠️ Name, phone, and state are required for a new lead.');
      return;
    }
    await act('create_lead', newLead);
    setNewLead({ fullName: '', phone: '', email: '', state: '', campaignSource: '', productType: '' });
  }

  async function saveAdminSettings() {
    await act('set_settings', {
      settings: {
        slaMinutes: Number(settingsDraft.slaMinutes || 5),
        assignmentMode: settingsDraft.assignmentMode || 'smart',
        adminOverrideEnabled: Boolean(settingsDraft.adminOverrideEnabled)
      }
    });
  }

  async function saveStateCap() {
    await act('set_state_cap', { state: settingsDraft.capState, cap: Number(settingsDraft.capValue || 1) });
  }

  const loadAdminUsers = useCallback(async () => {
    if (session?.role !== 'admin') return;
    const url = `/api/appointment-setter-users?actorName=${encodeURIComponent(session.name)}&actorRole=${encodeURIComponent(session.role)}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) setAdminUsers(Array.isArray(data.rows) ? data.rows : []);
  }, [session?.name, session?.role]);

  async function adminUserAction(payload = {}) {
    const res = await fetch('/api/appointment-setter-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorName: session?.name, actorRole: session?.role, ...payload })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setMessage(`⚠️ ${data?.error || 'User action failed'}`);
      return;
    }
    await loadAdminUsers();
    setMessage('User settings updated');
  }

  if (!session) {
    return (
      <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top right, #1e293b 0%, #020617 36%)', color: '#f8fafc', display: 'grid', placeItems: 'center', padding: 20 }}>
        <section style={{ width: 'min(460px, 100%)', border: '1px solid #334155', borderRadius: 16, background: 'rgba(15,23,42,0.86)', backdropFilter: 'blur(8px)', padding: 18, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0 }}>The Legacy Link</h2>
          <p style={{ margin: 0, color: '#cbd5e1' }}>Appointment Setter Back Office</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={{ padding: '11px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" style={{ padding: '11px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }} onKeyDown={(e) => e.key === 'Enter' && login()} />
          <button onClick={login} style={{ padding: '11px 14px', borderRadius: 10, border: '1px solid #7c6330', background: 'linear-gradient(180deg,#d4af37,#8a6a18)', color: '#111827', fontWeight: 800 }}>Secure Login</button>
          <small style={{ color: '#94a3b8' }}>Default build creds: Kimora Link / LegacyAdmin#2026 • Emani / LegacySetter#2026</small>
          {loginError ? <p style={{ color: '#fca5a5', margin: 0 }}>{loginError}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#020617,#050816)', color: '#f8fafc', padding: 14 }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', display: 'grid', gap: 12 }}>
        <header style={{ border: '1px solid #24304a', borderRadius: 16, background: 'linear-gradient(180deg,#0b1328,#071126)', padding: 12, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <strong style={{ fontSize: 19 }}>Appointment Setter Back Office</strong>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Welcome {session.name} • {session.role.toUpperCase()}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ border: '1px solid #7c6330', background: '#221a09', color: '#f8e6ae', borderRadius: 999, fontSize: 12, padding: '5px 10px' }}>5-Min SLA Breaches: {kpis.slaBreaches}</span>
            <button onClick={loadData} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#fff' }}>Refresh</button>
            <button onClick={logout} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #7f1d1d', background: '#3f1010', color: '#fecaca' }}>Logout</button>
          </div>
        </header>

        <section style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
          {[
            ['New Leads Today', kpis.newToday],
            ['Leads Called Today', kpis.calledToday],
            ['Voicemails Left', kpis.voicemails],
            ['Appointments Booked', kpis.bookedToday],
            ['Follow-Ups Needed', kpis.followUps],
            ['No-Show / Reschedule', kpis.noShows],
            ['Avg Speed to Lead', `${kpis.avgSpeed} min`],
            ['Booked by Setters', Object.values(kpis.bySetter || {}).reduce((a, b) => a + Number(b || 0), 0)]
          ].map(([label, value]) => (
            <div key={label} style={{ border: '1px solid #25304a', borderRadius: 12, background: '#0a1225', padding: 12 }}>
              <div style={{ color: '#9fb4d8', fontSize: 12 }}>{label}</div>
              <strong style={{ fontSize: 26, color: '#f8e6ae' }}>{value}</strong>
            </div>
          ))}
        </section>

        <section style={{ display: 'grid', gap: 12, gridTemplateColumns: '2.1fr 1fr' }} className="setter-layout">
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ border: '1px solid #24304a', borderRadius: 12, background: '#0a1225', padding: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 130px', gap: 8 }}>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / phone / email" style={{ padding: '9px 10px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }} />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '9px 10px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }}>
                  <option value="all">All Statuses</option>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} style={{ padding: '9px 10px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }}>
                  <option value="all">All States</option>
                  {[...new Set(leads.map((l) => stateCode(l.state)).filter(Boolean))].map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
            </div>

            <div style={{ border: '1px solid #24304a', borderRadius: 12, background: '#0a1225', padding: 10 }}>
              <strong style={{ display: 'block', marginBottom: 8 }}>Manual Lead Intake (Backup)</strong>
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(6,minmax(0,1fr))' }}>
                <input value={newLead.fullName} onChange={(e) => setNewLead((p) => ({ ...p, fullName: e.target.value }))} placeholder="Full Name" style={fieldStyle} />
                <input value={newLead.phone} onChange={(e) => setNewLead((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" style={fieldStyle} />
                <input value={newLead.email} onChange={(e) => setNewLead((p) => ({ ...p, email: e.target.value }))} placeholder="Email" style={fieldStyle} />
                <input value={newLead.state} onChange={(e) => setNewLead((p) => ({ ...p, state: e.target.value }))} placeholder="State" style={fieldStyle} />
                <input value={newLead.campaignSource} onChange={(e) => setNewLead((p) => ({ ...p, campaignSource: e.target.value }))} placeholder="Campaign Source" style={fieldStyle} />
                <input value={newLead.productType} onChange={(e) => setNewLead((p) => ({ ...p, productType: e.target.value }))} placeholder="Product" style={fieldStyle} />
              </div>
              <div style={{ marginTop: 8 }}>
                <button style={btnMini} onClick={createLeadManually}>Add Lead</button>
              </div>
            </div>

            <div style={{ border: '1px solid #24304a', borderRadius: 12, background: '#0a1225', padding: 10, overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>Live New Lead Queue</strong>
                <small style={{ color: '#94a3b8' }}>{filteredLeads.length} leads</small>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1120 }}>
                <thead>
                  <tr>
                    {['Lead', 'State', 'Source', 'Lead Age', 'Status', 'Attempts', 'Priority', 'Actions'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 12, color: '#9fb4d8', borderBottom: '1px solid #1e293b', padding: '8px 6px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => {
                    const sla = leadNeedsSla(lead, slaMinutes);
                    const urgent = timeAgo(lead.createdAt).includes('min') && Number((timeAgo(lead.createdAt).split(' ')[0] || 0)) <= 5;
                    return (
                      <tr key={lead.id} style={{ borderBottom: '1px solid #1e293b', background: sla ? 'rgba(127,29,29,.2)' : 'transparent' }}>
                        <td style={{ padding: '8px 6px' }}>
                          <div style={{ fontWeight: 700 }}>{lead.fullName}</div>
                          <small style={{ color: '#94a3b8' }}>{lead.phone} • {lead.email}</small>
                        </td>
                        <td style={{ padding: '8px 6px' }}>{stateCode(lead.state)}</td>
                        <td style={{ padding: '8px 6px' }}>{lead.campaignSource}</td>
                        <td style={{ padding: '8px 6px', color: sla ? '#fca5a5' : '#cbd5e1' }}>{timeAgo(lead.createdAt)}</td>
                        <td style={{ padding: '8px 6px' }}>
                          <span style={{ border: `1px solid ${pillColor(lead.status)}`, color: '#fff', borderRadius: 999, padding: '3px 8px', fontSize: 12 }}>{lead.status}</span>
                        </td>
                        <td style={{ padding: '8px 6px' }}>{attemptCount(lead)}</td>
                        <td style={{ padding: '8px 6px' }}>
                          <span style={{ border: '1px solid #334155', borderRadius: 999, padding: '3px 8px', fontSize: 12, color: urgent ? '#fbbf24' : '#93c5fd' }}>{urgent ? 'Urgent' : (lead.priority || 'Normal')}</span>
                        </td>
                        <td style={{ padding: '8px 6px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <button onClick={() => quickCall(lead, 'Called')} style={btnMini}>Call</button>
                            <button onClick={() => quickCall(lead, 'No Answer')} style={btnMiniGhost}>No Answer</button>
                            <button onClick={() => quickCall(lead, 'Voicemail Left', true)} style={btnMiniGhost}>Voicemail</button>
                            <button onClick={() => setSelectedLeadId(lead.id)} style={btnMiniGhost}>Open</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ border: '1px solid #24304a', borderRadius: 12, background: '#0a1225', padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <strong>Drag-and-Drop Assignment Board</strong>
                <small style={{ color: '#94a3b8' }}>Booked + unassigned: {bookedUnassigned.length}</small>
              </div>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: `repeat(${Math.max(2, stateColumns.length)}, minmax(0,1fr))` }}>
                {stateColumns.map((st) => {
                  const cards = bookedUnassigned.filter((l) => stateCode(l.state) === st);
                  return (
                    <div key={st} style={{ border: '1px solid #334155', borderRadius: 10, background: '#071126', padding: 8, minHeight: 130 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <strong>{st} Unassigned</strong>
                        <small>{cards.length}</small>
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {cards.map((lead) => (
                          <div
                            key={lead.id}
                            draggable
                            onDragStart={() => setDragLeadId(lead.id)}
                            style={{ border: '1px solid #334155', borderRadius: 8, background: '#0b1225', padding: 7, cursor: 'grab' }}
                          >
                            <strong style={{ fontSize: 13 }}>{lead.fullName}</strong>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{localDateTime(lead?.appointment?.dateTime || '')}</div>
                            <button onClick={() => recommendAssign(lead)} style={{ ...btnMini, marginTop: 6 }}>Recommended Agent</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 10, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                {agents.map((a) => {
                  const total = fairnessRows.find((r) => clean(r.agent.id) === clean(a.id))?.total || 0;
                  return (
                    <div
                      key={a.id}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => dropAssign(a.id)}
                      style={{ border: '1px dashed #475569', borderRadius: 10, background: '#0a1225', padding: 8 }}
                    >
                      <strong>{a.name}</strong>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{(a.licensedStates || []).join(', ')}</div>
                      <div style={{ fontSize: 12, color: '#f8e6ae', marginTop: 4 }}>Assigned this week: {total}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ border: '1px solid #24304a', borderRadius: 12, background: '#0a1225', padding: 10 }}>
              <strong>Follow-Up Queue</strong>
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {followUpQueue.map((lead) => (
                  <div key={lead.id} style={{ border: '1px solid #334155', borderRadius: 10, background: '#071126', padding: 8, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <strong>{lead.fullName}</strong>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>{lead.status} • Last attempt: {localDateTime((lead.attempts || [])[0]?.at || '')}</div>
                      <div style={{ color: '#cbd5e1', fontSize: 12 }}>Next follow-up: {localDateTime(lead.followUpAt)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button style={btnMiniGhost} onClick={() => setSelectedLeadId(lead.id)}>Open</button>
                      <button style={btnMini} onClick={() => quickCall(lead, 'Called')}>Call Now</button>
                      {(clean(lead.status) === 'No-Show' || clean(lead.status) === 'Rescheduled') ? (
                        <button style={btnMiniGhost} onClick={() => act('recover_no_show', { leadId: lead.id, note: 'No-show recovery initiated from queue.' })}>Recovery</button>
                      ) : null}
                    </div>
                  </div>
                ))}
                {!followUpQueue.length ? <small style={{ color: '#94a3b8' }}>No follow-ups due.</small> : null}
              </div>
            </div>
          </div>

          <aside style={{ display: 'grid', gap: 10 }}>
            <div style={{ border: '1px solid #24304a', borderRadius: 12, background: '#0a1225', padding: 10 }}>
              <strong>Agent Fairness Dashboard</strong>
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {fairnessRows.map((row) => {
                  const states = Object.entries(row.byState || {}).map(([st, count]) => `${st}: ${count}`).join(' • ');
                  const pct = Math.min(100, row.total * 20);
                  return (
                    <div key={row.agent.id} style={{ border: '1px solid #334155', borderRadius: 10, background: '#071126', padding: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{row.agent.name}</strong>
                        <span>{row.total}</span>
                      </div>
                      <small style={{ color: '#94a3b8' }}>{states || 'No assignments this week'}</small>
                      <div style={{ marginTop: 6, height: 8, borderRadius: 999, background: '#1e293b', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#3b82f6,#d4af37)' }} />
                      </div>
                      <small style={{ color: '#9fb4d8' }}>Load share {fmtPct(pct)}</small>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ border: '1px solid #24304a', borderRadius: 12, background: '#0a1225', padding: 10 }}>
              <strong>Live Notifications</strong>
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {notifications.slice(0, 8).map((n) => (
                  <div key={n.id} style={{ border: '1px solid #334155', borderRadius: 10, background: '#071126', padding: 8 }}>
                    <div style={{ color: '#f8e6ae', fontSize: 12 }}>{n.title}</div>
                    <div style={{ color: '#e2e8f0', fontSize: 13 }}>{n.body}</div>
                    <small style={{ color: '#94a3b8' }}>{timeAgo(n.at)}</small>
                  </div>
                ))}
                {!notifications.length ? <small style={{ color: '#94a3b8' }}>No notifications yet.</small> : null}
              </div>
            </div>

            {(session.role === 'admin' || session.role === 'manager') ? (
              <div style={{ border: '1px solid #24304a', borderRadius: 12, background: '#0a1225', padding: 10 }}>
                <strong>Admin Assignment Settings</strong>
                <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                  <label style={{ fontSize: 12, color: '#9fb4d8' }}>SLA Minutes
                    <input type="number" min={1} value={settingsDraft.slaMinutes} onChange={(e) => setSettingsDraft((p) => ({ ...p, slaMinutes: Number(e.target.value || 1) }))} style={fieldStyle} />
                  </label>
                  <label style={{ fontSize: 12, color: '#9fb4d8' }}>Assignment Mode
                    <select value={settingsDraft.assignmentMode} onChange={(e) => setSettingsDraft((p) => ({ ...p, assignmentMode: e.target.value }))} style={fieldStyle}>
                      <option value="smart">Smart Recommended</option>
                      <option value="manual">Manual</option>
                      <option value="round-robin">Round Robin</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#cbd5e1' }}>
                    <input type="checkbox" checked={Boolean(settingsDraft.adminOverrideEnabled)} onChange={(e) => setSettingsDraft((p) => ({ ...p, adminOverrideEnabled: e.target.checked }))} />
                    Admin override when cap reached
                  </label>
                  <button style={btnMini} onClick={saveAdminSettings}>Save Core Settings</button>

                  <div style={{ borderTop: '1px solid #24304a', paddingTop: 8, display: 'grid', gap: 6 }}>
                    <small style={{ color: '#9fb4d8' }}>State Weekly Cap</small>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
                      <input value={settingsDraft.capState} onChange={(e) => setSettingsDraft((p) => ({ ...p, capState: e.target.value.toUpperCase() }))} placeholder="State" style={fieldStyle} />
                      <input type="number" min={1} value={settingsDraft.capValue} onChange={(e) => setSettingsDraft((p) => ({ ...p, capValue: Number(e.target.value || 1) }))} placeholder="Cap" style={fieldStyle} />
                      <button style={btnMiniGhost} onClick={saveStateCap}>Save</button>
                    </div>
                  </div>

                  {session.role === 'admin' ? (
                    <div style={{ borderTop: '1px solid #24304a', paddingTop: 8, display: 'grid', gap: 8 }}>
                      <small style={{ color: '#9fb4d8' }}>User / Credential Management</small>
                      <div style={{ display: 'grid', gap: 6, gridTemplateColumns: '1fr 1fr' }}>
                        <input value={userForm.name} onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name" style={fieldStyle} />
                        <input value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" style={fieldStyle} />
                        <select value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))} style={fieldStyle}>
                          <option value="setter">Setter</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                        <input value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} placeholder="Password" type="password" style={fieldStyle} />
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button style={btnMini} onClick={() => adminUserAction({ action: 'upsert', ...userForm, active: true })}>Add / Update User</button>
                        <button style={btnMiniGhost} onClick={loadAdminUsers}>Reload Users</button>
                      </div>

                      <div style={{ display: 'grid', gap: 6 }}>
                        {adminUsers.map((u) => (
                          <div key={u.name} style={{ border: '1px solid #334155', borderRadius: 8, padding: 6, background: '#071126' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
                              <div>
                                <strong style={{ fontSize: 12 }}>{u.name}</strong>
                                <div style={{ fontSize: 11, color: '#9fb4d8' }}>{u.role} • {u.email || 'no email'} • {u.active ? 'active' : 'inactive'}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button style={btnMiniGhost} onClick={() => adminUserAction({ action: 'set_active', name: u.name, active: !u.active })}>{u.active ? 'Disable' : 'Enable'}</button>
                                <button style={btnMiniGhost} onClick={() => {
                                  const p = window.prompt(`New password for ${u.name}`);
                                  if (!p) return;
                                  adminUserAction({ action: 'reset_password', name: u.name, password: p });
                                }}>Reset PW</button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {!adminUsers.length ? <small style={{ color: '#94a3b8' }}>No users loaded.</small> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div style={{ border: '1px solid #24304a', borderRadius: 12, background: '#0a1225', padding: 10 }}>
              <strong>Quick Scripts Panel</strong>
              <ul style={{ margin: '8px 0 0 18px', padding: 0, color: '#cbd5e1', display: 'grid', gap: 6 }}>
                <li>First Call Script</li>
                <li>Voicemail Script</li>
                <li>Follow-Up Text Script</li>
                <li>Reschedule Script</li>
                <li>No-Show Recovery Script</li>
              </ul>
            </div>
          </aside>
        </section>

        {selectedLead ? (
          <section style={{ border: '1px solid #24304a', borderRadius: 12, background: '#0a1225', padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <strong style={{ fontSize: 16 }}>{selectedLead.fullName}</strong>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>{selectedLead.phone} • {selectedLead.email} • {stateCode(selectedLead.state)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnMiniGhost} onClick={() => setSelectedLeadId('')}>Close</button>
                <button style={btnMini} onClick={() => act('set_appointment_status', { leadId: selectedLead.id, appointmentStatus: 'no-show' })}>Mark No-Show</button>
                <button style={btnMini} onClick={() => act('set_appointment_status', { leadId: selectedLead.id, appointmentStatus: 'rescheduled' })}>Reschedule</button>
              </div>
            </div>

            <div style={{ marginTop: 10, display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div style={panelStyle}>
                <strong>Status + Call Workflow</strong>
                <select value={selectedLead.status || 'New'} onChange={(e) => act('update_status', { leadId: selectedLead.id, status: e.target.value })} style={fieldStyle}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button style={btnMini} onClick={() => quickCall(selectedLead, 'Called')}>Call</button>
                  <button style={btnMiniGhost} onClick={() => quickCall(selectedLead, 'No Answer')}>No Answer</button>
                  <button style={btnMiniGhost} onClick={() => quickCall(selectedLead, 'Voicemail Left', true)}>Voicemail</button>
                  <button style={btnMiniGhost} onClick={() => quickCall(selectedLead, 'Spoke To Lead')}>Spoke</button>
                </div>
                <small style={{ color: '#9fb4d8' }}>Attempt history: {(selectedLead.attempts || []).length}</small>
                <div style={{ display: 'grid', gap: 4, maxHeight: 150, overflow: 'auto', marginTop: 6 }}>
                  {(selectedLead.attempts || []).slice(0, 8).map((a) => (
                    <small key={a.id} style={{ color: '#cbd5e1' }}>{localDateTime(a.at)} • {a.outcome} {a.voicemailLeft ? '(VM)' : ''}</small>
                  ))}
                </div>
              </div>

              <div style={panelStyle}>
                <strong>Notes + Follow-Up</strong>
                <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add notes, objections, callback window, interest level..." style={{ ...fieldStyle, minHeight: 88, resize: 'vertical' }} />
                <button style={btnMini} onClick={async () => {
                  if (!clean(noteText)) return;
                  await act('add_note', { leadId: selectedLead.id, note: noteText, tags: [] });
                  setNoteText('');
                }}>Save Note</button>
                <input type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} style={fieldStyle} />
                <button style={btnMiniGhost} onClick={() => act('schedule_followup', { leadId: selectedLead.id, followUpAt, status: 'Follow-Up Needed' })}>Schedule Follow-Up</button>
              </div>

              <div style={panelStyle}>
                <strong>Book + Assign</strong>
                <input type="datetime-local" value={bookingAt} onChange={(e) => setBookingAt(e.target.value)} style={fieldStyle} />
                <textarea value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} placeholder="Setter notes for assigned agent" style={{ ...fieldStyle, minHeight: 64, resize: 'vertical' }} />
                <button style={btnMini} onClick={() => act('book_appointment', { leadId: selectedLead.id, dateTime: bookingAt, setterNotes: bookingNotes })}>Book Appointment</button>

                <select defaultValue="" onChange={(e) => e.target.value && act('assign_agent', { leadId: selectedLead.id, agentId: e.target.value })} style={fieldStyle}>
                  <option value="">Assign Agent...</option>
                  {agents
                    .filter((a) => (a.licensedStates || []).includes(stateCode(selectedLead.state)))
                    .map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>

                <button style={btnMiniGhost} onClick={() => recommendAssign(selectedLead)}>Recommended Agent</button>
              </div>
            </div>

            <div style={{ marginTop: 8, color: '#9fb4d8', fontSize: 12 }}>{message}</div>
          </section>
        ) : null}
      </div>

      <style jsx>{`
        @media (max-width: 1080px) {
          .setter-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}

const btnMini = {
  padding: '7px 9px',
  borderRadius: 8,
  border: '1px solid #7c6330',
  background: 'linear-gradient(180deg,#d4af37,#8a6a18)',
  color: '#111827',
  fontWeight: 700,
  fontSize: 12
};

const btnMiniGhost = {
  padding: '7px 9px',
  borderRadius: 8,
  border: '1px solid #334155',
  background: '#0f172a',
  color: '#e2e8f0',
  fontWeight: 600,
  fontSize: 12
};

const panelStyle = {
  border: '1px solid #334155',
  borderRadius: 10,
  background: '#071126',
  padding: 8,
  display: 'grid',
  gap: 6,
  alignContent: 'start'
};

const fieldStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #334155',
  background: '#020617',
  color: '#f8fafc'
};
