import { loadJsonStore } from '../../../lib/blobJsonStore';

const APPS_PATH = 'stores/sponsorship-applications.json';
const POLICY_PATH = 'stores/policy-submissions.json';

function normalizeEmail(v = '') {
  return String(v || '').trim().toLowerCase();
}

function normalizePhone(v = '') {
  return String(v || '').replace(/\D/g, '');
}

export async function GET() {
  const [apps, policies] = await Promise.all([
    loadJsonStore(APPS_PATH, []),
    loadJsonStore(POLICY_PATH, [])
  ]);

  // Build submitted email/phone sets from policy submissions
  const submittedEmails = new Set();
  const submittedPhones = new Set();

  for (const p of (Array.isArray(policies) ? policies : [])) {
    const email = normalizeEmail(p?.applicantEmail || p?.applicant_email || p?.email || '');
    const phone = normalizePhone(p?.applicantPhone || p?.applicant_phone || p?.phone || '');
    if (email) submittedEmails.add(email);
    if (phone) submittedPhones.add(phone);
  }

  // Filter: approved status + no policy submission
  const approved = (Array.isArray(apps) ? apps : []).filter(r =>
    String(r?.status || '').toLowerCase().includes('approved')
  );

  const noApp = approved.filter(r => {
    const email = normalizeEmail(r?.email || '');
    const phone = normalizePhone(r?.phone || '');
    const hasEmail = email && submittedEmails.has(email);
    const hasPhone = phone && submittedPhones.has(phone);
    return !hasEmail && !hasPhone;
  });

  const list = noApp.map(r => ({
    firstName: String(r?.firstName || '').trim(),
    lastName: String(r?.lastName || '').trim(),
    email: String(r?.email || '').trim(),
    phone: normalizePhone(r?.phone || ''),
    state: String(r?.state || '').trim(),
    submittedAt: r?.submitted_at || r?.submittedAt || ''
  }));

  return Response.json({
    ok: true,
    totalApproved: approved.length,
    noAppCount: noApp.length,
    list
  });
}
