export { POST } from '../caller-leads/route';

export async function GET() {
  return Response.json({
    ok: true,
    message: 'Use POST to send GHL lead payloads here. This is an alias of /api/caller-leads.',
    target: '/api/caller-leads'
  });
}
