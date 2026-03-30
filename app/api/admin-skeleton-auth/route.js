import { isValidAdminSkeleton } from '../../../lib/adminSkeletonAuth';

function clean(v = '') {
  return String(v || '').trim();
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const identifier = clean(body?.identifier || body?.name || body?.email || '');
  const password = clean(body?.password || '');

  if (!identifier || !password) {
    return Response.json({ ok: false, error: 'missing_credentials' }, { status: 400 });
  }

  const ok = isValidAdminSkeleton(password, {
    identifier,
    user: { name: identifier, email: identifier }
  });

  if (!ok) return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  return Response.json({ ok: true });
}
