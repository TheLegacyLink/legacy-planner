#!/usr/bin/env node
import fs from 'node:fs';

const [, , csvPathArg, baseArg] = process.argv;
if (!csvPathArg) {
  console.error('Usage: node scripts/importHierarchyCsv.mjs "<csv path>" [baseUrl]');
  process.exit(1);
}

const baseUrl = (baseArg || 'https://innercirclelink.com').replace(/\/$/, '');

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }

function parseCsv(content = '') {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const parseLine = (line) => {
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i += 1; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((x) => clean(x));
  };

  const header = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseLine(lines[i]);
    const row = {};
    for (let c = 0; c < header.length; c += 1) row[header[c]] = cols[c] || '';
    rows.push(row);
  }
  return rows;
}

async function post(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const content = fs.readFileSync(csvPathArg, 'utf8');
const csvRows = parseCsv(content);

const nameToEmail = new Map();
for (const r of csvRows) {
  const n = norm(r?.Name || '');
  const e = norm(r?.Email || '');
  if (n && e && !nameToEmail.has(n)) nameToEmail.set(n, e);
}

const memberRows = [];
const hierarchyRows = [];
const dedupe = new Set();

for (const r of csvRows) {
  const childName = clean(r?.Name || '');
  const childEmail = clean(r?.Email || '').toLowerCase();
  const sponsor = clean(r['Sponsor / Upline'] || '');
  const level = clean(r?.Level || '');
  const tier = clean(r?.Tier || '');

  const dedupeKey = `${childEmail || childName.toLowerCase()}`;
  if (!dedupeKey || dedupe.has(dedupeKey)) continue;
  dedupe.add(dedupeKey);

  if (childName || childEmail) {
    memberRows.push({
      applicantName: childName,
      email: childEmail,
      bookingId: `csv_${(childEmail || childName.toLowerCase().replace(/\s+/g, '_')).replace(/[^a-z0-9_@.-]/g, '')}`
    });
  }

  const sponsorNorm = norm(sponsor);
  const isTop = !sponsorNorm || sponsorNorm === 'top level' || sponsorNorm === 'top-tier' || sponsorNorm === 'top tier';
  if (isTop) continue;

  hierarchyRows.push({
    childName,
    childEmail,
    parentName: sponsor,
    parentEmail: clean(nameToEmail.get(sponsorNorm) || ''),
    level,
    tier,
    note: `csv_import_tier:${tier}|level:${level}`
  });
}

const membersRes = await post('/api/inner-circle-hub-members', {
  action: 'bulk_upsert',
  rows: memberRows
});

const hierarchyRes = await post('/api/team-hierarchy', {
  action: 'bulk_import',
  actorEmail: 'kimora@thelegacylink.com',
  source: 'admin_csv_import',
  lastAppType: 'Hierarchy CSV Import',
  rows: hierarchyRows
});

console.log(JSON.stringify({
  baseUrl,
  csvRows: csvRows.length,
  membersPrepared: memberRows.length,
  hierarchyPrepared: hierarchyRows.length,
  membersResponse: membersRes,
  hierarchyResponse: hierarchyRes
}, null, 2));
