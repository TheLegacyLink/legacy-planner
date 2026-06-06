/**
 * issue-bypass-token.mjs
 * Usage: node scripts/issue-bypass-token.mjs crystalgibbs1017@gmail.com
 * Generates a bypass login URL for the given email (skips OTP).
 */

import { createHash, randomBytes } from 'crypto';
import { put, list } from '@vercel/blob';

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const BASE_URL = 'https://innercirclelink.com';

const CODES_PATH  = 'stores/start-auth-codes.json';
const SESSIONS_PATH = 'stores/start-auth-sessions.json';
const START_INTAKE_PATH = 'stores/start-intake.json';
const APPS_PATH = 'stores/sponsorship-applications.json';
const LICENSED_AGENTS_PATH = 'data/licensedAgents.json';

function clean(v = '') { return String(v || '').trim(); }
function norm(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function nowIso() { return new Date().toISOString(); }
function sha256(v = '') { return createHash('sha256').update(String(v || '')).digest('hex'); }

async function loadStore(pathname, fallback = []) {
  if (!BLOB_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN not set');
  const curPath = `${pathname}__cur`;
  const { blobs } = await list({ prefix: curPath, limit: 5, token: BLOB_TOKEN });
  const match = (blobs || []).find(b => b.pathname === curPath);
  if (!match?.url) return fallback;
  const res = await fetch(match.url + `?_t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return fallback;
  const parsed = await res.json().catch(() => null);
  return Array.isArray(parsed) ? parsed : fallback;
}

async function saveStore(pathname, value) {
  const next = Array.isArray(value) ? value : [];
  const jsonStr = JSON.stringify(next);
  const opts = { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, token: BLOB_TOKEN };
  await put(`${pathname}__cur`, jsonStr, opts);
  return next;
}

async function resolveProfile(email) {
  const e = norm(email);

  const intake = await loadStore(START_INTAKE_PATH, []);
  const iMatch = intake.find(r => norm(r?.email) === e);
  if (iMatch) return {
    email: e,
    name: clean(`${clean(iMatch.firstName)} ${clean(iMatch.lastName)}`),
    phone: clean(iMatch.phone || ''),
    state: clean(iMatch.homeState || ''),
    trackType: clean(iMatch.trackType || 'unlicensed'),
    applicationId: clean(iMatch.id || ''),
    referrerName: clean(iMatch.referredBy || '')
  };

  const apps = await loadStore(APPS_PATH, []);
  const aMatch = apps.find(r => norm(r?.email) === e);
  if (aMatch) return {
    email: e,
    name: clean(`${clean(aMatch.firstName)} ${clean(aMatch.lastName)}`),
    phone: clean(aMatch.phone || ''),
    state: clean(aMatch.state || ''),
    trackType: String(aMatch.isLicensed ?? '').toLowerCase() === 'true' ? 'licensed' : 'unlicensed',
    applicationId: clean(aMatch.id || ''),
    referrerName: clean(aMatch.referralName || aMatch.referredBy || '')
  };

  return null;
}

async function issueSession(profile) {
  const sessions = await loadStore(SESSIONS_PATH, []);
  const token = randomBytes(28).toString('hex');
  const tokenHash = sha256(token);
  const e = norm(profile.email);
  const filtered = sessions.filter(r => norm(r?.email) !== e);
  filtered.push({
    tokenHash,
    email: e,
    name: clean(profile.name),
    phone: clean(profile.phone || ''),
    state: clean(profile.state || ''),
    trackType: clean(profile.trackType || 'unlicensed'),
    applicationId: clean(profile.applicationId || ''),
    referrerName: clean(profile.referrerName || ''),
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    active: true
  });
  await saveStore(SESSIONS_PATH, filtered);
  return token;
}

const email = process.argv[2];
if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/issue-bypass-token.mjs <email>');
  process.exit(1);
}

console.log(`\nLooking up profile for: ${email}`);
const profile = await resolveProfile(email);
if (!profile) {
  console.error(`❌ No profile found for ${email}`);
  process.exit(1);
}
console.log(`✅ Found: ${profile.name} (${profile.trackType})`);

const token = await issueSession(profile);
const link = `${BASE_URL}/start/bypass?t=${token}`;

console.log(`\n✅ Bypass link (valid 30 days):\n\n${link}\n`);
