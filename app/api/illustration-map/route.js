import Tesseract from 'tesseract.js';

function fmtCurrency(v = '') {
  const n = Number(String(v || '').replace(/[^0-9.]/g, ''));
  if (Number.isNaN(n)) return '';
  return n.toFixed(2);
}

function extractState(text = '') {
  const m = String(text).match(/\bSTATE\s*[:\-]?\s*([A-Z]{2})\b/i);
  return m ? m[1].toUpperCase() : '';
}

function extractMonthlyPremium(text = '') {
  const src = String(text || '');
  const m = src.match(/INITIAL\s+PREMIUM\s*[:\-]?\s*\$?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i)
    || src.match(/MONTHLY\s*[:\-]?\s*\$?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i)
    || src.match(/\$\s*([0-9,]+(?:\.[0-9]{1,2})?)\s+MONTHLY/i);
  return m ? fmtCurrency(m[1]) : '';
}

function extractApplicantName(text = '') {
  const src = String(text || '');

  const genderLine = src.match(/(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:Female|Male)\b/m);
  if (genderLine) return genderLine[1].trim();

  const lines = src.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/prepared for|state:|premium|product|coverage|face amount|riders|benefit|female|male/i.test(line)) continue;
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(line)) return line;
  }

  return '';
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return Response.json({ ok: false, error: 'missing_file' }, { status: 400 });
    }

    const ab = await file.arrayBuffer();
    const buffer = Buffer.from(ab);

    const result = await Tesseract.recognize(buffer, 'eng');
    const text = String(result?.data?.text || '');

    const mapped = {
      applicantName: extractApplicantName(text),
      state: extractState(text),
      monthlyPremium: extractMonthlyPremium(text)
    };

    return Response.json({ ok: true, mapped });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'ocr_failed' }, { status: 500 });
  }
}
