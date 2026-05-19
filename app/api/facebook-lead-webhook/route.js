export const dynamic = 'force-dynamic';

function clean(v = '') { return String(v || '').trim(); }

function extractField(fieldData = [], ...names) {
  for (const name of names) {
    const entry = fieldData.find((f) => String(f?.name || '').toLowerCase() === name.toLowerCase());
    if (entry) {
      const val = Array.isArray(entry.values) ? entry.values[0] : entry.values;
      if (val != null && val !== '') return String(val).trim();
    }
  }
  return '';
}

// GET: Facebook webhook verification handshake
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const verifyToken = clean(process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || '');

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new Response('Verification failed', { status: 403 });
}

// POST: Receive Facebook lead gen events → push through lead router
export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || body.object !== 'page') {
      return Response.json({ ok: true }); // ACK non-lead events silently
    }

    const accessToken = clean(process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '');
    const intakeToken = clean(process.env.GHL_INTAKE_TOKEN || '');
    const host = req.headers.get('host') || 'innercirclelink.com';
    const baseUrl = `https://${host}`;

    const entries = Array.isArray(body.entry) ? body.entry : [];
    let received = 0;
    let distributed = 0;

    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change.field !== 'leadgen') continue;
        const value = change.value || {};
        const leadgenId = clean(value.leadgen_id || '');
        if (!leadgenId) continue;
        received++;

        // Fetch full lead details from Facebook Graph API
        let fbLead = null;
        if (accessToken) {
          try {
            const graphRes = await fetch(
              `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${encodeURIComponent(accessToken)}`,
              { cache: 'no-store' }
            );
            if (graphRes.ok) fbLead = await graphRes.json().catch(() => null);
          } catch { /* best-effort */ }
        }

        const fieldData = Array.isArray(fbLead?.field_data) ? fbLead.field_data : [];
        const rawFullName = extractField(fieldData, 'full_name', 'name', 'first_name');
        const email = extractField(fieldData, 'email');
        const phone = extractField(fieldData, 'phone_number', 'phone', 'mobile_number');
        // Fall back to email prefix → phone → short leadgen ID rather than storing 'Unknown'
        const fullName = rawFullName
          || (email.includes('@') ? email.split('@')[0] : '')
          || phone
          || `FB Lead ${leadgenId.slice(-6)}`;

        // Push through lead router for distribution
        try {
          const res = await fetch(`${baseUrl}/api/lead-router`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-intake-token': intakeToken,
              'x-internal-source': 'facebook-webhook',
            },
            body: JSON.stringify({
              token: intakeToken,
              id: leadgenId,
              externalId: leadgenId,
              name: fullName,
              email,
              phone,
              source: `facebook_lead_${clean(value.ad_id || fbLead?.ad_id || 'ad')}`,
            }),
            cache: 'no-store',
          });
          const data = await res.json().catch(() => ({}));
          if (data?.ok) distributed++;
        } catch { /* best-effort — must always ACK Facebook */ }
      }
    }

    // Always return 200 to Facebook (prevents retry storms)
    return Response.json({ ok: true, received, distributed });
  } catch (e) {
    console.error('[facebook-lead-webhook]', e?.message || e);
    return Response.json({ ok: true }); // Always ACK
  }
}
