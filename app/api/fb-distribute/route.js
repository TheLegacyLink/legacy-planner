export { POST } from '../assign-fb-lead/route';

export async function GET() {
  return Response.json({ ok: true, target: '/api/assign-fb-lead' });
}
