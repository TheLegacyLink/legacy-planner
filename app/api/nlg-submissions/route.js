import { loadJsonStore, saveJsonStore } from '../../../lib/blobJsonStore';

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

function pruneOld(submissions) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return submissions.filter((s) => new Date(s.created_at).getTime() > cutoff);
}

export async function GET() {
  try {
    let submissions = await getSubmissions();
    submissions = pruneOld(submissions);
    const masked = submissions.map((s) => ({ ...s, ssn: maskSSN(s.ssn) }));
    return Response.json(masked);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    let submissions = await getSubmissions();
    submissions = pruneOld(submissions);

    const newSub = {
      id: Date.now(),
      status: 'pending',
      created_at: new Date().toISOString(),
      carrier: 'National Life Group',
      ...body,
    };

    submissions.push(newSub);
    await saveSubmissions(submissions);

    return Response.json({ ...newSub, ssn: maskSSN(newSub.ssn) }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
