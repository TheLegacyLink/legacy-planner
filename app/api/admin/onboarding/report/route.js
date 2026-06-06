// app/api/admin/onboarding/report/route.js
// GET /api/admin/onboarding/report — weekly report data

import { NextResponse } from 'next/server';
import { sessionFromToken } from '../../../start-auth/_lib';
import {
  getAllAgents,
  getAllProgress,
  getChecklist,
  MASTER_ITEMS,
  computeAgentStatus
} from '../../../../../lib/onboardingStore';
import { ensureLeticiaWright } from '../../../../../lib/onboardingSeed';

const ADMIN_EMAILS = new Set(['kimora@thelegacylink.com', 'link@thelegacylink.com']);

function token(req) {
  const auth = req.headers.get('authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

async function requireAdmin(req) {
  const t = token(req);
  if (!t) return null;
  const session = await sessionFromToken(t);
  if (!session) return null;
  if (!ADMIN_EMAILS.has(session.email)) return null;
  return session;
}

function daysSince(isoDate) {
  if (!isoDate) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24)));
}

export async function GET(req) {
  try {
    await ensureLeticiaWright();

    const session = await requireAdmin(req);
    if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const agents = await getAllAgents();
    const progress = await getAllProgress();

    const activeAgents = agents.filter(a => a.status === 'active');
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const weekAgo = new Date(now - weekMs).toISOString();

    // Stuck agents: no movement in 7+ days AND pct < 90
    const stuckAgents = activeAgents
      .filter(agent => {
        const prog = progress[agent.id] || { pct: 0, lastMoveAt: null };
        const daysSinceMove = prog.lastMoveAt
          ? Math.floor((now - new Date(prog.lastMoveAt).getTime()) / (1000 * 60 * 60 * 24))
          : daysSince(agent.start_date);
        return daysSinceMove >= 7 && prog.pct < 90;
      })
      .map(agent => {
        const prog = progress[agent.id] || {};
        return {
          agent_id: agent.id,
          name: `${agent.first_name} ${agent.last_name}`,
          tier: agent.tier,
          days_stuck: Math.floor((now - new Date(prog.lastMoveAt || agent.start_date).getTime()) / (1000 * 60 * 60 * 24))
        };
      });

    // Top movers this week: agents with most items checked in last 7 days
    const topMovers = await Promise.all(
      activeAgents.map(async agent => {
        const rows = await getChecklist(agent.id);
        const recentChecks = rows.filter(r => r.checked && r.checked_at && r.checked_at > weekAgo);
        return { agent, count: recentChecks.length };
      })
    );
    const topMoversList = topMovers
      .filter(m => m.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(m => ({
        agent_id: m.agent.id,
        name: `${m.agent.first_name} ${m.agent.last_name}`,
        items_completed: m.count,
        pct: (progress[m.agent.id] || {}).pct || 0
      }));

    // New starts this week
    const newStarts = activeAgents
      .filter(a => a.start_date && a.start_date > new Date(now - weekMs).toISOString().slice(0, 10))
      .map(a => ({
        agent_id: a.id,
        name: `${a.first_name} ${a.last_name}`,
        tier: a.tier,
        start_date: a.start_date
      }));

    // Ready for upgrade: IC agents pct >= 70 AND daysSinceStart >= 60
    const readyForUpgrade = activeAgents
      .filter(a => {
        if (a.tier !== 'inner_circle') return false;
        const prog = progress[a.id] || {};
        return prog.pct >= 70 && daysSince(a.start_date) >= 60;
      })
      .map(a => ({
        agent_id: a.id,
        name: `${a.first_name} ${a.last_name}`,
        pct: (progress[a.id] || {}).pct || 0,
        days_since_start: daysSince(a.start_date)
      }));

    // Kimora needs you: WE DO items due or overdue across all agents
    const kimoraNeedsYouItems = [];
    for (const agent of activeAgents) {
      const rows = await getChecklist(agent.id);
      for (const item of MASTER_ITEMS) {
        if (!['WE DO', 'CARRIER', 'WE PAY'].includes(item.owner)) continue;
        if (item.recurring) continue;
        const row = rows.find(r => r.item_id === item.id);
        if (row?.checked) continue;
        if (!row?.visible && row?.visible !== undefined) continue;
        const daysIn = daysSince(agent.start_date);
        if (daysIn >= item.target_day_start) {
          kimoraNeedsYouItems.push({
            agent_id: agent.id,
            agent_name: `${agent.first_name} ${agent.last_name}`,
            item_id: item.id,
            item_title: item.title,
            owner: item.owner,
            overdue: daysIn > item.target_day_end
          });
        }
      }
    }

    const avgProgress = activeAgents.length > 0
      ? Math.round(activeAgents.reduce((sum, a) => sum + ((progress[a.id] || {}).pct || 0), 0) / activeAgents.length)
      : 0;

    const eliteCount = activeAgents.filter(a => a.tier === 'elite').length;
    const icCount = activeAgents.filter(a => a.tier === 'inner_circle').length;

    const report = {
      activeCount: activeAgents.length,
      eliteCount,
      icCount,
      avgProgress,
      stuckAgents,
      topMovers: topMoversList,
      newStarts,
      readyForUpgrade,
      kimoraNeedsYouItems
    };

    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error('[admin/onboarding/report]', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
