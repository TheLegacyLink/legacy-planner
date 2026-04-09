import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

function clean(v = '') { return String(v || '').trim(); }
function normalizeEmail(v = '') { return clean(v).toLowerCase().replace(/[^a-z0-9._@+-]/g, ''); }
function storeKey(email = '') { return `stores/daily-drive/${normalizeEmail(email)}.json`; }

function isoWeek(dateStr = '') {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4.getTime() - ((jan4.getDay() + 6) % 7) * 86400000);
  const weekNum = Math.floor((d.getTime() - startOfWeek1.getTime()) / (7 * 86400000)) + 1;
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function defaultUser(email = '', tier = 'licensed_agent') {
  return {
    email: normalizeEmail(email),
    tier,
    onboardingComplete: false,
    why: '',
    whyPhoto: null,
    dailyGoal: tier === 'inner_circle' ? 5 : 2,
    logs: {},
    streakDays: 0,
    freezeUsedThisWeek: false,
    createdAt: new Date().toISOString()
  };
}

function calcStreak(logs = {}) {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const log = logs[key];
    if (!log) break;
    const score = (log.engaged || 0) * 0.5 + (log.realConvo || 0) * 1.0;
    if (i === 0 && score === 0) continue; // today not yet counted
    if (score === 0) break;
    streak++;
  }
  return streak;
}

export async function GET(req) {
  const url = new URL(req.url);
  const email = clean(url.searchParams.get('email') || '');
  const leaderboard = url.searchParams.get('leaderboard') === 'true';
  const tier = clean(url.searchParams.get('tier') || 'inner_circle');
  const week = clean(url.searchParams.get('week') || '');

  if (leaderboard) {
    // Scan all user stores — list approach
    try {
      const mod = await import('@vercel/blob').catch(() => null);
      if (!mod || !process.env.BLOB_READ_WRITE_TOKEN) {
        return Response.json({ ok: true, rows: [], week });
      }
      const listed = await mod.list({ prefix: 'stores/daily-drive/', limit: 500 });
      const blobs = (listed?.blobs || []).filter((b) => !b.pathname.includes('__v/'));
      const weekKey = week || isoWeek();
      const scores = [];
      await Promise.all(blobs.map(async (b) => {
        try {
          const res = await fetch(b.url, { cache: 'no-store' });
          if (!res.ok) return;
          const data = await res.json().catch(() => null);
          if (!data || data.tier !== tier) return;
          let weekScore = 0;
          Object.entries(data.logs || {}).forEach(([date, log]) => {
            if (isoWeek(date) === weekKey) {
              weekScore += (log.engaged || 0) * 0.5 + (log.realConvo || 0) * 1.0;
            }
          });
          const nameParts = (data.email || '').split('@')[0].replace(/[._]/g, ' ').split(' ');
          const displayName = nameParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
          scores.push({ email: data.email, displayName, score: weekScore });
        } catch {}
      }));
      scores.sort((a, b) => b.score - a.score);
      return Response.json({ ok: true, rows: scores.slice(0, 10), week: weekKey });
    } catch (e) {
      return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
    }
  }

  if (!email) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });
  const key = storeKey(email);
  const data = await loadJsonFile(key, null);
  const user = data || defaultUser(email);
  return Response.json({ ok: true, user });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = clean(body?.email || '');
  if (!email) return Response.json({ ok: false, error: 'missing_email' }, { status: 400 });

  const key = storeKey(email);
  const existing = await loadJsonFile(key, null);
  const user = existing || defaultUser(email, body?.tier || 'licensed_agent');
  const action = clean(body?.action || '');

  if (action === 'complete-onboarding') {
    user.onboardingComplete = true;
    user.why = clean(body?.why || user.why);
    user.tier = clean(body?.tier || user.tier);
    user.dailyGoal = user.tier === 'inner_circle' ? 5 : 2;
    if (body?.whyPhoto) user.whyPhoto = body.whyPhoto;
  } else if (action === 'update-why') {
    user.why = clean(body?.why || user.why);
    if (body?.whyPhoto !== undefined) user.whyPhoto = body.whyPhoto;
  } else if (action === 'log') {
    const type = clean(body?.type || '');
    const date = clean(body?.date || new Date().toISOString().slice(0, 10));
    if (!['touch', 'engaged', 'realConvo'].includes(type)) {
      return Response.json({ ok: false, error: 'invalid_type' }, { status: 400 });
    }
    if (!user.logs[date]) user.logs[date] = { touch: 0, engaged: 0, realConvo: 0 };
    user.logs[date][type] = (user.logs[date][type] || 0) + 1;
    user.streakDays = calcStreak(user.logs);
  } else if (action === 'undo') {
    const type = clean(body?.type || '');
    const date = clean(body?.date || new Date().toISOString().slice(0, 10));
    if (!['touch', 'engaged', 'realConvo'].includes(type)) {
      return Response.json({ ok: false, error: 'invalid_type' }, { status: 400 });
    }
    if (user.logs[date]) {
      user.logs[date][type] = Math.max(0, (user.logs[date][type] || 0) - 1);
    }
    user.streakDays = calcStreak(user.logs);
  } else if (action === 'freeze-day') {
    const date = clean(body?.date || new Date().toISOString().slice(0, 10));
    if (!user.logs[date]) user.logs[date] = { touch: 0, engaged: 0, realConvo: 0 };
    user.logs[date].frozen = true;
    user.freezeUsedThisWeek = true;
  } else {
    return Response.json({ ok: false, error: 'unknown_action' }, { status: 400 });
  }

  await saveJsonFile(key, user);
  return Response.json({ ok: true, user });
}
