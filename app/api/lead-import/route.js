import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

const FB_LEADS_PATH = 'stores/fb-leads.json';

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
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
  const lines = String(text || '')
    .replace(/^\uFEFF/, '') // strip BOM
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length < 2) return [];
  // Strip any leading non-alphanumeric characters (e.g. colon prefix Facebook sometimes adds)
  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map((h, i) => i === 0 ? h.replace(/^[^a-zA-Z0-9]+/, '') : h);
  const firstKey = headers[0]; // capture original (cleaned) first column name
  const rows = lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (vals[i] || '').trim();
    });
    return row;
  });
  return { rows, firstKey };
}

function mapRow(row, firstKey) {
  // Facebook sometimes exports with a BOM or colon-prefixed first column that doesn't resolve to 'id'
  // Fall back to whatever the first column key is
  const id = String(row.id || row[firstKey] || '').trim();
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
    phone_number: String(row.phone_number || '').trim(),
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
