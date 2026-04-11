import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

// ── Load .env.local ──────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.local');
const raw = fs.readFileSync(envPath, 'utf8');
for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx < 0) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  if (!process.env[key]) process.env[key] = val;
}

const user = (process.env.GMAIL_APP_USER || '').trim();
const pass = (process.env.GMAIL_APP_PASSWORD || '').trim();
const from = (process.env.GMAIL_FROM || '').trim() || user;

if (!user || !pass) {
  console.error('❌  Missing GMAIL_APP_USER or GMAIL_APP_PASSWORD in .env.local');
  process.exit(1);
}

// ── Email payload ────────────────────────────────────────────────────────────
const TO  = 'jamal@jdholmesagencyllc.com, leticia@thelegacylink.com';
const CC  = 'kimora@thelegacylink.com';
const SUBJECT = 'Action Needed — Tiera McKinley | Unlicensed Onboarding Today';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:#040B23;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#040B23;min-height:100vh;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#070F2E;border:1px solid #1A2650;border-radius:10px;overflow:hidden;">

        <!-- HEADER -->
        <tr>
          <td style="background:#040B23;padding:28px 36px 20px;border-bottom:2px solid #C8A96B;text-align:center;">
            <div style="color:#C8A96B;font-size:22px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">THE LEGACY LINK</div>
            <div style="color:#8A9AC0;font-size:11px;letter-spacing:3px;margin-top:4px;text-transform:uppercase;">Internal Operations</div>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:32px 36px;">

            <!-- Subject line badge -->
            <div style="display:inline-block;background:#0D1640;border-left:3px solid #C8A96B;padding:6px 14px;border-radius:0 4px 4px 0;margin-bottom:24px;">
              <span style="color:#C8A96B;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Action Required</span>
            </div>

            <p style="color:#D8E0F0;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi Jamal and Leticia,</p>

            <p style="color:#D8E0F0;font-size:15px;line-height:1.7;margin:0 0 20px;">
              Quick one from Mr. Link — <strong style="color:#FFFFFF;">Tiera McKinley</strong> has been approved and needs to be fully onboarded today. She is on the <strong style="color:#C8A96B;">unlicensed track</strong>. Please reach out to her directly and move her through the onboarding process as soon as possible.
            </p>

            <p style="color:#D8E0F0;font-size:15px;line-height:1.7;margin:0 0 20px;">Her details are below:</p>

            <!-- Details card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A1330;border:1px solid #1E2F60;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:8px 0;border-bottom:1px solid #1A2650;">
                        <span style="color:#8A9AC0;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:2px;">Full Name</span>
                        <span style="color:#FFFFFF;font-size:15px;font-weight:600;">Tiera McKinley</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;border-bottom:1px solid #1A2650;">
                        <span style="color:#8A9AC0;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:2px;">Email</span>
                        <a href="mailto:findtieram@gmail.com" style="color:#C8A96B;font-size:15px;text-decoration:none;font-weight:600;">findtieram@gmail.com</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;">
                        <span style="color:#8A9AC0;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;display:block;margin-bottom:2px;">Phone</span>
                        <a href="tel:+14693331221" style="color:#C8A96B;font-size:15px;text-decoration:none;font-weight:600;">(469) 333-1221</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="color:#D8E0F0;font-size:15px;line-height:1.7;margin:0 0 28px;">
              Please confirm once she has been contacted and the process has started.
            </p>

            <!-- Divider -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td style="border-top:1px solid #1A2650;"></td></tr>
            </table>

            <!-- Signature -->
            <p style="color:#D8E0F0;font-size:15px;line-height:1.7;margin:0 0 4px;">Thank you,</p>
            <p style="color:#FFFFFF;font-size:15px;font-weight:700;margin:0 0 2px;">Kimora Link</p>
            <p style="color:#C8A96B;font-size:13px;letter-spacing:0.5px;margin:0;">The Legacy Link</p>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#040B23;padding:16px 36px;border-top:1px solid #1A2650;text-align:center;">
            <p style="color:#4A5980;font-size:11px;margin:0;letter-spacing:0.5px;">
              This is an internal operations message from The Legacy Link.<br/>
              340 Old River Road, Edgewater NJ 07020 &nbsp;|&nbsp; Support@thelegacylink.com
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

const text = `Hi Jamal and Leticia,

Quick one from Mr. Link — Tiera McKinley has been approved and needs to be fully onboarded today. She is on the unlicensed track. Please reach out to her directly and move her through the onboarding process as soon as possible.

Her details are below:

Full Name: Tiera McKinley
Email: findtieram@gmail.com
Phone: (469) 333-1221

Please confirm once she has been contacted and the process has started.

Thank you,
Kimora Link
The Legacy Link`;

// ── Send ─────────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user, pass }
});

try {
  const info = await transporter.sendMail({
    from: `"Legacy Link Support Team" <${from}>`,
    to: TO,
    cc: CC,
    subject: SUBJECT,
    text,
    html
  });

  console.log('✅  Email sent successfully!');
  console.log('   Message ID :', info.messageId);
  console.log('   Accepted   :', info.accepted?.join(', '));
  if (info.rejected?.length) console.log('   Rejected   :', info.rejected.join(', '));
} catch (err) {
  console.error('❌  Send failed:', err.message);
  process.exit(1);
}
