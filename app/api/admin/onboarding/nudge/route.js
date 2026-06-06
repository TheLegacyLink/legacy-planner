export const dynamic = 'force-dynamic';

import { resolveAdminSession } from '../../../../../lib/onboardingAdminAuth.js';

// app/api/admin/onboarding/nudge/route.js
// POST /api/admin/onboarding/nudge — send a nudge (stub for Phase 2)

import { NextResponse } from 'next/server';



export async function POST(req) {
  try {
    const t = token(req);
    if (!t) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const session = await sessionFromToken(t);
    if (!session || !ADMIN_EMAILS.has(session.email)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    console.log('[nudge stub] agent_id:', body.agent_id, '— Phase 2 SMS/email nudge not yet implemented');

    return NextResponse.json({ ok: true, message: 'Nudge queued (Phase 2 stub)' });
  } catch (err) {
    console.error('[admin/onboarding/nudge]', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
