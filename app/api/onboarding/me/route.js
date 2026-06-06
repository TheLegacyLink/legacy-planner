// app/api/onboarding/me/route.js
// GET /api/onboarding/me — returns the authed agent's full tracker state

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { resolveMemberSession } from '../../../../lib/onboardingMemberAuth.js';
import {
  getAgentByEmail,
  getChecklist,
  getHomework,
  getBook,
  MASTER_ITEMS,
  AGENT_CAN_CHECK,
  visibleItemIds,
  isOverdue
} from '../../../../lib/onboardingStore';
import { ensureLeticiaWright } from '../../../../lib/onboardingSeed';

function token(req) {
  const auth = req.headers.get('authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

export async function GET(req) {
  try {
    await ensureLeticiaWright();

    const t = token(req);
    if (!t) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const session = await resolveMemberSession(req);
    if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const agent = await getAgentByEmail(session.email);
    if (!agent) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

    const rows = await getChecklist(agent.id);
    const visibleIds = new Set(visibleItemIds(agent));

    const checklist = MASTER_ITEMS
      .filter(item => visibleIds.has(item.id))
      .map(item => {
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

    const homework = await getHomework(agent.id);
    const book = await getBook(agent.id);

    return NextResponse.json({ ok: true, agent, checklist, homework, book });
  } catch (err) {
    console.error('[onboarding/me]', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
