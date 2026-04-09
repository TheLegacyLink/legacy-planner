'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../../../components/AppShell';
import { DEFAULT_CONFIG } from '../../../lib/runtimeConfig';

// ─── Colors ────────────────────────────────────────────────────────────────
const BG = '#0B1020';
const GOLD = '#C8A96B';
const GOLD_SOFT = '#E6D1A6';
const BORDER = '#1E2A45';
const CARD_BG = '#111827';
const CARD_BG2 = '#0f1929';

// ─── Status Definitions ─────────────────────────────────────────────────────
const STATUS_CONFIG = {
  untouched: { label: 'Untouched', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: '🔴' },
  contacted: { label: 'Contacted', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: '🟡' },
  form_submitted: { label: 'Form Submitted', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', icon: '🟢' },
  app_submitted: { label: 'App Submitted', color: GOLD, bg: 'rgba(200,169,107,0.15)', icon: '✅' }
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.untouched;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 999,
        background: cfg.bg,
        color: cfg.color,
        fontWeight: 600,
        fontSize: 12,
        border: `1px solid ${cfg.color}33`,
        whiteSpace: 'nowrap'
      }}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}

function StatCard({ label, value, color, onClick, active }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? `rgba(200,169,107,0.08)` : CARD_BG,
        border: `1px solid ${active ? GOLD : BORDER}`,
        borderRadius: 14,
        padding: '18px 20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
        minWidth: 0
      }}
    >
      <p style={{ margin: '0 0 6px', color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: color || '#f1f5f9' }}>{value}</h2>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function parseCsvRobust(text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Parse CSV respecting quoted fields
  function parseLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] || '').trim(); });
    return row;
  }).filter((r) => r.id);
}

const ACTIVE_AGENTS = DEFAULT_CONFIG.agents.filter(
  (a) => a !== 'Kimora Link'
);

// Add Andrea Cannon if missing
const ALL_AGENTS = (() => {
  const set = new Set(ACTIVE_AGENTS);
  if (!set.has('Andrea Cannon')) return ['Andrea Cannon', ...ACTIVE_AGENTS];
  return ACTIVE_AGENTS;
})();

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({ total: 0, untouched: 0, contacted: 0, form_submitted: 0, app_submitted: 0 });
  const [agentTodayCounts, setAgentTodayCounts] = useState({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // CSV upload state
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // GHL Sync state
  const [ghlSyncing, setGhlSyncing] = useState(false);
  const [ghlSyncMsg, setGhlSyncMsg] = useState('');

  // Distribution state
  const [agentCounts, setAgentCounts] = useState({});
  const [distributing, setDistributing] = useState('');
  const [distMsgs, setDistMsgs] = useState({});
  const [agentLicensedStates, setAgentLicensedStates] = useState({});

  // Auto-distribute settings state
  const [autoDistribute, setAutoDistribute] = useState(false);
  const [autoDistributeAgents, setAutoDistributeAgents] = useState(['Leticia Wright', 'Andrea Cannon']);
  const [autoDistributeCaps, setAutoDistributeCaps] = useState({});
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  // Per-lead assign state: leadId -> { open: bool, assigning: bool, assignedTo: string }
  const [assignState, setAssignState] = useState({});

  // Load auto-distribute settings
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/fb-leads-settings', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok && data.settings) {
        setAutoDistribute(!!data.settings.autoDistribute);
        if (Array.isArray(data.settings.autoDistributeAgents)) {
          setAutoDistributeAgents(data.settings.autoDistributeAgents);
        }
        if (data.settings.autoDistributeCaps && typeof data.settings.autoDistributeCaps === 'object') {
          setAutoDistributeCaps(data.settings.autoDistributeCaps);
        }
      }
    } catch { /* best-effort */ }
  }, []);

  const loadLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/fb-leads', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setLeads(data.leads || []);
        setStats(data.stats || {});
        setAgentTodayCounts(data.agentTodayCounts || {});
        // Build licensed states map from agents array
        if (Array.isArray(data.agents)) {
          const statesMap = {};
          for (const a of data.agents) {
            statesMap[a.name] = a.licensedStates || [];
          }
          setAgentLicensedStates(statesMap);
        }
        setError('');
      } else {
        setError(data?.error || 'Failed to load leads.');
      }
    } catch (err) {
      setError(err.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
    loadSettings();
  }, [loadLeads, loadSettings]);

  // Close any open assign dropdown when clicking outside
  useEffect(() => {
    function handleClick() {
      setAssignState((prev) => {
        const hasOpen = Object.values(prev).some((s) => s?.open);
        if (!hasOpen) return prev;
        const next = {};
        for (const [k, v] of Object.entries(prev)) {
          next[k] = v?.open ? { ...v, open: false } : v;
        }
        return next;
      });
    }
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  // ── Save Auto-Distribute Settings ─────────────────────────────────────────
  async function saveAutoDistributeSettings() {
    setSettingsSaving(true);
    setSettingsMsg('');
    try {
      const res = await fetch('/api/fb-leads-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoDistribute,
          autoDistributeMode: 'balanced',
          autoDistributeAgents,
          autoDistributeCaps
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setSettingsMsg('✅ Settings saved');
      } else {
        setSettingsMsg(`❌ ${data?.error || 'Failed to save'}`);
      }
    } catch (err) {
      setSettingsMsg(`❌ ${err.message}`);
    } finally {
      setSettingsSaving(false);
      setTimeout(() => setSettingsMsg(''), 4000);
    }
  }

  function toggleAutoAgent(agent) {
    setAutoDistributeAgents((prev) =>
      prev.includes(agent) ? prev.filter((a) => a !== agent) : [...prev, agent]
    );
  }

  // ── CSV Import ─────────────────────────────────────────────────────────────
  async function handleCsvFile(file) {
    if (!file) return;
    setImporting(true);
    setImportMsg('');
    try {
      const text = await file.text();
      const rows = parseCsvRobust(text);
      if (!rows.length) {
        setImportMsg('⚠ No valid rows found. Check that your CSV has an "id" column.');
        setImporting(false);
        return;
      }
      const res = await fetch('/api/lead-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setImportMsg(`✅ ${data.added} new leads added • ${data.duplicates} already existed • ${data.total} total`);
        await loadLeads();
      } else {
        setImportMsg(`❌ Import failed: ${data?.error || 'unknown error'}`);
      }
    } catch (err) {
      setImportMsg(`❌ ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  function onFileInput(e) {
    const file = e.target.files?.[0];
    if (file) handleCsvFile(file);
    e.target.value = '';
  }

  function onDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleCsvFile(file);
  }

  // ── Distribution ──────────────────────────────────────────────────────────
  async function distributeToAgent(agentName) {
    const count = Number(agentCounts[agentName] || 0);
    if (!count || count < 1) return;
    if (distributing) return;

    setDistributing(agentName);
    setDistMsgs((prev) => ({ ...prev, [agentName]: '' }));

    try {
      const res = await fetch('/api/fb-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName, count })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setDistMsgs((prev) => ({
          ...prev,
          [agentName]: `✅ Sent ${data.sent} leads to ${agentName}`
        }));
        setAgentCounts((prev) => ({ ...prev, [agentName]: 0 }));
        await loadLeads();
      } else {
        setDistMsgs((prev) => ({
          ...prev,
          [agentName]: `❌ ${data?.error || 'Failed to distribute'}`
        }));
      }
    } catch (err) {
      setDistMsgs((prev) => ({ ...prev, [agentName]: `❌ ${err.message}` }));
    } finally {
      setDistributing('');
    }
  }

  // ── Per-lead Assign ────────────────────────────────────────────────
  function toggleAssignDropdown(leadId) {
    setAssignState((prev) => ({
      ...prev,
      [leadId]: { ...prev[leadId], open: !prev[leadId]?.open, assigning: false }
    }));
  }

  async function assignLeadToAgent(leadId, agentName) {
    setAssignState((prev) => ({
      ...prev,
      [leadId]: { open: false, assigning: true, assignedTo: '' }
    }));
    try {
      const res = await fetch('/api/fb-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName, count: 1, leadId })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setAssignState((prev) => ({
          ...prev,
          [leadId]: { open: false, assigning: false, assignedTo: agentName }
        }));
        await loadLeads();
      } else {
        setAssignState((prev) => ({
          ...prev,
          [leadId]: { open: false, assigning: false, assignedTo: '', error: data?.error || 'Failed' }
        }));
      }
    } catch (err) {
      setAssignState((prev) => ({
        ...prev,
        [leadId]: { open: false, assigning: false, assignedTo: '', error: err.message }
      }));
    }
  }

  // ── GHL Sync Now ──────────────────────────────────────────────────────────
  async function syncGhlLeads() {
    if (ghlSyncing) return;
    setGhlSyncing(true);
    setGhlSyncMsg('');
    try {
      const res = await fetch('/api/ghl-lead-sync', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setGhlSyncMsg(`✅ Found ${data.found} new, ${data.added} added`);
        if (data.added > 0) await loadLeads();
      } else {
        setGhlSyncMsg(`❌ ${data?.error || 'Sync failed'}`);
      }
    } catch (err) {
      setGhlSyncMsg(`❌ ${err.message}`);
    } finally {
      setGhlSyncing(false);
      setTimeout(() => setGhlSyncMsg(''), 6000);
    }
  }

  // ── Untouched leads sorted oldest-first (for state preview) ──────────────
  const untouchedSorted = useMemo(() =>
    leads
      .filter((l) => l.status === 'untouched')
      .sort((a, b) => {
        const at = new Date(a.created_time || a.importedAt || 0).getTime();
        const bt = new Date(b.created_time || b.importedAt || 0).getTime();
        return at - bt;
      }),
    [leads]
  );

  // ── Filtered Leads (display: newest first) ────────────────────────────────
  const filtered = leads
    .filter((l) => {
      if (filter !== 'all' && l.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${l.full_name} ${l.email} ${l.state} ${l.phone_number}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const at = new Date(a.importedAt || a.created_time || 0).getTime();
      const bt = new Date(b.importedAt || b.created_time || 0).getTime();
      return bt - at; // newest first
    });

  const untouchedCount = stats.untouched || 0;

  // ── New leads today (any platform, still untouched) ─────────────────────
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const newTodayUntouched = leads.filter((l) => {
    if (l.status && l.status !== 'untouched') return false;
    const t = new Date(l.importedAt || l.created_time || 0).getTime();
    return t >= todayStart.getTime();
  }).length;

  // ── Styles ────────────────────────────────────────────────────────────────
  const s = {
    page: {
      background: BG,
      minHeight: '100vh',
      color: '#f1f5f9',
      padding: '0 0 60px'
    },
    section: {
      background: CARD_BG,
      border: `1px solid ${BORDER}`,
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 20
    },
    h2: { margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: GOLD_SOFT },
    muted: { margin: 0, color: '#64748b', fontSize: 13 },
    filterBtn: (active) => ({
      padding: '6px 16px',
      borderRadius: 999,
      border: `1px solid ${active ? GOLD : BORDER}`,
      background: active ? `rgba(200,169,107,0.12)` : 'transparent',
      color: active ? GOLD : '#94a3b8',
      cursor: 'pointer',
      fontWeight: active ? 700 : 400,
      fontSize: 13,
      transition: 'all 0.15s'
    }),
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    },
    th: {
      padding: '10px 12px',
      textAlign: 'left',
      color: '#64748b',
      fontWeight: 600,
      borderBottom: `1px solid ${BORDER}`,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      background: CARD_BG2
    },
    td: {
      padding: '10px 12px',
      borderBottom: `1px solid ${BORDER}22`,
      color: '#e2e8f0',
      verticalAlign: 'middle'
    }
  };

  return (
    <AppShell title="Lead Distribution Hub">
      <div style={s.page}>

        {/* ── Facebook Webhook Info Banner ──────────────────────────────── */}
        <details
          style={{
            border: `1px solid #a37a2e`,
            borderRadius: 12,
            background: 'rgba(200,169,107,0.08)',
            padding: '12px 16px',
            marginBottom: 16,
            cursor: 'pointer'
          }}
        >
          <summary style={{ color: GOLD, fontWeight: 700, fontSize: 14, userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📡</span>
            <span>Live Facebook leads are delivered here automatically via webhook</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>Click to expand</span>
          </summary>
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 260, background: '#0f1929', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Webhook URL (register in Facebook Developer Portal)</p>
                <code style={{ color: GOLD_SOFT, fontSize: 13, wordBreak: 'break-all' }}>https://innercirclelink.com/api/facebook-lead-webhook</code>
              </div>
              <div style={{ flex: 1, minWidth: 260, background: '#0f1929', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verify Token (set in Vercel env vars)</p>
                <code style={{ color: GOLD_SOFT, fontSize: 13 }}>FACEBOOK_WEBHOOK_VERIFY_TOKEN</code>
              </div>
            </div>
            <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>
              Leads arrive here automatically when someone fills out a Facebook Lead Ad form. No CSV upload needed.
              Also set <code style={{ color: GOLD_SOFT }}>FACEBOOK_PAGE_ACCESS_TOKEN</code> in Vercel to enable full lead data retrieval.
            </p>
          </div>
        </details>

        {/* ── New Leads Today Banner ──────────────────────────────────── */}
        {newTodayUntouched > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 20px',
              borderRadius: 12,
              background: 'rgba(200,169,107,0.1)',
              border: `1.5px solid ${GOLD}`,
              marginBottom: 16
            }}
          >
            <span
              style={{
                background: GOLD,
                color: '#0B1020',
                fontWeight: 900,
                fontSize: 22,
                minWidth: 40,
                height: 40,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                flexShrink: 0
              }}
            >
              {newTodayUntouched}
            </span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: GOLD_SOFT, fontSize: 15 }}>
                New leads came in today
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                {newTodayUntouched} untouched lead{newTodayUntouched !== 1 ? 's' : ''} arrived today across all platforms — ready to distribute
              </p>
            </div>
          </div>
        )}

        {/* ── Stats Bar ─────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            marginBottom: 20
          }}
        >
          <StatCard label="Total Leads" value={stats.total || 0} onClick={() => setFilter('all')} active={filter === 'all'} />
          <StatCard label="Untouched" value={stats.untouched || 0} color="#ef4444" onClick={() => setFilter('untouched')} active={filter === 'untouched'} />
          <StatCard label="Contacted" value={stats.contacted || 0} color="#f59e0b" onClick={() => setFilter('contacted')} active={filter === 'contacted'} />
          <StatCard label="Form Submitted" value={stats.form_submitted || 0} color="#22c55e" onClick={() => setFilter('form_submitted')} active={filter === 'form_submitted'} />
          <StatCard label="App Submitted" value={stats.app_submitted || 0} color={GOLD} onClick={() => setFilter('app_submitted')} active={filter === 'app_submitted'} />
        </div>

        {/* ── CSV Upload ────────────────────────────────────────────────── */}
        <div style={s.section}>
          <h2 style={s.h2}>📥 Import Facebook Leads</h2>
          <p style={{ ...s.muted, marginBottom: 14 }}>
            Upload a CSV with columns: id, created_time, platform, full_name, email, state, phone_number, ad_name, campaign_name, etc.
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragOver ? GOLD : BORDER}`,
              borderRadius: 12,
              padding: '32px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragOver ? 'rgba(200,169,107,0.05)' : CARD_BG2,
              transition: 'all 0.2s',
              color: isDragOver ? GOLD_SOFT : '#64748b'
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
            <p style={{ margin: 0, fontWeight: 600, color: isDragOver ? GOLD_SOFT : '#94a3b8' }}>
              {importing ? 'Importing…' : 'Drop CSV file here or click to browse'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#475569' }}>
              Accepts: .csv • Deduplicates by Facebook Lead ID
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFileInput}
            style={{ display: 'none' }}
          />

          {importMsg && (
            <p style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 8,
              background: importMsg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${importMsg.startsWith('✅') ? '#22c55e44' : '#ef444444'}`,
              color: importMsg.startsWith('✅') ? '#4ade80' : '#f87171',
              fontSize: 13,
              margin: '12px 0 0'
            }}>
              {importMsg}
            </p>
          )}
        </div>

        {/* ── Auto-Distribute Panel ─────────────────────────────────────── */}
        <div style={s.section}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <h2 style={{ ...s.h2, margin: 0 }}>⚡ Auto-Distribute New Leads</h2>
            {/* Toggle switch */}
            <button
              type="button"
              onClick={() => setAutoDistribute((v) => !v)}
              aria-label={autoDistribute ? 'Disable auto-distribute' : 'Enable auto-distribute'}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                width: 48,
                height: 26,
                borderRadius: 999,
                border: `2px solid ${autoDistribute ? GOLD : '#334155'}`,
                background: autoDistribute
                  ? `linear-gradient(135deg, ${GOLD}, #a0783a)`
                  : '#1e293b',
                cursor: 'pointer',
                transition: 'all 0.2s',
                padding: 0,
                flexShrink: 0
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: autoDistribute ? 'calc(100% - 22px)' : 2,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: autoDistribute ? '#0B1020' : '#475569',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                }}
              />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: autoDistribute ? GOLD : '#64748b' }}>
              {autoDistribute ? 'ON' : 'OFF'}
            </span>
          </div>

          {autoDistribute ? (
            <div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#94a3b8' }}>
                New leads will be automatically balanced across selected agents as they arrive
              </p>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Active agents for auto-distribute
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {ALL_AGENTS.map((agent) => {
                  const checked = autoDistributeAgents.includes(agent);
                  const capVal = autoDistributeCaps[agent] !== undefined ? autoDistributeCaps[agent] : '';
                  return (
                    <div
                      key={agent}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '8px 14px',
                        borderRadius: 10,
                        border: `1px solid ${checked ? GOLD : BORDER}`,
                        background: checked ? 'rgba(200,169,107,0.08)' : CARD_BG2,
                        transition: 'all 0.15s'
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          color: checked ? GOLD_SOFT : '#94a3b8',
                          fontSize: 13,
                          fontWeight: checked ? 700 : 400,
                          flex: 1,
                          userSelect: 'none'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAutoAgent(agent)}
                          style={{ accentColor: GOLD, width: 14, height: 14, cursor: 'pointer' }}
                        />
                        {agent}
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>Max/day</span>
                        <input
                          type="number"
                          min="1"
                          placeholder="∞"
                          value={capVal}
                          onChange={(e) => {
                            const v = e.target.value === '' ? undefined : Number(e.target.value);
                            setAutoDistributeCaps((prev) => {
                              const next = { ...prev };
                              if (v === undefined) { delete next[agent]; } else { next[agent] = v; }
                              return next;
                            });
                          }}
                          style={{
                            width: 60,
                            background: '#0f172a',
                            border: `1px solid ${BORDER}`,
                            borderRadius: 6,
                            padding: '4px 8px',
                            color: '#f1f5f9',
                            fontSize: 12,
                            textAlign: 'center'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>
              Manual mode — distribute leads yourself using the panel below
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              disabled={settingsSaving}
              onClick={saveAutoDistributeSettings}
              style={{
                background: settingsSaving
                  ? '#1e293b'
                  : `linear-gradient(135deg, ${GOLD}, #a0783a)`,
                color: settingsSaving ? '#64748b' : '#0B1020',
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                fontWeight: 700,
                fontSize: 13,
                cursor: settingsSaving ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {settingsSaving ? 'Saving…' : 'Save Settings'}
            </button>
            {settingsMsg && (
              <span style={{
                fontSize: 13,
                color: settingsMsg.startsWith('✅') ? '#4ade80' : '#f87171'
              }}>
                {settingsMsg}
              </span>
            )}
          </div>
        </div>

        {/* ── Distribution Panel ────────────────────────────────────────── */}
        <div style={s.section}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h2 style={{ ...s.h2, margin: 0 }}>📤 Distribute to Agents</h2>
            <span style={{
              padding: '3px 10px', borderRadius: 999,
              background: 'rgba(239,68,68,0.12)', color: '#ef4444',
              fontSize: 12, fontWeight: 700,
              border: '1px solid #ef444433'
            }}>
              {untouchedCount} untouched available
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {ALL_AGENTS.map((agent) => {
              const todayCount = agentTodayCounts[agent] || 0;
              const isBusy = distributing === agent;
              const inputVal = agentCounts[agent] || '';
              const msg = distMsgs[agent] || '';
              const licensedStates = agentLicensedStates[agent] || null;

              // State match preview
              let previewMsg = '';
              const inputNum = Number(inputVal);
              if (inputNum >= 1 && !msg) {
                const batch = untouchedSorted.slice(0, inputNum);
                if (batch.length > 0 && licensedStates && licensedStates.length > 0) {
                  // Normalize state to 2-letter code for comparison
                  const STATE_MAP = { 'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA','colorado':'CO','connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA','hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS','kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD','massachusetts':'MA','michigan':'MI','minnesota':'MN','mississippi':'MS','missouri':'MO','montana':'MT','nebraska':'NE','nevada':'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND','ohio':'OH','oklahoma':'OK','oregon':'OR','pennsylvania':'PA','rhode island':'RI','south carolina':'SC','south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT','virginia':'VA','washington':'WA','west virginia':'WV','wisconsin':'WI','wyoming':'WY','district of columbia':'DC','dc':'DC' };
                  const normalizeState = (s) => { const t = String(s||'').trim().toLowerCase(); return STATE_MAP[t] || t.toUpperCase().slice(0,2); };
                  const matchCount = batch.filter(
                    (l) => l.state && licensedStates.includes(normalizeState(l.state))
                  ).length;
                  const outside = batch.length - matchCount;
                  const firstName = agent.split(' ')[0];
                  const statesSample = licensedStates.slice(0, 3).join(', ');
                  previewMsg = `${batch.length} lead${batch.length !== 1 ? 's' : ''} selected — ${matchCount} match ${firstName}'s states (${statesSample}${licensedStates.length > 3 ? '…' : ''})${outside > 0 ? `, ${outside} outside` : ''}`;
                } else if (batch.length > 0) {
                  previewMsg = `${batch.length} lead${batch.length !== 1 ? 's' : ''} will be sent`;
                } else {
                  previewMsg = 'No untouched leads available';
                }
              }

              return (
                <div
                  key={agent}
                  style={{
                    background: CARD_BG2,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 12,
                    padding: '14px 16px'
                  }}
                >
                  {/* Agent header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, color: GOLD_SOFT, fontSize: 14 }}>{agent}</span>
                    <span style={{
                      fontSize: 11, color: '#64748b',
                      background: '#1e293b', padding: '2px 8px', borderRadius: 999
                    }}>
                      Today: {todayCount}
                    </span>
                  </div>

                  {/* Licensed state pills */}
                  {licensedStates === null ? (
                    <p style={{ margin: '0 0 8px', fontSize: 11, color: '#475569' }}>States: Not on file</p>
                  ) : licensedStates.length === 0 ? (
                    <p style={{ margin: '0 0 8px', fontSize: 11, color: '#475569' }}>States: Not on file</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                      {licensedStates.slice(0, 6).map((st) => (
                        <span
                          key={st}
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'rgba(200,169,107,0.1)',
                            color: '#a08050',
                            border: '1px solid rgba(200,169,107,0.2)',
                            letterSpacing: '0.03em'
                          }}
                        >
                          {st}
                        </span>
                      ))}
                      {licensedStates.length > 6 && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: '#1e293b',
                          color: '#64748b',
                          border: '1px solid #2d3f5a'
                        }}>
                          +{licensedStates.length - 6} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Input + Send */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="number"
                      min="1"
                      max={untouchedCount}
                      value={inputVal}
                      onChange={(e) => {
                        setAgentCounts((prev) => ({ ...prev, [agent]: e.target.value }));
                        // Clear any stale result msg when user edits
                        if (distMsgs[agent]) setDistMsgs((prev) => ({ ...prev, [agent]: '' }));
                      }}
                      placeholder="# to send"
                      style={{
                        flex: 1,
                        background: '#0f172a',
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        padding: '7px 10px',
                        color: '#f1f5f9',
                        fontSize: 13
                      }}
                    />
                    <button
                      type="button"
                      disabled={isBusy || !inputVal || Number(inputVal) < 1 || !!distributing}
                      onClick={() => distributeToAgent(agent)}
                      style={{
                        background: isBusy || !!distributing
                          ? '#1e293b'
                          : `linear-gradient(135deg, ${GOLD}, #a0783a)`,
                        color: isBusy || !!distributing ? '#64748b' : '#0B1020',
                        border: 'none',
                        borderRadius: 8,
                        padding: '7px 14px',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: (isBusy || !inputVal || !!distributing) ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s'
                      }}
                    >
                      {isBusy ? 'Sending…' : 'Send'}
                    </button>
                  </div>

                  {/* Soft state-match preview (shows while typing, before send) */}
                  {previewMsg && !msg && (
                    <p style={{
                      margin: '6px 0 0',
                      fontSize: 11,
                      color: '#64748b',
                      lineHeight: 1.4
                    }}>
                      {previewMsg}
                    </p>
                  )}

                  {/* Post-send confirmation */}
                  {msg && (
                    <p style={{
                      margin: '8px 0 0',
                      fontSize: 12,
                      color: msg.startsWith('✅') ? '#4ade80' : '#f87171'
                    }}>
                      {msg}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Filter Bar ────────────────────────────────────────────────── */}
        <div style={{ ...s.section, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'All' },
              { key: 'untouched', label: '🔴 Untouched' },
              { key: 'contacted', label: '🟡 Contacted' },
              { key: 'form_submitted', label: '🟢 Form Submitted' },
              { key: 'app_submitted', label: '✅ App Submitted' }
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                style={s.filterBtn(filter === key)}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* GHL Sync Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                disabled={ghlSyncing}
                onClick={syncGhlLeads}
                title="Pull latest leads from GoHighLevel"
                style={{
                  background: ghlSyncing
                    ? '#1e293b'
                    : `linear-gradient(135deg, ${GOLD}, #a0783a)`,
                  color: ghlSyncing ? '#64748b' : '#0B1020',
                  border: 'none',
                  borderRadius: 8,
                  padding: '7px 14px',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: ghlSyncing ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span style={{ fontSize: 14 }}>🔄</span>
                {ghlSyncing ? 'Syncing…' : 'Sync GHL Leads'}
              </button>
              {ghlSyncMsg && (
                <span style={{
                  fontSize: 12,
                  color: ghlSyncMsg.startsWith('✅') ? '#4ade80' : '#f87171',
                  whiteSpace: 'nowrap'
                }}>
                  {ghlSyncMsg}
                </span>
              )}
            </div>

            <input
              type="text"
              placeholder="Search name, email, state…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: CARD_BG2,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: '7px 12px',
                color: '#f1f5f9',
                fontSize: 13,
                width: 240,
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* ── Lead Table ───────────────────────────────────────────────── */}
        <div style={{ ...s.section, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${BORDER}` }}>
            <h2 style={{ ...s.h2, margin: 0 }}>
              Lead Table
              <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 400, color: '#64748b' }}>
                {filtered.length} of {leads.length} leads
              </span>
            </h2>
          </div>

          {loading ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#64748b' }}>
              Loading leads…
            </div>
          ) : error ? (
            <div style={{ padding: '24px', color: '#f87171' }}>{error}</div>
          ) : !filtered.length ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#64748b' }}>
              {leads.length === 0
                ? 'No leads imported yet. Upload a Facebook Leads CSV above.'
                : 'No leads match your current filter.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['Name', 'Date In', 'Platform', 'State', 'Email', 'Phone', 'Status', 'Distributed To', 'Actions'].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead, idx) => {
                    const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.untouched;
                    const leadId = lead.id || lead.ghlContactId || String(idx);
                    const aState = assignState[leadId] || {};
                    return (
                      <tr
                        key={leadId}
                        style={{
                          background: idx % 2 === 0 ? CARD_BG : CARD_BG2,
                          borderLeft: `3px solid ${cfg.color}55`
                        }}
                      >
                        <td style={s.td}>
                          <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{lead.full_name || '—'}</span>
                        </td>
                        <td style={{ ...s.td, color: '#94a3b8', fontSize: 12 }}>
                          {fmtDate(lead.created_time || lead.importedAt)}
                        </td>
                        <td style={s.td}>
                          {(() => {
                            const plat = (lead.platform || 'fb').toLowerCase();
                            let bg, color;
                            if (plat === 'ig') { bg = '#7c3aed22'; color = '#a78bfa'; }
                            else if (plat === 'ghl') { bg = '#0369a122'; color = '#38bdf8'; }
                            else { bg = '#1d4ed822'; color = '#60a5fa'; } // fb default
                            return (
                              <span style={{
                                padding: '2px 8px', borderRadius: 6,
                                background: bg, color,
                                fontSize: 11, fontWeight: 700, textTransform: 'uppercase'
                              }}>
                                {plat}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ ...s.td, color: '#94a3b8' }}>{lead.state || '—'}</td>
                        <td style={{ ...s.td, color: '#94a3b8', fontSize: 12 }}>{lead.email || '—'}</td>
                        <td style={{ ...s.td, color: '#94a3b8', fontSize: 12 }}>{lead.phone_number || '—'}</td>
                        <td style={s.td}><StatusBadge status={lead.status} /></td>
                        <td style={{ ...s.td, color: '#64748b', fontSize: 12 }}>
                          {aState.assignedTo
                            ? <span style={{ color: GOLD_SOFT }}>{aState.assignedTo}</span>
                            : lead.distributedTo
                              ? <span style={{ color: GOLD_SOFT }}>{lead.distributedTo}</span>
                              : '—'}
                        </td>
                        <td style={{ ...s.td, position: 'relative' }}>
                          {aState.assigning ? (
                            <span style={{ fontSize: 11, color: '#64748b' }}>Assigning…</span>
                          ) : aState.assignedTo ? (
                            <span style={{ fontSize: 11, color: '#4ade80' }}>✓ Assigned</span>
                          ) : aState.error ? (
                            <span style={{ fontSize: 11, color: '#f87171' }}>{aState.error}</span>
                          ) : (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <button
                                type="button"
                                onClick={() => toggleAssignDropdown(leadId)}
                                style={{
                                  background: `linear-gradient(135deg, ${GOLD}, #a0783a)`,
                                  color: '#0B1020',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '4px 10px',
                                  fontWeight: 700,
                                  fontSize: 11,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                Assign ▾
                              </button>
                              {aState.assigning && <span style={{ color: GOLD, fontSize: 11, marginLeft: 6 }}>Sending...</span>}
                              {aState.assignedTo && <span style={{ color: '#4ade80', fontSize: 11, marginLeft: 6 }}>✓ {aState.assignedTo.split(' ')[0]}</span>}
                              {aState.error && <span style={{ color: '#f87171', fontSize: 10, marginLeft: 6 }}>✗ {aState.error}</span>}
                              {aState.open && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '110%',
                                    left: 0,
                                    zIndex: 100,
                                    background: '#1e293b',
                                    border: `1px solid ${BORDER}`,
                                    borderRadius: 8,
                                    minWidth: 160,
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                    overflow: 'hidden'
                                  }}
                                >
                                  {ALL_AGENTS.map((agent) => (
                                    <button
                                      key={agent}
                                      type="button"
                                      onClick={() => assignLeadToAgent(leadId, agent)}
                                      style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 14px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: GOLD_SOFT,
                                        fontSize: 13,
                                        cursor: 'pointer',
                                        borderBottom: `1px solid ${BORDER}33`
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(200,169,107,0.1)'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                      {agent}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
