import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';
import basePolicies from '../../../data/fngPolicies.json';

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

function normalizeKey(v = '') {
  return clean(v).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pick(row, aliases = []) {
  const entries = Object.entries(row || {});
  const byNorm = new Map(entries.map(([k, v]) => [normalizeKey(k), v]));

  for (const key of aliases) {
    if (row[key] != null && String(row[key]).trim() !== '') return row[key];
    const hit = byNorm.get(normalizeKey(key));
    if (hit != null && String(hit).trim() !== '') return hit;
  }
  return '';
}

function normalizeRow(row = {}, reportDate = '') {
  const policyNumber = clean(pick(row, ['policy_number', 'policy number', 'Policy Number', 'policy#', 'Policy #', 'Policy No', 'Policy No.', 'Contract Number', 'Contract #'])).toUpperCase();
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

function extractRowsRobust(sheet) {
  const rowsDefault = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
  if (Array.isArray(rowsDefault) && rowsDefault.length) return rowsDefault;

  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  if (!Array.isArray(grid) || !grid.length) return [];

  const headerRowIdx = grid.findIndex((row) =>
    (row || []).some((cell) => {
      const k = normalizeKey(cell);
      return k.includes('policynumber') || k === 'policy' || k === 'policyno' || k.includes('contractnumber');
    })
  );

  if (headerRowIdx < 0) return [];

  const headers = (grid[headerRowIdx] || []).map((h) => clean(h));
  const rows = [];

  for (const arr of grid.slice(headerRowIdx + 1)) {
    const obj = {};
    headers.forEach((h, i) => {
      if (!h) return;
      obj[h] = arr[i] ?? '';
    });
    rows.push(obj);
  }

  return rows;
}

function parseCsvRows(buffer) {
  const text = buffer.toString('utf8');
  const out = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => clean(h)
  });
  if (out.errors?.length && !out.data?.length) {
    throw new Error(out.errors[0]?.message || 'csv_parse_failed');
  }
  return Array.isArray(out.data) ? out.data : [];
}

function ensurePayload(raw = null) {
  if (Array.isArray(raw)) {
    return {
      rows: raw,
      updatedAt: '',
      sourceFile: '',
      importedCount: raw.length,
      dedupedCount: raw.length,
      newCount: 0
    };
  }

  const obj = raw && typeof raw === 'object' ? raw : {};
  return {
    rows: Array.isArray(obj.rows) ? obj.rows : [],
    updatedAt: clean(obj.updatedAt || ''),
    sourceFile: clean(obj.sourceFile || ''),
    importedCount: Number(obj.importedCount || 0),
    dedupedCount: Number(obj.dedupedCount || (Array.isArray(obj.rows) ? obj.rows.length : 0)),
    newCount: Number(obj.newCount || 0)
  };
}

function policySet(rows = []) {
  return new Set((rows || []).map((r) => clean(r?.policy_number || '').toUpperCase()).filter(Boolean));
}

export async function GET() {
  const raw = await loadJsonStore(STORE_PATH, { rows: [], updatedAt: '', sourceFile: '', newCount: 0 });
  const payload = ensurePayload(raw);
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

    const fileName = clean(file?.name || '').toLowerCase();
    const mimeType = clean(file?.type || '').toLowerCase();
    const isCsv = fileName.endsWith('.csv') || mimeType.includes('csv') || mimeType.includes('text/plain');

    let rawRows = [];
    if (isCsv) {
      rawRows = parseCsvRows(buffer);
    } else {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) return Response.json({ ok: false, error: 'empty_workbook' }, { status: 400 });
      const sheet = workbook.Sheets[firstSheet];
      rawRows = extractRowsRobust(sheet);
    }

    const normalized = rawRows
      .map((r) => normalizeRow(r, reportDate))
      .filter(Boolean);

    if (!normalized.length) {
      return Response.json({
        ok: false,
        error: 'no_policy_rows_detected',
        hint: 'Could not find policy rows in file. Make sure a Policy Number (or Contract Number) column exists.'
      }, { status: 400 });
    }

    const deduped = dedupeByPolicy(normalized);

    const existingRaw = await loadJsonStore(STORE_PATH, { rows: [], updatedAt: '', sourceFile: '', newCount: 0 });
    const existing = ensurePayload(existingRaw);

    // New = not present in current baseline book OR prior uploaded workbook.
    const baselineSet = policySet(basePolicies || []);
    const previousUploadSet = policySet(existing.rows || []);
    const seen = new Set([...baselineSet, ...previousUploadSet]);

    const newCount = deduped.filter((r) => !seen.has(clean(r?.policy_number || '').toUpperCase())).length;

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
