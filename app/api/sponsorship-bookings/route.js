import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import users from '../../../data/innerCircleUsers.json';

async function loadHistoricStoreSnapshots(pathname = '', maxSnapshots = 25) {
  try {
    const blob = await import('@vercel/blob');
    if (!process.env.BLOB_READ_WRITE_TOKEN) return [];

    const { blobs } = await blob.list({ prefix: pathname, limit: 200 });
    const versions = (blobs || [])
      .filter((b) => b?.pathname === pathname && b?.url)
      .sort((a, b) => new Date(b?.uploadedAt || b?.uploaded_at || 0).getTime() - new Date(a?.uploadedAt || a?.uploaded_at || 0).getTime())
      .slice(0, Math.max(1, Number(maxSnapshots || 25)));

    const out = [];
    for (const v of versions) {
      try {
        const res = await fetch(v.url, { cache: 'no-store' });
        if (!res.ok) continue;
        const parsed = await res.json().catch(() => null);
        if (Array.isArray(parsed)) out.push(parsed);
      } catch {
        // skip unreadable snapshots
      }
    }
    return out;
  } catch {
    return [];
  }
}

const STORE_PATH = 'stores/sponsorship-bookings.json';
const LEDGER_PATH = 'stores/sponsorship-bookings-ledger.json';

const MANUAL_RESTORE_BOOKINGS = [
  {
    id: 'book_restore_manual_james_franklin',
    source_application_id: 'sapp_1773378864027',
    applicant_first_name: 'James',
    applicant_last_name: 'Franklin',
    applicant_name: 'James Franklin',
    applicant_phone: '2533630530',
    applicant_email: 'jmfranklin70@gmail.com',
    applicant_state: 'AZ',
    licensed_status: 'Unlicensed',
    referred_by: 'Link',
    referral_code: 'kimora_link',
    requested_at_est: '2026-03-17 1:00 PM',
    priority_agent: 'Link',
    priority_expires_at: '2026-03-15T23:59:59.000Z',
    priority_released: false,
    claimed_by: '',
    claim_status: 'Priority Hold',
    notes: 'Manual restore requested by Kimora (missing booked row).'
  },
  {
    id: 'book_restore_manual_katina_cavitte',
    source_application_id: 'sapp_1773371302324',
    applicant_first_name: 'Katina',
    applicant_last_name: 'Cavitte',
    applicant_name: 'Katina Cavitte',
    applicant_phone: '7203667806',
    applicant_email: 'cavittesisters.2@gmail.com',
    applicant_state: 'CO',
    licensed_status: 'Unlicensed',
    referred_by: 'Link',
    referral_code: 'kimora_link',
    requested_at_est: '2026-03-18 1:00 PM',
    priority_agent: 'Link',
    priority_expires_at: '2026-03-15T23:59:59.000Z',
    priority_released: false,
    claimed_by: '',
    claim_status: 'Priority Hold',
    notes: 'Manual restore requested by Kimora (missing booked row).'
  },
  {
    id: 'book_restore_manual_rochelle_garcia',
    source_application_id: 'sapp_1773362176238',
    applicant_first_name: 'Rochelle',
    applicant_last_name: 'Garcia',
    applicant_name: 'Rochelle Garcia',
    applicant_phone: '6788574948',
    applicant_email: 'rochelle.nicole41@gmail.com',
    applicant_state: 'GA',
    licensed_status: 'Licensed',
    referred_by: 'Link',
    referral_code: 'kimora_link',
    requested_at_est: '2026-03-15 8:30 PM',
    priority_agent: 'Link',
    priority_expires_at: '2026-03-15T23:59:59.000Z',
    priority_released: false,
    claimed_by: '',
    claim_status: 'Priority Hold',
    notes: 'Manual restore requested by Kimora (missing booked row).'
  },
  {
    id: 'book_restore_manual_gustavo_espinal_liriano',
    source_application_id: 'sapp_1773260472744',
    applicant_first_name: 'Gustavo',
    applicant_last_name: 'Espinal-Liriano II',
    applicant_name: 'Gustavo Espinal-Liriano II',
    applicant_phone: '2404862901',
    applicant_email: 'stavoliriano@gmail.com',
    applicant_state: 'MD',
    licensed_status: 'Unlicensed',
    referred_by: 'Link',
    referral_code: 'kimora_link',
    requested_at_est: '2026-03-14 6:00 PM',
    priority_agent: 'Link',
    priority_expires_at: '2026-03-15T23:59:59.000Z',
    priority_released: false,
    claimed_by: '',
    claim_status: 'Priority Hold',
    notes: 'Manual restore requested by Kimora (missing booked row).'
  },
  {
    id: 'book_restore_manual_curtis_craft',
    source_application_id: 'sapp_1773322563851',
    applicant_first_name: 'Curtis',
    applicant_last_name: 'Craft',
    applicant_name: 'Curtis Craft',
    applicant_phone: '6145975487',
    applicant_email: 'curtisability@yahoo.com',
    applicant_state: 'OH',
    licensed_status: 'Unlicensed',
    referred_by: 'Link',
    referral_code: 'kimora_link',
    requested_at_est: '2026-03-17 1:30 PM',
    priority_agent: 'Link',
    priority_expires_at: '2026-03-15T23:59:59.000Z',
    priority_released: false,
    claimed_by: '',
    claim_status: 'Priority Hold',
    notes: 'Manual restore requested by Kimora (missing booked row).'
  },
  {
    id: 'book_restore_manual_teewanna_curry',
    source_application_id: 'sapp_1773320978215',
    applicant_first_name: 'Teewanna',
    applicant_last_name: 'Curry',
    applicant_name: 'Teewanna Curry',
    applicant_phone: '4784619690',
    applicant_email: 'teewannacurry@gmail.com',
    applicant_state: 'GA',
    licensed_status: 'Unlicensed',
    referred_by: 'Link',
    referral_code: 'kimora_link',
    requested_at_est: '2026-03-18 8:30 PM',
    priority_agent: 'Link',
    priority_expires_at: '2026-03-15T23:59:59.000Z',
    priority_released: false,
    claimed_by: '',
    claim_status: 'Priority Hold',
    notes: 'Manual restore requested by Kimora (missing booked row).'
  },
  {
    id: 'book_restore_manual_leaundra_coyle',
    source_application_id: 'manual_leaundra_coyle_20260317',
    applicant_first_name: 'LeAundra',
    applicant_last_name: 'Coyle',
    applicant_name: 'LeAundra Coyle',
    applicant_phone: '',
    applicant_email: '',
    applicant_state: 'AL',
    licensed_status: 'Unknown',
    referred_by: 'Link',
    referral_code: 'kimora_link',
    requested_at_est: '2026-03-17 11:00 AM CT',
    priority_agent: 'Link',
    priority_expires_at: '2026-03-18T23:59:59.000Z',
    priority_released: false,
    claimed_by: '',
    claim_status: 'Priority Hold',
    notes: 'Manual restore from Kimora tomorrow schedule list.'
  },
  {
    id: 'book_restore_manual_christy_albrecht',
    source_application_id: 'manual_christy_albrecht_20260317',
    applicant_first_name: 'Christy',
    applicant_last_name: 'Albrecht',
    applicant_name: 'Christy Albrecht',
    applicant_phone: '',
    applicant_email: '',
    applicant_state: 'MN',
    licensed_status: 'Unknown',
    referred_by: 'Link',
    referral_code: 'kimora_link',
    requested_at_est: '2026-03-17 11:30 AM CT',
    priority_agent: 'Link',
    priority_expires_at: '2026-03-18T23:59:59.000Z',
    priority_released: false,
    claimed_by: '',
    claim_status: 'Priority Hold',
    notes: 'Manual restore from Kimora tomorrow schedule list.'
  },
  {
    id: 'book_restore_manual_francesca_cadet',
    source_application_id: 'manual_francesca_cadet_20260317',
    applicant_first_name: 'Francesca',
    applicant_last_name: 'Cadet',
    applicant_name: 'Francesca Cadet',
    applicant_phone: '',
    applicant_email: '',
    applicant_state: 'MA',
    licensed_status: 'Unknown',
    referred_by: 'Link',
    referral_code: 'kimora_link',
    requested_at_est: '2026-03-17 11:30 AM ET',
    priority_agent: 'Link',
    priority_expires_at: '2026-03-18T23:59:59.000Z',
    priority_released: false,
    claimed_by: '',
    claim_status: 'Priority Hold',
    notes: 'Manual restore from Kimora tomorrow schedule list.'
  },
  {
    id: 'book_restore_manual_charles_robinson',
    source_application_id: 'manual_charles_robinson_20260317',
    applicant_first_name: 'Charles',
    applicant_last_name: 'Robinson',
    applicant_name: 'Charles Robinson',
    applicant_phone: '',
    applicant_email: '',
    applicant_state: 'PA',
    licensed_status: 'Unknown',
    referred_by: 'Link',
    referral_code: 'kimora_link',
    requested_at_est: '2026-03-17 5:30 PM ET',
    priority_agent: 'Link',
    priority_expires_at: '2026-03-18T23:59:59.000Z',
    priority_released: false,
    claimed_by: '',
    claim_status: 'Priority Hold',
    notes: 'Manual restore from Kimora tomorrow schedule list.'
  }
];

function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase().replace(/\s+/g, ' ');
}

function nowIso() {
  return new Date().toISOString();
}

function isManager(role = '') {
  const r = normalize(role);
  return r === 'admin' || r === 'manager';
}

function findUser(name = '') {
  const needle = normalize(name);
  return (users || []).find((u) => u?.active && normalize(u.name) === needle) || null;
}

function isWithinPriorityWindow(row = {}) {
  if (!clean(row?.priority_agent)) return false;
  if (row?.priority_released) return false;
  const exp = new Date(row?.priority_expires_at || 0);
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() > Date.now();
}

function rowTimestamp(row = {}) {
  const ts = new Date(row?.created_at || row?.booked_at || row?.updated_at || 0).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function phoneKey(v = '') {
  return clean(v).replace(/\D/g, '');
}

function isClaimedRow(row = {}) {
  return normalize(row?.claim_status).startsWith('claimed') || Boolean(clean(row?.claimed_by));
}

function dedupeKey(row = {}) {
  const sourceId = clean(row?.source_application_id);
  if (sourceId) return `source:${sourceId}`;

  const email = normalize(row?.applicant_email);
  if (email) return `email:${email}`;

  const phone = phoneKey(row?.applicant_phone);
  if (phone) return `phone:${phone}`;

  const name = normalize(row?.applicant_name);
  if (name) return `name:${name}`;

  return '';
}

function bookingMoment(row = {}) {
  // We prefer explicit requested slot if present, else fallback to created/updated timestamps.
  const ts = rowTimestamp(row);
  return Number.isFinite(ts) ? ts : 0;
}

function appendRescheduleAudit(kept = {}, replaced = {}, key = '') {
  const already = Array.isArray(kept?.reschedule_history) ? kept.reschedule_history : [];
  const replacedId = clean(replaced?.id);
  if (!replacedId || already.some((e) => clean(e?.replaced_booking_id) === replacedId)) return kept;

  const entry = {
    replaced_booking_id: replacedId,
    replaced_requested_at_est: clean(replaced?.requested_at_est || ''),
    replaced_created_at: clean(replaced?.created_at || ''),
    dedupe_key: key,
    merged_at: nowIso()
  };

  const nextHistory = [entry, ...already].slice(0, 20);

  const existingNotes = clean(kept?.notes || '');
  const noteTag = '[Auto-Reschedule]';
  const noteLine = `${noteTag} kept latest slot ${clean(kept?.requested_at_est || '—')} and removed older slot ${entry.replaced_requested_at_est || '—'} (${replacedId}).`;
  const notes = existingNotes.includes(noteLine)
    ? existingNotes
    : [existingNotes, noteLine].filter(Boolean).join(' | ');

  return {
    ...kept,
    rescheduled_count: Number(kept?.rescheduled_count || 0) + 1,
    reschedule_history: nextHistory,
    notes,
    updated_at: nowIso()
  };
}

function dedupeReschedules(rows = []) {
  const seen = new Set();
  const keyToIndex = new Map();
  let changed = false;

  const sorted = [...rows].sort((a, b) => bookingMoment(b) - bookingMoment(a));
  const out = [];

  for (const row of sorted) {
    const key = dedupeKey(row);
    if (!key) {
      out.push(row);
      continue;
    }

    // Keep all claimed rows for history/accountability.
    if (isClaimedRow(row)) {
      out.push(row);
      continue;
    }

    if (seen.has(key)) {
      changed = true;
      const keepIdx = keyToIndex.get(key);
      if (Number.isInteger(keepIdx) && out[keepIdx]) {
        out[keepIdx] = appendRescheduleAudit(out[keepIdx], row, key);
      }
      continue;
    }

    seen.add(key);
    keyToIndex.set(key, out.length);
    out.push({ ...row });
  }

  return { rows: out, changed };
}

function toHistorySummary(rows = []) {
  const byKey = new Map();

  for (const row of rows || []) {
    const sourceId = clean(row?.source_application_id || row?.id || '');
    const name = clean(row?.applicant_name || `${clean(row?.applicant_first_name || '')} ${clean(row?.applicant_last_name || '')}`.trim());
    const email = normalize(row?.applicant_email || '');
    const phone = phoneKey(row?.applicant_phone || '');
    const key = sourceId || email || phone || normalize(name);
    if (!key) continue;

    const requested = clean(row?.requested_at_est || '');
    const createdAt = clean(row?.created_at || row?.updated_at || '');
    const existing = byKey.get(key);

    const next = {
      key,
      source_application_id: sourceId,
      applicant_name: name,
      applicant_email: clean(row?.applicant_email || ''),
      applicant_phone: clean(row?.applicant_phone || ''),
      applicant_state: clean(row?.applicant_state || ''),
      first_seen_at: existing?.first_seen_at || createdAt,
      latest_requested_at_est: requested || existing?.latest_requested_at_est || '',
      latest_claimed_by: clean(row?.claimed_by || existing?.latest_claimed_by || ''),
      latest_claim_status: clean(row?.claim_status || existing?.latest_claim_status || ''),
      seen_versions: Number(existing?.seen_versions || 0) + 1
    };

    if (existing?.first_seen_at) {
      const a = new Date(existing.first_seen_at || 0).getTime();
      const b = new Date(createdAt || 0).getTime();
      next.first_seen_at = (a && b) ? (a <= b ? existing.first_seen_at : createdAt) : (existing.first_seen_at || createdAt);
    }

    byKey.set(key, next);
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const ta = new Date(a.first_seen_at || 0).getTime();
    const tb = new Date(b.first_seen_at || 0).getTime();
    return (tb || 0) - (ta || 0);
  });
}

function parseRequestedAtEst(raw = '') {
  const v = clean(raw);
  if (!v) return 0;

  // Preferred format: "YYYY-MM-DD h:mm AM/PM" (with optional trailing timezone text)
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s*([AP]M)(?:\s+[A-Z]{2,4})?$/i);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    let h = Number(m[4]) % 12;
    const mi = Number(m[5]);
    const ampm = String(m[6] || '').toUpperCase();
    if (ampm === 'PM') h += 12;
    const dt = new Date(y, mo, d, h, mi, 0, 0);
    const ts = dt.getTime();
    return Number.isFinite(ts) ? ts : 0;
  }

  // Alternate format: "M/D/YYYY h:mm AM/PM"
  const m2 = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*([AP]M)(?:\s+[A-Z]{2,4})?$/i);
  if (m2) {
    const mo = Number(m2[1]) - 1;
    const d = Number(m2[2]);
    const y = Number(m2[3]);
    let h = Number(m2[4]) % 12;
    const mi = Number(m2[5]);
    const ampm = String(m2[6] || '').toUpperCase();
    if (ampm === 'PM') h += 12;
    const dt = new Date(y, mo, d, h, mi, 0, 0);
    const ts = dt.getTime();
    return Number.isFinite(ts) ? ts : 0;
  }

  return 0;
}

function rowExpiryTs(row = {}) {
  // Hard rule: only expire 24h after the booked appointment time.
  const scheduledTs = parseRequestedAtEst(row?.requested_at_est || '');
  if (scheduledTs > 0) return scheduledTs + (24 * 60 * 60 * 1000);

  // If booking time cannot be parsed, do NOT auto-expire.
  return 0;
}

function isExpiredRow(row = {}) {
  const exp = rowExpiryTs(row);
  if (!exp) return false;
  return Date.now() > exp;
}

function refreshExpired(rows = []) {
  const now = Date.now();
  let changed = false;
  const out = rows
    .map((row) => {
      const claimed = normalize(row?.claim_status).startsWith('claimed') || clean(row?.claimed_by);
      if (claimed) return row;
      if (!clean(row?.priority_agent) || row?.priority_released) return row;

      const exp = new Date(row?.priority_expires_at || 0);
      if (Number.isNaN(exp.getTime()) || exp.getTime() > now) return row;

      changed = true;
      return {
        ...row,
        priority_released: true,
        claim_status: 'Open',
        updated_at: nowIso()
      };
    })
    .filter((row) => {
      if (isExpiredRow(row)) {
        changed = true;
        return false;
      }
      return true;
    });

  return { rows: out, changed };
}

function applyManualRestores(rows = []) {
  let changed = false;
  const out = [...(rows || [])];

  for (const seed of MANUAL_RESTORE_BOOKINGS) {
    if (isExpiredRow(seed)) continue;

    const exists = out.some((r) => {
      const sameSource = clean(r?.source_application_id) && clean(r?.source_application_id) === clean(seed.source_application_id);
      const sameNameTime = normalize(r?.applicant_name) === normalize(seed.applicant_name)
        && clean(r?.requested_at_est) === clean(seed.requested_at_est);
      return sameSource || sameNameTime;
    });

    if (exists) continue;

    out.unshift({
      ...seed,
      created_at: clean(seed?.created_at) || nowIso(),
      updated_at: nowIso()
    });
    changed = true;
  }

  return { rows: out, changed };
}

async function mergeRecentSnapshots(rows = [], maxSnapshots = 20) {
  const snapshots = await loadHistoricStoreSnapshots(STORE_PATH, maxSnapshots);
  if (!snapshots.length) return { rows, changed: false, snapshotsScanned: 0 };

  const merged = [...(rows || [])];
  for (const snap of snapshots) {
    for (const row of (snap || [])) {
      if (!row || typeof row !== 'object') continue;
      if (isExpiredRow(row)) continue;
      merged.push({ ...row });
    }
  }

  const deduped = dedupeReschedules(merged);
  return {
    rows: deduped.rows || rows,
    changed: Boolean(deduped.changed),
    snapshotsScanned: snapshots.length
  };
}

function extractLedgerRows(ledger = []) {
  const out = [];
  for (const e of (ledger || [])) {
    const row = e?.row;
    if (!row || typeof row !== 'object') continue;
    out.push({ ...row });
  }
  return out;
}

async function mergeFromLedger(rows = [], maxEntries = 3000) {
  const ledger = await loadJsonStore(LEDGER_PATH, []);
  const slice = Array.isArray(ledger) ? ledger.slice(0, Math.max(1, Number(maxEntries || 3000))) : [];
  if (!slice.length) return { rows, changed: false, ledgerCount: 0 };

  const merged = [...(rows || []), ...extractLedgerRows(slice)];
  const deduped = dedupeReschedules(merged);
  return { rows: deduped.rows || rows, changed: Boolean(deduped.changed), ledgerCount: slice.length };
}

async function appendLedger(action = '', row = {}) {
  const current = await loadJsonStore(LEDGER_PATH, []);
  const list = Array.isArray(current) ? current : [];
  list.unshift({
    id: `sbl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    action: clean(action || 'upsert') || 'upsert',
    at: nowIso(),
    row: { ...(row || {}) }
  });
  await saveJsonStore(LEDGER_PATH, list.slice(0, 5000));
}

async function getStore() {
  const loaded = await loadJsonStore(STORE_PATH, []);
  const refreshed = refreshExpired(loaded);
  const restored = applyManualRestores(refreshed.rows || []);
  const recovered = await mergeRecentSnapshots(restored.rows || [], 20);
  const fromLedger = await mergeFromLedger(recovered.rows || [], 3000);
  const deduped = dedupeReschedules(fromLedger.rows || []);
  return {
    rows: deduped.rows,
    changed: Boolean(refreshed.changed || restored.changed || recovered.changed || fromLedger.changed || deduped.changed),
    snapshotsScanned: recovered.snapshotsScanned || 0,
    ledgerCount: fromLedger.ledgerCount || 0
  };
}

async function writeStore(rows) {
  return await saveJsonStore(STORE_PATH, rows);
}

export async function GET() {
  const state = await getStore();
  const rows = state.rows;
  if (state.changed) await writeStore(rows);

  rows.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  return Response.json({ ok: true, rows });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const mode = normalize(body?.mode || 'upsert');
  const state = await getStore();
  const store = state.rows;

  if (mode === 'history_report') {
    const maxSnapshots = Math.max(1, Math.min(200, Number(body?.maxSnapshots || 120)));
    const snapshots = await loadHistoricStoreSnapshots(STORE_PATH, maxSnapshots);

    const merged = [...store];
    for (const snap of snapshots) {
      for (const row of (snap || [])) {
        if (!row || typeof row !== 'object') continue;
        merged.push({ ...row });
      }
    }

    const summary = toHistorySummary(merged);
    return Response.json({
      ok: true,
      snapshotsScanned: snapshots.length,
      totalUniqueBookedEver: summary.length,
      rows: summary
    });
  }

  if (mode === 'restore_recent') {
    const maxSnapshots = Math.max(1, Math.min(100, Number(body?.maxSnapshots || 40)));
    const snapshots = await loadHistoricStoreSnapshots(STORE_PATH, maxSnapshots);

    const merged = [...store];
    for (const snap of snapshots) {
      for (const row of (snap || [])) {
        if (!row || typeof row !== 'object') continue;
        if (isExpiredRow(row)) continue;
        merged.push({ ...row });
      }
    }

    const deduped = dedupeReschedules(merged);
    const refreshed = refreshExpired(deduped.rows || []);
    const restored = applyManualRestores(refreshed.rows || []);

    const finalRows = restored.rows || [];
    await writeStore(finalRows);

    return Response.json({
      ok: true,
      restored: true,
      snapshotsScanned: snapshots.length,
      rows: finalRows,
      total: finalRows.length,
      changed: Boolean(deduped.changed || refreshed.changed || restored.changed)
    });
  }

  if (mode === 'upsert') {
    const booking = body?.booking || {};
    const id = clean(booking?.id);
    if (!id) return Response.json({ ok: false, error: 'missing_booking_id' }, { status: 400 });

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

    const deduped = dedupeReschedules(store);
    const finalRows = deduped.rows;
    await writeStore(finalRows);

    const savedRow = finalRows.find((r) => clean(r.id) === id) || next;
    await appendLedger('upsert', savedRow);
    return Response.json({ ok: true, row: savedRow, deduped: deduped.changed });
  }

  if (mode === 'claim') {
    const bookingId = clean(body?.bookingId);
    const claimedBy = clean(body?.claimedBy);
    if (!bookingId || !claimedBy) {
      return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }

    const actor = findUser(claimedBy) || { name: claimedBy, role: 'submitter' };

    const idx = store.findIndex((r) => clean(r.id) === bookingId);
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    const current = store[idx];
    if (clean(current?.claimed_by) && normalize(current?.claimed_by) !== normalize(claimedBy)) {
      return Response.json({ ok: false, error: 'already_claimed', claimedBy: current.claimed_by }, { status: 409 });
    }

    if (isWithinPriorityWindow(current) && normalize(current?.priority_agent) !== normalize(claimedBy) && !isManager(actor.role)) {
      return Response.json(
        {
          ok: false,
          error: 'priority_window_locked',
          priorityAgent: current.priority_agent,
          priorityExpiresAt: current.priority_expires_at
        },
        { status: 409 }
      );
    }

    store[idx] = {
      ...current,
      claim_status: 'Claimed',
      claimed_by: actor.name,
      claimed_at: nowIso(),
      priority_released: true,
      updated_at: nowIso()
    };

    await writeStore(store);
    await appendLedger('claim', store[idx]);
    return Response.json({ ok: true, row: store[idx] });
  }

  if (mode === 'override') {
    const bookingId = clean(body?.bookingId);
    const actorName = clean(body?.actorName);
    const targetName = clean(body?.targetName);
    const actor = findUser(actorName);
    const target = findUser(targetName);

    if (!bookingId || !actor || !target) {
      return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }

    if (!isManager(actor.role)) {
      return Response.json({ ok: false, error: 'manager_only' }, { status: 403 });
    }

    const idx = store.findIndex((r) => clean(r.id) === bookingId);
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    store[idx] = {
      ...store[idx],
      claim_status: 'Claimed',
      claimed_by: target.name,
      claimed_at: nowIso(),
      priority_released: true,
      override_by: actor.name,
      override_at: nowIso(),
      updated_at: nowIso()
    };

    await writeStore(store);
    await appendLedger('override', store[idx]);
    return Response.json({ ok: true, row: store[idx] });
  }

  if (mode === 'invalidate') {
    const bookingId = clean(body?.bookingId);
    const reason = clean(body?.reason || 'Invalid booking context');
    if (!bookingId) return Response.json({ ok: false, error: 'missing_booking_id' }, { status: 400 });

    const idx = store.findIndex((r) => clean(r.id) === bookingId);
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    store[idx] = {
      ...store[idx],
      claim_status: 'Invalid',
      notes: [clean(store[idx]?.notes), reason].filter(Boolean).join(' | '),
      updated_at: nowIso()
    };

    await writeStore(store);
    await appendLedger('invalidate', store[idx]);
    return Response.json({ ok: true, row: store[idx] });
  }

  if (mode === 'delete') {
    const bookingId = clean(body?.bookingId);
    if (!bookingId) return Response.json({ ok: false, error: 'missing_booking_id' }, { status: 400 });

    const idx = store.findIndex((r) => clean(r.id) === bookingId);
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    const [removed] = store.splice(idx, 1);
    await writeStore(store);
    await appendLedger('delete', removed || {});
    return Response.json({ ok: true, removed });
  }

  return Response.json({ ok: false, error: 'unsupported_mode' }, { status: 400 });
}
