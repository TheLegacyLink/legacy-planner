import { issueSession } from '../_lib';

export const dynamic = 'force-dynamic';

// Demo users allowed to auto-login (no OTP) from licensed back office
const DEMO_AUTO_LOGIN = [
  {
    email: 'Leticia@thelegacylink.com',
    name: 'Leticia Wright',
    phone: '',
    state: 'GA',
    applicationId: 'preview_unlicensed_leticia'
  }
];

function clean(v = '') { return String(v || '').trim(); }

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = clean(body?.email).toLowerCase();

  const demo = DEMO_AUTO_LOGIN.find((u) => clean(u.email).toLowerCase() === email);
  if (!demo) {
    return Response.json({ ok: false, error: 'not_a_demo_user' }, { status: 403 });
  }

  const session = await issueSession({
    email: demo.email,
    name: demo.name,
    phone: demo.phone,
    state: demo.state,
    applicationId: demo.applicationId
  });

  return Response.json({ ok: true, token: session.token, expiresAt: session.expiresAt, profile: demo });
}
