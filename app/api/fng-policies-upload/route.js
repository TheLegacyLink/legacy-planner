import * as XLSX from 'xlsx';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const STORE_PATH = 'stores/fng-policies-upload.json';

function clean(v = '') {
  return String(v || '').trim();
}

function toNum(v) {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function excelDateToIso(v) {
  if (v == null || v === '') return '';

  if (typeof v === 'number') {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (!parsed) return '';
    const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    return d.toISOString().slice(0, 10);
  }

  const s = clean(v);
  if (!s) return '';

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  const mmddyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (mmddyyyy) {
    const m = Number(mmddyyyy[1]);
    const day = Number(mmddyyyy[2]);
    let y = Number(mmddyyyy[3]);
    if (y < 100) y += 2000;
    const out = new Date(Date.UTC(y, m - 1, day));
    if (!Number.isNaN(out.getTime())) return out.toISOString().slice(0, 10);
  }

  return '';
}

function statusNorm(status = '') {
  const s = clean(status).toLowerCase();
  if (s === 'active') return 'active';
  if (s.includes('pending lapse')) return 'pending_lapse';
  return s || 'non_active';
}

function pick(row, aliases = []) {
  for (const key of aliases) {
    if (row[key] != null && String(row[key]).trim() !== '') return row[key];
  }
  return '';
}

function normalizeRow(row = {}, reportDate = '') {
  const policyNumber = clean(pick(row, ['policy_number', 'policy number', 'Policy Number', 'policy#', 'Policy #'])).toUpperCase();
  if (!policyNumber) return null;

  const issuedDate = excelDateToIso(pick(row, ['policy_issued_date', 'Policy Issued Date', 'issued date', 'Issued Date']));
  const effectiveDate = excelDateToIso(pick(row, ['policy_effective_date', 'Policy Effective Date', 'effective date', 'Effective Date']));
  const firstPremiumDate = excelDateToIso(pick(row, ['first_premium_payment_date', 'First Premium Payment Date', 'first premium date']));

  const status = clean(pick(row, ['policy_status', 'Policy Status', 'status', 'Status'])) || 'Active';

  return {
    policy_number: policyNumber,
    writing_agent_name: clean(pick(row, ['writing_agent_name', 'Writing Agent Name', 'agent', 'Agent Name'])),
    writing_agent_number: clean(pick(row, ['writing_agent_number', 'Writing Agent Number', 'Agent Number'])),
    writing_agent_email: clean(pick(row, ['writing_agent_email', 'Writing Agent Email', 'Agent Email'])),
    policy_status: status,
    policy_status_norm: statusNorm(status),
    product_type: clean(pick(row, ['product_type', 'Product Type'])) || 'Life',
    product_name: clean(pick(row, ['product_name', 'Product Name'])) || 'F&G Policy',
    policy_issued_date: issuedDate,
    policy_effective_date: effectiveDate,
    first_premium_payment_date: firstPremiumDate,
    issued_state: clean(pick(row, ['issued_state', 'Issued State', 'state', 'State'])),
    issued_state_code: clean(pick(row, ['issued_state_code', 'Issued State Code', 'state_code', 'State Code'])).toUpperCase(),
    payment_mode: clean(pick(row, ['payment_mode', 'Payment Mode', 'mode'])) || 'monthly',
    owner_name: clean(pick(row, ['owner_name', 'Owner Name', 'insured_name', 'Insured Name'])),
    owner_phone: clean(pick(row, ['owner_phone', 'Owner Phone', 'phone', 'Phone'])),
    owner_email: clean(pick(row, ['owner_email', 'Owner Email', 'email', 'Email'])),
    modal_premium: toNum(pick(row, ['modal_premium', 'Modal Premium', 'premium', 'Premium'])),
    current_account_value: toNum(pick(row, ['current_account_value', 'Current Account Value', 'account_value'])),
    total_premium_paid: toNum(pick(row, ['total_premium_paid', 'Total Premium Paid'])),
    report_date: reportDate || excelDateToIso(pick(row, ['report_date', 'Report Date'])) || new Date().toISOString().slice(0, 10),
    source_carrier: clean(pick(row, ['source_carrier', 'Source Carrier'])) || 'F&G'
  };
}

function dedupeByPolicy(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const key = clean(row?.policy_number || '').toUpperCase();
    if (!key) continue;
    map.set(key, row);
  }
  return Array.from(map.values());
}

export async function GET() {
  const payload = await loadJsonStore(STORE_PATH, { rows: [], updatedAt: '', sourceFile: '', newCount: 0 });
  return Response.json({ ok: true, ...payload });
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get('file');

    if (!file || typeof file.arrayBuffer !== 'function') {
      return Response.json({ ok: false, error: 'missing_file' }, { status: 400 });
    }

    const reportDate = clean(form.get('reportDate') || '');
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) return Response.json({ ok: false, error: 'empty_workbook' }, { status: 400 });

    const sheet = workbook.Sheets[firstSheet];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });

    const normalized = rawRows
      .map((r) => normalizeRow(r, reportDate))
      .filter(Boolean);

    const deduped = dedupeByPolicy(normalized);

    const existing = await loadJsonStore(STORE_PATH, { rows: [], updatedAt: '', sourceFile: '', newCount: 0 });
    const previousSet = new Set((existing?.rows || []).map((r) => clean(r?.policy_number || '').toUpperCase()));
    const newCount = deduped.filter((r) => !previousSet.has(clean(r?.policy_number || '').toUpperCase())).length;

    const payload = {
      rows: deduped,
      updatedAt: new Date().toISOString(),
      sourceFile: clean(file.name || ''),
      importedCount: normalized.length,
      dedupedCount: deduped.length,
      newCount
    };

    await saveJsonStore(STORE_PATH, payload);
    return Response.json({ ok: true, ...payload });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'upload_failed' }, { status: 500 });
  }
}
