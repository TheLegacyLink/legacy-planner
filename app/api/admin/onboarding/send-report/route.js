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

    const session = await resolveAdminSession(req);
    if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const result = await sendWeeklyReport();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[admin/onboarding/send-report]', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
