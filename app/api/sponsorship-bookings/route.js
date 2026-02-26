import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/sponsorship-bookings.json';

function clean(v = '') {
  return String(v || '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

async function getStore() {
  return await loadJsonStore(STORE_PATH, []);
}

async function writeStore(rows) {
  return await saveJsonStore(STORE_PATH, rows);
}

export async function GET() {
  const rows = await getStore();
  rows.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  return Response.json({ ok: true, rows });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const mode = clean(body?.mode || 'upsert').toLowerCase();
  const store = await getStore();

  if (mode === 'upsert') {
    const booking = body?.booking || {};
    const id = clean(booking?.id);
    if (!id) return Response.json({ ok: false, error: 'missing_booking_id' }, { status: 400 });

    // Guardrail: block orphan bookings with no linked application context.
    const sourceId = clean(booking?.source_application_id);
    const applicantFirst = clean(booking?.applicant_first_name);
    const applicantLast = clean(booking?.applicant_last_name);
    const applicantName = clean(booking?.applicant_name);
    if (!sourceId || (!applicantFirst && !applicantLast) || applicantName.toLowerCase() === 'unknown') {
      return Response.json({ ok: false, error: 'invalid_booking_context' }, { status: 400 });
    }

    const idx = store.findIndex((r) => clean(r.id) === id);
    const next = {
      ...(idx >= 0 ? store[idx] : {}),
      ...booking,
      id,
      updated_at: nowIso()
    };

    if (idx >= 0) store[idx] = next;
    else store.unshift(next);

    await writeStore(store);
    return Response.json({ ok: true, row: next });
  }

  if (mode === 'claim') {
    const bookingId = clean(body?.bookingId);
    const claimedBy = clean(body?.claimedBy);
    if (!bookingId || !claimedBy) {
      return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }

    const idx = store.findIndex((r) => clean(r.id) === bookingId);
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    store[idx] = {
      ...store[idx],
      claim_status: 'Claimed',
      claimed_by: claimedBy,
      claimed_at: nowIso(),
      updated_at: nowIso()
    };

    await writeStore(store);
    return Response.json({ ok: true, row: store[idx] });
  }

  return Response.json({ ok: false, error: 'unsupported_mode' }, { status: 400 });
}
