// lib/onboardingSeed.js
// Ensures Leticia Wright is seeded in the system on app boot.
// Call ensureLeticiaWright() at the top of each API route handler (no-op if already exists).

import { getAgentByEmail, upsertAgent, initAgentChecklist } from './onboardingStore';

export async function ensureLeticiaWright() {
  try {
    const existing = await getAgentByEmail('leticiawright05@gmail.com');
    if (existing) return existing;

    const agent = await upsertAgent({
      first_name: 'Leticia',
      last_name: 'Wright',
      email: 'leticiawright05@gmail.com',
      tier: 'elite',
      paid_in_full: true,
      start_date: '2026-06-06',
      status: 'active'
    });

    await initAgentChecklist(agent);
    return agent;
  } catch (err) {
    // Non-fatal — log but don't crash route
    console.error('[onboardingSeed] ensureLeticiaWright error:', err?.message || err);
    return null;
  }
}
