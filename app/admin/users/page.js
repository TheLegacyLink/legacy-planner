'use client';
import { useState, useEffect } from 'react';

const GOLD = '#D4AF37';
const BG = '#0E131B';
const CARD = '#141B27';
const CARD2 = '#1A2236';
const TEXT = '#F2F2F2';
const MUTED = '#7B8494';
const BORDER = 'rgba(212,175,55,0.22)';
const SUCCESS = '#4ADE80';
const DANGER = '#F87171';

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12,
      padding: '18px 22px', flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      <div style={{ color: color || GOLD, fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Avatar({ name }) {
  const parts = (name || '').trim().split(' ');
  const initials = parts.length >= 2
    ? (parts[0][0] || '') + (parts[parts.length - 1][0] || '')
    : (parts[0] || '?').slice(0, 2);
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: GOLD, color: BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: 13, flexShrink: 0, textTransform: 'uppercase',
    }}>
      {initials.toUpperCase()}
    </div>
  );
}

function StagePill({ stage }) {
  const map = {
    'Onboarding Complete': { bg: 'rgba(74,222,128,0.14)', color: '#4ADE80', border: '#4ADE8044' },
    'Contracting Done':    { bg: 'rgba(96,165,250,0.14)', color: '#60A5FA', border: '#60A5FA44' },
    'Contracting':         { bg: 'rgba(96,165,250,0.12)', color: '#93C5FD', border: '#93C5FD44' },
    'Community':           { bg: 'rgba(251,191,36,0.14)', color: '#FBBF24', border: '#FBBF2444' },
    'YouTube':             { bg: 'rgba(251,191,36,0.10)', color: '#FCD34D', border: '#FCD34D44' },
    'Service':             { bg: 'rgba(251,191,36,0.10)', color: '#F59E0B', border: '#F59E0B44' },
    'Just Joined':         { bg: 'rgba(123,132,148,0.14)', color: MUTED, border: `${MUTED}44` },
  };
  const style = map[stage] || map['Just Joined'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: style.bg, border: `1px solid ${style.border}`,
      color: style.color, borderRadius: 20,
      padding: '3px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {stage}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

const TABS = ['All', 'Licensed', 'Unlicensed'];

export default function AdminUsersPage() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [hoveredRow, setHoveredRow] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      setMembers(data.rows || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = members.filter((m) => {
    if (activeTab === 'Licensed' && !m.licensed) return false;
    if (activeTab === 'Unlicensed' && m.licensed) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${m.firstName || ''} ${m.lastName || ''}`.toLowerCase();
      const email = (m.email || '').toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });

  const totalLicensed = members.filter((m) => m.licensed).length;
  const totalUnlicensed = members.filter((m) => !m.licensed).length;
  const totalActive = members.filter((m) => m.active !== false).length;

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: "'Inter', sans-serif", padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, color: GOLD, fontSize: 26, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>
            👥 USERS
          </h1>
          <p style={{ margin: '6px 0 0', color: MUTED, fontSize: 14 }}>
            The Legacy Link — Member Directory
          </p>
        </div>
        <button
          onClick={load}
          style={{
            background: CARD2, border: `1px solid ${BORDER}`, color: GOLD,
            padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', letterSpacing: 0.5,
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        <StatCard icon="👥" label="Total Members" value={members.length} />
        <StatCard icon="✅" label="Licensed" value={totalLicensed} color={SUCCESS} />
        <StatCard icon="🔒" label="Unlicensed" value={totalUnlicensed} color={MUTED} />
        <StatCard icon="🟢" label="Active" value={totalActive} color="#60A5FA" />
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: active ? 'rgba(212,175,55,0.10)' : 'transparent',
                border: active ? `1px solid ${GOLD}` : `1px solid transparent`,
                color: active ? GOLD : MUTED,
                borderRadius: 20, padding: '6px 16px',
                fontSize: 13, fontWeight: active ? 700 : 400,
                cursor: 'pointer', letterSpacing: 0.3,
                borderBottom: active ? `2px solid ${GOLD}` : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: CARD, border: `1px solid ${BORDER}`,
            color: TEXT, borderRadius: 8,
            padding: '10px 14px', fontSize: 14,
            outline: 'none',
          }}
          onFocus={(e) => { e.target.style.borderColor = GOLD; }}
          onBlur={(e) => { e.target.style.borderColor = BORDER; }}
        />
      </div>

      {/* Member Table Card */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ color: MUTED, textAlign: 'center', padding: '48px 24px', fontSize: 15 }}>
            Loading members…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ color: MUTED, textAlign: 'center', padding: '48px 24px', fontSize: 15 }}>
            No members found
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['#', 'Member', 'Licensed', 'Stage', 'Status', 'Joined'].map((h) => (
                    <th key={h} style={{
                      padding: '12px 16px', textAlign: 'left',
                      color: MUTED, fontSize: 12, fontWeight: 600,
                      letterSpacing: 0.8, textTransform: 'uppercase',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => {
                  const fullName = `${m.firstName || ''} ${m.lastName || ''}`.trim() || '—';
                  const isActive = m.active !== false;
                  const hovered = hoveredRow === i;
                  return (
                    <tr
                      key={m.id || i}
                      onMouseEnter={() => setHoveredRow(i)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{
                        borderBottom: `1px solid ${BORDER}`,
                        background: hovered ? CARD2 : 'transparent',
                        transition: 'background 0.12s',
                      }}
                    >
                      {/* # */}
                      <td style={{ padding: '12px 16px', color: MUTED, fontSize: 13, width: 40 }}>{i + 1}</td>

                      {/* Member */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={fullName} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>{fullName}</div>
                            <div style={{ color: MUTED, fontSize: 12, marginTop: 1 }}
                              className="email-col">{m.email || '—'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Licensed */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          background: m.licensed ? 'rgba(212,175,55,0.14)' : 'rgba(123,132,148,0.12)',
                          border: `1px solid ${m.licensed ? GOLD + '44' : MUTED + '44'}`,
                          color: m.licensed ? GOLD : MUTED,
                          borderRadius: 20, padding: '3px 10px',
                          fontSize: 12, fontWeight: 600,
                        }}>
                          {m.licensed ? 'Licensed' : 'Unlicensed'}
                        </span>
                      </td>

                      {/* Stage */}
                      <td style={{ padding: '12px 16px' }}>
                        <StagePill stage={m.stage} />
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: isActive ? SUCCESS : DANGER,
                            display: 'inline-block', flexShrink: 0,
                          }} />
                          <span style={{ color: isActive ? SUCCESS : DANGER, fontWeight: 600 }}>
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </span>
                      </td>

                      {/* Joined */}
                      <td style={{ padding: '12px 16px', color: MUTED, fontSize: 13, whiteSpace: 'nowrap' }}>
                        {fmtDate(m.joinedAt || m.createdAt || m.submittedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile hint */}
      <style>{`
        @media (max-width: 600px) {
          .email-col { display: none; }
        }
      `}</style>
    </div>
  );
}
