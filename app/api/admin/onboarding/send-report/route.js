export const dynamic = 'force-dynamic';

import { resolveAdminSession } from '../../../../../lib/onboardingAdminAuth.js';

// app/api/admin/onboarding/send-report/route.js
// POST /api/admin/onboarding/send-report — trigger weekly report immediately (admin only)

import { NextResponse } from 'next/server';
import { sendWeeklyReport } from '../../../../../lib/onboardingReport';
import { ensureLeticiaWright } from '../../../../../lib/onboardingSeed';



export async function POST(req) {
  try {
    await ensureLeticiaWright();

    const t = token(req);
    if (!t) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const session = await sessionFromToken(t);
    if (!session || !ADMIN_EMAILS.has(session.email)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const result = await sendWeeklyReport();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[admin/onboarding/send-report]', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
