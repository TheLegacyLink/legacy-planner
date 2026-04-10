import { put, list } from '@vercel/blob';

// Load env from .env.production.runtime
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.production.runtime');
const envContent = readFileSync(envPath, 'utf-8');

for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z0-9_]+)="?(.+?)"?$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2];
  }
}

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!BLOB_TOKEN) {
  console.error('ERROR: BLOB_READ_WRITE_TOKEN not found');
  process.exit(1);
}

const PATHNAME = 'stores/sponsorship-applications.json';

// IDs to update
const TARGET_IDS = ['sapp_1775745434558', 'sapp_1775745310103'];

// Fields to update
const REFERRAL_UPDATES = {
  referralName: 'Donyell Richardson',
  referralOther: '',
  refCode: 'donyell_richardson',
  referralLocked: true,
  referredByName: 'Donyell Richardson',
  referred_by: 'Donyell Richardson',
  sponsorDisplayName: 'Donyell Richardson',
};

async function loadJsonStore(pathname) {
  const versionPrefix = `${pathname}__v/`;
  const versioned = await list({ prefix: versionPrefix, limit: 200, token: BLOB_TOKEN });
  const newestVersion = (versioned?.blobs || [])
    .sort((a, b) => String(b.pathname || '').localeCompare(String(a.pathname || '')))[0];

  if (newestVersion?.url) {
    const res = await fetch(newestVersion.url, { cache: 'no-store' });
    if (res.ok) {
      const parsed = await res.json().catch(() => null);
      if (parsed) return parsed;
    }
  }

  // Back-compat: read old non-versioned key
  const { blobs } = await list({ prefix: pathname, limit: 200, token: BLOB_TOKEN });
  const matches = (blobs || []).filter(b => b.pathname === pathname);
  const match = matches.sort((a, b) =>
    new Date(b.uploadedAt || b.uploaded_at || 0).getTime() -
    new Date(a.uploadedAt || a.uploaded_at || 0).getTime()
  )[0];
  if (!match?.url) return [];

  const res = await fetch(match.url, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

async function saveJsonStore(pathname, value) {
  const versionedPath = `${pathname}__v/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  await put(versionedPath, JSON.stringify(value), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: false,
    token: BLOB_TOKEN,
  });
  console.log(`Saved new version: ${versionedPath}`);
}

async function main() {
  console.log('Loading sponsorship applications from Vercel Blob...');
  const apps = await loadJsonStore(PATHNAME);
  console.log(`Loaded ${apps.length} records total.`);

  let updatedCount = 0;

  for (const app of apps) {
    if (TARGET_IDS.includes(app.id)) {
      const before = {
        referralName: app.referralName,
        referred_by: app.referred_by,
        sponsorDisplayName: app.sponsorDisplayName,
      };

      Object.assign(app, REFERRAL_UPDATES);

      console.log(`\nUpdated record: ${app.id}`);
      console.log(`  Name: ${app.name || app.firstName + ' ' + app.lastName || 'N/A'}`);
      console.log(`  Email: ${app.email}`);
      console.log(`  Before: referralName="${before.referralName}", referred_by="${before.referred_by}", sponsorDisplayName="${before.sponsorDisplayName}"`);
      console.log(`  After:  referralName="${app.referralName}", referred_by="${app.referred_by}", sponsorDisplayName="${app.sponsorDisplayName}"`);

      updatedCount++;
    }
  }

  if (updatedCount === 0) {
    console.error('ERROR: No matching records found! IDs not found in store.');
    process.exit(1);
  }

  if (updatedCount < TARGET_IDS.length) {
    console.warn(`WARNING: Only found ${updatedCount} of ${TARGET_IDS.length} target records.`);
  }

  console.log(`\nSaving ${apps.length} records back to blob...`);
  await saveJsonStore(PATHNAME, apps);
  console.log(`\n✅ Done. Updated ${updatedCount} record(s). Referral attribution changed to "Donyell Richardson".`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
