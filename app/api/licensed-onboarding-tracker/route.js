import nodemailer from 'nodemailer';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import * as sponsorshipApps from '../sponsorship-applications/route';
import licensedAgents from '../../../data/licensedAgents.json';
import innerCircleUsers from '../../../data/innerCircleUsers.json';

const STORE_PATH = 'stores/licensed-onboarding-tracker.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function nowIso() { return new Date().toISOString(); }
function bool(v) { return normalize(v) === 'yes' || normalize(v) === 'licensed' || normalize(v) === 'true'; }

function personKey({ email = '', name = '' } = {}) {
  const em = normalize(email);
  if (em) return `email:${em}`;
  return `name:${normalize(name)}`;
}

function firstStepKey(stepOrder = []) {
  return Array.isArray(stepOrder) && stepOrder.length ? stepOrder[0] : '';
}

function safeJson(value, fallback) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return fallback; }
}

function displayNameFromApp(row = {}) {
  const full = clean(row?.fullName || `${clean(row?.firstName)} ${clean(row?.lastName)}`);
  return full || clean(row?.applicantName || 'Unknown');
}

function sponsorFromApp(row = {}) {
  return clean(row?.sponsorDisplayName || row?.referralName || row?.referredByName || row?.referred_by || '');
}

function buildNameEmailIndex() {
  const map = new Map();

  for (const a of Array.isArray(licensedAgents) ? licensedAgents : []) {
    const name = clean(a?.full_name || a?.fullName || '');
    const normalizedName = name.includes(',')
      ? normalize(`${clean(name.split(',')[1] || '')} ${clean(name.split(',')[0] || '')}`)
      : normalize(name);
    const email = clean(a?.email || '').toLowerCase();
    if (normalizedName && email && !map.has(normalizedName)) map.set(normalizedName, email);
  }

  for (const u of Array.isArray(innerCircleUsers) ? innerCircleUsers : []) {
    const n = normalize(u?.name || u?.fullName || '');
    const e = clean(u?.email || '').toLowerCase();
    if (n && e && !map.has(n)) map.set(n, e);
  }

  return map;
}

function mapRole(role = '') {
  const r = normalize(role);
  return r === 'admin' ? 'admin' : 'agent';
}

async function loadReferralRows() {
  const req = new Request('http://local/api/sponsorship-applications', { method: 'GET' });
  const res = await sponsorshipApps.GET(req);
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data?.rows) ? data.rows : [];
}

function buildGraph(referralRows = []) {
  const emailByName = buildNameEmailIndex();
  const childrenBySponsor = new Map();
  const parentsByNode = new Map();
  const nodes = new Map();

  const addChild = (sponsorName, recruitNode) => {
    const sponsorKey = normalize(sponsorName);
    if (!sponsorKey) return;
    if (!childrenBySponsor.has(sponsorKey)) childrenBySponsor.set(sponsorKey, new Set());
    childrenBySponsor.get(sponsorKey).add(recruitNode.nodeKey);

    if (!parentsByNode.has(recruitNode.nodeKey)) parentsByNode.set(recruitNode.nodeKey, new Set());
    parentsByNode.get(recruitNode.nodeKey).add(sponsorKey);
  };

  for (const row of referralRows) {
    const licensed = bool(row?.isLicensed || row?.licensed || row?.licensedStatus);
    if (!licensed) continue;

    const recruitName = displayNameFromApp(row);
    const recruitEmail = clean(row?.email || row?.applicantEmail || '').toLowerCase() || clean(emailByName.get(normalize(recruitName)) || '').toLowerCase();
    const sponsorName = sponsorFromApp(row);

    if (!recruitName) continue;

    const nodeKey = personKey({ email: recruitEmail, name: recruitName });
    const existing = nodes.get(nodeKey) || {};

    nodes.set(nodeKey, {
      nodeKey,
      agentName: recruitName,
      agentEmail: recruitEmail,
      sponsorName: sponsorName || existing.sponsorName || '',
      joinedAt: clean(existing.joinedAt || row?.submitted_at || row?.createdAt || nowIso())
    });

    if (sponsorName) addChild(sponsorName, { nodeKey });
  }

  return { nodes, childrenBySponsor, parentsByNode, emailByName };
}

function descendantsForViewer(viewerName = '', graph) {
  const start = normalize(viewerName);
  if (!start) return new Set();
  const out = new Set();
  const stack = [start];
  const seenSponsors = new Set();

  while (stack.length) {
    const sponsor = stack.pop();
    if (!sponsor || seenSponsors.has(sponsor)) continue;
    seenSponsors.add(sponsor);
    const children = graph.childrenBySponsor.get(sponsor) || new Set();
    for (const childNodeKey of children) {
      if (!out.has(childNodeKey)) out.add(childNodeKey);
      const child = graph.nodes.get(childNodeKey);
      const childName = normalize(child?.agentName || '');
      if (childName) stack.push(childName);
    }
  }

  return out;
}

function canVerify({ actorRole = '', actorName = '', recruitNodeKey = '', graph }) {
  if (mapRole(actorRole) === 'admin') return true;
  const normalizedActor = normalize(actorName);
  if (!normalizedActor || !recruitNodeKey) return false;

  const recruit = graph.nodes.get(recruitNodeKey);
  const recruitName = normalize(recruit?.agentName || '');
  if (recruitName && recruitName === normalizedActor) return false;

  const descendants = descendantsForViewer(normalizedActor, graph);
  return descendants.has(recruitNodeKey);
}

function buildDefaults(agent = {}, stepOrder = []) {
  const steps = {};
  for (const key of stepOrder) {
    steps[key] = {
      agentDone: false,
      agentDoneAt: '',
      verified: false,
      verifiedAt: '',
      verifiedBy: '',
      agentNote: '',
      proofUrl: ''
    };
  }

  return {
    id: `lot_${Math.random().toString(36).slice(2, 9)}`,
    agentKey: personKey({ email: agent.agentEmail, name: agent.agentName }),
    agentName: clean(agent.agentName || ''),
    agentEmail: clean(agent.agentEmail || '').toLowerCase(),
    sponsorName: clean(agent.sponsorName || ''),
    joinedAt: clean(agent.joinedAt || nowIso()),
    currentStepStartedAt: clean(agent.joinedAt || nowIso()),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    steps,
    nudges: {}
  };
}

function mergeStepShape(row = {}, stepOrder = []) {
  const base = buildDefaults(row, stepOrder);
  const merged = {
    ...base,
    ...row,
    steps: { ...base.steps, ...(row?.steps || {}) },
    nudges: { ...(row?.nudges || {}) }
  };

  for (const key of stepOrder) {
    merged.steps[key] = {
      ...base.steps[key],
      ...(merged.steps[key] || {})
    };
  }

  return merged;
}

function progressForRow(row = {}, stepOrder = []) {
  const total = stepOrder.length;
  let verified = 0;
  let agentDone = 0;
  let currentStepKey = '';

  for (const key of stepOrder) {
    const s = row?.steps?.[key] || {};
    if (s?.agentDone) agentDone += 1;
    if (s?.verified) verified += 1;
    if (!currentStepKey && !s?.verified) currentStepKey = key;
  }

  if (!currentStepKey) currentStepKey = stepOrder[stepOrder.length - 1] || '';

  const startedAt = clean(row?.currentStepStartedAt || row?.createdAt || nowIso());
  const startedMs = new Date(startedAt).getTime();
  const stuckDays = Number.isFinite(startedMs)
    ? Math.max(0, Math.floor((Date.now() - startedMs) / (24 * 60 * 60 * 1000)))
    : 0;

  const color = stuckDays <= 3 ? 'green' : stuckDays <= 7 ? 'yellow' : 'red';
  const isComplete = total > 0 && verified >= total;

  return {
    totalSteps: total,
    verifiedSteps: verified,
    agentDoneSteps: agentDone,
    progressPct: total > 0 ? Math.round((verified / total) * 100) : 0,
    currentStepKey,
    stuckDays,
    color,
    isComplete
  };
}

async function maybeSendNudgeEmail({ to = '', cc = '', subject = '', text = '' } = {}) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  const recipient = clean(to);
  if (!recipient || !user || !pass) return { ok: false, error: 'email_not_configured' };

  try {
    const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    const info = await tx.sendMail({ from, to: recipient, cc: clean(cc), subject: clean(subject), text: clean(text) });
    return { ok: true, messageId: clean(info?.messageId) };
  } catch (error) {
    return { ok: false, error: clean(error?.message || 'send_failed') };
  }
}

function nextStepLabel(stepKey = '', stepLabels = {}) {
  return clean(stepLabels?.[stepKey] || stepKey || 'Current step');
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const viewerName = clean(searchParams.get('viewerName') || '');
  const viewerEmail = clean(searchParams.get('viewerEmail') || '').toLowerCase();
  const viewerRole = mapRole(searchParams.get('viewerRole') || 'agent');

  const stepOrder = safeJson(JSON.parse(searchParams.get('stepOrder') || '[]'), []);
  const stepLabels = safeJson(JSON.parse(searchParams.get('stepLabels') || '{}'), {});

  const [rowsRaw, referralRows] = await Promise.all([
    loadJsonStore(STORE_PATH, []),
    loadReferralRows()
  ]);

  const graph = buildGraph(referralRows);
  const rows = Array.isArray(rowsRaw) ? rowsRaw.map((r) => mergeStepShape(r, stepOrder)) : [];
  const byKey = new Map(rows.map((r) => [clean(r.agentKey), r]));

  for (const discovered of graph.nodes.values()) {
    const k = personKey({ email: discovered.agentEmail, name: discovered.agentName });
    if (!byKey.has(k)) {
      const seed = buildDefaults(discovered, stepOrder);
      rows.push(seed);
      byKey.set(k, seed);
    }
  }

  const myKey = personKey({ email: viewerEmail, name: viewerName });
  let myRow = byKey.get(myKey);
  if (!myRow && viewerName) {
    myRow = buildDefaults({ agentName: viewerName, agentEmail: viewerEmail, joinedAt: nowIso() }, stepOrder);
    rows.push(myRow);
    byKey.set(myKey, myRow);
  }

  const visibleNodeKeys = viewerRole === 'admin'
    ? new Set(rows.map((r) => r.agentKey))
    : descendantsForViewer(viewerName, graph);

  const downlineRows = rows
    .filter((r) => visibleNodeKeys.has(r.agentKey))
    .filter((r) => normalize(r.agentName) !== normalize(viewerName))
    .filter((r) => hasPolicySubmittedForAgent(r, policyRows))
    .map((r) => ({ ...r, progress: progressForRow(r, stepOrder) }))
    .sort((a, b) => {
      const ac = a?.progress?.color;
      const bc = b?.progress?.color;
      const weight = { red: 3, yellow: 2, green: 1 };
      if ((weight[bc] || 0) !== (weight[ac] || 0)) return (weight[bc] || 0) - (weight[ac] || 0);
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });

  const myProgress = myRow ? progressForRow(myRow, stepOrder) : null;

  // Persist discovered/default rows so tracker survives and can be updated later.
  await saveJsonStore(STORE_PATH, rows);

  return Response.json({
    ok: true,
    viewer: { name: viewerName, email: viewerEmail, role: viewerRole },
    mondayOnboarding: { day: 'Monday', time: '7:00 PM CST' },
    myRow: myRow ? { ...myRow, progress: myProgress } : null,
    downlineRows,
    metrics: {
      totalDownline: downlineRows.length,
      red: downlineRows.filter((r) => r?.progress?.color === 'red').length,
      yellow: downlineRows.filter((r) => r?.progress?.color === 'yellow').length,
      green: downlineRows.filter((r) => r?.progress?.color === 'green').length,
      completed: downlineRows.filter((r) => r?.progress?.isComplete).length
    },
    labels: { stepLabels, stepOrder }
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const mode = normalize(body?.mode || 'step_update');

  const stepOrder = Array.isArray(body?.stepOrder) ? body.stepOrder.map((s) => clean(s)).filter(Boolean) : [];
  const stepLabels = body?.stepLabels || {};

  const actorName = clean(body?.actorName || '');
  const actorEmail = clean(body?.actorEmail || '').toLowerCase();
  const actorRole = mapRole(body?.actorRole || 'agent');

  const [rowsRaw, referralRows] = await Promise.all([
    loadJsonStore(STORE_PATH, []),
    loadReferralRows()
  ]);
  const graph = buildGraph(referralRows);

  const rows = Array.isArray(rowsRaw) ? rowsRaw.map((r) => mergeStepShape(r, stepOrder)) : [];
  const byKey = new Map(rows.map((r, i) => [clean(r.agentKey), i]));

  if (mode === 'step_update') {
    const agentName = clean(body?.agentName || '');
    const agentEmail = clean(body?.agentEmail || '').toLowerCase();
    const stepKey = clean(body?.stepKey || '');
    const action = normalize(body?.action || '');
    const note = clean(body?.note || '');
    const proofUrl = clean(body?.proofUrl || '');

    if (!agentName || !stepKey || !action) {
      return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }

    const key = personKey({ email: agentEmail, name: agentName });
    let idx = byKey.get(key);
    if (idx == null) {
      const discovered = graph.nodes.get(key) || { agentName, agentEmail, joinedAt: nowIso() };
      const seed = buildDefaults(discovered, stepOrder);
      rows.push(seed);
      idx = rows.length - 1;
      byKey.set(key, idx);
    }

    const row = mergeStepShape(rows[idx], stepOrder);
    if (!row.steps[stepKey]) {
      row.steps[stepKey] = {
        agentDone: false,
        agentDoneAt: '',
        verified: false,
        verifiedAt: '',
        verifiedBy: '',
        agentNote: '',
        proofUrl: ''
      };
    }

    const step = { ...(row.steps[stepKey] || {}) };

    const actorIsSelf = normalize(row.agentName) === normalize(actorName) || (actorEmail && normalize(row.agentEmail) === normalize(actorEmail));
    const actorCanVerify = canVerify({ actorRole, actorName, recruitNodeKey: row.agentKey, graph });

    if (action === 'agent_mark_done') {
      if (!actorIsSelf && actorRole !== 'admin') {
        return Response.json({ ok: false, error: 'forbidden_agent_update' }, { status: 403 });
      }
      step.agentDone = true;
      step.agentDoneAt = nowIso();
      if (note) step.agentNote = note;
      if (proofUrl) step.proofUrl = proofUrl;
      if (!step.verified) row.currentStepStartedAt = nowIso();
    } else if (action === 'agent_mark_not_done') {
      if (!actorIsSelf && actorRole !== 'admin') {
        return Response.json({ ok: false, error: 'forbidden_agent_update' }, { status: 403 });
      }
      step.agentDone = false;
      step.agentDoneAt = '';
      step.verified = false;
      step.verifiedAt = '';
      step.verifiedBy = '';
      if (note) step.agentNote = note;
      row.currentStepStartedAt = nowIso();
    } else if (action === 'upline_verify') {
      if (!actorCanVerify) {
        return Response.json({ ok: false, error: 'forbidden_verify' }, { status: 403 });
      }
      step.verified = true;
      step.verifiedAt = nowIso();
      step.verifiedBy = actorName || actorEmail;
      if (!step.agentDone) {
        step.agentDone = true;
        step.agentDoneAt = nowIso();
      }
      const progress = progressForRow({ ...row, steps: { ...row.steps, [stepKey]: step } }, stepOrder);
      if (progress.currentStepKey && progress.currentStepKey !== stepKey) row.currentStepStartedAt = nowIso();
    } else if (action === 'upline_unverify') {
      if (!actorCanVerify) {
        return Response.json({ ok: false, error: 'forbidden_verify' }, { status: 403 });
      }
      step.verified = false;
      step.verifiedAt = '';
      step.verifiedBy = '';
      row.currentStepStartedAt = nowIso();
    } else {
      return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
    }

    row.steps[stepKey] = step;
    row.updatedAt = nowIso();
    rows[idx] = row;

    await saveJsonStore(STORE_PATH, rows);
    return Response.json({ ok: true, row: { ...row, progress: progressForRow(row, stepOrder) } });
  }

  if (mode === 'run_nudges') {
    const minDays = Math.max(1, Number(body?.minDays || 4));
    const maxPerRun = Math.max(1, Number(body?.maxPerRun || 25));
    const hourGateMs = 24 * 60 * 60 * 1000;
    const nowMs = Date.now();

    let sent = 0;
    const out = [];

    for (let i = 0; i < rows.length && sent < maxPerRun; i += 1) {
      const row = mergeStepShape(rows[i], stepOrder);
      const progress = progressForRow(row, stepOrder);
      if (progress.isComplete) continue;
      if (progress.stuckDays < minDays) continue;

      const stepKey = progress.currentStepKey || firstStepKey(stepOrder);
      const nudgeState = row?.nudges?.[stepKey] || {};
      const lastMs = new Date(nudgeState.lastSentAt || 0).getTime();
      if (Number.isFinite(lastMs) && lastMs > 0 && (nowMs - lastMs) < hourGateMs) continue;

      const sponsorName = clean(row?.sponsorName || '');
      const sponsorEmail = clean(buildNameEmailIndex().get(normalize(sponsorName)) || '').toLowerCase();
      const stepLabel = nextStepLabel(stepKey, stepLabels);

      const subject = `Onboarding Nudge: ${clean(row.agentName)} is stuck on ${stepLabel}`;
      const agentBody = [
        `Hi ${clean(row.agentName)},`,
        '',
        `Quick nudge from The Legacy Link: your current onboarding step has been open for ${progress.stuckDays} day(s).`,
        `Current step: ${stepLabel}`,
        '',
        'Please complete this step and mark it done in your Onboarding Tracker.',
        '',
        'Reminder: Live Licensed Onboarding is every Monday at 7:00 PM CST.',
        '',
        '— Legacy Link Support Team'
      ].join('\n');

      const sponsorBody = sponsorName ? [
        `Hi ${sponsorName},`,
        '',
        `${clean(row.agentName)} is currently stuck on onboarding step "${stepLabel}" for ${progress.stuckDays} day(s).`,
        'Please review and verify as soon as they complete it.',
        '',
        '— Legacy Link Support Team'
      ].join('\n') : '';

      const agentRes = await maybeSendNudgeEmail({ to: row.agentEmail, cc: sponsorEmail, subject, text: agentBody });
      let sponsorRes = { ok: false, error: 'no_sponsor_email' };
      if (sponsorEmail) sponsorRes = await maybeSendNudgeEmail({ to: sponsorEmail, subject, text: sponsorBody || agentBody });

      row.nudges = row.nudges || {};
      row.nudges[stepKey] = {
        lastSentAt: nowIso(),
        count: Number(nudgeState.count || 0) + 1,
        lastSentBy: actorName || actorEmail || 'system'
      };
      row.updatedAt = nowIso();
      rows[i] = row;
      sent += 1;

      out.push({
        agentName: row.agentName,
        stepKey,
        stepLabel,
        stuckDays: progress.stuckDays,
        agentNudge: agentRes,
        sponsorNudge: sponsorRes
      });
    }

    await saveJsonStore(STORE_PATH, rows);
    return Response.json({ ok: true, sent, rows: out });
  }

  return Response.json({ ok: false, error: 'unsupported_mode' }, { status: 400 });
}
