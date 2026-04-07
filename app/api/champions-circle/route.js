export const dynamic = 'force-dynamic';
export const revalidate = 0;

import nodemailer from 'nodemailer';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import { DEFAULT_CONFIG } from '../../../lib/runtimeConfig';
import { computeChampionsCircle, computeBonusHits } from '../../../lib/championsCircle';

const POLICY_STORE = 'stores/policy-submissions.json';
const COMMUNITY_STORE = 'stores/community-service-submissions.json';
const INNER_MEMBERS_STORE = 'stores/inner-circle-hub-members.json';
const ALERTS_STORE = 'stores/champions-circle-bonus-alerts.json';
const SNAPSHOTS_STORE = 'stores/champions-circle-monthly-snapshots.json';

function clean(v = '') { return String(v || '').trim(); }
function normalizeName(v = '') { return clean(v).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function nameSig(v = '') {
  const parts = normalizeName(v).split(' ').filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}
function rowMatchesIdentity(row = {}, identity = {}) {
  const rowName = clean(row?.agent || '');
  const targetName = clean(identity?.name || '');
  if (!rowName || !targetName) return false;
  return normalizeName(rowName) === normalizeName(targetName) || nameSig(rowName) === nameSig(targetName);
}
function nowIso() { return new Date().toISOString(); }

function isAdminActor(name = '') {
  const actor = normalizeName(name);
  const fromEnv = clean(process.env.CHAMPIONS_CIRCLE_ADMIN_NAMES || '')
    .split(',')
    .map((x) => normalizeName(x))
    .filter(Boolean);
  const allow = new Set([...(fromEnv.length ? fromEnv : ['kimora link'])]);
  return allow.has(actor);
}

function summarizeSnapshot(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const totalPayout = list.reduce((sum, r) => sum + Number(r?.monthlyCashPayout || 0), 0);
  const payoutReadyCount = list.filter((r) => Number(r?.monthlyCashPayout || 0) > 0).length;
  return { totalPayout, payoutReadyCount, count: list.length };
}

async function getMonthSnapshot(month = '') {
  const snapshots = await loadJsonStore(SNAPSHOTS_STORE, []);
  const found = (Array.isArray(snapshots) ? snapshots : []).find((s) => clean(s?.month) === clean(month));
  return found || null;
}

async function finalizeMonthSnapshot({ month = '', actorName = '' } = {}) {
  const targetMonth = clean(month);
  if (!targetMonth) return { ok: false, error: 'month_required' };
  if (!isAdminActor(actorName)) return { ok: false, error: 'admin_required' };

  const existing = await getMonthSnapshot(targetMonth);
  if (existing) {
    return { ok: true, locked: true, alreadyLocked: true, snapshot: existing };
  }

  const summary = await loadSummary();
  if (clean(summary?.month) !== targetMonth) {
    return { ok: false, error: 'month_not_current', currentMonth: clean(summary?.month || '') };
  }

  const rowSnapshot = (summary?.rows || []).map((r) => ({
    agent: clean(r?.agent || ''),
    group: clean(r?.group || ''),
    monthProductionAp: Number(r?.monthProductionAp || 0),
    monthSponsorshipPolicies: Number(r?.monthSponsorshipPolicies || 0),
    monthPolicySubmissions: Number(r?.monthPolicySubmissions || 0),
    monthServiceHours: Number(r?.monthServiceHours || 0),
    productionPayout: Number(r?.productionBonusTier?.payout || 0),
    sponsorshipPayout: Number(r?.sponsorshipBonusTier?.payout || 0),
    submissionPayout: Number(r?.submissionRewardPayout || 0),
    communityPayout: Number(r?.communityBonusTier?.payout || 0),
    monthlyCashPayout: Number(r?.monthlyCashPayout || 0),
    quarterTier: clean(r?.quarterTierHit?.label || ''),
    quarterPayout: Number(r?.quarterTierHit?.payout || 0)
  }));

  const summaryMeta = summarizeSnapshot(rowSnapshot);
  const snapshot = {
    id: `cc_snap_${targetMonth.replace(/[^0-9A-Za-z]/g, '')}`,
    month: targetMonth,
    quarter: clean(summary?.quarter || ''),
    finalizedAt: nowIso(),
    finalizedBy: clean(actorName || 'Kimora Link'),
    summary: summaryMeta,
    rows: rowSnapshot
  };

  const snapshots = await loadJsonStore(SNAPSHOTS_STORE, []);
  const next = [snapshot, ...(Array.isArray(snapshots) ? snapshots : [])];
  await saveJsonStore(SNAPSHOTS_STORE, next);

  return { ok: true, locked: true, snapshot };
}

function dedupeByKey(rows = []) {
  const map = new Map();
  for (const row of rows || []) {
    const key = clean(row?.key || '');
    if (!key) continue;
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

function alertRecipients() {
  const env = clean(process.env.CHAMPIONS_CIRCLE_ALERT_EMAILS || process.env.BONUS_ALERT_EMAILS || '');
  const list = env
    ? env.split(',').map((x) => clean(x)).filter(Boolean)
    : ['kimora@thelegacylink.com', 'support@thelegacylink.com'];
  return [...new Set(list.map((x) => x.toLowerCase()))];
}

async function sendBonusAlertEmail(hits = []) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  const recipients = alertRecipients();

  if (!hits.length) return { ok: true, skipped: true, reason: 'no_hits' };
  if (!user || !pass || !from || !recipients.length) {
    return { ok: false, error: 'missing_email_env_or_recipients' };
  }

  const total = hits.reduce((sum, h) => sum + Number(h?.payout || 0), 0);
  const subject = `Champions Circle Bonus Alert: ${hits.length} hit(s) • $${total.toLocaleString()}`;

  const text = [
    'Champions Circle bonus thresholds were hit.',
    '',
    ...hits.map((h, i) => `${i + 1}) ${h.agent} • ${h.category} • Payout: $${Number(h.payout || 0).toLocaleString()} • Period: ${h.period}`),
    '',
    `Total payout flagged: $${total.toLocaleString()}`,
    '',
    'Review payout queue and confirm before release.'
  ].join('\n');

  const htmlRows = hits
    .map((h) => `<tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${h.agent}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${h.category}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${h.period}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">$${Number(h.payout || 0).toLocaleString()}</td>
    </tr>`)
    .join('');

  const html = `<div style="font-family:Arial,sans-serif;padding:16px;color:#0f172a;">
    <h2 style="margin:0 0 10px;">Champions Circle Bonus Alert</h2>
    <p style="margin:0 0 12px;">The following bonus thresholds were hit:</p>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">Agent</th>
          <th style="text-align:left;padding:8px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">Category</th>
          <th style="text-align:left;padding:8px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">Period</th>
          <th style="text-align:left;padding:8px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">Payout</th>
        </tr>
      </thead>
      <tbody>${htmlRows}</tbody>
    </table>
    <p style="margin:12px 0 0;"><strong>Total payout flagged: $${total.toLocaleString()}</strong></p>
  </div>`;

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const info = await tx.sendMail({ from, to: recipients.join(', '), subject, text, html });
  return { ok: true, messageId: info?.messageId || '', to: recipients };
}

async function loadSummary() {
  const [policyRows, communityRows, innerMembers] = await Promise.all([
    loadJsonStore(POLICY_STORE, []),
    loadJsonStore(COMMUNITY_STORE, []),
    loadJsonStore(INNER_MEMBERS_STORE, [])
  ]);

  return computeChampionsCircle({
    policyRows,
    communityRows,
    innerMembers,
    agents: DEFAULT_CONFIG.agents || []
  });
}


async function runNotifyBonusHits() {
  const summary = await loadSummary();
  const hits = dedupeByKey(computeBonusHits(summary));

  const existing = await loadJsonStore(ALERTS_STORE, []);
  const sentKeys = new Set((existing || []).map((r) => clean(r?.key || '')).filter(Boolean));
  const newHits = hits.filter((h) => !sentKeys.has(clean(h?.key || '')));

  let email = { ok: true, skipped: true, reason: 'no_new_hits' };
  if (newHits.length) {
    email = await sendBonusAlertEmail(newHits).catch((e) => ({ ok: false, error: clean(e?.message || 'send_failed') }));

    if (email?.ok) {
      const additions = newHits.map((h) => ({ ...h, alertedAt: nowIso() }));
      await saveJsonStore(ALERTS_STORE, [...additions, ...(existing || [])]);
    }
  }

  return {
    ok: true,
    month: summary.month,
    quarter: summary.quarter,
    hits,
    newHits,
    email
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const group = clean(searchParams.get('group') || '').toLowerCase();
  const includeHits = clean(searchParams.get('includeHits') || 'false') === 'true';
  const selfOnly = clean(searchParams.get('self') || 'false') === 'true';
  const name = clean(searchParams.get('name') || '');
  const action = clean(searchParams.get('action') || '').toLowerCase();
  const cronHeader = clean(req.headers.get('x-vercel-cron') || req.headers.get('x-vercel-scheduled') || '');

  if (action === 'notify_bonus_hits' || cronHeader) {
    const out = await runNotifyBonusHits();
    return Response.json(out);
  }

  const summary = await loadSummary();
  let rows = group === 'inner' ? summary.inner : group === 'licensed' ? summary.licensed : summary.rows;

  if (selfOnly) {
    if (!name) return Response.json({ ok: false, error: 'name_required_for_self_filter' }, { status: 400 });
    rows = rows.filter((r) => rowMatchesIdentity(r, { name }));
  }

  const hits = includeHits ? computeBonusHits(summary) : [];

  const monthLock = await getMonthSnapshot(summary.month);

  return Response.json({
    ok: true,
    month: summary.month,
    quarter: summary.quarter,
    monthLock: monthLock ? {
      locked: true,
      finalizedAt: monthLock?.finalizedAt || '',
      finalizedBy: monthLock?.finalizedBy || '',
      totalPayout: Number(monthLock?.summary?.totalPayout || 0),
      payoutReadyCount: Number(monthLock?.summary?.payoutReadyCount || 0)
    } : { locked: false },
    rows,
    hits
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = clean(body?.action || 'notify_bonus_hits').toLowerCase();

  if (action === 'notify_bonus_hits') {
    const out = await runNotifyBonusHits();
    return Response.json(out);
  }

  if (action === 'finalize_month_snapshot') {
    const month = clean(body?.month || '');
    const actorName = clean(body?.actorName || '');
    const out = await finalizeMonthSnapshot({ month, actorName });
    if (!out?.ok) return Response.json(out, { status: 400 });
    return Response.json(out);
  }

  return Response.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
}
