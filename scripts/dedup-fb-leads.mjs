#!/usr/bin/env node
/**
 * Deduplicate fb-leads.json store in Vercel Blob.
 * - Reads from Blob using the same versioned-key strategy as blobJsonStore.js
 * - Deduplicates by email (case-insensitive):
 *     keep the record with `distributedTo` set; otherwise keep the most recent by importedAt / created_time
 * - Saves cleaned store back via a new versioned key
 * - Logs how many duplicates were removed
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Load .env files ──────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function loadEnv(filename) {
  const p = path.resolve(__dirname, '..', filename);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w]+)\s*=\s*"?([^"#\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv('.env.local');
loadEnv('.env.production.runtime');

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!TOKEN) {
  console.error('❌  BLOB_READ_WRITE_TOKEN not found in .env.local');
  process.exit(1);
}

// ── Blob helpers ─────────────────────────────────────────────────────────────
const { list, put } = await import('@vercel/blob');

const STORE_PATH = 'stores/fb-leads.json';
const VERSION_PREFIX = `${STORE_PATH}__v/`;

async function loadStore() {
  // Try newest versioned key first
  const versioned = await list({ prefix: VERSION_PREFIX, limit: 200, token: TOKEN });
  const newestVersion = (versioned?.blobs || [])
    .sort((a, b) => String(b.pathname || '').localeCompare(String(a.pathname || '')))[0];

  if (newestVersion?.url) {
    const res = await fetch(newestVersion.url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data) { console.log(`✅  Loaded from versioned key: ${newestVersion.pathname}`); return data; }
    }
  }

  // Back-compat: read old non-versioned key
  const { blobs } = await list({ prefix: STORE_PATH, limit: 200, token: TOKEN });
  const match = (blobs || [])
    .filter(b => b.pathname === STORE_PATH)
    .sort((a, b) => new Date(b.uploadedAt || b.uploaded_at || 0) - new Date(a.uploadedAt || a.uploaded_at || 0))[0];

  if (!match?.url) return [];
  const res = await fetch(match.url, { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  console.log(`✅  Loaded from legacy key: ${match.pathname}`);
  return data || [];
}

async function saveStore(data) {
  const versionedPath = `${VERSION_PREFIX}${Date.now()}-dedup.json`;
  await put(versionedPath, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: false,
    token: TOKEN,
  });
  console.log(`💾  Saved to: ${versionedPath}`);
}

// ── Dedup logic ───────────────────────────────────────────────────────────────
function getTimestamp(record) {
  const raw = record.importedAt || record.created_time || '';
  const ts = Date.parse(raw);
  return isNaN(ts) ? 0 : ts;
}

function pickBetter(a, b) {
  const aHasDist = !!(a.distributedTo && (Array.isArray(a.distributedTo) ? a.distributedTo.length : true));
  const bHasDist = !!(b.distributedTo && (Array.isArray(b.distributedTo) ? b.distributedTo.length : true));

  if (aHasDist && !bHasDist) return a;
  if (bHasDist && !aHasDist) return b;
  // Both or neither have distributedTo → keep more recent
  return getTimestamp(a) >= getTimestamp(b) ? a : b;
}

function dedup(records) {
  const byEmail = new Map();

  for (const record of records) {
    const email = (record.email || '').trim().toLowerCase();
    if (!email) {
      // No email — keep as-is, use id as key to avoid dropping
      byEmail.set(`__no-email__${record.id || Math.random()}`, record);
      continue;
    }
    if (!byEmail.has(email)) {
      byEmail.set(email, record);
    } else {
      byEmail.set(email, pickBetter(byEmail.get(email), record));
    }
  }

  return Array.from(byEmail.values());
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('🔍  Loading fb-leads store from Vercel Blob…');
const raw = await loadStore();

if (!Array.isArray(raw)) {
  console.error('❌  Store did not return an array:', typeof raw);
  process.exit(1);
}

console.log(`📋  Total records loaded: ${raw.length}`);

const cleaned = dedup(raw);
const removed = raw.length - cleaned.length;

console.log(`🧹  Duplicates removed: ${removed}`);
console.log(`✨  Unique records remaining: ${cleaned.length}`);

if (removed === 0) {
  console.log('ℹ️   No duplicates found — store is already clean. No save needed.');
  process.exit(0);
}

console.log('💾  Saving cleaned store back to Vercel Blob…');
await saveStore(cleaned);
console.log('✅  Done!');
