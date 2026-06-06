export const dynamic = 'force-dynamic';

// app/api/onboarding/book/route.js
// POST /api/onboarding/book — mark monthly book complete

import { NextResponse } from 'next/server';
import { sessionFromToken } from '../../start-auth/_lib';
import { getAgentByEmail, saveBook } from '../../../../lib/onboardingStore';
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
    const completed = Boolean(body.completed);

    await saveBook(agent.id, { completed });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[onboarding/book]', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
