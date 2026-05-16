'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const GOLD='#C8A45A';const BG='#1A1A1A';const CARD='#0B0B0B';const TEXT='#F2F0EA';const MUTED='#9A968D';const BORDER='#2A2A2A';
const FS='"Cormorant Garamond","Georgia",serif';const SANS='"Inter",system-ui,sans-serif';
const CART_KEY='ll_store_cart_v1';
function loadCart(){try{return JSON.parse(localStorage.getItem(CART_KEY)||'[]');}catch{return[];}}
function saveCart(c){try{localStorage.setItem(CART_KEY,JSON.stringify(c));}catch{}}
function fmtPrice(p){const n=Number(p||0);return n%1===0?`$${n}`:`$${n.toFixed(2)}`;}

export default function ProductPage() {
  const { sku } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [size, setSize]         = useState('');
  const [added, setAdded]       = useState(false);

  useEffect(() => {
    fetch('/api/store/products', { cache: 'no-store' }).then(r=>r.json()).catch(()=>({}))
      .then(d => {
        const p = (d.products||[]).find(x => x.sku === sku);
        setProduct(p || null);
      }).finally(() => setLoading(false));
  }, [sku]);

  function addToCart() {
    if (!size || !product) return;
    const cart = loadCart();
    const idx = cart.findIndex(i => i.sku === product.sku && i.size === size);
    if (idx >= 0) cart[idx].quantity += 1;
    else cart.push({ ...product, size, quantity: 1 });
    saveCart(cart);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  if (loading) return <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', color:MUTED, fontFamily:SANS }}>Loading…</div>;
  if (!product) return <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', color:MUTED, fontFamily:SANS }}>Product not found. <Link href="/store" style={{color:GOLD,marginLeft:8}}>Back to store</Link></div>;

  const hasImage = product.image && !product.image.includes('placeholder');

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;600;700;800&display=swap');`}</style>
      <div style={{ minHeight:'100vh', background:BG, color:TEXT }}>
        <nav style={{ padding:'20px 32px', borderBottom:`1px solid ${BORDER}`, display:'flex', alignItems:'center', gap:16 }}>
          <Link href="/store" style={{ fontFamily:SANS, fontSize:11, color:MUTED, textDecoration:'none', letterSpacing:1.5, textTransform:'uppercase' }}>← Store</Link>
          <span style={{ color:BORDER }}>|</span>
          <span style={{ fontFamily:SANS, fontSize:11, color:MUTED, letterSpacing:1 }}>{product.name}</span>
        </nav>

        <div style={{ maxWidth:1100, margin:'0 auto', padding:'60px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'start' }}>
          {/* Image */}
          <div style={{ background:'#111', borderRadius:8, overflow:'hidden', aspectRatio:'3/4' }}>
            {hasImage ? (
              <img src={product.image} alt={product.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            ) : (
              <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
                <span style={{ color:GOLD, fontSize:48 }}>⬡</span>
                <span style={{ color:MUTED, fontFamily:SANS, fontSize:11, letterSpacing:2, textTransform:'uppercase' }}>Image Coming Soon</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div style={{ paddingTop:8 }}>
            {product.tag && (
              <span style={{ fontFamily:SANS, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:GOLD, border:`1px solid ${GOLD}44`, padding:'4px 10px', borderRadius:4, display:'inline-block', marginBottom:20 }}>{product.tag}</span>
            )}
            <h1 style={{ fontFamily:FS, fontSize:42, fontWeight:600, color:TEXT, marginBottom:6, lineHeight:1.1 }}>{product.name}</h1>
            <p style={{ fontFamily:SANS, fontSize:12, color:MUTED, letterSpacing:1.5, textTransform:'uppercase', marginBottom:20 }}>{product.subtitle}</p>
            <p style={{ fontFamily:SANS, fontSize:28, fontWeight:800, color:GOLD, marginBottom:28 }}>{fmtPrice(product.price)}</p>
            <p style={{ fontFamily:SANS, fontSize:14, color:MUTED, lineHeight:1.8, marginBottom:32 }}>{product.description}</p>

            {/* Size selector */}
            <div style={{ marginBottom:28 }}>
              <p style={{ fontFamily:SANS, fontSize:11, letterSpacing:1.5, textTransform:'uppercase', color:MUTED, marginBottom:12 }}>Select Size</p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {product.sizes.map(s => (
                  <button key={s} onClick={() => setSize(s)} style={{ padding:'10px 16px', borderRadius:4, fontFamily:SANS, fontWeight:600, fontSize:13, border:`1px solid ${size===s?GOLD:'#333'}`, background:size===s?GOLD+'18':'transparent', color:size===s?GOLD:MUTED, cursor:'pointer', transition:'all .15s' }}>{s}</button>
                ))}
              </div>
            </div>

            <button onClick={addToCart} disabled={!size} style={{ width:'100%', padding:'16px', background:added?'#1a3a1a':size?GOLD:'#1e1e1e', color:added?'#4ade80':size?'#0B0B0B':'#3a3a3a', border:'none', borderRadius:4, fontFamily:SANS, fontWeight:800, fontSize:13, letterSpacing:2, textTransform:'uppercase', cursor:size?'pointer':'default', transition:'all .2s', marginBottom:16 }}>
              {added ? '✓ Added to Cart' : size ? 'Add to Cart' : 'Select a Size'}
            </button>

            {/* Garment info */}
            <div style={{ borderTop:`1px solid ${BORDER}`, paddingTop:24, marginTop:8 }}>
              <p style={{ fontFamily:SANS, fontSize:11, letterSpacing:1.5, textTransform:'uppercase', color:MUTED, marginBottom:10 }}>Garment Details</p>
              <p style={{ fontFamily:SANS, fontSize:13, color:'#6a6a6a', lineHeight:1.7 }}>{product.garment}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
