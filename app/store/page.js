'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/* ─── Design tokens ─────────────────────────────────────────────────────────── */
const BG      = '#1A1A1A';
const CARD_BG = '#0B0B0B';
const GOLD    = '#C8A45A';
const GOLD_DIM = '#A8843A';
const TEXT    = '#F2F0EA';
const MUTED   = '#9A968D';
const BORDER  = '#2A2A2A';

const FONT_SERIF = '"Cormorant Garamond", "Didot", "Georgia", serif';
const FONT_SANS  = '"Inter", "DM Sans", system-ui, sans-serif';

const TAG_STYLES = {
  FEATURED:  { background: GOLD,    color: '#0B0B0B', border: 'none' },
  NEW:       { background: 'transparent', color: GOLD, border: `1px solid ${GOLD}` },
  EARN_ONLY: { background: '#1a1200', color: GOLD, border: `1px solid ${GOLD}55` },
  SOLD_OUT:  { background: '#1a1a1a', color: MUTED, border: '1px solid #3a3a3a' }
};

/* ─── Cart atom ──────────────────────────────────────────────────────────────── */
const CART_KEY = 'll_store_cart_v1';
function loadCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
}
function saveCart(cart) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function fmtPrice(p) {
  const n = Number(p || 0);
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
}

function ProductCard({ product, onAddToCart }) {
  const [hovered, setHovered] = useState(false);
  const [selectedSize, setSelectedSize] = useState('');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const tagStyle = TAG_STYLES[product.tag] || null;
  const hasImage = product.image && !product.image.includes('placeholder');

  function handleAdd() {
    if (!selectedSize) return;
    setAdding(true);
    onAddToCart({ ...product, size: selectedSize, quantity: 1 });
    setTimeout(() => { setAdding(false); setAdded(true); setTimeout(() => setAdded(false), 1800); }, 300);
  }

  return (
    <div
      style={{
        background: CARD_BG,
        borderRadius: 4,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,.6)',
        border: `1px solid ${hovered ? GOLD + '80' : BORDER}`,
        transform: hovered ? 'scale(1.015)' : 'scale(1)',
        transition: 'transform .25s ease, border-color .25s ease',
        cursor: 'pointer'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Product image — 3:4 aspect */}
      <Link href={`/store/product/${product.sku}`} style={{ textDecoration: 'none', display: 'block' }}>
        <div style={{ position: 'relative', paddingBottom: '133.33%', background: '#111', overflow: 'hidden' }}>
          {hasImage ? (
            <img
              src={product.image}
              alt={`${product.name} ${product.subtitle}`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .4s ease', transform: hovered ? 'scale(1.04)' : 'scale(1)' }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', border: `2px solid ${GOLD}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: GOLD, fontSize: 32 }}>⬡</span>
              </div>
              <span style={{ color: MUTED, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Image Coming Soon</span>
            </div>
          )}

          {/* Tag pill — top left */}
          {tagStyle && (
            <div style={{ position: 'absolute', top: 14, left: 14, padding: '5px 12px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: FONT_SANS, ...tagStyle }}>
              {product.tag === 'FEATURED' ? `— ${product.tag}` : product.tag}
            </div>
          )}

          {/* Color swatch — bottom right of photo */}
          <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 6 }}>
            {product.colors.map(c => (
              <div key={c.hex} title={c.label} style={{ width: 18, height: 18, borderRadius: '50%', background: c.hex, border: `2px solid ${c.hex === '#F2F0EA' || c.hex === '#FFFFFF' ? '#666' : GOLD + '44'}`, boxShadow: '0 2px 8px rgba(0,0,0,.5)' }} />
            ))}
          </div>
        </div>
      </Link>

      {/* Card body */}
      <div style={{ padding: '18px 18px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: FONT_SERIF, fontSize: 20, fontWeight: 600, color: TEXT, letterSpacing: '.3px' }}>
                {product.name}
              </h3>
              <p style={{ margin: '2px 0 0', fontFamily: FONT_SANS, fontSize: 12, color: MUTED, letterSpacing: 1, textTransform: 'uppercase' }}>
                {product.subtitle}
              </p>
            </div>
            <span style={{ fontFamily: FONT_SANS, fontSize: 18, fontWeight: 700, color: GOLD, whiteSpace: 'nowrap', marginLeft: 12 }}>
              {fmtPrice(product.price)}
            </span>
          </div>
          <p style={{ margin: '10px 0 0', fontFamily: FONT_SANS, fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
            {product.description}
          </p>
        </div>

        {/* Size selector */}
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {product.sizes.map(s => (
              <button
                key={s}
                onClick={() => setSelectedSize(s)}
                style={{
                  padding: '5px 10px', borderRadius: 4, fontSize: 11, fontFamily: FONT_SANS, fontWeight: 600,
                  letterSpacing: .5, border: `1px solid ${selectedSize === s ? GOLD : '#333'}`,
                  background: selectedSize === s ? GOLD + '18' : 'transparent',
                  color: selectedSize === s ? GOLD : MUTED, cursor: 'pointer', transition: 'all .15s'
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={!selectedSize}
            style={{
              width: '100%', padding: '11px', borderRadius: 4, border: 'none',
              background: added ? '#1a3a1a' : selectedSize ? GOLD : '#1e1e1e',
              color: added ? '#4ade80' : selectedSize ? '#0B0B0B' : '#3a3a3a',
              fontFamily: FONT_SANS, fontWeight: 700, fontSize: 13, letterSpacing: 1,
              textTransform: 'uppercase', cursor: selectedSize ? 'pointer' : 'default',
              transition: 'all .2s'
            }}
          >
            {added ? '✓ Added' : adding ? '...' : selectedSize ? 'Add to Cart' : 'Select a Size'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Cart drawer ────────────────────────────────────────────────────────────── */
function CartDrawer({ cart, onClose, onUpdate, onRemove, onCheckout }) {
  const total = cart.reduce((s, i) => s + (Number(i.price || 0) * (i.quantity || 1)), 0);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: 380, maxWidth: '100vw', background: CARD_BG, borderLeft: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', zIndex: 1 }}>
        <div style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontFamily: FONT_SERIF, fontSize: 22, color: TEXT }}>Your Cart</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: MUTED, fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {cart.length === 0 ? (
            <p style={{ color: MUTED, fontFamily: FONT_SANS, fontSize: 14, textAlign: 'center', marginTop: 40 }}>Your cart is empty.</p>
          ) : cart.map((item, i) => (
            <div key={`${item.sku}-${item.size}-${i}`} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: `1px solid ${BORDER}` }}>
              {item.image && !item.image.includes('placeholder') && (
                <img src={item.image} alt={item.name} style={{ width: 60, height: 80, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontFamily: FONT_SERIF, fontSize: 16, color: TEXT }}>{item.name}</p>
                <p style={{ margin: '2px 0 0', fontFamily: FONT_SANS, fontSize: 11, color: MUTED, letterSpacing: 1, textTransform: 'uppercase' }}>{item.subtitle} · Size {item.size}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => onUpdate(i, -1)} style={{ width: 24, height: 24, borderRadius: '50%', border: `1px solid ${BORDER}`, background: 'none', color: TEXT, cursor: 'pointer', fontSize: 14 }}>−</button>
                    <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: TEXT }}>{item.quantity}</span>
                    <button onClick={() => onUpdate(i, 1)} style={{ width: 24, height: 24, borderRadius: '50%', border: `1px solid ${BORDER}`, background: 'none', color: TEXT, cursor: 'pointer', fontSize: 14 }}>+</button>
                  </div>
                  <span style={{ fontFamily: FONT_SANS, fontWeight: 700, color: GOLD }}>{fmtPrice(item.price * item.quantity)}</span>
                </div>
              </div>
              <button onClick={() => onRemove(i)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 16, alignSelf: 'flex-start', padding: 4 }}>✕</button>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div style={{ padding: '18px 24px 24px', borderTop: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontFamily: FONT_SANS, color: MUTED, fontSize: 14 }}>Subtotal</span>
              <span style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: 16, color: TEXT }}>{fmtPrice(total)}</span>
            </div>
            <p style={{ fontFamily: FONT_SANS, fontSize: 11, color: MUTED, marginBottom: 14, textAlign: 'center', letterSpacing: .5 }}>Shipping calculated at checkout</p>
            <button
              onClick={onCheckout}
              style={{ width: '100%', padding: '14px', background: GOLD, color: '#0B0B0B', border: 'none', borderRadius: 4, fontFamily: FONT_SANS, fontWeight: 800, fontSize: 14, letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────────── */
export default function StorePage() {
  const [products, setProducts]     = useState([]);
  const [hero, setHero]             = useState({});
  const [compliance, setCompliance] = useState('');
  const [cart, setCart]             = useState([]);
  const [cartOpen, setCartOpen]     = useState(false);
  const [loading, setLoading]       = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    setCart(loadCart());
    fetch('/api/store/products', { cache: 'no-store' })
      .then(r => r.json()).catch(() => ({}))
      .then(d => {
        if (d?.ok) {
          setProducts((d.products || []).filter(p => p.active !== false));
          setHero(d.hero || {});
          setCompliance(d.compliance || '');
        }
      }).finally(() => setLoading(false));
  }, []);

  function addToCart(item) {
    setCart(prev => {
      const existing = prev.findIndex(i => i.sku === item.sku && i.size === item.size);
      const next = existing >= 0
        ? prev.map((i, idx) => idx === existing ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev, { ...item, quantity: 1 }];
      saveCart(next);
      return next;
    });
  }

  function updateQty(idx, delta) {
    setCart(prev => {
      const next = prev.map((i, j) => j === idx ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i);
      saveCart(next);
      return next;
    });
  }

  function removeItem(idx) {
    setCart(prev => { const next = prev.filter((_, j) => j !== idx); saveCart(next); return next; });
  }

  async function checkout() {
    if (!cart.length) return;
    setCheckingOut(true);
    try {
      const res = await fetch('/api/store/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart })
      });
      const d = await res.json().catch(() => ({}));
      if (d?.url) {
        saveCart([]);
        window.location.href = d.url;
      }
    } finally {
      setCheckingOut(false);
    }
  }

  const featured  = products.filter(p => p.tag === 'FEATURED');
  const newItems  = products.filter(p => p.tag === 'NEW');
  const cartCount = cart.reduce((s, i) => s + (i.quantity || 1), 0);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return products;
    return products.filter(p => p.category === activeFilter);
  }, [products, activeFilter]);

  return (
    <>
      {/* Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: ${BG}; color: ${TEXT}; }
        ::selection { background: ${GOLD}44; color: ${TEXT}; }
        /* Texture overlay via pseudo-element on a wrapper */
        .ll-store-bg::before {
          content: '';
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          opacity: .35;
        }
      `}</style>

      <div className="ll-store-bg" style={{ minHeight: '100vh', background: BG, position: 'relative', zIndex: 1 }}>

        {/* ── Nav ───────────────────────────────────────────────────────────── */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(11,11,11,.92)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${BORDER}`, padding: '0 32px', display: 'flex', alignItems: 'center', height: 64 }}>
          <Link href="/store" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: FONT_SERIF, fontSize: 22, color: GOLD, letterSpacing: 1 }}>THE LEGACY LINK</span>
          </Link>
          <div style={{ display: 'flex', gap: 28, marginLeft: 48, flex: 1 }}>
            {[['all', 'Shop All'], ['tees', 'Tees'], ['polos', 'Polos'], ['hoodies', 'Hoodies']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setActiveFilter(val)}
                style={{ background: 'none', border: 'none', fontFamily: FONT_SANS, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: activeFilter === val ? GOLD : MUTED, cursor: 'pointer', padding: '4px 0', borderBottom: `1px solid ${activeFilter === val ? GOLD : 'transparent'}`, transition: 'color .2s' }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCartOpen(true)}
            style={{ position: 'relative', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '8px 16px', color: TEXT, cursor: 'pointer', fontFamily: FONT_SANS, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span>Cart</span>
            {cartCount > 0 && (
              <span style={{ background: GOLD, color: '#0B0B0B', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{cartCount}</span>
            )}
          </button>
        </nav>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section style={{ textAlign: 'center', padding: '100px 24px 80px', position: 'relative' }}>
          <div style={{ width: 48, height: 1, background: GOLD, margin: '0 auto 32px' }} />
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 'clamp(42px, 6vw, 80px)', fontWeight: 600, color: TEXT, lineHeight: 1.1, letterSpacing: '-1px', maxWidth: 800, margin: '0 auto 24px', whiteSpace: 'pre-line' }}>
            {hero.headline || 'Build something the world\ncan\'t take back.'}
          </h1>
          <p style={{ fontFamily: FONT_SANS, fontSize: 15, color: MUTED, maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.7, letterSpacing: '.3px' }}>
            {hero.tagline || 'Representing the standard you live by — not just what you wear.'}
          </p>
          <button
            onClick={() => document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' })}
            style={{ padding: '14px 36px', background: GOLD, color: '#0B0B0B', border: 'none', borderRadius: 4, fontFamily: FONT_SANS, fontWeight: 800, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer' }}
          >
            {hero.cta || 'Shop the Collection'}
          </button>
          <div style={{ width: 48, height: 1, background: GOLD, margin: '40px auto 0' }} />
        </section>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 80px' }}>

          {/* ── Featured ──────────────────────────────────────────────────── */}
          {activeFilter === 'all' && featured.length > 0 && (
            <section style={{ marginBottom: 80 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36 }}>
                <div style={{ width: 32, height: 1, background: GOLD }} />
                <span style={{ fontFamily: FONT_SANS, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: GOLD }}>Featured</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
                {featured.map(p => <ProductCard key={p.sku} product={p} onAddToCart={addToCart} />)}
              </div>
            </section>
          )}

          {/* ── New Arrivals ───────────────────────────────────────────────── */}
          {activeFilter === 'all' && newItems.length > 0 && (
            <section style={{ marginBottom: 80 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36 }}>
                <div style={{ width: 32, height: 1, background: GOLD }} />
                <span style={{ fontFamily: FONT_SANS, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: GOLD }}>New Arrivals</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
                {newItems.map(p => <ProductCard key={p.sku} product={p} onAddToCart={addToCart} />)}
              </div>
            </section>
          )}

          {/* ── Full collection ────────────────────────────────────────────── */}
          <section id="collection">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36 }}>
              <div style={{ width: 32, height: 1, background: GOLD }} />
              <span style={{ fontFamily: FONT_SANS, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: GOLD }}>
                {activeFilter === 'all' ? 'All Products' : activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}
              </span>
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: MUTED, fontFamily: FONT_SANS }}>Loading collection…</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
                {filtered.map(p => <ProductCard key={p.sku} product={p} onAddToCart={addToCart} />)}
              </div>
            )}
          </section>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer style={{ borderTop: `1px solid ${BORDER}`, padding: '40px 32px', textAlign: 'center' }}>
          <p style={{ fontFamily: FONT_SERIF, fontSize: 20, color: GOLD, marginBottom: 16, letterSpacing: 1 }}>THE LEGACY LINK</p>
          <p style={{ fontFamily: FONT_SANS, fontSize: 11, color: MUTED, letterSpacing: .5, maxWidth: 600, margin: '0 auto' }}>
            {compliance || 'Apparel and merchandise are not affiliated with any insurance carrier.'}
          </p>
        </footer>

        {/* Cart drawer */}
        {cartOpen && (
          <CartDrawer
            cart={cart}
            onClose={() => setCartOpen(false)}
            onUpdate={updateQty}
            onRemove={removeItem}
            onCheckout={() => { setCartOpen(false); checkout(); }}
          />
        )}

        {checkingOut && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: CARD_BG, border: `1px solid ${GOLD}44`, borderRadius: 12, padding: '32px 48px', textAlign: 'center' }}>
              <p style={{ fontFamily: FONT_SERIF, fontSize: 20, color: GOLD, marginBottom: 8 }}>Redirecting to checkout…</p>
              <p style={{ fontFamily: FONT_SANS, fontSize: 13, color: MUTED }}>You will be taken to Stripe secure checkout.</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
