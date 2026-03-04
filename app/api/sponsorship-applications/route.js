import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/sponsorship-applications.json';

async function getStore() {
  return await loadJsonStore(STORE_PATH, []);
}

async function writeStore(rows) {
  return await saveJsonStore(STORE_PATH, rows);
}

function clean(v = '') {
  return String(v || '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeName(v = '') {
  return clean(v).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizePhone(v = '') {
  return String(v || '').replace(/\D/g, '');
}

function canonicalKey(row = {}) {
  const name = normalizeName(`${row.firstName || ''} ${row.lastName || ''}`);
  if (!name) return '';
  const email = clean(row.email).toLowerCase();
  const phone = normalizePhone(row.phone);
  return `${name}|${email || '-'}|${phone || '-'}`;
}

function validateRequiredSubmissionFields(record = {}) {
  const missing = [];
  const age = Number(record.age || 0);
  const phone = normalizePhone(record.phone);

  if (!clean(record.firstName)) missing.push('firstName');
  if (!clean(record.lastName)) missing.push('lastName');
  if (!clean(record.state)) missing.push('state');
  if (!clean(record.email)) missing.push('email');
  if (!phone || phone.length < 10) missing.push('phone');
  if (!record.age || age < 18 || age > 100) missing.push('age');

  if (!clean(record.healthStatus)) missing.push('healthStatus');
  if (!clean(record.motivation)) missing.push('motivation');
  if (!clean(record.hoursPerWeek)) missing.push('hoursPerWeek');

  if (clean(record.hasIncome).toLowerCase() === 'yes' && !clean(record.incomeSource)) missing.push('incomeSource');
  if (clean(record.isLicensed).toLowerCase() === 'yes' && !clean(record.licenseDetails)) missing.push('licenseDetails');

  const referralLocked = Boolean(clean(record.refCode || record.referral_code));
  if (!referralLocked && !clean(record.referralName)) missing.push('referralName');

  if (clean(record.whyJoin).length < 50) missing.push('whyJoin');
  if (clean(record.goal12Month).length < 20) missing.push('goal12Month');

  if (!record.agreeTraining) missing.push('agreeTraining');
  if (!record.agreeWeekly) missing.push('agreeWeekly');
  if (!record.agreeService) missing.push('agreeService');
  if (!record.agreeTerms) missing.push('agreeTerms');

  return missing;
}

function mostRecentIso(a, b) {
  const da = new Date(a || 0).getTime();
  const db = new Date(b || 0).getTime();
  return db > da ? b : a;
}

function dedupeRows(rows = []) {
  const byKey = new Map();
  let removed = 0;

  const sorted = [...rows].sort((a, b) => {
    const ta = new Date(a.updatedAt || a.submitted_at || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.submitted_at || b.createdAt || 0).getTime();
    return tb - ta;
  });

  for (const row of sorted) {
    const key = canonicalKey(row);
    if (!key || key.endsWith('|-|-')) {
      const passthroughKey = `id:${row.id || Math.random().toString(36).slice(2)}`;
      byKey.set(passthroughKey, row);
      continue;
    }

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }

    removed += 1;
    byKey.set(key, {
      ...row,
      ...existing,
      id: existing.id,
      submitted_at: mostRecentIso(existing.submitted_at, row.submitted_at),
      updatedAt: nowIso()
    });
  }

  return { rows: Array.from(byKey.values()), removed };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const status = clean(searchParams.get('status')).toLowerCase();
  const store = await getStore();
  const rows = status ? store.filter((r) => String(r.status || '').toLowerCase() === status) : store;
  rows.sort((a, b) => new Date(b.submitted_at || b.createdAt || 0).getTime() - new Date(a.submitted_at || a.createdAt || 0).getTime());
  return Response.json({ ok: true, rows });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const mode = clean(body?.mode || 'submit').toLowerCase();
  const store = await getStore();

  if (mode === 'submit') {
    const record = {
      ...body,
      id: clean(body?.id) || `sapp_${Date.now()}`,
      firstName: clean(body?.firstName),
      lastName: clean(body?.lastName),
      email: clean(body?.email),
      phone: clean(body?.phone),
      status: clean(body?.status || 'Pending Review'),
      decision_bucket: clean(body?.decision_bucket || 'manual_review'),
      submitted_at: body?.submitted_at || nowIso(),
      updatedAt: nowIso(),
      normalizedName: normalizeName(`${body?.firstName || ''} ${body?.lastName || ''}`)
    };

    if (!record.firstName || !record.lastName) {
      return Response.json({ ok: false, error: 'missing_name' }, { status: 400 });
    }

    const missing = validateRequiredSubmissionFields(record);
    if (missing.length) {
      return Response.json({ ok: false, error: 'missing_required_fields', missing }, { status: 400 });
    }

    const recordEmail = clean(record.email).toLowerCase();
    const recordPhone = normalizePhone(record.phone);

    const idx = store.findIndex((r) => {
      if (r.id === record.id) return true;

      const sameName = normalizeName(`${r.firstName || ''} ${r.lastName || ''}`) === record.normalizedName;
      const sameEmail = recordEmail && clean(r.email).toLowerCase() === recordEmail;
      const samePhone = recordPhone && normalizePhone(r.phone) === recordPhone;

      return sameName && (sameEmail || samePhone);
    });

    if (idx >= 0) {
      store[idx] = {
        ...store[idx],
        ...record,
        id: store[idx].id,
        submitted_at: store[idx].submitted_at || record.submitted_at,
        updatedAt: nowIso()
      };
    } else {
      store.push(record);
    }

    await writeStore(store);
    return Response.json({ ok: true, row: record });
  }

  if (mode === 'dedupe') {
    const result = dedupeRows(store);
    await writeStore(result.rows);
    return Response.json({ ok: true, removed: result.removed, total: result.rows.length });
  }

  if (mode === 'review') {
    const id = clean(body?.id);
    const decision = clean(body?.decision).toLowerCase();
    if (!id || !decision) return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    const idx = store.findIndex((r) => r.id === id);
    if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

    const status = decision === 'approve' ? 'Approved – Onboarding Pending' : decision === 'decline' ? 'Not Qualified At This Time' : store[idx].status;
    store[idx] = {
      ...store[idx],
      status,
      decision_bucket: decision === 'approve' ? 'auto_approved' : decision === 'decline' ? 'not_qualified' : store[idx].decision_bucket,
      reviewedAt: nowIso(),
      reviewedBy: clean(body?.reviewedBy || 'Kimora'),
      updatedAt: nowIso()
    };

    await writeStore(store);
    return Response.json({ ok: true, row: store[idx] });
  }

  return Response.json({ ok: false, error: 'unsupported_mode' }, { status: 400 });
}

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const id = clean(searchParams.get('id'));
  if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const store = await getStore();
  const idx = store.findIndex((r) => r.id === id);
  if (idx < 0) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  const [removed] = store.splice(idx, 1);
  await writeStore(store);
  return Response.json({ ok: true, removed });
}
