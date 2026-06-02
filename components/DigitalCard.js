'use client';

import { useEffect, useRef, useState } from 'react';

const GOLD = '#d4af37';
const DARK = '#0a0c10';
const LOGO_URL = '/ll-logo-qr.png';

const TITLE_OPTIONS = [
  'Life Insurance Agent','Agency Owner','Regional Director',
  'Legacy Link Agent','Financial Professional',
];

/* ── QR with logo overlay ────────────────────────────────────────── */
function QRWithLogo({ url, size = 200 }) {
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size*2}x${size*2}&data=${encodeURIComponent(url)}&color=ffffff&bgcolor=000000&qzone=1&ecc=H&format=png`;
  const logoSize = Math.round(size * 0.20);
  return (
    <div style={{ position:'relative', width:size, height:size, borderRadius:12, overflow:'hidden', background:'#000', flexShrink:0 }}>
      <img src={qrApiUrl} alt="QR" style={{ width:'100%', height:'100%', display:'block' }} />
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:logoSize, height:logoSize, zIndex:10, pointerEvents:'none', background:'#000', borderRadius:'50%', padding:3, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <img src={LOGO_URL} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
      </div>
    </div>
  );
}

/* ── FRONT of card ── The Insurance Game layout + photo ──────────── */
export function CardFront({ settings = {} }) {
  return (
    <div style={{ background: DARK, color:'#fff', fontFamily:"'Inter','Helvetica Neue',sans-serif", boxSizing:'border-box', display:'flex', width:'100%', height:'100%', position:'relative', overflow:'hidden', minHeight:220 }}>
      {/* Left: text block */}
      <div style={{ flex:'0 0 58%', padding:'26px 24px', display:'flex', flexDirection:'column', justifyContent:'center', gap:0, zIndex:2 }}>
        <div style={{ color:GOLD, fontSize:9, letterSpacing:2.5, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>The Legacy Link</div>
        <div style={{ width:28, height:1, background:GOLD, marginBottom:14 }} />
        <div style={{ fontSize:22, fontWeight:700, lineHeight:1.2, letterSpacing:'-0.3px', marginBottom:8 }}>
          The Insurance<br/>Game, Uncensored.
        </div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', lineHeight:1.6, marginBottom:14 }}>
          Real numbers. Real agents. Real talk.<br/>New videos weekly.
        </div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:7, background:GOLD, borderRadius:999, padding:'6px 14px', width:'fit-content' }}>
          <span style={{ fontSize:9 }}>▶</span>
          <span style={{ fontSize:10, fontWeight:700, color:'#000', letterSpacing:0.3 }}>youtube.com/@thelegacylink</span>
        </div>
      </div>

      {/* Right: photo placeholder */}
      <div style={{ flex:'1', position:'relative', overflow:'hidden' }}>
        {/* Blurred photo of Kimora as background */}
        <img
          src="/kimora-card-photo-blurred.jpg"
          alt=""
          style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', display:'block', filter:'blur(3px)', transform:'scale(1.05)' }}
        />
        {/* Dark overlay */}
        <div style={{ position:'absolute', inset:0, background:'rgba(10,12,16,0.55)' }} />
        {/* "Your image here" message */}
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', padding:'0 12px 18px', textAlign:'center' }}>
          <div style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', borderRadius:8, padding:'7px 12px', border:`1px solid rgba(212,175,55,0.3)` }}>
            <div style={{ color:GOLD, fontSize:9, letterSpacing:1.5, fontWeight:700, textTransform:'uppercase' }}>Your professional image will be here</div>
          </div>
        </div>
        {/* Left fade gradient */}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right, rgba(10,12,16,0.9) 0%, transparent 40%)' }} />
      </div>
    </div>
  );
}

/* ── BACK of card ── Contact info (left) + QR (right) ───────────── */
export function CardBack({ settings = {}, refCode = '' }) {
  const name = [settings.firstName, settings.lastName].filter(Boolean).join(' ') || 'Your Name';
  const title = settings.title || 'Life Insurance Agent';
  const phone = settings.phone || '';
  const email = settings.email || '';
  const city = settings.city || '';
  const state = settings.state || '';
  const location = [city, state].filter(Boolean).join(', ');
  const scanUrl = `https://innercirclelink.com/api/qr-scan?ref=${encodeURIComponent(refCode || 'member')}`;

  return (
    <div style={{ display:'flex', width:'100%', position:'relative', background:DARK, fontFamily:"'Inter','Helvetica Neue',sans-serif", color:'#fff', minHeight:220 }}>
      {/* Contact side */}
      <div style={{ flex:'1', padding:'26px 24px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
        <div style={{ color:GOLD, fontSize:9, letterSpacing:2.5, fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>The Legacy Link</div>
        <div style={{ width:28, height:1, background:GOLD, marginBottom:18 }} />
        <div style={{ fontSize:26, fontWeight:700, letterSpacing:'-0.5px', lineHeight:1.1, marginBottom:5 }}>{name}</div>
        <div style={{ color:GOLD, fontSize:9, letterSpacing:2, fontWeight:600, textTransform:'uppercase', marginBottom:22 }}>
          {title}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:9, fontSize:12, color:'rgba(255,255,255,0.8)' }}>
          {phone && <div><span style={{ color:GOLD, fontWeight:700, marginRight:12, fontSize:10 }}>P</span>{phone}</div>}
          {email && <div><span style={{ color:GOLD, fontWeight:700, marginRight:12, fontSize:10 }}>E</span>{email}</div>}
          <div><span style={{ color:GOLD, fontWeight:700, marginRight:12, fontSize:10 }}>W</span>thelegacylink.com</div>
          {location && <div><span style={{ color:'rgba(255,255,255,0.25)', marginRight:14 }}>·</span>{location}</div>}
        </div>
      </div>

      {/* Gold partial divider */}
      <div style={{ position:'absolute', left:'50%', top:'15%', width:1, height:'70%', background:`linear-gradient(to bottom, transparent, ${GOLD}, transparent)`, zIndex:5, pointerEvents:'none' }} />

      {/* QR side */}
      <div style={{ flex:'1', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between', padding:'24px 20px' }}>
        <div style={{ color:GOLD, fontSize:9, letterSpacing:3, fontWeight:700, textTransform:'uppercase' }}>Join Free</div>
        <div style={{ textAlign:'center', margin:'8px 0' }}>
          <div style={{ fontSize:18, fontWeight:700, lineHeight:1.2 }}>Earn With Us.</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:4 }}>Licensed or unlicensed welcome.</div>
        </div>
        <QRWithLogo url={scanUrl} size={130} />
        <div style={{ color:GOLD, fontSize:9, letterSpacing:3, fontWeight:700, textTransform:'uppercase' }}>Scan to Join</div>
      </div>
    </div>
  );
}

/* ── Both-sides preview ──────────────────────────────────────────── */
export function BusinessCardPreview({ refCode, settings = {}, side = 'both' }) {
  const cardStyle = {
    borderRadius:16, overflow:'hidden',
    border:`1px solid rgba(212,175,55,0.25)`,
    boxShadow:'0 20px 50px rgba(0,0,0,0.7)',
    width:'100%', maxWidth: side === 'both' ? 700 : 380,
  };

  if (side === 'front') return <div style={cardStyle}><CardFront settings={settings} /></div>;
  if (side === 'back')  return <div style={cardStyle}><CardBack settings={settings} refCode={refCode} /></div>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, width:'100%', maxWidth:700 }}>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', letterSpacing:2, textTransform:'uppercase' }}>Front</div>
      <div style={cardStyle}><CardFront settings={settings} /></div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', letterSpacing:2, textTransform:'uppercase', marginTop:4 }}>Back</div>
      <div style={cardStyle}><CardBack settings={settings} refCode={refCode} /></div>
    </div>
  );
}

/* ── Scan stats ──────────────────────────────────────────────────── */
function ScanStats({ refCode }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (!refCode) return;
    fetch(`/api/qr-scan/stats?ref=${encodeURIComponent(refCode)}`).then(r=>r.json()).then(setStats).catch(()=>{});
  }, [refCode]);
  if (!stats) return null;
  const days = stats.days ? Object.entries(stats.days) : [];
  const maxDay = Math.max(1, ...days.map(([,v])=>v));
  return (
    <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:16, padding:24, border:'1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11, letterSpacing:2, textTransform:'uppercase', marginBottom:16, fontWeight:600 }}>Scan Activity</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[['Total',stats.total],['Today',stats.today],['Mobile',stats.mobile],['Desktop',stats.desktop]].map(([l,v])=>(
          <div key={l} style={{ textAlign:'center' }}>
            <div style={{ fontSize:26, fontWeight:700, color:GOLD }}>{v??0}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>
      {days.length>0 && (
        <div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginBottom:8, letterSpacing:1 }}>LAST 7 DAYS</div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:48 }}>
            {days.map(([date,count])=>(
              <div key={date} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                <div style={{ width:'100%', height:Math.max(3,(count/maxDay)*40), background:count>0?GOLD:'rgba(255,255,255,0.08)', borderRadius:2 }} />
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.2)' }}>{date.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {stats.lastScan && <div style={{ marginTop:10, fontSize:11, color:'rgba(255,255,255,0.2)' }}>Last scan: {new Date(stats.lastScan).toLocaleString()}</div>}
    </div>
  );
}

/* ── Order modal ─────────────────────────────────────────────────── */
function OrderModal({ refCode, settings={}, onClose }) {
  const [photoFile, setPhotoFile] = useState(null);
  const [photoEmail, setPhotoEmail] = useState('');
  const [qty, setQty] = useState('250');
  const [mode, setMode] = useState('upload');
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
      fd.append('submitMode', mode);
      if (mode==='email') fd.append('photoEmail', photoEmail);
      if (mode==='upload' && photoFile) fd.append('photo', photoFile);
      await fetch('/api/card-order', { method:'POST', body:fd });
      setDone(true);
    } finally { setSubmitting(false); }
  };

  const iS = { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'10px 14px', color:'#fff', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit' };
  const lS = { fontSize:11, color:'rgba(255,255,255,0.4)', letterSpacing:1, textTransform:'uppercase', marginBottom:6, display:'block', fontWeight:600 };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#111520', borderRadius:20, padding:32, maxWidth:480, width:'100%', border:`1px solid rgba(212,175,55,0.2)`, boxShadow:'0 24px 60px rgba(0,0,0,0.8)' }}>
        {done ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:40, marginBottom:16 }}>✅</div>
            <div style={{ fontSize:18, fontWeight:700, color:'#fff', marginBottom:8 }}>Order Received</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:24 }}>Our team will follow up to confirm details and timeline.</div>
            <button onClick={onClose} style={{ background:GOLD, color:'#000', border:'none', borderRadius:10, padding:'12px 28px', fontSize:13, fontWeight:700, cursor:'pointer' }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:700, color:'#fff' }}>Order Business Cards</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:3 }}>Professional print · Your card design</div>
              </div>
              <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:22, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={lS}>Quantity</label>
              <select style={{ ...iS, cursor:'pointer' }} value={qty} onChange={e=>setQty(e.target.value)}>
                {['100','250','500','1000'].map(q=><option key={q} value={q}>{q==='1000'?'1,000':q} cards</option>)}
              </select>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={lS}>Your Photo</label>
              <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                {[['upload','📎 Upload Photo'],['email','📧 Email Photo']].map(([m,lbl])=>(
                  <button key={m} onClick={()=>setMode(m)} style={{ flex:1, padding:'9px 14px', borderRadius:10, border:`1px solid ${mode===m?GOLD:'rgba(255,255,255,0.1)'}`, background:mode===m?`rgba(212,175,55,0.1)`:'transparent', color:mode===m?GOLD:'rgba(255,255,255,0.5)', fontSize:12, fontWeight:600, cursor:'pointer' }}>{lbl}</button>
                ))}
              </div>
              {mode==='upload' ? (
                <div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>setPhotoFile(e.target.files[0])} />
                  <button onClick={()=>fileRef.current.click()} style={{ ...iS, cursor:'pointer', textAlign:'left', color:photoFile?'#fff':'rgba(255,255,255,0.3)' }}>
                    {photoFile?`✓ ${photoFile.name}`:'Choose photo file...'}
                  </button>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:6 }}>High-res JPG or PNG. Min 600×600px.</div>
                </div>
              ) : (
                <div>
                  <input style={iS} value={photoEmail} onChange={e=>setPhotoEmail(e.target.value)} placeholder="Your email address" />
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:6 }}>We&apos;ll send photo submission instructions to this address.</div>
                </div>
              )}
            </div>
            <div style={{ background:'rgba(212,175,55,0.06)', border:`1px solid rgba(212,175,55,0.15)`, borderRadius:10, padding:12, marginBottom:20, fontSize:12, color:'rgba(255,255,255,0.5)', lineHeight:1.5 }}>
              💡 Professional photo editing included free with every order.
            </div>
            <button onClick={submit} disabled={submitting} style={{ background:GOLD, color:'#000', border:'none', borderRadius:10, padding:'13px 28px', fontSize:13, fontWeight:700, cursor:'pointer', width:'100%', opacity:submitting?0.6:1 }}>
              {submitting?'Submitting...':'Submit Order Request →'}
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
  const [side, setSide] = useState('both');

  useEffect(() => {
    if (!refCode) return;
    fetch(`/api/card-settings?ref=${encodeURIComponent(refCode)}`).then(r=>r.json()).then(d=>{
      const p = (profile?.name||'').trim().split(/\s+/);
      setSettings({ firstName:p[0]||'', lastName:p.slice(1).join(' ')||'', title:'Life Insurance Agent', phone:'', email:profile?.email||'', city:'', state:'', ...d });
    }).catch(()=>{
      const p = (profile?.name||'').trim().split(/\s+/);
      setSettings({ firstName:p[0]||'', lastName:p.slice(1).join(' ')||'', title:'Life Insurance Agent', phone:'', email:profile?.email||'', city:'', state:'' });
    });
  }, [refCode, profile?.name, profile?.email]);

  const update = (k,v) => setSettings(s=>({...s,[k]:v}));

  const save = async () => {
    setSaving(true);
    await fetch('/api/card-settings',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ref:refCode,...settings}) });
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  if (!settings) return <div style={{ color:'rgba(255,255,255,0.3)', fontSize:13 }}>Loading card...</div>;

  const iS = { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'10px 14px', color:'#fff', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit' };
  const lS = { fontSize:11, color:'rgba(255,255,255,0.4)', letterSpacing:1, textTransform:'uppercase', marginBottom:6, display:'block', fontWeight:600 };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24, fontFamily:"'Inter','Helvetica Neue',sans-serif", color:'#fff' }}>

      {/* Header row */}
      <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:10 }}>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', letterSpacing:1, textTransform:'uppercase', fontWeight:600, marginRight:4 }}>Card Preview</div>
        <div style={{ display:'flex', gap:6 }}>
          {[['both','Both Sides'],['front','Front'],['back','Back']].map(([k,lbl])=>(
            <button key={k} onClick={()=>setSide(k)} style={{ padding:'6px 12px', borderRadius:8, border:`1px solid ${side===k?GOLD:'rgba(255,255,255,0.12)'}`, background:side===k?`rgba(212,175,55,0.12)`:'transparent', color:side===k?GOLD:'rgba(255,255,255,0.4)', fontSize:11, fontWeight:600, cursor:'pointer' }}>{lbl}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto' }}>
          <button onClick={()=>setShowOrder(true)} style={{ background:GOLD, color:'#000', border:'none', borderRadius:10, padding:'8px 18px', fontSize:12, fontWeight:700, cursor:'pointer' }}>Order Cards →</button>
        </div>
      </div>

      {/* Card */}
      <BusinessCardPreview refCode={refCode} settings={settings} side={side} />

      {/* Stats */}
      <ScanStats refCode={refCode} />

      {/* Edit */}
      <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:16, padding:24, border:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11, letterSpacing:2, textTransform:'uppercase', marginBottom:20, fontWeight:600 }}>Customize Your Card</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div><label style={lS}>First Name</label><input style={iS} value={settings.firstName} onChange={e=>update('firstName',e.target.value)} /></div>
          <div><label style={lS}>Last Name</label><input style={iS} value={settings.lastName} onChange={e=>update('lastName',e.target.value)} /></div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={lS}>Title</label>
            <select style={{ ...iS, cursor:'pointer' }} value={settings.title} onChange={e=>update('title',e.target.value)}>
              {TITLE_OPTIONS.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div><label style={lS}>Phone</label><input style={iS} value={settings.phone} onChange={e=>update('phone',e.target.value)} placeholder="201-555-0100" /></div>
          <div><label style={lS}>Email</label><input style={iS} value={settings.email} onChange={e=>update('email',e.target.value)} /></div>
          <div><label style={lS}>City</label><input style={iS} value={settings.city} onChange={e=>update('city',e.target.value)} /></div>
          <div><label style={lS}>State</label><input style={iS} value={settings.state} onChange={e=>update('state',e.target.value)} maxLength={2} /></div>
        </div>
        <div style={{ marginTop:14 }}>
          <label style={lS}>Website (fixed)</label>
          <div style={{ ...iS, color:'rgba(255,255,255,0.25)', cursor:'not-allowed' }}>thelegacylink.com</div>
        </div>
        <div style={{ marginTop:20 }}>
          <button onClick={save} disabled={saving} style={{ background:GOLD, color:'#000', border:'none', borderRadius:10, padding:'12px 28px', fontSize:13, fontWeight:700, cursor:'pointer', opacity:saving?0.6:1 }}>
            {saving?'Saving...':saved?'✓ Saved':'Save Card'}
          </button>
        </div>
      </div>

      {/* QR link */}
      <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:16, padding:20, border:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11, letterSpacing:2, textTransform:'uppercase', marginBottom:10, fontWeight:600 }}>Your QR Tracking Link</div>
        <div style={{ background:'rgba(0,0,0,0.4)', borderRadius:8, padding:'10px 14px', fontSize:12, color:GOLD, fontFamily:'monospace', wordBreak:'break-all' }}>
          https://innercirclelink.com/api/qr-scan?ref={refCode}
        </div>
      </div>

      {showOrder && <OrderModal refCode={refCode} settings={settings} onClose={()=>setShowOrder(false)} />}
    </div>
  );
}

export default CardEditor;
