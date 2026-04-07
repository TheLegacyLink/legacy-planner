export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/peak-performance-plans.json';

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase(); }

function fallbackPlan({ priorityGoal = '', why = '' } = {}) {
  const core = clean(priorityGoal) || 'your top insurance goal';
  const reason = clean(why) || 'your personal motivation';
  return Array.from({ length: 14 }, (_, i) => {
    const day = i + 1;
    const blocks = [
      `Set your insurance focus for the day around "${core}" and review your reason: ${reason}.`,
      'Post one value-based insurance content piece (education, story, or FAQ).',
      'Call/text 10 warm leads and 10 cold leads; track replies and follow-ups.',
      'Book at least 2 appointments and confirm both with reminder text.',
      'Run script reps (sales + recruiting) for 20 minutes and record key objections.',
      'Follow up all open conversations from the last 72 hours.',
      'Submit one application or move one prospect to next concrete step.'
    ];
    const pick = blocks[(day - 1) % blocks.length];
    return {
      id: `step_${day}`,
      day,
      focus: `Insurance production day ${day}`,
      text: `Day ${day}: ${pick}`,
      metrics: ['20 total outreach', '2 appointments booked', '1 concrete conversion action']
    };
  });
}

async function generatePlanAI({ goals = [], priorityGoal = '', why = '' } = {}) {
  const apiKey = clean(process.env.OPENAI_API_KEY || '');
  if (!apiKey) return fallbackPlan({ priorityGoal, why });

  const input = [
    'You are an insurance sales performance coach for Legacy Link.',
    'Generate a strict 14-day action plan ONLY in the realm of insurance business growth.',
    'Allowed domains: posting insurance content, lead outreach, calls/texts, follow-ups, appointment setting, script practice, submissions, client protection reviews, recruiting for insurance team building.',
    'Do not include non-insurance advice.',
    'Return JSON only in this shape:',
    '{"plan_steps":[{"day":1,"focus":"...","text":"...","metrics":["...","...","..."]}],"coach_note":"..."}',
    `Goals: ${goals.join(' | ')}`,
    `Priority Goal: ${priorityGoal}`,
    `Why: ${why}`
  ].join('\n');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.PEAK_PERFORMANCE_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You produce concise, practical, insurance-only coaching plans in strict JSON.' },
          { role: 'user', content: input }
        ]
      })
    });

    if (!res.ok) return fallbackPlan({ priorityGoal, why });
    const data = await res.json().catch(() => ({}));
    const content = clean(data?.choices?.[0]?.message?.content || '');
    if (!content) return fallbackPlan({ priorityGoal, why });

    const parsed = JSON.parse(content);
    const rows = Array.isArray(parsed?.plan_steps) ? parsed.plan_steps : [];
    if (!rows.length) return fallbackPlan({ priorityGoal, why });

    return rows.slice(0, 14).map((r, i) => ({
      id: `step_${i + 1}`,
      day: Number(r?.day || i + 1),
      focus: clean(r?.focus || `Insurance production day ${i + 1}`),
      text: clean(r?.text || `Day ${i + 1}: Take one focused insurance action.`),
      metrics: Array.isArray(r?.metrics) ? r.metrics.map((m) => clean(m)).filter(Boolean).slice(0, 5) : []
    }));
  } catch {
    return fallbackPlan({ priorityGoal, why });
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const email = norm(searchParams.get('email') || '');
  const name = norm(searchParams.get('name') || '');

  const rowsRaw = await loadJsonStore(STORE_PATH, []);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : [];

  const mine = rows.filter((r) => {
    const re = norm(r?.memberEmail || '');
    const rn = norm(r?.memberName || '');
    if (email && re) return email === re;
    if (name && rn) return name === rn;
    return false;
  });

  mine.sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
  return Response.json({ ok: true, rows: mine, latest: mine[0] || null });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = norm(body?.action || 'generate');
  if (action !== 'generate') return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });

  const goals = (Array.isArray(body?.goals) ? body.goals : []).map((g) => clean(g)).filter(Boolean).slice(0, 10);
  const priorityGoal = clean(body?.priorityGoal || '');
  const why = clean(body?.why || '');
  const memberName = clean(body?.memberName || '');
  const memberEmail = norm(body?.memberEmail || '');

  if (goals.length < 5) return Response.json({ ok: false, error: 'need_5_goals' }, { status: 400 });
  if (!priorityGoal) return Response.json({ ok: false, error: 'missing_priority_goal' }, { status: 400 });
  if (!why) return Response.json({ ok: false, error: 'missing_why' }, { status: 400 });

  const planSteps = await generatePlanAI({ goals, priorityGoal, why });

  const row = {
    id: `ppp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    memberName,
    memberEmail,
    goals,
    priorityGoal,
    why,
    planSteps,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const rowsRaw = await loadJsonStore(STORE_PATH, []);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : [];
  rows.unshift(row);
  await saveJsonStore(STORE_PATH, rows);

  return Response.json({ ok: true, row });
}
