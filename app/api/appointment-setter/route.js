import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';
import nodemailer from 'nodemailer';

const STORE_PATH = 'stores/appointment-setter-backoffice.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase(); }
function nowIso() { return new Date().toISOString(); }

function stateCodeFromAny(v = '') {
  const raw = clean(v).toUpperCase();
  if (!raw) return '';
  if (raw.length === 2) return raw;
  const map = {
    ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA', COLORADO: 'CO',
    CONNECTICUT: 'CT', DELAWARE: 'DE', FLORIDA: 'FL', GEORGIA: 'GA', HAWAII: 'HI', IDAHO: 'ID',
    ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS', KENTUCKY: 'KY', LOUISIANA: 'LA',
    MAINE: 'ME', MARYLAND: 'MD', MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN', MISSISSIPPI: 'MS',
    MISSOURI: 'MO', MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
    'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', OHIO: 'OH',
    OKLAHOMA: 'OK', OREGON: 'OR', PENNSYLVANIA: 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT', VERMONT: 'VT', VIRGINIA: 'VA',
    WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV', WISCONSIN: 'WI', WYOMING: 'WY', 'DISTRICT OF COLUMBIA': 'DC'
  };
  return map[raw] || raw.slice(0, 2);
}

function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function id(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function minuteAgo(minutes = 0) {
  return new Date(Date.now() - Number(minutes || 0) * 60000).toISOString();
}

function seedStore() {
  return {
    settings: {
      slaMinutes: 5,
      stateCaps: { CA: 2, TX: 3, GA: 3, FL: 3 },
      adminOverrideEnabled: true,
      assignmentMode: 'smart'
    },
    agents: [
      {
        id: 'agent_kelin',
        name: 'Kelin Brown',
        phone: '201-862-7040',
        email: 'support@thelegacylink.com',
        licensedStates: ['AZ', 'CA', 'CO', 'FL', 'MI', 'NE', 'NV', 'OH', 'OK', 'RI', 'TX', 'VA'],
        weeklyCapByState: { CA: 2, TX: 3, FL: 3 },
        active: true,
        unavailable: false
      },
      {
        id: 'agent_jamal',
        name: 'Jamal Holmes',
        phone: '201-862-7040',
        email: 'support@thelegacylink.com',
        licensedStates: ['NJ', 'MD', 'FL', 'TX', 'PA', 'GA'],
        weeklyCapByState: { TX: 3, FL: 3, GA: 3 },
        active: true,
        unavailable: false
      },
      {
        id: 'agent_leticia',
        name: 'Leticia Wright',
        phone: '201-862-7040',
        email: 'support@thelegacylink.com',
        licensedStates: ['CO', 'FL', 'MO', 'NV', 'NC', 'TX', 'GA'],
        weeklyCapByState: { TX: 3, FL: 3, GA: 3 },
        active: true,
        unavailable: false
      },
      {
        id: 'agent_breanna',
        name: 'Dr. Breanna James',
        phone: '201-862-7040',
        email: 'support@thelegacylink.com',
        licensedStates: ['CA', 'FL'],
        weeklyCapByState: { CA: 2, FL: 3 },
        active: true,
        unavailable: false
      },
      {
        id: 'agent_madalyn',
        name: 'Madalyn Adams',
        phone: '201-862-7040',
        email: 'support@thelegacylink.com',
        licensedStates: ['TX', 'FL', 'GA', 'NC'],
        weeklyCapByState: { TX: 3, FL: 3, GA: 3 },
        active: true,
        unavailable: false
      }
    ],
    leads: [
      {
        id: id('lead'),
        fullName: 'Jordan Miles',
        phone: '(404) 555-0112',
        email: 'jordan.miles@example.com',
        state: 'GA',
        campaignSource: 'IUL - Facebook',
        productType: 'IUL',
        createdAt: minuteAgo(2),
        status: 'New',
        priority: 'Urgent',
        attempts: [],
        voicemailLeft: false,
        notes: [],
        assignedSetter: '',
        appointment: null,
        assignedAgentId: '',
        assignmentLog: [],
        followUpAt: ''
      },
      {
        id: id('lead'),
        fullName: 'Alana Price',
        phone: '(213) 555-0181',
        email: 'alana.price@example.com',
        state: 'CA',
        campaignSource: 'Sponsorship Funnel',
        productType: 'Sponsorship',
        createdAt: minuteAgo(7),
        status: 'No Answer',
        priority: 'High',
        attempts: [
          { id: id('attempt'), at: minuteAgo(5), outcome: 'No Answer', voicemailLeft: true, by: 'Emani' }
        ],
        voicemailLeft: true,
        notes: [
          { id: id('note'), at: minuteAgo(4), by: 'Emani', text: 'Voicemail left. Follow up after 10:30am PT.', tags: ['voicemail', 'followup'] }
        ],
        assignedSetter: 'Emani',
        appointment: null,
        assignedAgentId: '',
        assignmentLog: [],
        followUpAt: minuteAgo(-50)
      },
      {
        id: id('lead'),
        fullName: 'Marcus Young',
        phone: '(713) 555-0190',
        email: 'marcus.young@example.com',
        state: 'TX',
        campaignSource: 'Mortgage Protection',
        productType: 'Mortgage Protection',
        createdAt: minuteAgo(18),
        status: 'Booked',
        priority: 'Normal',
        attempts: [
          { id: id('attempt'), at: minuteAgo(16), outcome: 'Spoke To Lead', voicemailLeft: false, by: 'Emani' }
        ],
        voicemailLeft: false,
        notes: [
          { id: id('note'), at: minuteAgo(14), by: 'Emani', text: 'Qualified. Wants evening call with licensed rep.', tags: ['qualified'] }
        ],
        assignedSetter: 'Emani',
        appointment: {
          dateTime: minuteAgo(-180),
          status: 'booked',
          calendar: 'Inner Circle Sales Calendar',
          setterNotes: 'Prefers Zoom. Mention retirement option.'
        },
        assignedAgentId: '',
        assignmentLog: [],
        followUpAt: ''
      }
    ],
    notifications: [],
    quickScripts: {
      firstCall: 'Hi {{name}}, this is {{setter}} with The Legacy Link. You requested information, do you have 2 minutes now?',
      voicemail: 'Hi {{name}}, this is {{setter}} with The Legacy Link. I just tried you. Call me back at {{supportPhone}} and I can help you get started today.',
      followUpText: 'Hey {{name}}, just following up from The Legacy Link. What time works best for a quick call today?',
      reschedule: 'No problem, {{name}}. Let’s get you rebooked. What time today or tomorrow works best?',
      noShowRecovery: 'Hey {{name}}, we missed you earlier. We can still get this done today—want me to lock a new time now?'
    }
  };
}

async function getStore() {
  const data = await loadJsonFile(STORE_PATH, null);
  if (!data || typeof data !== 'object') {
    const seeded = seedStore();
    await saveJsonFile(STORE_PATH, seeded);
    return seeded;
  }
  return data;
}

function appBaseUrl() {
  return clean(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function emailFrame(title = '', bodyHtml = '') {
  return `<div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:20px;color:#0f172a;"><div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><div style="background:#0f172a;color:#fff;padding:16px 20px;text-align:center;font-weight:800;font-size:24px;line-height:1;">THE LEGACY LINK</div><div style="padding:20px;"><h2 style="margin:0 0 12px;font-size:20px;">${title}</h2>${bodyHtml}<p style="margin:10px 0 0;color:#334155;"><strong>Legacy Link Support Team</strong></p></div></div></div>`;
}

async function sendAssignmentEmail({ agent = {}, lead = {}, assignedBy = '' }) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  const to = clean(agent?.email);
  if (!user || !pass || !to) return { ok: false, error: 'email_not_configured' };

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });

  const subject = `New Appointment Assigned • ${clean(lead?.fullName) || 'Lead'}`;
  const text = [
    `Hi ${clean(agent?.name) || 'Agent'},`,
    '',
    `${assignedBy || 'Operations'} assigned you a booked appointment.`,
    '',
    `Lead: ${clean(lead?.fullName) || '—'}`,
    `Phone: ${clean(lead?.phone) || '—'}`,
    `Email: ${clean(lead?.email) || '—'}`,
    `State: ${clean(lead?.state) || '—'}`,
    `Appointment: ${clean(lead?.appointment?.dateTime) || 'TBD'}`,
    `Setter Notes: ${clean(lead?.appointment?.setterNotes) || '—'}`,
    ''
  ].join('\n');

  const html = emailFrame(
    'New Appointment Assigned',
    `<p>Hi <strong>${clean(agent?.name) || 'Agent'}</strong>,</p>
     <p>${assignedBy || 'Operations'} assigned you a booked appointment.</p>
     <ul style="padding-left:18px;line-height:1.6;">
       <li><strong>Lead:</strong> ${clean(lead?.fullName) || '—'}</li>
       <li><strong>Phone:</strong> ${clean(lead?.phone) || '—'}</li>
       <li><strong>Email:</strong> ${clean(lead?.email) || '—'}</li>
       <li><strong>State:</strong> ${clean(lead?.state) || '—'}</li>
       <li><strong>Appointment:</strong> ${clean(lead?.appointment?.dateTime) || 'TBD'}</li>
       <li><strong>Setter Notes:</strong> ${clean(lead?.appointment?.setterNotes) || '—'}</li>
     </ul>`
  );

  try {
    const info = await tx.sendMail({ from, to, cc: 'support@thelegacylink.com', subject, text, html });
    return { ok: true, messageId: info?.messageId || '' };
  } catch (error) {
    return { ok: false, error: error?.message || 'send_failed' };
  }
}

async function sendAssignmentSms({ agent = {}, lead = {} }) {
  const token = clean(process.env.GHL_SMS_ROUTE_TOKEN || process.env.GHL_INTAKE_TOKEN);
  const phone = clean(agent?.phone);
  if (!token || !phone) return { ok: false, error: 'sms_not_configured' };

  const message = `The Legacy Link: New appointment assigned. Lead ${clean(lead?.fullName) || 'Lead'} (${clean(lead?.state) || '—'}) at ${clean(lead?.appointment?.dateTime) || 'TBD'}. Phone ${clean(lead?.phone) || '—'}.`;

  try {
    const res = await fetch(`${appBaseUrl()}/api/ghl-sms-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ phone, message })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      return { ok: false, error: clean(data?.error || `sms_http_${res.status}`) };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || 'sms_failed' };
  }
}

function currentWeekAssignments(leads = []) {
  const week = isoWeekKey(new Date());
  const rows = [];

  for (const lead of (leads || [])) {
    for (const a of (lead.assignmentLog || [])) {
      const at = new Date(a?.at || 0);
      if (Number.isNaN(at.getTime())) continue;
      if (isoWeekKey(at) !== week) continue;
      rows.push({
        leadId: lead.id,
        agentId: clean(a?.agentId),
        state: stateCodeFromAny(lead?.state),
        at: a.at
      });
    }
  }

  return rows;
}

function countAssignedByAgentState(leads = [], agentId = '', state = '') {
  const weekRows = currentWeekAssignments(leads);
  return weekRows.filter((r) => clean(r.agentId) === clean(agentId) && stateCodeFromAny(r.state) === stateCodeFromAny(state)).length;
}

function countAssignedByAgentAllStates(leads = [], agentId = '') {
  const weekRows = currentWeekAssignments(leads);
  return weekRows.filter((r) => clean(r.agentId) === clean(agentId)).length;
}

function eligibleAgentsForLead(agents = [], lead = {}) {
  const st = stateCodeFromAny(lead?.state);
  return (agents || []).filter((a) => {
    if (a?.active === false || a?.unavailable) return false;
    const licensed = Array.isArray(a?.licensedStates) ? a.licensedStates : [];
    return licensed.includes(st);
  });
}

function capForAgentState(store = {}, agent = {}, state = '') {
  const st = stateCodeFromAny(state);
  const perAgent = Number(agent?.weeklyCapByState?.[st]);
  if (Number.isFinite(perAgent) && perAgent > 0) return perAgent;

  const globalCap = Number(store?.settings?.stateCaps?.[st]);
  if (Number.isFinite(globalCap) && globalCap > 0) return globalCap;

  return 3;
}

function recommendAgent(store = {}, lead = {}) {
  const eligible = eligibleAgentsForLead(store?.agents || [], lead);
  if (!eligible.length) return null;

  const st = stateCodeFromAny(lead?.state);
  const ranked = eligible
    .map((a) => {
      const byState = countAssignedByAgentState(store?.leads || [], a.id, st);
      const total = countAssignedByAgentAllStates(store?.leads || [], a.id);
      const cap = capForAgentState(store, a, st);
      return {
        agent: a,
        byState,
        total,
        cap,
        capReached: byState >= cap
      };
    })
    .sort((a, b) => {
      if (a.capReached !== b.capReached) return a.capReached ? 1 : -1;
      if (a.byState !== b.byState) return a.byState - b.byState;
      if (a.total !== b.total) return a.total - b.total;
      return clean(a.agent?.name).localeCompare(clean(b.agent?.name));
    });

  return ranked[0] || null;
}

function pushTimeline(lead = {}, event = '') {
  const row = {
    id: id('tl'),
    at: nowIso(),
    event: clean(event)
  };

  const history = Array.isArray(lead?.timeline) ? lead.timeline : [];
  return [row, ...history].slice(0, 80);
}

function unauthorized() {
  return Response.json({ ok: false, error: 'missing_actor' }, { status: 401 });
}

export async function GET(req) {
  const store = await getStore();
  const { searchParams } = new URL(req.url);
  const includeRecommendation = clean(searchParams.get('recommendForLeadId'));

  let recommendation = null;
  if (includeRecommendation) {
    const lead = (store.leads || []).find((l) => clean(l.id) === includeRecommendation);
    if (lead) recommendation = recommendAgent(store, lead);
  }

  return Response.json({
    ok: true,
    store,
    recommendation
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = normalize(body?.action || '');
  const actorName = clean(body?.actorName);
  const actorRole = normalize(body?.actorRole || 'setter');

  if (!actorName) return unauthorized();

  const store = await getStore();
  const leads = Array.isArray(store?.leads) ? [...store.leads] : [];
  const notifications = Array.isArray(store?.notifications) ? [...store.notifications] : [];

  const leadId = clean(body?.leadId);
  const idx = leads.findIndex((l) => clean(l.id) === leadId);

  if (action === 'create_lead') {
    const lead = {
      id: id('lead'),
      fullName: clean(body?.fullName || 'Unknown Lead'),
      phone: clean(body?.phone),
      email: clean(body?.email),
      state: stateCodeFromAny(body?.state || ''),
      campaignSource: clean(body?.campaignSource || 'Manual'),
      productType: clean(body?.productType || 'General'),
      createdAt: nowIso(),
      status: 'New',
      priority: 'Urgent',
      attempts: [],
      voicemailLeft: false,
      notes: [],
      assignedSetter: actorName,
      appointment: null,
      assignedAgentId: '',
      assignmentLog: [],
      followUpAt: '',
      timeline: [
        { id: id('tl'), at: nowIso(), event: `Lead created by ${actorName}` }
      ]
    };

    leads.unshift(lead);
    await saveJsonFile(STORE_PATH, { ...store, leads, notifications });
    return Response.json({ ok: true, lead });
  }

  const nonLeadActions = new Set(['set_agent_availability', 'set_state_cap', 'set_settings']);
  if (idx < 0 && !nonLeadActions.has(action)) {
    return Response.json({ ok: false, error: 'lead_not_found' }, { status: 404 });
  }

  const current = idx >= 0 ? { ...leads[idx] } : null;

  if (action === 'update_status') {
    const status = clean(body?.status || 'New');
    const next = {
      ...current,
      status,
      assignedSetter: actorName,
      updatedAt: nowIso(),
      timeline: pushTimeline(current, `${actorName} set status to ${status}`)
    };
    leads[idx] = next;
    await saveJsonFile(STORE_PATH, { ...store, leads, notifications });
    return Response.json({ ok: true, lead: next });
  }

  if (action === 'log_call') {
    const outcome = clean(body?.outcome || 'Called');
    const voicemailLeft = Boolean(body?.voicemailLeft);
    const attempt = { id: id('attempt'), at: nowIso(), outcome, voicemailLeft, by: actorName };
    const next = {
      ...current,
      status: clean(body?.status || outcome),
      voicemailLeft: voicemailLeft || Boolean(current?.voicemailLeft),
      assignedSetter: actorName,
      attempts: [attempt, ...(current?.attempts || [])],
      updatedAt: nowIso(),
      timeline: pushTimeline(current, `${actorName} call outcome: ${outcome}${voicemailLeft ? ' (voicemail left)' : ''}`)
    };
    leads[idx] = next;
    await saveJsonFile(STORE_PATH, { ...store, leads, notifications });
    return Response.json({ ok: true, lead: next });
  }

  if (action === 'add_note') {
    const noteText = clean(body?.note);
    if (!noteText) return Response.json({ ok: false, error: 'missing_note' }, { status: 400 });

    const tags = Array.isArray(body?.tags) ? body.tags.map((t) => clean(t)).filter(Boolean) : [];
    const note = {
      id: id('note'),
      at: nowIso(),
      by: actorName,
      text: noteText,
      tags
    };

    const next = {
      ...current,
      notes: [note, ...(current?.notes || [])],
      updatedAt: nowIso(),
      timeline: pushTimeline(current, `${actorName} added a note`)
    };
    leads[idx] = next;
    await saveJsonFile(STORE_PATH, { ...store, leads, notifications });
    return Response.json({ ok: true, lead: next });
  }

  if (action === 'schedule_followup') {
    const followUpAt = clean(body?.followUpAt);
    const next = {
      ...current,
      followUpAt,
      status: clean(body?.status || 'Follow-Up Needed'),
      updatedAt: nowIso(),
      timeline: pushTimeline(current, `${actorName} scheduled follow-up for ${followUpAt || 'later'}`)
    };
    leads[idx] = next;
    await saveJsonFile(STORE_PATH, { ...store, leads, notifications });
    return Response.json({ ok: true, lead: next });
  }

  if (action === 'book_appointment') {
    const appointment = {
      dateTime: clean(body?.dateTime),
      calendar: clean(body?.calendar || 'Inner Circle Calendar'),
      status: clean(body?.appointmentStatus || 'booked'),
      setterNotes: clean(body?.setterNotes || '')
    };

    const next = {
      ...current,
      status: 'Booked',
      appointment,
      assignedSetter: actorName,
      updatedAt: nowIso(),
      timeline: pushTimeline(current, `${actorName} booked appointment for ${appointment.dateTime || 'TBD'}`)
    };
    leads[idx] = next;
    await saveJsonFile(STORE_PATH, { ...store, leads, notifications });
    return Response.json({ ok: true, lead: next });
  }

  if (action === 'set_appointment_status') {
    const status = clean(body?.appointmentStatus || 'booked');
    const next = {
      ...current,
      appointment: {
        ...(current?.appointment || {}),
        status
      },
      status: status.toLowerCase() === 'no-show' ? 'No-Show' : current.status,
      updatedAt: nowIso(),
      timeline: pushTimeline(current, `${actorName} set appointment status to ${status}`)
    };
    leads[idx] = next;
    await saveJsonFile(STORE_PATH, { ...store, leads, notifications });
    return Response.json({ ok: true, lead: next });
  }

  if (action === 'assign_agent' || action === 'auto_assign') {
    const workingLead = { ...current };
    const rec = recommendAgent(store, workingLead);
    const mode = clean(store?.settings?.assignmentMode || 'smart').toLowerCase();

    if (action === 'auto_assign' && mode === 'manual' && !(actorRole === 'admin' || actorRole === 'manager')) {
      return Response.json({ ok: false, error: 'auto_assign_disabled_in_manual_mode' }, { status: 409 });
    }

    const selectedAgentId = action === 'auto_assign'
      ? clean(rec?.agent?.id)
      : clean(body?.agentId);

    const agent = (store.agents || []).find((a) => clean(a.id) === selectedAgentId);
    if (!agent) return Response.json({ ok: false, error: 'agent_not_found' }, { status: 404 });

    if (action === 'assign_agent' && mode === 'round-robin' && clean(rec?.agent?.id) && clean(rec?.agent?.id) !== clean(agent?.id) && !(actorRole === 'admin' || actorRole === 'manager')) {
      return Response.json({ ok: false, error: 'round_robin_locked', recommendedAgentId: clean(rec?.agent?.id), recommendedAgentName: clean(rec?.agent?.name) }, { status: 409 });
    }

    const state = stateCodeFromAny(workingLead?.state);
    const eligible = eligibleAgentsForLead(store?.agents || [], workingLead).some((a) => clean(a.id) === selectedAgentId);
    if (!eligible) return Response.json({ ok: false, error: 'agent_not_eligible_for_state' }, { status: 409 });

    const cap = capForAgentState(store, agent, state);
    const assigned = countAssignedByAgentState(store?.leads || [], agent.id, state);
    const adminOverride = Boolean(body?.adminOverride);
    const mayOverride = (actorRole === 'admin' || actorRole === 'manager') && Boolean(store?.settings?.adminOverrideEnabled);
    if (assigned >= cap && !(adminOverride && mayOverride)) {
      return Response.json({
        ok: false,
        error: 'cap_reached',
        details: { assigned, cap, state, agentId: agent.id, agentName: agent.name }
      }, { status: 409 });
    }

    const assignment = {
      id: id('assign'),
      at: nowIso(),
      by: actorName,
      agentId: agent.id,
      agentName: clean(agent.name),
      state,
      mode: action === 'auto_assign' ? 'recommended' : 'manual',
      adminOverride: adminOverride && mayOverride
    };

    const next = {
      ...workingLead,
      assignedAgentId: agent.id,
      status: 'Booked',
      assignmentLog: [assignment, ...(workingLead?.assignmentLog || [])],
      updatedAt: nowIso(),
      timeline: pushTimeline(workingLead, `${actorName} assigned ${agent.name} (${state})`)
    };

    leads[idx] = next;

    const emailResult = await sendAssignmentEmail({ agent, lead: next, assignedBy: actorName });
    const smsResult = await sendAssignmentSms({ agent, lead: next });

    notifications.unshift({
      id: id('ntf'),
      at: nowIso(),
      type: 'assignment',
      recipientAgentId: agent.id,
      recipientAgentName: clean(agent.name),
      channel: `in-app${emailResult?.ok ? '/email' : ''}${smsResult?.ok ? '/sms' : ''}`,
      title: 'New Appointment Assigned',
      body: `${next.fullName} (${state}) booked for ${clean(next?.appointment?.dateTime || 'TBD')}`,
      payload: {
        leadName: next.fullName,
        leadPhone: next.phone,
        leadEmail: next.email,
        state,
        appointmentDateTime: clean(next?.appointment?.dateTime || ''),
        notes: clean(next?.appointment?.setterNotes || '')
      },
      emailStatus: emailResult?.ok ? 'sent' : 'failed',
      emailError: emailResult?.ok ? '' : clean(emailResult?.error),
      smsStatus: smsResult?.ok ? 'sent' : 'failed',
      smsError: smsResult?.ok ? '' : clean(smsResult?.error)
    });

    await saveJsonFile(STORE_PATH, { ...store, leads, notifications: notifications.slice(0, 250) });
    return Response.json({ ok: true, lead: next, assignment, notificationQueued: true, assignmentEmail: emailResult?.ok ? 'sent' : 'failed', assignmentEmailError: emailResult?.ok ? '' : clean(emailResult?.error), assignmentSms: smsResult?.ok ? 'sent' : 'failed', assignmentSmsError: smsResult?.ok ? '' : clean(smsResult?.error) });
  }

  if (action === 'recover_no_show') {
    const next = {
      ...current,
      status: 'Follow-Up Needed',
      followUpAt: clean(body?.followUpAt) || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      updatedAt: nowIso(),
      timeline: pushTimeline(current, `${actorName} moved lead into no-show recovery queue`),
      notes: [{ id: id('note'), at: nowIso(), by: actorName, text: clean(body?.note || 'No-show recovery initiated.'), tags: ['no-show', 'recovery'] }, ...(current?.notes || [])]
    };

    leads[idx] = next;
    await saveJsonFile(STORE_PATH, { ...store, leads, notifications });
    return Response.json({ ok: true, lead: next });
  }

  if (action === 'set_settings') {
    if (!(actorRole === 'admin' || actorRole === 'manager')) {
      return Response.json({ ok: false, error: 'admin_or_manager_only' }, { status: 403 });
    }

    const nextSettings = {
      ...(store?.settings || {}),
      ...(body?.settings || {}),
      slaMinutes: Math.max(1, Number(body?.settings?.slaMinutes ?? store?.settings?.slaMinutes ?? 5)),
      adminOverrideEnabled: body?.settings?.adminOverrideEnabled === undefined
        ? Boolean(store?.settings?.adminOverrideEnabled)
        : Boolean(body?.settings?.adminOverrideEnabled),
      assignmentMode: clean(body?.settings?.assignmentMode || store?.settings?.assignmentMode || 'smart')
    };

    await saveJsonFile(STORE_PATH, { ...store, settings: nextSettings, leads, notifications });
    return Response.json({ ok: true, settings: nextSettings });
  }

  if (action === 'set_agent_availability') {
    if (!(actorRole === 'admin' || actorRole === 'manager')) {
      return Response.json({ ok: false, error: 'admin_or_manager_only' }, { status: 403 });
    }

    const agentId = clean(body?.agentId);
    const agents = Array.isArray(store?.agents) ? [...store.agents] : [];
    const aidx = agents.findIndex((a) => clean(a.id) === agentId);
    if (aidx < 0) return Response.json({ ok: false, error: 'agent_not_found' }, { status: 404 });

    agents[aidx] = {
      ...agents[aidx],
      active: body?.active === undefined ? agents[aidx].active : Boolean(body?.active),
      unavailable: body?.unavailable === undefined ? agents[aidx].unavailable : Boolean(body?.unavailable)
    };

    await saveJsonFile(STORE_PATH, { ...store, agents, leads, notifications });
    return Response.json({ ok: true, agent: agents[aidx] });
  }

  if (action === 'set_state_cap') {
    if (!(actorRole === 'admin' || actorRole === 'manager')) {
      return Response.json({ ok: false, error: 'admin_or_manager_only' }, { status: 403 });
    }

    const state = stateCodeFromAny(body?.state);
    const cap = Math.max(1, Number(body?.cap || 1));
    const settings = {
      ...(store?.settings || {}),
      stateCaps: {
        ...((store?.settings || {}).stateCaps || {}),
        [state]: cap
      }
    };

    await saveJsonFile(STORE_PATH, { ...store, settings, leads, notifications });
    return Response.json({ ok: true, settings });
  }

  return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
}
