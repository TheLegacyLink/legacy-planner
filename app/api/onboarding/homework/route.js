// app/api/onboarding/homework/route.js
// POST /api/onboarding/homework — submit weekly homework

import { NextResponse } from 'next/server';
import { sessionFromToken } from '../../start-auth/_lib';
import { getAgentByEmail, saveHomework } from '../../../../lib/onboardingStore';
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
    const { youtube_url, weekly_note } = body;

    await saveHomework(agent.id, {
      youtube_url: String(youtube_url || '').trim(),
      weekly_note: String(weekly_note || '').trim()
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[onboarding/homework]', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
