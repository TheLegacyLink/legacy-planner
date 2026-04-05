export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const HIERARCHY_STORE = 'stores/team-hierarchy.json';
const MESSAGE_STORE = 'stores/upline-support-messages.json';

function clean(v = '') {
  return String(v || '').trim();
}

function norm(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function personKey(name = '', email = '') {
  const em = norm(email);
  if (em) return `em:${em}`;
  const nm = norm(name).replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, '_');
  return nm ? `nm:${nm}` : '';
}

function nowIso() {
  return new Date().toISOString();
}

const ROLE_BY_NAME = {
  'kimora link': 'Agency Owner',
  'jamal holmes': 'Regional Director',
  'mahogany burns': 'Regional Director',
  'leticia wright': 'Regional Director',
  'kelin brown': 'Regional Director',
  'madalyn adams': 'Regional Director',
  'breanna james': 'Regional Director',
  'donyell richardson': 'Regional Director',
  'shannon maxwell': 'Regional Director',
  'angelique lassiter': 'Regional Director',
  'andrea cannon': 'Regional Director'
};

const ROLE_RANK = {
  'agency owner': 4,
  'regional director': 3,
  'inner circle leader': 2,
  mentor: 1
};

function roleForName(name = '') {
  const n = norm(name);
  return ROLE_BY_NAME[n] || 'Mentor';
}

function roleRank(label = '') {
  return ROLE_RANK[norm(label)] || 0;
}

function resolveUpline(rows = [], viewerName = '', viewerEmail = '') {
  const list = Array.isArray(rows) ? rows : [];
  const rootKey = personKey(viewerName, viewerEmail);
  if (!rootKey) return { rootKey: '', chain: [], highest: null };

  const byChild = new Map();
  for (const row of list) {
    const childKey = clean(row?.childKey);
    if (!childKey) continue;
    byChild.set(childKey, row);
  }

  const chain = [];
  let cursor = rootKey;
  const seen = new Set([cursor]);

  for (let i = 0; i < 12; i += 1) {
    const edge = byChild.get(cursor);
    if (!edge) break;

    const parentKey = clean(edge?.parentKey);
    const parentName = clean(edge?.parentName);
    const parentEmail = clean(edge?.parentEmail).toLowerCase();
    const role = roleForName(parentName);

    const node = {
      key: parentKey || personKey(parentName, parentEmail),
      name: parentName,
      email: parentEmail,
      role,
      source: clean(edge?.source || 'hierarchy') || 'hierarchy'
    };

    chain.push(node);

    if (!node.key || seen.has(node.key)) break;
    seen.add(node.key);
    cursor = node.key;
  }

  if (!chain.length) return { rootKey, chain: [], highest: null };

  const highest = chain
    .slice()
    .sort((a, b) => {
      const rankDiff = roleRank(b.role) - roleRank(a.role);
      if (rankDiff !== 0) return rankDiff;
      return chain.indexOf(b) - chain.indexOf(a);
    })[0];

  return { rootKey, chain, highest };
}

function toThreadKey(agentKey = '', uplineKey = '') {
  return `agent:${clean(agentKey)}::upline:${clean(uplineKey)}`;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const viewerName = clean(searchParams.get('name') || searchParams.get('viewerName') || '');
  const viewerEmail = clean(searchParams.get('email') || searchParams.get('viewerEmail') || '').toLowerCase();

  const hierarchyRows = await loadJsonStore(HIERARCHY_STORE, []);
  const messageRows = await loadJsonStore(MESSAGE_STORE, []);

  const { rootKey, chain, highest } = resolveUpline(hierarchyRows, viewerName, viewerEmail);

  const fallbackUpline = {
    key: personKey('Kimora Link', 'investalinkinsurance@gmail.com'),
    name: 'Kimora Link',
    email: 'investalinkinsurance@gmail.com',
    role: 'Agency Owner',
    source: 'fallback_default'
  };

  const upline = highest || fallbackUpline;
  const threadKey = toThreadKey(rootKey, upline.key);

  const rows = (Array.isArray(messageRows) ? messageRows : [])
    .filter((r) => clean(r?.threadKey) === threadKey)
    .sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime());

  const unreadForViewer = rows.filter((r) => clean(r?.toKey) === rootKey && !clean(r?.readAt)).length;
  const openAwaitingUpline = rows.filter((r) => clean(r?.fromKey) === rootKey && !clean(r?.respondedAt)).length;

  return Response.json({
    ok: true,
    rootKey,
    upline,
    chain,
    threadKey,
    rows,
    unreadForViewer,
    openAwaitingUpline,
    recommendedSyncHours: 12,
    responseSlaHours: 24
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = norm(body?.action || 'send_message');

  const viewerName = clean(body?.viewerName || body?.name || '');
  const viewerEmail = clean(body?.viewerEmail || body?.email || '').toLowerCase();
  const viewerKey = personKey(viewerName, viewerEmail);

  if (!viewerKey) {
    return Response.json({ ok: false, error: 'missing_viewer' }, { status: 400 });
  }

  const hierarchyRows = await loadJsonStore(HIERARCHY_STORE, []);
  const rows = await loadJsonStore(MESSAGE_STORE, []);
  const { highest } = resolveUpline(hierarchyRows, viewerName, viewerEmail);

  const upline = highest || {
    key: personKey('Kimora Link', 'investalinkinsurance@gmail.com'),
    name: 'Kimora Link',
    email: 'investalinkinsurance@gmail.com',
    role: 'Agency Owner',
    source: 'fallback_default'
  };

  const threadKey = toThreadKey(viewerKey, upline.key);

  if (action === 'mark_read') {
    const updated = rows.map((r) => {
      if (clean(r?.threadKey) !== threadKey) return r;
      if (clean(r?.toKey) !== viewerKey) return r;
      if (clean(r?.readAt)) return r;
      return { ...r, readAt: nowIso() };
    });
    await saveJsonStore(MESSAGE_STORE, updated);
    return Response.json({ ok: true, action: 'mark_read', threadKey });
  }

  if (action !== 'send_message') {
    return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
  }

  const bodyText = clean(body?.message || body?.body || '');
  if (!bodyText) {
    return Response.json({ ok: false, error: 'missing_message' }, { status: 400 });
  }

  const createdAt = nowIso();
  const deadlineAt = new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();

  const row = {
    id: `upl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    threadKey,
    fromKey: viewerKey,
    toKey: upline.key,
    fromName: viewerName,
    fromEmail: viewerEmail,
    toName: upline.name,
    toEmail: upline.email,
    fromRole: 'agent',
    toRole: 'upline',
    body: bodyText,
    status: 'new',
    createdAt,
    deadlineAt,
    respondedAt: '',
    readAt: ''
  };

  rows.push(row);
  await saveJsonStore(MESSAGE_STORE, rows);

  return Response.json({ ok: true, row, threadKey, upline, responseSlaHours: 24 });
}
