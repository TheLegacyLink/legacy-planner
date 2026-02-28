'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import licensedAgents from '../../data/licensedAgents.json';
import sponsorshipPhoneOverrides from '../../data/sponsorshipPhoneOverrides.json';
import fngPolicies from '../../data/fngPolicies.json';

const SHEET_ID = '123FyOP10FMJtYYy2HE9M9RrY7ariQ5ayMsfPvEcaPVY';
const GID = '839080285';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${GID}`;
const STORAGE_KEY = 'sponsorship_workflow_v1';
const OPERATOR_KEY = 'sponsorship_operator_name_v1';

const STAGES = ['New', 'Called', 'Appointment Set', 'Completed'];
const ACTIVATION_STAGES = [
  'Pending Review',
  'Approved – Onboarding Pending',
  'Approved – Pre-Licensing Required',
  'Pre-Licensing In Progress',
  'Licensed',
  'Onboarding In Progress',
  'Contracting Pending',
  'Contracted',
  'Compliance Complete',
  'Fully Activated',
  'Lead Distribution Enabled'
];
const AGENCY_OWNERS = ['Kimora', 'Jamal', 'Angelique'];
const PAGE_PASSCODE = 'LegacyLink216';
const ACCESS_KEY = 'sponsorship_standalone_access_v1';

function normalizeName(value = '') {
  return String(value).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizePhone(value = '') {
  return String(value).replace(/\D/g, '');
}

function formatPhone(value = '') {
  const digits = normalizePhone(value);
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  return value ? String(value) : '';
}

const PHONE_BY_NAME = (() => {
  const map = new Map();

  // Highest priority: explicit sponsorship sheet export overrides
  for (const [rawName, rawPhone] of Object.entries(sponsorshipPhoneOverrides || {})) {
    const n = normalizeName(rawName);
    const p = formatPhone(rawPhone);
    if (n && p) map.set(n, p);
  }

  // Secondary: licensed-agents directory fallback
  for (const row of licensedAgents) {
    const n = normalizeName(row.full_name || '');
    const p = formatPhone(row.phone || '');
    if (!n || !p) continue;
    if (!map.has(n)) map.set(n, p);

    if (n.includes(',')) {
      const [last, first] = n.split(',').map((x) => x.trim());
      const flipped = normalizeName(`${first} ${last}`);
      if (flipped && !map.has(flipped)) map.set(flipped, p);
    }
  }
  return map;
})();

const EMAIL_BY_NAME = (() => {
  const map = new Map();
  for (const row of licensedAgents) {
    const n = normalizeName(row.full_name || '');
    const e = String(row.email || '').trim().toLowerCase();
    if (!n || !e) continue;
    if (!map.has(n)) map.set(n, e);

    if (n.includes(',')) {
      const [last, first] = n.split(',').map((x) => x.trim());
      const flipped = normalizeName(`${first} ${last}`);
      if (flipped && !map.has(flipped)) map.set(flipped, e);
    }
  }
  return map;
})();

const JAMAL_EMAIL = 'support@jdholmesagencyllc.com';

const COMPLETED_NAME_SET = (() => {
  const set = new Set();
  for (const policy of fngPolicies) {
    const status = String(policy.policy_status || '').toLowerCase();
    if (!status) continue;
    const qualifying = ['active', 'pending lapse', 'issued', 'inforce', 'in force', 'lapsed'];
    if (!qualifying.some((s) => status.includes(s))) continue;

    const owner = normalizeName(policy.owner_name || '');
    if (owner) set.add(owner);
  }
  return set;
})();

function firstLastKey(name = '') {
  const n = normalizeName(name);
  if (!n) return '';
  const parts = n.split(' ').filter(Boolean);
  if (parts.length < 2) return n;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

const CONTRACTED_NAME_SET = (() => {
  const set = new Set();
  for (const row of licensedAgents) {
    const n = normalizeName(row.full_name || '');
    const carriers = row.carriers_all || [];
    if (n && carriers.length) set.add(n);

    if (n.includes(',')) {
      const [last, first] = n.split(',').map((x) => x.trim());
      const flipped = normalizeName(`${first} ${last}`);
      if (flipped && carriers.length) set.add(flipped);
    }
  }
  return set;
})();

const CONTRACTED_FIRST_LAST_SET = (() => {
  const set = new Set();
  for (const row of licensedAgents) {
    const carriers = row.carriers_all || [];
    if (!carriers.length) continue;
    const key = firstLastKey(row.full_name || '');
    if (key) set.add(key);
  }
  return set;
})();

function parseGvizDate(value) {
  if (!value || typeof value !== 'string') return null;
  const m = value.match(/Date\((\d+),(\d+),(\d+)/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]), Number(m[3]));
}

function formatDate(date) {
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
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

function daysSince(isoLike) {
  if (!isoLike) return 0;
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return 0;
  const diffMs = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function rowKey(row) {
  return [row.name, row.phone, row.approvedDate ? row.approvedDate.toISOString().slice(0, 10) : ''].join('|').toUpperCase();
}

function isCompleted(row, wf) {
  const manual = (row.manualStatus || '').toLowerCase();
  return Boolean(row.autoCompleted) || wf?.stage === 'Completed' || manual.includes('complete') || manual.includes('issued');
}

function autoAgencyOwnerFromRow(row) {
  const ref = normalizeName(row.referredBy || '');
  if (ref.includes('KIMORA') || ref.includes('LINK')) return 'Kimora';
  if (ref.includes('ANGEL')) return 'Angelique';
  if (ref.includes('JAMAL')) return 'Jamal';
  return 'Jamal';
}

function contractedStatus(row, wf) {
  if (wf?.contractedOverride === 'Yes') return 'Yes';
  if (wf?.contractedOverride === 'No') return 'No';
  return row.autoContracted ? 'Yes' : 'No';
}

function effectiveLicensingStatus(row, wf) {
  // If contracted, they are licensed by definition.
  if (contractedStatus(row, wf) === 'Yes') return 'Licensed';
  return wf?.licensingStatus || 'Unknown';
}

function effectiveStage(row, wf) {
  if (isCompleted(row, wf)) return 'Completed';
  return wf?.stage || 'New';
}

function processLabel(row, wf) {
  if (isCompleted(row, wf)) return 'First Policy Completed';

  const licensing = effectiveLicensingStatus(row, wf);
  const contracted = contractedStatus(row, wf);

  if (licensing === 'Unlicensed') return 'Needs Pre-licensing';
  if (licensing === 'Pre-licensing') return 'In Pre-licensing';
  if (licensing === 'Licensed' && contracted === 'No') return 'Awaiting Contracting';
  if (licensing === 'Licensed' && contracted === 'Yes') return 'Ready to Write';
  return 'In Progress';
}

function effectiveActivationStage(row, wf) {
  if (wf?.activationStageOverride && wf.activationStageOverride !== 'Auto') return wf.activationStageOverride;

  const licensing = effectiveLicensingStatus(row, wf);
  const contracted = contractedStatus(row, wf);

  if (licensing === 'Unlicensed') return 'Approved – Pre-Licensing Required';
  if (licensing === 'Pre-licensing') return 'Pre-Licensing In Progress';
  if (licensing === 'Licensed' && contracted === 'No') return 'Contracting Pending';
  if (licensing === 'Licensed' && contracted === 'Yes' && isCompleted(row, wf)) return 'Fully Activated';
  if (licensing === 'Licensed' && contracted === 'Yes') return 'Contracted';

  return 'Pending Review';
}

function defaultAgencyOwnerEmail(row, wf) {
  const owner = wf?.agencyOwner || autoAgencyOwnerFromRow(row);
  return (
    String(wf?.agencyOwnerEmail || '').trim().toLowerCase() ||
    EMAIL_BY_NAME.get(normalizeName(owner || '')) ||
    EMAIL_BY_NAME.get(normalizeName(row.referredBy || '')) ||
    ''
  );
}

function onboardingTemplate(licensing = 'Unknown') {
  const common = [
    { id: 'join-skool', label: 'Join Skool', url: 'https://www.skool.com/legacylink/about?ref=660035f641d94e3a919e081e220ed6fe' },
    { id: 'watch-whatever-it-takes', label: 'Watch Whatever It Takes + Leave a Comment', url: 'https://www.youtube.com/watch?v=SVvU9SvCH9o' }
  ];

  if (licensing === 'Unlicensed' || licensing === 'Pre-licensing') {
    return [
      ...common,
      { id: 'contact-jamal', label: 'Operations Outreach (Jamal contacts you)', url: '' },
      { id: 'start-prelicensing', label: 'Start Pre-Licensing', url: '' },
      { id: 'attend-weekly-meeting', label: 'Attend Weekly Meeting', url: '' },
      { id: 'community-service', label: 'Complete 1 Hour Community Service + Upload Proof in App', url: '' }
    ];
  }

  return [
    ...common,
    { id: 'watch-contracting-video', label: 'Watch Get Contracted', url: 'https://youtu.be/d2saZzYzzkA?si=z63iJxMZD0b78guj' },
    { id: 'complete-contracting-profile', label: 'Complete Contracting Profile (SuranceBay)', url: 'https://accounts.surancebay.com/oauth/authorize?redirect_uri=https:%2F%2Fsurelc.surancebay.com%2Fproducer%2Foauth%3FreturnUrl%3D%252Fprofile%252Fcontact-info%253FgaId%253D168%2526gaId%253D168%2526branch%253DInvestaLink%2526branchVisible%253Dtrue%2526branchEditable%253Dfalse%2526branchRequired%253Dtrue%2526autoAdd%253Dfalse%2526requestMethod%253DGET&gaId=168&client_id=surecrmweb&response_type=code' },
    { id: 'attend-weekly-meeting', label: 'Attend Weekly Meeting', url: '' },
    { id: 'community-service', label: 'Complete 1 Hour Community Service + Upload Proof in App', url: '' }
  ];
}

function checklistProgress(wf, licensing) {
  const items = onboardingTemplate(licensing);
  const checklist = wf?.checklist || {};
  const done = items.filter((i) => checklist[i.id]).length;
  return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
}

function makeCodeHash(code = '') {
  try {
    return btoa(`legacy-link|${String(code).trim()}`);
  } catch {
    return '';
  }
}

function splitNameParts(fullName = '') {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: 'Agent', lastName: 'Agent' };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

function buildOnboardingLink(row, wf) {
  if (typeof window === 'undefined') return '';
  const licensing = effectiveLicensingStatus(row, wf);
  const { firstName, lastName } = splitNameParts(row.name || '');
  const codeHash = makeCodeHash(wf?.onboardingCode || '');
  const params = new URLSearchParams({
    first: firstName,
    last: lastName,
    name: row.name || '',
    email: String(wf?.applicantEmail || ''),
    licensing,
    referredBy: row.referredBy || '',
    codeHash
  });
  return `${window.location.origin}/onboarding?${params.toString()}`;
}

export default function SponsorshipsPage() {
  const [standalone, setStandalone] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewTab, setViewTab] = useState('Active Pipeline');
  const [stageFilter, setStageFilter] = useState('All');
  const [activationStageFilter, setActivationStageFilter] = useState('All');
  const [sortMode, setSortMode] = useState('Newest In');
  const [stuckDays, setStuckDays] = useState(5);
  const [stuckOnly, setStuckOnly] = useState(false);
  const [workflow, setWorkflow] = useState({});
  const [operatorName, setOperatorName] = useState('');
  const [sendingActionFor, setSendingActionFor] = useState('');
  const [accessGranted, setAccessGranted] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passError, setPassError] = useState('');

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const isStandalone = params.get('standalone') === '1';
      setStandalone(isStandalone);

      if (localStorage.getItem(ACCESS_KEY) === 'ok') {
        setAccessGranted(true);
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setWorkflow(JSON.parse(raw));
      const op = localStorage.getItem(OPERATOR_KEY) || '';
      setOperatorName(op);
    } catch {
      setWorkflow({});
    }
  }, []);

  function persistWorkflow(next) {
    setWorkflow(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function updateOperatorName(name) {
    setOperatorName(name);
    localStorage.setItem(OPERATOR_KEY, name);
  }

  function unlockPage() {
    if (passcodeInput === PAGE_PASSCODE) {
      localStorage.setItem(ACCESS_KEY, 'ok');
      setAccessGranted(true);
      setPassError('');
      return;
    }
    setPassError('Incorrect passcode. Try again.');
  }

  function updateWorkflow(key, patch) {
    const next = {
      ...workflow,
      [key]: {
        ...(workflow[key] || {}),
        ...patch,
        updatedAt: new Date().toISOString(),
        updatedBy: operatorName || 'Team Member'
      }
    };
    persistWorkflow(next);
  }

  function toggleCalled(key, wf) {
    const currentlyCalled = Boolean(wf?.called);
    const patch = {
      called: !currentlyCalled
    };

    if (!currentlyCalled && (!wf?.stage || wf?.stage === 'New')) {
      patch.stage = 'Called';
    }

    updateWorkflow(key, patch);
  }

  function toggleChecklistItem(key, wf, itemId, checked) {
    const nextChecklist = {
      ...(wf?.checklist || {}),
      [itemId]: checked
    };
    updateWorkflow(key, {
      checklist: nextChecklist,
      ...(checked ? { lastChecklistMovementAt: new Date().toISOString() } : {})
    });
  }

  async function sendOnboardingEmail(row, wf, key) {
    const applicantEmail = String(wf?.applicantEmail || '').trim().toLowerCase();
    const licensing = effectiveLicensingStatus(row, wf);

    if (!applicantEmail) {
      window.alert('Missing applicant email. Add Applicant Email first.');
      return;
    }

    if (licensing === 'Unknown') {
      window.alert('Missing status. Set Licensing before sending onboarding email.');
      return;
    }

    const first = String(row.name || '').trim().split(' ')[0] || 'Agent';
    const items = onboardingTemplate(licensing);
    const bullets = items.map((item, idx) => `${idx + 1}) ${item.label}${item.url ? `: ${item.url}` : ''}`).join('\n');
    const isUnlicensed = licensing === 'Unlicensed' || licensing === 'Pre-licensing';
    const jamalLine = isUnlicensed ? `\nJamal will contact you directly to begin pre-licensing. For urgent questions: ${JAMAL_EMAIL}` : '';

    const onboardingCode = String(wf?.onboardingCode || `${Math.floor(100000 + Math.random() * 900000)}`);
    const nextWf = { ...wf, onboardingCode };
    const onboardingLink = buildOnboardingLink(row, nextWf);

    const subject = isUnlicensed ? `Legacy Link Onboarding (Unlicensed) — ${first}` : `Legacy Link Onboarding — ${first}`;
    const text = [
      `Hi ${first},`,
      '',
      'Your onboarding application has been approved.',
      isUnlicensed
        ? 'Your next step is pre-licensing. Follow the checklist below and complete each item.'
        : 'You are cleared to begin onboarding and contracting. Complete each checklist item below.',
      '',
      'Your private onboarding portal:',
      onboardingLink,
      `Access Code: ${onboardingCode}`,
      '',
      bullets,
      '',
      'Once you are contracted and all checklist items are complete, you will begin receiving leads.',
      jamalLine,
      '',
      '— The Legacy Link Team'
    ].join('\n');

    const htmlItems = items
      .map((item) => `<li>${item.url ? `<a href="${item.url}" target="_blank" rel="noreferrer">${item.label}</a>` : item.label}</li>`)
      .join('');
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a;"><p>Hi ${first},</p><p>Your onboarding application has been approved.</p><p>${isUnlicensed ? 'Your next step is pre-licensing.' : 'You are cleared to begin onboarding and contracting.'} Complete each checklist item below:</p><p><strong>Your private onboarding portal:</strong><br/><a href="${onboardingLink}" target="_blank" rel="noreferrer">Open Onboarding Portal</a><br/><strong>Access Code:</strong> ${onboardingCode}</p><ol>${htmlItems}</ol><p><strong>Once you are contracted and all checklist items are complete, you will begin receiving leads.</strong></p>${isUnlicensed ? `<p><strong>Jamal will contact you directly</strong> to begin pre-licensing. For urgent questions: <a href="mailto:${JAMAL_EMAIL}">${JAMAL_EMAIL}</a></p>` : ''}<p>— The Legacy Link Team</p></div>`;

    setSendingActionFor(key);
    try {
      const res = await fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: applicantEmail, subject, text, html })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        window.alert(`Onboarding email failed: ${data?.error || 'unknown_error'}`);
        return;
      }

      if (isUnlicensed) {
        const jamalSubject = `Unlicensed Approval: ${row.name}`;
        const jamalText = [
          'Jamal,',
          '',
          'An unlicensed applicant was approved and needs onboarding outreach.',
          `Name: ${row.name}`,
          `Email: ${applicantEmail}`,
          `Phone: ${row.phone || 'N/A'}`,
          `Referred By: ${row.referredBy || 'N/A'}`,
          '',
          'Please reach out at your earliest convenience.'
        ].join('\n');

        await fetch('/api/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: JAMAL_EMAIL, subject: jamalSubject, text: jamalText })
        });
      }

      updateWorkflow(key, { onboardingSentAt: new Date().toISOString(), onboardingCode });
      window.alert(`Onboarding email sent to ${applicantEmail}`);
    } catch (error) {
      window.alert(`Onboarding email failed: ${error?.message || 'send_failed'}`);
    } finally {
      setSendingActionFor('');
    }
  }

  async function sendContractedEmail(row, wf, key) {
    const applicantEmail = String(wf?.applicantEmail || '').trim().toLowerCase();
    if (!applicantEmail) {
      window.alert('Missing applicant email. Add Applicant Email first.');
      return;
    }

    if (contractedStatus(row, wf) !== 'Yes') {
      window.alert('This is for contracted agents only. Mark contracted first.');
      return;
    }

    const first = String(row.name || '').trim().split(' ')[0] || 'Agent';
    const subject = `You’re Contracted — Back Office Access & Setup (${first})`;
    const text = [
      `Hi ${first},`,
      '',
      'Congratulations — you are now contracted.',
      'Next step: Watch Back Office Access & Setup:',
      'https://youtu.be/QVg0rUti1hM',
      '',
      'Complete all remaining onboarding checklist items to begin receiving leads.',
      '',
      '— The Legacy Link Team'
    ].join('\n');

    setSendingActionFor(key);
    try {
      const res = await fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: applicantEmail, subject, text })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        window.alert(`Contracted email failed: ${data?.error || 'unknown_error'}`);
        return;
      }

      updateWorkflow(key, { contractedEmailSentAt: new Date().toISOString() });
      window.alert(`Contracted email sent to ${applicantEmail}`);
    } catch (error) {
      window.alert(`Contracted email failed: ${error?.message || 'send_failed'}`);
    } finally {
      setSendingActionFor('');
    }
  }

  async function sendNoMovementAlert(row, wf, key) {
    const ownerEmail = String(defaultAgencyOwnerEmail(row, wf) || '').trim().toLowerCase();
    const applicantEmail = String(wf?.applicantEmail || '').trim().toLowerCase();
    if (!ownerEmail) {
      window.alert('Missing agency owner email. Add Agency Owner Email first.');
      return;
    }

    const licensing = effectiveLicensingStatus(row, wf);
    const progress = checklistProgress(wf, licensing);
    const anchor = wf?.onboardingSentAt || (row.approvedDate ? row.approvedDate.toISOString() : '');
    const ageDays = daysSince(wf?.lastChecklistMovementAt || anchor);

    if (ageDays < 3) {
      window.alert(`No 72-hour alert yet. Current no-movement age: ${ageDays}d`);
      return;
    }

    setSendingActionFor(key);
    try {
      const subject = `72-Hour No Movement Alert: ${row.name}`;
      const text = [
        '72-hour no-movement alert.',
        `Applicant: ${row.name}`,
        `Applicant Email: ${applicantEmail || 'N/A'}`,
        `Phone: ${row.phone || 'N/A'}`,
        `Referred By: ${row.referredBy || 'N/A'}`,
        `Licensing: ${licensing}`,
        `Checklist Progress: ${progress.done}/${progress.total}`,
        `No movement age: ${ageDays} days`
      ].join('\n');

      await Promise.all([
        fetch('/api/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: ownerEmail, subject, text })
        }),
        fetch('/api/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: JAMAL_EMAIL, subject, text })
        })
      ]);

      updateWorkflow(key, { lastEscalatedAt: new Date().toISOString() });
      window.alert('72-hour alert sent to agency owner + Jamal');
    } catch (error) {
      window.alert(`72-hour alert failed: ${error?.message || 'send_failed'}`);
    } finally {
      setSendingActionFor('');
    }
  }

  function copyOnboardingAccess(row, wf, key) {
    const onboardingCode = String(wf?.onboardingCode || `${Math.floor(100000 + Math.random() * 900000)}`);
    const nextWf = { ...wf, onboardingCode };
    const link = buildOnboardingLink(row, nextWf);
    if (!link) {
      window.alert('Could not build onboarding link.');
      return;
    }
    navigator.clipboard.writeText(`${link}\nAccess Code: ${onboardingCode}`).catch(() => {});
    if (!wf?.onboardingCode) {
      updateWorkflow(key, { onboardingCode });
    }
    window.alert('Onboarding link + access code copied.');
  }

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

          const phoneCell = cells[cPhone] || {};
          const phoneFromSheet = formatPhone(phoneCell.f || (phoneCell.v != null ? String(phoneCell.v) : ''));
          const phoneFromDirectory = PHONE_BY_NAME.get(normalizeName(String(name))) || '';

          out.push({
            name: String(name),
            phone: phoneFromSheet || phoneFromDirectory,
            referredBy: cells[cRef]?.v ? String(cells[cRef].v) : '',
            approvedDate: approved,
            dueDate: due,
            hoursLeft: hLeft,
            systemStatus: statusFromHours(hLeft),
            manualStatus: cells[cStatus]?.v ? String(cells[cStatus].v) : '',
            autoCompleted: COMPLETED_NAME_SET.has(normalizeName(String(name))),
            autoContracted:
              CONTRACTED_NAME_SET.has(normalizeName(String(name))) ||
              CONTRACTED_FIRST_LAST_SET.has(firstLastKey(String(name)))
          });
        }

        const dedupedMap = new Map();
        for (const row of out) {
          const key = normalizeName(row.name);
          if (!key) continue;

          if (!dedupedMap.has(key)) {
            dedupedMap.set(key, row);
            continue;
          }

          const prev = dedupedMap.get(key);
          const prevApproved = prev.approvedDate ? prev.approvedDate.getTime() : 0;
          const curApproved = row.approvedDate ? row.approvedDate.getTime() : 0;

          const pickCurrent =
            curApproved > prevApproved ||
            (!prev.phone && Boolean(row.phone)) ||
            (!prev.autoCompleted && Boolean(row.autoCompleted));

          dedupedMap.set(key, pickCurrent ? row : prev);
        }

        if (active) setRows(Array.from(dedupedMap.values()));
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

  useEffect(() => {
    if (loading || !rows.length) return;

    let cancelled = false;

    async function runAutoOnApprovalNotifications() {
      for (const r of rows) {
        if (cancelled) return;
        const key = rowKey(r);
        const wf = workflow[key] || {};

        if (wf.onboardingSentAt) continue;
        if (!r.approvedDate) continue;

        const applicantEmail = String(wf?.applicantEmail || '').trim().toLowerCase();
        const licensing = effectiveLicensingStatus(r, wf);
        if (!applicantEmail || licensing === 'Unknown') continue;

        const ownerEmail = String(defaultAgencyOwnerEmail(r, wf) || '').trim().toLowerCase();
        const onboardingCode = String(wf?.onboardingCode || `${Math.floor(100000 + Math.random() * 900000)}`);
        const nextWf = { ...wf, onboardingCode };
        const onboardingLink = buildOnboardingLink(r, nextWf);
        const first = String(r.name || '').trim().split(' ')[0] || 'Agent';
        const items = onboardingTemplate(licensing);
        const bullets = items.map((item, idx) => `${idx + 1}) ${item.label}${item.url ? `: ${item.url}` : ''}`).join('\n');
        const isUnlicensed = licensing === 'Unlicensed' || licensing === 'Pre-licensing';

        const subject = isUnlicensed ? `Legacy Link Onboarding (Unlicensed) — ${first}` : `Legacy Link Onboarding — ${first}`;
        const text = [
          `Hi ${first},`,
          '',
          'Your onboarding application has been approved.',
          'Your private onboarding portal:',
          onboardingLink,
          `Access Code: ${onboardingCode}`,
          '',
          bullets,
          '',
          'Once you are contracted and all checklist items are complete, you will begin receiving leads.',
          isUnlicensed ? `Jamal will contact you directly. Operations email: ${JAMAL_EMAIL}` : '',
          '',
          '— The Legacy Link Team'
        ].join('\n');

        try {
          const sendApplicant = fetch('/api/send-welcome-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: applicantEmail, subject, text })
          });

          const notifyOwner = ownerEmail
            ? fetch('/api/send-welcome-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: ownerEmail,
                  subject: `Approved + Onboarding Sent: ${r.name}`,
                  text: `Applicant approved and onboarding sent.\nName: ${r.name}\nApplicant Email: ${applicantEmail}\nLicensing: ${licensing}`
                })
              })
            : Promise.resolve();

          const notifyJamal = isUnlicensed
            ? fetch('/api/send-welcome-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: JAMAL_EMAIL,
                  subject: `Unlicensed Approval: ${r.name}`,
                  text: `Unlicensed applicant approved and needs outreach.\nName: ${r.name}\nEmail: ${applicantEmail}\nPhone: ${r.phone || 'N/A'}\nReferred By: ${r.referredBy || 'N/A'}`
                })
              })
            : Promise.resolve();

          await Promise.all([sendApplicant, notifyOwner, notifyJamal]);

          updateWorkflow(key, {
            onboardingCode,
            onboardingSentAt: new Date().toISOString(),
            approvedNotificationAt: new Date().toISOString(),
            autoOnApprovalSentAt: new Date().toISOString()
          });
        } catch (error) {
          console.error('Auto onboarding send failed', error);
        }
      }
    }

    runAutoOnApprovalNotifications();
    const autoId = setInterval(runAutoOnApprovalNotifications, 120000);

    return () => {
      cancelled = true;
      clearInterval(autoId);
    };
  }, [loading, rows, workflow]);

  useEffect(() => {
    if (loading || !rows.length) return;

    let cancelled = false;

    async function runAuto72hEscalations() {
      for (const r of rows) {
        if (cancelled) return;

        const key = rowKey(r);
        const wf = workflow[key] || {};
        if (isCompleted(r, wf)) continue;
        if (!wf.onboardingSentAt) continue;

        const ownerEmail = String(defaultAgencyOwnerEmail(r, wf) || '').trim().toLowerCase();
        if (!ownerEmail) continue;

        const licensing = effectiveLicensingStatus(r, wf);
        const progress = checklistProgress(wf, licensing);
        if (progress.total > 0 && progress.done >= progress.total) continue;

        const anchor = wf.lastChecklistMovementAt || wf.onboardingSentAt || (r.approvedDate ? r.approvedDate.toISOString() : '');
        const ageDays = daysSince(anchor);
        if (ageDays < 3) continue;

        if (wf.lastEscalatedAt && daysSince(wf.lastEscalatedAt) < 1) continue;

        const applicantEmail = String(wf?.applicantEmail || '').trim().toLowerCase();
        const subject = `72-Hour No Movement Alert: ${r.name}`;
        const text = [
          '72-hour no-movement alert.',
          `Applicant: ${r.name}`,
          `Applicant Email: ${applicantEmail || 'N/A'}`,
          `Phone: ${r.phone || 'N/A'}`,
          `Referred By: ${r.referredBy || 'N/A'}`,
          `Agency Owner: ${wf.agencyOwner || autoAgencyOwnerFromRow(r)}`,
          `Licensing: ${licensing}`,
          `Checklist Progress: ${progress.done}/${progress.total}`,
          `No movement age: ${ageDays} days`
        ].join('\n');

        try {
          await Promise.all([
            fetch('/api/send-welcome-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: ownerEmail, subject, text })
            }),
            fetch('/api/send-welcome-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: JAMAL_EMAIL, subject, text })
            })
          ]);

          updateWorkflow(key, { lastEscalatedAt: new Date().toISOString(), autoEscalatedAt: new Date().toISOString() });
        } catch (error) {
          console.error('Auto 72h escalation failed', error);
        }
      }
    }

    runAuto72hEscalations();
    const id = setInterval(runAuto72hEscalations, 120000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [loading, rows, workflow]);

  const agencyOwnerDashboard = useMemo(() => {
    const groups = new Map();

    for (const r of rows) {
      const key = rowKey(r);
      const wf = workflow[key] || {};
      const owner = wf.agencyOwner || autoAgencyOwnerFromRow(r);
      const licensing = effectiveLicensingStatus(r, wf);
      const progress = checklistProgress(wf, licensing);
      const anchor = wf.lastChecklistMovementAt || wf.onboardingSentAt || (r.approvedDate ? r.approvedDate.toISOString() : '');
      const noMovementDays = daysSince(anchor);

      if (!groups.has(owner)) {
        groups.set(owner, { owner, active: 0, completed: 0, stalled: 0, members: [] });
      }

      const bucket = groups.get(owner);
      const done = isCompleted(r, wf);
      if (done) bucket.completed += 1;
      else bucket.active += 1;
      if (!done && noMovementDays >= 3) bucket.stalled += 1;

      bucket.members.push({
        name: r.name,
        referredBy: r.referredBy,
        stage: effectiveActivationStage(r, wf),
        licensing,
        progress: `${progress.done}/${progress.total}`,
        noMovementDays,
        done
      });
    }

    return Array.from(groups.values()).sort((a, b) => a.owner.localeCompare(b.owner));
  }, [rows, workflow]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const list = rows
      .filter((r) => {
        const wf = workflow[rowKey(r)] || {};
        const done = isCompleted(r, wf);
        if (viewTab === 'Completed Policies') return done;
        if (viewTab === 'Decision Tree SOP') return false;
        if (viewTab === 'Agency Owner Dashboard') return false;
        return !done;
      })
      .filter((r) => (statusFilter === 'All' ? true : r.systemStatus === statusFilter))
      .filter((r) => {
        const wf = workflow[rowKey(r)] || {};
        return stageFilter === 'All' ? true : effectiveStage(r, wf) === stageFilter;
      })
      .filter((r) => {
        const wf = workflow[rowKey(r)] || {};
        return activationStageFilter === 'All' ? true : effectiveActivationStage(r, wf) === activationStageFilter;
      })
      .filter((r) => {
        if (!stuckOnly) return true;
        const wf = workflow[rowKey(r)] || {};
        const anchor = wf.updatedAt || (r.approvedDate ? r.approvedDate.toISOString() : '');
        return daysSince(anchor) >= stuckDays;
      })
      .filter((r) => {
        if (!q) return true;
        const wf = workflow[rowKey(r)] || {};
        return [
          r.name,
          r.phone,
          r.referredBy,
          r.manualStatus,
          r.systemStatus,
          wf.agencyOwner || autoAgencyOwnerFromRow(r),
          wf.stage,
          wf.licensingStatus,
          wf.applicantEmail,
          wf.agencyOwnerEmail,
          wf.contractedOverride,
          processLabel(r, wf),
          effectiveActivationStage(r, wf),
          wf.notes,
          wf.updatedBy
        ]
          .join(' ')
          .toLowerCase()
          .includes(q);
      });

    return list.sort((a, b) => {
      const awf = workflow[rowKey(a)] || {};
      const bwf = workflow[rowKey(b)] || {};

      const aApproved = a.approvedDate ? a.approvedDate.getTime() : 0;
      const bApproved = b.approvedDate ? b.approvedDate.getTime() : 0;
      const aDue = a.dueDate ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;

      if (sortMode === 'Newest In') return bApproved - aApproved;
      if (sortMode === 'Oldest In') return aApproved - bApproved;
      if (sortMode === 'Due Soonest') return aDue - bDue;
      if (sortMode === 'Most Overdue') return (a.hoursLeft ?? 99999) - (b.hoursLeft ?? 99999);
      if (sortMode === 'A-Z') return (a.name || '').localeCompare(b.name || '');

      // fallback
      return bApproved - aApproved;
    });
  }, [rows, search, statusFilter, viewTab, stageFilter, activationStageFilter, sortMode, stuckOnly, stuckDays, workflow]);

  const stats = useMemo(() => {
    const out = { total: rows.length, overdueOpen: 0, urgentOpen: 0, dueSoonOpen: 0, completed: 0, called: 0, stuck: 0 };
    for (const r of rows) {
      const wf = workflow[rowKey(r)] || {};
      const done = isCompleted(r, wf);
      if (done) {
        out.completed += 1;
      } else {
        if (r.systemStatus === 'Overdue') out.overdueOpen += 1;
        if (r.systemStatus === 'Urgent') out.urgentOpen += 1;
        if (r.systemStatus === 'Due Soon') out.dueSoonOpen += 1;
        const anchor = wf.updatedAt || (r.approvedDate ? r.approvedDate.toISOString() : '');
        if (daysSince(anchor) >= stuckDays) out.stuck += 1;
      }
      if (wf.called) out.called += 1;
    }
    return out;
  }, [rows, workflow, stuckDays]);

  const stuckDigest = useMemo(() => {
    const lines = [];
    for (const r of rows) {
      const wf = workflow[rowKey(r)] || {};
      if (isCompleted(r, wf)) continue;
      const anchor = wf.updatedAt || (r.approvedDate ? r.approvedDate.toISOString() : '');
      const ageDays = daysSince(anchor);
      if (ageDays < stuckDays) continue;

      const stage = effectiveStage(r, wf);
      const agencyOwner = wf.agencyOwner || autoAgencyOwnerFromRow(r);
      lines.push(`- ${r.name} | ${stage} | ${ageDays}d | Agency Owner: ${agencyOwner}`);
    }

    if (!lines.length) return `No stuck records (>= ${stuckDays} days) right now.`;
    return [`Stuck records (>= ${stuckDays} days):`, ...lines].join('\n');
  }, [rows, workflow, stuckDays]);

  const agencyOwnerAlertsDigest = useMemo(() => {
    const groups = new Map();

    for (const r of rows) {
      const wf = workflow[rowKey(r)] || {};
      if (isCompleted(r, wf)) continue;

      const anchor = wf.updatedAt || (r.approvedDate ? r.approvedDate.toISOString() : '');
      const ageDays = daysSince(anchor);
      if (ageDays < stuckDays) continue;

      const owner = wf.agencyOwner || autoAgencyOwnerFromRow(r);
      const stage = effectiveStage(r, wf);
      if (!groups.has(owner)) groups.set(owner, []);
      groups.get(owner).push(`- ${r.name} | ${stage} | ${ageDays}d stuck`);
    }

    if (!groups.size) return `No agency owner alerts (>= ${stuckDays} days stuck) right now.`;

    const parts = [`Agency Owner Alerts (>= ${stuckDays} days stuck):`];
    for (const [owner, items] of groups.entries()) {
      parts.push(`\n${owner}`);
      parts.push(...items);
    }
    return parts.join('\n');
  }, [rows, workflow, stuckDays]);

  const dailySummaryDigest = useMemo(() => {
    const active = rows.filter((r) => !isCompleted(r, workflow[rowKey(r)] || {}));
    const completed = rows.filter((r) => isCompleted(r, workflow[rowKey(r)] || {}));
    const stuck = active.filter((r) => {
      const wf = workflow[rowKey(r)] || {};
      const anchor = wf.updatedAt || (r.approvedDate ? r.approvedDate.toISOString() : '');
      return daysSince(anchor) >= stuckDays;
    });

    return [
      `Daily Sponsorship Summary`,
      `- Active: ${active.length}`,
      `- Stuck (>= ${stuckDays}d): ${stuck.length}`,
      `- Completed: ${completed.length}`,
      `- Called: ${stats.called}`
    ].join('\n');
  }, [rows, workflow, stuckDays, stats.called]);

  function copyStuckDigest() {
    navigator.clipboard.writeText(stuckDigest).catch(() => {});
  }

  function copyAgencyOwnerAlertsDigest() {
    navigator.clipboard.writeText(agencyOwnerAlertsDigest).catch(() => {});
  }

  function copyDailySummaryDigest() {
    navigator.clipboard.writeText(dailySummaryDigest).catch(() => {});
  }

  if (!accessGranted) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0a0a0a', color: '#fff', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 420, border: '1px solid #333', borderRadius: 12, padding: 20, background: '#111' }}>
          <h2 style={{ marginTop: 0 }}>Sponsorship Tracker Access</h2>
          <p style={{ color: '#bbb' }}>Enter passcode to view this board.</p>
          <input
            type="password"
            value={passcodeInput}
            onChange={(e) => setPasscodeInput(e.target.value)}
            placeholder="Passcode"
            style={{ width: '100%', marginBottom: 10 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') unlockPage();
            }}
          />
          <button type="button" onClick={unlockPage}>Unlock</button>
          {passError ? <p style={{ color: '#f87171' }}>{passError}</p> : null}
        </div>
      </main>
    );
  }

  const core = (
    <div className="panel" style={{ background: '#0a0a0a', border: '1px solid #3a3a3a' }}>
      <div className="panelRow" style={{ marginBottom: 12, gap: 10 }}>
        <button
          type="button"
          onClick={() => setViewTab('Active Pipeline')}
          style={viewTab === 'Active Pipeline' ? { background: '#fff', color: '#111' } : undefined}
        >
          Active Pipeline
        </button>
        <button
          type="button"
          onClick={() => setViewTab('Completed Policies')}
          style={viewTab === 'Completed Policies' ? { background: '#166534', color: '#fff' } : undefined}
        >
          Completed Policies
        </button>
        <button
          type="button"
          onClick={() => setViewTab('Decision Tree SOP')}
          style={viewTab === 'Decision Tree SOP' ? { background: '#1d4ed8', color: '#fff' } : undefined}
        >
          Decision Tree SOP
        </button>
        <button
          type="button"
          onClick={() => setViewTab('Agency Owner Dashboard')}
          style={viewTab === 'Agency Owner Dashboard' ? { background: '#7c3aed', color: '#fff' } : undefined}
        >
          Agency Owner Dashboard
        </button>
      </div>

      <div className="panelRow" style={{ marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <span className="pill" style={{ background: '#1a1a1a', color: '#fff' }}>Total: {stats.total}</span>
        <span className="pill" style={{ background: '#7f1d1d', color: '#fff' }}>Overdue (Open): {stats.overdueOpen}</span>
        <span className="pill" style={{ background: '#b45309', color: '#fff' }}>Urgent (Open): {stats.urgentOpen}</span>
        <span className="pill" style={{ background: '#a16207', color: '#fff' }}>Due Soon (Open): {stats.dueSoonOpen}</span>
        <span className="pill" style={{ background: '#1a1a1a', color: '#fff' }}>Called: {stats.called}</span>
        <span className="pill" style={{ background: '#9a3412', color: '#fff' }}>Stuck: {stats.stuck}</span>
        <span className="pill" style={{ background: '#166534', color: '#fff' }}>Completed: {stats.completed}</span>
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

        <label style={{ display: 'grid', gap: 6 }}>
          <span className="muted">Stage</span>
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            {['All', ...STAGES].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span className="muted">Activation Stage</span>
          <select value={activationStageFilter} onChange={(e) => setActivationStageFilter(e.target.value)}>
            {['All', ...ACTIVATION_STAGES].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span className="muted">Order</span>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
            {['Newest In', 'Oldest In', 'Due Soonest', 'Most Overdue', 'A-Z'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span className="muted">Stuck threshold (days)</span>
          <input
            type="number"
            min={1}
            value={stuckDays}
            onChange={(e) => setStuckDays(Math.max(1, Number(e.target.value || 1)))}
            style={{ width: 90 }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'end', gap: 6 }}>
          <input type="checkbox" checked={stuckOnly} onChange={(e) => setStuckOnly(e.target.checked)} />
          <span className="muted">Stuck only</span>
        </label>

        <label style={{ display: 'grid', gap: 6, minWidth: 220 }}>
          <span className="muted">Updated by (your name)</span>
          <input value={operatorName} onChange={(e) => updateOperatorName(e.target.value)} placeholder="Ex: Kimora" />
        </label>

        <label style={{ display: 'grid', gap: 6, minWidth: 280, flex: 1 }}>
          <span className="muted">Search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, agency owner, notes..." />
        </label>

        <button type="button" onClick={copyStuckDigest}>Copy Stuck Digest</button>
        <button type="button" onClick={copyAgencyOwnerAlertsDigest}>Copy Agency Owner Alerts</button>
        <button type="button" onClick={copyDailySummaryDigest}>Copy Daily Summary</button>

        {!standalone && (
          <a href="/sponsorships?standalone=1" target="_blank" rel="noreferrer">
            <button type="button">Open Standalone View</button>
          </a>
        )}
      </div>

      {viewTab === 'Decision Tree SOP' ? (
        <div className="panel" style={{ background: '#111', border: '1px solid #2a2a2a', marginTop: 8 }}>
          <h3 style={{ marginTop: 0 }}>Licensed vs Unlicensed Decision Tree</h3>
          <p className="muted" style={{ marginTop: 0 }}>Use this tab to classify each person into one activation stage. The Activation Stage column in the pipeline is built from this same logic.</p>

          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ border: '1px solid #2a2a2a', borderRadius: 10, padding: 12 }}>
              <strong>1) Is the person licensed?</strong>
              <ul style={{ marginTop: 8 }}>
                <li><strong>No</strong> → Approved – Pre-Licensing Required</li>
                <li><strong>Started class/studying</strong> → Pre-Licensing In Progress</li>
                <li><strong>Passed state exam + license submitted</strong> → Licensed (then move to Licensed Flow)</li>
              </ul>
            </div>

            <div style={{ border: '1px solid #2a2a2a', borderRadius: 10, padding: 12 }}>
              <strong>2) Licensed Flow Stages</strong>
              <ul style={{ marginTop: 8 }}>
                <li>Pending Review</li>
                <li>Approved – Onboarding Pending</li>
                <li>Onboarding In Progress (Skool, links, CRM walkthrough, docs)</li>
                <li>Contracting Pending</li>
                <li>Contracted</li>
                <li>Compliance Complete (community service + culture requirements)</li>
                <li>Fully Activated (all agreements and checklist done)</li>
                <li>Lead Distribution Enabled (only after full activation)</li>
              </ul>
            </div>

            <div style={{ border: '1px solid #2a2a2a', borderRadius: 10, padding: 12 }}>
              <strong>3) Non-Negotiable Gate</strong>
              <p style={{ margin: '8px 0 0 0' }}>
                Approval does not equal lead distribution. Leads are released only when licensing, contracting,
                onboarding, community service, and internal agreements are complete.
              </p>
            </div>
          </div>
        </div>
      ) : viewTab === 'Agency Owner Dashboard' ? (
        <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
          {agencyOwnerDashboard.map((group) => (
            <div key={group.owner} className="panel" style={{ background: '#111', border: '1px solid #2a2a2a' }}>
              <div className="panelRow" style={{ marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>{group.owner}</h3>
                <span className="pill" style={{ background: '#1f2937', color: '#fff' }}>Active: {group.active}</span>
                <span className="pill" style={{ background: '#166534', color: '#fff' }}>Completed: {group.completed}</span>
                <span className="pill" style={{ background: '#7f1d1d', color: '#fff' }}>72h+ stalled: {group.stalled}</span>
              </div>
              <table style={{ background: '#0f0f0f', color: '#f5f5f5' }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Referred By</th>
                    <th>Stage</th>
                    <th>Licensing</th>
                    <th>Progress</th>
                    <th>No Movement</th>
                  </tr>
                </thead>
                <tbody>
                  {group.members.map((m) => (
                    <tr key={`${group.owner}-${m.name}-${m.stage}`} style={m.done ? { backgroundColor: 'rgba(34, 197, 94, 0.20)' } : undefined}>
                      <td>{m.name}</td>
                      <td>{m.referredBy || '—'}</td>
                      <td>{m.stage}</td>
                      <td>{m.licensing}</td>
                      <td>{m.progress}</td>
                      <td>{m.noMovementDays}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : loading ? (
        <p className="muted">Loading sponsorship sheet...</p>
      ) : (
        <table style={{ background: '#0f0f0f', color: '#f5f5f5' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Referred By</th>
              <th>Approved</th>
              <th>Due (24h)</th>
              <th>Time Left</th>
              <th>System Status</th>
              <th>Called</th>
              <th>Agency Owner</th>
              <th>Stage</th>
              <th>Activation Stage</th>
              <th>Licensing</th>
              <th>Applicant Email</th>
              <th>Agency Owner Email</th>
              <th>SOP Progress</th>
              <th>Contracted</th>
              <th>Process</th>
              <th>Stage Age</th>
              <th>Notes</th>
              <th>Actions</th>
              <th>Last Update</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const key = rowKey(r);
              const wf = workflow[key] || {};
              const done = isCompleted(r, wf);

              return (
                <tr key={key} style={done ? { backgroundColor: 'rgba(34, 197, 94, 0.25)', color: '#eaffea' } : { backgroundColor: '#111111', color: '#f5f5f5' }}>
                  <td>{r.name}</td>
                  <td>{r.phone || '—'}</td>
                  <td>{r.referredBy || '—'}</td>
                  <td>{formatDate(r.approvedDate)}</td>
                  <td>{done ? 'Completed' : formatDate(r.dueDate)}</td>
                  <td>{done ? 'Policy' : (r.hoursLeft === null ? '—' : `${r.hoursLeft}h`)}</td>
                  <td>
                    {done ? (
                      <span className="pill" style={{ background: '#166534', color: '#fff' }}>Completed</span>
                    ) : (
                      <span
                        className="pill"
                        style={{
                          background:
                            r.systemStatus === 'Overdue' ? '#7f1d1d' : r.systemStatus === 'Urgent' || r.systemStatus === 'Due Soon' ? '#a16207' : '#1f2937',
                          color: '#fff'
                        }}
                      >
                        {r.systemStatus}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => toggleCalled(key, wf)}
                      disabled={done}
                      style={done ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                      title={done ? 'Policy completed — call step already done' : ''}
                    >
                      {done ? '✅ Called' : wf.called ? '✅ Called' : 'Mark Called'}
                    </button>
                  </td>
                  <td>
                    <select
                      value={wf.agencyOwner || autoAgencyOwnerFromRow(r)}
                      onChange={(e) => updateWorkflow(key, { agencyOwner: e.target.value })}
                    >
                      {AGENCY_OWNERS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={effectiveStage(r, wf)}
                      onChange={(e) => updateWorkflow(key, { stage: e.target.value })}
                      disabled={done}
                      style={done ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={wf.activationStageOverride || 'Auto'}
                      onChange={(e) => updateWorkflow(key, { activationStageOverride: e.target.value })}
                    >
                      <option value="Auto">Auto ({effectiveActivationStage(r, wf)})</option>
                      {ACTIVATION_STAGES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={effectiveLicensingStatus(r, wf)}
                      onChange={(e) => updateWorkflow(key, { licensingStatus: e.target.value })}
                      disabled={contractedStatus(r, wf) === 'Yes'}
                      style={contractedStatus(r, wf) === 'Yes' ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                    >
                      {['Unknown', 'Unlicensed', 'Pre-licensing', 'Licensed'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={wf.applicantEmail || ''}
                      onChange={(e) => updateWorkflow(key, { applicantEmail: e.target.value.trim() })}
                      placeholder="applicant@email.com"
                      style={{ minWidth: 180 }}
                    />
                  </td>
                  <td>
                    <input
                      value={wf.agencyOwnerEmail || defaultAgencyOwnerEmail(r, wf)}
                      onChange={(e) => updateWorkflow(key, { agencyOwnerEmail: e.target.value.trim() })}
                      placeholder="owner@email.com"
                      style={{ minWidth: 180 }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'grid', gap: 4, minWidth: 220 }}>
                      {(() => {
                        const licensing = effectiveLicensingStatus(r, wf);
                        const items = onboardingTemplate(licensing);
                        const progress = checklistProgress(wf, licensing);
                        return (
                          <>
                            <span className="pill" style={{ background: '#1f2937', color: '#fff', width: 'fit-content' }}>
                              {progress.done}/{progress.total} ({progress.pct}%)
                            </span>
                            {items.map((item) => (
                              <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(wf?.checklist?.[item.id])}
                                  onChange={(e) => toggleChecklistItem(key, wf, item.id, e.target.checked)}
                                />
                                {item.url ? (
                                  <a href={item.url} target="_blank" rel="noreferrer">{item.label}</a>
                                ) : (
                                  <span>{item.label}</span>
                                )}
                              </label>
                            ))}
                          </>
                        );
                      })()}
                    </div>
                  </td>
                  <td>
                    <select
                      value={wf.contractedOverride || 'Auto'}
                      onChange={(e) => updateWorkflow(key, { contractedOverride: e.target.value })}
                    >
                      <option value="Auto">Auto ({r.autoContracted ? 'Yes' : 'No'})</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </td>
                  <td>
                    <span className="pill" style={{ background: '#1f2937', color: '#fff' }}>
                      {processLabel(r, wf)}
                    </span>
                  </td>
                  <td>
                    {(() => {
                      const anchor = wf.updatedAt || (r.approvedDate ? r.approvedDate.toISOString() : '');
                      return `${daysSince(anchor)}d`;
                    })()}
                  </td>
                  <td>
                    <input
                      value={wf.notes || ''}
                      onChange={(e) => updateWorkflow(key, { notes: e.target.value })}
                      placeholder="Called? appt set? context..."
                      style={{ minWidth: 220 }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'grid', gap: 6, minWidth: 180 }}>
                      <button type="button" onClick={() => sendOnboardingEmail(r, wf, key)} disabled={sendingActionFor === key}>
                        {sendingActionFor === key ? 'Sending...' : 'Send Onboarding'}
                      </button>
                      <button type="button" className="ghost" onClick={() => copyOnboardingAccess(r, wf, key)}>
                        Copy Onboarding Link
                      </button>
                      <button type="button" className="ghost" onClick={() => sendContractedEmail(r, wf, key)} disabled={sendingActionFor === key || contractedStatus(r, wf) !== 'Yes'}>
                        Send Contracted Email
                      </button>
                      <button type="button" className="ghost" onClick={() => sendNoMovementAlert(r, wf, key)} disabled={sendingActionFor === key}>
                        72h No-Movement Alert
                      </button>
                    </div>
                  </td>
                  <td>
                    <div>{formatDateTime(wf.updatedAt)}</div>
                    <div className="muted">{wf.updatedBy || '—'}</div>
                    {wf.onboardingSentAt ? <div className="muted">Onboarding sent: {formatDateTime(wf.onboardingSentAt)}</div> : null}
                    {wf.onboardingCode ? <div className="muted">Portal code: {wf.onboardingCode}</div> : null}
                    {wf.contractedEmailSentAt ? <div className="muted">Contracted email sent: {formatDateTime(wf.contractedEmailSentAt)}</div> : null}
                    {wf.lastEscalatedAt ? <div className="muted">Last 72h alert: {formatDateTime(wf.lastEscalatedAt)}</div> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  if (standalone) {
    return <main style={{ padding: 16 }}>{core}</main>;
  }

  return <AppShell title="Sponsorship Tracker">{core}</AppShell>;
}
