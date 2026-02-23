function clean(v = '') {
  return String(v || '').trim();
}

function safeJsonParse(raw, fallback = {}) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function resolveOwnerUserId(assignedToName = '') {
  const map = safeJsonParse(process.env.GHL_USER_ID_MAP_JSON || '{}', {});
  const direct = map?.[assignedToName];
  if (direct) return String(direct);

  const fallback = clean(process.env.GHL_FALLBACK_USER_ID || '');
  return fallback || '';
}

async function callLeadRouter(req, body) {
  const target = new URL('/api/lead-router', req.url);
  const token = clean(process.env.GHL_INTAKE_TOKEN || body?.token || '');

  const payload = {
    ...body,
    source: body?.source || 'facebook',
    ...(token ? { token } : {})
  };

  const res = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store'
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data?.ok, status: res.status, data };
}

async function updateGhlContactOwner({ contactId, assignedUserId }) {
  const token = clean(process.env.GHL_API_TOKEN || '');
  if (!token || !contactId || !assignedUserId) {
    return { ok: false, reason: 'missing_ghl_config_or_ids' };
  }

  const body = JSON.stringify({ assignedTo: assignedUserId });
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28'
  };

  const bases = [
    clean(process.env.GHL_API_BASE_URL || ''),
    'https://services.leadconnectorhq.com',
    'https://rest.gohighlevel.com'
  ].filter(Boolean);

  const paths = [
    `/contacts/${encodeURIComponent(contactId)}`,
    `/v1/contacts/${encodeURIComponent(contactId)}`
  ];

  let lastError = 'unknown';

  for (const base of bases) {
    for (const path of paths) {
      const url = `${base.replace(/\/$/, '')}${path}`;
      try {
        const res = await fetch(url, {
          method: 'PUT',
          headers,
          body,
          cache: 'no-store'
        });

        if (res.ok) {
          return { ok: true, url, status: res.status };
        }

        const text = await res.text().catch(() => '');
        lastError = `${url} -> ${res.status} ${text.slice(0, 200)}`;
      } catch (err) {
        lastError = `${url} -> ${String(err?.message || err)}`;
      }
    }
  }

  return { ok: false, reason: 'ghl_update_failed', detail: lastError };
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const requiredSig = clean(process.env.LL_WEBHOOK_SECRET || '');
  if (requiredSig) {
    const got = clean(req.headers.get('x-ll-signature') || '');
    if (!got || got !== requiredSig) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  const contactId = clean(body?.contactId || body?.contact?.id || body?.id || '');

  const normalizedBody = {
    ...body,
    // Ensure we still get a unique event in lead-router even if contactId is missing
    ...(contactId
      ? { contactId }
      : {
          id: clean(body?.id) || `missing-contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        })
  };

  const router = await callLeadRouter(req, normalizedBody);
  if (!router.ok) {
    return Response.json(
      {
        ok: false,
        error: 'lead_router_failed',
        status: router.status,
        detail: router.data || null
      },
      { status: 502 }
    );
  }

  const assignedToName = clean(router.data?.assignedTo || '');
  const assignedUserId = clean(body?.assignedUserId || resolveOwnerUserId(assignedToName));

  const ghlUpdate = await updateGhlContactOwner({ contactId, assignedUserId });

  return Response.json({
    ok: true,
    contactId: contactId || null,
    assignedTo: assignedToName,
    assignedUserId: assignedUserId || null,
    ghlOwnerUpdated: !!ghlUpdate.ok,
    warning: contactId ? null : 'missing_contact_id_payload',
    ghlUpdate
  });
}
