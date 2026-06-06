export const dynamic = 'force-dynamic';

import { resolveAdminSession } from '../../../../../../lib/onboardingAdminAuth.js';

// app/api/admin/onboarding/agents/[agentId]/route.js
// GET /api/admin/onboarding/agents/[agentId] — agent detail + full checklist + activity log

import { NextResponse } from 'next/server';
import {
  getAgentById,
  getChecklist,
  MASTER_ITEMS,
  AGENT_CAN_CHECK,
  visibleItemIds,
  isOverdue
} from '../../../../../../lib/onboardingStore';
import { ensureLeticiaWright } from '../../../../../../lib/onboardingSeed';



async function requireAdmin(req) {
  const t = token(req);
  if (!t) return null;
  const session = await sessionFromToken(t);
  if (!session) return null;
  if (!ADMIN_EMAILS.has(session.email)) return null;
  return session;
}

export async function GET(req, { params }) {
  try {
    await ensureLeticiaWright();

    const session = await requireAdmin(req);
    if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const { agentId } = params;
    const agent = await getAgentById(agentId);
    if (!agent) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

    const rows = await getChecklist(agent.id);
    const visibleIds = new Set(visibleItemIds(agent));

    const checklist = MASTER_ITEMS.map(item => {
      const row = rows.find(r => r.item_id === item.id) || {};
      return {
        item,
        checked: row.checked || false,
        checked_at: row.checked_at || null,
        checked_by: row.checked_by || null,
        is_overdue: isOverdue(item, agent) && !row.checked,
        visible: visibleIds.has(item.id),
        can_check: AGENT_CAN_CHECK.has(item.owner)
      };
    });

    // Activity log: last 10 checked items sorted by checked_at desc
    const activityLog = rows
      .filter(r => r.checked && r.checked_at)
      .sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at))
      .slice(0, 10)
      .map(r => {
        const item = MASTER_ITEMS.find(i => i.id === r.item_id);
        return {
          item_id: r.item_id,
          item_title: item?.title || `Item ${r.item_id}`,
          checked_at: r.checked_at,
          checked_by: r.checked_by
        };
      });

    return NextResponse.json({ ok: true, agent, checklist, activityLog });
  } catch (err) {
    console.error('[admin/onboarding/agents/[agentId]]', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
