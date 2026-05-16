import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';

export const dynamic = 'force-dynamic';

const ORDERS_PATH = 'stores/store-orders.json';

function clean(v = '') { return String(v || '').trim(); }
function nowIso() { return new Date().toISOString(); }

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { items, email } = body;

  if (!items?.length) return Response.json({ ok: false, error: 'no_items' }, { status: 400 });

  const secretKey = clean(process.env.STRIPE_SECRET_KEY || '');
  if (!secretKey) return Response.json({ ok: false, error: 'stripe_not_configured' }, { status: 500 });

  const origin = clean(process.env.NEXT_PUBLIC_APP_URL || 'https://innercirclelink.com').replace(/\/$/, '');

  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

  // Build line items for Stripe
  const lineItems = items.map(item => ({
    quantity: item.quantity || 1,
    price_data: {
      currency: 'usd',
      unit_amount: Math.round(Number(item.price) * 100),
      product_data: {
        name: `${item.name}${item.subtitle ? ` — ${item.subtitle}` : ''}`,
        description: `Size: ${item.size}`,
        images: item.image ? [`${origin}${item.image}`] : []
      }
    }
  }));

  // Encode cart items into metadata (Stripe limit: 500 chars per value)
  const itemsSummary = items.map(i => `${i.sku}:${i.size}:${i.quantity}`).join('|');

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${origin}/store/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/store?checkout=cancel`,
    customer_email: email || undefined,
    shipping_address_collection: { allowed_countries: ['US', 'CA'] },
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: 0, currency: 'usd' },
          display_name: 'Standard Shipping',
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 5 },
            maximum: { unit: 'business_day', value: 10 }
          }
        }
      }
    ],
    line_items: lineItems,
    metadata: { items: itemsSummary, source: 'legacy_link_store' },
    payment_intent_data: { description: 'The Legacy Link Store' }
  });

  // Create a pending order record
  const orders = await loadJsonStore(ORDERS_PATH, []);
  orders.push({
    id: `order-${Date.now()}`,
    stripeSessionId: session.id,
    status: 'pending_payment',
    items,
    email: email || '',
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
  await saveJsonStore(ORDERS_PATH, orders);

  return Response.json({ ok: true, url: session.url, sessionId: session.id });
}
