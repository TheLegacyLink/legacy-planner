'use client';

import { useEffect, useMemo, useState } from 'react';

const LICENSED_TOKEN_KEY = 'licensed_backoffice_token';
const UNLICENSED_TOKEN_KEY = 'unlicensed_backoffice_token';
const INNER_SESSION_KEY = 'inner_circle_hub_member_v1';

function clean(v = '') { return String(v || '').trim(); }

const CATEGORY_OPTIONS = [
  'Mentorship',
  'Financial Literacy',
  'School/Youth Support',
  'Community Cleanup',
  'Food/Donation Drive',
  'Faith/Nonprofit Service',
  'Other'
];

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CommunityServicePage() {
  const [identity, setIdentity] = useState({ name: '', email: '', source: '' });
  const [homeHref, setHomeHref] = useState('/');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [category, setCategory] = useState('Mentorship');
  const [activityTitle, setActivityTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeSpent, setTimeSpent] = useState(60);
  const [locationOrg, setLocationOrg] = useState('');
  const [files, setFiles] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function resolveIdentity() {
      let licensed = null;
      let unlicensed = null;
      let inner = null;

      if (typeof window !== 'undefined') {
        try {
          const qp = new URLSearchParams(window.location.search || '');
          const h = clean(qp.get('home') || '');
          if (h && h.startsWith('/')) setHomeHref(h);
        } catch {}

        try {
          const token = clean(window.localStorage.getItem(LICENSED_TOKEN_KEY) || '');
          if (token) {
            const res = await fetch('/api/licensed-backoffice/auth/me', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
            const data = res.ok ? await res.json().catch(() => ({})) : {};
            if (data?.ok && data?.profile) licensed = data.profile;
          }
        } catch {}

        try {
          const ut = clean(window.localStorage.getItem(UNLICENSED_TOKEN_KEY) || '');
          if (ut) {
            const res = await fetch('/api/unlicensed-backoffice/auth/me', { headers: { Authorization: `Bearer ${ut}` }, cache: 'no-store' });
            const data = res.ok ? await res.json().catch(() => ({})) : {};
            if (data?.ok && data?.profile) unlicensed = data.profile;
          }
        } catch {}

        try {
          const localInner = JSON.parse(window.localStorage.getItem(INNER_SESSION_KEY) || 'null');
          if (localInner?.active) inner = localInner;
        } catch {}
      }

      if (licensed?.name) return { name: clean(licensed.name), email: clean(licensed.email || '').toLowerCase(), source: 'licensed' };
      if (unlicensed?.name) return { name: clean(unlicensed.name), email: clean(unlicensed.email || '').toLowerCase(), source: 'unlicensed' };
      if (inner?.applicantName || inner?.name) return { name: clean(inner.applicantName || inner.name), email: clean(inner.email || '').toLowerCase(), source: 'inner' };
      return null;
    }

    async function load() {
      setLoading(true);
      setMsg('');
      const who = await resolveIdentity();
      if (!mounted) return;

      if (!who) {
        setIdentity({ name: '', email: '', source: '' });
        setRows([]);
        setLoading(false);
        setMsg('Please sign in through your back office to access Community Service.');
        return;
      }

      setIdentity(who);

      try {
        const q = who.email ? `email=${encodeURIComponent(who.email)}` : `name=${encodeURIComponent(who.name)}`;
        const res = await fetch(`/api/community-service?${q}`, { cache: 'no-store' });
        const data = res.ok ? await res.json().catch(() => ({})) : {};
        setRows(Array.isArray(data?.rows) ? data.rows : []);
      } catch {
        setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  const monthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  async function submit() {
    if (!identity?.name && !identity?.email) {
      setMsg('Please sign in first.');
      return;
    }

    if (!description.trim()) {
      setMsg('Please add a short description.');
      return;
    }

    if (Number(timeSpent || 0) < 60) {
      setMsg('Minimum service entry is 60 minutes.');
      return;
    }

    if (!files.length) {
      setMsg('Please upload at least 1 photo proof.');
      return;
    }

    setSaving(true);
    setMsg('');

    try {
      const uploadFiles = await Promise.all(files.slice(0, 8).map(async (f) => ({
        filename: f.name,
        contentType: f.type || 'image/jpeg',
        dataUrl: await fileToDataUrl(f)
      })));

      const upRes = await fetch('/api/community-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upload_photos', files: uploadFiles })
      });
      const upJson = await upRes.json().catch(() => ({}));
      if (!upRes.ok || !upJson?.ok || !Array.isArray(upJson?.urls)) {
        setMsg(`Upload failed: ${upJson?.error || 'unknown_error'}`);
        return;
      }

      const createRes = await fetch('/api/community-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          memberName: identity.name,
          memberEmail: identity.email,
          month: monthKey,
          category,
          activity_title: activityTitle,
          description,
          time_spent: Number(timeSpent || 0),
          location_organization: locationOrg,
          photo_urls: upJson.urls
        })
      });
      const createJson = await createRes.json().catch(() => ({}));
      if (!createRes.ok || !createJson?.ok) {
        setMsg(`Save failed: ${createJson?.error || 'unknown_error'}`);
        return;
      }

      setRows((prev) => [createJson.row, ...prev]);
      setActivityTitle('');
      setDescription('');
      setTimeSpent(60);
      setLocationOrg('');
      setFiles([]);
      setMsg('Community service logged successfully.');

      // Auto-complete the communityService sprint step for unlicensed agents
      if (identity?.source === 'unlicensed') {
        try {
          const ut = typeof window !== 'undefined' ? clean(window.localStorage.getItem(UNLICENSED_TOKEN_KEY) || '') : '';
          if (ut) {
            // Get current progress first so we don't overwrite existing steps
            const progRes = await fetch('/api/unlicensed-backoffice/progress', {
              headers: { Authorization: `Bearer ${ut}` },
              cache: 'no-store'
            });
            const progData = progRes.ok ? await progRes.json().catch(() => ({})) : {};
            const existingSteps = progData?.progress?.steps || {};
            const existingFields = progData?.progress?.fields || {};
            await fetch('/api/unlicensed-backoffice/progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ut}` },
              body: JSON.stringify({
                steps: { ...existingSteps, communityService: true },
                fields: existingFields
              })
            });
          }
        } catch {}
      }
    } catch {
      setMsg('Could not save entry right now.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#070b14', color: '#E5E7EB', padding: 18 }}>
      <section style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href={homeHref} className="ghost" style={{ textDecoration: 'none' }}>Home</a>
            <span className="pill neutral">Community Service</span>
            <span className="pill neutral">Signed in: {identity.name || '—'}</span>
          </div>
          <h2 style={{ marginBottom: 4 }}>Community Service Tracker</h2>
          <p className="muted" style={{ margin: 0 }}>Log verified hours with photo proof. Minimum 60 minutes per entry.</p>
        </div>

        <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14, display: 'grid', gap: 10 }}>
          <h3 style={{ marginTop: 0 }}>Add Service Entry</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <small className="muted">Category</small>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <small className="muted">Minutes</small>
              <input type="number" min={60} step={15} value={timeSpent} onChange={(e) => setTimeSpent(e.target.value)} />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 4 }}>
            <small className="muted">Activity Title (optional)</small>
            <input value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} placeholder="Food drive, mentorship session, etc." />
          </label>

          <label style={{ display: 'grid', gap: 4 }}>
            <small className="muted">Description</small>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What did you do and who did it impact?" />
          </label>

          <label style={{ display: 'grid', gap: 4 }}>
            <small className="muted">Location / Organization (optional)</small>
            <input value={locationOrg} onChange={(e) => setLocationOrg(e.target.value)} placeholder="Organization or location" />
          </label>

          <label style={{ display: 'grid', gap: 4 }}>
            <small className="muted">Photo Proof (required, up to 8)</small>
            <input type="file" multiple accept="image/*" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            <small className="muted">Selected: {files.length}</small>
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Log Community Service'}</button>
          </div>

          {msg ? <small className="muted">{msg}</small> : null}
        </div>

        <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>My Recent Entries</h3>
          {loading ? <p className="muted">Loading…</p> : null}
          {!loading && !rows.length ? <p className="muted">No entries yet.</p> : null}
          <div style={{ display: 'grid', gap: 8 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#020617' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{r.category || 'Service'}</strong>
                  <small className="muted">{Number(r.time_spent || 0)} min</small>
                </div>
                <small className="muted">{r.activity_title || '—'} • {r.location_organization || '—'}</small>
                <p style={{ margin: '6px 0 0' }}>{r.description || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
