'use client';

import { useState } from 'react';

function clean(v = '') { return String(v || '').trim(); }

const PRODUCTS = [
  { key: 'sponsorship', label: 'Sponsorship Approach' },
  { key: 'iul', label: 'IUL Insurance' },
  { key: 'final-expense', label: 'Final Expense' },
  { key: 'mortgage', label: 'Mortgage Protection' },
  { key: 'health', label: 'Health Insurance' },
  { key: 'other', label: 'Other Insurance / Offer' }
];

const STYLES = [
  { key: 'alexHormozi', label: 'Alex Hormozi Style' },
  { key: 'myronGolden', label: 'Myron Golden Style' },
  { key: 'kimoraLink', label: 'Kimora Link Authentic' },
  { key: 'generic', label: 'Generic Professional' }
];

export default function InnerCircleScriptsPage() {
  const [product, setProduct] = useState('sponsorship');
  const [style, setStyle] = useState('alexHormozi');
  const [biggestProblem, setBiggestProblem] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');

  function generateScript() {
    // Minimal logic. We'll just do a simple placeholder script.
    // In real life, we might have multiple templates.
    let script = '';

    script += `Hey ${targetAudience || 'prospect'}, `;

    if (product === 'sponsorship') {
      script += `I wanted to share a quick pathway to extra monthly income via our Sponsorship approach. `;
    } else if (product === 'iul') {
      script += `Let’s talk about an IUL solution that protects your family and grows tax-advantaged. `;
    } else if (product === 'final-expense') {
      script += `I can set you up with an affordable Final Expense policy in minutes. `;
    } else if (product === 'mortgage') {
      script += `We help families safeguard their mortgage, so if anything happens, you keep your home. `;
    } else if (product === 'health') {
      script += 'We have a Health Insurance plan that might be a perfect fit for your needs. ';
    } else {
      script += 'We have a powerful program that might solve your problem. ';
    }

    script += `I know you mentioned your biggest concern is ${biggestProblem || 'XYZ'}. `;

    if (style === 'alexHormozi') {
      script += `Look, we have a proven framework. We’ve done it with hundreds of people, we’ll do it with you. In 3 steps, you’ll see tangible results. `;
    } else if (style === 'myronGolden') {
      script += `We focus on bridging the gap between your current finances and your God-given potential for wealth. When you see how it works, you’ll realize the cost of not acting is too great. `;
    } else if (style === 'kimoraLink') {
      script += `I prefer a direct, authentic approach: we break limiting beliefs and get you on track. With the right plan, no more financial stress. `;
    } else {
      script += `People love a professional, no-pressure approach. I’ll walk you through the solution, show you how it solves your problem, and you can decide if it fits. `;
    }

    script += `Does that sound like something you’d want to check out?

(End Script)`;

    setGeneratedScript(script);
  }

  return (
    <main style={{ minHeight: '100vh', padding: 16, maxWidth: 900, margin: '0 auto', background: '#07132b', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <a href="/inner-circle-hub" className="ghost" style={{ textDecoration: 'none' }}>Home</a>
        <h2 style={{ margin: 0 }}>Script Vault 2.0</h2>
      </div>

      <p className="muted" style={{ margin: '4px 0 16px' }}>
        Answer these quick questions, then generate your script.
      </p>

      <div style={{ display: 'grid', gap: 12, border: '1px solid #1e293b', padding: 14, borderRadius: 8, background: '#0c1326' }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <small className="muted">Choose Product or Topic</small>
          <select value={product} onChange={(e) => setProduct(e.target.value)}>
            {PRODUCTS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          <small className="muted">Script Style</small>
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            {STYLES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          <small className="muted">Biggest Problem / Fear / Pain</small>
          <input placeholder="What's the main concern?" value={biggestProblem} onChange={(e) => setBiggestProblem(e.target.value)} />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          <small className="muted">Target Audience Name / Group</small>
          <input placeholder="e.g., John or 'Busy Moms'" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
        </label>

        <button type="button" style={{ padding: '8px 16px', borderRadius: 6, background: '#1d4ed8', color: '#fff', border: 'none' }} onClick={generateScript}>Generate Script</button>
      </div>

      {generatedScript ? (
        <div style={{ marginTop: 16, border: '1px solid #1e293b', padding: 14, borderRadius: 6, background: '#0c1326' }}>
          <h3>Generated Script</h3>
          <pre style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{generatedScript}</pre>
        </div>
      ) : null}
    </main>
  );
}
