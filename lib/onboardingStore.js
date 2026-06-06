// lib/onboardingStore.js
// Data layer for the Legacy Link Onboarding Tracker
// Uses blob-backed JSON stores via blobJsonStore.js

import { loadJsonStore, saveJsonStore } from './blobJsonStore';

// ─── Store paths ──────────────────────────────────────────────────────────────
const AGENTS_PATH = 'stores/onboarding-agents.json';
const CHECKLIST_PATH = 'stores/onboarding-checklist.json';
const HOMEWORK_PATH = 'stores/onboarding-homework.json';
const BOOKS_PATH = 'stores/onboarding-books.json';

// ─── Master catalog (never changes — hardcoded from checklist-seed.json v1.0) ─
export const MASTER_ITEMS = [
  {
    id: 1,
    title: 'Welcome Email Sent',
    owner: 'WE DO',
    description: 'You receive your welcome email confirming your tier and your kickoff call link.',
    elite_only: false,
    pif_only: false,
    recurring: false,
    target_day_start: 0,
    target_day_end: 0,
    sort_order: 1
  },
  {
    id: 2,
    title: 'Back Office Access Granted',
    owner: 'WE DO',
    description: 'You get login credentials for the back office. This is where you\'ll track contracts, leads, commissions, and announcements.',
    elite_only: false,
    pif_only: false,
    recurring: false,
    target_day_start: 0,
    target_day_end: 1,
    sort_order: 2
  },
  {
    id: 3,
    title: 'E&O Insurance Set Up',
    owner: 'WE DO',
    description: 'We enroll you in Errors & Omissions coverage. You\'ll get the policy certificate emailed to you. You can\'t write business without it.',
    elite_only: false,
    pif_only: false,
    recurring: false,
    target_day_start: 1,
    target_day_end: 3,
    sort_order: 3
  },
  {
    id: 4,
    title: 'Carrier Contracting Started',
    owner: 'YOU DO',
    description: 'You complete the carrier contracting form via the link inside your back office. This is your packet: license verification and W-9.',
    elite_only: false,
    pif_only: false,
    recurring: false,
    target_day_start: 3,
    target_day_end: 7,
    sort_order: 4
  },
  {
    id: 5,
    title: 'Carrier Contracting Approved',
    owner: 'CARRIER',
    description: 'The carrier reviews and approves your appointment. Typical turnaround is 1-2 weeks. You\'ll receive your agent number and writing code by email.',
    elite_only: false,
    pif_only: false,
    recurring: false,
    target_day_start: 7,
    target_day_end: 21,
    sort_order: 5
  },
  {
    id: 6,
    title: 'Scripts & Training Phase 1',
    owner: 'YOU DO',
    description: 'While contracting is pending, study the sponsorship script. Months 1-6, the leads you receive are people interested in joining the agency - your job is to qualify them, run the sponsorship presentation, and close.',
    elite_only: false,
    pif_only: false,
    recurring: false,
    target_day_start: 7,
    target_day_end: 21,
    sort_order: 6
  },
  {
    id: 7,
    title: 'Direct Deposit Set Up (Relay)',
    owner: 'WE DO',
    description: 'We send you an email through Relay, our business banking partner. You set up direct deposit there - this is how commissions land in your account.',
    elite_only: false,
    pif_only: false,
    recurring: false,
    target_day_start: 14,
    target_day_end: 21,
    sort_order: 7
  },
  {
    id: 8,
    title: 'Lead Connector / CRM Setup',
    owner: 'WE DO',
    description: 'After contracting is approved, we set you up in Lead Connector with your pipeline, automations, and number. We walk you through where leads land and how to work them.',
    elite_only: false,
    pif_only: false,
    recurring: false,
    target_day_start: 21,
    target_day_end: 23,
    sort_order: 8
  },
  {
    id: 9,
    title: 'First Sponsorship Close',
    owner: 'YOU DO',
    description: 'Run the script. Book the appointment. Close the policy. Inner Circle earns $750; Inner Circle Elite earns $1,000 on every closed sponsorship.',
    elite_only: false,
    pif_only: false,
    recurring: false,
    target_day_start: 21,
    target_day_end: 45,
    sort_order: 9
  },
  {
    id: 10,
    title: 'Activity Benchmark Met',
    owner: 'YOU DO',
    description: 'Hit the weekly activity targets shown on your Lead Connector dashboard: dials, contacts, appointments set, and policies submitted.',
    elite_only: false,
    pif_only: false,
    recurring: false,
    target_day_start: 30,
    target_day_end: 60,
    sort_order: 10
  },
  {
    id: 11,
    title: 'Hybrid Lead Access Unlocked',
    owner: 'WE DO',
    description: 'After you\'ve demonstrated consistency and confidence on sponsorship leads, you gain access to a hybrid mix: sponsorship leads plus consumer leads for people just looking for life insurance.',
    elite_only: false,
    pif_only: false,
    recurring: false,
    target_day_start: 90,
    target_day_end: 180,
    sort_order: 11
  },
  {
    id: 12,
    title: 'Business Banking + Entity Set Up',
    owner: 'WE GUIDE',
    description: 'Elite only: we give you the structure, templates, and guidance to open your business banking and set up the LLC / entity. You implement it on your end.',
    elite_only: true,
    pif_only: false,
    recurring: false,
    target_day_start: 30,
    target_day_end: 60,
    sort_order: 12
  },
  {
    id: 13,
    title: 'Downlink Building From Day One',
    owner: 'YOU DO',
    description: 'Every agent you refer goes under your hierarchy. Your team is building from day one - not later. Paid In Full agents also receive a built team on top of this.',
    elite_only: false,
    pif_only: false,
    recurring: false,
    target_day_start: 1,
    target_day_end: 365,
    sort_order: 13
  },
  {
    id: 14,
    title: 'Personal Policy + Max-Funded IUL',
    owner: 'WE DO',
    description: 'Elite only: we help you put your own basic personal policy in force, then structure your max-funded IUL with a $1,000 company match on first-year funding. This is your wealth foundation.',
    elite_only: true,
    pif_only: false,
    recurring: false,
    target_day_start: 90,
    target_day_end: 180,
    sort_order: 14
  },
  {
    id: 15,
    title: 'Fidelity Brokerage + Allocation Guidance',
    owner: 'WE GUIDE',
    description: 'Elite only: we walk you through opening a Fidelity brokerage account and we sit with you to discuss asset allocation. You make every decision on your account - we educate, you execute. Not investment advice.',
    elite_only: true,
    pif_only: false,
    recurring: false,
    target_day_start: 90,
    target_day_end: 180,
    sort_order: 15
  },
  {
    id: 16,
    title: 'Living Trust Setup Assistance',
    owner: 'WE GUIDE',
    description: 'Elite only: we connect you to the templates and the legal partners to put your living trust in place. Foundational estate-planning hygiene for your own family.',
    elite_only: true,
    pif_only: false,
    recurring: false,
    target_day_start: 120,
    target_day_end: 240,
    sort_order: 16
  },
  {
    id: 17,
    title: 'Upgrade Bonus + Downlink Override',
    owner: 'WE PAY',
    description: 'Elite only: $500 when a downlink agent upgrades their tier. $150 override every time anyone in your downlink closes a sponsorship.',
    elite_only: true,
    pif_only: false,
    recurring: false,
    target_day_start: 1,
    target_day_end: 365,
    sort_order: 17
  },
  {
    id: 18,
    title: 'Team Auto-Build Begins',
    owner: 'WE DO',
    description: 'Paid In Full agents only: Inner Circle receives 2 agents/month, Inner Circle Elite receives 3 agents/month placed under their hierarchy.',
    elite_only: false,
    pif_only: true,
    recurring: false,
    target_day_start: 30,
    target_day_end: 365,
    sort_order: 18
  },
  {
    id: 19,
    title: 'Webinar Setup Support',
    owner: 'WE DO',
    description: 'Elite only: once you have proof of concept and consistent activity, we help you set up your own webinar funnel - pages, scripts, automations, and ad creative.',
    elite_only: true,
    pif_only: false,
    recurring: false,
    target_day_start: 240,
    target_day_end: 365,
    sort_order: 19
  },
  {
    id: 20,
    title: 'Weekly Homework Submitted',
    owner: 'YOU DO',
    description: 'Watch the assigned podcast episode. Comment on it (YouTube). Submit: what you learned, and what you\'re implementing this week. Non-negotiable.',
    elite_only: false,
    pif_only: false,
    recurring: true,
    target_day_start: 0,
    target_day_end: 7,
    sort_order: 20
  },
  {
    id: 21,
    title: 'Monthly Book / Audiobook',
    owner: 'YOU DO',
    description: 'You receive one assigned book or audiobook per month. Listen, read, take notes. This is how operators are built.',
    elite_only: false,
    pif_only: false,
    recurring: true,
    target_day_start: 0,
    target_day_end: 30,
    sort_order: 21
  }
];

// ─── Permissions ──────────────────────────────────────────────────────────────
export const AGENT_CAN_CHECK = new Set(['YOU DO', 'WE GUIDE']);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nowIso() { return new Date().toISOString(); }
function norm(v = '') { return String(v || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }

function daysSince(isoDate) {
  if (!isoDate) return 0;
  const start = new Date(isoDate);
  const now = new Date();
  return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
}

function getMondayOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function getFirstOfMonth(date = new Date()) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

// ─── Visibility + overdue ─────────────────────────────────────────────────────
export function visibleItemIds(agent) {
  return MASTER_ITEMS
    .filter(item => {
      if (item.elite_only && agent.tier !== 'elite') return false;
      if (item.pif_only && !agent.paid_in_full) return false;
      return true;
    })
    .map(item => item.id);
}

export function isOverdue(item, agent) {
  if (!item || item.recurring) return false;
  if (!item.target_day_end) return false;
  return daysSince(agent.start_date) > item.target_day_end;
}

// ─── Agent store ──────────────────────────────────────────────────────────────
export async function getAllAgents() {
  return loadJsonStore(AGENTS_PATH, []);
}

export async function getAgentByEmail(email) {
  const e = norm(email);
  if (!e) return null;
  const agents = await getAllAgents();
  return agents.find(a => norm(a.email) === e) || null;
}

export async function getAgentById(agentId) {
  const agents = await getAllAgents();
  return agents.find(a => a.id === agentId) || null;
}

export async function upsertAgent(agentData) {
  const agents = await getAllAgents();
  const idx = agents.findIndex(a => norm(a.email) === norm(agentData.email));
  const now = nowIso();
  if (idx >= 0) {
    agents[idx] = { ...agents[idx], ...agentData, updated_at: now };
    await saveJsonStore(AGENTS_PATH, agents);
    return agents[idx];
  } else {
    const newAgent = {
      id: `agt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'active',
      created_at: now,
      updated_at: now,
      ...agentData
    };
    agents.push(newAgent);
    await saveJsonStore(AGENTS_PATH, agents);
    return newAgent;
  }
}

// ─── Checklist store ──────────────────────────────────────────────────────────
export async function getChecklist(agentId) {
  const rows = await loadJsonStore(CHECKLIST_PATH, []);
  return rows.filter(r => r.agent_id === agentId);
}

export async function getChecklistRow(agentId, itemId) {
  const rows = await loadJsonStore(CHECKLIST_PATH, []);
  return rows.find(r => r.agent_id === agentId && r.item_id === itemId) || null;
}

export async function upsertChecklistRow(agentId, itemId, updates) {
  const rows = await loadJsonStore(CHECKLIST_PATH, []);
  const idx = rows.findIndex(r => r.agent_id === agentId && r.item_id === itemId);
  const now = nowIso();
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...updates, updated_at: now };
  } else {
    rows.push({
      agent_id: agentId,
      item_id: itemId,
      visible: true,
      checked: false,
      checked_at: null,
      checked_by: null,
      notes: null,
      created_at: now,
      updated_at: now,
      ...updates
    });
  }
  await saveJsonStore(CHECKLIST_PATH, rows);
}

export async function initAgentChecklist(agent) {
  const rows = await loadJsonStore(CHECKLIST_PATH, []);
  const existing = new Set(rows.filter(r => r.agent_id === agent.id).map(r => r.item_id));
  const visible = new Set(visibleItemIds(agent));
  const now = nowIso();

  for (const item of MASTER_ITEMS) {
    if (existing.has(item.id)) continue;
    rows.push({
      agent_id: agent.id,
      item_id: item.id,
      visible: visible.has(item.id),
      checked: false,
      checked_at: null,
      checked_by: null,
      notes: null,
      created_at: now,
      updated_at: now
    });
  }

  await saveJsonStore(CHECKLIST_PATH, rows);
}

// ─── Homework store ───────────────────────────────────────────────────────────
export async function getHomework(agentId) {
  const rows = await loadJsonStore(HOMEWORK_PATH, []);
  const week = getMondayOfWeek();
  return rows.find(r => r.agent_id === agentId && r.week_starting === week) || null;
}

export async function saveHomework(agentId, data) {
  const rows = await loadJsonStore(HOMEWORK_PATH, []);
  const week = getMondayOfWeek();
  const now = nowIso();
  const idx = rows.findIndex(r => r.agent_id === agentId && r.week_starting === week);
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...data, submitted_at: now, updated_at: now };
  } else {
    rows.push({
      id: `hw_${Date.now()}`,
      agent_id: agentId,
      week_starting: week,
      submitted_at: now,
      created_at: now,
      updated_at: now,
      ...data
    });
  }
  await saveJsonStore(HOMEWORK_PATH, rows);
}

// ─── Book store ───────────────────────────────────────────────────────────────
export async function getBook(agentId) {
  const rows = await loadJsonStore(BOOKS_PATH, []);
  const month = getFirstOfMonth();
  return rows.find(r => r.agent_id === agentId && r.month === month) || null;
}

export async function saveBook(agentId, data) {
  const rows = await loadJsonStore(BOOKS_PATH, []);
  const month = getFirstOfMonth();
  const now = nowIso();
  const idx = rows.findIndex(r => r.agent_id === agentId && r.month === month);
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...data, updated_at: now };
    if (data.completed && !rows[idx].completed_at) {
      rows[idx].completed_at = now;
    }
  } else {
    rows.push({
      id: `book_${Date.now()}`,
      agent_id: agentId,
      month,
      completed: false,
      completed_at: null,
      created_at: now,
      updated_at: now,
      ...data
    });
  }
  await saveJsonStore(BOOKS_PATH, rows);
}

// ─── Progress summary (manager dashboard) ─────────────────────────────────────
export async function getAllProgress() {
  const agents = await getAllAgents();
  const checkRows = await loadJsonStore(CHECKLIST_PATH, []);

  const result = {};
  for (const agent of agents) {
    const agentRows = checkRows.filter(r => r.agent_id === agent.id);
    const visibleIds = new Set(visibleItemIds(agent));
    const coreItems = MASTER_ITEMS.filter(i => !i.recurring && visibleIds.has(i.id));

    const done = agentRows.filter(r => {
      const item = MASTER_ITEMS.find(i => i.id === r.item_id);
      return r.checked && item && !item.recurring && r.visible;
    });

    const total = coreItems.length;
    const doneCount = done.length;
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    const checkedAts = done
      .filter(r => r.checked_at)
      .map(r => r.checked_at)
      .sort()
      .reverse();
    const lastMoveAt = checkedAts[0] || null;

    const overdueCount = coreItems.filter(item => {
      const row = agentRows.find(r => r.item_id === item.id);
      return !row?.checked && isOverdue(item, agent);
    }).length;

    result[agent.id] = {
      done: done.map(r => r.item_id),
      total,
      pct,
      lastMoveAt,
      overdueCount
    };
  }

  return result;
}

// ─── Status helper ────────────────────────────────────────────────────────────
export function computeAgentStatus(agent, progress) {
  const daysSinceStart = daysSince(agent.start_date);
  const daysSinceLastMove = progress.lastMoveAt
    ? Math.floor((Date.now() - new Date(progress.lastMoveAt).getTime()) / (1000 * 60 * 60 * 24))
    : daysSinceStart;

  if (progress.pct >= 95) return 'fully_producing';
  if (agent.tier === 'inner_circle' && progress.pct >= 70 && daysSinceStart >= 60) return 'ready_upgrade';
  if (daysSinceLastMove >= 7 && progress.pct < 90) return 'stuck';
  if (daysSinceStart <= 7) return 'new';
  return 'on_track';
}
