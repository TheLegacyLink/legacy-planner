'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

const SHEET_ID = '123FyOP10FMJtYYy2HE9M9RrY7ariQ5ayMsfPvEcaPVY';
const GID = '839080285';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${GID}`;

function parseGvizDate(value) {
  if (!value || typeof value !== 'string') return null;
  const m = value.match(/Date\((\d+),(\d+),(\d+)/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return new Date(year, month, day);
}

function formatDate(date) {
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

function hoursLeft(dueDate) {
  if (!dueDate) return null;
  const diffMs = dueDate.getTime() - Date.now();
  return Math.round(diffMs / (1000 * 60 * 60));
}

function statusFromHours(hours) {
  if (hours === null) return 'No due date';
  if (hours < 0) return 'Overdue';
  if (hours <= 6) return 'Urgent';
  if (hours <= 24) return 'Due Soon';
  return 'On Track';
}

export default function SponsorshipsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    let active = true;

    async function loadSheet() {
      try {
        const endpoint = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;
        const res = await fetch(endpoint);
        const text = await res.text();
        const match = text.match(/setResponse\((.*)\);/s);
        if (!match) throw new Error('Could not parse sheet response');

        const payload = JSON.parse(match[1]);
        const table = payload?.table;
        const cols = (table?.cols || []).map((c) => (c?.label || '').trim());

        const cName = cols.indexOf('Name');
        const cPhone = cols.indexOf('Phone');
        const cRef = cols.indexOf('Referred By');
        const cApproved = cols.indexOf('Approved Date');
        const cDue = cols.indexOf('Due Date (24h)');
        const cStatus = cols.indexOf('24hr Status');

        const out = [];
        for (const row of table?.rows || []) {
          const cells = row.c || [];
          const name = cells[cName]?.v || '';
          if (!name) continue;

          const approved = parseGvizDate(cells[cApproved]?.v || '');
          const dueRaw = parseGvizDate(cells[cDue]?.v || '');
          const due = dueRaw || (approved ? new Date(approved.getTime() + 24 * 60 * 60 * 1000) : null);
          const hLeft = hoursLeft(due);

          out.push({
            name: String(name),
            phone: cells[cPhone]?.v ? String(cells[cPhone].v) : '',
            referredBy: cells[cRef]?.v ? String(cells[cRef].v) : '',
            approvedDate: approved,
            dueDate: due,
            hoursLeft: hLeft,
            systemStatus: statusFromHours(hLeft),
            manualStatus: cells[cStatus]?.v ? String(cells[cStatus].v) : ''
          });
        }

        if (active) setRows(out);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSheet();
    const id = setInterval(loadSheet, 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (statusFilter === 'All' ? true : r.systemStatus === statusFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.name, r.phone, r.referredBy, r.manualStatus, r.systemStatus].join(' ').toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const ah = a.hoursLeft ?? 10_000;
        const bh = b.hoursLeft ?? 10_000;
        return ah - bh;
      });
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const out = { total: rows.length, overdue: 0, urgent: 0, dueSoon: 0 };
    for (const r of rows) {
      if (r.systemStatus === 'Overdue') out.overdue += 1;
      if (r.systemStatus === 'Urgent') out.urgent += 1;
      if (r.systemStatus === 'Due Soon') out.dueSoon += 1;
    }
    return out;
  }, [rows]);

  return (
    <AppShell title="Sponsorship Tracker">
      <div className="panel" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', border: '1px solid #334155' }}>
        <div className="panelRow" style={{ marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
          <span className="pill">Total: {stats.total}</span>
          <span className="pill atrisk">Overdue: {stats.overdue}</span>
          <span className="pill atrisk">Urgent: {stats.urgent}</span>
          <span className="pill">Due Soon: {stats.dueSoon}</span>
          <a href={SHEET_URL} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto' }}>
            <button type="button">Open Google Sheet</button>
          </a>
        </div>

        <div className="panelRow" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="muted">Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {['All', 'Overdue', 'Urgent', 'Due Soon', 'On Track', 'No due date'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6, minWidth: 280, flex: 1 }}>
            <span className="muted">Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, referred by..." />
          </label>
        </div>

        {loading ? (
          <p className="muted">Loading sponsorship sheet...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Referred By</th>
                <th>Approved</th>
                <th>Due (24h)</th>
                <th>Time Left</th>
                <th>System Status</th>
                <th>Manual Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.name}-${r.phone}`}>
                  <td>{r.name}</td>
                  <td>{r.phone || '—'}</td>
                  <td>{r.referredBy || '—'}</td>
                  <td>{formatDate(r.approvedDate)}</td>
                  <td>{formatDate(r.dueDate)}</td>
                  <td>{r.hoursLeft === null ? '—' : `${r.hoursLeft}h`}</td>
                  <td>
                    <span className={`pill ${r.systemStatus === 'Overdue' || r.systemStatus === 'Urgent' ? 'atrisk' : 'onpace'}`}>
                      {r.systemStatus}
                    </span>
                  </td>
                  <td>{r.manualStatus || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
