export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/onboarding/system-agents
 * Returns agents already in the back-office system (start-intake store)
 * who are NOT yet enrolled in the onboarding tracker.
 * Used by the admin "Enroll Agent" picker so Kimora can select instead of type.
 */

import { NextResponse } from 'next/server';
import { resolveAdminSession } from '../../../../../lib/onboardingAdminAuth.js';
import { loadJsonStore } from '../../../../../lib/blobJsonStore';
import { getAllAgents } from '../../../../../lib/onboardingStore';
import { ensureLeticiaWright } from '../../../../../lib/onboardingSeed';

const START_INTAKE_PATH = 'stores/start-intake.json';

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase(); }

export async function GET(req) {
  const admin = await resolveAdminSession(req);
  if (!admin) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  await ensureLeticiaWright();

  // Load all start-intake records (registered back office users)
  const intakeRows = await loadJsonStore(START_INTAKE_PATH, []);
  const intake = Array.isArray(intakeRows) ? intakeRows : [];

  // Load already-enrolled agents
  const enrolled = await getAllAgents();
  const enrolledEmails = new Set(enrolled.map(a => norm(a.email)));

  // Filter to people not yet enrolled, build a clean list
  const available = intake
    .filter(r => r?.email && !enrolledEmails.has(norm(r.email)))
    .map(r => ({
      id: clean(r.id || ''),
      first_name: clean(r.firstName || ''),
      last_name: clean(r.lastName || ''),
      email: norm(r.email),
      phone: clean(r.phone || ''),
      track_type: clean(r.trackType || 'unlicensed'),
    }))
    .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));

  return NextResponse.json({ ok: true, agents: available });
}
