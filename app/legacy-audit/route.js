import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

// Auth is handled client-side in the HTML (checks localStorage for back office
// or IC Hub session). The tool is also gated behind the Agent Training quiz
// for agents accessing it via the training portal.
export async function GET() {
  const html = readFileSync(join(process.cwd(), 'public', 'legacy-audit.html'), 'utf8');
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
