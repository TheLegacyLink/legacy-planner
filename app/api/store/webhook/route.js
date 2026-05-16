import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';
import { loadJsonStore as loadProducts } from '../../../../lib/blobJsonStore';

export const dynamic = 'force-dynamic';

const ORDERS_PATH  = 'stores/store-orders.json';
const PRODUCTS_PATH = 'stores/store-products.json';
const PRINTFUL_API  = 'https://api.printful.com';

function clean(v = '') { return String(v || '').trim(); }
function nowIso() { return new Date().toISOString(); }

async function createPrintfulOrder({ recipient, items, retailItems }) {
  const token = clean(process.env.PRINTFUL_API_KEY || '');
  if (!token) return { ok: false, error: 'PRINTFUL_API_KEY not set' };

  const body = JSON.stringify({
    recipient,
    items: retailItems,
    retail_costs: { shipping: '0.00' }
  });

  const res = await fetch(`${PRINTFUL_API}/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-PF-Store-Id': clean(process.env.PRINTFUL_STORE_ID || '')
    },
    body,
    cache: 'no-store'
  });

  const data = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, printfulOrderId: data?.result?.id, data } : { ok: false, error: data?.error?.message || 'printful_error', data };
}

async function sendOrderConfirmationEmail({ email, name, items, orderId }) {
  const user = clean(process.env.GMAIL_APP_USER || '');
  const pass = clean(process.env.GMAIL_APP_PASSWORD || '');
  const from = clean(process.env.GMAIL_FROM || user);
  if (!user || !pass || !email) return { ok: false };

  const { default: nodemailer } = await import('nodemailer');
  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });

  const itemLines = items.map(i => `${i.name}${i.subtitle ? ` — ${i.subtitle}` : ''} (Size: ${i.size}) × ${i.quantity || 1} — $${i.price}`).join('\n');

  await tx.sendMail({
    from, to: email, subject: `Order Confirmed — The Legacy Link Store`,
    text: `Hi ${name || 'there'},\n\nYour order has been confirmed. Thank you for representing The Legacy Link.\n\nOrder #${orderId}\n\n${itemLines}\n\nYour order will be fulfilled and shipped by Printful. You will receive a tracking email once it ships.\n\n— The Legacy Link`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#0f172a;">
      <h2 style="color:#C8A45A;">Order Confirmed</h2>
      <p>Hi <strong>${name || 'there'}</strong>,</p>
      <p>Your order has been confirmed. Thank you for representing The Legacy Link.</p>
      <p style="color:#64748b;font-size:13px;">Order #${orderId}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        ${items.map(i => `<tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${i.name}${i.subtitle ? ` — ${i.subtitle}` : ''}<br/><small style="color:#64748b;">Size: ${i.size}</small></td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">$${i.price}</td>
        </tr>`).join('')}
      </table>
      <p>Your order will be fulfilled and shipped by Printful. You will receive a tracking email once it ships.</p>
      <p>— <strong>The Legacy Link</strong></p>
    </div>`
  });
  return { ok: true };
}

export async function POST(req) {
  const rawBody = await req.text();
  const sig     = req.headers.get('stripe-signature') || '';
  const secret  = clean(process.env.STRIPE_STORE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '');

  let event;
  try {
    if (secret && sig) {
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(clean(process.env.STRIPE_SECRET_KEY || ''), { apiVersion: '2024-06-20' });
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
    } else {
      event = JSON.parse(rawBody);
    }
  } catch (e) {
    return new Response(`Webhook error: ${e.message}`, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return Response.json({ ok: true, received: true });
  }

  const session   = event.data.object;
  const sessionId = clean(session.id);
  const email     = clean(session.customer_details?.email || session.customer_email || '');
  const name      = clean(session.customer_details?.name || '');
  const shipping  = session.shipping_details?.address || session.shipping || {};
  const itemsMeta = clean(session.metadata?.items || '');

  // Load catalog to get Printful variant IDs
  const catalog  = await loadProducts(PRODUCTS_PATH, { products: [] });
  const products = catalog.products || [];

  // Parse items from metadata: "SKU:SIZE:QTY|..."
  const parsedItems = itemsMeta.split('|').map(part => {
    const [sku, size, qty] = part.split(':');
    const product = products.find(p => p.sku === sku);
    return {
      sku: clean(sku),
      size: clean(size),
      quantity: Number(qty || 1),
      name: product?.name || sku,
      subtitle: product?.subtitle || '',
      price: product?.price || 0,
      image: product?.image || '',
      variantId: clean(product?.printfulVariantIds?.[size] || '')
    };
  }).filter(i => i.sku);

  // Build Printful order items — only items with a valid variant ID
  const printfulItems = parsedItems
    .filter(i => i.variantId)
    .map(i => ({
      variant_id: i.variantId,
      quantity: i.quantity,
      retail_price: String(i.price)
    }));

  const recipient = {
    name,
    email,
    address1: clean(shipping.line1 || ''),
    address2: clean(shipping.line2 || ''),
    city: clean(shipping.city || ''),
    state_code: clean(shipping.state || ''),
    country_code: clean(shipping.country || 'US'),
    zip: clean(shipping.postal_code || '')
  };

  // Update order in store
  const orders   = await loadJsonStore(ORDERS_PATH, []);
  const orderIdx = orders.findIndex(o => o.stripeSessionId === sessionId);
  const orderId  = orderIdx >= 0 ? orders[orderIdx].id : `order-${Date.now()}`;

  let printfulResult = { ok: false, reason: 'no_variant_ids_configured' };
  if (printfulItems.length) {
    printfulResult = await createPrintfulOrder({ recipient, items: parsedItems, retailItems: printfulItems });
  }

  const updatedOrder = {
    id: orderId,
    stripeSessionId: sessionId,
    status: printfulResult.ok ? 'submitted_to_printful' : 'payment_received_pending_fulfillment',
    items: parsedItems,
    email,
    name,
    shipping: recipient,
    printfulOrderId: printfulResult.printfulOrderId || null,
    printfulResult,
    paidAt: nowIso(),
    updatedAt: nowIso(),
    createdAt: orderIdx >= 0 ? orders[orderIdx].createdAt : nowIso()
  };

  if (orderIdx >= 0) orders[orderIdx] = updatedOrder;
  else orders.push(updatedOrder);
  await saveJsonStore(ORDERS_PATH, orders);

  // Send order confirmation email
  await sendOrderConfirmationEmail({ email, name, items: parsedItems, orderId }).catch(() => null);

  return Response.json({ ok: true, orderId, printfulResult });
}
