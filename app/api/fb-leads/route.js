import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import { DEFAULT_CONFIG } from '../../../lib/runtimeConfig';

const FB_LEADS_PATH = 'stores/fb-leads.json';
const SPONSORSHIP_PATH = 'stores/sponsorship-applications.json';
const POLICY_PATH = 'stores/policy-submissions.json';
const EVENTS_PATH = 'stores/lead-router-events.json';

// ─── Licensed-States Helpers ──────────────────────────────────────────────

function parseAgentNameParts(rawName) {
  const str = String(rawName || '').trim();
  if (str.includes(',')) {
    const commaIdx = str.indexOf(',');
    const last = str.slice(0, commaIdx).trim().toLowerCase();
    const firstPart = str.slice(commaIdx + 1).trim().split(/\s+/)[0].toLowerCase();
    return { first: firstPart, last };
  }
  const parts = str.toLowerCase().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts[0], last: parts[parts.length - 1] };
}

function buildLicensedStatesMap(agentsData) {
  // Returns Map: "last|first" -> Set<state_code>
  const map = new Map();
  for (const agent of agentsData) {
    if (!agent.full_name || !agent.state_code) continue;
    const parsed = parseAgentNameParts(agent.full_name);
    const key = `${parsed.last}|${parsed.first}`;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(String(agent.state_code).toUpperCase());
  }
  return map;
}

function lookupAgentStates(displayName, statesMap) {
  const parsed = parseAgentNameParts(displayName);

  // Try exact match
  const exactKey = `${parsed.last}|${parsed.first}`;
  if (statesMap.has(exactKey)) {
    return Array.from(statesMap.get(exactKey)).sort();
  }

  // Fallback: same last name + first 3 chars of first name (handles spelling variants)
  const prefix = parsed.first.slice(0, Math.min(3, parsed.first.length));
  for (const [key, states] of statesMap) {
    const [kLast, kFirst] = key.split('|');
    if (kLast === parsed.last && kFirst.startsWith(prefix)) {
      return Array.from(states).sort();
    }
  }

  return [];
}

// ─── Agent list (mirrors page.js logic) ─────────────────────────────────────
function getActiveAgentList() {
  const base = (DEFAULT_CONFIG.agents || []).filter((a) => a !== 'Kimora Link');
  const set = new Set(base.map((a) => a.toLowerCase()));
  if (!set.has('andrea cannon')) return ['Andrea Cannon', ...base];
  return base;
}

// ─── Normalizers ─────────────────────────────────────────────────────────────
function normalizeEmail(e = '') {
  return String(e || '').trim().toLowerCase();
}

function normalizePhone(p = '') {
  return String(p || '').replace(/\D/g, '').slice(-10);
}

function computeStatus(lead, sponsorEmails, policyEmails, contactedEmails, sponsorPhones, policyPhones) {
  const email = normalizeEmail(lead.email);
  const phone = normalizePhone(lead.phone_number);
  if ((email && policyEmails.has(email)) || (phone && policyPhones.has(phone))) return 'app_submitted';
  if ((email && sponsorEmails.has(email)) || (phone && sponsorPhones.has(phone))) return 'form_submitted';
  if (email && contactedEmails.has(email)) return 'contacted';
  if (lead.distributedTo) return 'contacted';
  return 'untouched';
}

export async function GET() {
  try {
    const [fbLeads, sponsorships, policies, events] = await Promise.all([
      loadJsonStore(FB_LEADS_PATH, []),
      loadJsonStore(SPONSORSHIP_PATH, []),
      loadJsonStore(POLICY_PATH, []),
      loadJsonStore(EVENTS_PATH, [])
    ]);

    const sponsorEmails = new Set(
      sponsorships
        .map((r) => normalizeEmail(r?.email || r?.applicant_email || ''))
        .filter(Boolean)
    );
    const sponsorPhones = new Set(
      sponsorships
        .map((r) => normalizePhone(r?.phone || r?.applicant_phone || ''))
        .filter(Boolean)
    );

    const policyEmails = new Set(
      policies
        .map((r) => normalizeEmail(r?.email || r?.applicant_email || ''))
        .filter(Boolean)
    );
    const policyPhones = new Set(
      policies
        .map((r) => normalizePhone(r?.phone || r?.applicant_phone || ''))
        .filter(Boolean)
    );

    // Build "contacted" set from lead-router-events: any assignment event with an email
    const contactedEmails = new Set();
    for (const evt of events) {
      const evtEmail = normalizeEmail(evt?.email || '');
      if (evtEmail) contactedEmails.add(evtEmail);
    }

    // Today's CST date key
    const todayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const leads = fbLeads.map((lead) => ({
      ...lead,
      status: computeStatus(lead, sponsorEmails, policyEmails, contactedEmails, sponsorPhones, policyPhones)
    }));

    const stats = {
      total: leads.length,
      untouched: leads.filter((l) => l.status === 'untouched').length,
      contacted: leads.filter((l) => l.status === 'contacted').length,
      form_submitted: leads.filter((l) => l.status === 'form_submitted').length,
      app_submitted: leads.filter((l) => l.status === 'app_submitted').length
    };

    // Count today's distributed leads per agent
    const agentTodayCounts = {};
    for (const lead of fbLeads) {
      if (
        lead.distributedTo &&
        lead.distributedAt &&
        lead.distributedAt.startsWith(todayKey)
      ) {
        agentTodayCounts[lead.distributedTo] =
          (agentTodayCounts[lead.distributedTo] || 0) + 1;
      }
    }

    // Build agents array with licensed states
    let licensedAgentsData = [];
    try {
      const mod = await import('../../../data/licensedAgents.json', { assert: { type: 'json' } });
      licensedAgentsData = Array.isArray(mod?.default) ? mod.default : [];
    } catch { /* best-effort */ }

    const statesMap = buildLicensedStatesMap(licensedAgentsData);
    const agentList = getActiveAgentList();
    const agents = agentList.map((name) => ({
      name,
      todayCount: agentTodayCounts[name] || 0,
      licensedStates: lookupAgentStates(name, statesMap)
    }));

    return Response.json({ ok: true, leads, stats, agentTodayCounts, agents });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err?.message || 'load_failed') },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  // Distribution endpoint: assign N untouched leads to an agent and send email
  try {
    const body = await req.json().catch(() => ({}));
    const agentName = String(body?.agentName || '').trim();
    const count = Math.max(1, Math.min(500, Number(body?.count || 1)));

    if (!agentName) {
      return Response.json({ ok: false, error: 'missing_agent_name' }, { status: 400 });
    }

    const [fbLeads, sponsorships, policies, events] = await Promise.all([
      loadJsonStore(FB_LEADS_PATH, []),
      loadJsonStore(SPONSORSHIP_PATH, []),
      loadJsonStore(POLICY_PATH, []),
      loadJsonStore(EVENTS_PATH, [])
    ]);

    const sponsorEmails = new Set(
      sponsorships.map((r) => normalizeEmail(r?.email || r?.applicant_email || '')).filter(Boolean)
    );
    const sponsorPhones = new Set(
      sponsorships.map((r) => normalizePhone(r?.phone || r?.applicant_phone || '')).filter(Boolean)
    );
    const policyEmails = new Set(
      policies.map((r) => normalizeEmail(r?.email || r?.applicant_email || '')).filter(Boolean)
    );
    const policyPhones = new Set(
      policies.map((r) => normalizePhone(r?.phone || r?.applicant_phone || '')).filter(Boolean)
    );
    const contactedEmails = new Set();
    for (const evt of events) {
      const evtEmail = normalizeEmail(evt?.email || '');
      if (evtEmail) contactedEmails.add(evtEmail);
    }

    // Untouched leads sorted oldest first
    const untouched = fbLeads
      .filter((l) => {
        const status = computeStatus(l, sponsorEmails, policyEmails, contactedEmails, sponsorPhones, policyPhones);
        return status === 'untouched';
      })
      .sort((a, b) => {
        const aTime = new Date(a.created_time || a.importedAt || 0).getTime();
        const bTime = new Date(b.created_time || b.importedAt || 0).getTime();
        return aTime - bTime;
      });

    const batch = untouched.slice(0, count);

    if (!batch.length) {
      return Response.json({ ok: true, sent: 0, agentName, message: 'No untouched leads available.' });
    }

    const now = new Date().toISOString();

    // Mark leads as distributed
    const batchIds = new Set(batch.map((l) => l.id));
    for (const lead of fbLeads) {
      if (batchIds.has(lead.id)) {
        lead.distributedTo = agentName;
        lead.distributedAt = now;
      }
    }

    await saveJsonStore(FB_LEADS_PATH, fbLeads);

    // Update GHL contact owner for each lead in the batch
    try {
      const ghlToken = String(process.env.GHL_API_TOKEN || '').trim();
      const ghlUserMapRaw = String(process.env.GHL_AGENT_USER_MAP_JSON || '{}');
      let ghlUserMap = {};
      try { ghlUserMap = JSON.parse(ghlUserMapRaw); } catch { /* ignore */ }
      const ghlUserId = ghlUserMap[agentName] || ghlUserMap[agentName.toLowerCase()] || '';
      if (ghlToken && ghlUserId) {
        const ghlBaseUrl = 'https://rest.gohighlevel.com/v1/contacts';
        await Promise.allSettled(batch.map(async (lead) => {
          const contactId = lead.id; // Facebook lead ID = GHL contact external ID
          if (!contactId) return;
          await fetch(`${ghlBaseUrl}/${contactId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ghlToken}` },
            body: JSON.stringify({ assignedTo: ghlUserId })
          });
        }));
      }
    } catch { /* GHL update is best-effort */ }

    // Send notification email using nodemailer (same pattern as lead-router)
    let emailResult = { ok: false, reason: 'not_attempted' };
    try {
      const { default: nodemailer } = await import('nodemailer');
      const gmailUser = String(process.env.GMAIL_APP_USER || '').trim();
      const gmailPass = String(process.env.GMAIL_APP_PASSWORD || '').trim();
      const gmailFrom = String(process.env.GMAIL_FROM || gmailUser).trim();

      // Look up agent email from users data
      let agentEmail = '';
      try {
        const { default: users } = await import('../../../data/innerCircleUsers.json', { assert: { type: 'json' } });
        const normalizeN = (n) => String(n || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const found = (users || []).find((u) => normalizeN(u?.name) === normalizeN(agentName));
        agentEmail = String(found?.email || '').trim();
      } catch {
        // fallback
      }

      if (!agentEmail) {
        // Try env map
        const mapRaw = String(process.env.LEAD_AGENT_EMAIL_MAP_JSON || '{}');
        try {
          const map = JSON.parse(mapRaw);
          agentEmail = String(map?.[agentName] || map?.[agentName.toLowerCase()] || '').trim();
        } catch { /* ignore */ }
      }

      if (agentEmail && gmailUser && gmailPass) {
        const tx = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });

        const leadListHtml = batch
          .map(
            (l) =>
              `<tr>
                <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${l.full_name || '—'}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${l.email || '—'}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${l.phone_number || '—'}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${l.state || '—'}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${l.platform || 'fb'}</td>
              </tr>`
          )
          .join('');

        const html = `
          <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;">
            <h2 style="margin:0 0 12px;">New Lead Batch — ${batch.length} Leads Assigned</h2>
            <p>Hi <strong>${agentName}</strong>,</p>
            <p>You've been assigned <strong>${batch.length}</strong> new Facebook leads to work. Please reach out to each lead as soon as possible.</p>
            <table style="width:100%;border-collapse:collapse;margin-top:12px;">
              <thead>
                <tr style="background:#f1f5f9;">
                  <th style="padding:8px 10px;text-align:left;">Name</th>
                  <th style="padding:8px 10px;text-align:left;">Email</th>
                  <th style="padding:8px 10px;text-align:left;">Phone</th>
                  <th style="padding:8px 10px;text-align:left;">State</th>
                  <th style="padding:8px 10px;text-align:left;">Platform</th>
                </tr>
              </thead>
              <tbody>${leadListHtml}</tbody>
            </table>
            <p style="margin-top:16px;">Please log all activity in your Back Office and reach out within 10 minutes of receiving this email.</p>
            <p>— The Legacy Link Support Team</p>
          </div>`;

        const info = await tx.sendMail({
          from: gmailFrom,
          to: agentEmail,
          cc: 'support@thelegacylink.com',
          subject: `${batch.length} New Leads Assigned — The Legacy Link`,
          html
        });

        emailResult = { ok: true, messageId: info?.messageId || '' };
      } else {
        emailResult = { ok: false, reason: 'email_not_configured' };
      }
    } catch (emailErr) {
      emailResult = { ok: false, reason: String(emailErr?.message || 'email_failed') };
    }

    return Response.json({
      ok: true,
      sent: batch.length,
      agentName,
      emailResult,
      message: `Sent ${batch.length} leads to ${agentName}`
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err?.message || 'distribute_failed') },
      { status: 500 }
    );
  }
}
