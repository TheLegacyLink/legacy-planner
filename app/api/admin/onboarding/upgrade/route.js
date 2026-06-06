// app/api/admin/onboarding/upgrade/route.js
// POST /api/admin/onboarding/upgrade — upgrade agent from inner_circle to elite

import { NextResponse } from 'next/server';
import { sessionFromToken } from '../../../start-auth/_lib';
import {
  getAgentById,
  upsertAgent,
  getChecklist,
  upsertChecklistRow,
  MASTER_ITEMS,
  visibleItemIds
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

export async function POST(req) {
  try {
    await ensureLeticiaWright();

    const session = await requireAdmin(req);
    if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { agent_id } = body;

    if (!agent_id) return NextResponse.json({ ok: false, error: 'missing_agent_id' }, { status: 400 });

    const agent = await getAgentById(agent_id);
    if (!agent) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

    const now = new Date().toISOString();

    // Upgrade tier
    const upgradedAgent = await upsertAgent({
      ...agent,
      tier: 'elite',
      upgraded_at: now
    });

    // Make elite-only items visible (recalculate from upgraded agent)
    const visibleIds = new Set(visibleItemIds(upgradedAgent));
    const existingRows = await getChecklist(agent.id);
    const existingItemIds = new Set(existingRows.map(r => r.item_id));

    for (const item of MASTER_ITEMS) {
      if (!item.elite_only) continue;
      // Upsert visibility = true for all elite items
      await upsertChecklistRow(agent.id, item.id, {
        visible: visibleIds.has(item.id)
      });
    }

    // Also seed any elite items that don't have rows yet
    for (const item of MASTER_ITEMS) {
      if (!visibleIds.has(item.id)) continue;
      if (!existingItemIds.has(item.id)) {
        await upsertChecklistRow(agent.id, item.id, {
          visible: true,
          checked: false,
          checked_at: null,
          checked_by: null
        });
      }
    }

    return NextResponse.json({ ok: true, agent: upgradedAgent });
  } catch (err) {
    console.error('[admin/onboarding/upgrade]', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
