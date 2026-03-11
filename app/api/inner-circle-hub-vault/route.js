import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/inner-circle-hub-vault.json';

const DEFAULT_VAULT = {
  content: [
    {
      id: 'content-daily-post',
      title: 'Daily Post Prompt',
      body: 'Post this today: "Most families do not have a financial game plan. If something happened tomorrow, would your family be protected?" CTA: DM "PLAN" to run a free strategy call.',
      tag: 'social'
    },
    {
      id: 'content-story-template',
      title: 'Credibility Story Template',
      body: 'Use this 4-line story: 1) Who you helped. 2) Their problem. 3) What changed. 4) Why this matters for people like them.',
      tag: 'story'
    }
  ],
  calls: [
    {
      id: 'calls-discovery',
      title: 'Discovery Call Structure',
      body: '10 min context + 10 min pain points + 10 min options + 10 min recommendation + 5 min close + 5 min next steps.',
      tag: 'call-flow'
    },
    {
      id: 'calls-close-transition',
      title: 'Close Transition',
      body: '"Based on what you shared, here is my recommendation. If we handle this now, we lock protection and momentum today. Are you ready to move forward?"',
      tag: 'close'
    }
  ],
  onboarding: [
    {
      id: 'onboarding-crm-checklist',
      title: 'CRM Setup Checklist',
      body: 'Pipeline stages confirmed, lead source tags set, appointment calendar linked, and follow-up automation activated.',
      tag: 'setup'
    },
    {
      id: 'onboarding-daily-standard',
      title: 'Daily Execution Standard',
      body: 'Minimum standard: 25+ outreaches, 10+ follow-ups, 1+ booked conversation, and end-of-day tracker update.',
      tag: 'discipline'
    }
  ]
};

function clean(v = '') { return String(v || '').trim(); }
function nowIso() { return new Date().toISOString(); }

function normalizeVault(raw = {}) {
  const out = {
    content: Array.isArray(raw?.content) ? raw.content : DEFAULT_VAULT.content,
    calls: Array.isArray(raw?.calls) ? raw.calls : DEFAULT_VAULT.calls,
    onboarding: Array.isArray(raw?.onboarding) ? raw.onboarding : DEFAULT_VAULT.onboarding
  };
  return out;
}

export async function GET() {
  const raw = await loadJsonFile(STORE_PATH, DEFAULT_VAULT);
  return Response.json({ ok: true, vault: normalizeVault(raw) });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = clean(body?.action || '').toLowerCase();
  const section = clean(body?.section || '').toLowerCase();
  const allowed = ['content', 'calls', 'onboarding'];

  if (!allowed.includes(section)) {
    return Response.json({ ok: false, error: 'invalid_section' }, { status: 400 });
  }

  const raw = await loadJsonFile(STORE_PATH, DEFAULT_VAULT);
  const vault = normalizeVault(raw);

  if (action === 'upsert_item') {
    const itemId = clean(body?.id) || `vault_${Date.now()}`;
    const title = clean(body?.title);
    const bodyText = clean(body?.body);
    const tag = clean(body?.tag);
    if (!title || !bodyText) {
      return Response.json({ ok: false, error: 'missing_title_or_body' }, { status: 400 });
    }

    const rows = Array.isArray(vault[section]) ? vault[section] : [];
    const idx = rows.findIndex((r) => clean(r?.id) === itemId);
    const next = {
      ...(idx >= 0 ? rows[idx] : {}),
      id: itemId,
      title,
      body: bodyText,
      tag,
      updatedAt: nowIso()
    };

    if (idx >= 0) rows[idx] = next;
    else rows.unshift(next);
    vault[section] = rows;

    await saveJsonFile(STORE_PATH, vault);
    return Response.json({ ok: true, vault });
  }

  if (action === 'delete_item') {
    const itemId = clean(body?.id);
    vault[section] = (vault[section] || []).filter((r) => clean(r?.id) !== itemId);
    await saveJsonFile(STORE_PATH, vault);
    return Response.json({ ok: true, vault });
  }

  return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
}
