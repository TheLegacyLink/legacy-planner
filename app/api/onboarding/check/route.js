// app/api/onboarding/check/route.js
// POST /api/onboarding/check — agent checks/unchecks a YOU DO or WE GUIDE item

import { NextResponse } from 'next/server';
import { sessionFromToken } from '../../start-auth/_lib';
import {
  getAgentByEmail,
  upsertChecklistRow,
  MASTER_ITEMS,
  AGENT_CAN_CHECK,
  visibleItemIds
} from '../../../../lib/onboardingStore';
import { ensureLeticiaWright } from '../../../../lib/onboardingSeed';

function token(req) {
  const auth = req.headers.get('authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

export async function POST(req) {
  try {
    await ensureLeticiaWright();

    const t = token(req);
    if (!t) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const session = await sessionFromToken(t);
    if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const agent = await getAgentByEmail(session.email);
    if (!agent) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const itemId = Number(body.item_id);
    const checked = Boolean(body.checked);

    const item = MASTER_ITEMS.find(i => i.id === itemId);
    if (!item) return NextResponse.json({ ok: false, error: 'item_not_found' }, { status: 404 });

    // Permission check: agent can only check YOU DO / WE GUIDE
    if (!AGENT_CAN_CHECK.has(item.owner)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    // Visibility check
    const visibleIds = new Set(visibleItemIds(agent));
    if (!visibleIds.has(itemId)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const now = new Date().toISOString();
    await upsertChecklistRow(agent.id, itemId, {
      checked,
      checked_at: checked ? now : null,
      checked_by: checked ? session.email : null,
      visible: true
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[onboarding/check]', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
