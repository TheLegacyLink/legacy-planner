import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STORE_PATH = 'stores/intake-applications.json';

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function nowIso() { return new Date().toISOString(); }

const PROGRAM_LABELS = {
  inner_circle: 'Inner Circle',
  jumpstart: 'JumpStart Program',
  sponsorship: 'Sponsorship Program',
  agency_owner: 'Agency Owner',
  regional_director: 'Regional Director',
  unsure: "Not sure yet",
};

const INCOME_LABELS = {
  under_50k: 'Under $50,000',
  '50_100k': '$50,000 – $100,000',
  '100_250k': '$100,000 – $250,000',
  '250_500k': '$250,000 – $500,000',
  '500k_plus': '$500,000+',
};

const HOURS_LABELS = {
  part_time: 'Part-time (<20 hrs/week)',
  full_time: 'Full-time (20–40 hrs/week)',
  all_in: 'All-in (40+ hrs/week)',
};

export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'invalid_body' }, { status: 400 }); }

  const firstName = clean(body.firstName);
  const lastName = clean(body.lastName);
  const email = norm(body.email);
  const phone = clean(body.phone);
  const state = clean(body.state);
  const licensed = clean(body.licensed);
  const licenseStates = clean(body.licenseStates);
  const yearsExperience = clean(body.yearsExperience);
  const currentOccupation = clean(body.currentOccupation);
  const programInterest = clean(body.programInterest);
  const incomeGoal = clean(body.incomeGoal);
  const weeklyHours = clean(body.weeklyHours);
  const motivation = clean(body.motivation);
  const hearAbout = clean(body.hearAbout);
  const referredBy = clean(body.referredBy);
  const referrerEmail = norm(body.referrerEmail);

  if (!firstName || !lastName || !email || !phone || !state) {
    return Response.json({ ok: false, error: 'missing_required_fields' }, { status: 400 });
  }

  const ip = clean(req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '');
  const ua = clean(req.headers.get('user-agent') || '');
  const submittedAt = nowIso();
  const id = `APP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const record = {
    id, firstName, lastName, email, phone, state,
    licensed, licenseStates, yearsExperience, currentOccupation,
    programInterest, incomeGoal, weeklyHours, motivation,
    hearAbout, referredBy, referrerEmail,
    ip, ua, submittedAt, status: 'new',
  };

  // Save to store
  try {
    const rows = await loadJsonStore(STORE_PATH, []);
    const list = Array.isArray(rows) ? rows : [];
    list.push(record);
    await saveJsonStore(STORE_PATH, list);
  } catch (e) {
    console.error('Store save failed:', e.message);
  }

  // Email notification to Kimora
  try {
    const nodemailer = (await import('nodemailer')).default;
    const gmailUser = clean(process.env.GMAIL_APP_USER || '');
    const gmailPass = clean(process.env.GMAIL_APP_PASSWORD || '');
    if (gmailUser && gmailPass) {
      const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });
      const programLabel = PROGRAM_LABELS[programInterest] || programInterest || '—';
      const incomeLabel = INCOME_LABELS[incomeGoal] || incomeGoal || '—';
      const hoursLabel = HOURS_LABELS[weeklyHours] || weeklyHours || '—';
      const licensedLabel = licensed === 'yes' ? '✅ Licensed' : licensed === 'in_progress' ? '⏳ In Progress' : '❌ Not Yet';

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#020a1e;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#020a1e;padding:30px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#040B23;border-radius:12px;border:1px solid #162040;overflow:hidden;">
  <tr>
    <td style="background:linear-gradient(160deg,#040B23,#081630);padding:30px 36px;border-bottom:2px solid #C8A96B;text-align:center;">
      <div style="font-size:10px;letter-spacing:4px;color:#C8A96B;font-weight:700;margin-bottom:8px;text-transform:uppercase;">The Legacy Link</div>
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">New Application Received</h1>
      <div style="margin-top:8px;color:#6a7f96;font-size:12px;">Application ID: ${id}</div>
    </td>
  </tr>
  <tr>
    <td style="padding:28px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${[
          ['Applicant', `${firstName} ${lastName}`],
          ['Email', email],
          ['Phone', phone],
          ['State', state],
          ['License Status', licensedLabel],
          ['Licensed States', licenseStates || '—'],
          ['Experience', yearsExperience || '—'],
          ['Current Occupation', currentOccupation || '—'],
          ['Program Interest', programLabel],
          ['Income Goal (12mo)', incomeLabel],
          ['Weekly Availability', hoursLabel],
          ['How They Heard', hearAbout || '—'],
          ['Referred By', referredBy || '—'],
        ].map(([k, v]) => `
          <tr style="border-bottom:1px solid #0f1e3d;">
            <td style="padding:10px 0;color:#6a7f96;font-size:12px;width:40%;vertical-align:top;">${k}</td>
            <td style="padding:10px 0;color:#fff;font-size:13px;font-weight:600;vertical-align:top;">${v}</td>
          </tr>`).join('')}
        ${motivation ? `
          <tr>
            <td colspan="2" style="padding:16px 0 0;">
              <div style="font-size:10px;letter-spacing:1.5px;color:#C8A96B;font-weight:700;text-transform:uppercase;margin-bottom:8px;">Motivation</div>
              <div style="color:#9aafc4;font-size:13px;line-height:1.6;background:#061028;padding:14px;border-radius:8px;border:1px solid #162040;">${motivation}</div>
            </td>
          </tr>` : ''}
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 36px;border-top:1px solid #0f1e3d;text-align:center;">
      <p style="margin:0;color:#3a5070;font-size:11px;">Submitted via innercirclelink.com/apply · ${submittedAt}</p>
      <p style="margin:8px 0 0;font-size:10px;letter-spacing:3px;color:#C8A96B;font-weight:700;text-transform:uppercase;">The Legacy Link</p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;

      await transporter.sendMail({
        from: gmailUser,
        to: 'link@thelegacylink.com',
        subject: `New Application — ${firstName} ${lastName} · ${programLabel}`,
        html,
      }).catch(e => console.error('Email failed:', e.message));
    }
  } catch (e) {
    console.error('Email error:', e.message);
  }

  // Telegram notification
  try {
    const tgToken = clean(process.env.TELEGRAM_BOT_TOKEN || '');
    const tgChat = clean(process.env.TELEGRAM_CHAT_ID || '');
    if (tgToken && tgChat) {
      const programLabel = PROGRAM_LABELS[programInterest] || programInterest || '—';
      const licensedLabel = licensed === 'yes' ? 'Licensed ✅' : licensed === 'in_progress' ? 'In Progress ⏳' : 'Not licensed';
      const msg = [
        '📋 New Application — innercirclelink.com/apply',
        `Name: ${firstName} ${lastName}`,
        `State: ${state}`,
        `License: ${licensedLabel}`,
        `Program: ${programLabel}`,
        `Heard via: ${hearAbout || '—'}`,
        referredBy ? `Referred by: ${referredBy}` : null,
        `ID: ${id}`,
      ].filter(Boolean).join('\n');
      await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat, text: msg }),
      }).catch(() => {});
    }
  } catch { /* non-fatal */ }

  // Auto-reply to applicant
  try {
    const nodemailer = (await import('nodemailer')).default;
    const gmailUser = clean(process.env.GMAIL_APP_USER || '');
    const gmailPass = clean(process.env.GMAIL_APP_PASSWORD || '');
    if (gmailUser && gmailPass && email) {
      const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });
      const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#020a1e;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#020a1e;padding:30px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#040B23;border-radius:12px;border:1px solid #162040;overflow:hidden;">
  <tr>
    <td style="background:linear-gradient(160deg,#040B23,#081630);padding:36px;border-bottom:2px solid #C8A96B;text-align:center;">
      <div style="font-size:10px;letter-spacing:4px;color:#C8A96B;font-weight:700;margin-bottom:8px;text-transform:uppercase;">The Legacy Link</div>
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Application Received</h1>
    </td>
  </tr>
  <tr>
    <td style="padding:36px;">
      <p style="color:#fff;font-size:15px;line-height:1.7;margin:0 0 16px;">Hey ${firstName},</p>
      <p style="color:#9aafc4;font-size:14px;line-height:1.7;margin:0 0 16px;">
        We received your application and the team is reviewing it now. You'll hear from us within <strong style="color:#fff;">24–48 hours</strong> with next steps.
      </p>
      <p style="color:#9aafc4;font-size:14px;line-height:1.7;margin:0 0 24px;">
        In the meantime, if you have any questions, don't hesitate to reach out.
      </p>
      <div style="background:#061028;border:1px solid #162040;border-radius:8px;padding:20px;text-align:center;">
        <div style="color:#6a7f96;font-size:11px;letter-spacing:1px;margin-bottom:10px;text-transform:uppercase;">Contact Us</div>
        <div style="color:#C8A96B;font-size:14px;margin-bottom:4px;">support@thelegacylink.com</div>
        <div style="color:#C8A96B;font-size:14px;">201-862-7040</div>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 36px;border-top:1px solid #0f1e3d;text-align:center;">
      <p style="margin:0;font-size:10px;letter-spacing:3px;color:#C8A96B;font-weight:700;text-transform:uppercase;">The Legacy Link</p>
      <p style="margin:6px 0 0;color:#3a5070;font-size:11px;">340 Old River Road, Edgewater NJ 07020</p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
      await transporter.sendMail({
        from: `"Legacy Link Support Team" <${gmailUser}>`,
        to: email,
        subject: 'Your Application Was Received — The Legacy Link',
        html,
      }).catch(e => console.error('Auto-reply failed:', e.message));
    }
  } catch (e) {
    console.error('Auto-reply error:', e.message);
  }

  return Response.json({ ok: true, id });
}
