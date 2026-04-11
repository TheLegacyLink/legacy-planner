import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env manually
const envPath = join(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
}

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!BLOB_TOKEN) { console.error('Missing BLOB_READ_WRITE_TOKEN'); process.exit(1); }

const { put, list } = await import('@vercel/blob');

async function loadJsonFile(pathname) {
  const versionPrefix = `${pathname}__v/`;
  const versioned = await list({ prefix: versionPrefix, limit: 200, token: BLOB_TOKEN });
  const newest = (versioned?.blobs || []).sort((a, b) => String(b.pathname).localeCompare(String(a.pathname)))[0];
  if (newest?.url) {
    const res = await fetch(newest.url, { cache: 'no-store' });
    if (res.ok) return await res.json();
  }
  return null;
}

async function saveJsonFile(pathname, value) {
  const vp = `${pathname}__v/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  await put(vp, JSON.stringify(value), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: false, token: BLOB_TOKEN });
}

function normalizePhone(v = '') { return String(v || '').replace(/\D/g, ''); }
function clean(v = '') { return String(v || '').trim(); }

const apps = await loadJsonFile('stores/sponsorship-applications.json') || [];
const fbLeads = await loadJsonFile('stores/fb-leads.json') || [];

console.log(`Loaded ${apps.length} apps, ${fbLeads.length} FB leads`);

const emailMap = new Map();
const phoneMap = new Map();
for (const fl of fbLeads) {
  const distTo = clean(fl?.distributedTo || '');
  if (!distTo) continue;
  const em = clean(fl?.email || '').toLowerCase();
  const ph = normalizePhone(fl?.phone_number || fl?.phone || '').slice(-10);
  if (em) emailMap.set(em, distTo);
  if (ph && ph.length >= 10) phoneMap.set(ph, distTo);
}
console.log(`Maps: ${emailMap.size} emails, ${phoneMap.size} phones with assignments`);

let fixed = 0;
for (const app of apps) {
  const appEmail = clean(app?.email || '').toLowerCase();
  const appPhone = normalizePhone(app?.phone || '').slice(-10);
  const assignedAgent = emailMap.get(appEmail) || (appPhone.length >= 10 ? phoneMap.get(appPhone) : null);
  if (!assignedAgent) continue;
  const currentOwner = clean(app?.referredByName || app?.referred_by || '');
  if (currentOwner.toLowerCase() === assignedAgent.toLowerCase()) continue;
  const refCode = assignedAgent.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  app.referralName = assignedAgent;
  app.referredByName = assignedAgent;
  app.referred_by = assignedAgent;
  app.sponsorDisplayName = assignedAgent;
  app.refCode = refCode;
  app.referralLocked = true;
  app.assignmentSource = 'fb_lead_distribution';
  app.updatedAt = new Date().toISOString();
  console.log(`FIXED: ${app.firstName} ${app.lastName} | ${currentOwner} → ${assignedAgent}`);
  fixed++;
}

if (fixed > 0) {
  await saveJsonFile('stores/sponsorship-applications.json', apps);
  console.log(`\nDone. Fixed ${fixed} records.`);
} else {
  console.log('No mismatches found — all attributions already correct.');
}
