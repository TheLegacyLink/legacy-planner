import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const FB_LEADS_PATH = 'stores/fb-leads.json';

function splitLine(line, sep) {
  if (sep === '\t') return line.split('\t');
  // comma-aware split with quote handling
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text) {
  const cleaned = String(text || '').replace(/^\uFEFF/, ''); // strip BOM
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], firstKey: 'id' };

  // Detect separator: if first line has more tabs than commas, it's TSV
  const sep = (lines[0].split('\t').length > lines[0].split(',').length) ? '\t' : ',';

  const rawHeaders = splitLine(lines[0], sep);
  // Normalize headers: strip BOM/non-alphanum prefix, lowercase, trim
  const headers = rawHeaders.map((h) => h.replace(/^[^a-zA-Z_]+/, '').trim().toLowerCase());
  const firstKey = headers[0];

  const rows = lines.slice(1).map((line) => {
    const vals = splitLine(line, sep);
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
    return row;
  });
  return { rows, firstKey };
}

function stripPrefix(val) {
  // Facebook prefixes values like l:123, ag:123, p:+1234, etc.
  return String(val || '').replace(/^[a-z]+:/, '').trim();
}

function mapRow(row, firstKey) {
  const rawId = row.id || row[firstKey] || '';
  const id = stripPrefix(rawId);
  return {
    id,
    created_time: String(row.created_time || '').trim(),
    ad_id: String(row.ad_id || '').trim(),
    ad_name: String(row.ad_name || '').trim(),
    adset_id: String(row.adset_id || '').trim(),
    adset_name: String(row.adset_name || '').trim(),
    campaign_id: String(row.campaign_id || '').trim(),
    campaign_name: String(row.campaign_name || '').trim(),
    form_id: String(row.form_id || '').trim(),
    form_name: String(row.form_name || '').trim(),
    is_organic: String(row.is_organic || '').trim(),
    platform: String(row.platform || 'fb').trim() || 'fb',
    full_name: String(row.full_name || '').trim(),
    email: String(row.email || '').trim().toLowerCase(),
    state: String(row.state || '').trim(),
    phone_number: stripPrefix(row.phone_number || ''),
    importedAt: new Date().toISOString(),
    distributedTo: '',
    distributedAt: ''
  };
}

export async function POST(req) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let incoming = [];

    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body)) {
        incoming = body.map((r) => mapRow(r, Object.keys(r)[0]));
      } else if (body.csv) {
        const { rows, firstKey } = parseCsv(body.csv);
        incoming = rows.map((r) => mapRow(r, firstKey));
      } else if (Array.isArray(body.rows)) {
        incoming = body.rows.map((r) => mapRow(r, Object.keys(r)[0]));
      }
    } else {
      const text = await req.text().catch(() => '');
      const { rows, firstKey } = parseCsv(text);
      incoming = rows.map((r) => mapRow(r, firstKey));
    }

    incoming = incoming.filter((r) => r.id);

    if (!incoming.length) {
      return Response.json({ ok: false, error: 'no_valid_rows' }, { status: 400 });
    }

    const existing = await loadJsonStore(FB_LEADS_PATH, []);
    const existingIds = new Set(existing.map((r) => r.id));

    let added = 0;
    let duplicates = 0;

    for (const row of incoming) {
      if (existingIds.has(row.id)) {
        duplicates++;
      } else {
        existing.push(row);
        existingIds.add(row.id);
        added++;
      }
    }

    await saveJsonStore(FB_LEADS_PATH, existing);

    return Response.json({ ok: true, added, duplicates, total: existing.length });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err?.message || 'import_failed') },
      { status: 500 }
    );
  }
}
