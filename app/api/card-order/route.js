import { saveJsonFile, loadJsonFile } from '../../../lib/blobJsonStore';
import { put } from '@vercel/blob';

export const dynamic = 'force-dynamic';

function clean(v) { return String(v || '').trim(); }

export async function POST(req) {
  try {
    const formData = await req.formData();
    const ref         = clean(formData.get('ref') || formData.get('name')).toLowerCase().replace(/\s+/g, '_');
    const name        = clean(formData.get('name'));
    const qty         = clean(formData.get('qty') || '500');
    const submitMode  = clean(formData.get('submitMode') || 'upload');
    const email       = clean(formData.get('email'));
    const phone       = clean(formData.get('phone'));
    const shippingAddress = clean(formData.get('shippingAddress'));
    const photoEmail  = clean(formData.get('photoEmail'));

    if (!ref) return Response.json({ ok: false, error: 'missing_ref' }, { status: 400 });

    // Upload photo to Vercel Blob if provided
    let photoUrl = '';
    const photoFile = formData.get('photo');
    if (submitMode === 'upload' && photoFile && photoFile.size > 0) {
      try {
        const ext = (photoFile.name || 'photo.jpg').split('.').pop().replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
        const blob = await put(`card-order-photos/${ref}_${Date.now()}.${ext}`, photoFile, {
          access: 'public',
          contentType: photoFile.type || 'image/jpeg',
        });
        photoUrl = blob.url;
      } catch (uploadErr) {
        console.error('Photo upload failed:', uploadErr);
        // Don't block the order — flag it so admin knows
        photoUrl = '';
      }
    }

    const orders = (await loadJsonFile('card-orders/v1.json', [])) || [];
    const existingIdx = orders.findIndex(o => clean(o?.ref) === ref);

    const record = {
      ref,
      name,
      qty,
      submitMode,
      email,
      phone,
      shippingAddress,
      photoEmail: submitMode === 'email' ? photoEmail : '',
      photoUrl,
      hasPhoto: submitMode === 'upload' ? (!!photoUrl) : false,
      submittedAt: existingIdx >= 0 ? (orders[existingIdx].submittedAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: existingIdx >= 0 ? orders[existingIdx].status : 'pending',
    };

    if (existingIdx >= 0) {
      orders[existingIdx] = { ...orders[existingIdx], ...record };
    } else {
      orders.unshift(record);
    }

    await saveJsonFile('card-orders/v1.json', orders);
    return Response.json({ ok: true, order: record });
  } catch (e) {
    console.error('card-order POST error:', e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
