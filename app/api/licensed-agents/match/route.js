import { clean, matchLicensedAgent } from '../../../../lib/licensedAgentMatch';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const input = {
    fullName: clean(body?.fullName || `${clean(body?.firstName)} ${clean(body?.lastName)}`),
    email: clean(body?.email),
    phone: clean(body?.phone)
  };

  if (!input.fullName && !input.email && !input.phone) {
    return Response.json({ ok: false, error: 'missing_match_input' }, { status: 400 });
  }

  const out = matchLicensedAgent(input);
  return Response.json({ ok: true, ...out });
}
