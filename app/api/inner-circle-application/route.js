import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import nodemailer from 'nodemailer';

const STORE_PATH = 'stores/inner-circle-applications.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function qualifyApplication(payload = {}) {
  const hours = toNumber(payload?.hoursPerWeek, 0);

  const checks = {
    coachable: normalize(payload?.coachable) === 'yes',
    followUp: normalize(payload?.consistentFollowUp) === 'yes',
    aiOpen: normalize(payload?.openToAi) === 'yes',
    businessMindset: normalize(payload?.businessOrInfo) === 'business',
    financialReady: normalize(payload?.financialReady) === 'ready_now',
    communicationReady: normalize(payload?.phoneInternetReady) === 'yes',
    timeCommitted: hours >= 8,
    urgency: normalize(payload?.activelyLooking) === 'real_income'
  };

  const score = Object.values(checks).filter(Boolean).length;

  const qualified = checks.financialReady
    && checks.coachable
    && checks.followUp
    && checks.businessMindset
    && checks.communicationReady
    && checks.timeCommitted;

  return {
    qualified,
    score,
    checks,
    reason: qualified
      ? 'Qualified for one-on-one strategy call review.'
      : 'Not qualified yet for one-on-one. Recommend nurture / waitlist / prep steps.'
  };
}

async function sendQualifiedAlert(app = {}, qualification = {}) {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  const to = clean(process.env.INNER_CIRCLE_APPLICATION_NOTIFY_EMAIL || process.env.KIMORA_NOTIFY_EMAIL || 'support@thelegacylink.com');

  if (!user || !pass || !to) return { ok: false, error: 'email_not_configured' };

  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });

  const subject = `Inner Circle Qualified Applicant: ${clean(app.fullName) || 'Applicant'}`;
  const text = [
    'A new Inner Circle application is qualified for one-on-one review.',
    '',
    `Name: ${clean(app.fullName)}`,
    `Email: ${clean(app.email)}`,
    `Phone: ${clean(app.phone)}`,
    `State: ${clean(app.state)}`,
    `Licensed Status: ${clean(app.licensedStatus)}`,
    `90-Day Income Goal: ${clean(app.incomeGoal90)}`,
    `Financial Readiness: ${clean(app.financialReady)}`,
    `Hours/Week: ${clean(app.hoursPerWeek)}`,
    '',
    `Score: ${qualification?.score ?? 'n/a'}/8`,
    `Reason: ${qualification?.reason || ''}`,
    '',
    `Why now: ${clean(app.whyNow)}`,
    `What's stopping them now: ${clean(app.whatStopping)}`,
    `What changes with support: ${clean(app.whatChanges)}`
  ].join('\n');

  try {
    const info = await tx.sendMail({
      from,
      to,
      subject,
      text,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">
        <h2>Qualified Inner Circle Applicant</h2>
        <p><strong>Name:</strong> ${clean(app.fullName)}</p>
        <p><strong>Email:</strong> ${clean(app.email)}</p>
        <p><strong>Phone:</strong> ${clean(app.phone)}</p>
        <p><strong>State:</strong> ${clean(app.state)}</p>
        <p><strong>Licensed Status:</strong> ${clean(app.licensedStatus)}</p>
        <p><strong>90-Day Income Goal:</strong> ${clean(app.incomeGoal90)}</p>
        <p><strong>Financial Readiness:</strong> ${clean(app.financialReady)}</p>
        <p><strong>Hours/Week:</strong> ${clean(app.hoursPerWeek)}</p>
        <hr />
        <p><strong>Score:</strong> ${qualification?.score ?? 'n/a'}/8</p>
        <p><strong>Reason:</strong> ${qualification?.reason || ''}</p>
        <p><strong>Why now:</strong> ${clean(app.whyNow)}</p>
      </div>`
    });
    return { ok: true, messageId: info?.messageId || '' };
  } catch (error) {
    return { ok: false, error: error?.message || 'send_failed' };
  }
}

export async function GET(req) {
  const rows = await loadJsonStore(STORE_PATH, []);
  const { searchParams } = new URL(req.url);
  const id = clean(searchParams.get('id'));

  if (id) {
    const row = rows.find((r) => clean(r?.id) === id) || null;
    return Response.json({ ok: true, row });
  }

  return Response.json({ ok: true, count: rows.length, rows: rows.slice(0, 200) });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const payload = {
    fullName: clean(body?.fullName),
    email: clean(body?.email),
    phone: clean(body?.phone),
    state: clean(body?.state).toUpperCase(),

    licensedStatus: clean(body?.licensedStatus),
    activelyLooking: clean(body?.activelyLooking),
    hoursPerWeek: clean(body?.hoursPerWeek),
    consistentFollowUp: clean(body?.consistentFollowUp),

    coachable: clean(body?.coachable),
    openToAi: clean(body?.openToAi),
    businessOrInfo: clean(body?.businessOrInfo),

    financialReady: clean(body?.financialReady),
    phoneInternetReady: clean(body?.phoneInternetReady),
    whyNow: clean(body?.whyNow),

    incomeGoal90: clean(body?.incomeGoal90),
    whatStopping: clean(body?.whatStopping),
    whatChanges: clean(body?.whatChanges)
  };

  if (!payload.fullName || !payload.email || !payload.phone) {
    return Response.json({ ok: false, error: 'missing_contact_fields' }, { status: 400 });
  }

  const requiredAnswers = [
    payload.licensedStatus,
    payload.activelyLooking,
    payload.hoursPerWeek,
    payload.consistentFollowUp,
    payload.coachable,
    payload.openToAi,
    payload.businessOrInfo,
    payload.financialReady,
    payload.phoneInternetReady,
    payload.whyNow,
    payload.incomeGoal90,
    payload.whatStopping,
    payload.whatChanges
  ];

  if (requiredAnswers.some((v) => !clean(v))) {
    return Response.json({ ok: false, error: 'missing_required_answers' }, { status: 400 });
  }

  const qualification = qualifyApplication(payload);

  const record = {
    id: `ica_${Date.now()}`,
    submittedAt: new Date().toISOString(),
    ...payload,
    qualified: qualification.qualified,
    qualificationScore: qualification.score,
    qualificationChecks: qualification.checks,
    qualificationReason: qualification.reason
  };

  const current = await loadJsonStore(STORE_PATH, []);
  await saveJsonStore(STORE_PATH, [record, ...current]);

  let email = { ok: false, skipped: true };
  if (qualification.qualified) {
    email = await sendQualifiedAlert(record, qualification);
  }

  return Response.json({
    ok: true,
    id: record.id,
    qualified: qualification.qualified,
    score: qualification.score,
    reason: qualification.reason,
    notifyEmail: email
  });
}
