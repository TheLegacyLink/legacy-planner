import { loadJsonFile, saveJsonFile } from '../../../lib/blobJsonStore';

export const dynamic = 'force-dynamic';

const STORE_PATH = 'qr-scan-log/v1.json';

function clean(v = '') { return String(v || '').trim(); }

function getDevice(ua = '') {
  if (/mobile|android|iphone|ipad/i.test(ua)) return 'mobile';
  return 'desktop';
}

function getIp(req) {
  return clean(
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    req.headers.get('x-real-ip') ||
    ''
  );
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ref = clean(searchParams.get('ref') || '');
  const dest = clean(searchParams.get('dest') || '');

  // Log the scan
  if (ref) {
    try {
      const scans = await loadJsonFile(STORE_PATH, []);
      const list = Array.isArray(scans) ? scans : [];
      list.unshift({
        ref,
        ts: new Date().toISOString(),
        ip: getIp(req),
        device: getDevice(req.headers.get('user-agent') || ''),
      });
      // Keep last 5000 scans
      await saveJsonFile(STORE_PATH, list.slice(0, 5000));
    } catch {
      // Non-blocking — scan logging failure should not block redirect
    }
  }

  // Redirect to dest or default sponsorship page
  const target = dest || `https://innercirclelink.com/sponsorship-signup${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
  return Response.redirect(target, 302);
}
