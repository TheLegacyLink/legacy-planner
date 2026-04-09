import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import { DEFAULT_CONFIG } from '../../../lib/runtimeConfig';

const FB_LEADS_PATH = 'stores/fb-leads.json';
const SPONSORSHIP_PATH = 'stores/sponsorship-applications.json';
const POLICY_PATH = 'stores/policy-submissions.json';
const EVENTS_PATH = 'stores/lead-router-events.json';
const AGENT_LICENSED_STATES_PATH = 'stores/agent-licensed-states.json';

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
  // Groups ALL rows per agent (agents appear once per state)
  const map = new Map();
  // Also build email->name map to resolve aliases like INVESTALINK
  const emailToKey = new Map();

  for (const agent of agentsData) {
    if (!agent.full_name || agent.full_name.includes('Legend')) continue;
    const stateCode = String(agent.state_code || agent.home_state || '').toUpperCase().trim();
    if (!stateCode || stateCode.length !== 2) continue;

    let fullName = agent.full_name.trim().toUpperCase();
    // Remap INVESTALINK to KIMORA LINK
    if (fullName === 'INVESTALINK') fullName = 'LINK, KIMORA';

    const parsed = parseAgentNameParts(fullName);
    const key = `${parsed.last}|${parsed.first}`;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(stateCode);

    // Track email -> key for alias resolution
    if (agent.email) {
      emailToKey.set(String(agent.email).toLowerCase().trim(), key);
    }
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

    // Merge self-service licensed states from agent back office
    let agentLicensedStatesOverride = {};
    try {
      const overrideStore = await loadJsonStore(AGENT_LICENSED_STATES_PATH, {});
      agentLicensedStatesOverride = (overrideStore && typeof overrideStore === 'object' && !Array.isArray(overrideStore)) ? overrideStore : {};
    } catch { /* best-effort */ }

    // Build a name→email map from licensedAgentsData for override lookup
    const nameToEmail = new Map();
    for (const a of licensedAgentsData) {
      if (a.email && (a.full_name || a.fullName)) {
        const displayName = String(a.full_name || a.fullName || '').trim().toLowerCase();
        nameToEmail.set(displayName, String(a.email).toLowerCase().trim());
      }
    }

    const agentList = getActiveAgentList();
    const agents = agentList.map((name) => {
      const baseStates = lookupAgentStates(name, statesMap);
      // Look up override by email
      const emailKey = nameToEmail.get(name.toLowerCase().trim()) || '';
      const overrideStates = emailKey && Array.isArray(agentLicensedStatesOverride[emailKey])
        ? agentLicensedStatesOverride[emailKey]
        : [];
      // Merge: union of base + override
      const merged = overrideStates.length
        ? [...new Set([...baseStates, ...overrideStates])].sort()
        : baseStates;
      return {
        name,
        todayCount: agentTodayCounts[name] || 0,
        licensedStates: merged
      };
    });

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
  // If leadId is provided, assign THAT specific lead instead of oldest N untouched.
  try {
    const body = await req.json().catch(() => ({}));
    const agentName = String(body?.agentName || '').trim();
    const count = Math.max(1, Math.min(500, Number(body?.count || 1)));
    const specificLeadId = String(body?.leadId || '').trim();

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

    let batch;

    if (specificLeadId) {
      // Per-lead assign: find the specific lead by ID
      const specificLead = fbLeads.find((l) => l.id === specificLeadId);
      if (!specificLead) {
        return Response.json({ ok: false, error: 'lead_not_found' }, { status: 404 });
      }
      batch = [specificLead];
    } else {
      // Untouched leads sorted oldest first (for bulk distribution)
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
      batch = untouched.slice(0, count);
    }

    if (!batch.length) {
      return Response.json({ ok: true, sent: 0, agentName, message: 'No leads available.' });
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

    // Update GHL contact owner + add tag for each lead (best-effort, lookup by email)
    try {
      const ghlToken = String(process.env.GHL_API_TOKEN || '').trim();
      // Support both GHL_AGENT_USER_MAP_JSON (fb-leads specific) and GHL_USER_ID_MAP_JSON (lead-router pattern)
      const agentUserMapRaw = String(process.env.GHL_AGENT_USER_MAP_JSON || process.env.GHL_USER_ID_MAP_JSON || '{}');
      let agentUserMap = {};
      try { agentUserMap = JSON.parse(agentUserMapRaw); } catch { /* ignore */ }
      const ghlUserId = agentUserMap[agentName] || agentUserMap[agentName.toLowerCase()] || '';
      const tagName = 'legacy';

      if (ghlToken) {
        const ghlHeaders = {
          Authorization: `Bearer ${ghlToken}`,
          'Content-Type': 'application/json',
          Version: '2021-07-28'
        };
        // Try multiple base URLs same as lead-router
        const ghlBases = [
          String(process.env.GHL_API_BASE_URL || '').replace(/\/$/, ''),
          'https://services.leadconnectorhq.com',
          'https://rest.gohighlevel.com'
        ].filter(Boolean);

        const ghlGet = async (path) => {
          for (const base of ghlBases) {
            for (const prefix of ['/contacts', '/v1/contacts']) {
              try {
                const res = await fetch(`${base}${prefix}${path}`, { method: 'GET', headers: ghlHeaders, cache: 'no-store' });
                if (res.ok) return await res.json().catch(() => ({}));
              } catch { /* try next */ }
            }
          }
          return {};
        };

        const ghlPut = async (path, body) => {
          for (const base of ghlBases) {
            for (const prefix of ['/contacts', '/v1/contacts']) {
              try {
                const res = await fetch(`${base}${prefix}${path}`, { method: 'PUT', headers: ghlHeaders, body: JSON.stringify(body), cache: 'no-store' });
                if (res.ok) return true;
              } catch { /* try next */ }
            }
          }
          return false;
        };

        let ghlContactIdsUpdated = false;
        await Promise.allSettled(batch.map(async (lead) => {
          const email = String(lead.email || '').trim();
          const phone = normalizePhone(lead.phone_number);

          // Step 1: Use stored ghlContactId if available, otherwise search by email then phone
          let ghlContactId = String(lead.ghlContactId || '').trim();

          if (!ghlContactId && email) {
            try {
              const searchData = await ghlGet(`/?email=${encodeURIComponent(email)}`);
              ghlContactId = String(searchData?.contacts?.[0]?.id || '').trim();
            } catch { /* skip */ }
          }

          if (!ghlContactId && phone) {
            try {
              const searchData = await ghlGet(`/?phone=${encodeURIComponent(phone)}`);
              ghlContactId = String(searchData?.contacts?.[0]?.id || '').trim();
            } catch { /* skip */ }
          }

          if (!ghlContactId) {
            console.log(`[fb-leads] GHL contact not found for email: ${email}, phone: ${phone}`);
            return;
          }

          // Cache ghlContactId on the lead record for future distributions
          if (!lead.ghlContactId) {
            lead.ghlContactId = ghlContactId;
            ghlContactIdsUpdated = true;
          }

          // Step 2: GET contact to fetch existing tags
          let existingTags = [];
          try {
            const getData = await ghlGet(`/${ghlContactId}`);
            existingTags = Array.isArray(getData?.contact?.tags) ? getData.contact.tags : [];
          } catch { /* skip */ }

          // Step 3: Build merged tags
          const mergedTags = existingTags.includes(tagName) ? existingTags : [...existingTags, tagName];

          // Step 4: PUT — update owner + tags together
          const putBody = { tags: mergedTags };
          if (ghlUserId) putBody.assignedTo = ghlUserId;

          try {
            await ghlPut(`/${ghlContactId}`, putBody);
          } catch { /* skip */ }
        }));

        // Persist any newly discovered ghlContactIds back to the store
        if (ghlContactIdsUpdated) {
          await saveJsonStore(FB_LEADS_PATH, fbLeads).catch(() => {});
        }
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
            (l, i) =>
              `<div style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
                <p style="margin:0 0 4px;font-size:16px;font-weight:bold;color:#0f172a;">${i + 1}. ${l.full_name || '—'}</p>
                <p style="margin:0;color:#475569;font-size:14px;">
                  📞 ${l.phone_number || '—'} &nbsp;|&nbsp; ✉️ ${l.email || '—'} &nbsp;|&nbsp; 📍 ${l.state || '—'}
                </p>
              </div>`
          )
          .join('');

        const html = `
          <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;max-width:600px;">
            <h2 style="margin:0 0 4px;color:#0f172a;">New Lead Batch — ${batch.length} Lead${batch.length !== 1 ? 's' : ''} Assigned</h2>
            <p style="margin:0 0 16px;color:#64748b;font-size:14px;">Assigned to <strong>${agentName}</strong> · ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' })}</p>
            <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
              ${leadListHtml}
            </div>
            <p style="margin:0 0 8px;">Please reach out to each lead within <strong>10 minutes</strong> of receiving this email and log all activity in your Back Office.</p>
            <p style="margin:0;color:#64748b;font-size:13px;">— The Legacy Link Support Team</p>
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

    // Push each lead to Lead Router for reliable GHL assignment via proven externalId path
    let leadRouterResult = { ok: false, reason: 'not_attempted' };
    try {
      const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || 'https://innercirclelink.com').replace(/\/$/, '');
      const intakeToken = String(process.env.GHL_INTAKE_TOKEN || '');
      const routerResults = await Promise.allSettled(
        batch.map((lead) =>
          fetch(`${appUrl}/api/lead-router`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-source': 'lead-hub'
            },
            body: JSON.stringify({
              mode: 'manual-assign',
              name: lead.full_name,
              email: lead.email,
              phone: lead.phone_number,
              externalId: lead.ghlContactId || lead.id, // use GHL contact ID if we have it
              assignTo: agentName,
              source: 'lead-hub'
            }),
            cache: 'no-store'
          })
            .then((r) => r.json().catch(() => ({ ok: false })))
            .catch(() => ({ ok: false, reason: 'fetch_error' }))
        )
      );
      const succeeded = routerResults.filter((r) => r.status === 'fulfilled' && r.value?.ok).length;
      leadRouterResult = { ok: succeeded > 0, sent: batch.length, succeeded };
    } catch (routerErr) {
      leadRouterResult = { ok: false, reason: String(routerErr?.message || 'router_push_failed') };
    }

    return Response.json({
      ok: true,
      sent: batch.length,
      agentName,
      emailResult,
      message: `Sent ${batch.length} leads to ${agentName}`,
      leadRouterResult
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err?.message || 'distribute_failed') },
      { status: 500 }
    );
  }
}
