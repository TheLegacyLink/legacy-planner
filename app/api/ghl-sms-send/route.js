import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const OUTBOUND_STORE_PATH = 'stores/ghl-sms-outbound.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalizeUsPhone(v = '') {
  const raw = clean(v);
  const d = raw.replace(/\D+/g, '');
  if (!d) return '';

  // Enforce US/Canada NANP only (+1XXXXXXXXXX)
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;

  // Anything else is treated as non-US and rejected.
  return '';
}

function authorized(req) {
  const required = clean(process.env.GHL_SMS_ROUTE_TOKEN || process.env.GHL_INTAKE_TOKEN);
  if (!required) return false;

  const bearer = clean(req.headers.get('authorization')).replace(/^Bearer\s+/i, '');
  const header = clean(req.headers.get('x-admin-token') || req.headers.get('x-intake-token') || req.headers.get('x-ghl-token'));
  const token = bearer || header;
  return Boolean(token && token === required);
}

async function postJsonWithTimeout(url, payload, timeoutMs = 10000, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store'
    });
    const text = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, text };
  } catch (error) {
    return { ok: false, status: 0, text: String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

async function logOutboundSms(row = {}) {
  try {
    const store = await loadJsonStore(OUTBOUND_STORE_PATH, []);
    store.unshift(row);
    await saveJsonStore(OUTBOUND_STORE_PATH, store.slice(0, 3000));
  } catch {
    // best-effort logging
  }
}

export async function POST(req) {
  if (!authorized(req)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  const contactId = clean(body?.contactId || body?.contact_id || '');
  const firstName = clean(body?.firstName || body?.first_name || '');
  const lastName = clean(body?.lastName || body?.last_name || '');
  const email = clean(body?.email || '');
  const rawPhone = clean(body?.phone || body?.to || '');
  const phone = normalizeUsPhone(rawPhone);
  const bookingLink = clean(body?.bookingLink || body?.booking_link || '');
  const appId = clean(body?.appId || body?.app_id || '');
  const message = clean(body?.message || body?.text || '');
  const dryRun = Boolean(body?.dryRun || body?.dry_run);
  const addReplyTrackingTag = body?.addReplyTrackingTag !== false;
  const replyTrackingTag = clean(body?.replyTrackingTag || body?.trackingTag || 'meeting-reminder-sent');

  if (!message) {
    return Response.json({ ok: false, error: 'missing_message' }, { status: 400 });
  }

  if (rawPhone && !phone) {
    return Response.json({ ok: false, error: 'invalid_phone_us_only', detail: 'Only US +1 numbers are allowed.' }, { status: 400 });
  }

  if (!contactId && !phone) {
    return Response.json({ ok: false, error: 'missing_contactId_or_phone' }, { status: 400 });
  }

  const allowTemplateFallback = Boolean(body?.allowTemplateFallback || body?.allow_template_fallback);
  const manualWebhookUrl = clean(process.env.GHL_MANUAL_SMS_WEBHOOK_URL || '');
  const templateWebhookUrl = clean(process.env.GHL_SMS_WEBHOOK_URL || '');
  const webhookUrl = manualWebhookUrl || (allowTemplateFallback ? templateWebhookUrl : '');

  if (!webhookUrl) {
    return Response.json({
      ok: false,
      error: 'missing_manual_sms_webhook',
      detail: 'Set GHL_MANUAL_SMS_WEBHOOK_URL for exact-message sends. Fallback template webhook is blocked by default.'
    }, { status: 500 });
  }

  const payload = {
    event: 'manual_sms_send',
    mode: 'exact_message',
    appId,
    contactId,
    firstName,
    lastName,
    email,
    phone,
    bookingLink,
    message,
    smsBody: message,
    text: message,
    addReplyTrackingTag,
    replyTrackingTag,
    tags: addReplyTrackingTag && replyTrackingTag ? [replyTrackingTag] : []
  };

  const eventBase = {
    id: `smsout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sentAt: new Date().toISOString(),
    contactId,
    firstName,
    lastName,
    email,
    phone,
    appId,
    message,
    webhookUrl,
    addReplyTrackingTag,
    replyTrackingTag
  };

  if (dryRun) {
    await logOutboundSms({ ...eventBase, dryRun: true, ok: true, status: 0, result: 'dry_run' });
    return Response.json({ ok: true, dryRun: true, payload, webhookUrl });
  }

  const out = await postJsonWithTimeout(webhookUrl, payload, 10000);
  if (!out.ok) {
    await logOutboundSms({ ...eventBase, ok: false, status: out.status, error: clean(out.text).slice(0, 300) });
    return Response.json({ ok: false, error: 'ghl_webhook_failed', detail: clean(out.text).slice(0, 300), status: out.status }, { status: 502 });
  }

  await logOutboundSms({ ...eventBase, ok: true, status: out.status, result: clean(out.text).slice(0, 500) });
  return Response.json({ ok: true, status: out.status, result: clean(out.text).slice(0, 500) });
}
