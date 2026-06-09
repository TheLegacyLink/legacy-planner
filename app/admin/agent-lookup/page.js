'use client';
import { useState } from 'react';
import AppShell from '../../../components/AppShell';

const GOLD = '#C8A96B';

function StatusPill({ label, color }) {
  const map = {
    green:  { bg: '#052e16', border: '#16a34a', text: '#86efac' },
    yellow: { bg: '#1c1a07', border: '#a16207', text: '#fde68a' },
    red:    { bg: '#1c0a0a', border: '#b91c1c', text: '#fca5a5' },
    gray:   { bg: '#0f172a', border: '#334155', text: '#94a3b8' },
  };
  const s = map[color] || map.gray;
  return (
    <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
      {label}
    </span>
  );
}

function Row({ label, value, mono }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '7px 0', borderBottom: '1px solid #1e293b' }}>
      <div style={{ color: '#64748b', fontSize: 12, minWidth: 160, flexShrink: 0 }}>{label}</div>
      <div style={{ color: '#e2e8f0', fontSize: 13, fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}

function fmt(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d)) return v;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

export default function AgentLookup() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [codeStatus, setCodeStatus] = useState('');
  const [codeSending, setCodeSending] = useState(false);

  function getAdminToken() {
    try { if (localStorage.getItem('legacy_planner_owner_access_v1') === 'ok') return 'LegacyLink2026'; } catch {}
    return localStorage.getItem('store_admin_token') || '';
  }

  async function lookup() {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes('@')) { setErr('Enter a valid email.'); return; }
    setErr(''); setResult(null); setCodeStatus('');
    setLoading(true);
    try {
      const token = getAdminToken();
      const res = await fetch('/api/admin/agent-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': token },
        body: JSON.stringify({ email: e }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { setErr(data.error || 'Lookup failed.'); return; }
      setResult(data.result);
    } finally { setLoading(false); }
  }

  async function sendCode() {
    if (!result?.email) return;
    setCodeSending(true); setCodeStatus('');
    try {
      const res = await fetch('/api/unlicensed-backoffice/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: result.email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setCodeStatus(`❌ Failed: ${data.error || 'unknown error'}`);
      } else {
        setCodeStatus(`✅ Login code sent to ${result.email}. Expires in 10 min.`);
      }
    } finally { setCodeSending(false); }
  }

  const r = result;

  return (
    <AppShell title="Agent Lookup">
      <div style={{ maxWidth: 720 }}>
        <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>
          Paste any agent email to see their full system status and send a login code instantly.
        </p>

        {/* Search bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <input
            value={email}
            onChange={e => { setEmail(e.target.value); setResult(null); setCodeStatus(''); }}
            onKeyDown={e => e.key === 'Enter' && lookup()}
            placeholder="agent@email.com"
            style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 14, outline: 'none' }}
          />
          <button
            onClick={lookup}
            disabled={loading}
            style={{ padding: '11px 22px', background: GOLD, color: '#000', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Looking up…' : 'Look Up'}
          </button>
        </div>

        {err && <p style={{ color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>{err}</p>}

        {r && (
          <div style={{ border: '1px solid #1e293b', borderRadius: 14, background: '#0b1220', padding: '20px 22px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>{r.name || r.email}</div>
              {r.canLogin
                ? <StatusPill label="✅ Can Log In" color="green" />
                : r.icaSigned
                  ? <StatusPill label="⚠️ ICA Signed — Check Login" color="yellow" />
                  : r.foundInSystem
                    ? <StatusPill label="🔒 ICA Not Signed Yet" color="red" />
                    : <StatusPill label="❌ Not Found in System" color="red" />
              }
            </div>

            {/* Details */}
            <div style={{ marginBottom: 18 }}>
              <Row label="Email" value={r.email} mono />
              <Row label="Phone" value={r.phone} />
              <Row label="Full Name" value={r.name} />
              <Row label="Home State" value={r.homeState} />
              <Row label="Track" value={r.trackType} />
              <Row label="Source" value={r.source} />
              <Row label="Created" value={fmt(r.createdAt)} />
              <Row label="ICA Status" value={r.contractStatus} />
              <Row label="ICA Signed At" value={fmt(r.contractSignedAt)} />
              <Row label="Record Status" value={r.status} />
              <Row label="Credentials Status" value={r.credentialsStatus} />
              <Row label="Welcome Email" value={r.welcomeEmailStatus ? `${r.welcomeEmailStatus}${r.welcomeEmailSentAt ? ` — ${fmt(r.welcomeEmailSentAt)}` : ''}` : null} />
              <Row label="Also In Sponsorship Apps" value={r.inSponsorshipApps ? 'Yes' : null} />
              <Row label="Upline / Sponsor" value={r.referredBy} />
            </div>

            {/* Bad email alert */}
            {r.badEmail && (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: '#1c0a0a', border: '1px solid #b91c1c', marginBottom: 12, fontSize: 13, color: '#fca5a5', fontWeight: 600 }}>
                🚨 EMAIL TYPO DETECTED — This agent will never receive emails or OTP codes. Fix the email address before anything else.
              </div>
            )}
            {r.isNonGmailProvider && !r.badEmail && r.canLogin && (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: '#1c1007', border: '1px solid #a16207', marginBottom: 12, fontSize: 13, color: '#fde68a' }}>
                ⚠️ Non-Gmail address — Yahoo / Hotmail / AOL / iCloud accounts frequently send OTP codes to spam. Tell the agent to check spam immediately after requesting a code.
              </div>
            )}

            {/* Diagnosis */}
            {r.diagnosis && (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: '#060d1a', border: '1px solid #1e293b', marginBottom: 16, fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>
                <div style={{ color: GOLD, fontWeight: 700, marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>Diagnosis</div>
                {r.diagnosis}
              </div>
            )}

            {/* Action */}
            {r.canLogin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={sendCode}
                  disabled={codeSending}
                  style={{ padding: '10px 20px', background: '#1651AE', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: codeSending ? 0.6 : 1 }}
                >
                  {codeSending ? 'Sending…' : '📧 Send Login Code to Agent Now'}
                </button>
                {codeStatus && <span style={{ fontSize: 13, color: codeStatus.startsWith('✅') ? '#86efac' : '#fca5a5' }}>{codeStatus}</span>}
              </div>
            )}

            {!r.canLogin && r.icaSigned && (
              <div style={{ fontSize: 13, color: '#fde68a', padding: '10px 14px', borderRadius: 9, background: '#1c1a07', border: '1px solid #a16207' }}>
                ⚠️ ICA is signed but login is not resolving — check the start-intake blob store for data integrity issues.
              </div>
            )}

            {!r.foundInSystem && (
              <div style={{ fontSize: 13, color: '#fca5a5', padding: '10px 14px', borderRadius: 9, background: '#1c0a0a', border: '1px solid #b91c1c' }}>
                This email is not in start-intake or sponsorship applications. They may have used a different email address, or they haven&apos;t started yet.
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
