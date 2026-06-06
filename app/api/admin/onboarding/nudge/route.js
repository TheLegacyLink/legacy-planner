export const dynamic = 'force-dynamic';

import { resolveAdminSession } from '../../../../../lib/onboardingAdminAuth.js';

// app/api/admin/onboarding/nudge/route.js
// POST /api/admin/onboarding/nudge — send a nudge (stub for Phase 2)

import { NextResponse } from 'next/server';



export async function POST(req) {
  try {
    const session = await resolveAdminSession(req);
    if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    console.log('[nudge stub] agent_id:', body.agent_id, '— Phase 2 SMS/email nudge not yet implemented');

    return NextResponse.json({ ok: true, message: 'Nudge queued (Phase 2 stub)' });
  } catch (err) {
    console.error('[admin/onboarding/nudge]', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
