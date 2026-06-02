'use client';

import { useEffect, useRef, useState } from 'react';

const GOLD = '#d4af37';
const DARK = '#0a0c10';
const LOGO_URL = '/ll-logo-qr.png';

const TITLE_OPTIONS = [
  'Life Insurance Agent',
  'Agency Owner',
  'Regional Director',
  'Legacy Link Agent',
  'Financial Professional',
];

/* ── QR code with transparent logo centered ─────────────────────── */
function QRWithLogo({ url, size = 240 }) {
  // Use higher error correction (H level = 30%) so logo can safely cover center
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(url)}&color=ffffff&bgcolor=000000&qzone=1&ecc=H&format=png`;
  const logoSize = Math.round(size * 0.20); // 20% — readable and visible

  return (
    <div style={{ position: 'relative', width: size, height: size, borderRadius: 14, overflow: 'hidden', background: '#000', flexShrink: 0 }}>
      <img src={qrApiUrl} alt="QR Code" style={{ width: '100%', height: '100%', display: 'block' }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: logoSize, height: logoSize,
        zIndex: 10, pointerEvents: 'none',
        background: '#000',
        borderRadius: '50%',
        padding: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img src={LOGO_URL} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      </div>
    </div>
  );
}

/* ── Card back (left panel — contact info) ───────────────────────── */
export function CardBack({ settings = {} }) {
  const name = [settings.firstName, settings.lastName].filter(Boolean).join(' ') || 'Your Name';
  const title = settings.title || 'Life Insurance Agent';
  const phone = settings.phone || '';
  const email = settings.email || '';
  const city = settings.city || '';
  const state = settings.state || '';
  const location = [city, state].filter(Boolean).join(', ');

  return (
    <div style={{ background: DARK, padding: '28px 28px 28px 28px', color: '#fff', fontFamily: "'Inter','Helvetica Neue',sans-serif", boxSizing: 'border-box', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      {/* Header */}
      <div>
        <div style={{ color: GOLD, fontSize: 9, letterSpacing: 2.5, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
          The Legacy Link
        </div>
        <div style={{ width: 32, height: 1, background: GOLD, marginBottom: 20 }} />
        {/* Name */}
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 6 }}>{name}</div>
        <div style={{ color: GOLD, fontSize: 10, letterSpacing: 2, fontWeight: 600, textTransform: 'uppercase', marginBottom: 28 }}>
          {title}&nbsp;&nbsp;·&nbsp;&nbsp;The Legacy Link
        </div>
        {/* Contact */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
          {phone && <div><span style={{ color: GOLD, fontWeight: 700, marginRight: 12, fontSize: 11 }}>P</span>{phone}</div>}
          {email && <div><span style={{ color: GOLD, fontWeight: 700, marginRight: 12, fontSize: 11 }}>E</span>{email}</div>}
          <div><span style={{ color: GOLD, fontWeight: 700, marginRight: 12, fontSize: 11 }}>W</span>thelegacylink.com</div>
          {location && <div><span style={{ color: 'rgba(255,255,255,0.3)', marginRight: 14, fontSize: 11 }}>·</span>{location}</div>}
        </div>
      </div>
      {/* Bottom: watch the journey */}
      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' }}>Watch the Journey</div>
    </div>
  );
}

/* ── Card front (right panel — QR + join copy) ───────────────────── */
export function CardFront({ refCode, settings = {} }) {
  const scanUrl = `https://innercirclelink.com/api/qr-scan?ref=${encodeURIComponent(refCode || 'member')}`;

  return (
    <div style={{ background: DARK, padding: '24px 28px', color: '#fff', fontFamily: "'Inter','Helvetica Neue',sans-serif", boxSizing: 'border-box', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
      {/* Top label */}
      <div style={{ color: GOLD, fontSize: 9, letterSpacing: 3, fontWeight: 700, textTransform: 'uppercase', alignSelf: 'center' }}>
        Join Free
      </div>
      {/* Copy block */}
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.3px' }}>Earn With Us.</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6, lineHeight: 1.5 }}>
          Licensed or unlicensed welcome.
        </div>
      </div>
      {/* QR */}
      <QRWithLogo url={scanUrl} size={150} />
      {/* Bottom label */}
      <div style={{ color: GOLD, fontSize: 9, letterSpacing: 3, fontWeight: 700, textTransform: 'uppercase' }}>
        Scan to Join
      </div>
    </div>
  );
}

/* ── Full card preview — side by side with gold partial divider ──── */
export function BusinessCardPreview({ refCode, settings = {} }) {
  return (
    <div style={{
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 0,
      borderRadius: 16,
      overflow: 'hidden',
      border: `1px solid rgba(212,175,55,0.25)`,
      boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
      width: '100%',
      maxWidth: 700,
    }}>
      <CardBack settings={settings} />
      {/* Gold partial divider — 60% height, centered vertically */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '20%',
        width: 1,
        height: '60%',
        background: `linear-gradient(to bottom, transparent, ${GOLD}, transparent)`,
        zIndex: 5,
        pointerEvents: 'none',
      }} />
      <CardFront refCode={refCode} settings={settings} />
    </div>
  );
}

/* ── Scan stats ──────────────────────────────────────────────────── */
function ScanStats({ refCode }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!refCode) return;
    fetch(`/api/qr-scan/stats?ref=${encodeURIComponent(refCode)}`).then(r => r.json()).then(setStats).catch(() => {});
  }, [refCode]);

  if (!stats) return null;

  const days = stats.days ? Object.entries(stats.days) : [];
  const maxDay = Math.max(1, ...days.map(([, v]) => v));

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 24, border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16, fontWeight: 600 }}>Scan Activity</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[['Total', stats.total], ['Today', stats.today], ['Mobile', stats.mobile], ['Desktop', stats.desktop]].map(([l, v]) => (
          <div key={l} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: GOLD }}>{v ?? 0}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
      {days.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 8, letterSpacing: 1 }}>LAST 7 DAYS</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48 }}>
            {days.map(([date, count]) => (
              <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{ width: '100%', height: Math.max(3, (count / maxDay) * 40), background: count > 0 ? GOLD : 'rgba(255,255,255,0.08)', borderRadius: 2 }} />
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>{date.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {stats.lastScan && <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Last scan: {new Date(stats.lastScan).toLocaleString()}</div>}
    </div>
  );
}

/* ── Order Cards modal ───────────────────────────────────────────── */
function OrderModal({ refCode, settings = {}, onClose }) {
  const [photoFile, setPhotoFile] = useState(null);
  const [photoEmail, setPhotoEmail] = useState('');
  const [qty, setQty] = useState('250');
  const [submitMode, setSubmitMode] = useState('upload'); // 'upload' | 'email'
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef();

  const submit = async () => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('ref', refCode);
      fd.append('name', [settings.firstName, settings.lastName].filter(Boolean).join(' '));
      fd.append('qty', qty);
      fd.append('submitMode', submitMode);
      if (submitMode === 'email') fd.append('photoEmail', photoEmail);
      if (submitMode === 'upload' && photoFile) fd.append('photo', photoFile);

      await fetch('/api/card-order', { method: 'POST', body: fd });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
  const labelStyle = { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, display: 'block', fontWeight: 600 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#111520', borderRadius: 20, padding: 32, maxWidth: 480, width: '100%', border: `1px solid rgba(212,175,55,0.2)`, boxShadow: '0 24px 60px rgba(0,0,0,0.8)' }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Order Received</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>Our team will follow up with you to confirm details and production timeline.</div>
            <button onClick={onClose} style={{ background: GOLD, color: '#000', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Order Business Cards</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>Professional print · Your card design</div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {/* Quantity */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Quantity</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={qty} onChange={e => setQty(e.target.value)}>
                <option value="100">100 cards</option>
                <option value="250">250 cards</option>
                <option value="500">500 cards</option>
                <option value="1000">1,000 cards</option>
              </select>
            </div>

            {/* Photo */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Professional Photo</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {['upload', 'email'].map(m => (
                  <button key={m} onClick={() => setSubmitMode(m)} style={{ flex: 1, padding: '9px 14px', borderRadius: 10, border: `1px solid ${submitMode === m ? GOLD : 'rgba(255,255,255,0.1)'}`, background: submitMode === m ? `rgba(212,175,55,0.1)` : 'transparent', color: submitMode === m ? GOLD : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {m === 'upload' ? '📎 Upload Photo' : '📧 Email Photo'}
                  </button>
                ))}
              </div>

              {submitMode === 'upload' ? (
                <div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setPhotoFile(e.target.files[0])} />
                  <button onClick={() => fileRef.current.click()} style={{ ...inputStyle, cursor: 'pointer', textAlign: 'left', color: photoFile ? '#fff' : 'rgba(255,255,255,0.3)' }}>
                    {photoFile ? `✓ ${photoFile.name}` : 'Choose photo file...'}
                  </button>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>High-res JPG or PNG. Minimum 600×600px recommended.</div>
                </div>
              ) : (
                <div>
                  <input style={inputStyle} value={photoEmail} onChange={e => setPhotoEmail(e.target.value)} placeholder="Email where you can send your photo" />
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>We&apos;ll email you at this address with instructions for sending your photo.</div>
                </div>
              )}
            </div>

            {/* Photo note */}
            <div style={{ background: 'rgba(212,175,55,0.06)', border: `1px solid rgba(212,175,55,0.15)`, borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              💡 Professional photo editing included free with your order. No photo yet? We&apos;ll follow up to coordinate.
            </div>

            <button onClick={submit} disabled={submitting} style={{ background: GOLD, color: '#000', border: 'none', borderRadius: 10, padding: '13px 28px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Submitting...' : 'Submit Order Request →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Main CardEditor ─────────────────────────────────────────────── */
export function CardEditor({ refCode, profile = {} }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [cardSide, setCardSide] = useState('both'); // 'both' | 'back' | 'front'

  useEffect(() => {
    if (!refCode) return;
    fetch(`/api/card-settings?ref=${encodeURIComponent(refCode)}`)
      .then(r => r.json())
      .then(d => {
        const parts = (profile?.name || '').trim().split(/\s+/);
        setSettings({ firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '', title: 'Life Insurance Agent', phone: '', email: profile?.email || '', city: '', state: '', ...d });
      })
      .catch(() => {
        const parts = (profile?.name || '').trim().split(/\s+/);
        setSettings({ firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '', title: 'Life Insurance Agent', phone: '', email: profile?.email || '', city: '', state: '' });
      });
  }, [refCode, profile?.name, profile?.email]);

  const update = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    await fetch('/api/card-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: refCode, ...settings }) });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  if (!settings) return <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading card...</div>;

  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
  const labelStyle = { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, display: 'block', fontWeight: 600 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter','Helvetica Neue',sans-serif", color: '#fff' }}>

      {/* ── Card Preview header ─────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>Card Preview</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['both', 'Both Sides'], ['back', 'Back'], ['front', 'Front (QR)']].map(([k, lbl]) => (
              <button key={k} onClick={() => setCardSide(k)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${cardSide === k ? GOLD : 'rgba(255,255,255,0.12)'}`, background: cardSide === k ? `rgba(212,175,55,0.12)` : 'transparent', color: cardSide === k ? GOLD : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.5 }}>{lbl}</button>
            ))}
          </div>
          {/* Order button */}
          <button onClick={() => setShowOrder(true)} style={{ background: GOLD, color: '#000', border: 'none', borderRadius: 10, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5 }}>
            Order Cards →
          </button>
        </div>

        {/* Card display */}
        {cardSide === 'both' && <BusinessCardPreview refCode={refCode} settings={settings} />}
        {cardSide === 'back' && (
          <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid rgba(212,175,55,0.25)`, boxShadow: '0 20px 50px rgba(0,0,0,0.7)', maxWidth: 350 }}>
            <CardBack settings={settings} />
          </div>
        )}
        {cardSide === 'front' && (
          <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid rgba(212,175,55,0.25)`, boxShadow: '0 20px 50px rgba(0,0,0,0.7)', maxWidth: 350 }}>
            <CardFront refCode={refCode} settings={settings} />
          </div>
        )}
      </div>

      {/* ── Scan stats ──────────────────────────────────────────── */}
      <ScanStats refCode={refCode} />

      {/* ── Edit fields ─────────────────────────────────────────── */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 24, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20, fontWeight: 600 }}>Customize Your Card</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><label style={labelStyle}>First Name</label><input style={inputStyle} value={settings.firstName} onChange={e => update('firstName', e.target.value)} /></div>
          <div><label style={labelStyle}>Last Name</label><input style={inputStyle} value={settings.lastName} onChange={e => update('lastName', e.target.value)} /></div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Title</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={settings.title} onChange={e => update('title', e.target.value)}>
              {TITLE_OPTIONS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={settings.phone} onChange={e => update('phone', e.target.value)} placeholder="201-555-0100" /></div>
          <div><label style={labelStyle}>Email</label><input style={inputStyle} value={settings.email} onChange={e => update('email', e.target.value)} /></div>
          <div><label style={labelStyle}>City</label><input style={inputStyle} value={settings.city} onChange={e => update('city', e.target.value)} /></div>
          <div><label style={labelStyle}>State</label><input style={{ ...inputStyle }} value={settings.state} onChange={e => update('state', e.target.value)} maxLength={2} /></div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Website (fixed)</label>
          <div style={{ ...inputStyle, color: 'rgba(255,255,255,0.25)', cursor: 'not-allowed' }}>thelegacylink.com</div>
        </div>
        <div style={{ marginTop: 20 }}>
          <button onClick={save} disabled={saving} style={{ background: GOLD, color: '#000', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Card'}
          </button>
        </div>
      </div>

      {/* ── QR link ─────────────────────────────────────────────── */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>Your QR Tracking Link</div>
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: GOLD, fontFamily: 'monospace', wordBreak: 'break-all' }}>
          https://innercirclelink.com/api/qr-scan?ref={refCode}
        </div>
      </div>

      {/* Order modal */}
      {showOrder && <OrderModal refCode={refCode} settings={settings} onClose={() => setShowOrder(false)} />}
    </div>
  );
}

export default CardEditor;
