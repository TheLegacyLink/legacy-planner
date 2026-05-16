'use client';
import { useEffect } from 'react';
import Link from 'next/link';

const GOLD = '#C8A45A'; const BG = '#1A1A1A'; const CARD = '#0B0B0B'; const TEXT = '#F2F0EA'; const MUTED = '#9A968D';
const FS = '"Cormorant Garamond","Georgia",serif'; const SANS = '"Inter",system-ui,sans-serif';

export default function StoreSuccess() {
  useEffect(() => {
    try { localStorage.removeItem('ll_store_cart_v1'); } catch {}
  }, []);
  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Inter:wght@400;700&display=swap');`}</style>
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: CARD, border: `1px solid ${GOLD}44`, borderRadius: 8, padding: '60px 48px', textAlign: 'center', maxWidth: 480, width: '100%' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', border: `2px solid ${GOLD}`, margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>✓</div>
          <h1 style={{ fontFamily: FS, fontSize: 36, color: GOLD, fontWeight: 600, marginBottom: 12 }}>Order Confirmed</h1>
          <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, lineHeight: 1.7, marginBottom: 32 }}>
            Thank you for representing The Legacy Link. Your order is confirmed and will be fulfilled by Printful. You will receive a tracking email once it ships.
          </p>
          <Link href="/store" style={{ display: 'inline-block', padding: '12px 32px', background: GOLD, color: '#0B0B0B', borderRadius: 4, fontFamily: SANS, fontWeight: 800, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', textDecoration: 'none' }}>
            Continue Shopping
          </Link>
        </div>
      </div>
    </>
  );
}
