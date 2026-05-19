import { readFileSync } from 'fs';
import { join } from 'path';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

function isLicensed() {
  try {
    const jar = cookies();
    const token = jar.get('licensed_backoffice_token')?.value || jar.get('inner_circle_hub_member_v1')?.value || '';
    return Boolean(token);
  } catch {
    return false;
  }
}

export async function GET() {
  if (!isLicensed()) {
    return new Response(
      `<!doctype html><html><head><meta charset="utf-8"/><title>Legacy Audit</title>
      <style>body{background:#0E0E10;color:#F5F5F0;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;flex-direction:column;gap:16px;}
      a{color:#B8985A;font-weight:700;text-decoration:none;border:1px solid #B8985A;padding:12px 24px;border-radius:10px;}
      a:hover{background:#B8985A22;}</style></head>
      <body><p style="font-size:18px;">Licensed agents only.</p>
      <a href="/licensed-backoffice">Sign In to Back Office</a>
      <a href="/inner-circle-hub">Sign In to Inner Circle Hub</a></body></html>`,
      { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const html = readFileSync(join(process.cwd(), 'public', 'legacy-audit.html'), 'utf8');
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
