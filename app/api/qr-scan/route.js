import { NextResponse } from 'next/server';
import { saveJsonFile, loadJsonFile } from '../../../lib/blobJsonStore';

const STORE_PATH = 'qr-scan-log/v1.json';

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const ref = String(sp.get('ref') || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');

  if (!ref) {
    return NextResponse.redirect(new URL('/sponsorship-signup', req.url));
  }

  // Log the scan
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const ua = req.headers.get('user-agent') || '';

    const log = (await loadJsonFile(STORE_PATH, [])) || [];
    log.push({
      ref,
      ts: new Date().toISOString(),
      ip,
      device: /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop',
    });

    // Keep last 50k records, trim older
    const trimmed = log.slice(-50000);
    await saveJsonFile(STORE_PATH, trimmed);
  } catch {
    // Never block the redirect on logging failure
  }

  const dest = new URL('/sponsorship-signup', 'https://innercirclelink.com');
  dest.searchParams.set('ref', ref);
  return NextResponse.redirect(dest.toString(), { status: 302 });
}
