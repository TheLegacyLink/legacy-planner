export { POST } from '../lead-router/route';

export async function GET() {
  return Response.json({
    ok: true,
    message: 'Use POST to send GHL lead payloads here. This routes through lead assignment controls.',
    target: '/api/lead-router'
  });
}
