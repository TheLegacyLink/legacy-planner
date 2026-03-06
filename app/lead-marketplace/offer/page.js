'use client';

import { useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'legacy_lead_marketplace_user_v1';
const OFFER_SECONDS = 120;

function clean(v = '') {
  return String(v || '').trim();
}

function fmtClock(s = 0) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function OfferPage() {
  const [auth, setAuth] = useState({ name: '', email: '', role: '' });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [offer, setOffer] = useState({ amountUsd: 75, leadCount: 2, availableCount: 0, canClaimNow: false });
  const [secondsLeft, setSecondsLeft] = useState(OFFER_SECONDS);

  const sessionId = useMemo(() => {
    const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    return clean(params.get('session_id'));
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      if (saved?.name) setAuth({ name: saved.name, email: saved.email || '', role: saved.role || '' });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setMessage('Offer session missing. Redirecting...');
      setTimeout(() => window.location.assign('/lead-marketplace'), 1200);
      return;
    }

    let active = true;

    async function loadPreview() {
      setLoading(true);
      const res = await fetch('/api/lead-marketplace/upsell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', sourceSessionId: sessionId })
      });
      const data = await res.json().catch(() => ({}));
      if (!active) return;

      if (res.ok && data?.ok && data?.offer) {
        setOffer(data.offer);
      } else {
        setMessage('Offer is unavailable right now.');
      }
      setLoading(false);
    }

    loadPreview();
    return () => { active = false; };
  }, [sessionId]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  async function acceptOffer() {
    if (!sessionId || processing || secondsLeft <= 0) return;

    setProcessing(true);
    setMessage('Processing your one-click offer...');

    const res = await fetch('/api/lead-marketplace/upsell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'accept',
        sourceSessionId: sessionId,
        buyerName: auth.name,
        buyerEmail: auth.email,
        buyerRole: auth.role,
        origin: window.location.origin
      })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.ok) {
      window.location.assign('/lead-marketplace?upsell=success');
      return;
    }

    if (data?.requiresCheckout && data?.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }

    const friendly = data?.error === 'insufficient_tier1_inventory'
      ? 'Offer unavailable: not enough Tier 1 inventory right now.'
      : 'Unable to process offer right now. Please try once more.';
    setMessage(friendly);
    setProcessing(false);
  }

  function skipOffer() {
    window.location.assign('/lead-marketplace');
  }

  return (
    <main className="claimsPortal claimsPortalMarketplace" style={{ minHeight: '100vh' }}>
      <section className="claimsHeader marketplaceHeader">
        <div>
          <h1>🎉 Limited-Time Offer</h1>
          <p>Nice work{auth.name ? `, ${auth.name}` : ''}. Add 2 more Tier 1 leads right now at a special price.</p>
        </div>
      </section>

      <section className="panel" style={{ maxWidth: 860, margin: '18px auto', border: '2px solid #5b21b6', background: '#ffffff', color: '#0f172a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#4338ca' }}>Post-Purchase Deal</p>
            <h2 style={{ margin: '6px 0 0' }}>Get {offer.leadCount} Tier 1 Leads for ${offer.amountUsd} total</h2>
            <p className="muted" style={{ marginTop: 8, color: '#334155' }}>You just completed checkout. Your payment info is already on file.</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="muted" style={{ margin: 0, color: '#475569', fontWeight: 700 }}>Offer expires in</p>
            <div style={{ fontSize: 40, fontWeight: 900, color: secondsLeft <= 15 ? '#b91c1c' : '#111827', letterSpacing: 1 }}>{fmtClock(secondsLeft)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <span className="pill" style={{ background: '#dcfce7', color: '#166534' }}>Inventory now: {offer.availableCount} Tier 1 leads</span>
          <span className="pill" style={{ background: '#eef2ff', color: '#3730a3' }}>One click to add more</span>
        </div>

        {message ? (
          <p className="pill" style={{ marginTop: 12, background: '#dbeafe', color: '#1e3a8a' }}>{message}</p>
        ) : null}

        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="publicPrimaryBtn"
            disabled={loading || processing || secondsLeft <= 0 || !offer.canClaimNow}
            onClick={acceptOffer}
            style={{ minWidth: 250 }}
          >
            {processing ? 'Processing...' : `Yes — Add ${offer.leadCount} Leads for $${offer.amountUsd}`}
          </button>

          <button type="button" className="ghost" onClick={skipOffer}>No thanks, go to inventory</button>
        </div>

        {secondsLeft <= 0 ? (
          <p className="muted" style={{ marginTop: 10 }}>Offer expired. You can still buy individual leads from inventory.</p>
        ) : null}
      </section>
    </main>
  );
}
