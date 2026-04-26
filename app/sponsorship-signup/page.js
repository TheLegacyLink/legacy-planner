'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const TESTIMONIALS = [
  {
    name: 'Kristi J.',
    src: 'https://www.loom.com/share/c9cc33569a4c4877ad996d3dc0734639',
    result: 'Clear path and confidence to move forward quickly.'
  },
  {
    name: 'Shadae W.',
    src: 'https://www.loom.com/share/9306913479e842ae997c2492a1383859',
    result: 'Momentum and support from day one of sponsorship.'
  },
  {
    name: 'Jen P.',
    src: 'https://www.loom.com/share/d17e071c6bd341c29b3315ff5908f709',
    result: 'Consistency and execution through the Legacy Link system.'
  },
  {
    name: 'Tee B.',
    src: 'https://www.loom.com/share/a31533ced62d4bb4bed9c2f6db8e2b14',
    result: 'Proof that structure and follow-up creates production.'
  }
];

const GOOGLE_REVIEWS = [
  { name: 'Leggerd Gray', text: 'Amazing support, real dedication, and a team that truly helps you win.' },
  { name: 'Jahaira Miranda', text: 'Motivates you to move fast, take action, and level up with the team.' },
  { name: 'Renae Cole', text: 'Legacy Link supports spiritual, mental, physical, and financial growth — with real community impact.' },
  { name: 'Donna Canty', text: '10/10 experience.' },
  { name: 'Getta Jones', text: 'Mentorship and weekly trainings made this feel like the right home from day one.' },
  { name: 'Big Mike St Louis', text: 'Switched from other IMOs, found real training and integrity here, and now seeing positive cash flow as an agency owner.' }
];

const WHAT_YOU_GET = [
  { icon: '📋', title: 'Licensing Support', desc: 'We walk you through every step. Licensed or not, we get you set up right.' },
  { icon: '💻', title: 'CRM + Lead Access', desc: 'Real leads. Real system. No hunting on your own from day one.' },
  { icon: '🎯', title: 'Weekly Training', desc: 'Live sessions, recordings, and playbooks so you always know the next move.' },
  { icon: '📞', title: 'Scripts & Objections', desc: 'Know exactly what to say. Day-1 ready with proven talk tracks.' },
  { icon: '🏆', title: 'Mentorship', desc: 'Direct access to leadership. You\'re not doing this alone.' },
  { icon: '🔗', title: 'Day-1 Playbook', desc: 'Zero guessing. A proven roadmap from zero to your first check.' }
];

const ROADMAP = [
  { label: 'Start', value: '$0', sub: 'No upfront cost' },
  { label: 'First Check', value: '$2,500', sub: 'Month 1 target' },
  { label: 'Momentum', value: '$5,000', sub: 'Month 2–3' },
  { label: 'Full-Time', value: '$10K/mo', sub: 'Consistent production' },
  { label: 'Leadership', value: 'Agency', sub: 'Build your team' }
];

function normalizeRef(ref = '') {
  const cleaned = String(ref).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (cleaned === 'latricia_wright') return 'leticia_wright';
  return cleaned;
}

function loomEmbedUrl(url = '') {
  return String(url || '').replace('/share/', '/embed/');
}

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#1d4ed8','#0f766e','#7c3aed','#b45309','#0369a1','#065f46'];

export default function SponsorshipSignupPage() {
  const router = useRouter();
  const [ref, setRef] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [error, setError] = useState('');
  const [activeOverview, setActiveOverview] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(null);
  const [faqOpen, setFaqOpen] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    // Default to Kimora Link if no ref code provided
    setRef(normalizeRef(sp.get('ref') || 'kimora_link'));
  }, []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = (e) => {
    e.preventDefault();
    const phone = String(form.phone || '').replace(/\D/g, '');
    if (!form.firstName.trim() || !form.lastName.trim() || phone.length < 10) {
      setError('Please complete first name, last name, and a valid phone number.');
      return;
    }

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone,
      refCode: ref,
      createdAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('legacy-sponsor-signup', JSON.stringify(payload));
    }

    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    router.push(`/sponsorship-application${query}`);
  };

  return (
    <>
      <style>{`
        .sp-page {
          min-height: 100vh;
          background: #06090f;
          color: #f1f5f9;
          font-family: Inter, Arial, sans-serif;
        }

        /* HERO */
        .sp-hero {
          position: relative;
          padding: 60px 20px 64px;
          text-align: center;
          background:
            radial-gradient(ellipse 80% 60% at 50% -10%, rgba(212,175,55,0.13) 0%, transparent 70%),
            linear-gradient(180deg, #0d1117 0%, #06090f 100%);
          border-bottom: 1px solid rgba(212,175,55,0.15);
          overflow: hidden;
        }
        .sp-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 80% 20%, rgba(29,78,216,0.08), transparent 50%);
          pointer-events: none;
        }
        .sp-hero-logo {
          width: 80px; height: 80px;
          border-radius: 0;
          object-fit: contain;
          background: transparent;
          padding: 0;
          border: none;
          box-shadow: none;
          margin: 0 auto 20px;
          display: block;
        }
        .sp-hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #d4af37;
          background: rgba(212,175,55,0.08);
          border: 1px solid rgba(212,175,55,0.25);
          border-radius: 999px;
          padding: 5px 14px;
          margin-bottom: 20px;
        }
        .sp-hero-headline {
          font-size: clamp(32px, 6vw, 58px);
          font-weight: 900;
          line-height: 1.08;
          letter-spacing: -0.5px;
          color: #ffffff;
          margin: 0 auto 16px;
          max-width: 780px;
        }
        .sp-hero-headline span {
          background: linear-gradient(90deg, #d4af37, #f5d060);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .sp-hero-sub {
          font-size: 18px;
          color: #94a3b8;
          line-height: 1.6;
          max-width: 560px;
          margin: 0 auto 32px;
        }
        .sp-hero-ctas {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 32px;
        }
        .sp-btn-primary {
          background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%);
          color: #06090f;
          border: none;
          border-radius: 12px;
          padding: 16px 28px;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 0.3px;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(212,175,55,0.35);
          transition: all 220ms ease;
          animation: goldPulse 2s ease-in-out infinite;
        }
        .sp-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(212,175,55,0.45); }
        @keyframes goldPulse {
          0%, 100% { box-shadow: 0 8px 24px rgba(212,175,55,0.35); }
          50% { box-shadow: 0 12px 32px rgba(212,175,55,0.55); }
        }
        .sp-btn-ghost {
          background: rgba(255,255,255,0.04);
          color: #cbd5e1;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          padding: 16px 24px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 180ms ease;
        }
        .sp-btn-ghost:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.22); color: #fff; }

        /* TRUST BAR */
        .sp-trust {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 28px;
          flex-wrap: wrap;
          padding: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: #0a0d14;
        }
        .sp-trust-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #94a3b8;
        }
        .sp-trust-item .icon { font-size: 16px; }
        .sp-trust-stars { color: #f59e0b; letter-spacing: 2px; }

        /* SECTION WRAPPERS */
        .sp-section {
          max-width: 1020px;
          margin: 0 auto;
          padding: 60px 20px;
        }
        .sp-section-label {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #d4af37;
          margin-bottom: 10px;
        }
        .sp-section-title {
          font-size: clamp(24px, 4vw, 38px);
          font-weight: 800;
          color: #fff;
          margin: 0 0 10px;
          line-height: 1.2;
        }
        .sp-section-sub {
          color: #64748b;
          font-size: 16px;
          margin: 0 0 40px;
        }

        /* BENEFITS GRID */
        .sp-benefits-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }
        .sp-benefit-card {
          background: linear-gradient(160deg, #0f1421, #0a0d14);
          border: 1px solid rgba(212,175,55,0.12);
          border-radius: 16px;
          padding: 22px;
          transition: border-color 200ms ease, transform 200ms ease;
        }
        .sp-benefit-card:hover { border-color: rgba(212,175,55,0.3); transform: translateY(-2px); }
        .sp-benefit-icon { font-size: 28px; margin-bottom: 12px; }
        .sp-benefit-title { font-size: 16px; font-weight: 700; color: #f1f5f9; margin: 0 0 8px; }
        .sp-benefit-desc { font-size: 14px; color: #64748b; margin: 0; line-height: 1.6; }

        /* DIVIDER */
        .sp-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212,175,55,0.2), transparent);
          margin: 0 20px;
        }

        /* ROADMAP */
        .sp-roadmap {
          display: flex;
          align-items: stretch;
          gap: 0;
          margin-top: 16px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .sp-roadmap-step {
          flex: 1;
          min-width: 140px;
          text-align: center;
          padding: 20px 12px;
          position: relative;
          background: linear-gradient(180deg, #0f1421, #0a0e1a);
          border: 1px solid rgba(255,255,255,0.06);
          border-right: none;
        }
        .sp-roadmap-step:first-child { border-radius: 14px 0 0 14px; }
        .sp-roadmap-step:last-child { border-radius: 0 14px 14px 0; border-right: 1px solid rgba(255,255,255,0.06); }
        .sp-roadmap-step.active-step {
          background: linear-gradient(180deg, #1a1506, #110e03);
          border-color: rgba(212,175,55,0.3);
          border-right: none;
          z-index: 1;
        }
        .sp-roadmap-step.active-step:last-child { border-right: 1px solid rgba(212,175,55,0.3); }
        .sp-roadmap-step-num {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #475569;
          margin-bottom: 8px;
        }
        .sp-roadmap-step.active-step .sp-roadmap-step-num { color: #d4af37; }
        .sp-roadmap-step-value {
          font-size: 22px;
          font-weight: 800;
          color: #f1f5f9;
          margin-bottom: 6px;
        }
        .sp-roadmap-step.active-step .sp-roadmap-step-value { color: #d4af37; }
        .sp-roadmap-step-sub {
          font-size: 12px;
          color: #475569;
        }
        .sp-roadmap-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(212,175,55,0.4);
          font-size: 18px;
          padding: 0 4px;
          flex-shrink: 0;
        }

        /* TESTIMONIALS */
        .sp-test-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-top: 8px;
        }
        .sp-test-card {
          background: linear-gradient(160deg, #0f1421, #0a0d14);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 20px;
          display: grid;
          gap: 12px;
          transition: border-color 200ms ease;
        }
        .sp-test-card:hover { border-color: rgba(212,175,55,0.25); }
        .sp-test-name { font-size: 15px; font-weight: 700; color: #f1f5f9; }
        .sp-test-result { font-size: 13px; color: #64748b; line-height: 1.5; margin: 0; }
        .sp-test-btn {
          background: rgba(212,175,55,0.07);
          color: #d4af37;
          border: 1px solid rgba(212,175,55,0.25);
          border-radius: 10px;
          padding: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 180ms ease;
          width: 100%;
        }
        .sp-test-btn:hover { background: rgba(212,175,55,0.14); border-color: rgba(212,175,55,0.45); }

        /* REVIEWS */
        .sp-reviews-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }
        .sp-review-card {
          background: linear-gradient(160deg, #0f1421, #0a0d14);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 20px;
          display: grid;
          gap: 10px;
          transition: border-color 200ms ease;
        }
        .sp-review-card:hover { border-color: rgba(245,158,11,0.3); }
        .sp-review-stars { color: #f59e0b; font-size: 14px; letter-spacing: 2px; }
        .sp-review-text { font-size: 14px; color: #94a3b8; line-height: 1.65; margin: 0; font-style: italic; }
        .sp-review-author { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
        .sp-review-avatar {
          width: 32px; height: 32px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: 800;
          color: #fff;
          flex-shrink: 0;
        }
        .sp-review-name { font-size: 13px; font-weight: 700; color: #cbd5e1; }

        /* STATS BAR */
        .sp-stats-strip {
          display: grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap: 12px;
          margin-top: 48px;
        }
        .sp-stat-box {
          background: linear-gradient(160deg, #0f1421, #0a0d14);
          border: 1px solid rgba(212,175,55,0.15);
          border-radius: 16px;
          padding: 22px 16px;
          text-align: center;
        }
        .sp-stat-value { font-size: 28px; font-weight: 800; color: #d4af37; margin: 0 0 4px; }
        .sp-stat-label { font-size: 13px; color: #64748b; }

        /* VIDEO */
        .sp-video-wrap {
          position: relative;
          padding-bottom: 56.25%;
          height: 0;
          border-radius: 14px;
          overflow: hidden;
          background: #0a0d14;
          border: 1px solid rgba(255,255,255,0.08);
          margin-top: 8px;
        }
        .sp-video-wrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; }

        /* FAQ */
        .sp-faq-list { display: grid; gap: 10px; }
        .sp-faq-item {
          background: linear-gradient(160deg, #0f1421, #0a0d14);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 180ms ease;
        }
        .sp-faq-item.open { border-color: rgba(212,175,55,0.25); }
        .sp-faq-question {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 20px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
          color: #f1f5f9;
          gap: 12px;
          background: none;
          border: none;
          width: 100%;
          text-align: left;
        }
        .sp-faq-question:hover { color: #d4af37; }
        .sp-faq-chevron { color: #475569; font-size: 18px; flex-shrink: 0; transition: transform 200ms ease; }
        .sp-faq-item.open .sp-faq-chevron { transform: rotate(180deg); color: #d4af37; }
        .sp-faq-answer {
          padding: 0 20px 18px;
          font-size: 14px;
          color: #64748b;
          line-height: 1.65;
        }

        /* APPLY SECTION */
        .sp-apply-section {
          background: linear-gradient(180deg, #0a0d14 0%, #06090f 100%);
          border-top: 1px solid rgba(212,175,55,0.15);
        }
        .sp-apply-inner {
          max-width: 680px;
          margin: 0 auto;
          padding: 64px 20px;
        }
        .sp-apply-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #d4af37;
          background: rgba(212,175,55,0.08);
          border: 1px solid rgba(212,175,55,0.25);
          border-radius: 999px;
          padding: 5px 14px;
          margin-bottom: 16px;
        }
        .sp-apply-title {
          font-size: clamp(26px, 4vw, 38px);
          font-weight: 900;
          color: #fff;
          margin: 0 0 12px;
          line-height: 1.15;
        }
        .sp-apply-sub {
          color: #64748b;
          font-size: 15px;
          margin: 0 0 32px;
          line-height: 1.6;
        }
        .sp-form {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .sp-form-group {
          display: grid;
          gap: 7px;
        }
        .sp-form-group.full { grid-column: 1 / -1; }
        .sp-form-label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: #64748b;
        }
        .sp-form-input {
          background: rgba(255,255,255,0.04);
          color: #f1f5f9;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 14px 16px;
          font-size: 15px;
          width: 100%;
          transition: border-color 180ms ease, box-shadow 180ms ease;
        }
        .sp-form-input::placeholder { color: #475569; }
        .sp-form-input:focus {
          outline: none;
          border-color: rgba(212,175,55,0.5);
          box-shadow: 0 0 0 3px rgba(212,175,55,0.08);
        }
        .sp-submit-btn {
          grid-column: 1 / -1;
          background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%);
          color: #06090f;
          border: none;
          border-radius: 12px;
          padding: 18px;
          font-size: 17px;
          font-weight: 900;
          letter-spacing: 0.5px;
          cursor: pointer;
          box-shadow: 0 10px 28px rgba(212,175,55,0.3);
          transition: all 220ms ease;
          text-transform: uppercase;
          animation: goldPulse 2s ease-in-out infinite;
          margin-top: 4px;
        }
        .sp-submit-btn:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(212,175,55,0.45); }
        .sp-form-disclaimer {
          grid-column: 1 / -1;
          text-align: center;
          font-size: 12px;
          color: #475569;
          margin-top: -4px;
        }
        .sp-form-error {
          grid-column: 1 / -1;
          color: #f87171;
          font-size: 13px;
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.2);
          border-radius: 10px;
          padding: 10px 14px;
        }
        .sp-ref-badge {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #86efac;
          background: rgba(134,239,172,0.06);
          border: 1px solid rgba(134,239,172,0.2);
          border-radius: 10px;
          padding: 10px 14px;
          font-weight: 600;
        }

        /* MODAL */
        .sp-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 60;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(6px);
          display: grid;
          place-items: center;
          padding: 16px;
        }
        .sp-modal-box {
          background: #0f1421;
          border: 1px solid rgba(212,175,55,0.2);
          border-radius: 20px;
          padding: 20px;
          width: min(900px, 96vw);
          box-shadow: 0 24px 60px rgba(0,0,0,0.6);
        }
        .sp-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .sp-modal-title { font-size: 18px; font-weight: 700; color: #f1f5f9; margin: 0; }
        .sp-modal-close {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 13px;
          cursor: pointer;
        }
        .sp-modal-close:hover { color: #fff; border-color: rgba(255,255,255,0.25); }
        .sp-modal-sub { font-size: 13px; color: #64748b; margin: 8px 0 0; }

        /* RESPONSIVE */
        @media (max-width: 640px) {
          .sp-hero { padding: 40px 16px 48px; }
          .sp-section { padding: 48px 16px; }
          .sp-form { grid-template-columns: 1fr; }
          .sp-form-group.full { grid-column: 1; }
          .sp-submit-btn { grid-column: 1; }
          .sp-form-disclaimer { grid-column: 1; }
          .sp-form-error { grid-column: 1; }
          .sp-ref-badge { grid-column: 1; }
          .sp-stats-strip { grid-template-columns: 1fr; }
          .sp-roadmap { gap: 4px; }
          .sp-roadmap-step { min-width: 100px; }
          .sp-apply-inner { padding: 48px 16px; }
        }
      `}</style>

      <div className="sp-page">

        {/* ─── HERO ─── */}
        <section className="sp-hero">
          <img src="/legacy-link-logo-official.png" alt="Legacy Link" className="sp-hero-logo" style={{ filter: 'invert(1)' }} />
          <div className="sp-hero-eyebrow">🔒 Limited Sponsorship Spots Available</div>
          <h1 className="sp-hero-headline">
            Get Sponsored.<br />
            Get Paid.<br />
            <span>Build Your Legacy.</span>
          </h1>
          <p className="sp-hero-sub">
            We remove every barrier — licensing, CRM, leads, training — so you can start earning immediately and grow with a system that's already proven.
          </p>
          <div className="sp-hero-ctas">
            <a href="#apply" style={{ textDecoration: 'none' }}>
              <button type="button" className="sp-btn-primary">Start My Sponsored Application →</button>
            </a>
            <button type="button" className="sp-btn-ghost" onClick={() => setActiveOverview(true)}>▶ Watch 2-Minute Overview</button>
            <a href="#success-stories" style={{ textDecoration: 'none' }}>
              <button type="button" className="sp-btn-ghost">Success Stories</button>
            </a>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['✓ No Upfront Cost', '✓ Live + On-Demand Training', '✓ CRM + Lead Access'].map(t => (
              <span key={t} style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '5px 14px' }}>{t}</span>
            ))}
          </div>
        </section>

        {/* ─── TRUST BAR ─── */}
        <div className="sp-trust">
          <div className="sp-trust-item"><span className="sp-trust-stars">★★★★★</span> 5-Star Google Reviews</div>
          <div className="sp-trust-item"><span className="icon">🏆</span> 30 Verified Testimonials</div>
          <div className="sp-trust-item"><span className="icon">📅</span> Mon–Sat Support</div>
          <div className="sp-trust-item"><span className="icon">⚡</span> 24h Review Target</div>
        </div>

        {/* ─── WHAT YOU GET ─── */}
        <section className="sp-section">
          <div className="sp-section-label">The Package</div>
          <h2 className="sp-section-title">Everything You Need. Day One.</h2>
          <p className="sp-section-sub">No guessing. No hunting. Everything is already built — you just plug in and execute.</p>
          <div className="sp-benefits-grid">
            {WHAT_YOU_GET.map(item => (
              <div key={item.title} className="sp-benefit-card">
                <div className="sp-benefit-icon">{item.icon}</div>
                <div className="sp-benefit-title">{item.title}</div>
                <p className="sp-benefit-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="sp-divider" />

        {/* ─── INCOME ROADMAP ─── */}
        <section className="sp-section" style={{ paddingTop: 60, paddingBottom: 60 }}>
          <div className="sp-section-label">Your Path</div>
          <h2 className="sp-section-title">From Zero to Legacy</h2>
          <p className="sp-section-sub">This is the roadmap. Most people hit their first check within 30 days.</p>
          <div className="sp-roadmap">
            {ROADMAP.map((step, i) => (
              <div key={step.label} className={`sp-roadmap-step${i === 3 ? ' active-step' : ''}`}>
                <div className="sp-roadmap-step-num">{step.label}</div>
                <div className="sp-roadmap-step-value">{step.value}</div>
                <div className="sp-roadmap-step-sub">{step.sub}</div>
              </div>
            ))}
          </div>
          <div className="sp-stats-strip">
            <div className="sp-stat-box">
              <div className="sp-stat-value">$0</div>
              <div className="sp-stat-label">Upfront to get started</div>
            </div>
            <div className="sp-stat-box">
              <div className="sp-stat-value">24h</div>
              <div className="sp-stat-label">Average review turnaround</div>
            </div>
            <div className="sp-stat-box">
              <div className="sp-stat-value">Day 1</div>
              <div className="sp-stat-label">You have a playbook ready</div>
            </div>
          </div>
        </section>

        <div className="sp-divider" />

        {/* ─── SUCCESS STORIES ─── */}
        <section className="sp-section" id="success-stories">
          <div className="sp-section-label">Proof</div>
          <h2 className="sp-section-title">Real People. Real Results.</h2>
          <p className="sp-section-sub">These aren't actors. These are Legacy Link sponsees — click to watch their story.</p>
          <div className="sp-test-grid">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="sp-test-card">
                <div className="sp-test-name">{t.name}</div>
                <p className="sp-test-result">"{t.result}"</p>
                <button type="button" className="sp-test-btn" onClick={() => setActiveTestimonial(t)}>
                  ▶ Watch Testimony
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="sp-divider" />

        {/* ─── GOOGLE REVIEWS ─── */}
        <section className="sp-section">
          <div className="sp-section-label">Community</div>
          <h2 className="sp-section-title">What People Are Saying</h2>
          <p className="sp-section-sub">Verified 5-star Google reviews from Legacy Link clients and agents.</p>
          <div className="sp-reviews-grid">
            {GOOGLE_REVIEWS.map((r, i) => (
              <div key={r.name} className="sp-review-card">
                <div className="sp-review-stars">★★★★★</div>
                <p className="sp-review-text">"{r.text}"</p>
                <div className="sp-review-author">
                  <div className="sp-review-avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                    {getInitials(r.name)}
                  </div>
                  <span className="sp-review-name">{r.name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="sp-divider" />

        {/* ─── HOW TO APPLY VIDEO ─── */}
        <section className="sp-section">
          <div className="sp-section-label">Watch This First</div>
          <h2 className="sp-section-title">How the Sponsorship Works</h2>
          <p className="sp-section-sub">2 minutes. Everything you need to know before you apply.</p>
          <div className="sp-video-wrap">
            <iframe
              src="https://www.loom.com/embed/71356efcc71c4959a71106a1147d0b7d"
              title="Legacy Link Sponsorship Video"
              frameBorder="0"
              allowFullScreen
            />
          </div>
        </section>

        <div className="sp-divider" />

        {/* ─── FAQ ─── */}
        <section className="sp-section">
          <div className="sp-section-label">Questions</div>
          <h2 className="sp-section-title">Frequently Asked</h2>
          <p className="sp-section-sub">Everything you're probably wondering about before you apply.</p>
          <div className="sp-faq-list">
            {[
              { q: 'Do I need to be licensed to apply?', a: 'No. We sponsor both licensed and unlicensed applicants. We will walk you through the licensing process as part of your onboarding.' },
              { q: 'How long does the review take?', a: 'Manual review candidates are contacted within 1–2 business days. Most hear back the same day.' },
              { q: 'What happens if I\'m approved?', a: 'You immediately book a call and begin your onboarding steps. You\'ll have your day-1 playbook, CRM access, and a point of contact assigned.' },
              { q: 'Is there really no upfront cost?', a: 'Correct. The sponsorship program is designed to remove every financial barrier. You start earning before you spend anything.' },
              { q: 'What does the training look like?', a: 'Live weekly sessions plus on-demand recordings, scripts, objection handling guides, and a full playbook — all accessible from day one.' }
            ].map((item, i) => (
              <div key={i} className={`sp-faq-item${faqOpen === i ? ' open' : ''}`}>
                <button type="button" className="sp-faq-question" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                  {item.q}
                  <span className="sp-faq-chevron">⌄</span>
                </button>
                {faqOpen === i && <div className="sp-faq-answer">{item.a}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* ─── APPLY FORM ─── */}
        <div className="sp-apply-section" id="apply">
          <div className="sp-apply-inner">
            <div className="sp-apply-badge">🚀 Apply Now — Spots Are Limited</div>
            <h2 className="sp-apply-title">Start Your Sponsored Application</h2>
            <p className="sp-apply-sub">
              Complete this quick profile to continue. Your point of contact will be assigned after submission. Takes less than 2 minutes.
            </p>
            <form className="sp-form" onSubmit={onSubmit}>
              {ref && (
                <div className="sp-ref-badge">
                  ✅ Your referral attribution is secured.
                </div>
              )}
              <div className="sp-form-group">
                <label className="sp-form-label">First Name</label>
                <input
                  className="sp-form-input"
                  placeholder="Enter first name"
                  value={form.firstName}
                  onChange={(e) => update('firstName', e.target.value)}
                />
              </div>
              <div className="sp-form-group">
                <label className="sp-form-label">Last Name</label>
                <input
                  className="sp-form-input"
                  placeholder="Enter last name"
                  value={form.lastName}
                  onChange={(e) => update('lastName', e.target.value)}
                />
              </div>
              <div className="sp-form-group full">
                <label className="sp-form-label">Phone Number</label>
                <input
                  className="sp-form-input"
                  placeholder="(000) 000-0000"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                />
              </div>
              {error && <div className="sp-form-error">⚠ {error}</div>}
              <button type="submit" className="sp-submit-btn">🚀 Start My Application Now</button>
              <div className="sp-form-disclaimer">
                Takes less than 2 minutes • Limited sponsorship spots each month • No upfront cost
              </div>
            </form>
          </div>
        </div>

      </div>

      {/* ─── OVERVIEW MODAL ─── */}
      {activeOverview && (
        <div className="sp-modal-overlay" role="dialog" aria-modal="true" onClick={() => setActiveOverview(false)}>
          <div className="sp-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-header">
              <h3 className="sp-modal-title">2-Minute Overview</h3>
              <button type="button" className="sp-modal-close" onClick={() => setActiveOverview(false)}>Close</button>
            </div>
            <div className="sp-video-wrap">
              <iframe
                src="https://www.loom.com/embed/71356efcc71c4959a71106a1147d0b7d"
                title="Legacy Link Sponsorship Video"
                frameBorder="0"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── TESTIMONIAL MODAL ─── */}
      {activeTestimonial && (
        <div className="sp-modal-overlay" role="dialog" aria-modal="true" onClick={() => setActiveTestimonial(null)}>
          <div className="sp-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-header">
              <h3 className="sp-modal-title">{activeTestimonial.name}</h3>
              <button type="button" className="sp-modal-close" onClick={() => setActiveTestimonial(null)}>Close</button>
            </div>
            <div className="sp-video-wrap">
              <iframe
                src={loomEmbedUrl(activeTestimonial.src)}
                title={`${activeTestimonial.name} Testimonial`}
                frameBorder="0"
                allowFullScreen
              />
            </div>
            <p className="sp-modal-sub">"{activeTestimonial.result}"</p>
          </div>
        </div>
      )}
    </>
  );
}
