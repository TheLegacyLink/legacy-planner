import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';

const STORE_PATH = 'stores/contract-signatures.json';

function clean(v = '') {
  return String(v || '').trim();
}

function normalizeEmail(v = '') {
  return clean(v).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(raw = '') {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function first(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && clean(v) !== '') return v;
  }
  return '';
}

function isCompletedEvent(payload = {}) {
  const status = clean(first(
    payload?.envelopeStatus,
    payload?.status,
    payload?.data?.envelopeSummary?.status,
    payload?.data?.envelopeStatus,
    payload?.envelopeSummary?.status,
    payload?.event
  )).toLowerCase();

  return status === 'completed' || status === 'envelope-completed' || status === 'envelope_completed';
}

function extractRecipientArray(payload = {}) {
  const candidates = [
    payload?.recipients?.signers,
    payload?.data?.envelopeSummary?.recipients?.signers,
    payload?.data?.envelopeSummary?.recipients,
    payload?.envelopeSummary?.recipients?.signers,
    payload?.envelopeSummary?.recipients,
    payload?.recipients
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function extractCompletedRecords(payload = {}) {
  if (!isCompletedEvent(payload)) return [];

  const envelopeId = clean(first(
    payload?.envelopeId,
    payload?.envelope_id,
    payload?.data?.envelopeSummary?.envelopeId,
    payload?.envelopeSummary?.envelopeId
  ));

  const completedAt = clean(first(
    payload?.completedDateTime,
    payload?.completed_at,
    payload?.data?.envelopeSummary?.completedDateTime,
    payload?.envelopeSummary?.completedDateTime,
    nowIso()
  ));

  const recipients = extractRecipientArray(payload);

  return recipients
    .map((s) => ({
      email: normalizeEmail(first(s?.email, s?.emailAddress)),
      name: clean(first(s?.name, s?.userName)),
      signedAt: clean(first(s?.signedDateTime, completedAt)),
      envelopeId
    }))
    .filter((r) => r.email);
}

function xmlTag(xml = '', tag = '') {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = String(xml || '').match(re);
  return clean(m?.[1] || '');
}

function xmlBlocks(xml = '', tag = '') {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'ig');
  const out = [];
  let m = null;
  while ((m = re.exec(String(xml || '')))) out.push(clean(m[1] || ''));
  return out;
}

function decodeXmlEntities(v = '') {
  return String(v || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractCompletedRecordsFromXml(raw = '') {
  const xml = String(raw || '');
  if (!xml) return [];
  if (!/<Status>\s*Completed\s*<\/Status>/i.test(xml)) return [];

  const envelopeId = decodeXmlEntities(xmlTag(xml, 'EnvelopeID'));
  const completedAt = decodeXmlEntities(xmlTag(xml, 'Completed')) || nowIso();

  const recipients = xmlBlocks(xml, 'RecipientStatus')
    .map((block) => {
      const status = decodeXmlEntities(xmlTag(block, 'Status')).toLowerCase();
      if (status && status !== 'completed') return null;

      const email = normalizeEmail(decodeXmlEntities(xmlTag(block, 'Email')));
      if (!email) return null;

      const name = decodeXmlEntities(xmlTag(block, 'UserName')) || decodeXmlEntities(xmlTag(block, 'Name'));
      const signedAt = decodeXmlEntities(xmlTag(block, 'Signed')) || decodeXmlEntities(xmlTag(block, 'SignedDateTime')) || completedAt;

      return {
        email,
        name,
        signedAt,
        envelopeId
      };
    })
    .filter(Boolean);

  return recipients;
}

export async function POST(req) {
  const secret = clean(process.env.DOCUSIGN_CONNECT_SECRET || '');
  if (secret) {
    const incoming = clean(req.headers.get('x-contract-secret') || req.headers.get('x-docusign-secret') || '');
    if (!incoming || incoming !== secret) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  const raw = await req.text().catch(() => '');
  const payload = safeJsonParse(raw) || {};

  const jsonRecords = extractCompletedRecords(payload);
  const xmlRecords = jsonRecords.length ? [] : extractCompletedRecordsFromXml(raw);
  const records = jsonRecords.length ? jsonRecords : xmlRecords;
  const parsedFrom = jsonRecords.length ? 'json' : (xmlRecords.length ? 'xml' : 'none');

  if (!records.length) {
    return Response.json({ ok: true, skipped: true, reason: 'no_completed_records', parsedFrom });
  }

  const rows = await loadJsonStore(STORE_PATH, []);
  const list = Array.isArray(rows) ? rows : [];

  for (const rec of records) {
    const idx = list.findIndex((r) => normalizeEmail(r?.email) === rec.email);
    const next = {
      email: rec.email,
      name: rec.name,
      envelopeId: rec.envelopeId,
      signedAt: rec.signedAt,
      source: 'docusign_connect',
      updatedAt: nowIso(),
      createdAt: idx >= 0 ? clean(list[idx]?.createdAt || nowIso()) : nowIso()
    };
    if (idx >= 0) list[idx] = { ...list[idx], ...next };
    else list.push(next);
  }

  await saveJsonStore(STORE_PATH, list);
  return Response.json({ ok: true, updated: records.length, parsedFrom });
}
