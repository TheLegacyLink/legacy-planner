import { saveJsonFile, loadJsonFile } from '../../../lib/blobJsonStore';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const ref = String(formData.get('ref') || '').trim();
    const name = String(formData.get('name') || '').trim();
    const qty = String(formData.get('qty') || '250');
    const submitMode = String(formData.get('submitMode') || 'upload');
    const photoEmail = String(formData.get('photoEmail') || '').trim();

    const order = {
      ref, name, qty, submitMode,
      photoEmail: submitMode === 'email' ? photoEmail : '',
      hasPhoto: submitMode === 'upload' && formData.get('photo') != null,
      submittedAt: new Date().toISOString(),
      status: 'pending',
    };

    const orders = (await loadJsonFile('card-orders/v1.json', [])) || [];
    orders.push(order);
    await saveJsonFile('card-orders/v1.json', orders);

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
