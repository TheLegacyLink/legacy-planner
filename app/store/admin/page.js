'use client';
import { useEffect, useState } from 'react';

const GOLD='#C8A45A';const BG='#0f172a';const CARD='#1e293b';const TEXT='#e2e8f0';const MUTED='#64748b';const BORDER='#334155';

function ProductRow({ p, editing, setEditing, saving, saveProduct }) {
  const [editPatch, setEP] = useState({...p});
  const isEditing = editing === p.sku;
  return (
    <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:'18px 20px',marginBottom:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
        <div>
          <h3 style={{margin:'0 0 2px',color:TEXT,fontWeight:700}}>{p.name} &mdash; {p.subtitle}</h3>
          <p style={{margin:0,color:MUTED,fontSize:12}}>{p.sku} &middot; ${p.price} &middot; {p.tag||'no tag'}</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <a href={`/store/product/${p.sku}`} target="_blank" rel="noreferrer" style={{fontSize:12,color:MUTED,textDecoration:'none'}}>Preview &#8599;</a>
          <button onClick={()=>{ setEditing(isEditing?null:p.sku); setEP({...p}); }} style={{padding:'6px 14px',borderRadius:8,background:'transparent',border:`1px solid ${BORDER}`,color:MUTED,cursor:'pointer',fontSize:12}}>{isEditing?'Cancel':'Edit'}</button>
        </div>
      </div>
      {isEditing && (
        <div style={{marginTop:18,paddingTop:18,borderTop:`1px solid ${BORDER}`}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            {[['name','Name'],['subtitle','Subtitle'],['price','Price ($)'],['tag','Tag (FEATURED/NEW/leave blank)'],['image','Image path (/store/...)'],['description','Description']].map(([f,l])=>(
              <label key={f} style={{display:'block'}}>
                <span style={{color:MUTED,fontSize:12,display:'block',marginBottom:4}}>{l}</span>
                <input value={editPatch[f]||''} onChange={e=>setEP(prev=>({...prev,[f]:e.target.value}))} style={{width:'100%',padding:'8px 10px',borderRadius:7,border:`1px solid ${BORDER}`,background:'#0f172a',color:TEXT,fontSize:13}} />
              </label>
            ))}
          </div>
          <div style={{marginBottom:14}}>
            <p style={{color:MUTED,fontSize:12,marginBottom:10}}>Printful Variant IDs — enter after creating products in Printful</p>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {(editPatch.sizes||p.sizes||[]).map(s=>(
                <label key={s} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                  <span style={{color:MUTED,fontSize:11}}>{s}</span>
                  <input value={editPatch?.printfulVariantIds?.[s]||''} onChange={e=>setEP(prev=>({...prev,printfulVariantIds:{...(prev.printfulVariantIds||{}), [s]:e.target.value}}))} style={{width:80,padding:'6px 8px',borderRadius:6,border:`1px solid ${BORDER}`,background:'#0f172a',color:TEXT,fontSize:12,textAlign:'center'}} placeholder="ID" />
                </label>
              ))}
            </div>
          </div>
          <button onClick={()=>saveProduct(p.sku, editPatch)} disabled={saving===p.sku} style={{padding:'9px 20px',background:GOLD,color:'#0B1020',border:'none',borderRadius:8,fontWeight:800,cursor:'pointer',fontSize:13}}>
            {saving===p.sku?'Saving...':'Save Product'}
          </button>
        </div>
      )}
    </div>
  );
}

function ProductsTab({ products, editing, setEditing, saving, saveProduct }) {
  return (
    <div>
      <p style={{color:MUTED,fontSize:13,marginBottom:20}}>Edit prices, images, tags, and Printful variant IDs. Variant IDs come from your Printful dashboard after creating products there.</p>
      {products.map(p => <ProductRow key={p.sku} p={p} editing={editing} setEditing={setEditing} saving={saving} saveProduct={saveProduct} />)}
    </div>
  );
}

export default function StoreAdminPage() {
  const [authed, setAuthed]   = useState(false);
  const [pw, setPw]           = useState('');
  const [authErr, setAuthErr] = useState('');
  const [token, setToken]     = useState('');
  const [products, setProducts] = useState([]);
  const [orders, setOrders]   = useState([]);
  const [tab, setTab]         = useState('products');
  const [editing, setEditing] = useState(null);
  const [msg, setMsg]         = useState('');
  const [saving, setSaving]   = useState('');

  useEffect(() => {
    const t = localStorage.getItem('store_admin_token');
    if (t) { setToken(t); setAuthed(true); }
  }, []);

  useEffect(() => {
    if (!authed || !token) return;
    fetch('/api/store/products', { cache:'no-store' }).then(r=>r.json()).then(d => { if (d?.ok) setProducts(d.products||[]); });
    fetch('/api/store/orders', { headers:{ 'x-admin-key':token }, cache:'no-store' }).then(r=>r.json()).then(d => { if (d?.ok) setOrders(d.orders||[]); });
  }, [authed, token]);

  async function login() {
    const res = await fetch('/api/admin-skeleton-auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ identifier:'Kimora Link', password:pw }) });
    const d = await res.json().catch(()=>({}));
    if (!res.ok||!d?.ok) { setAuthErr('Incorrect password.'); return; }
    localStorage.setItem('store_admin_token', pw);
    setToken(pw); setAuthed(true);
  }

  async function saveProduct(sku, patch) {
    setSaving(sku);
    const res = await fetch('/api/store/products', { method:'PATCH', headers:{'Content-Type':'application/json','x-admin-key':token}, body: JSON.stringify({ action:'update_product', sku, patch }) });
    const d = await res.json().catch(()=>({}));
    if (d?.ok) { setProducts(prev => prev.map(p => p.sku===sku ? {...p,...patch} : p)); setEditing(null); setMsg('Saved ✓'); }
    setSaving('');
  }

  if (!authed) return (
    <div style={{minHeight:'100vh',background:BG,display:'flex',alignItems:'center',justifyContent:'center',color:TEXT}}>
      <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:'40px 32px',width:360}}>
        <h2 style={{marginBottom:20,color:GOLD,fontFamily:'serif'}}>Store Admin</h2>
        <input type="password" placeholder="Admin password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:`1px solid ${BORDER}`,background:'#0f172a',color:TEXT,fontSize:14,marginBottom:8}} />
        {authErr && <p style={{color:'#f87171',fontSize:12,marginBottom:8}}>{authErr}</p>}
        <button onClick={login} style={{width:'100%',padding:'11px',background:GOLD,color:'#0B1020',border:'none',borderRadius:8,fontWeight:800,cursor:'pointer'}}>Unlock</button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:BG,color:TEXT,fontFamily:'system-ui,sans-serif'}}>
      <div style={{padding:'20px 28px',borderBottom:`1px solid ${BORDER}`,display:'flex',gap:16,alignItems:'center'}}>
        <h1 style={{margin:0,color:GOLD,fontFamily:'serif',fontSize:22}}>Store Admin</h1>
        <a href="/store" target="_blank" rel="noreferrer" style={{fontSize:12,color:MUTED,textDecoration:'none',marginLeft:'auto'}}>Preview Store ↗</a>
      </div>

      <div style={{display:'flex',gap:4,padding:'16px 28px 0',borderBottom:`1px solid ${BORDER}`}}>
        {[['products','📦 Products'],['orders','🧾 Orders'],['printful','🔗 Printful Setup']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:'9px 18px',background:'none',border:'none',borderBottom:tab===id?`2px solid ${GOLD}`:'2px solid transparent',color:tab===id?GOLD:MUTED,fontWeight:600,fontSize:14,cursor:'pointer'}}>{label}</button>
        ))}
      </div>

      <div style={{maxWidth:1000,margin:'0 auto',padding:'28px 28px'}}>
        {msg && <p style={{color:'#4ade80',marginBottom:16,fontSize:13}}>{msg}</p>}

        {/* ── Products ── */}
        {tab==='products' && (
          <ProductsTab products={products} editing={editing} setEditing={setEditing} saving={saving} saveProduct={saveProduct} />
        )}

        {/* ── Orders ── */}
        {tab==='orders' && (
          <div>
            {orders.length===0 ? <p style={{color:MUTED}}>No orders yet.</p> : (
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${BORDER}`}}>
                    {['Order ID','Date','Customer','Items','Status','Printful'].map(h=>(
                      <th key={h} style={{padding:'8px 12px',textAlign:'left',color:MUTED,fontWeight:600,fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o=>(
                    <tr key={o.id} style={{borderBottom:`1px solid ${BORDER}22`}}>
                      <td style={{padding:'10px 12px',color:MUTED,fontFamily:'monospace',fontSize:11}}>{o.id}</td>
                      <td style={{padding:'10px 12px',color:MUTED}}>{o.paidAt?new Date(o.paidAt).toLocaleDateString():new Date(o.createdAt).toLocaleDateString()}</td>
                      <td style={{padding:'10px 12px',color:TEXT}}>{o.name||o.email||'—'}</td>
                      <td style={{padding:'10px 12px',color:MUTED}}>{(o.items||[]).map(i=>`${i.name} ${i.size}`).join(', ')}</td>
                      <td style={{padding:'10px 12px'}}><span style={{padding:'3px 8px',borderRadius:4,fontSize:11,fontWeight:600,background:o.status?.includes('printful')?'rgba(74,222,128,.12)':'rgba(251,191,36,.12)',color:o.status?.includes('printful')?'#4ade80':'#fbbf24'}}>{o.status}</span></td>
                      <td style={{padding:'10px 12px',color:o.printfulOrderId?'#4ade80':MUTED,fontSize:12}}>{o.printfulOrderId||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Printful Setup ── */}
        {tab==='printful' && (
          <div style={{maxWidth:600}}>
            <h3 style={{color:TEXT,marginBottom:16}}>Printful Setup Checklist</h3>
            {[
              ['1', 'Create products in your Printful dashboard — T-shirts, Polo, Hoodie with your designs uploaded'],
              ['2', 'For each product, copy the Variant IDs for every size (found in the product details page in Printful)'],
              ['3', 'Come back to the Products tab above and paste each Variant ID into the corresponding size field'],
              ['4', 'Add PRINTFUL_API_KEY to your Vercel environment variables'],
              ['5', 'Add PRINTFUL_STORE_ID to Vercel env vars (found in Printful → Settings → Stores)'],
              ['6', 'Add STRIPE_STORE_WEBHOOK_SECRET to Vercel — create a new webhook endpoint in Stripe pointing to: https://innercirclelink.com/api/store/webhook'],
              ['7', 'Test with a real order — verify Printful receives it in their dashboard'],
            ].map(([num, text])=>(
              <div key={num} style={{display:'flex',gap:16,padding:'14px 0',borderBottom:`1px solid ${BORDER}`}}>
                <span style={{width:28,height:28,borderRadius:'50%',background:GOLD+'22',border:`1px solid ${GOLD}44`,color:GOLD,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>{num}</span>
                <p style={{color:TEXT,fontSize:14,lineHeight:1.6,margin:0}}>{text}</p>
              </div>
            ))}
            <div style={{marginTop:24,padding:'16px 20px',background:'rgba(200,164,90,.08)',border:`1px solid ${GOLD}33`,borderRadius:8}}>
              <p style={{color:GOLD,fontSize:13,fontWeight:700,marginBottom:4}}>Printful API Key (save to Vercel)</p>
              <code style={{color:MUTED,fontSize:12,wordBreak:'break-all'}}>PRINTFUL_API_KEY = Ei9lFrV77aiTIeZKurfdpHmIrTWHXemkSa7gWeMR</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
