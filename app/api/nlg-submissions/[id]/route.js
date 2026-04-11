import { loadJsonStore, saveJsonStore } from '../../../../lib/blobJsonStore';

const STORE_PATH = 'stores/nlg-submissions.json';

function maskSSN(ssn) {
  if (!ssn || ssn.length < 4) return '***-**-XXXX';
  return `***-**-${String(ssn).slice(-4)}`;
}

async function getSubmissions() {
  return await loadJsonStore(STORE_PATH, []);
}

async function saveSubmissions(data) {
  return await saveJsonStore(STORE_PATH, data);
}

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const submissions = await getSubmissions();
    const sub = submissions.find((s) => String(s.id) === String(id));
    if (!sub) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ ...sub, ssn: maskSSN(sub.ssn) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const submissions = await getSubmissions();
    const idx = submissions.findIndex((s) => String(s.id) === String(id));
    if (idx === -1) return Response.json({ error: 'Not found' }, { status: 404 });

    if (body.status && ['pending', 'reviewed'].includes(body.status)) {
      submissions[idx].status = body.status;
    }
    await saveSubmissions(submissions);
    return Response.json({ ...submissions[idx], ssn: maskSSN(submissions[idx].ssn) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    let submissions = await getSubmissions();
    submissions = submissions.filter((s) => String(s.id) !== String(id));
    await saveSubmissions(submissions);
    return new Response(null, { status: 204 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
