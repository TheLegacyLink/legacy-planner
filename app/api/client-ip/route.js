function clean(v = '') {
  return String(v || '').trim();
}

function getIp(req) {
  const xff = clean(req.headers.get('x-forwarded-for'));
  if (xff) return xff.split(',')[0].trim();
  return clean(req.headers.get('x-real-ip')) || '';
}

export async function GET(req) {
  const ip = getIp(req);
  return Response.json({ ok: true, ip });
}
