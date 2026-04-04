'use client';

import { useMemo, useState } from 'react';

const BLENDS = [
  { key: '50-50', label: '50/50 Blend', color: '#4f8ef7', cvRatio: 0.50, dbRatio: 0.50, initialDbMultiplier: 93.633, chargeScale: 1.00 },
  { key: '70-30', label: '70/30 Blend', color: '#12b886', cvRatio: 0.70, dbRatio: 0.30, initialDbMultiplier: 56.180, chargeScale: 0.82 },
  { key: '90-10', label: '90/10 Blend', color: '#f59e0b', cvRatio: 0.90, dbRatio: 0.10, initialDbMultiplier: 22.470, chargeScale: 0.66 }
];

const DEFAULT_INPUTS = {
  age: 35,
  retirementAge: 65,
  gender: 'Male',
  tobacco: 'No',
  state: 'Florida',
  healthNotes: '',
  contributionMode: 'monthly',
  monthlyContribution: 500,
  targetFaceAmount: 561798,
  assumedRate: 7.2,
  priority: 'Balanced'
};

const CASE_KEY = 'inner_circle_tools_link_blend_builder_cases_v1';

function n(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function money(v = 0) {
  return `$${Math.round(Number(v) || 0).toLocaleString('en-US')}`;
}

function pct(v = 0) {
  return `${Number(v || 0).toFixed(1)}%`;
}

function corridorFactorForAge(age = 35) {
  if (age <= 40) return 2.50;
  if (age <= 55) return 1.85;
  if (age <= 60) return 1.50;
  if (age <= 65) return 1.30;
  if (age <= 70) return 1.20;
  if (age <= 75) return 1.15;
  return 1.05;
}

// Calibrated from the uploaded F&G Pathsetter age-35 illustration (Mar 23, 2026)
// so the 50/50 projection tracks the carrier current-assumption ledger.
const BASE_5050_CHARGE_CURVE = [
  0.405473, 0.252326, 0.182138, 0.141836, 0.115346, 0.096873, 0.083045, 0.072354, 0.063934, 0.057415,
  0.026382, 0.024180, 0.022448, 0.020961, 0.019560, 0.016233, 0.015295, 0.014526, 0.013864, 0.013232,
  0.012602, 0.011940, 0.011327, 0.010797, 0.010397, 0.010165, 0.010141, 0.010202, 0.010339, 0.010490,
  0.010651, 0.010797, 0.010980, 0.011210, 0.011533
];

function blendedChargeRate(year = 1, blend = BLENDS[0]) {
  const idx = Math.max(0, Math.min(BASE_5050_CHARGE_CURVE.length - 1, year - 1));
  const base = BASE_5050_CHARGE_CURVE[idx] || BASE_5050_CHARGE_CURVE[BASE_5050_CHARGE_CURVE.length - 1] || 0.011533;

  // Blend-specific charge scaling calibrated from the 50/50 carrier baseline.
  const scale = Number.isFinite(blend?.chargeScale) ? blend.chargeScale : (0.6 + ((blend?.dbRatio ?? 0.5) * 0.8));
  const floor = blend?.key === '90-10' ? 0.0048 : blend?.key === '70-30' ? 0.0054 : 0.0060;
  return Math.max(floor, base * scale);
}

function computeProjection(inputs, blend) {
  const age = Math.max(18, Math.round(n(inputs.age, 35)));
  const retirementAge = Math.max(age + 1, Math.round(n(inputs.retirementAge, 65)));
  const years = retirementAge - age;
  const assumedRate = Math.max(0, n(inputs.assumedRate, 7.2)) / 100;

  const monthlyContribution = inputs.contributionMode === 'monthly'
    ? Math.max(0, n(inputs.monthlyContribution, 500))
    : Math.max(0, n(inputs.targetFaceAmount, 500000) / 1000);

  const annualContribution = monthlyContribution * 12;
  const initialDB = inputs.contributionMode === 'targetFace'
    ? Math.max(50000, n(inputs.targetFaceAmount, 500000))
    : Math.max(50000, annualContribution * blend.initialDbMultiplier);

  let cv = 0;
  const rows = [];

  for (let year = 1; year <= years; year += 1) {
    const currentAge = age + year;
    const corridorFactor = corridorFactorForAge(currentAge);

    const beforeGrowth = cv + annualContribution;
    const grownValue = beforeGrowth * (1 + assumedRate);
    const effectiveCharge = blendedChargeRate(year, blend);
    const afterCharge = grownValue * (1 - effectiveCharge);
    const endingCv = Math.max(0, afterCharge);

    const charges = Math.max(0, grownValue - afterCharge);
    // Option B (Increasing): face amount + account value; corridor stays as a floor.
    const deathBenefit = Math.max(initialDB + endingCv, endingCv * corridorFactor);

    rows.push({
      year,
      age: currentAge,
      annualContribution,
      netContribution: Math.max(0, annualContribution - charges),
      cashValueBeforeGrowth: beforeGrowth,
      cashValueAfterGrowth: grownValue,
      charges,
      endingCashValue: endingCv,
      corridorFactor,
      deathBenefit
    });

    cv = endingCv;
  }

  const at65 = rows.find((r) => r.age >= 65) || rows[rows.length - 1] || null;
  const at10 = rows[Math.min(9, rows.length - 1)] || null;
  const at20 = rows[Math.min(19, rows.length - 1)] || null;

  return {
    blend: blend.label,
    blendKey: blend.key,
    color: blend.color,
    age,
    retirementAge,
    assumedRate,
    dbAtIssue: initialDB,
    cashAtRetirement: rows[rows.length - 1]?.endingCashValue || 0,
    dbAtRetirement: rows[rows.length - 1]?.deathBenefit || initialDB,
    dbAt65: at65?.deathBenefit || rows[rows.length - 1]?.deathBenefit || initialDB,
    cvAt10: at10?.endingCashValue || 0,
    cvAt20: at20?.endingCashValue || 0,
    rows
  };
}

function recommendBlend(results, priority = 'Balanced') {
  if (!Array.isArray(results) || !results.length) return null;

  const maxCv = Math.max(...results.map((r) => r.cashAtRetirement), 1);
  const maxDb = Math.max(...results.map((r) => r.dbAtRetirement), 1);
  const maxDbIssue = Math.max(...results.map((r) => r.dbAtIssue), 1);

  if (priority === 'Cash Value Growth') {
    return [...results]
      .map((r) => ({
        ...r,
        // Aggressive toward accumulation while still checking minimum protection.
        _score: (r.cashAtRetirement / maxCv) * 0.80 + (r.dbAtRetirement / maxDb) * 0.20
      }))
      .sort((a, b) => b._score - a._score)[0];
  }

  if (priority === 'Death Benefit') {
    return [...results]
      .map((r) => ({
        ...r,
        // Aggressive toward protection: retirement DB + starting DB strength.
        _score: (r.dbAtRetirement / maxDb) * 0.75 + (r.dbAtIssue / maxDbIssue) * 0.25
      }))
      .sort((a, b) => b._score - a._score)[0];
  }

  // Balanced: favor a true middle profile over pure extremes.
  return [...results]
    .map((r) => ({
      ...r,
      _score:
        (r.cashAtRetirement / maxCv) * 0.60 +
        (r.dbAtRetirement / maxDb) * 0.40 -
        Math.abs((r.dbRatio ?? 0.5) - 0.30) * 0.20
    }))
    .sort((a, b) => b._score - a._score)[0];
}

function recommendationReason(results, recommended, priority = 'Balanced') {
  if (!Array.isArray(results) || !results.length || !recommended) return '';

  const topCv = [...results].sort((a, b) => b.cashAtRetirement - a.cashAtRetirement)[0];
  const topDb = [...results].sort((a, b) => b.dbAtRetirement - a.dbAtRetirement)[0];
  const topDbIssue = [...results].sort((a, b) => b.dbAtIssue - a.dbAtIssue)[0];

  if (priority === 'Cash Value Growth') {
    return recommended?.blendKey === topCv?.blendKey
      ? 'Highest projected retirement cash value for accumulation-focused planning.'
      : 'Best weighted cash-growth profile while preserving death benefit support.';
  }

  if (priority === 'Death Benefit') {
    const hasTopRetirementDb = recommended?.blendKey === topDb?.blendKey;
    const hasTopIssueDb = recommended?.blendKey === topDbIssue?.blendKey;
    if (hasTopRetirementDb && hasTopIssueDb) return 'Strongest projected protection at issue and into retirement years.';
    if (hasTopRetirementDb) return 'Highest projected death benefit at retirement age.';
    if (hasTopIssueDb) return 'Strongest initial death benefit at policy issue.';
    return 'Best weighted protection profile across issue and retirement benchmarks.';
  }

  return 'Best overall balance of cash value growth and death benefit for the selected priority.';
}

function recommendationReasonColor(priority = 'Balanced') {
  if (priority === 'Cash Value Growth') return '#22c55e'; // green
  if (priority === 'Death Benefit') return '#f59e0b'; // amber
  return '#60a5fa'; // blue (balanced)
}

function chartPath(points, minX, maxX, maxY, width, height, pad = 22) {
  if (!points.length) return '';
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;
  const xRange = Math.max(1, maxX - minX);
  const yRange = Math.max(1, maxY);

  return points
    .map((p, i) => {
      const x = pad + ((p.age - minX) / xRange) * plotW;
      const y = pad + plotH - (p.value / yRange) * plotH;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export default function LinkBlendBuilderTab({ member }) {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [activeBlend, setActiveBlend] = useState('50-50');
  const [generated, setGenerated] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const previewResults = useMemo(
    () => BLENDS.map((blend) => computeProjection(inputs, blend)),
    [inputs]
  );

  const recommended = useMemo(
    () => recommendBlend(previewResults, inputs.priority),
    [previewResults, inputs.priority]
  );

  const recommendationWhy = useMemo(
    () => recommendationReason(previewResults, recommended, inputs.priority),
    [previewResults, recommended, inputs.priority]
  );

  const recommendationWhyColor = useMemo(
    () => recommendationReasonColor(inputs.priority),
    [inputs.priority]
  );

  const chartSeries = useMemo(() => {
    const first = previewResults[0];
    if (!first) return { minAge: 0, maxAge: 1, maxValue: 1, lines: [] };

    const minAge = first.age;
    const maxAge = first.retirementAge;
    const lines = previewResults.map((r) => ({
      key: r.blendKey,
      label: `${r.blend.split(' ')[0]} Cash Value`,
      color: r.color,
      points: (r.rows || []).map((row) => ({ age: row.age, value: row.endingCashValue }))
    }));

    const maxValue = Math.max(1, ...lines.flatMap((l) => l.points.map((p) => p.value)));
    return { minAge, maxAge, maxValue, lines };
  }, [previewResults]);

  const activeRows = useMemo(
    () => (previewResults.find((r) => r.blendKey === activeBlend)?.rows || []),
    [previewResults, activeBlend]
  );

  const update = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));

  const generate = () => {
    setGenerated(true);
    setSavedMsg('');
  };

  const resetInputs = () => {
    setInputs(DEFAULT_INPUTS);
    setActiveBlend('50-50');
    setGenerated(false);
    setSavedMsg('Inputs reset to default example.');
  };

  const saveCase = () => {
    if (typeof window === 'undefined') return;
    try {
      const existing = JSON.parse(window.localStorage.getItem(CASE_KEY) || '[]');
      const payload = {
        id: `case_${Date.now()}`,
        createdAt: new Date().toISOString(),
        createdBy: member?.email || member?.applicantName || 'inner-circle-member',
        inputs,
        recommended: recommended?.blend || null,
        results: previewResults.map((r) => ({
          blend: r.blend,
          dbAtIssue: r.dbAtIssue,
          cashAtRetirement: r.cashAtRetirement,
          dbAtRetirement: r.dbAtRetirement
        }))
      };
      window.localStorage.setItem(CASE_KEY, JSON.stringify([payload, ...(Array.isArray(existing) ? existing : [])].slice(0, 100)));
      setSavedMsg('Case saved locally.');
    } catch {
      setSavedMsg('Unable to save case on this browser.');
    }
  };

  const exportPdf = () => {
    if (typeof window === 'undefined') return;
    const rec = recommended;
    if (!rec) return;
    const recWhy = recommendationWhy || recommendationReason(previewResults, rec, inputs.priority);
    const recWhyColor = recommendationWhyColor || recommendationReasonColor(inputs.priority);

    const rows = previewResults.map((r) => `
      <tr>
        <td>${r.blend}</td>
        <td>${money(r.dbAtIssue)}</td>
        <td>${money(r.cashAtRetirement)}</td>
        <td>${money(r.dbAtRetirement)}</td>
        <td>${money(r.cvAt10)}</td>
        <td>${money(r.cvAt20)}</td>
      </tr>
    `).join('');

    const popup = window.open('', '_blank', 'width=1080,height=860');
    if (!popup) {
      setSavedMsg('Pop-up blocked. Please allow pop-ups to export PDF.');
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>Link Blend Builder — Executive Summary</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; margin: 28px; color: #0f172a; }
            h1 { margin: 0 0 6px; font-size: 26px; }
            h2 { margin: 0; font-size: 15px; color: #334155; font-weight: 600; }
            .meta { margin: 16px 0 20px; font-size: 13px; color: #475569; }
            .badge { display: inline-block; border: 1px solid #1d4ed8; border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 700; color: #1d4ed8; }
            .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px; margin-bottom: 14px; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(220px, 1fr)); gap: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 12px; }
            th { background: #f8fafc; }
            .small { font-size: 12px; color: #475569; }
            @media print {
              body { margin: 16px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="badge">INNER CIRCLE TOOLS • INTERNAL ONLY</div>
          <h1>Link Blend Builder</h1>
          <h2>Executive Projection Summary</h2>
          <div class="meta">Generated ${new Date().toLocaleString()} • Legacy Link Internal Projection Standard v1</div>

          <div class="card">
            <strong>Client Profile</strong>
            <div class="grid" style="margin-top:8px">
              <div>Age: <strong>${inputs.age}</strong></div>
              <div>Retirement Age: <strong>${inputs.retirementAge}</strong></div>
              <div>Gender: <strong>${inputs.gender}</strong></div>
              <div>Tobacco: <strong>${inputs.tobacco}</strong></div>
              <div>State: <strong>${inputs.state || 'N/A'}</strong></div>
              <div>Priority: <strong>${inputs.priority}</strong></div>
              <div>Contribution Mode: <strong>${inputs.contributionMode === 'monthly' ? 'Monthly Contribution' : 'Target Face Amount'}</strong></div>
              <div>${inputs.contributionMode === 'monthly' ? `Monthly Contribution: <strong>${money(inputs.monthlyContribution)}</strong>` : `Target Face Amount: <strong>${money(inputs.targetFaceAmount)}</strong>`}</div>
            </div>
          </div>

          <div class="card">
            <strong>Recommended Blend: ${rec.blend}</strong>
            <div class="small" style="margin-top:6px">Assumed Crediting Rate: ${pct(inputs.assumedRate)} • DB at Issue: ${money(rec.dbAtIssue)} • Cash Value @ ${rec.retirementAge}: ${money(rec.cashAtRetirement)}</div>
            <div class="small" style="margin-top:4px;color:${recWhyColor}"><strong>Why recommended:</strong> ${recWhy}</div>
          </div>

          <div class="card">
            <strong>Quick Compare</strong>
            <table>
              <thead>
                <tr>
                  <th>Blend</th>
                  <th>DB at Issue</th>
                  <th>Cash Value @ Retirement</th>
                  <th>DB @ Retirement</th>
                  <th>CV @ 10 Years</th>
                  <th>CV @ 20 Years</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>

          <div class="small">For internal planning use only. Not an insurance offer and not a carrier illustration.</div>
          <button class="no-print" onclick="window.print()" style="margin-top:16px;padding:10px 14px;border-radius:10px;border:1px solid #1e293b;background:#0f172a;color:#fff;cursor:pointer">Print / Save as PDF</button>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
  };

  const shareSummary = async () => {
    const rec = recommended;
    if (!rec || typeof navigator === 'undefined' || !navigator.clipboard) return;
    const recWhy = recommendationWhy || recommendationReason(previewResults, rec, inputs.priority);
    const text = `Link Blend Builder Summary\nPriority: ${inputs.priority}\nRecommended: ${rec.blend}\nWhy: ${recWhy}\nDB at Issue: ${money(rec.dbAtIssue)}\nCash Value @ ${rec.retirementAge}: ${money(rec.cashAtRetirement)}\nAssumed Rate: ${pct(inputs.assumedRate)}`;
    try {
      await navigator.clipboard.writeText(text);
      setSavedMsg('Summary copied to clipboard.');
    } catch {
      setSavedMsg('Could not copy summary.');
    }
  };

  const openDetails = () => {
    setGenerated(true);
    const el = typeof document !== 'undefined' ? document.getElementById('link-blend-details') : null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const showPostActions = generated;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ border: '1px solid #334155', borderRadius: 16, background: 'linear-gradient(135deg,#0f172a 0%, #111827 60%, #0b1220 100%)', padding: 16, boxShadow: '0 16px 44px rgba(2,6,23,0.35)' }}>
        <div className="panelRow" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <small style={{ color: '#93c5fd', fontWeight: 700, letterSpacing: '.05em' }}>INNER CIRCLE TOOLS</small>
            <h3 style={{ margin: '4px 0 6px', color: '#f8fafc' }}>Link Blend Builder</h3>
            <p style={{ margin: 0, color: '#cbd5e1' }}>Compare blend strategies and project death benefit and cash value outcomes through retirement.</p>
          </div>
          <span className="pill" style={{ background: '#111827', color: '#bfdbfe', border: '1px solid #3b82f6', fontWeight: 700 }}>Internal Only</span>
        </div>
      </div>

      <div style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', padding: 14 }}>
        <div className="panelRow" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ color: '#fff' }}>Inner Circle Tools</strong>
          <small className="muted">Internal toolkit menu</small>
        </div>
        <div style={{ marginTop: 10, border: '1px solid #2b3448', borderRadius: 12, background: '#111827', padding: 12, display: 'grid', gap: 8 }}>
          <div className="panelRow" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#fff', fontWeight: 700 }}>🔗 Link Blend Builder</div>
              <small style={{ color: '#cbd5e1' }}>Estimate how different blend structures may affect death benefit, cash value growth, and retirement outcomes.</small>
            </div>
            <span className="pill" style={{ background: '#020617', color: '#93c5fd', border: '1px solid #334155' }}>Active Tool</span>
          </div>
        </div>
      </div>

      <div style={{ border: '1px solid #334155', borderRadius: 12, background: '#0B1220', padding: 12 }}>
        <small style={{ color: '#cbd5e1' }}>
          <strong style={{ color: '#f8fafc' }}>Alignment Standard:</strong> Projection engine is calibrated to the uploaded F&G age-35 Pathsetter illustration baseline (50/50), with 70/30 and 90/10 derived from calibrated blend-specific DB and charge scaling.
        </small>
      </div>

      <div className="linkBuilderTop" style={{ display: 'grid', gap: 16, alignItems: 'start', gridTemplateColumns: '360px minmax(0,1fr)' }}>
        <section style={{ border: '1px solid #334155', borderRadius: 16, background: '#f8fafc', color: '#0f172a', padding: 18, boxShadow: '0 16px 32px rgba(15,23,42,0.10)' }}>
          <h4 style={{ margin: '0 0 4px', color: '#0f172a' }}>Client Inputs</h4>
          <p style={{ margin: '0 0 14px', color: '#475569', fontSize: 13 }}>Enter client information to generate projections.</p>

          <div style={{ display: 'grid', gap: 12 }}>
            <div style={inputGroupCardStyle}>
              <small style={inputGroupTitleStyle}>Client Profile</small>
              <div className="twoCol" style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                <label style={fieldLabelStyle}>Age
                  <input type="number" value={inputs.age} onChange={(e) => update('age', n(e.target.value, 35))} style={fieldStyle} />
                </label>
                <label style={fieldLabelStyle}>Retirement Age
                  <input type="number" value={inputs.retirementAge} onChange={(e) => update('retirementAge', n(e.target.value, 65))} style={fieldStyle} />
                </label>
              </div>

              <div className="twoCol" style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                <label style={fieldLabelStyle}>Gender
                  <select value={inputs.gender} onChange={(e) => update('gender', e.target.value)} style={fieldStyle}>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </label>
                <label style={fieldLabelStyle}>Tobacco
                  <select value={inputs.tobacco} onChange={(e) => update('tobacco', e.target.value)} style={fieldStyle}>
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </label>
              </div>

              <label style={fieldLabelStyle}>State
                <input value={inputs.state} onChange={(e) => update('state', e.target.value)} style={fieldStyle} />
              </label>

              <label style={fieldLabelStyle}>Health Notes
                <textarea value={inputs.healthNotes} onChange={(e) => update('healthNotes', e.target.value)} rows={3} placeholder="Any relevant health conditions…" style={{ ...fieldStyle, resize: 'vertical', minHeight: 84 }} />
              </label>
            </div>

            <div style={inputGroupCardStyle}>
              <small style={inputGroupTitleStyle}>Funding Strategy</small>
              <div style={{ display: 'grid', gap: 8 }}>
                <span style={fieldLabelStyle}>Contribution Mode</span>
                <label style={radioStyle}><input type="radio" name="mode" checked={inputs.contributionMode === 'monthly'} onChange={() => update('contributionMode', 'monthly')} /> Monthly Contribution ($)</label>
                <label style={radioStyle}><input type="radio" name="mode" checked={inputs.contributionMode === 'targetFace'} onChange={() => update('contributionMode', 'targetFace')} /> Target Face Amount ($)</label>
              </div>

              {inputs.contributionMode === 'monthly' ? (
                <label style={fieldLabelStyle}>Monthly Contribution
                  <input type="number" value={inputs.monthlyContribution} onChange={(e) => update('monthlyContribution', n(e.target.value, 500))} style={fieldStyle} />
                </label>
              ) : (
                <label style={fieldLabelStyle}>Target Face Amount
                  <input type="number" value={inputs.targetFaceAmount} onChange={(e) => update('targetFaceAmount', n(e.target.value, 500000))} style={fieldStyle} />
                </label>
              )}
            </div>

            <div style={inputGroupCardStyle}>
              <small style={inputGroupTitleStyle}>Assumptions</small>
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={fieldLabelStyle}>Assumed Crediting Rate: {pct(inputs.assumedRate)}</label>
                <input type="range" min="2" max="12" step="0.1" value={inputs.assumedRate} onChange={(e) => update('assumedRate', n(e.target.value, 7.2))} style={{ accentColor: '#0f172a' }} />
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                <span style={fieldLabelStyle}>Client Priority</span>
                {['Cash Value Growth', 'Death Benefit', 'Balanced'].map((p) => (
                  <label key={p} style={radioStyle}><input type="radio" name="priority" checked={inputs.priority === p} onChange={() => update('priority', p)} /> {p}</label>
                ))}
              </div>
            </div>

            <button type="button" onClick={generate} style={{ background: '#0f172a', color: '#fff', border: '1px solid #1e293b', borderRadius: 12, padding: '13px 14px', fontWeight: 800, letterSpacing: '.01em', width: '100%' }}>
              Generate Projections
            </button>
          </div>
        </section>

        <section style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', color: '#fff', padding: 16, boxShadow: '0 10px 26px rgba(2,6,23,0.24)' }}>
          <h4 style={{ margin: '0 0 4px', color: '#f8fafc' }}>Quick Compare</h4>
          <p style={{ margin: '0 0 12px', color: '#94a3b8', fontSize: 13 }}>Side-by-side snapshot of projections at retirement age.</p>

          <div className="compareGrid" style={{ display: 'grid', gap: 10, alignItems: 'stretch', gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
            {previewResults.map((r) => {
              const isRec = recommended?.blendKey === r.blendKey;
              const isNinety = r.blendKey === '90-10';
              const cardBg = isNinety
                ? 'linear-gradient(180deg,#1f2a44 0%,#0b1220 100%)'
                : (isRec ? 'linear-gradient(180deg,#0f2745 0%,#0b1220 100%)' : '#111827');
              const titleColor = isNinety ? '#fcd34d' : '#f8fafc';
              return (
                <div key={r.blendKey} style={{ border: isRec ? '1px solid #60a5fa' : '1px solid #334155', borderRadius: 12, background: cardBg, padding: 10, minWidth: 0, minHeight: 246, height: '100%', display: 'flex', flexDirection: 'column', boxShadow: isRec ? '0 0 0 1px rgba(96,165,250,0.25), 0 10px 22px rgba(15,23,42,0.30)' : '0 6px 14px rgba(2,6,23,0.18)' }}>
                  <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 6 }}>
                    <strong style={{ color: titleColor, fontSize: 14 }}>{r.blend}</strong>
                    {isRec ? <span className="pill" style={{ background: '#1d4ed8', color: '#e0f2fe', border: '1px solid #60a5fa', fontSize: 11 }}>Recommended</span> : null}
                  </div>
                  {isRec && recommendationWhy ? (
                    <small style={{ color: recommendationWhyColor, fontSize: 11, marginBottom: 6 }}>Why: {recommendationWhy}</small>
                  ) : null}

                  <div style={{ display: 'grid', gap: 6 }}>
                    <div>
                      <small style={{ color: '#94a3b8', fontSize: 11 }}>DB at Issue (Age {r.age})</small>
                      <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.15, color: '#fff' }}>{money(r.dbAtIssue)}</div>
                    </div>
                    <div>
                      <small style={{ color: '#94a3b8', fontSize: 11 }}>Cash Value @ Age {r.retirementAge}</small>
                      <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.15, color: '#fff' }}>{money(r.cashAtRetirement)}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 'auto', borderTop: '1px solid #334155', paddingTop: 8, display: 'grid', gap: 4 }}>
                    <small style={{ color: '#cbd5e1', fontSize: 11 }}>🛡 DB @ 65: <strong style={{ color: '#fff' }}>{money(r.dbAt65)}</strong></small>
                    <small style={{ color: '#cbd5e1', fontSize: 11 }}>📈 CV @ 10 Yrs: <strong style={{ color: '#fff' }}>{money(r.cvAt10)}</strong></small>
                    <small style={{ color: '#cbd5e1', fontSize: 11 }}>📈 CV @ 20 Yrs: <strong style={{ color: '#fff' }}>{money(r.cvAt20)}</strong></small>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', color: '#fff', padding: 16 }}>
        <h4 style={{ margin: '0 0 4px' }}>Growth Chart</h4>
        <p style={{ margin: '0 0 12px', color: '#94a3b8', fontSize: 13 }}>
          Projected cash value over time at an assumed crediting rate of {pct(inputs.assumedRate)}.
        </p>

        <div style={{ border: '1px solid #1f2937', borderRadius: 12, background: '#111827', padding: 10, overflowX: 'auto' }}>
          <svg width="100%" viewBox="0 0 940 340" role="img" aria-label="Growth chart">
            <rect x="0" y="0" width="940" height="340" fill="#0f172a" rx="10" />
            {[0, 1, 2, 3, 4].map((i) => {
              const y = 26 + i * 68;
              return <line key={`grid-${i}`} x1="24" y1={y} x2="916" y2={y} stroke="#1f2937" strokeWidth="1" />;
            })}

            {chartSeries.lines.map((line) => {
              const d = chartPath(line.points, chartSeries.minAge, chartSeries.maxAge, chartSeries.maxValue, 940, 340, 24);
              return (
                <path key={line.key} d={d} fill="none" stroke={line.color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all .45s ease' }} />
              );
            })}

            <text x="30" y="324" fill="#94a3b8" fontSize="12">Age</text>
            <text x="895" y="324" fill="#94a3b8" fontSize="12">Cash Value</text>
            <text x="26" y="18" fill="#475569" fontSize="11">{money(chartSeries.maxValue)}</text>
            <text x="26" y="332" fill="#475569" fontSize="11">0</text>
          </svg>
        </div>

        <div className="panelRow" style={{ gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          {chartSeries.lines.map((line) => (
            <span key={`legend-${line.key}`} className="pill" style={{ border: '1px solid #334155', background: '#020617', color: '#cbd5e1' }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: line.color, marginRight: 6 }} />
              {line.label}
            </span>
          ))}
        </div>
      </section>

      <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap' }}>
        {showPostActions ? (
          <>
            <button type="button" className="publicPrimaryBtn" onClick={saveCase}>Save Case</button>
            <button type="button" className="ghost" onClick={exportPdf}>Export PDF</button>
            <button type="button" className="ghost" onClick={resetInputs}>Reset Inputs</button>
            <button type="button" className="ghost" onClick={shareSummary}>Share Summary</button>
            <button type="button" className="ghost" onClick={openDetails}>View Full Details</button>
          </>
        ) : (
          <button type="button" className="ghost" onClick={openDetails}>View Full Details</button>
        )}
      </div>
      {savedMsg ? <small className="muted" style={{ color: '#93c5fd' }}>{savedMsg}</small> : null}

      {generated ? (
        <section id="link-blend-details" style={{ border: '1px solid #334155', borderRadius: 14, background: '#0B1220', color: '#fff', padding: 16 }}>
          <h4 style={{ margin: '0 0 10px' }}>Detailed Projections</h4>
          <div className="panelRow" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {previewResults.map((r) => (
              <button key={`tab-${r.blendKey}`} type="button" className={activeBlend === r.blendKey ? 'publicPrimaryBtn' : 'ghost'} onClick={() => setActiveBlend(r.blendKey)}>
                {r.blend}
              </button>
            ))}
          </div>

          <div style={{ border: '1px solid #1f2937', borderRadius: 12, overflow: 'auto', maxHeight: 520 }}>
            <table className="table" style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Age</th>
                  <th>Annual Contribution</th>
                  <th>Net Contribution</th>
                  <th>Cash Value Before Growth</th>
                  <th>Cash Value After Growth</th>
                  <th>Charges</th>
                  <th>Ending Cash Value</th>
                  <th>Corridor Factor</th>
                  <th>Death Benefit</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row) => (
                  <tr key={`row-${activeBlend}-${row.year}`}>
                    <td>{row.year}</td>
                    <td>{row.age}</td>
                    <td>{money(row.annualContribution)}</td>
                    <td>{money(row.netContribution)}</td>
                    <td>{money(row.cashValueBeforeGrowth)}</td>
                    <td>{money(row.cashValueAfterGrowth)}</td>
                    <td>{money(row.charges)}</td>
                    <td>{money(row.endingCashValue)}</td>
                    <td>{row.corridorFactor.toFixed(2)}x</td>
                    <td>{money(row.deathBenefit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <style jsx>{`
        @media (max-width: 1320px) {
          .linkBuilderTop { grid-template-columns: 1fr !important; }
          .compareGrid { grid-template-columns: repeat(2, minmax(220px, 1fr)) !important; }
        }
        @media (max-width: 980px) {
          .compareGrid { grid-template-columns: 1fr !important; }
          .twoCol { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const inputGroupCardStyle = {
  border: '1px solid #dbe3ef',
  borderRadius: 12,
  padding: 12,
  background: '#ffffff',
  display: 'grid',
  gap: 10
};

const inputGroupTitleStyle = {
  fontSize: 11,
  color: '#475569',
  fontWeight: 800,
  letterSpacing: '.06em',
  textTransform: 'uppercase'
};

const fieldLabelStyle = {
  display: 'grid',
  gap: 6,
  fontWeight: 700,
  color: '#0f172a',
  fontSize: 13
};

const fieldStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: '11px 12px',
  fontSize: 14,
  background: '#fff',
  color: '#0f172a',
  width: '100%'
};

const radioStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  border: '1px solid #dbe3ef',
  borderRadius: 10,
  padding: '9px 10px',
  background: '#fff',
  fontSize: 13,
  fontWeight: 600
};
