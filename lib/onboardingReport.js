// lib/onboardingReport.js
// Weekly onboarding report — builds and emails the HTML report to Kimora

import nodemailer from 'nodemailer';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { loadJsonStore, saveJsonStore } from './blobJsonStore';
import {
  getAllAgents,
  getAllProgress,
  getChecklist,
  MASTER_ITEMS
} from './onboardingStore';

const REPORT_LOG_PATH = 'stores/onboarding-report-log.json';
const RECIPIENT = 'kimora@thelegacylink.com';

function daysSince(isoDate) {
  if (!isoDate) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24)));
}

function getMondayOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export async function buildReportData() {
  const agents = await getAllAgents();
  const progress = await getAllProgress();
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weekAgo = new Date(now - weekMs).toISOString();

  const activeAgents = agents.filter(a => a.status === 'active');

  // Stuck
  const stuckAgents = activeAgents.filter(agent => {
    const prog = progress[agent.id] || { pct: 0, lastMoveAt: null };
    const daysSinceMove = prog.lastMoveAt
      ? Math.floor((now - new Date(prog.lastMoveAt).getTime()) / (1000 * 60 * 60 * 24))
      : daysSince(agent.start_date);
    return daysSinceMove >= 7 && prog.pct < 90;
  });

  // Top movers
  const moverData = await Promise.all(
    activeAgents.map(async agent => {
      const rows = await getChecklist(agent.id);
      const recentChecks = rows.filter(r => r.checked && r.checked_at && r.checked_at > weekAgo);
      const prog = progress[agent.id] || {};
      const prevPct = Math.max(0, (prog.pct || 0) - recentChecks.length * 5);
      return {
        agent,
        count: recentChecks.length,
        pct: prog.pct || 0,
        delta: (prog.pct || 0) - prevPct
      };
    })
  );
  const topMovers = moverData
    .filter(m => m.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // New starts
  const newStarts = activeAgents.filter(a => {
    return a.start_date && a.start_date > new Date(now - weekMs).toISOString().slice(0, 10);
  });

  // Ready for upgrade
  const readyForUpgrade = activeAgents.filter(a => {
    if (a.tier !== 'inner_circle') return false;
    const prog = progress[a.id] || {};
    return prog.pct >= 70 && daysSince(a.start_date) >= 60;
  });

  // Kimora action items
  const kimoraItems = [];
  for (const agent of activeAgents) {
    const rows = await getChecklist(agent.id);
    for (const item of MASTER_ITEMS) {
      if (!['WE DO', 'CARRIER', 'WE PAY'].includes(item.owner)) continue;
      if (item.recurring) continue;
      const row = rows.find(r => r.item_id === item.id);
      if (row?.checked) continue;
      const daysIn = daysSince(agent.start_date);
      if (daysIn >= item.target_day_start) {
        kimoraItems.push({
          agent: `${agent.first_name} ${agent.last_name}`,
          item: item.title,
          overdue: daysIn > item.target_day_end
        });
      }
    }
  }

  const avgProgress = activeAgents.length > 0
    ? Math.round(activeAgents.reduce((s, a) => s + ((progress[a.id] || {}).pct || 0), 0) / activeAgents.length)
    : 0;

  return {
    activeAgents,
    stuckAgents,
    topMovers,
    newStarts,
    readyForUpgrade,
    kimoraItems,
    avgProgress,
    eliteCount: activeAgents.filter(a => a.tier === 'elite').length,
    icCount: activeAgents.filter(a => a.tier === 'inner_circle').length
  };
}

function renderTopMoverBlock(movers) {
  if (!movers.length) return '<p style="color:#9C9486;font-size:13px;padding:0 32px;">No top movers this week.</p>';
  return movers.map(m => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;">
      <tr>
        <td style="padding:10px 12px;background:#FAF8F2;border-radius:6px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="vertical-align:middle;">
                <div style="font-size:14px;font-weight:600;color:#1A1410;">${m.agent.first_name} ${m.agent.last_name}</div>
                <div style="font-size:12px;color:#6B6357;">${m.count} items completed</div>
              </td>
              <td align="right" style="vertical-align:middle;">
                <div style="font-family:'DM Sans',Arial,sans-serif;font-size:18px;font-weight:700;color:#437A22;">+${m.delta}%</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`).join('');
}

function renderStuckBlock(stuck) {
  if (!stuck.length) return '<p style="color:#9C9486;font-size:13px;">No stuck agents this week. 🎉</p>';
  return stuck.map(a => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;">
      <tr>
        <td style="padding:10px 12px;background:#FBE9F3;border-radius:6px;border-left:3px solid #A12C7B;">
          <div style="font-size:14px;font-weight:600;color:#1A1410;">${a.first_name} ${a.last_name}</div>
          <div style="font-size:12px;color:#6B6357;margin-top:2px;">
            No movement for 7+ days · ${a.tier === 'elite' ? 'Elite' : 'Inner Circle'}
          </div>
        </td>
      </tr>
    </table>`).join('');
}

function renderNewStartsBlock(starts) {
  if (!starts.length) return '<p style="color:#9C9486;font-size:13px;">No new starts this week.</p>';
  return starts.map(a => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;">
      <tr>
        <td style="padding:10px 12px;background:#DCE9F2;border-radius:6px;">
          <div style="font-size:14px;font-weight:600;color:#1A1410;">${a.first_name} ${a.last_name}</div>
          <div style="font-size:12px;color:#1B4F72;">Started ${fmtDate(a.start_date)} · ${a.tier === 'elite' ? 'Elite' : 'Inner Circle'}</div>
        </td>
      </tr>
    </table>`).join('');
}

function renderReadyBlock(ready) {
  if (!ready.length) return '<p style="color:#9C9486;font-size:13px;">No agents ready to upgrade yet.</p>';
  return ready.map(a => {
    const prog = a._prog || {};
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;">
      <tr>
        <td style="padding:10px 12px;background:#FFF4D6;border-radius:6px;">
          <div style="font-size:14px;font-weight:600;color:#1A1410;">${a.first_name} ${a.last_name}</div>
          <div style="font-size:12px;color:#7A5A0C;margin-top:2px;">
            ${prog.pct || 0}% complete · Day ${daysSince(a.start_date)}
          </div>
        </td>
      </tr>
    </table>`;
  }).join('');
}

function renderActionItems(items) {
  if (!items.length) return '<li style="margin-bottom:6px;">Nothing urgent this week. 🎉</li>';
  return items.slice(0, 10).map(i =>
    `<li style="margin-bottom:6px;">${i.item} — <strong>${i.agent}</strong>${i.overdue ? ' <span style="color:#A12C7B">(overdue)</span>' : ''}</li>`
  ).join('');
}

export async function sendWeeklyReport() {
  const user = String(process.env.GMAIL_APP_USER || '').trim();
  const pass = String(process.env.GMAIL_APP_PASSWORD || '').trim();
  if (!user || !pass) {
    console.error('[onboardingReport] GMAIL_APP_USER/GMAIL_APP_PASSWORD not set');
    return { ok: false, error: 'missing_gmail_env' };
  }

  const data = await buildReportData();
  const weekStart = getMondayOfWeek();

  // Build HTML from template tokens
  let templateHtml;
  try {
    const templatePath = join(process.cwd(), '..', 'legacy-link-onboarding-tracker-handoff', 'onboarding-tracker', 'email', 'weekly-report.html');
    templateHtml = await readFile(templatePath, 'utf8');
  } catch {
    // Fallback: use inline minimal template
    templateHtml = buildFallbackTemplate();
  }

  const dashboardUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.thelegacylink.com'}/admin/onboarding`;

  const headlineLine = data.stuckAgents.length > 0
    ? `${data.stuckAgents.length} agent${data.stuckAgents.length > 1 ? 's need' : ' needs'} your attention.`
    : 'Looking strong this week.';

  // Replace template tokens
  const html = templateHtml
    .replace(/\{\{WEEK_START\}\}/g, fmtDate(weekStart))
    .replace(/\{\{HEADLINE_LINE\}\}/g, headlineLine)
    .replace(/\{\{ACTIVE_AGENTS\}\}/g, String(data.activeAgents.length))
    .replace(/\{\{ELITE_COUNT\}\}/g, String(data.eliteCount))
    .replace(/\{\{IC_COUNT\}\}/g, String(data.icCount))
    .replace(/\{\{AVG_PROGRESS\}\}/g, String(data.avgProgress))
    .replace(/\{\{PROGRESS_TREND\}\}/g, '—')
    .replace(/\{\{STUCK_COUNT\}\}/g, String(data.stuckAgents.length))
    .replace(/\{\{READY_UPGRADE_COUNT\}\}/g, String(data.readyForUpgrade.length))
    .replace(/\{\{DASHBOARD_URL\}\}/g, dashboardUrl)
    // Block replacements
    .replace(/\{\{#TOP_MOVERS\}\}[\s\S]*?\{\{\/TOP_MOVERS\}\}/g, renderTopMoverBlock(data.topMovers))
    .replace(/\{\{#STUCK_LIST\}\}[\s\S]*?\{\{\/STUCK_LIST\}\}/g, renderStuckBlock(data.stuckAgents))
    .replace(/\{\{#NEW_STARTS\}\}[\s\S]*?\{\{\/NEW_STARTS\}\}/g, renderNewStartsBlock(data.newStarts))
    .replace(/\{\{#READY_UPGRADE\}\}[\s\S]*?\{\{\/READY_UPGRADE\}\}/g, renderReadyBlock(data.readyForUpgrade))
    .replace(/\{\{#ACTION_ITEMS\}\}[\s\S]*?\{\{\/ACTION_ITEMS\}\}/g, renderActionItems(data.kimoraItems));

  const subject = `Onboarding Weekly — ${data.activeAgents.length} active agents, ${data.stuckAgents.length} stuck`;

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const from = String(process.env.GMAIL_FROM || user).trim();

  try {
    const info = await tx.sendMail({
      from,
      to: RECIPIENT,
      subject,
      html,
      text: `Weekly Onboarding Report — Week of ${fmtDate(weekStart)}\n\nActive: ${data.activeAgents.length} | Stuck: ${data.stuckAgents.length} | Ready to Upgrade: ${data.readyForUpgrade.length}\n\nOpen dashboard: ${dashboardUrl}`
    });

    // Log the send
    const logRows = await loadJsonStore(REPORT_LOG_PATH, []);
    logRows.push({
      id: `report_${Date.now()}`,
      sent_at: new Date().toISOString(),
      recipient_email: RECIPIENT,
      period_start: weekStart,
      period_end: new Date().toISOString().slice(0, 10),
      agents_summarized: data.activeAgents.length,
      message_id: info?.messageId || ''
    });
    await saveJsonStore(REPORT_LOG_PATH, logRows);

    return { ok: true, messageId: info?.messageId };
  } catch (err) {
    console.error('[onboardingReport] send error:', err);
    return { ok: false, error: err.message };
  }
}

function buildFallbackTemplate() {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="background:#FAF8F2;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
  <div style="background:#0A0A0A;padding:28px;border-bottom:3px solid #B28147;">
    <div style="font-size:18px;font-weight:700;color:#D4A24A;">The Legacy Link</div>
    <div style="font-size:11px;color:#9C9486;text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;">Weekly Onboarding Report</div>
    <div style="font-size:13px;color:#D4A24A;font-weight:600;float:right;margin-top:-30px;">Week of {{WEEK_START}}</div>
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:24px;color:#1A1410;margin:0 0 8px;">Good morning, Kimora.</h1>
    <p style="color:#6B6357;">{{HEADLINE_LINE}}</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:12px;background:#FAF8F2;border-radius:8px;width:50%;">
          <div style="font-size:11px;color:#6B6357;text-transform:uppercase;font-weight:600;">Active Agents</div>
          <div style="font-size:28px;font-weight:700;color:#0A0A0A;">{{ACTIVE_AGENTS}}</div>
          <div style="font-size:11px;color:#9C9486;">{{ELITE_COUNT}} Elite · {{IC_COUNT}} Inner Circle</div>
        </td>
        <td style="padding-left:16px;padding:12px;background:#FAF8F2;border-radius:8px;width:50%;">
          <div style="font-size:11px;color:#6B6357;text-transform:uppercase;font-weight:600;">Avg. Progress</div>
          <div style="font-size:28px;font-weight:700;color:#0A0A0A;">{{AVG_PROGRESS}}%</div>
        </td>
      </tr>
    </table>
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#8A6234;margin:24px 0 12px;border-bottom:1px solid #E5DFCF;padding-bottom:8px;">Top Movers</h2>
    {{#TOP_MOVERS}}<div style="padding:10px 12px;background:#FAF8F2;border-radius:6px;margin-bottom:8px;"><strong>{{AGENT_NAME}}</strong> — {{ITEMS_COMPLETED}} items</div>{{/TOP_MOVERS}}
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#A12C7B;margin:24px 0 12px;border-bottom:1px solid #E5DFCF;padding-bottom:8px;">Stuck</h2>
    {{#STUCK_LIST}}<div style="padding:10px 12px;background:#FBE9F3;border-radius:6px;border-left:3px solid #A12C7B;margin-bottom:8px;"><strong>{{AGENT_NAME}}</strong> — {{DAYS_STUCK}} days no movement</div>{{/STUCK_LIST}}
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#1B4F72;margin:24px 0 12px;border-bottom:1px solid #E5DFCF;padding-bottom:8px;">New This Week</h2>
    {{#NEW_STARTS}}<div style="padding:10px 12px;background:#DCE9F2;border-radius:6px;margin-bottom:8px;"><strong>{{AGENT_NAME}}</strong> — {{TIER}}</div>{{/NEW_STARTS}}
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#7A5A0C;margin:24px 0 12px;border-bottom:1px solid #E5DFCF;padding-bottom:8px;">Ready to Upgrade</h2>
    {{#READY_UPGRADE}}<div style="padding:10px 12px;background:#FFF4D6;border-radius:6px;margin-bottom:8px;"><strong>{{AGENT_NAME}}</strong></div>{{/READY_UPGRADE}}
    <div style="background:#1A1410;border-radius:8px;padding:20px;margin-top:24px;">
      <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#D4A24A;margin:0 0 12px;">What Needs You This Week</h2>
      <ol style="margin:0;padding-left:18px;color:#FAF8F2;font-size:14px;">
        {{#ACTION_ITEMS}}<li style="margin-bottom:6px;">{{ACTION_TEXT}}</li>{{/ACTION_ITEMS}}
      </ol>
    </div>
    <div style="text-align:center;margin-top:28px;">
      <a href="{{DASHBOARD_URL}}" style="display:inline-block;padding:14px 32px;background:#0A0A0A;color:#D4A24A;text-decoration:none;border-radius:8px;font-weight:600;">Open Manager Dashboard</a>
    </div>
  </div>
  <div style="background:#FAF8F2;padding:24px;text-align:center;font-size:12px;color:#6B6357;border-top:1px solid #E5DFCF;">
    The Legacy Link · 340 Old River Road, Edgewater, NJ 07020<br/>
    <em>Individual results vary; income is not guaranteed.</em>
  </div>
</div>
</body></html>`;
}
