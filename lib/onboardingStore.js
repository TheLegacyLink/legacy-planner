// lib/onboardingStore.js
// Data layer for the Legacy Link Onboarding Tracker
// Uses blob-backed JSON stores via blobJsonStore.js

import { loadJsonStore, saveJsonStore, loadJsonStoreDirect, saveJsonStoreDirect } from './blobJsonStore';

// ─── Store paths ──────────────────────────────────────────────────────────────
const AGENTS_PATH = 'stores/onboarding-agents.json';
const CHECKLIST_PATH = 'stores/onboarding-checklist.json';
const HOMEWORK_PATH = 'stores/onboarding-homework.json';
const BOOKS_PATH = 'stores/onboarding-books.json';

// Per-agent progress summary — written on every check, fast single-blob reads
function progressPath(agentId) { return `stores/onboarding-progress-${agentId}.json`; }

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
    title: 'Business Banking Setup',
    owner: 'WE GUIDE',
    description: 'Elite only: We walk you through opening your Relay business banking account. You implement it on your end. This is how commissions land and how your business operates separately from your personal.',
    elite_only: true,
    pif_only: false,
    recurring: false,
    target_day_start: 30,
    target_day_end: 60,
    sort_order: 12
  },
  {
    id: 22,
    title: 'Business Entity Setup (LLC / S-Corp)',
    owner: 'WE GUIDE',
    description: 'Elite only: We give you the structure, templates, and guidance to set up your LLC or S-Corp. You file and execute on your end. Foundation for building generational wealth the right way.',
    elite_only: true,
    pif_only: false,
    recurring: false,
    target_day_start: 30,
    target_day_end: 60,
    sort_order: 12.5
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
    title: 'Personal Life Insurance Policy',
    owner: 'WE DO',
    description: 'Elite only: We put your own personal life policy in force. You protect your family first before you build. Non-negotiable foundation.',
    elite_only: true,
    pif_only: false,
    recurring: false,
    target_day_start: 90,
    target_day_end: 180,
    sort_order: 14
  },
  {
    id: 23,
    title: 'Max-Funded IUL Setup',
    owner: 'WE DO',
    description: 'Elite only: We structure your max-funded Indexed Universal Life policy with a $1,000 company match on first-year funding. This is your wealth-building engine — tax-advantaged, compound growth.',
    elite_only: true,
    pif_only: false,
    recurring: false,
    target_day_start: 90,
    target_day_end: 180,
    sort_order: 14.5
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
  // Read all item rows in parallel from per-item blobs
  const reads = MASTER_ITEMS.map(item =>
    loadJsonStoreDirect(rowPath(agentId, item.id), null)
  );
  const results = await Promise.all(reads);
  // Filter out null/undefined AND corrupted [] blobs left by old blobJsonStore bug
  return results.filter(r => r && typeof r === 'object' && !Array.isArray(r));
}

export async function getChecklistRow(agentId, itemId) {
  return loadJsonStoreDirect(rowPath(agentId, itemId), null);
}

// Per-item blob path — eliminates race conditions from shared array read-modify-write
function rowPath(agentId, itemId) {
  return `stores/onboarding-cl/${agentId}-${itemId}.json`;
}

export async function upsertChecklistRow(agentId, itemId, updates) {
  const now = nowIso();
  const path = rowPath(agentId, itemId);
  const raw = await loadJsonStoreDirect(path, null);
  // Guard: reject corrupted blobs (e.g. empty arrays saved by old blobJsonStore bug)
  const existing = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : null;
  const row = existing || {
    agent_id: agentId,
    item_id: itemId,
    visible: true,
    checked: false,
    checked_at: null,
    checked_by: null,
    notes: null,
    created_at: now,
  };
  const updated = { ...row, ...updates, updated_at: now };
  await saveJsonStoreDirect(path, updated);
  // Refresh progress summary in the background (don't await)
  refreshAgentProgress(agentId).catch(() => {});
  return updated;
}

// Recompute and store the agent's progress summary in a fast-read blob
export async function refreshAgentProgress(agentId) {
  const agent = await getAgentById(agentId);
  if (!agent) return;
  const rows = await getChecklist(agentId);
  const visibleIds = new Set(visibleItemIds(agent));
  const coreItems = MASTER_ITEMS.filter(i => !i.recurring && visibleIds.has(i.id));
  const total = coreItems.length;
  const done = rows.filter(r => {
    const item = MASTER_ITEMS.find(i => i.id === r.item_id);
    return r.checked && item && !item.recurring;
  }).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const checkedAts = rows.filter(r => r.checked && r.checked_at).map(r => r.checked_at).sort().reverse();
  const summary = { agentId, done, total, pct, lastMoveAt: checkedAts[0] || null, updatedAt: nowIso() };
  await saveJsonStoreDirect(progressPath(agentId), summary);
  return summary;
}

export async function getAgentProgressSummary(agentId) {
  return loadJsonStoreDirect(progressPath(agentId), null);
}

export async function initAgentChecklist(agent) {
  const visible = new Set(visibleItemIds(agent));
  const now = nowIso();
  // Write each item row to its own blob in parallel
  await Promise.all(MASTER_ITEMS.map(async item => {
    const path = rowPath(agent.id, item.id);
    const raw = await loadJsonStoreDirect(path, null);
    const existing = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : null;
    if (existing) return; // already initialized
    await saveJsonStoreDirect(path, {
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
  }));
}

// ─── Homework store ───────────────────────────────────────────────────────────
export async function getHomework(agentId) {
  const rows = await loadJsonStore(HOMEWORK_PATH, []);
  const week = getMondayOfWeek();
  const current = rows.find(r => r.agent_id === agentId && r.week_starting === week) || null;
  const weeksCompleted = rows.filter(r => r.agent_id === agentId && r.submitted_at).length;
  // Days until next Monday reset
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  return { current, weeksCompleted, daysUntilReset: daysUntilMonday };
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
  const current = rows.find(r => r.agent_id === agentId && r.month === month) || null;
  const monthsCompleted = rows.filter(r => r.agent_id === agentId && r.completed).length;
  // Days until next month
  const now = new Date();
  const firstNext = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysUntilReset = Math.ceil((firstNext - now) / 86400000);
  return { current, monthsCompleted, daysUntilReset };
}

export async function saveBook(agentId, data) {
  const rows = await loadJsonStore(BOOKS_PATH, []);
  const month = getFirstOfMonth();
  const now = nowIso();
  const idx = rows.findIndex(r => r.agent_id === agentId && r.month === month);
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...data, updated_at: now };
    if (data.completed && !rows[idx].completed_at) rows[idx].completed_at = now;
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

  const result = {};
  for (const agent of agents) {
    // Try fast summary blob first — written on every check, no list() issues
    const summary = await getAgentProgressSummary(agent.id);
    // Validate: reject corrupted [] blobs from old blobJsonStore bug
    const validSummary = summary && typeof summary === 'object' && !Array.isArray(summary) && typeof summary.pct === 'number';
    if (validSummary) {
      const visibleIds = new Set(visibleItemIds(agent));
      const coreItems = MASTER_ITEMS.filter(i => !i.recurring && visibleIds.has(i.id));
      const overdueCount = coreItems.filter(item => isOverdue(item, agent)).length;
      result[agent.id] = {
        done: Array.from({ length: summary.done }, (_, i) => i), // placeholder ids
        total: summary.total || coreItems.length,
        pct: summary.pct,
        lastMoveAt: summary.lastMoveAt,
        overdueCount
      };
      continue;
    }

    // Fallback: compute from per-item blobs
    const agentRows = await getChecklist(agent.id);
    const visibleIds = new Set(visibleItemIds(agent));
    const coreItems = MASTER_ITEMS.filter(i => !i.recurring && visibleIds.has(i.id));

    const done = agentRows.filter(r => {
      const item = MASTER_ITEMS.find(i => i.id === r.item_id);
      return r.checked && item && !item.recurring;
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
