'use client';

import { useEffect, useRef, useState } from 'react';

const GOLD = '#d4af37';
const DARK = '#0a0c10';
const LOGO_URL = '/legacy-link-seal.png';

const TITLE_OPTIONS = [
  'Life Insurance Agent',
  'Agency Owner',
  'Regional Director',
  'Legacy Link Agent',
  'Financial Professional',
];

function QRWithLogo({ url, size = 240 }) {
  // qzone=2 adds quiet zone so QR modules don't crowd the center logo
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(url)}&color=ffffff&bgcolor=000000&qzone=2&format=png`;
  const logoSize = Math.round(size * 0.28);
  return (
    <div style={{
      position: 'relative',
      width: size,
      height: size,
      borderRadius: 16,
      overflow: 'hidden',
      background: '#000',
      flexShrink: 0,
    }}>
      {/* QR code */}
      <img
        src={qrApiUrl}
        alt="QR Code"
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {/* Logo — absolutely centered, no clip needed (image is already circular) */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: logoSize,
        height: logoSize,
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        <img
          src={LOGO_URL}
          alt="Legacy Link"
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </div>
  );
}

export function CardBack({ settings = {}, preview = false }) {
  const name = [settings.firstName, settings.lastName].filter(Boolean).join(' ') || 'Your Name';
  const title = settings.title || 'Life Insurance Agent';
  const phone = settings.phone || '';
  const email = settings.email || '';
  const city = settings.city || '';
  const state = settings.state || '';
  const location = [city, state].filter(Boolean).join(', ');

  const style = {
    background: DARK,
    borderRadius: preview ? 0 : 16,
    padding: '32px 28px',
    color: '#fff',
    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    width: '100%',
    boxSizing: 'border-box',
    minHeight: preview ? 'auto' : 220,
  };

  return (
    <div style={style}>
      <div style={{ color: GOLD, fontSize: 10, letterSpacing: 2, fontWeight: 700, marginBottom: 20, textTransform: 'uppercase' }}>
        Income Opportunity&nbsp;&nbsp;/&nbsp;&nbsp;Join the Team
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 4, lineHeight: 1.1 }}>{name}</div>
      <div style={{ color: GOLD, fontSize: 11, letterSpacing: 2, fontWeight: 600, textTransform: 'uppercase', marginBottom: 24 }}>
        {title}&nbsp;&nbsp;·&nbsp;&nbsp;The Legacy Link
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
        {phone && <div><span style={{ color: GOLD, fontWeight: 700, marginRight: 10 }}>P</span>{phone}</div>}
        {email && <div><span style={{ color: GOLD, fontWeight: 700, marginRight: 10 }}>E</span>{email}</div>}
        <div><span style={{ color: GOLD, fontWeight: 700, marginRight: 10 }}>W</span>thelegacylink.com</div>
        {location && <div><span style={{ color: 'rgba(255,255,255,0.3)', marginRight: 10 }}>·</span>{location}</div>}
      </div>
    </div>
  );
}

export function CardFront({ refCode, settings = {}, preview = false }) {
  const scanUrl = `https://innercirclelink.com/api/qr-scan?ref=${encodeURIComponent(refCode || 'member')}`;

  const style = {
    background: DARK,
    borderRadius: preview ? 0 : 16,
    padding: '28px 28px',
    color: '#fff',
    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
    minHeight: preview ? 'auto' : 220,
  };

  return (
    <div style={style}>
      <div style={{ color: GOLD, fontSize: 9, letterSpacing: 3, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10, alignSelf: 'flex-start' }}>
        Join Free
      </div>
      <div style={{ alignSelf: 'flex-start', marginBottom: 6 }}>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.15 }}>Earn</div>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.15 }}>With Us.</div>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 18, alignSelf: 'flex-start' }}>
        Licensed or unlicensed welcome.
      </div>
      <QRWithLogo url={scanUrl} size={160} />
      <div style={{ color: GOLD, fontSize: 9, letterSpacing: 3, fontWeight: 700, textTransform: 'uppercase', marginTop: 12 }}>
        Scan to Join
      </div>
    </div>
  );
}

// Full card preview side-by-side
export function BusinessCardPreview({ refCode, settings = {} }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 0,
      borderRadius: 16,
      overflow: 'hidden',
      border: `1px solid rgba(212,175,55,0.2)`,
      boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
      width: '100%',
      maxWidth: 740,
    }}>
      <CardBack settings={settings} preview />
      <CardFront refCode={refCode} settings={settings} preview />
    </div>
  );
}

// Stats widget
function ScanStats({ refCode }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!refCode) return;
    fetch(`/api/qr-scan/stats?ref=${encodeURIComponent(refCode)}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [refCode]);

  if (!stats) return null;

  const days = stats.days ? Object.entries(stats.days) : [];
  const maxDay = Math.max(1, ...days.map(([, v]) => v));

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: '24px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16, fontWeight: 600 }}>
        Scan Activity
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Scans', value: stats.total },
          { label: 'Today', value: stats.today },
          { label: 'Mobile', value: stats.mobile },
          { label: 'Desktop', value: stats.desktop },
        ].map(({ label, value }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: GOLD }}>{value ?? 0}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
      {days.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 8, letterSpacing: 1 }}>LAST 7 DAYS</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48 }}>
            {days.map(([date, count]) => (
              <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{
                  width: '100%',
                  height: Math.max(3, (count / maxDay) * 40),
                  background: count > 0 ? GOLD : 'rgba(255,255,255,0.08)',
                  borderRadius: 2,
                  transition: 'height 0.3s',
                }} />
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>{date.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {stats.lastScan && (
        <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
          Last scan: {new Date(stats.lastScan).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// Card Editor — embedded in back office
export function CardEditor({ refCode, profile = {}, onSaved }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoRequesting, setPhotoRequesting] = useState(false);

  useEffect(() => {
    if (!refCode) return;
    fetch(`/api/card-settings?ref=${encodeURIComponent(refCode)}`)
      .then((r) => r.json())
      .then((d) => {
        const nameParts = (profile?.name || '').trim().split(/\s+/);
        setSettings({
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          title: 'Life Insurance Agent',
          phone: '',
          email: profile?.email || '',
          city: '',
          state: '',
          photoUrl: '',
          ...d,
        });
      })
      .catch(() => {
        const nameParts = (profile?.name || '').trim().split(/\s+/);
        setSettings({
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          title: 'Life Insurance Agent',
          phone: '',
          email: profile?.email || '',
          city: '',
          state: '',
          photoUrl: '',
        });
      });
  }, [refCode, profile?.name, profile?.email]);

  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const save = async () => {
    setSaving(true);
    await fetch('/api/card-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: refCode, ...settings }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    if (onSaved) onSaved(settings);
  };

  const requestPhoto = async () => {
    setPhotoRequesting(true);
    await fetch('/api/card-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: refCode, ...settings, photoRequested: true }),
    });
    setPhotoRequesting(false);
    alert('Professional photo request sent! Our team will follow up with you.');
  };

  if (!settings) return <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading card settings...</div>;

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#fff',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  const labelStyle = {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
    display: 'block',
    fontWeight: 600,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Card Preview */}
      <div>
        <div style={{ ...labelStyle, marginBottom: 14 }}>Card Preview</div>
        <BusinessCardPreview refCode={refCode} settings={settings} />
      </div>

      {/* Scan Stats */}
      <ScanStats refCode={refCode} />

      {/* Edit Fields */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 24, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20, fontWeight: 600 }}>
          Customize Your Card
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={labelStyle}>First Name</label>
            <input style={inputStyle} value={settings.firstName} onChange={(e) => update('firstName', e.target.value)} placeholder="First" />
          </div>
          <div>
            <label style={labelStyle}>Last Name</label>
            <input style={inputStyle} value={settings.lastName} onChange={(e) => update('lastName', e.target.value)} placeholder="Last" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Title</label>
            <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} value={settings.title} onChange={(e) => update('title', e.target.value)}>
              {TITLE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} value={settings.phone} onChange={(e) => update('phone', e.target.value)} placeholder="e.g. 201-555-0100" />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} value={settings.email} onChange={(e) => update('email', e.target.value)} placeholder="you@email.com" />
          </div>
          <div>
            <label style={labelStyle}>City</label>
            <input style={inputStyle} value={settings.city} onChange={(e) => update('city', e.target.value)} placeholder="e.g. Austin" />
          </div>
          <div>
            <label style={labelStyle}>State</label>
            <input style={inputStyle} value={settings.state} onChange={(e) => update('state', e.target.value)} placeholder="e.g. TX" maxLength={2} />
          </div>
        </div>

        {/* Website — locked */}
        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Website (fixed)</label>
          <div style={{ ...inputStyle, color: 'rgba(255,255,255,0.3)', cursor: 'not-allowed' }}>thelegacylink.com</div>
        </div>

        {/* Photo section */}
        <div style={{ marginTop: 20, padding: 16, background: 'rgba(212,175,55,0.05)', borderRadius: 12, border: '1px solid rgba(212,175,55,0.15)' }}>
          <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginBottom: 6 }}>Professional Photo</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 14, lineHeight: 1.5 }}>
            Add a professional headshot to your card. We&apos;ll handle the editing and polish.
            Included free when you order physical cards — or request it standalone.
          </div>
          <button
            onClick={requestPhoto}
            disabled={photoRequesting || settings.photoRequested}
            style={{
              background: settings.photoRequested ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.15)',
              border: `1px solid ${GOLD}`,
              color: GOLD,
              borderRadius: 10,
              padding: '9px 18px',
              fontSize: 12,
              fontWeight: 600,
              cursor: settings.photoRequested ? 'default' : 'pointer',
              letterSpacing: 0.5,
            }}
          >
            {settings.photoRequested ? '✓ Photo Requested — Team Will Follow Up' : photoRequesting ? 'Requesting...' : 'Request Professional Photo →'}
          </button>
        </div>

        {/* Save */}
        <div style={{ marginTop: 20 }}>
          <button
            onClick={save}
            disabled={saving}
            style={{
              background: GOLD,
              color: '#000',
              border: 'none',
              borderRadius: 10,
              padding: '12px 28px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: 0.5,
              transition: 'opacity 0.2s',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Card'}
          </button>
        </div>
      </div>

      {/* QR Link */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>
          Your QR Tracking Link
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8, lineHeight: 1.6 }}>
          This is the URL embedded in your QR code. Every scan is counted and tracked here.
        </div>
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 12,
          color: GOLD,
          fontFamily: 'monospace',
          wordBreak: 'break-all',
        }}>
          https://innercirclelink.com/api/qr-scan?ref={refCode}
        </div>
      </div>

    </div>
  );
}

export default CardEditor;
