export const dynamic = 'force-dynamic';

// app/api/admin/onboarding/check/route.js
// POST /api/admin/onboarding/check — admin checks any item for any agent

import { NextResponse } from 'next/server';
import { sessionFromToken } from '../../../start-auth/_lib';
import {
  getAgentById,
  upsertChecklistRow,
  MASTER_ITEMS
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
    const { agent_id, item_id, checked } = body;

    if (!agent_id || !item_id) {
      return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }

    const agent = await getAgentById(agent_id);
    if (!agent) return NextResponse.json({ ok: false, error: 'agent_not_found' }, { status: 404 });

    const item = MASTER_ITEMS.find(i => i.id === Number(item_id));
    if (!item) return NextResponse.json({ ok: false, error: 'item_not_found' }, { status: 404 });

    const isChecked = Boolean(checked);
    const now = new Date().toISOString();

    await upsertChecklistRow(agent.id, Number(item_id), {
      checked: isChecked,
      checked_at: isChecked ? now : null,
      checked_by: isChecked ? session.email : null,
      visible: true
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/onboarding/check]', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
