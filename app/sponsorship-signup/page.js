'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';

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
  { label: 'Start', value: '$0', sub: 'No upfront cost with Coach Financing' },
  { label: 'Month 1', value: '$1,512', sub: 'First issued application' },
  { label: 'Month 3', value: '$7,953', sub: 'Conservative steady-state, gross' },
  { label: 'Month 6', value: '$7,753', sub: 'Take-home after tuition clears', highlight: true },
  { label: 'Year 2', value: 'Elite', sub: 'By invitation. 90 leads, 80% split.' }
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
    const refCode = normalizeRef(sp.get('ref') || 'kimora_link');
    setRef(refCode);
    // Internal analytics tracking
    fetch('/api/sponsorship-analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'page_view', refCode, page: 'signup' })
    }).catch(() => {});
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
            radial-gradient(ellipse 80% 60% at 50% -10%, rgba(212,175,55,0.18) 0%, transparent 70%),
            linear-gradient(180deg, #0a1628 0%, #06090f 100%);
          border-bottom: 1px solid rgba(212,175,55,0.2);
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
          background: linear-gradient(160deg, #0d1e35, #091525);
          border: 1px solid rgba(212,175,55,0.18);
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
          background: linear-gradient(180deg, #0d1e35, #091525);
          border: 1px solid rgba(255,255,255,0.1);
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
          background: linear-gradient(160deg, #0d1e35, #091525);
          border: 1px solid rgba(255,255,255,0.12);
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
          background: linear-gradient(160deg, #0d1e35, #091525);
          border: 1px solid rgba(255,255,255,0.11);
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
          background: linear-gradient(160deg, #0d1e35, #091525);
          border: 1px solid rgba(212,175,55,0.22);
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
          background: linear-gradient(160deg, #0d1e35, #091525);
          border: 1px solid rgba(255,255,255,0.11);
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

        /* STICKY BAR */
        .sp-sticky-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 50;
          background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%);
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          box-shadow: 0 -4px 24px rgba(0,0,0,0.4);
          flex-wrap: wrap;
        }
        .sp-sticky-bar-text {
          font-size: 15px;
          font-weight: 700;
          color: #06090f;
        }
        .sp-sticky-bar-sub {
          font-size: 12px;
          color: rgba(6,9,15,0.6);
          margin-top: 1px;
        }
        .sp-sticky-btn {
          background: #06090f;
          color: #d4af37;
          border: none;
          border-radius: 10px;
          padding: 12px 24px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
          letter-spacing: 0.3px;
          transition: all 180ms ease;
        }
        .sp-sticky-btn:hover { background: #0f1421; }

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

      {/* Meta Pixel */}
      <Script id="meta-pixel" strategy="afterInteractive">{`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '1298624279121055');
        fbq('track', 'PageView');
      `}</Script>
      <noscript><img height="1" width="1" style={{display:'none'}} src="https://www.facebook.com/tr?id=1298624279121055&ev=PageView&noscript=1" alt="" /></noscript>

      <div className="sp-page">

        {/* ─── HERO ─── */}
        <section className="sp-hero">
          <img src="/legacy-link-seal.png" alt="Legacy Link" className="sp-hero-logo" style={{ filter: 'invert(1) brightness(1.1)' }} />
          <div className="sp-hero-eyebrow">🔒 Limited Sponsorship & Inner Circle Spots</div>
          <h1 className="sp-hero-headline">
            Get Sponsored.<br />
            Get Paid.<br />
            <span>Build Your Legacy.</span>
          </h1>
          <p className="sp-hero-sub">
            Two paths. Both start at $0 out of pocket. <strong style={{ color: '#d4af37' }}>Sponsorship</strong> for new agents. <strong style={{ color: '#d4af37' }}>Inner Circle</strong> for people ready to make the transition — tired of money being an issue, ready to build a legacy.
          </p>
          <div className="sp-hero-ctas">
            <a href="#apply" style={{ textDecoration: 'none' }}>
              <button type="button" className="sp-btn-primary" style={{ fontSize: 18, padding: '18px 36px' }}>Choose Your Path →</button>
            </a>
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 4 }}>
            <button type="button" onClick={() => setActiveOverview(true)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>▶ Watch 2-min overview</button>
            <a href="#success-stories" style={{ color: '#64748b', fontSize: 13 }}>See success stories</a>
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
          <div className="sp-trust-item"><span className="icon">🏆</span> Verified Testimonials</div>
          <div className="sp-trust-item"><span className="icon">📅</span> Mon–Sat Support</div>
          <div className="sp-trust-item"><span className="icon">⚡</span> 24h Review Target</div>
        </div>

        
      {/* ─── MENTOR PROOF SECTION ─── */}
      <section className="sp-section" style={{ paddingTop: 48, paddingBottom: 48, background: 'rgba(15,23,42,0.6)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="sp-section-label">Proof</div>
        <h2 className="sp-section-title" style={{ marginBottom: 6 }}>Your Mentor Doesn&apos;t Just Teach It. He Lives It.</h2>
        <p className="sp-section-sub" style={{ marginBottom: 32 }}>
          Real F&amp;G eTrack commission notifications — not projections, not someone else&apos;s income. This is what consistent production looks like inside The Legacy Link system.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <img
            src="/proof/nlg-commission.png"
            alt="National Life Group commission overview showing $96,654 payable"
            style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', display: 'block' }}
          />
          <img
            src="/proof/fg-commissions-1.png"
            alt="F&G eTrack commission notifications"
            style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', display: 'block' }}
          />
          <img
            src="/proof/fg-commissions-2.png"
            alt="F&G eTrack commission notifications"
            style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', display: 'block' }}
          />
          <img
            src="/proof/fg-commissions-3.png"
            alt="F&G eTrack commission notifications"
            style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', display: 'block' }}
          />
        </div>
        <p style={{ marginTop: 16, fontSize: 12, color: '#475569', textAlign: 'center' }}>
          Real F&amp;G eTrack commission emails. Address rows redacted. Individual results vary; income is not guaranteed.
        </p>
      </section>

{/* ─── EARNINGS SNAPSHOT ─── */}
        <section className="sp-section" style={{ paddingTop: 48, paddingBottom: 48 }}>
          <div className="sp-section-label">Choose Your Path</div>
          <h2 className="sp-section-title">What You Can Earn</h2>
          <p className="sp-section-sub">Two paths based on where you are right now. Both start with $0 out of pocket.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 16 }}>

            {/* FREE SPONSORSHIP PATH */}
            <div style={{ background: 'linear-gradient(160deg, #0d1e35, #091525)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 6 }}>Free Sponsorship Path</div>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 20 }}>Best for new agents getting their footing</div>

              <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: '#86efac', fontWeight: 600, marginBottom: 4 }}>What you can expect to earn</div>
                <div style={{ fontSize: 38, fontWeight: 900, color: '#fff', lineHeight: 1, marginBottom: 2 }}>$1,000<span style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>/mo</span></div>
                <div style={{ fontSize: 13, color: '#64748b' }}>on average</div>
              </div>

              <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#475569', marginBottom: 4 }}>Everyone Gets</div>
                {['$0 upfront — no credit check required', '20 starter leads to learn the system', '50% commission split', 'Full training + CRM included', 'Live + on-demand weekly sessions', 'Scripts, objections, and day-1 playbook', 'Mentorship and direct leadership access'].map(b => (
                  <div key={b} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#94a3b8' }}><span style={{ color: '#22c55e', fontWeight: 700, flexShrink: 0 }}>✓</span>{b}</div>
                ))}
              </div>

              <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#86efac', marginBottom: 10 }}>For Unlicensed Agents — We Cover It All</div>
                {[
                  'Pre-licensing course — paid for you',
                  'State license exam fee — paid for you',
                  'Fingerprinting — paid for you if required',
                  'E&O insurance covered for your first 90 days'
                ].map(b => (
                  <div key={b} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#86efac', marginBottom: 6 }}><span style={{ fontWeight: 700, flexShrink: 0 }}>✓</span>{b}</div>
                ))}
              </div>

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(148,163,184,0.15)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#64748b', marginBottom: 8 }}>Community Commitment</div>
              <div style={{ display: 'flex', gap: 10, fontSize: 13, color: '#94a3b8' }}><span style={{ color: '#60a5fa', fontWeight: 700, flexShrink: 0 }}>✓</span>1 hr/mo community service — church, mosque, school, food bank, Goodwill, Salvation Army, or Big Brother Big Sister</div>
            </div>

              <div style={{ marginTop: 'auto' }}>
                <a href="#apply" style={{ textDecoration: 'none' }}>
                  <button type="button" className="sp-btn-primary" style={{ width: '100%', fontSize: 14, padding: '14px 20px' }}>Apply for Sponsorship</button>
                </a>
              </div>
            </div>

            {/* INNER CIRCLE */}
            <div style={{ background: 'linear-gradient(160deg, #1a1506, #110e03)', border: '2px solid rgba(212,175,55,0.45)', borderRadius: 20, padding: 28, position: 'relative', display: 'grid', gap: 0 }}>
              <div style={{ position: 'absolute', top: -13, right: 20, background: '#d4af37', color: '#06090f', fontSize: 11, fontWeight: 800, padding: '4px 14px', borderRadius: 999, letterSpacing: 1 }}>MOST POPULAR</div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#d4af37', marginBottom: 6 }}>Inner Circle</div>
              <div style={{ fontSize: 12, color: '#92400e', marginBottom: 16 }}>For people ready to make the transition</div>
              <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: '#d4af37', fontWeight: 600, marginBottom: 4 }}>What you can expect to earn</div>
                <div style={{ fontSize: 34, fontWeight: 900, color: '#d4af37', lineHeight: 1, marginBottom: 2 }}>$7,953 – $10,759<span style={{ fontSize: 15, fontWeight: 600, color: '#b8860b' }}>/mo</span></div>
                <div style={{ fontSize: 13, color: '#92400e' }}>conservative to realistic, on average</div>
              </div>

              <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
                {/* Headliner bullets */}
                {[{ t: '100% commission paid upfront for Year 1*', bold: true }, { t: '$0 to start with Coach Financing — only $200/mo while you ramp', bold: true }].map(b => (
                  <div key={b.t} style={{ display: 'flex', gap: 10, fontSize: 14, color: '#fbbf24', fontWeight: b.bold ? 700 : 400 }}><span style={{ color: '#d4af37', flexShrink: 0 }}>✓</span>{b.t}</div>
                ))}

                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#92400e', marginTop: 8, marginBottom: 2 }}>Leads & AI</div>
                {['60 qualified leads delivered every month', 'AI closing assistant qualifies, nurtures, books appointments', 'Custom GoHighLevel CRM, pre-built and ready'].map(b => (
                  <div key={b} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#94a3b8' }}><span style={{ color: '#d4af37', flexShrink: 0 }}>✓</span>{b}</div>
                ))}

                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#92400e', marginTop: 8, marginBottom: 2 }}>Training & Support</div>
                {['4 quarterly masterclasses included (normally paid events)', 'Weekly Inner Circle live training + recorded library', 'Monthly 1-on-1 strategy call with leadership', 'Private Inner Circle Skool community'].map(b => (
                  <div key={b} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#94a3b8' }}><span style={{ color: '#d4af37', flexShrink: 0 }}>✓</span>{b}</div>
                ))}

                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#92400e', marginTop: 8, marginBottom: 2 }}>Momentum & Recognition</div>
                {['70% commission split + Sponsorship downline overrides', '1 free seat to Legacy Link Live NYC (annual flagship)', 'Top-of-month leaderboard bonuses'].map(b => (
                  <div key={b} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#94a3b8' }}><span style={{ color: '#d4af37', flexShrink: 0 }}>✓</span>{b}</div>
                ))}
              </div>

              <a href="#apply" style={{ textDecoration: 'none', marginBottom: 12 }}>
                <button type="button" className="sp-btn-primary" style={{ width: '100%', fontSize: 14, padding: '14px 20px' }}>Apply for Inner Circle</button>
              </a>
              <p style={{ fontSize: 11, color: '#57534e', margin: 0, lineHeight: 1.6 }}>*100% upfront commission applies to qualifying issued policies in Year 1, subject to standard carrier chargeback provisions. Individual results vary; income is not guaranteed.</p>
            </div>
          </div>

          {/* ELITE TEASER */}
          <div style={{ background: 'linear-gradient(160deg, #0a0a0a, #111)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '22px 28px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>Elite — By Invitation</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#f1f5f9', marginBottom: 4 }}>$17,105 – $29,013<span style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>/mo</span></div>
              <div style={{ fontSize: 12, color: '#57534e', marginBottom: 12 }}>$40,000 tuition — $0 today with Coach Financing</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {['90 qualified leads/mo', '80% commission split', 'Done-for-you Heygen avatar', 'Direct Kimora access', 'IC graduates only'].map(b => (
                  <span key={b} style={{ fontSize: 12, color: '#64748b' }}>✓ {b}</span>
                ))}
              </div>
            </div>
            <a href="#apply" style={{ textDecoration: 'none', flexShrink: 0 }}>
              <button type="button" className="sp-btn-ghost" style={{ whiteSpace: 'nowrap' }}>Learn About Elite</button>
            </a>
          </div>

        </section>

        {/* ─── THE MATH ─── */}
        <section className="sp-section" style={{ paddingTop: 48, paddingBottom: 48 }}>
          <div className="sp-section-label">The Math</div>
          <h2 className="sp-section-title">$0 Today. $200/mo. The AI Does The Heavy Lifting.</h2>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <p style={{ color: '#94a3b8', fontSize: 16, lineHeight: 1.8, marginBottom: 16 }}>
              Inner Circle retail is $1,997/mo plus a $497 setup fee. With Coach Financing through The Legacy Link, you walk in at $0.
            </p>
            <p style={{ color: '#94a3b8', fontSize: 16, lineHeight: 1.8, marginBottom: 16 }}>
              A third-party lender covers half your tuition. The Legacy Link covers the other half — and we don’t ask you to pay us out of pocket. We net it out of your commissions at 25% as you produce. No personal guarantee on our half. If you don’t produce, you don’t owe us.
            </p>
            <p style={{ color: '#94a3b8', fontSize: 16, lineHeight: 1.8, marginBottom: 16 }}>
              Your only real out-of-pocket while you ramp: roughly $200/mo to the lender. After about 5 months at conservative pace, our half clears and the netting stops. From there, your tuition is fully covered for the rest of the year.
            </p>
            <p style={{ color: '#94a3b8', fontSize: 16, lineHeight: 1.8, marginBottom: 32 }}>
              Slow month? Hit your weekly activity but don’t earn enough to cover the $200? We’ll cover the lender payment for you. Up to two times in your first year. You’re not punished for ramping.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {[
                { val: '$0', label: 'Out of pocket today' },
                { val: '$200/mo', label: 'Lender payment while ramping' },
                { val: '5 months', label: 'To pay off The Legacy Link half' }
              ].map(s => (
                <div key={s.val} style={{ background: 'linear-gradient(160deg, #0d1e35, #091525)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 16, padding: '20px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#d4af37', marginBottom: 6 }}>{s.val}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>



        <div className="sp-divider" />

        {/* ─── INCOME ROADMAP ─── */}
        <section className="sp-section" style={{ paddingTop: 60, paddingBottom: 60 }}>
          <div className="sp-section-label">Your Path</div>
          <h2 className="sp-section-title">From Zero to Legacy</h2>
          <p className="sp-section-sub">Real conservative numbers — both paths, starting at $0.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 32 }}>

            {/* SPONSORSHIP TRACK */}
            <div style={{ background: 'linear-gradient(160deg, #0d1e35, #091525)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#94a3b8' }}>Free Sponsorship Path</div>
              </div>
              <div style={{ display: 'grid' }}>
                {[
                  { period: 'Start', amount: '$0', note: 'No upfront cost' },
                  { period: 'Month 1', amount: '$400', note: 'First application issued' },
                  { period: 'Month 3', amount: '$780', note: 'Building momentum' },
                  { period: 'Month 6', amount: '$1,000/mo', note: 'Consistent production, on average' },
                ].map((row, i) => (
                  <div key={row.period} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12, padding: '14px 20px', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>{row.period}</div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>{row.amount}</div>
                      <div style={{ fontSize: 12, color: '#475569' }}>{row.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* INNER CIRCLE TRACK */}
            <div style={{ background: 'linear-gradient(160deg, #1a1506, #110e03)', border: '2px solid rgba(212,175,55,0.3)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(212,175,55,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#d4af37' }}>Inner Circle</div>
                <span style={{ fontSize: 11, background: '#d4af37', color: '#06090f', padding: '2px 10px', borderRadius: 999, fontWeight: 800 }}>MOST POPULAR</span>
              </div>
              <div style={{ display: 'grid' }}>
                {[
                  { period: 'Start', amount: '$0', note: 'Coach Financing covers tuition', gold: false },
                  { period: 'Month 1', amount: '$5,956/mo net', note: '$7,953 gross — 1 app + 8 recruits + overrides', gold: false },
                  { period: 'Month 3', amount: '$9,000/mo net', note: 'Rhythm established, pipeline compounds', gold: false },
                  { period: 'Month 6', amount: '$10,759/mo net', note: '$12,756 gross • $129,108 annualized', gold: true },
                ].map((row, i) => (
                  <div key={row.period} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12, padding: '14px 20px', borderBottom: i < 3 ? '1px solid rgba(212,175,55,0.08)' : 'none', alignItems: 'center', background: row.gold ? 'rgba(212,175,55,0.06)' : 'transparent' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: row.gold ? '#d4af37' : '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>{row.period}</div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: row.gold ? '#d4af37' : '#f1f5f9' }}>{row.amount}</div>
                      <div style={{ fontSize: 12, color: row.gold ? '#b8860b' : '#57534e' }}>{row.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="sp-stats-strip" style={{ marginBottom: 24 }}>
            <div className="sp-stat-box">
              <div className="sp-stat-value">$5,956</div>
              <div className="sp-stat-label">Net take-home, Month 1 (conservative)</div>
            </div>
            <div className="sp-stat-box">
              <div className="sp-stat-value">$10,759</div>
              <div className="sp-stat-label">Net take-home, Month 6 (realistic)</div>
            </div>
            <div className="sp-stat-box">
              <div className="sp-stat-value">$129,108</div>
              <div className="sp-stat-label">Annualized at realistic steady-state</div>
            </div>
          </div>

          {/* INCOME BREAKDOWN */}
          <details style={{ background: 'linear-gradient(160deg, #0d1e35, #091525)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 14, overflow: 'hidden' }}>
            <summary style={{ padding: '16px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#d4af37', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📊 How the income math works — see the full breakdown</span>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>tap to expand</span>
            </summary>
            <div style={{ padding: '0 20px 20px', display: 'grid', gap: 20 }}>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#d4af37', marginBottom: 10 }}>Conservative Steady-State (Month 1)</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {[
                    { source: 'Personal commission', calc: '1 app \xd7 90% issue \xd7 $2,400 \xd7 70% split', amount: '$1,512' },
                    { source: 'Referral bonuses', calc: '8 recruits = $1,200 + ($650 \xd7 7)', amount: '$5,750' },
                    { source: 'Overrides', calc: '8 downline \xd7 20% producing \xd7 1 policy \xd7 90% \xd7 $2,400 \xd7 20%', amount: '$691' },
                  ].map(r => (
                    <div key={r.source} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px', gap: 8, fontSize: 13, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'start' }}>
                      <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{r.source}</span>
                      <span style={{ color: '#64748b' }}>{r.calc}</span>
                      <span style={{ fontWeight: 700, color: '#d4af37', textAlign: 'right' }}>{r.amount}</span>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px', gap: 8, fontSize: 14, padding: '10px 0 4px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: '#fff' }}>Gross monthly</span>
                    <span style={{ color: '#475569', fontSize: 12 }}>Less $1,997 tier dues = <strong style={{ color: '#d4af37' }}>$5,956 net/mo</strong> • $71,472 annualized</span>
                    <span style={{ fontWeight: 900, color: '#d4af37', textAlign: 'right' }}>$7,953</span>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#d4af37', marginBottom: 10 }}>Realistic Steady-State (Months 4–6+)</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {[
                    { source: 'Personal commission', calc: '2 apps \xd7 90% issue \xd7 $2,400 \xd7 70% split', amount: '$3,024' },
                    { source: 'Referral bonuses', calc: '12 recruits = $1,200 + ($650 \xd7 11)', amount: '$8,350' },
                    { source: 'Overrides', calc: '16 downline \xd7 20% producing \xd7 1 policy \xd7 90% \xd7 $2,400 \xd7 20%', amount: '$1,382' },
                  ].map(r => (
                    <div key={r.source} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px', gap: 8, fontSize: 13, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'start' }}>
                      <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{r.source}</span>
                      <span style={{ color: '#64748b' }}>{r.calc}</span>
                      <span style={{ fontWeight: 700, color: '#d4af37', textAlign: 'right' }}>{r.amount}</span>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px', gap: 8, fontSize: 14, padding: '10px 0 4px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: '#fff' }}>Gross monthly</span>
                    <span style={{ color: '#475569', fontSize: 12 }}>Less $1,997 tier dues = <strong style={{ color: '#d4af37' }}>$10,759 net/mo</strong> • $129,108 annualized</span>
                    <span style={{ fontWeight: 900, color: '#d4af37', textAlign: 'right' }}>$12,756</span>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 11, color: '#475569', margin: 0, lineHeight: 1.6 }}>Income projections are illustrative and based on conservative activity assumptions. Individual results vary. Income is not guaranteed.</p>
            </div>
          </details>
        </section>

        <div className="sp-divider" />

        {/* ─── SUCCESS STORIES ─── */}
        <section className="sp-section" id="success-stories">
          <div className="sp-section-label">Proof</div>
          <h2 className="sp-section-title">Real People. Real Results.</h2>
          <p className="sp-section-sub">These aren&apos;t actors. These are Legacy Link sponsees — click to watch their story.</p>
          <div className="sp-test-grid">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="sp-test-card">
                <div className="sp-test-name">{t.name}</div>
                <p className="sp-test-result">&ldquo;{t.result}&rdquo;</p>
                <button type="button" className="sp-test-btn" onClick={() => setActiveTestimonial(t)}>
                  ▶ Watch Testimony
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ─── MID-PAGE CTA ─── */}
        <section style={{ background: 'linear-gradient(135deg, #1a1506, #0f1421)', borderTop: '1px solid rgba(212,175,55,0.2)', borderBottom: '1px solid rgba(212,175,55,0.2)', padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#d4af37', marginBottom: 10 }}>Ready to start?</p>
          <h3 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, color: '#fff', margin: '0 0 20px', lineHeight: 1.2 }}>Don’t watch from the sidelines.<br />Your spot is waiting.</h3>
          <a href="#apply" style={{ textDecoration: 'none' }}>
            <button type="button" className="sp-btn-primary">Choose Your Path →</button>
          </a>
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
                <p className="sp-review-text">&ldquo;{r.text}&rdquo;</p>
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
          <p className="sp-section-sub">Everything you&apos;re probably wondering about before you apply.</p>
          <div className="sp-faq-list">
            {[
              { q: 'Do I need to be licensed to apply?', a: 'No. We sponsor both licensed and unlicensed applicants. We will walk you through the licensing process as part of your onboarding.' },
              { q: 'How long does the review take?', a: 'Manual review candidates are contacted within 1–2 business days. Most hear back the same day.' },
              { q: 'What happens if I\'m approved?', a: 'You immediately book a call and begin your onboarding steps. You\'ll have your day-1 playbook, CRM access, and a point of contact assigned.' },
              { q: 'Is there really no upfront cost?', a: 'Correct. The sponsorship program is designed to remove every financial barrier. You start earning before you spend anything.' },
              { q: 'What does the training look like?', a: 'Live weekly sessions plus on-demand recordings, scripts, objection handling guides, and a full playbook — all accessible from day one.' },
              { q: 'How does Coach Financing actually work?', a: 'Coach Financing is a structured payment program we built so producers don’t have to put thousands down to start. A third-party lender covers half your tuition. The Legacy Link covers the other half — and we recover our half by netting 25% out of your commissions as you produce. No personal guarantee on our half. The lender payment runs roughly $200/mo while you ramp, and you’ll typically clear our half in about 5 months at a conservative pace.' },
              { q: 'What if I have a slow month and can’t make the $200 payment?', a: 'If you hit your weekly activity standard (15 worked leads, 1 application, 1 Inner Circle training) and your earned commissions don’t cover the $200, The Legacy Link will cover the lender payment for you. You get up to two of these in your first year. You’re not punished for ramping.' },
              { q: 'What’s the difference between Inner Circle and Elite?', a: 'Inner Circle is built for agents going full-time: 60 leads a month, 70% split, full system access. Elite is the next tier — 90 leads, 80% split, done-for-you content, and direct Kimora access. Elite is by invitation, typically open to Inner Circle graduates with a track record of consistent production.' }
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

        {/* ─── URGENCY CTA ─── */}
        <section className="sp-section" style={{ paddingTop: 40, paddingBottom: 40, textAlign: 'center' }}>
          <h2 className="sp-section-title" style={{ marginBottom: 12 }}>Spots Close Soon. Your Math Starts Today.</h2>
          <p style={{ color: '#7a92b0', fontSize: 16, marginBottom: 28, maxWidth: 500, margin: '0 auto 28px' }}>Inner Circle seats are capped each month. Apply once — we’ll match you to the right path.</p>
          <a href="#apply" style={{ textDecoration: 'none' }}>
            <button type="button" className="sp-btn-primary" style={{ fontSize: 17, padding: '18px 40px' }}>Apply Now — 2 Minutes →</button>
          </a>
        </section>

        <div className="sp-divider" />

        {/* ─── APPLY FORM ─── */}
        <div className="sp-apply-section" id="apply">
          <div className="sp-apply-inner">
            <div className="sp-apply-badge">🔒 Spots Are Limited This Month</div>
            <h2 className="sp-apply-title">Choose Your Path. Start Here.</h2>
            <p className="sp-apply-sub">
              Whether you’re starting with the Free Sponsorship Path or going straight to Inner Circle — it all begins with this form. Takes less than 2 minutes. We’ll match you to the right path based on your profile.
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
              <button type="submit" className="sp-submit-btn">Yes, if the numbers make sense — I&apos;m in →</button>
              <div className="sp-form-disclaimer">
                Takes less than 2 minutes • Spots are limited each month • $0 to start
              </div>
            </form>
          </div>
        </div>

      </div>

      {/* ─── STICKY APPLY BAR ─── */}
      <div className="sp-sticky-bar">
        <div>
          <div className="sp-sticky-bar-text">Sponsorship & Inner Circle spots are limited.</div>
          <div className="sp-sticky-bar-sub">$0 to start • 2-minute form • 24h review</div>
        </div>
        <a href="#apply" style={{ textDecoration: 'none' }}>
          <button type="button" className="sp-sticky-btn">Apply Now →</button>
        </a>
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
            <p className="sp-modal-sub">&ldquo;{activeTestimonial.result}&rdquo;</p>
          </div>
        </div>
      )}
    </>
  );
}
