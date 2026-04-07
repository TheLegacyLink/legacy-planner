import nodemailer from 'nodemailer';
import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';

const ORDERS_PATH = 'stores/linkleads-orders.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

function isManagerRole(role = '') {
  const r = normalize(role);
  return r === 'manager' || r === 'admin';
}

function smtp() {
  const user = clean(process.env.GMAIL_APP_USER);
  const pass = clean(process.env.GMAIL_APP_PASSWORD);
  const from = clean(process.env.GMAIL_FROM) || user;
  if (!user || !pass) return null;

  return {
    from,
    tx: nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  };
}

async function sendDeliveredEmail(order = {}) {
  const to = clean(order?.buyerEmail);
  if (!to) return { ok: false, error: 'missing_buyer_email' };

  const mailer = smtp();
  if (!mailer) return { ok: false, error: 'missing_gmail_env' };

  const buyerName = clean(order?.buyerName || 'Agent');
  const subject = `✅ Your Link Leads Are Ready — ${clean(order?.leadLabel || 'Lead Order')}`;
  const quantity = Number(order?.quantity || 0);
  const orderId = clean(order?.orderId || '');

  const text = [
    `Hi ${buyerName},`,
    '',
    'Great news — your Link Leads setup is complete and your leads are now ready.',
    '',
    'Order Details',
    `- Order ID: ${orderId}`,
    `- Lead Package: ${clean(order?.leadLabel || '')}`,
    `- Quantity: ${quantity}`,
    `- Fulfillment Status: delivered`,
    '',
    'If you need assistance with routing, follow-up cadence, or replacement requests, contact support:',
    '- 201-862-7040',
    '- Support@thelegacylink.com',
    '',
    'The Legacy Link'
  ].join('\n');

  const html = `
    <div style="margin:0;padding:24px;background:#f4f5fb;font-family:Inter,Arial,sans-serif;color:#111827;line-height:1.5;">
      <div style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 10px 26px rgba(17,24,39,.1);">
        <div style="background:linear-gradient(135deg,#0b1220 0%,#1d4ed8 55%,#C8A96B 100%);padding:22px 24px;color:#fff;">
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">Link Leads • The Legacy Link</div>
          <h2 style="margin:6px 0 0;font-size:24px;line-height:1.2;">Your Leads Are Ready</h2>
          <p style="margin:8px 0 0;opacity:.95;">Hi ${buyerName}, your lead setup is complete and delivery is now active.</p>
        </div>
        <div style="padding:22px 24px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
            <tr><td style="padding:6px 0;color:#6b7280;">Order ID</td><td style="padding:6px 0;font-weight:600;">${orderId}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Package</td><td style="padding:6px 0;font-weight:600;">${clean(order?.leadLabel || '')}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Quantity</td><td style="padding:6px 0;font-weight:600;">${quantity}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Status</td><td style="padding:6px 0;font-weight:600;">Delivered</td></tr>
          </table>
          <div style="background:#111827;color:#fff;border-radius:12px;padding:14px;">
            <div style="font-weight:700;margin-bottom:6px;">Support</div>
            <div style="font-size:14px;opacity:.95;">201-862-7040 • Support@thelegacylink.com</div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const info = await mailer.tx.sendMail({ from: mailer.from, to, subject, text, html });
    return { ok: true, messageId: info?.messageId || '' };
  } catch (error) {
    return { ok: false, error: error?.message || 'email_send_failed' };
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const actorRole = clean(searchParams.get('actorRole'));
  const buyerEmail = normalize(searchParams.get('buyerEmail'));

  const orders = await loadJsonStore(ORDERS_PATH, []);

  if (isManagerRole(actorRole)) {
    const rows = [...orders].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return Response.json({ ok: true, rows });
  }

  if (buyerEmail) {
    const rows = orders
      .filter((r) => normalize(r?.buyerEmail) === buyerEmail)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return Response.json({ ok: true, rows });
  }

  return Response.json({ ok: false, error: 'manager_only' }, { status: 403 });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const actorRole = clean(body?.actorRole);
  if (!isManagerRole(actorRole)) {
    return Response.json({ ok: false, error: 'manager_only' }, { status: 403 });
  }

  const orderId = clean(body?.orderId);
  const action = normalize(body?.action);
  if (!orderId || !action) {
    return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const rows = await loadJsonStore(ORDERS_PATH, []);
  const idx = rows.findIndex((r) => clean(r?.orderId) === orderId);
  if (idx < 0) {
    return Response.json({ ok: false, error: 'order_not_found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const next = { ...rows[idx] };

  if (action === 'setup_started') {
    next.fulfillmentStatus = 'setup_started';
    next.setupStartedAt = now;
    next.updatedAt = now;
  } else if (action === 'delivered') {
    next.fulfillmentStatus = 'delivered';
    next.deliveredAt = now;
    next.updatedAt = now;
  } else {
    return Response.json({ ok: false, error: 'invalid_action' }, { status: 400 });
  }

  rows[idx] = next;
  await saveJsonStore(ORDERS_PATH, rows);

  let email = { ok: true, skipped: true };
  if (action === 'delivered') {
    email = await sendDeliveredEmail(next);
  }

  return Response.json({ ok: true, row: next, email });
}
