export const dynamic = 'force-dynamic';

import { resolveAdminSession } from '../../../../../lib/onboardingAdminAuth.js';

// app/api/admin/onboarding/agents/route.js
// GET /api/admin/onboarding/agents — list all agents with progress
// POST /api/admin/onboarding/agents — create new agent

import { NextResponse } from 'next/server';
import {
  getAllAgents,
  getAllProgress,
  upsertAgent,
  initAgentChecklist,
  computeAgentStatus
} from '../../../../../lib/onboardingStore';
import { ensureLeticiaWright } from '../../../../../lib/onboardingSeed';




function daysSince(isoDate) {
  if (!isoDate) return 0;
  const start = new Date(isoDate);
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export async function GET(req) {
  try {
    await ensureLeticiaWright();

    const session = await resolveAdminSession(req);
    if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const agents = await getAllAgents();
    const progress = await getAllProgress();

    const result = agents.map(agent => {
      const prog = progress[agent.id] || { done: [], total: 0, pct: 0, lastMoveAt: null, overdueCount: 0 };
      const daysSinceStart = daysSince(agent.start_date);
      return {
        ...agent,
        progress: { done: prog.done.length, total: prog.total, pct: prog.pct },
        status: computeAgentStatus(agent, prog),
        daysSinceStart,
        lastMoveAt: prog.lastMoveAt,
        overdueCount: prog.overdueCount
      };
    });

    return NextResponse.json({ ok: true, agents: result });
  } catch (err) {
    console.error('[admin/onboarding/agents GET]', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await ensureLeticiaWright();

    const session = await resolveAdminSession(req);
    if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { first_name, last_name, email, tier, paid_in_full, start_date } = body;

    if (!email || !first_name || !last_name) {
      return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }

    const agent = await upsertAgent({
      first_name: String(first_name || '').trim(),
      last_name: String(last_name || '').trim(),
      email: String(email || '').trim().toLowerCase(),
      tier: tier || 'inner_circle',
      paid_in_full: Boolean(paid_in_full),
      start_date: start_date || new Date().toISOString().slice(0, 10),
      status: 'active'
    });

    await initAgentChecklist(agent);

    return NextResponse.json({ ok: true, agent });
  } catch (err) {
    console.error('[admin/onboarding/agents POST]', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
