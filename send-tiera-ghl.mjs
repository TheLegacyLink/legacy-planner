import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Load specific env vars via shell-safe direct grep ────────────────────────
// (Passed in via environment by the caller shell command)
const GHL_TOKEN   = (process.env.GHL_INTAKE_TOKEN || '').trim();
const LOCATION_ID = 'I7bXOorPHk415nKgsFfa'; // decoded from JWT payload

if (!GHL_TOKEN) {
  console.error('❌  GHL_INTAKE_TOKEN not set');
  process.exit(1);
}

const BASE    = 'https://services.leadconnectorhq.com';
const headers = {
  Authorization: `Bearer ${GHL_TOKEN}`,
  'Content-Type': 'application/json',
  Version: '2021-07-28',
};

// ── Recipients ───────────────────────────────────────────────────────────────
const RECIPIENTS = [
  { name: 'Jamal Holmes',   email: 'jamal@jdholmesagencyllc.com' },
  { name: 'Leticia Wright', email: 'leticia@thelegacylink.com'   },
  { name: 'Kimora Link',    email: 'kimora@thelegacylink.com'    },
];

const SUBJECT = 'Action Needed — Tiera McKinley | Unlicensed Onboarding Today';

const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#040B23;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#040B23;min-height:100vh;">
  <tr><td align="center" style="padding:40px 16px;">
    <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#070F2E;border:1px solid #1A2650;border-radius:10px;overflow:hidden;">
      <tr>
        <td style="background:#040B23;padding:28px 36px 20px;border-bottom:2px solid #C8A96B;text-align:center;">
          <div style="color:#C8A96B;font-size:22px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">THE LEGACY LINK</div>
          <div style="color:#8A9AC0;font-size:11px;letter-spacing:3px;margin-top:4px;text-transform:uppercase;">Internal Operations</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 36px;">
          <div style="display:inline-block;background:#0D1640;border-left:3px solid #C8A96B;padding:6px 14px;border-radius:0 4px 4px 0;margin-bottom:24px;">
            <span style="color:#C8A96B;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Action Required</span>
          </div>
          <p style="color:#D8E0F0;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi Jamal and Leticia,</p>
          <p style="color:#D8E0F0;font-size:15px;line-height:1.7;margin:0 0 20px;">
            Quick one from Mr. Link — <strong style="color:#FFFFFF;">Tiera McKinley</strong> has been approved and needs to be fully onboarded today. She is on the <strong style="color:#C8A96B;">unlicensed track</strong>. Please reach out to her directly and move her through the onboarding process as soon as possible.
          </p>
          <p style="color:#D8E0F0;font-size:15px;line-height:1.7;margin:0 0 20px;">Her details are below:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A1330;border:1px solid #1E2F60;border-radius:8px;margin-bottom:28px;">
            <tr><td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:8px 0;border-bottom:1px solid #1A2650;">
                  <span style="color:#8A9AC0;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:2px;">Full Name</span>
                  <span style="color:#FFFFFF;font-size:15px;font-weight:600;">Tiera McKinley</span>
                </td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #1A2650;">
                  <span style="color:#8A9AC0;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:2px;">Email</span>
                  <a href="mailto:findtieram@gmail.com" style="color:#C8A96B;font-size:15px;text-decoration:none;font-weight:600;">findtieram@gmail.com</a>
                </td></tr>
                <tr><td style="padding:8px 0;">
                  <span style="color:#8A9AC0;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:2px;">Phone</span>
                  <a href="tel:+14693331221" style="color:#C8A96B;font-size:15px;text-decoration:none;font-weight:600;">(469) 333-1221</a>
                </td></tr>
              </table>
            </td></tr>
          </table>
          <p style="color:#D8E0F0;font-size:15px;line-height:1.7;margin:0 0 28px;">Please confirm once she has been contacted and the process has started.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #1A2650;"></td></tr></table>
          <p style="color:#D8E0F0;font-size:15px;line-height:1.7;margin:0 0 4px;">Thank you,</p>
          <p style="color:#FFFFFF;font-size:15px;font-weight:700;margin:0 0 2px;">Kimora Link</p>
          <p style="color:#C8A96B;font-size:13px;letter-spacing:0.5px;margin:0;">The Legacy Link</p>
        </td>
      </tr>
      <tr>
        <td style="background:#040B23;padding:16px 36px;border-top:1px solid #1A2650;text-align:center;">
          <p style="color:#4A5980;font-size:11px;margin:0;letter-spacing:0.5px;">
            Internal operations message from The Legacy Link.<br/>
            340 Old River Road, Edgewater NJ 07020 &nbsp;|&nbsp; Support@thelegacylink.com
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;

const text = `Hi Jamal and Leticia,

Quick one from Mr. Link — Tiera McKinley has been approved and needs to be fully onboarded today. She is on the unlicensed track. Please reach out to her directly and move her through the onboarding process as soon as possible.

Full Name: Tiera McKinley
Email: findtieram@gmail.com
Phone: (469) 333-1221

Please confirm once she has been contacted and the process has started.

Thank you,
Kimora Link
The Legacy Link`;

// ── Helpers ──────────────────────────────────────────────────────────────────
async function findOrCreateContact(name, email) {
  // Search by email
  const searchUrl = `${BASE}/contacts/?locationId=${LOCATION_ID}&query=${encodeURIComponent(email)}`;
  const searchRes = await fetch(searchUrl, { headers });
  if (searchRes.ok) {
    const data = await searchRes.json();
    const contact = data?.contacts?.[0];
    if (contact?.id) {
      console.log(`   Found   → ${name} (${contact.id})`);
      return contact.id;
    }
  }

  // Create contact
  const [firstName, ...rest] = name.split(' ');
  const createRes = await fetch(`${BASE}/contacts/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      locationId: LOCATION_ID,
      firstName,
      lastName: rest.join(' ') || '',
      email,
      source: 'internal-ops',
    }),
  });
  const created = await createRes.json();
  const id = created?.contact?.id;
  if (!id) throw new Error(`Could not create contact for ${email}: ${JSON.stringify(created)}`);
  console.log(`   Created → ${name} (${id})`);
  return id;
}

async function getOrCreateConversation(contactId) {
  // Search existing conversation
  const searchRes = await fetch(
    `${BASE}/conversations/search?locationId=${LOCATION_ID}&contactId=${contactId}`,
    { headers }
  );
  if (searchRes.ok) {
    const data = await searchRes.json();
    const conv = data?.conversations?.[0];
    if (conv?.id) return conv.id;
  }

  // Create conversation
  const createRes = await fetch(`${BASE}/conversations/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ locationId: LOCATION_ID, contactId }),
  });
  const created = await createRes.json();
  const id = created?.conversation?.id || created?.id;
  if (!id) throw new Error(`Could not create conversation: ${JSON.stringify(created)}`);
  return id;
}

async function sendEmail(contactId, conversationId) {
  const res = await fetch(`${BASE}/conversations/messages/outbound`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: 'Email',
      conversationId,
      contactId,
      subject: SUBJECT,
      body: html,
      altBody: text,
      from: 'support@thelegacylink.com',
      fromName: 'Legacy Link Support Team',
      replyTo: 'support@thelegacylink.com',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log('📧  Sending via GHL (Intake Token / Location API)...\n');
let allOk = true;

for (const { name, email } of RECIPIENTS) {
  console.log(`→  ${name} <${email}>`);
  try {
    const contactId = await findOrCreateContact(name, email);
    const conversationId = await getOrCreateConversation(contactId);
    const result = await sendEmail(contactId, conversationId);
    console.log(`   ✅  Sent  — msg: ${result?.messageId || result?.id || 'dispatched'}\n`);
  } catch (err) {
    console.error(`   ❌  ${err.message}\n`);
    allOk = false;
  }
}

process.exit(allOk ? 0 : 1);
