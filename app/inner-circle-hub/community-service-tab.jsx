'use client';

import { useEffect, useMemo, useState } from 'react';

function clean(v = '') { return String(v || '').trim(); }
function normName(v = '') { return clean(v).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function nameSig(v = '') {
  const p = normName(v).split(' ').filter(Boolean);
  if (!p.length) return '';
  if (p.length === 1) return p[0];
  return `${p[0]}_${p[p.length - 1]}`;
}

const serviceCategories = [
  { id: 'Food & Shelter', title: 'Food & Shelter', description: 'Soup kitchens, food pantries, homeless shelters', emoji: '🍲' },
  { id: 'Clothing & Essentials', title: 'Clothing & Essentials', description: 'Clothing drives, hygiene kits, donations', emoji: '👕' },
  { id: 'Youth & Education', title: 'Youth & Education', description: 'Tutoring, mentoring, youth programs', emoji: '📚' },
  { id: 'Faith & Community Centers', title: 'Faith & Community Centers', description: 'Religious organizations, community clean-ups', emoji: '⛪' },
  { id: 'Health & Environment', title: 'Health & Environment', description: 'Blood donation, gardens, senior centers', emoji: '🌿' },
  { id: 'Other Meaningful Acts', title: 'Other Meaningful Acts', description: 'Veterans, elderly, disaster relief, coaching', emoji: '🤝' },
  { id: 'Other', title: 'Other', description: 'Custom community service activity', emoji: '➕' }
];

function monthKeyNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key = '') {
  const m = String(key || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return key;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
}

export default function CommunityServiceTab({ member, hubMembers = [], isAdmin = false }) {
  const memberName = clean(member?.applicantName || member?.name || '');
  const memberEmail = clean(member?.email || '').toLowerCase();

  const [rows, setRows] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');

  const [formData, setFormData] = useState({
    month: monthKeyNow(),
    category: '',
    activity_title: '',
    description: '',
    time_spent: 60,
    location_organization: '',
    photos: []
  });

  async function loadRows() {
    if (!memberName && !memberEmail) return;
    setLoading(true);
    try {
      const mineUrl = `/api/community-service?name=${encodeURIComponent(memberName)}&email=${encodeURIComponent(memberEmail)}`;
      const mineRes = await fetch(mineUrl, { cache: 'no-store' });
      const mineData = await mineRes.json().catch(() => ({}));
      if (mineRes.ok && mineData?.ok) setRows(Array.isArray(mineData?.rows) ? mineData.rows : []);
      else setRows([]);

      if (isAdmin) {
        const allRes = await fetch('/api/community-service', { cache: 'no-store' });
        const allData = await allRes.json().catch(() => ({}));
        if (allRes.ok && allData?.ok) setAllRows(Array.isArray(allData?.rows) ? allData.rows : []);
        else setAllRows([]);
      } else {
        setAllRows([]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberName, memberEmail, isAdmin]);

  const currentMonth = monthKeyNow();

  const currentMonthSubmission = useMemo(() => {
    return (rows || []).find((r) => clean(r?.month) === currentMonth);
  }, [rows, currentMonth]);

  const isCurrentMonthComplete = Boolean(
    currentMonthSubmission
    && Number(currentMonthSubmission?.time_spent || 0) >= 60
    && (currentMonthSubmission?.photo_urls || []).length > 0
  );

  const totalHoursThisYear = useMemo(() => {
    const y = new Date().getFullYear();
    return (rows || [])
      .filter((r) => String(r?.month || '').startsWith(`${y}-`))
      .reduce((sum, r) => sum + Math.floor(Number(r?.time_spent || 0) / 60), 0);
  }, [rows]);

  const adminMonthlyReport = useMemo(() => {
    if (!isAdmin) return null;

    const roster = (Array.isArray(hubMembers) ? hubMembers : [])
      .filter((m) => m?.active !== false)
      .map((m) => ({
        name: clean(m?.applicantName || m?.name || ''),
        email: clean(m?.email || '').toLowerCase(),
        sig: nameSig(m?.applicantName || m?.name || '')
      }))
      .filter((m) => m.name || m.email);

    const completeSet = new Set();
    for (const r of (allRows || [])) {
      if (clean(r?.month) !== currentMonth) continue;
      if (Number(r?.time_spent || 0) < 60) continue;
      if (!Array.isArray(r?.photo_urls) || !r.photo_urls.length) continue;
      const em = clean(r?.memberEmail || '').toLowerCase();
      const sig = nameSig(r?.memberName || '');
      if (em) completeSet.add(`e:${em}`);
      if (sig) completeSet.add(`s:${sig}`);
    }

    const completed = [];
    const missing = [];
    for (const m of roster) {
      const isDone = (m.email && completeSet.has(`e:${m.email}`)) || (m.sig && completeSet.has(`s:${m.sig}`));
      if (isDone) completed.push(m);
      else missing.push(m);
    }

    completed.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    missing.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));

    return {
      month: currentMonth,
      total: roster.length,
      completedCount: completed.length,
      missingCount: missing.length,
      completed,
      missing
    };
  }, [isAdmin, hubMembers, allRows, currentMonth]);

  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setNotice('');
    setUploading(true);
    try {
      const payloadFiles = await Promise.all(files.map(async (f) => ({
        filename: f.name,
        contentType: f.type,
        dataUrl: await fileToDataUrl(f)
      })));

      const res = await fetch('/api/community-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upload_photos', files: payloadFiles })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setNotice('Photo upload failed. Please try again.');
        return;
      }

      const urls = Array.isArray(data?.urls) ? data.urls : [];
      setFormData((p) => ({ ...p, photos: [...p.photos, ...urls] }));
      setNotice(`${urls.length} photo(s) uploaded.`);
    } catch {
      setNotice('Photo upload failed. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function validateForm() {
    if (!formData.category) return 'Please select a service category.';
    if (formData.category === 'Other' && !clean(formData.activity_title)) return 'Please provide an activity title.';
    if (!clean(formData.description)) return 'Please provide a description.';
    if (Number(formData.time_spent || 0) < 60) return 'Minimum 60 minutes required.';
    if (!formData.photos.length) return 'Please upload at least one photo as proof.';
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const msg = validateForm();
    if (msg) {
      setNotice(msg);
      return;
    }

    setSubmitting(true);
    setNotice('');
    try {
      const res = await fetch('/api/community-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          memberName,
          memberEmail,
          month: formData.month,
          category: formData.category,
          activity_title: clean(formData.activity_title),
          description: clean(formData.description),
          time_spent: Number(formData.time_spent || 0),
          location_organization: clean(formData.location_organization),
          photo_urls: formData.photos
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setNotice('Could not save community service record.');
        return;
      }

      setFormData({
        month: monthKeyNow(),
        category: '',
        activity_title: '',
        description: '',
        time_spent: 60,
        location_organization: '',
        photos: []
      });
      setShowForm(false);
      setNotice('✅ Community service logged successfully.');
      await loadRows();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', padding: 14 }}>
        <div className="panelRow" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ color: '#fff' }}>Give Back: 1 Hour / Month</strong>
          <span className="pill onpace">Hours this year: {totalHoursThisYear}</span>
        </div>
        <small className="muted">Upload photo proof and submit your monthly service record.</small>
      </div>

      <div style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', padding: 14 }}>
        <strong style={{ color: '#fff' }}>{formatMonthLabel(currentMonth)} Progress</strong>
        {isCurrentMonthComplete ? (
          <div style={{ marginTop: 8, color: '#86efac' }}>✅ Completed ({currentMonthSubmission?.time_spent || 0} minutes)</div>
        ) : (
          <div style={{ marginTop: 8, color: '#fdba74' }}>⏰ Not completed yet (need 60+ mins + photo)</div>
        )}
        <div style={{ marginTop: 10 }}>
          <button type="button" className="publicPrimaryBtn" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Close Form' : 'Log Your Service Hour'}
          </button>
        </div>
      </div>

      {isAdmin && adminMonthlyReport ? (
        <div style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', padding: 14 }}>
          <div className="panelRow" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ color: '#fff' }}>Admin At-a-Glance ({formatMonthLabel(adminMonthlyReport.month)})</strong>
            <span className="pill neutral">Completed: {adminMonthlyReport.completedCount}/{adminMonthlyReport.total}</span>
          </div>
          <small className="muted">Missing this month: {adminMonthlyReport.missingCount}</small>
          <div style={{ display: 'grid', gap: 6, marginTop: 8, maxHeight: 220, overflow: 'auto' }}>
            {(adminMonthlyReport.missing || []).slice(0, 150).map((m) => (
              <small key={`${m.email}-${m.name}`} className="muted">• {m.name || m.email}{m.email ? ` (${m.email})` : ''}</small>
            ))}
            {!(adminMonthlyReport.missing || []).length ? <small className="muted">Everyone is complete for this month 🎉</small> : null}
          </div>
        </div>
      ) : null}

      {showForm ? (
        <div style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', padding: 14 }}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ color: '#cbd5e1', fontSize: 13 }}>Service Category *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginTop: 8 }}>
                {serviceCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, category: cat.id }))}
                    style={{
                      textAlign: 'left',
                      padding: 10,
                      borderRadius: 10,
                      border: formData.category === cat.id ? '2px solid #60a5fa' : '1px solid #334155',
                      background: formData.category === cat.id ? '#0f172a' : '#111827',
                      color: '#e2e8f0'
                    }}
                  >
                    <div>{cat.emoji} <strong>{cat.title}</strong></div>
                    <small style={{ color: '#94a3b8' }}>{cat.description}</small>
                  </button>
                ))}
              </div>
            </div>

            {formData.category === 'Other' ? (
              <div>
                <label style={{ color: '#cbd5e1', fontSize: 13 }}>Activity Title *</label>
                <input value={formData.activity_title} onChange={(e) => setFormData((p) => ({ ...p, activity_title: e.target.value }))} style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', width: '100%' }} />
              </div>
            ) : null}

            <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ color: '#cbd5e1', fontSize: 13 }}>Time Spent (minutes) *</label>
                <input type="number" min="60" value={formData.time_spent} onChange={(e) => setFormData((p) => ({ ...p, time_spent: Number(e.target.value || 60) }))} style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', width: '100%' }} />
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label style={{ color: '#cbd5e1', fontSize: 13 }}>Location / Organization</label>
                <input value={formData.location_organization} onChange={(e) => setFormData((p) => ({ ...p, location_organization: e.target.value }))} style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', width: '100%' }} />
              </div>
            </div>

            <div>
              <label style={{ color: '#cbd5e1', fontSize: 13 }}>Description *</label>
              <textarea value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', minHeight: 90, width: '100%' }} />
            </div>

            <div>
              <label style={{ color: '#cbd5e1', fontSize: 13 }}>Photo Proof * ({formData.photos.length})</label>
              <div style={{ marginTop: 8 }}>
                <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} disabled={uploading} />
                {uploading ? <small className="muted"> Uploading...</small> : null}
              </div>
              {formData.photos.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
                  {formData.photos.map((u, i) => <img key={`${u}-${i}`} src={u} alt={`proof-${i + 1}`} style={{ width: '100%', height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #334155' }} />)}
                </div>
              ) : null}
            </div>

            <div className="panelRow" style={{ gap: 8 }}>
              <button type="button" className="ghost" onClick={() => setShowForm(false)} disabled={submitting}>Cancel</button>
              <button type="submit" className="publicPrimaryBtn" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Service Record'}</button>
            </div>
            {notice ? <small className="muted" style={{ color: notice.includes('✅') ? '#86efac' : '#fca5a5' }}>{notice}</small> : null}
          </form>
        </div>
      ) : null}

      <div style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', padding: 14 }}>
        <strong style={{ color: '#fff' }}>Service History</strong>
        {loading ? <small className="muted"> Loading...</small> : null}
        {!loading && !(rows || []).length ? <small className="muted"> No community service logged yet.</small> : null}

        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          {(rows || []).map((s) => (
            <div key={s.id} style={{ border: '1px solid #334155', borderRadius: 10, background: '#111827', padding: 10 }}>
              <div className="panelRow" style={{ justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ color: '#fff' }}>{formatMonthLabel(s.month)}</strong>
                <span className="pill onpace">Logged</span>
              </div>
              <div style={{ color: '#e2e8f0', marginTop: 6 }}>{s.category}{s.activity_title ? ` — ${s.activity_title}` : ''}</div>
              <small className="muted">⏱ {s.time_spent} min{s.location_organization ? ` • 📍 ${s.location_organization}` : ''}</small>
              <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 6 }}>{s.description}</div>
              {(s.photo_urls || []).length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
                  {s.photo_urls.map((u, i) => <img key={`${s.id}-${i}`} src={u} alt={`photo-${i + 1}`} style={{ width: '100%', height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #334155' }} />)}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
