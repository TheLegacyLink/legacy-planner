import { loadJsonFile } from '../../../../lib/blobJsonStore';

const STORE_PATH = 'qr-scan-log/v1.json';

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const ref = String(sp.get('ref') || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');

  const log = (await loadJsonFile(STORE_PATH, [])) || [];

  if (ref) {
    const entries = log.filter((e) => e.ref === ref);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const today = entries.filter((e) => new Date(e.ts) >= todayStart).length;
    const total = entries.length;
    const mobile = entries.filter((e) => e.device === 'mobile').length;
    const desktop = entries.filter((e) => e.device === 'desktop').length;
    const lastScan = entries.length ? entries[entries.length - 1].ts : null;

    // Last 7 days breakdown
    const days = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      days[key] = 0;
    }
    entries.forEach((e) => {
      const k = e.ts?.slice(0, 10);
      if (k && k in days) days[k]++;
    });

    return Response.json({ ref, total, today, mobile, desktop, lastScan, days });
  }

  // Admin: return all ref codes with totals
  const totals = {};
  log.forEach((e) => {
    if (!totals[e.ref]) totals[e.ref] = 0;
    totals[e.ref]++;
  });

  return Response.json({ totals, totalScans: log.length });
}
