'use client';

import { useEffect, useMemo, useState } from 'react';
import licensedAgents from '../../data/licensedAgents.json';
import innerCircleUsers from '../../data/innerCircleUsers.json';

function clean(v = '') { return String(v || '').trim(); }
function normalize(v = '') { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function normalizePhone(v = '') { return clean(v).replace(/\D+/g, ''); }

function canonicalAgentName(v = '') {
  const n = normalize(v);
  const alias = {
    'latricia wright': 'leticia wright',
    'letitia wright': 'leticia wright',
    'kellen brown': 'kelin brown',
    'madeline adams': 'madalyn adams',
    'brianna james': 'breanna james',
    'danielle': 'donyell richardson',
    'danielle richardson': 'donyell richardson',
    'donyell': 'donyell richardson'
  };
  return alias[n] || n;
}

function sameAgentName(a = '', b = '') {
  const na = canonicalAgentName(a);
  const nb = canonicalAgentName(b);
  return Boolean(na && nb && na === nb);
}

function isInnerCircleName(name = '') {
  const n = normalize(name);
  if (!n) return false;
  return (Array.isArray(innerCircleUsers) ? innerCircleUsers : []).some((u) => normalize(u?.name || u?.fullName || '') === n);
}

function toDisplayName(raw = '') {
  const value = clean(raw);
  if (!value) return '';
  if (value.includes(',')) {
    const [last, first] = value.split(',').map((x) => clean(x));
    return clean(`${first} ${last}`)
      .toLowerCase()
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }
  return value.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

function referralCodeFromName(name = '') {
  const n = normalize(name).replace(/[^a-z0-9 ]/g, '').trim();
  if (!n) return '';
  const canonical = {
    'latricia wright': 'leticia_wright',
    'letitia wright': 'leticia_wright'
  };
  if (canonical[n]) return canonical[n];
  return n.replace(/\s+/g, '_');
}

function sponsorshipLinkForProfile(profile = {}) {
  const ref = referralCodeFromName(profile?.name || '');
  return ref ? `/sponsorship-signup?ref=${encodeURIComponent(ref)}` : '/sponsorship-signup';
}

function linkLeadsUrlForProfile(profile = {}) {
  const params = new URLSearchParams();
  const name = clean(profile?.name);
  const email = clean(profile?.email).toLowerCase();
  const npn = clean(profile?.agentId || '').replace(/\D/g, '');
  const states = Array.isArray(profile?.states) ? profile.states.filter(Boolean) : [];

  if (name) params.set('name', name);
  if (email) params.set('email', email);
  if (npn) params.set('npn', npn);
  if (states.length) params.set('states', states.join(','));
  params.set('role', 'agent');

  return `/linkleads/order-builder${params.toString() ? `?${params.toString()}` : ''}`;
}

const COMP_LADDER = [
  { level: 1, title: 'Link Startup / Sponsorship', comp: 50, ap: 0 },
  { level: 2, title: 'Foundation Writer', comp: 55, ap: 2000 },
  { level: 3, title: 'Momentum Builder', comp: 60, ap: 3500 },
  { level: 4, title: 'Chainbreaker Producer', comp: 65, ap: 5000 },
  { level: 5, title: 'Legacy Closer', comp: 70, ap: 6500 },
  { level: 6, title: 'Wealth Driver', comp: 75, ap: 8000 },
  { level: 7, title: 'Dynasty Producer', comp: 80, ap: 10000 },
  { level: 8, title: 'Legacy Architect', comp: 85, ap: 12500 },
  { level: 9, title: 'Powerhouse Producer / Agency Owner', comp: 90, ap: 15000 },
  { level: 10, title: 'Blueprint Leader', comp: 95, ap: 18000 },
  { level: 11, title: 'Empire Producer', comp: 100, ap: 22000 },
  { level: 12, title: 'Pinnacle Builder', comp: 105, ap: 27000 },
  { level: 13, title: 'Legacy Icon', comp: 110, ap: 33000 },
  { level: 14, title: 'Legacy Titan', comp: 115, ap: 40000 }
];


const SPECIAL_TIER_BY_NAME = {
  'angelique lassiter': 90,
  'jamal holmes': 90,
};

const INNER_CIRCLE_DEFAULT_70 = new Set([
  'kimora link',
  'mahogany burns',
  'leticia wright',
  'letitia wright',
  'kelin brown',
  'kellen brown',
  'madalyn adams',
  'madeline adams',
  'breanna james',
  'brianna james',
  'shannon maxwell',
  'andrea cannon'
]);

const PRODUCT_OPTIONS = [
  { key: 'fg_pathsetter', label: 'IUL Pathsetter (F&G)', carrier: 'F&G', productName: 'IUL Pathsetter' },
  { key: 'nlg_flex_life', label: 'Flex Life (NLG)', carrier: 'National Life Group', productName: 'Flex Life' }
];
const DEFAULT_PRODUCT = PRODUCT_OPTIONS[0];

function productByKey(key = '') {
  return PRODUCT_OPTIONS.find((p) => p.key === key) || DEFAULT_PRODUCT;
}

function tierByComp(comp = 0) {
  return COMP_LADDER.find((t) => Number(t?.comp || 0) === Number(comp || 0)) || null;
}

function resolveStartingTier(name = '') {
  const n = normalize(name);
  if (!n) return { status: 'pending', comp: null, reason: 'Unknown tier (pending setup)' };
  if (SPECIAL_TIER_BY_NAME[n]) return { status: 'set', comp: SPECIAL_TIER_BY_NAME[n], reason: 'Agency Owner tier' };
  if (INNER_CIRCLE_DEFAULT_70.has(n)) return { status: 'set', comp: 70, reason: 'Inner Circle default tier' };
  return { status: 'set', comp: 50, reason: 'Sponsorship default tier' };
}

function monthKey(ts = '') {
  const d = new Date(ts || 0);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthKeyPrev(key = '') {
  const m = String(key || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';
  let y = Number(m[1]);
  let mo = Number(m[2]);
  mo -= 1;
  if (mo < 1) { mo = 12; y -= 1; }
  return `${y}-${String(mo).padStart(2, '0')}`;
}

function monthKeyNext(key = '') {
  const m = String(key || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';
  let y = Number(m[1]);
  let mo = Number(m[2]);
  mo += 1;
  if (mo > 12) { mo = 1; y += 1; }
  return `${y}-${String(mo).padStart(2, '0')}`;
}

function dateOnly(ts = '') {
  const d = new Date(ts || 0);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function hasAnyConsecutiveMonths(byMonth = new Map(), targetAp = 0, needed = 3) {
  const keys = [...byMonth.keys()].sort();
  let streak = 0;
  let prev = '';
  for (const key of keys) {
    const ap = Number(byMonth.get(key) || 0);
    if (ap >= Number(targetAp || 0)) {
      if (!prev || monthKeyNext(prev) === key) streak += 1;
      else streak = 1;
      if (streak >= needed) return true;
    } else {
      streak = 0;
    }
    prev = key;
  }
  return false;
}

function currentStreakForTarget(byMonth = new Map(), targetAp = 0) {
  let key = monthKey(new Date().toISOString());
  let streak = 0;
  for (let i = 0; i < 24; i += 1) {
    const ap = Number(byMonth.get(key) || 0);
    if (ap >= Number(targetAp || 0)) streak += 1;
    else break;
    key = monthKeyPrev(key);
  }
  return streak;
}

function tsFrom(...vals) {
  for (const v of vals) {
    const t = new Date(v || 0).getTime();
    if (Number.isFinite(t) && t > 0) return t;
  }
  return 0;
}

function sum(values = []) { return values.reduce((a, b) => a + Number(b || 0), 0); }

function monthLabelFromKey(key = '') {
  const m = String(key || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return key || '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short' });
}

function isInRange(iso = '', range = 'month') {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  if (range === 'month') {
    return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
  }
  if (range === 'last30') {
    return d.getTime() >= (Date.now() - (30 * 24 * 60 * 60 * 1000));
  }
  if (range === 'ytd') {
    return d.getUTCFullYear() === now.getUTCFullYear();
  }
  return true;
}

function fmtMoney(n = 0) {
  return `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function LicensedBackofficePage() {
  const [email, setEmail] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [session, setSession] = useState(null);
  const [authToken, setAuthToken] = useState('');
  const [tab, setTab] = useState('overview');
  const [policyRows, setPolicyRows] = useState([]);
  const [sponsorRows, setSponsorRows] = useState([]);
  const [onboardingDecisionRows, setOnboardingDecisionRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  const [contractStatus, setContractStatus] = useState({ loading: false, checkedEmail: '', signed: false, signedAt: '' });
  const [contractEmailBusy, setContractEmailBusy] = useState(false);
  const [contractEmailMsg, setContractEmailMsg] = useState('');
  const [contractLinkInfo, setContractLinkInfo] = useState({ loading: false, sentAt: '', requestedByName: '' });
  const [uplineData, setUplineData] = useState({ loading: false, error: '', upline: null, rows: [], unreadForViewer: 0, responseSlaHours: 24, recommendedSyncHours: 12 });
  const [uplineDraft, setUplineDraft] = useState('');
  const [uplineSendBusy, setUplineSendBusy] = useState(false);
  const [uplineSendMsg, setUplineSendMsg] = useState('');
  const [uplineInbox, setUplineInbox] = useState({ loading: false, error: '', threads: [], unreadTotal: 0 });
  const [uplineSelectedThread, setUplineSelectedThread] = useState('');
  const [uplineReplyDraft, setUplineReplyDraft] = useState('');
  const [uplineReplyBusy, setUplineReplyBusy] = useState(false);
  const [uplineReplyMsg, setUplineReplyMsg] = useState('');
  const [contractLastCheckedAt, setContractLastCheckedAt] = useState('');
  const [financeRange, setFinanceRange] = useState('month');
  const [financeDrawer, setFinanceDrawer] = useState({ open: false, title: '', items: [] });
  const [copiedSponsor, setCopiedSponsor] = useState(false);
  const [appForm, setAppForm] = useState({
    appType: '',
    applicantName: '',
    applicantEmail: '',
    applicantPhone: '',
    applicantLicensedStatus: 'Licensed',
    referredByName: '',
    policyWriterName: '',
    state: session?.homeState || '',
    policyNumber: '',
    monthlyPremium: '',
    annualPremium: '',
    productKey: DEFAULT_PRODUCT.key,
    carrier: DEFAULT_PRODUCT.carrier,
    productName: DEFAULT_PRODUCT.productName,
    deliveryRequirementNeeded: false,
    deliveryRequirementNote: ''
  });
  const isAdmin = normalize(session?.role || '') === 'admin';
  const requiresContract = useMemo(() => {
    const t = normalize(appForm?.appType || '');
    return t.includes('sponsorship') || t.includes('bonus') || t.includes('inner circle');
  }, [appForm?.appType]);
  const canSubmitPolicy = useMemo(() => {
    const applicantName = clean(appForm.applicantName);
    const appType = clean(appForm.appType);
    const referredByName = clean(appForm.referredByName || session?.name || '');
    const policyWriterName = clean(appForm.policyWriterName || session?.name || '');
    const contractOk = !requiresContract || contractStatus.signed;
    return Boolean(applicantName && appType && referredByName && policyWriterName && contractOk);
  }, [appForm, session?.name, requiresContract, contractStatus.signed]);
  const personalSponsorshipLink = useMemo(() => sponsorshipLinkForProfile(session || {}), [session]);
  const personalLinkLeadsUrl = useMemo(() => linkLeadsUrlForProfile({
    name: session?.name,
    email: session?.email,
    agentId: session?.agentId,
    states: session?.states || (session?.homeState ? [session.homeState] : [])
  }), [session]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('licensed_backoffice_token') : '';
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/licensed-backoffice/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data?.ok && data?.profile) {
          setSession(data.profile);
          setAuthToken(token);
        }
      } catch {
        // ignore stale session
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function requestCode() {
    setError('');
    const e = clean(email).toLowerCase();
    const n = clean(loginName);
    const p = normalizePhone(loginPhone);
    if (!e) {
      setError('Email is required.');
      return;
    }

    try {
      const res = await fetch('/api/licensed-backoffice/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, fullName: n, phone: p })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        if (res.status === 202 || String(data?.error || '').startsWith('pending_verification')) {
          setError('Pending verification: we received your request and admin approval is required before access.');
          return;
        }
        setError(data?.error ? `Login blocked: ${data.error}` : 'Unable to send code right now.');
        return;
      }
      setCodeRequested(true);
    } catch {
      setError('Unable to send code right now.');
    }
  }

  async function verifyCode() {
    setError('');
    const e = clean(email).toLowerCase();
    const c = clean(code);
    if (!e || !c) {
      setError('Enter both login and code/password.');
      return;
    }

    try {
      const res = await fetch('/api/licensed-backoffice/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, code: c })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.token || !data?.profile) {
        setError(data?.error ? `Verification failed: ${data.error}` : 'Invalid code.');
        return;
      }
      if (typeof window !== 'undefined') window.localStorage.setItem('licensed_backoffice_token', data.token);
      setAuthToken(data.token);
      setSession(data.profile);
    } catch {
      setError('Verification failed.');
    }
  }

  async function logout() {
    try {
      if (authToken) {
        await fetch('/api/licensed-backoffice/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ token: authToken })
        });
      }
    } catch {}
    if (typeof window !== 'undefined') window.localStorage.removeItem('licensed_backoffice_token');
    setAuthToken('');
    setSession(null);
    setCode('');
    setCodeRequested(false);
  }

  useEffect(() => {
    if (!session) return;
    setAppForm((prev) => ({
      ...prev,
      state: prev.state || clean(session?.homeState || ''),
      referredByName: prev.referredByName || clean(session?.name || ''),
      policyWriterName: prev.policyWriterName || clean(session?.name || ''),
      applicantLicensedStatus: prev.applicantLicensedStatus || 'Licensed'
    }));
  }, [session]);

  useEffect(() => {
    if (isAdmin) return;
    if (String(appForm.appType || '').toLowerCase().includes('inner circle')) {
      setAppForm((prev) => ({ ...prev, appType: '' }));
    }
  }, [isAdmin, appForm.appType]);

  useEffect(() => {
    if (!session?.email) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const onboardingUrl = `/api/onboarding-decisions?name=${encodeURIComponent(session?.name || '')}&email=${encodeURIComponent(session?.email || '')}`;
        const [pRes, sRes, oRes] = await Promise.all([
          fetch('/api/policy-submissions', { cache: 'no-store' }),
          fetch('/api/sponsorship-applications', { cache: 'no-store' }),
          fetch(onboardingUrl, { cache: 'no-store' })
        ]);
        const pData = await pRes.json().catch(() => ({}));
        const sData = await sRes.json().catch(() => ({}));
        const oData = await oRes.json().catch(() => ({}));
        if (!cancelled) {
          setPolicyRows(Array.isArray(pData?.rows) ? pData.rows : []);
          setSponsorRows(Array.isArray(sData?.rows) ? sData.rows : []);
          setOnboardingDecisionRows(Array.isArray(oData?.rows) ? oData.rows : []);
        }
      } catch {
        if (!cancelled) setError('Could not load dashboard data yet.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [session?.email]);

  useEffect(() => {
    if (!session?.email) return;
    let cancelled = false;

    async function loadUplineSupport() {
      setUplineData((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const qs = new URLSearchParams({
          name: clean(session?.name || ''),
          email: clean(session?.email || '').toLowerCase()
        });
        const res = await fetch(`/api/upline-support?${qs.toString()}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data?.ok) {
          setUplineData({ loading: false, error: 'Could not load upline support.', upline: null, rows: [], unreadForViewer: 0, responseSlaHours: 24, recommendedSyncHours: 12 });
          return;
        }
        setUplineData({
          loading: false,
          error: '',
          upline: data?.upline || null,
          rows: Array.isArray(data?.rows) ? data.rows : [],
          unreadForViewer: Number(data?.unreadForViewer || 0),
          responseSlaHours: Number(data?.responseSlaHours || 24),
          recommendedSyncHours: Number(data?.recommendedSyncHours || 12)
        });
      } catch {
        if (!cancelled) {
          setUplineData({ loading: false, error: 'Could not load upline support.', upline: null, rows: [], unreadForViewer: 0, responseSlaHours: 24, recommendedSyncHours: 12 });
        }
      }
    }

    loadUplineSupport();
    return () => { cancelled = true; };
  }, [session?.email, session?.name]);

  useEffect(() => {
    if (!session?.email) return;
    let cancelled = false;

    async function loadUplineInbox() {
      setUplineInbox((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const qs = new URLSearchParams({
          mode: 'inbox',
          name: clean(session?.name || ''),
          email: clean(session?.email || '').toLowerCase(),
          profileType: 'licensed'
        });
        const res = await fetch(`/api/upline-support?${qs.toString()}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data?.ok) {
          setUplineInbox({ loading: false, error: 'Could not load upline inbox.', threads: [], unreadTotal: 0 });
          return;
        }
        const threads = Array.isArray(data?.threads) ? data.threads : [];
        setUplineInbox({ loading: false, error: '', threads, unreadTotal: Number(data?.unreadTotal || 0) });
        if (!uplineSelectedThread && threads.length) {
          setUplineSelectedThread(clean(threads[0]?.threadKey || ''));
        }
      } catch {
        if (!cancelled) setUplineInbox({ loading: false, error: 'Could not load upline inbox.', threads: [], unreadTotal: 0 });
      }
    }

    loadUplineInbox();
    return () => { cancelled = true; };
  }, [session?.email, session?.name]);

  async function loadContractLinkInfo(emailValue = '') {
    const em = clean(emailValue).toLowerCase();
    if (!em) {
      setContractLinkInfo({ loading: false, sentAt: '', requestedByName: '' });
      return;
    }

    setContractLinkInfo((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/contract-signatures/send-link?email=${encodeURIComponent(em)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.row) {
        setContractLinkInfo({ loading: false, sentAt: '', requestedByName: '' });
        return;
      }
      setContractLinkInfo({ loading: false, sentAt: data.row.sentAt || '', requestedByName: data.row.requestedByName || '' });
    } catch {
      setContractLinkInfo({ loading: false, sentAt: '', requestedByName: '' });
    }
  }

  async function refreshContractStatus(emailValue = '', nameValue = '') {
    const em = clean(emailValue).toLowerCase();
    const nm = clean(nameValue);

    if (!requiresContract || (!em && !nm)) {
      setContractStatus({ loading: false, checkedEmail: em, signed: false, signedAt: '' });
      setContractLastCheckedAt('');
      return;
    }

    setContractStatus((prev) => ({ ...prev, loading: true, checkedEmail: em }));
    try {
      const qs = new URLSearchParams();
      if (em) qs.set('email', em);
      if (nm) qs.set('name', nm);
      const res = await fetch(`/api/contract-signatures?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const signedAt = clean(data?.row?.signedAt || data?.row?.signed_at || data?.row?.completedAt || data?.row?.completed_at || '');
      const signed = Boolean(signedAt);
      setContractStatus({ loading: false, checkedEmail: em, signed, signedAt });
      setContractLastCheckedAt(new Date().toISOString());
      await loadContractLinkInfo(em);
    } catch {
      setContractStatus({ loading: false, checkedEmail: em, signed: false, signedAt: '' });
      setContractLastCheckedAt(new Date().toISOString());
    }
  }

  async function sendAgreementLinkEmail() {
    const applicantEmail = clean(appForm.applicantEmail).toLowerCase();
    const applicantName = clean(appForm.applicantName);
    if (!requiresContract || !applicantEmail || !applicantName) {
      setContractEmailMsg('Enter applicant name + email first.');
      return;
    }

    setContractEmailBusy(true);
    setContractEmailMsg('');
    try {
      const res = await fetch('/api/contract-signatures/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName,
          applicantEmail,
          applicantPhone: clean(appForm.applicantPhone),
          applicantState: clean(appForm.state),
          requestedByName: clean(session?.name || ''),
          requestedByEmail: clean(session?.email || '')
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setContractEmailMsg(`Could not send agreement link: ${clean(data?.error || `HTTP ${res.status}`)}`);
        return;
      }
      setContractEmailMsg('Agreement link sent.');
      await loadContractLinkInfo(applicantEmail);
      await refreshContractStatus(applicantEmail, applicantName);
    } catch {
      setContractEmailMsg('Could not send agreement link right now.');
    } finally {
      setContractEmailBusy(false);
    }
  }

  useEffect(() => {
    const emailValue = clean(appForm.applicantEmail).toLowerCase();
    const nameValue = clean(appForm.applicantName);

    if (!requiresContract) {
      setContractStatus({ loading: false, checkedEmail: '', signed: false, signedAt: '' });
      setContractEmailMsg('');
      setContractLinkInfo({ loading: false, sentAt: '', requestedByName: '' });
      setContractLastCheckedAt('');
      return;
    }

    if (!emailValue && !nameValue) {
      setContractStatus({ loading: false, checkedEmail: '', signed: false, signedAt: '' });
      return;
    }

    const timer = setTimeout(() => {
      refreshContractStatus(emailValue, nameValue);
    }, 350);

    return () => clearTimeout(timer);
  }, [appForm.applicantEmail, appForm.applicantName, appForm.appType]);

  async function submitPolicyFromBackoffice() {
    if (!session?.name || !session?.email) return;

    const applicantName = clean(appForm.applicantName);
    const appType = clean(appForm.appType);
    const state = clean(appForm.state).toUpperCase();
    const referredByName = clean(appForm.referredByName || session?.name || '');
    const policyWriterName = clean(appForm.policyWriterName || session?.name || '');

    if (!applicantName) {
      setSubmitMsg('Applicant name is required.');
      return;
    }
    if (!appType) {
      setSubmitMsg('Application type is required.');
      return;
    }
    if (!referredByName) {
      setSubmitMsg('Referred by is required.');
      return;
    }
    if (!policyWriterName) {
      setSubmitMsg('Policy written by is required.');
      return;
    }
    if (requiresContract && !contractStatus.signed) {
      setSubmitMsg('Contracting must be completed before submitting this policy.');
      return;
    }

    setSubmitBusy(true);
    setSubmitMsg('');
    try {
      const payload = {
        record: {
          appType,
          policyType: appType,
          applicantName,
          applicantEmail: clean(appForm.applicantEmail).toLowerCase(),
          applicantPhone: clean(appForm.applicantPhone),
          applicantLicensedStatus: clean(appForm.applicantLicensedStatus || 'Licensed'),
          referredByName,
          policyWriterName,
          submittedBy: clean(session?.email || ''),
          submittedByRole: isAdmin
            ? 'admin_licensed_backoffice'
            : (isInnerCircleName(session?.name || '') ? 'inner_circle_licensed_backoffice' : 'licensed_backoffice_agent'),
          state,
          policyNumber: clean(appForm.policyNumber || ''),
          monthlyPremium: Number(appForm.monthlyPremium || 0) || 0,
          annualPremium: Number(appForm.annualPremium || 0) || 0,
          carrier: clean(appForm.carrier || DEFAULT_PRODUCT.carrier),
          productName: clean(appForm.productName || DEFAULT_PRODUCT.productName),
          status: 'Submitted',
          deliveryRequirementNeeded: Boolean(appForm.deliveryRequirementNeeded),
          deliveryRequirementStatus: Boolean(appForm.deliveryRequirementNeeded) ? 'required' : 'none',
          deliveryRequirementNote: clean(appForm.deliveryRequirementNote || ''),
          contractRequired: requiresContract,
          contractSignedAt: requiresContract ? clean(contractStatus.signedAt || '') : '',
          contractSignatureVerified: requiresContract ? Boolean(contractStatus.signed) : true
        },
        skipSopProvision: true
      };

      const res = await fetch('/api/policy-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setSubmitMsg(`Submit failed: ${data?.error || `HTTP ${res.status}`}`);
        return;
      }

      setPolicyRows((prev) => {
        const next = [data.row, ...(Array.isArray(prev) ? prev : [])];
        return next;
      });
      setAppForm((prev) => ({
        ...prev,
        appType: '',
        applicantName: '',
        applicantEmail: '',
        applicantPhone: '',
        policyNumber: '',
        monthlyPremium: '',
        annualPremium: '',
        productKey: DEFAULT_PRODUCT.key,
        carrier: DEFAULT_PRODUCT.carrier,
        productName: DEFAULT_PRODUCT.productName,
        deliveryRequirementNeeded: false,
        deliveryRequirementNote: ''
      }));
      setTab('policies');
      setSubmitMsg('Policy app submitted successfully.');
      setContractStatus({ loading: false, checkedEmail: '', signed: false, signedAt: '' });
      setContractEmailMsg('');
      setContractLinkInfo({ loading: false, sentAt: '', requestedByName: '' });
      setContractLastCheckedAt('');
    } catch {
      setSubmitMsg('Submit failed. Please try again.');
    } finally {
      setSubmitBusy(false);
    }
  }

  const metrics = useMemo(() => {
    if (!session) return null;
    const nameNorm = canonicalAgentName(session.name);

    const myPolicies = policyRows.filter((r) => sameAgentName(r?.policyWriterName || '', nameNorm) || sameAgentName(r?.referredByName || '', nameNorm));

    const approvedPolicies = myPolicies.filter((r) => normalize(r?.status || '').includes('approved'));

    const byMonth = new Map();
    for (const r of approvedPolicies) {
      const key = monthKey(r?.submittedAt || r?.updatedAt || r?.approvedAt || r?.createdAt || '');
      if (!key) continue;
      byMonth.set(key, (byMonth.get(key) || 0) + (Number(r?.monthlyPremium || 0) * 12));
    }

    const currentMonthKey = monthKey(new Date().toISOString());
    const currentMonthAp = Number(byMonth.get(currentMonthKey) || 0);
    const lifetimePlacedAp = sum(approvedPolicies.map((r) => Number(r?.monthlyPremium || 0) * 12));

    const startTier = resolveStartingTier(session?.name || '');
    const baselineTier = tierByComp(startTier?.comp || 0) || COMP_LADDER[0];

    let currentTier = baselineTier;
    while (true) {
      const candidate = COMP_LADDER.find((t) => Number(t.level) === Number(currentTier.level) + 1);
      if (!candidate) break;
      if (hasAnyConsecutiveMonths(byMonth, candidate.ap, 3)) {
        currentTier = candidate;
        continue;
      }
      break;
    }

    const nextTier = COMP_LADDER.find((t) => Number(t.level) === Number(currentTier.level) + 1) || null;
    const apToNext = nextTier ? Math.max(0, Number(nextTier.ap || 0) - currentMonthAp) : 0;
    const progress = nextTier
      ? Math.max(0, Math.min(100, ((currentMonthAp - Number(currentTier.ap || 0)) / Math.max(1, (Number(nextTier.ap || 0) - Number(currentTier.ap || 0)))) * 100))
      : 100;
    const streakForNext = nextTier ? currentStreakForTarget(byMonth, nextTier.ap) : 3;

    const mySponsors = sponsorRows.filter((r) => normalize(r?.referralName || '') === nameNorm);
    const approvedSponsors = mySponsors.filter((r) => normalize(r?.status || '').includes('approved'));
    const bookedSponsors = mySponsors.filter((r) => normalize(r?.status || '').includes('booked'));

    const nowMs = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const rollingStart = nowMs - thirtyDaysMs;

    const sponsorAppsRolling30 = mySponsors.filter((r) => {
      const t = tsFrom(r?.submitted_at, r?.updatedAt, r?.createdAt);
      return t >= rollingStart && t <= nowMs;
    });

    const policySubmittedRolling30 = myPolicies.filter((r) => {
      const t = tsFrom(r?.submittedAt, r?.updatedAt, r?.approvedAt, r?.createdAt);
      return t >= rollingStart && t <= nowMs;
    });

    const sponsorCount30 = sponsorAppsRolling30.length;
    const sponsorshipPolicies30 = policySubmittedRolling30.filter((r) => normalize(r?.policyType || r?.appType || '').includes('sponsorship')).length;
    const policyCount30 = policySubmittedRolling30.length;
    const flatRate = isInnerCircleName(session?.name || '') ? 500 : 400;
    const sponsorDollars30 = sponsorshipPolicies30 * flatRate;
    const policyDollars30 = sponsorDollars30;
    const incentiveEstimate30 = sponsorDollars30;

    const recentMonths = [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 3)
      .map(([month, ap]) => ({ month, ap }));

    const sponsorshipEntriesMap = new Map();
    for (const r of mySponsors) {
      const statusRaw = clean(r?.status || 'Pending');
      const statusNorm = normalize(statusRaw);
      const statusSimple = statusNorm.includes('approved')
        ? 'Approved'
        : statusNorm.includes('declin')
          ? 'Declined'
          : statusNorm.includes('booked')
            ? 'Booked'
            : statusNorm.includes('no show')
              ? 'No Show'
              : statusNorm.includes('cancel')
                ? 'Cancelled'
                : statusRaw || 'Pending';

      const fullName = clean(r?.fullName || `${clean(r?.firstName)} ${clean(r?.lastName)}`) || 'Unknown';
      const state = clean(r?.state);
      const ts = tsFrom(r?.updatedAt, r?.submitted_at, r?.createdAt);
      const key = clean(r?.id) || `${normalize(fullName)}|${normalize(state)}`;
      const prev = sponsorshipEntriesMap.get(key);
      if (!prev || ts > Number(prev.ts || 0)) {
        sponsorshipEntriesMap.set(key, {
          id: clean(r?.id) || key,
          name: fullName,
          state,
          status: statusSimple,
          submittedAt: dateOnly(r?.submitted_at || r?.updatedAt || r?.createdAt),
          isApproved: statusSimple === 'Approved',
          ts
        });
      }
    }

    const sponsorshipEntries = [...sponsorshipEntriesMap.values()]
      .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));

    const approvedPolicyEntries = [...approvedPolicies]
      .sort((a, b) => new Date(b?.approvedAt || b?.submittedAt || b?.updatedAt || 0).getTime() - new Date(a?.approvedAt || a?.submittedAt || a?.updatedAt || 0).getTime())
      .map((r, i) => ({
        id: clean(r?.id) || `p_${i}`,
        name: clean(r?.applicantName),
        ap: Number(r?.monthlyPremium || 0) * 12,
        monthlyPremium: Number(r?.monthlyPremium || 0),
        state: clean(r?.state),
        status: clean(r?.status || 'Approved'),
        submittedAt: clean(r?.submittedAt || r?.updatedAt || r?.approvedAt)
      }));

    const badges = [
      { key: 's1', label: 'First Sponsor', earned: mySponsors.length >= 1 },
      { key: 's3', label: '3 Sponsors', earned: mySponsors.length >= 3 },
      { key: 'sa1', label: 'First Approved Sponsor', earned: approvedSponsors.length >= 1 },
      { key: 'sa5', label: '5 Approved Sponsors', earned: approvedSponsors.length >= 5 },
      { key: 'p1', label: 'First Approved Policy', earned: approvedPolicies.length >= 1 },
      { key: 'ap5', label: '$5K AP Builder', earned: currentMonthAp >= 5000 },
      { key: 'ap10', label: '$10K AP Momentum', earned: currentMonthAp >= 10000 },
      { key: 'tier', label: `Tier L${currentTier.level} Unlocked`, earned: currentTier.level >= 2 }
    ];

    return {
      myPolicies,
      approvedPolicies,
      monthlyAp: currentMonthAp,
      currentTier,
      nextTier,
      progress,
      mySponsors,
      approvedSponsors,
      bookedSponsors,
      recentMonths,
      sponsorshipEntries,
      approvedPolicyEntries,
      badges,
      startTier,
      sponsorCount30,
      sponsorshipPolicies30,
      policyCount30,
      sponsorDollars30,
      policyDollars30,
      incentiveEstimate30,
      lifetimePlacedAp,
      apToNext,
      streakForNext
    };
  }, [session, policyRows, sponsorRows]);

  const skippedAppDecisions = useMemo(() => {
    if (!session) return [];
    const nameNorm = canonicalAgentName(session?.name || '');
    const emailNorm = normalize(session?.email || '');
    const rows = Array.isArray(onboardingDecisionRows) ? onboardingDecisionRows : [];
    return rows.filter((r) => {
      const decision = normalize(r?.decision || '');
      if (!decision.includes('skip')) return false;
      const ref = canonicalAgentName(r?.referredByName || '');
      const writer = canonicalAgentName(r?.policyWriterName || '');
      const em = normalize(r?.applicantEmail || '');
      if (emailNorm && em === emailNorm) return true;
      return Boolean(nameNorm && (ref === nameNorm || writer === nameNorm));
    });
  }, [session, onboardingDecisionRows]);

  const financials = useMemo(() => {
    if (!session) return null;
    const nameNorm = canonicalAgentName(session?.name || '');
    const isInner = isInnerCircleName(session?.name || '');

    const mine = (Array.isArray(policyRows) ? policyRows : []).filter((r) => (
      sameAgentName(r?.policyWriterName || '', nameNorm) || sameAgentName(r?.referredByName || '', nameNorm)
    ));

    const events = mine
      .map((r, i) => {
        const statusNorm = normalize(r?.status || '');
        const payoutStatusNorm = normalize(r?.payoutStatus || '');
        const isApproved = statusNorm.includes('approved');
        const isPaid = payoutStatusNorm === 'paid' || Boolean(clean(r?.payoutPaidAt));
        if (!isApproved && !isPaid) return null;

        const typeNorm = normalize(r?.policyType || r?.appType || '');
        const sourceType = typeNorm.includes('sponsorship')
          ? 'sponsorship_bonus'
          : (typeNorm.includes('inner circle') ? 'override' : 'direct_sales');

        const fallbackRate = sourceType === 'sponsorship_bonus' ? (isInner ? 500 : 400) : 0;
        const amount = Number(r?.payoutAmount || r?.advancePayout || r?.pointsEarned || fallbackRate || 0) || 0;

        const qualifiedAt = clean(r?.approvedAt || r?.updatedAt || r?.submittedAt || '');
        const paidAt = clean(r?.payoutPaidAt || '');
        const expectedPayoutAt = clean(r?.payoutDueAt || (qualifiedAt ? new Date(new Date(qualifiedAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : ''));

        const nowMs = Date.now();
        const expectedMs = new Date(expectedPayoutAt || 0).getTime();
        const qualifiedMs = new Date(qualifiedAt || 0).getTime();
        const pendingDays = qualifiedMs > 0 ? Math.max(0, Math.floor((nowMs - qualifiedMs) / (24 * 60 * 60 * 1000))) : null;
        const daysToPayout = expectedMs > 0 ? Math.floor((expectedMs - nowMs) / (24 * 60 * 60 * 1000)) : null;
        const deliveryRequired = Boolean(r?.deliveryRequirementNeeded) || normalize(r?.deliveryRequirementStatus || '') === 'required';
        const deliveryCompleted = normalize(r?.deliveryRequirementStatus || '') === 'completed';
        const holdLike = payoutStatusNorm.includes('hold') || payoutStatusNorm.includes('review') || (deliveryRequired && !deliveryCompleted);
        const overdue = !isPaid && !holdLike && expectedMs > 0 && expectedMs < nowMs;
        const pendingStage = isPaid
          ? 'paid'
          : ((deliveryRequired && !deliveryCompleted)
            ? 'delivery_requirement'
            : (holdLike ? 'hold' : (overdue ? 'overdue' : 'pending')));

        return {
          id: clean(r?.id || `evt_${i}`),
          referenceName: clean(r?.applicantName || 'Applicant'),
          sourceType,
          amount,
          status: isPaid ? 'paid' : 'pending',
          pendingStage,
          qualifiedAt,
          paidAt,
          expectedPayoutAt,
          policyType: clean(r?.policyType || r?.appType || ''),
          payoutStatus: clean(r?.payoutStatus || ''),
          deliveryRequirementNeeded: deliveryRequired,
          deliveryRequirementStatus: clean(r?.deliveryRequirementStatus || (deliveryRequired ? 'required' : 'none')),
          deliveryRequirementNote: clean(r?.deliveryRequirementNote || ''),
          pendingDays,
          daysToPayout,
        };
      })
      .filter(Boolean);

    const allTimePaid = sum(events.filter((e) => e.status === 'paid').map((e) => e.amount));
    const allTimePending = sum(events.filter((e) => e.status === 'pending').map((e) => e.amount));

    const thisMonthPaid = sum(events.filter((e) => e.status === 'paid' && isInRange(e.paidAt || e.qualifiedAt, 'month')).map((e) => e.amount));
    const thisMonthPending = sum(events.filter((e) => e.status === 'pending' && isInRange(e.qualifiedAt, 'month')).map((e) => e.amount));

    const filteredEvents = events.filter((e) => isInRange((e.status === 'paid' ? (e.paidAt || e.qualifiedAt) : e.qualifiedAt), financeRange));

    const byMonth = new Map();
    for (const e of events) {
      const key = monthKey(e.status === 'paid' ? (e.paidAt || e.qualifiedAt) : e.qualifiedAt);
      if (!key) continue;
      byMonth.set(key, (byMonth.get(key) || 0) + Number(e.amount || 0));
    }
    const trend = [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-6)
      .map(([k, v]) => ({ key: k, label: monthLabelFromKey(k), amount: Number(v || 0) }));

    const sourceTotals = {
      direct_sales: sum(filteredEvents.filter((e) => e.sourceType === 'direct_sales').map((e) => e.amount)),
      sponsorship_bonus: sum(filteredEvents.filter((e) => e.sourceType === 'sponsorship_bonus').map((e) => e.amount)),
      override: sum(filteredEvents.filter((e) => e.sourceType === 'override').map((e) => e.amount)),
    };
    const sourceSum = sum(Object.values(sourceTotals));

    const upcoming = events
      .filter((e) => e.status !== 'paid')
      .sort((a, b) => new Date(a.expectedPayoutAt || a.qualifiedAt || 0).getTime() - new Date(b.expectedPayoutAt || b.qualifiedAt || 0).getTime())
      .slice(0, 10);

    const now = Date.now();
    const pending = events.filter((e) => e.status === 'pending');
    const aging = { d0_7: 0, d8_14: 0, d15p: 0 };
    for (const e of pending) {
      const ageDays = Math.floor((now - new Date(e.qualifiedAt || 0).getTime()) / (24 * 60 * 60 * 1000));
      if (ageDays <= 7) aging.d0_7 += 1;
      else if (ageDays <= 14) aging.d8_14 += 1;
      else aging.d15p += 1;
    }

    const pendingTotals = {
      pending: sum(pending.filter((e) => e.pendingStage === 'pending').map((e) => e.amount)),
      hold: sum(pending.filter((e) => e.pendingStage === 'hold').map((e) => e.amount)),
      delivery: sum(pending.filter((e) => e.pendingStage === 'delivery_requirement').map((e) => e.amount)),
      overdue: sum(pending.filter((e) => e.pendingStage === 'overdue').map((e) => e.amount)),
    };

    const nextPayout = pending
      .filter((e) => e.pendingStage !== 'hold' && e.pendingStage !== 'delivery_requirement')
      .sort((a, b) => new Date(a.expectedPayoutAt || a.qualifiedAt || 0).getTime() - new Date(b.expectedPayoutAt || b.qualifiedAt || 0).getTime())[0] || null;

    const projectedEom = thisMonthPaid + thisMonthPending;
    const monthTotal = thisMonthPaid + thisMonthPending;
    const paidRatio = monthTotal > 0 ? Math.round((thisMonthPaid / monthTotal) * 100) : 0;
    const latestEventAt = events
      .map((e) => new Date(e.paidAt || e.qualifiedAt || 0).getTime())
      .filter((t) => Number.isFinite(t) && t > 0)
      .sort((a, b) => b - a)[0] || 0;

    return {
      allTimePaid,
      allTimePending,
      thisMonthPaid,
      thisMonthPending,
      projectedEom,
      trend,
      sourceTotals,
      sourceSum,
      upcoming,
      aging,
      filteredEvents,
      pendingTotals,
      nextPayout,
      monthTotal,
      paidRatio,
      latestEventAt,
      events,
    };
  }, [session, policyRows, financeRange]);

  function openFinanceDrawer(title = '', items = []) {
    setFinanceDrawer({ open: true, title, items: Array.isArray(items) ? items : [] });
  }

  function closeFinanceDrawer() {
    setFinanceDrawer({ open: false, title: '', items: [] });
  }

  function financeStatusPill(stage = '') {
    const n = normalize(stage || '');
    if (n === 'paid') return { cls: 'onpace', label: 'Paid' };
    if (n === 'delivery_requirement') return { cls: 'offpace', label: 'Delivery Required' };
    if (n === 'hold') return { cls: 'offpace', label: 'Hold' };
    if (n === 'overdue') return { cls: 'offpace', label: 'Overdue' };
    return { cls: 'atrisk', label: 'Pending' };
  }

  function exportFinancialCsv() {
    if (!financials?.filteredEvents?.length) return;
    const rows = financials.filteredEvents;
    const header = ['Applicant', 'Type', 'Source', 'Amount', 'Status', 'Qualified At', 'Expected Payout', 'Paid At', 'Pending Days', 'Days To Payout'];
    const lines = [header.join(',')];
    for (const r of rows) {
      const sourceLabel = r.sourceType === 'sponsorship_bonus' ? 'Sponsorship Bonus' : (r.sourceType === 'override' ? 'Override' : 'Direct Sales');
      const vals = [
        r.referenceName || '',
        r.policyType || '',
        sourceLabel,
        Number(r.amount || 0),
        financeStatusPill(r.pendingStage || r.status).label,
        r.qualifiedAt || '',
        r.expectedPayoutAt || '',
        r.paidAt || '',
        r.pendingDays == null ? '' : r.pendingDays,
        r.daysToPayout == null ? '' : r.daysToPayout,
      ].map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`);
      lines.push(vals.join(','));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `licensed-financials-${financeRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }


  async function sendUplineMessage() {
    if (!session?.email) return;
    const message = clean(uplineDraft);
    if (!message) {
      setUplineSendMsg('Type a message first.');
      return;
    }

    setUplineSendBusy(true);
    setUplineSendMsg('');
    try {
      const res = await fetch('/api/upline-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          viewerName: clean(session?.name || ''),
          viewerEmail: clean(session?.email || '').toLowerCase(),
          message
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setUplineSendMsg('Could not send message right now.');
        return;
      }
      setUplineDraft('');
      setUplineSendMsg('Message sent. Your upline has 24 hours to respond.');
      setUplineData((prev) => ({
        ...prev,
        rows: [...(Array.isArray(prev?.rows) ? prev.rows : []), data?.row].filter(Boolean)
      }));
    } catch {
      setUplineSendMsg('Could not send message right now.');
    } finally {
      setUplineSendBusy(false);
    }
  }

  async function sendUplineReply() {
    if (!session?.email) return;
    const threadKey = clean(uplineSelectedThread);
    const message = clean(uplineReplyDraft);
    if (!threadKey) {
      setUplineReplyMsg('Select a thread first.');
      return;
    }
    if (!message) {
      setUplineReplyMsg('Type a reply first.');
      return;
    }

    setUplineReplyBusy(true);
    setUplineReplyMsg('');
    try {
      const res = await fetch('/api/upline-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upline_reply',
          threadKey,
          viewerName: clean(session?.name || ''),
          viewerEmail: clean(session?.email || '').toLowerCase(),
          profileType: 'licensed',
          message
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setUplineReplyMsg('Could not send upline reply right now.');
        return;
      }

      setUplineReplyDraft('');
      setUplineReplyMsg('Reply sent.');
      setUplineInbox((prev) => {
        const nextThreads = (Array.isArray(prev?.threads) ? prev.threads : []).map((t) => {
          if (clean(t?.threadKey) !== threadKey) return t;
          const nextRows = [...(Array.isArray(t?.rows) ? t.rows : []), data?.row].filter(Boolean);
          return { ...t, rows: nextRows, latest: data?.row || t?.latest, unread: 0 };
        });
        return { ...prev, threads: nextThreads, unreadTotal: Math.max(0, Number(prev?.unreadTotal || 0) - 1) };
      });
    } catch {
      setUplineReplyMsg('Could not send upline reply right now.');
    } finally {
      setUplineReplyBusy(false);
    }
  }

  if (!session) {
    return (
      <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #15213f 0%, #070b14 55%)', color: '#E5E7EB', display: 'grid', placeItems: 'center', padding: 24 }}>
        <section style={{ width: 'min(560px, 95vw)', border: '1px solid #2A3142', borderRadius: 16, background: 'rgba(17,24,39,0.92)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
          <div style={{ padding: '24px 26px', borderBottom: '1px solid #2A3142', background: 'linear-gradient(120deg, #1D428A, #006BB6)' }}>
            <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1 }}>THE LEGACY LINK</h1>
            <p style={{ margin: '8px 0 0', opacity: 0.95 }}>Licensed Agent Back Office</p>
          </div>
          <div style={{ padding: 24, display: 'grid', gap: 12 }}>
            <label style={{ fontSize: 14, color: '#9CA3AF' }}>Sign in (licensed-only)</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Licensed email or login"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #374151', background: '#020617', color: '#fff' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="Full name (fallback)"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #374151', background: '#020617', color: '#fff' }}
              />
              <input
                value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)}
                placeholder="Phone (fallback)"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #374151', background: '#020617', color: '#fff' }}
              />
            </div>
            {!codeRequested ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={requestCode} style={{ padding: '12px 14px', borderRadius: 10, border: 0, background: '#C8A96B', color: '#0B1020', fontWeight: 800 }}>
                  Send Login Code
                </button>
                <button onClick={() => setCodeRequested(true)} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #475569', background: '#0B1220', color: '#E2E8F0', fontWeight: 700 }}>
                  Use Password Login
                </button>
              </div>
            ) : (
              <>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter 6-digit code or password"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #374151', background: '#020617', color: '#fff' }}
                />
                <button onClick={verifyCode} style={{ padding: '12px 14px', borderRadius: 10, border: 0, background: '#C8A96B', color: '#0B1020', fontWeight: 800 }}>
                  Verify & Enter Back Office
                </button>
              </>
            )}
            {error ? <small style={{ color: '#FCA5A5' }}>{error}</small> : <small style={{ color: '#9CA3AF' }}>Licensed-only access. Use email code or hardwired login/password backup.</small>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#070b14', color: '#E5E7EB', padding: 22 }}>
      <section style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 14 }}>
        <header style={{ border: '1px solid #2A3142', borderRadius: 14, background: '#0F172A', padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 28 }}>Licensed Agent Back Office</h2>
              <p style={{ margin: '6px 0 0', color: '#9CA3AF' }}>{session.name} • {session.email} • {session.homeState || 'State Pending'}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ border: '1px solid #334155', borderRadius: 12, padding: '8px 10px', background: '#0B1220', minWidth: 160, textAlign: 'center' }}>
                <div style={{ color: '#64748B', fontWeight: 700, fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase' }}>Inner Circle</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                  <a href="https://thelegacylink.com/inner-circle" target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '6px 10px', borderRadius: 999, border: '1px solid #475569', background: '#111827', color: '#CBD5E1', textDecoration: 'none', fontWeight: 700, fontSize: 12 }}>
                    Upgrade
                  </a>
                  <a href={personalLinkLeadsUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '6px 10px', borderRadius: 999, border: '1px solid #1e3a8a', background: '#1D4ED8', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 12 }}>
                    Open Lead Marketplace
                  </a>
                </div>
              </div>
              <button onClick={() => setTab('upline')} style={{ borderRadius: 10, border: '1px solid #FCA5A5', padding: '8px 12px', background: '#B91C1C', color: '#fff', cursor: 'pointer', fontWeight: 800, boxShadow: '0 6px 18px rgba(127,29,29,.35)' }}>
                Help
              </button>
              <button onClick={logout} style={{ borderRadius: 10, border: '1px solid #334155', padding: '8px 12px', background: '#111827', color: '#E5E7EB', cursor: 'pointer', transition: 'all .18s ease', boxShadow: '0 6px 18px rgba(2,6,23,.25)' }}>Sign Out</button>
            </div>
          </div>
        </header>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            ['overview', 'Overview'],
            ['tracker', 'Onboarding Tracker'],
            ['financials', 'Financials'],
            ['sponsorships', 'Sponsorships'],
            ['policies', 'Policies'],
            ['submit', 'Submit App'],
            ['academy', 'IUL Academy'],
            ['awards', 'Achievement Center'],
            ['growth', 'Growth Hub'],
            ['resources', 'Resources'],
            ['scriptvault', 'Script Vault 2.0'],
            ['linkleads', 'VIP Links'],
            ['incentives', 'Champions Circle'],
            ['community', 'Community Service']
          ].map(([k, label]) => (
            <button key={k} onClick={() => { if (k === 'incentives') { if (typeof window !== 'undefined') window.open('/champions-circle/licensed?home=/licensed-backoffice', '_blank', 'noopener,noreferrer'); return; } if (k === 'community') { if (typeof window !== 'undefined') window.open('/community-service?home=/licensed-backoffice', '_blank', 'noopener,noreferrer'); return; } setTab(k); }} style={{ padding: '10px 14px', borderRadius: 999, border: k === 'upline' ? '1px solid #FCA5A5' : '1px solid #334155', background: tab === k ? (k === 'upline' ? '#B91C1C' : '#1D428A') : (k === 'upline' ? '#7F1D1D' : '#0B1220'), color: '#E5E7EB', cursor: 'pointer', transition: 'all .18s ease', boxShadow: '0 6px 18px rgba(2,6,23,.25)', fontWeight: k === 'upline' ? 800 : 600 }}>{label}</button>
          ))}
        </div>

        {loading ? <div style={{ border: '1px solid #2A3142', borderRadius: 12, padding: 14, background: '#0F172A' }}>Loading dashboard…</div> : null}
        {error ? <div style={{ border: '1px solid #7F1D1D', borderRadius: 12, padding: 14, background: '#1F0A0A', color: '#FECACA' }}>{error}</div> : null}

        {metrics ? (
          <>
            {tab === 'overview' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 12 }}>
                <div style={{ border: '1px solid #2A3142', borderRadius: 14, background: '#0F172A', padding: 14, minHeight: 136 }}>
                  <div style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 6, letterSpacing: '.2px' }}>Current Tier</div>
                  <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.08, marginBottom: 6 }}>L{metrics.currentTier.level} • {metrics.currentTier.comp}%</div>
                  <div style={{ color: '#C7D2FE', fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>{metrics.currentTier.title}</div>
                  <div style={{ color: '#94A3B8', marginTop: 6, fontSize: 13, letterSpacing: '.2px' }}>
                    Start Tier: {metrics.startTier?.status === 'pending' ? 'Pending' : `${metrics.startTier?.comp}%`} {metrics.startTier?.reason ? `• ${metrics.startTier.reason}` : ''}
                  </div>
                </div>
                <div style={{ border: '1px solid #2A3142', borderRadius: 14, background: '#0F172A', padding: 14, minHeight: 136 }}>
                  <div style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 6, letterSpacing: '.2px' }}>Placed AP (Current Month)</div>
                  <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.08, marginBottom: 6 }}>${Number(metrics.monthlyAp || 0).toLocaleString()}</div>
                  <div style={{ color: '#CBD5E1', fontSize: 18, lineHeight: 1.3 }}>Personal production basis • Lifetime placed AP: ${Number(metrics.lifetimePlacedAp || 0).toLocaleString()}</div>
                </div>
                <div style={{ border: '1px solid #2A3142', borderRadius: 14, background: '#0F172A', padding: 14, minHeight: 136 }}>
                  <div style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 6, letterSpacing: '.2px' }}>Sponsorships Brought In</div>
                  <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.08, marginBottom: 6 }}>{metrics.mySponsors.length}</div>
                  <div style={{ color: '#CBD5E1', fontSize: 18, lineHeight: 1.3 }}>Approved: {metrics.approvedSponsors.length} • Booked: {metrics.bookedSponsors.length}</div>
                </div>
                <div style={{ border: '1px solid #2A3142', borderRadius: 14, background: '#0F172A', padding: 14, minHeight: 136 }}>
                  <div style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 6, letterSpacing: '.2px' }}>Contracted Carriers</div>
                  <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.08, marginBottom: 6 }}>{(session.carriersActive || []).length || 0}</div>
                  <div style={{ color: '#CBD5E1', fontSize: 18, lineHeight: 1.3 }}>{(session.carriersActive || []).length ? session.carriersActive.join(' • ') : 'No active carriers mapped yet'}</div>
                </div>
                <div style={{ border: '1px solid #2A3142', borderRadius: 14, background: '#0F172A', padding: 14, minHeight: 136 }}>
                  <div style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 6, letterSpacing: '.2px' }}>Estimated Sponsorship Policy Payout (Rolling 30 Days)</div>
                  <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.08, marginBottom: 6 }}>${Number(metrics.incentiveEstimate30 || 0).toLocaleString()}</div>
                  <div style={{ color: '#CBD5E1', fontSize: 18, lineHeight: 1.3 }}>Sponsorship Policies: {metrics.sponsorshipPolicies30} • Flat Rate: ${isInnerCircleName(session?.name || '') ? '500 (Inner Circle)' : '400 (Licensed)'}</div>
                </div>
                <div style={{ border: '1px solid #2A3142', borderRadius: 14, background: '#0F172A', padding: 14, minHeight: 136 }}>
                  <div style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 6, letterSpacing: '.2px' }}>Next Tier Progress</div>
                  <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.08, marginBottom: 6 }}>{metrics.nextTier ? `L${metrics.nextTier.level} (${metrics.nextTier.comp}%)` : 'Top Tier'}</div>
                  <div style={{ marginTop: 6, height: 10, borderRadius: 999, background: '#1F2937', overflow: 'hidden' }}>
                    <div style={{ width: `${metrics.progress}%`, height: '100%', background: 'linear-gradient(90deg,#C8A96B,#F59E0B)' }} />
                  </div>
                  <div style={{ color: '#CBD5E1', marginTop: 8, fontSize: 16, lineHeight: 1.3 }}>
                    {metrics.nextTier
                      ? `${Number(metrics.apToNext || 0).toLocaleString()} AP to next level this month`
                      : 'You are at max level'}
                  </div>
                  {metrics.nextTier ? (
                    <div style={{ color: '#93C5FD', marginTop: 4, fontSize: 13, letterSpacing: '.2px' }}>
                      Promotion streak for L{metrics.nextTier.level}: {Math.min(3, Number(metrics.streakForNext || 0))}/3 consecutive qualifying months
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {tab === 'overview' ? (
              <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
                <h3 style={{ marginTop: 0 }}>Milestone Badges</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {metrics.badges.map((b) => (
                    <span
                      key={b.key}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 999,
                        border: `1px solid ${b.earned ? '#B45309' : '#334155'}`,
                        background: b.earned ? 'linear-gradient(120deg,#F59E0B,#C2410C)' : '#0B1220',
                        color: b.earned ? '#fff' : '#94A3B8',
                        fontWeight: 700,
                        fontSize: 12
                      }}
                    >
                      {b.earned ? '🏅' : '🔒'} {b.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {tab === 'overview' ? (
              <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
                <h3 style={{ marginTop: 0 }}>Licensed Sponsorship Policy Rules (Current)</h3>
                <div style={{ color: '#9CA3AF', display: 'grid', gap: 6 }}>
                  <div><strong style={{ color: '#E5E7EB' }}>$400 flat</strong> per Sponsorship Policy (licensed agents).</div>
                  <div><strong style={{ color: '#E5E7EB' }}>$500 flat</strong> per Sponsorship Policy (inner circle).</div>
                  <div>No month 10/11/12 split and no AP-based calculation for Sponsorship Policies.</div>
                </div>
                <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: '1px solid #334155', background: '#020617' }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Guardrails</div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: '#9CA3AF', display: 'grid', gap: 4 }}>
                    <li>One payout per unique person/event (no duplicate payout).</li>
                    <li>Minimum data quality required (valid name, phone, email, state).</li>
                    <li>No self-submissions, household abuse, or recycled leads.</li>
                    <li>Fraud/duplicate review hold applies before payout release.</li>
                    <li>Program can be updated by company policy notice.</li>
                  </ul>
                </div>
              </div>
            ) : null}



            {tab === 'tracker' ? (
              <div style={{ border: '1px solid #2A3142', borderRadius: 12, overflow: 'hidden', background: '#0F172A' }}>
                <iframe
                  title="Licensed Onboarding Tracker"
                  src={`/licensed-onboarding-tracker?track=licensed&viewerName=${encodeURIComponent(session?.name || '')}&viewerEmail=${encodeURIComponent(session?.email || '')}&viewerRole=${encodeURIComponent(session?.role || 'agent')}`}
                  style={{ width: '100%', minHeight: 1450, border: 0, background: '#020617' }}
                />
              </div>
            ) : null}

            {tab === 'financials' && financials ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between', border: '1px solid #243046', borderRadius: 12, background: '#0B1220', padding: 10 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      ['month', 'This Month'],
                      ['last30', 'Last 30 Days'],
                      ['ytd', 'YTD'],
                      ['all', 'All Time']
                    ].map(([k, label]) => (
                      <button
                        key={`range-${k}`}
                        onClick={() => setFinanceRange(k)}
                        style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid #334155', background: financeRange === k ? '#1D428A' : '#0B1220', color: '#E5E7EB' }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {financials.nextPayout ? (
                      <span className="pill neutral">Next Payout: {dateOnly(financials.nextPayout.expectedPayoutAt || financials.nextPayout.qualifiedAt)} • {fmtMoney(financials.nextPayout.amount)}</span>
                    ) : (
                      <span className="pill neutral">Next Payout: —</span>
                    )}
                    <span className="pill onpace">Paid Ratio: {financials.paidRatio}%</span>
                    <button type="button" className="ghost" onClick={exportFinancialCsv}>Export CSV</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 16 }}>
                  <button
                    type="button"
                    onClick={() => openFinanceDrawer('All-Time Paid', financials.events.filter((e) => e.status === 'paid'))}
                    style={{ textAlign: 'left', border: '1px solid #2A3142', borderRadius: 16, background: 'rgba(168, 85, 247, 0.14)', padding: 20, minHeight: 170, color: '#E5E7EB', cursor: 'pointer', transition: 'all .18s ease', boxShadow: '0 6px 18px rgba(2,6,23,.25)' }}
                  >
                    <div style={{ color: '#C4B5FD', fontSize: 14, marginBottom: 8, letterSpacing: '.2px' }}>All-Time Paid</div>
                    <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.08, marginBottom: 8 }}>{fmtMoney(financials.allTimePaid)}</div>
                    <div style={{ color: '#CBD5E1', fontSize: 18, lineHeight: 1.35 }}>Total commissions already paid out.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => openFinanceDrawer('All-Time Pending', financials.events.filter((e) => e.status === 'pending'))}
                    style={{ textAlign: 'left', border: '1px solid #2A3142', borderRadius: 16, background: 'rgba(245, 158, 11, 0.14)', padding: 20, minHeight: 170, color: '#E5E7EB', cursor: 'pointer', transition: 'all .18s ease', boxShadow: '0 6px 18px rgba(2,6,23,.25)' }}
                  >
                    <div style={{ color: '#FCD34D', fontSize: 14, marginBottom: 8, letterSpacing: '.2px' }}>All-Time Pending</div>
                    <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.08, marginBottom: 8 }}>{fmtMoney(financials.allTimePending)}</div>
                    <div style={{ color: '#CBD5E1', fontSize: 18, lineHeight: 1.35 }}>Approved commissions waiting for payout.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => openFinanceDrawer('This Month Paid', financials.events.filter((e) => e.status === 'paid' && isInRange(e.paidAt || e.qualifiedAt, 'month')))}
                    style={{ textAlign: 'left', border: '1px solid #2A3142', borderRadius: 16, background: 'rgba(34, 197, 94, 0.14)', padding: 20, minHeight: 170, color: '#E5E7EB', cursor: 'pointer', transition: 'all .18s ease', boxShadow: '0 6px 18px rgba(2,6,23,.25)' }}
                  >
                    <div style={{ color: '#86EFAC', fontSize: 14, marginBottom: 8, letterSpacing: '.2px' }}>This Month Paid</div>
                    <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.08, marginBottom: 8 }}>{fmtMoney(financials.thisMonthPaid)}</div>
                    <div style={{ color: '#CBD5E1', fontSize: 18, lineHeight: 1.35 }}>Paid to you in the current month.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => openFinanceDrawer('This Month Pending', financials.events.filter((e) => e.status === 'pending' && isInRange(e.qualifiedAt, 'month')))}
                    style={{ textAlign: 'left', border: '1px solid #2A3142', borderRadius: 16, background: 'rgba(59, 130, 246, 0.14)', padding: 20, minHeight: 170, color: '#E5E7EB', cursor: 'pointer', transition: 'all .18s ease', boxShadow: '0 6px 18px rgba(2,6,23,.25)' }}
                  >
                    <div style={{ color: '#93C5FD', fontSize: 14, marginBottom: 8, letterSpacing: '.2px' }}>This Month Pending</div>
                    <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.08, marginBottom: 8 }}>{fmtMoney(financials.thisMonthPending)}</div>
                    <div style={{ color: '#CBD5E1', fontSize: 18, lineHeight: 1.35 }}>Still processing for this month.</div>
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>
                  <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
                    <h3 style={{ marginTop: 0, marginBottom: 10 }}>Monthly Earnings Trend</h3>
                    {!financials.trend.length ? <p style={{ color: '#9CA3AF' }}>No trend data yet.</p> : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {financials.trend.map((t) => {
                          const max = Math.max(...financials.trend.map((x) => Number(x.amount || 0)), 1);
                          const w = Math.max(4, Math.round((Number(t.amount || 0) / max) * 100));
                          return (
                            <button key={t.key} type="button" onClick={() => openFinanceDrawer(`Earnings in ${t.label}`, financials.events.filter((e) => monthKey(e.status === 'paid' ? (e.paidAt || e.qualifiedAt) : e.qualifiedAt) === t.key))} style={{ background: 'transparent', color: '#E5E7EB', border: 0, textAlign: 'left', padding: 0 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 90px', gap: 8, alignItems: 'center' }}>
                                <span style={{ color: '#9CA3AF', fontSize: 12 }}>{t.label}</span>
                                <div style={{ height: 10, borderRadius: 999, background: '#1F2937', overflow: 'hidden' }}>
                                  <div style={{ width: `${w}%`, height: '100%', background: 'linear-gradient(90deg,#2563EB,#60A5FA)', transition: 'width .35s ease' }} />
                                </div>
                                <span style={{ textAlign: 'right', fontSize: 12 }}>{fmtMoney(t.amount)}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
                    <h3 style={{ marginTop: 0, marginBottom: 10 }}>Income Source Breakdown</h3>
                    {financials.sourceSum <= 0 ? <p style={{ color: '#9CA3AF' }}>No source data in this range.</p> : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {[
                          ['Direct Sales', 'direct_sales', '#3B82F6'],
                          ['Sponsorship Bonuses', 'sponsorship_bonus', '#10B981'],
                          ['Overrides', 'override', '#F59E0B']
                        ].map(([label, key, color]) => {
                          const amt = Number(financials.sourceTotals[key] || 0);
                          const pct = financials.sourceSum > 0 ? Math.round((amt / financials.sourceSum) * 100) : 0;
                          return (
                            <button key={key} type="button" onClick={() => openFinanceDrawer(`${label} (${financeRange.toUpperCase()})`, financials.filteredEvents.filter((e) => e.sourceType === key))} style={{ background: 'transparent', border: 0, color: '#E5E7EB', padding: 0, textAlign: 'left' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                <span>{label}</span>
                                <span>{pct}% • {fmtMoney(amt)}</span>
                              </div>
                              <div style={{ height: 8, borderRadius: 999, background: '#1F2937', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.max(2, pct)}%`, height: '100%', background: color, transition: 'width .35s ease' }} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0 }}>Upcoming Payout Items</h3>
                    <div style={{ color: '#9CA3AF', fontSize: 13 }}>Projected EOM: <strong style={{ color: '#E5E7EB' }}>{fmtMoney(financials.projectedEom)}</strong>{financials.latestEventAt ? <span> • Updated {dateOnly(new Date(financials.latestEventAt).toISOString())}</span> : null}</div>
                  </div>
                  <p style={{ color: '#9CA3AF', margin: '8px 0 0', fontSize: 12 }}>Payout processing is automatic. The normal exception is when a policy is marked <strong style={{ color: '#E5E7EB' }}>Delivery Requirement</strong> and client documents are still pending.</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
                    <span className="pill neutral">Pending Aging 0–7d: {financials.aging.d0_7}</span>
                    <span className="pill atrisk">8–14d: {financials.aging.d8_14}</span>
                    <span className="pill offpace">15+d: {financials.aging.d15p}</span>
                    <span className="pill atrisk">Pending: {fmtMoney(financials.pendingTotals.pending)}</span>
                    <span className="pill offpace">Delivery Required: {fmtMoney(financials.pendingTotals.delivery)}</span>
                    <span className="pill offpace">Hold: {fmtMoney(financials.pendingTotals.hold)}</span>
                    <span className="pill offpace">Overdue: {fmtMoney(financials.pendingTotals.overdue)}</span>
                  </div>
                  {!financials.upcoming.length ? <p style={{ color: '#9CA3AF' }}>No pending payout items.</p> : (
                    <table>
                      <thead>
                        <tr>
                          <th>Applicant / Policy</th>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Expected</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {financials.upcoming.map((e) => {
                          const pill = financeStatusPill(e.pendingStage || e.status);
                          return (
                            <tr key={`up-${e.id}`}>
                              <td>{e.referenceName}</td>
                              <td>{e.policyType || 'Policy'}</td>
                              <td>{fmtMoney(e.amount)}</td>
                              <td>
                                <span className={`pill ${pill.cls}`}>{pill.label}</span>
                                {e.pendingStage === 'delivery_requirement' && e.deliveryRequirementNote ? (
                                  <div style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>{e.deliveryRequirementNote}</div>
                                ) : null}
                              </td>
                              <td>{dateOnly(e.expectedPayoutAt || e.qualifiedAt) || '—'}</td>
                              <td>
                                <button type="button" className="ghost" onClick={() => openFinanceDrawer(`Payout Detail: ${e.referenceName}`, [e])}>View</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {financeDrawer.open ? (
                  <div
                    role="dialog"
                    aria-modal="true"
                    onClick={closeFinanceDrawer}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 70, display: 'grid', justifyItems: 'end' }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: 'min(720px, 96vw)', height: '100vh', overflow: 'auto', background: '#0B1220', borderLeft: '1px solid #334155', padding: 16 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>{financeDrawer.title}</h3>
                        <button type="button" className="ghost" onClick={closeFinanceDrawer}>Close</button>
                      </div>
                      <p style={{ color: '#9CA3AF', marginTop: 6 }}>Rows: {financeDrawer.items.length}</p>
                      {!financeDrawer.items.length ? (
                        <p style={{ color: '#9CA3AF' }}>No rows for this selection.</p>
                      ) : (
                        <table>
                          <thead>
                            <tr>
                              <th>Applicant</th>
                              <th>Type</th>
                              <th>Amount</th>
                              <th>Status</th>
                              <th>Qualified</th>
                              <th>Expected</th>
                              <th>Paid</th>
                            </tr>
                          </thead>
                          <tbody>
                            {financeDrawer.items.map((e, i) => {
                              const pill = financeStatusPill(e.pendingStage || e.status);
                              return (
                                <tr key={`${e.id || 'row'}-${i}`}>
                                  <td>{e.referenceName || '—'}</td>
                                  <td>{e.policyType || 'Policy'}</td>
                                  <td>{fmtMoney(e.amount)}</td>
                                  <td><span className={`pill ${pill.cls}`}>{pill.label}</span></td>
                                  <td>{dateOnly(e.qualifiedAt) || '—'}</td>
                                  <td>{dateOnly(e.expectedPayoutAt) || '—'}</td>
                                  <td>{dateOnly(e.paidAt) || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}


            {tab === 'sponsorships' ? (
              <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
                <h3 style={{ marginTop: 0 }}>My Sponsorship Pipeline</h3>
                {!metrics.sponsorshipEntries.length ? <p style={{ color: '#9CA3AF' }}>No sponsorship records tied to your referral name yet.</p> : (
                  <>
                    <p style={{ color: '#9CA3AF', marginTop: 0 }}>Pipeline entries: <strong style={{ color: '#E5E7EB' }}>{metrics.sponsorshipEntries.length}</strong> • Approved: <strong style={{ color: '#E5E7EB' }}>{metrics.approvedSponsors.length}</strong></p>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {metrics.sponsorshipEntries.slice(0, 20).map((r, idx) => (
                        <div key={r.id} style={{ border: '1px solid #2A3142', borderRadius: 10, padding: 10, background: '#020617' }}>
                          <strong>{r.name}</strong>
                          <div style={{ color: '#9CA3AF' }}>{r.state || '—'} • {r.status} • {r.submittedAt || '—'}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {tab === 'upline' ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
                  <h3 style={{ marginTop: 0, marginBottom: 8 }}>Upline Support</h3>
                  <p style={{ color: '#9CA3AF', marginTop: 0 }}>Upline support. Response expectation: <strong style={{ color: '#E5E7EB' }}>24 hours</strong>.</p>

                  {uplineData?.loading ? <p style={{ color: '#9CA3AF' }}>Loading upline support…</p> : null}
                  {uplineData?.error ? <p style={{ color: '#FCA5A5' }}>{uplineData.error}</p> : null}

                  <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#020617', padding: 12, marginBottom: 10 }}>
                    <div style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 4 }}>Primary Upline</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 18 }}>{clean(uplineData?.upline?.name || 'Support Team')}</strong>
                      <span className="pill neutral">{clean(uplineData?.upline?.role || 'Mentor')}</span>
                      {uplineData?.upline?.email ? <span style={{ color: '#93C5FD', fontSize: 13 }}>{uplineData.upline.email}</span> : null}
                    </div>
                    <div style={{ color: '#9CA3AF', fontSize: 12, marginTop: 6 }}>Unread in this thread: {Number(uplineData?.unreadForViewer || 0)}</div>
                  </div>

                  <div style={{ display: 'grid', gap: 8, maxHeight: 360, overflow: 'auto', paddingRight: 4 }}>
                    {!Array.isArray(uplineData?.rows) || !uplineData.rows.length ? (
                      <div style={{ border: '1px dashed #334155', borderRadius: 10, padding: 12, color: '#9CA3AF' }}>No messages yet. Send your first message to start the thread.</div>
                    ) : (
                      uplineData.rows.slice(-40).map((msg, idx) => {
                        const mine = normalize(msg?.fromRole || '') === 'agent';
                        const deadlineText = mine && clean(msg?.deadlineAt)
                          ? `SLA deadline: ${new Date(msg.deadlineAt).toLocaleString()}`
                          : '';
                        return (
                          <div key={msg?.id || `${msg?.createdAt || 'na'}-${idx}`} style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: mine ? '#13203A' : '#111827' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                              <strong>{mine ? 'You' : clean(msg?.fromName || 'Upline')}</strong>
                              <span style={{ color: '#9CA3AF', fontSize: 12 }}>{clean(msg?.createdAt) ? new Date(msg.createdAt).toLocaleString() : '—'}</span>
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{clean(msg?.body || '')}</div>
                            {deadlineText ? <div style={{ color: '#9CA3AF', fontSize: 12, marginTop: 6 }}>{deadlineText}</div> : null}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                    <textarea
                      value={uplineDraft}
                      onChange={(e) => setUplineDraft(e.target.value)}
                      placeholder="Message your upline leader..."
                      rows={4}
                      style={{ width: '100%', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff', padding: '10px 12px', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button type="button" onClick={sendUplineMessage} disabled={uplineSendBusy} style={{ padding: '10px 14px', borderRadius: 10, border: 0, background: '#C8A96B', color: '#0B1020', fontWeight: 800 }}>
                        {uplineSendBusy ? 'Sending…' : 'Send Message'}
                      </button>
                      {uplineSendMsg ? <span style={{ color: uplineSendMsg.toLowerCase().includes('could not') ? '#FCA5A5' : '#86EFAC' }}>{uplineSendMsg}</span> : null}
                    </div>
                  </div>

                  <div style={{ marginTop: 16, borderTop: '1px solid #243046', paddingTop: 14, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <h4 style={{ margin: 0 }}>Upline Inbox (Leader View)</h4>
                      <span className="pill neutral">Unread: {Number(uplineInbox?.unreadTotal || 0)}</span>
                    </div>
                    {uplineInbox?.loading ? <p style={{ color: '#9CA3AF', margin: 0 }}>Loading inbox…</p> : null}
                    {uplineInbox?.error ? <p style={{ color: '#FCA5A5', margin: 0 }}>{uplineInbox.error}</p> : null}

                    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 10 }}>
                      <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#020617', maxHeight: 360, overflow: 'auto' }}>
                        {!uplineInbox?.threads?.length ? (
                          <div style={{ color: '#9CA3AF', padding: 12 }}>No inbound threads yet.</div>
                        ) : (
                          uplineInbox.threads.map((t, idx) => {
                            const active = clean(t?.threadKey) === clean(uplineSelectedThread);
                            return (
                              <button
                                key={t?.threadKey || `thread-${idx}`}
                                type="button"
                                onClick={() => setUplineSelectedThread(clean(t?.threadKey || ''))}
                                style={{ width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid #1F2937', background: active ? '#13203A' : 'transparent', color: '#E5E7EB', padding: 10 }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                                  <strong>{clean(t?.agentName || 'Agent')}</strong>
                                  {Number(t?.unread || 0) > 0 ? <span className="pill atrisk">{Number(t.unread)}</span> : null}
                                </div>
                                <div style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>{clean(t?.latest?.createdAt) ? new Date(t.latest.createdAt).toLocaleString() : '—'}</div>
                              </button>
                            );
                          })
                        )}
                      </div>

                      <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#020617', padding: 10, display: 'grid', gap: 8 }}>
                        {(() => {
                          const thread = (uplineInbox?.threads || []).find((t) => clean(t?.threadKey) === clean(uplineSelectedThread));
                          if (!thread) return <div style={{ color: '#9CA3AF' }}>Select a thread to reply.</div>;
                          return (
                            <>
                              <div style={{ maxHeight: 220, overflow: 'auto', display: 'grid', gap: 8 }}>
                                {(thread.rows || []).slice(-20).map((msg, idx) => (
                                  <div key={msg?.id || `${idx}-${msg?.createdAt || 'na'}`} style={{ border: '1px solid #334155', borderRadius: 8, padding: 8, background: normalize(msg?.fromRole || '') === 'upline' ? '#1F2937' : '#111827' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                      <strong>{normalize(msg?.fromRole || '') === 'upline' ? 'You' : clean(msg?.fromName || 'Agent')}</strong>
                                      <span style={{ color: '#9CA3AF', fontSize: 12 }}>{clean(msg?.createdAt) ? new Date(msg.createdAt).toLocaleString() : '—'}</span>
                                    </div>
                                    <div style={{ whiteSpace: 'pre-wrap' }}>{clean(msg?.body || '')}</div>
                                  </div>
                                ))}
                              </div>
                              <textarea
                                value={uplineReplyDraft}
                                onChange={(e) => setUplineReplyDraft(e.target.value)}
                                rows={3}
                                placeholder="Reply to this agent..."
                                style={{ width: '100%', borderRadius: 8, border: '1px solid #334155', background: '#0B1220', color: '#fff', padding: '10px 12px' }}
                              />
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <button type="button" onClick={sendUplineReply} disabled={uplineReplyBusy} style={{ padding: '10px 14px', borderRadius: 10, border: 0, background: '#2563EB', color: '#fff', fontWeight: 800 }}>
                                  {uplineReplyBusy ? 'Sending…' : 'Send Reply'}
                                </button>
                                {uplineReplyMsg ? <span style={{ color: uplineReplyMsg.toLowerCase().includes('could not') ? '#FCA5A5' : '#86EFAC' }}>{uplineReplyMsg}</span> : null}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'policies' ? (
              <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
                <h3 style={{ marginTop: 0 }}>Policy Production</h3>
                {!metrics.myPolicies.length ? <p style={{ color: '#9CA3AF' }}>No policy records found yet under your writer/referrer name.</p> : (
                  <>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      <span className="pill neutral">Decision Type: Submitted App</span>
                      <span className="pill offpace">Skipped Apps (Onboarding Only): {skippedAppDecisions.length}</span>
                    </div>
                    <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                      {metrics.recentMonths.map((m) => (
                        <div key={m.month} style={{ border: '1px solid #2A3142', borderRadius: 10, padding: 10, background: '#020617', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{m.month}</span><strong>${m.ap.toLocaleString()} AP</strong>
                        </div>
                      ))}
                    </div>
                    <div style={{ color: '#9CA3AF', marginBottom: 10 }}>Approved policies: {metrics.approvedPolicies.length} of {metrics.myPolicies.length} total submissions.</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {metrics.approvedPolicyEntries.slice(0, 20).map((p) => (
                        <div key={p.id} style={{ border: '1px solid #2A3142', borderRadius: 10, padding: 10, background: '#020617', display: 'grid', gap: 4 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <strong>{p.name || 'Unnamed Applicant'}</strong>
                            <span className="pill neutral">Submitted App</span>
                          </div>
                          <div style={{ color: '#9CA3AF' }}>{p.state || '—'} • {p.status} • {p.submittedAt || '—'}</div>
                          <div style={{ color: '#FCD34D', fontWeight: 700 }}>AP: ${Number(p.ap || 0).toLocaleString()} (Monthly: ${Number(p.monthlyPremium || 0).toLocaleString()})</div>
                        </div>
                      ))}
                    </div>

                    {skippedAppDecisions.length ? (
                      <div style={{ marginTop: 10, border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#020617' }}>
                        <strong style={{ color: '#E5E7EB' }}>Skipped App Decisions (No Production Credit)</strong>
                        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                          {skippedAppDecisions.slice(0, 8).map((r) => (
                            <div key={`skip-pol-${r?.id || r?.createdAt}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                              <span style={{ color: '#CBD5E1' }}>{r?.applicantName || 'Applicant'}</span>
                              <span className="pill offpace">Skipped App</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {tab === 'submit' ? (
              <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14, display: 'grid', gap: 10 }}>
                <h3 style={{ marginTop: 0, marginBottom: 0 }}>Submit Policy App</h3>
                <p style={{ color: '#9CA3AF', margin: 0 }}>Same flow structure as Inner Circle App Submit, but inside Licensed Back Office with your writer info prefilled.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <select value={appForm.appType} onChange={(e) => setAppForm((p) => ({ ...p, appType: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }}>
                    <option value="">Application type *</option>
                    <option value="Sponsorship App">Sponsorship App</option>
                    <option value="Bonus Policy">Bonus Policy</option>
                    {isAdmin ? <option value="Inner Circle App">Inner Circle App</option> : null}
                    <option value="Regular App">Regular App</option>
                    <option value="Juvenile App">Juvenile App</option>
                  </select>
                  {requiresContract ? (
                    <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#020617', padding: 10, display: 'grid', gap: 8, gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {contractStatus.loading ? <span className="pill">Checking contract signature…</span> : null}
                        {!contractStatus.loading && clean(appForm.applicantEmail) && contractStatus.signed ? (
                          <span className="pill onpace">Contracting Complete ✅ {contractStatus.signedAt ? `(${new Date(contractStatus.signedAt).toLocaleDateString()})` : ''}</span>
                        ) : null}
                        {!contractStatus.loading && clean(appForm.applicantEmail) && !contractStatus.signed ? (
                          <span className="pill atrisk">Contracting Not Completed</span>
                        ) : null}
                        <button type="button" className="ghost" onClick={sendAgreementLinkEmail} disabled={contractEmailBusy || !clean(appForm.applicantEmail) || !clean(appForm.applicantName)}>
                          {contractEmailBusy ? 'Sending Agreement…' : 'Send Agreement Link to Applicant'}
                        </button>
                      </div>
                      {contractEmailMsg ? <small className="muted">{contractEmailMsg}</small> : null}
                      {contractLinkInfo.sentAt ? (
                        <small className="muted">Agreement link last sent: {new Date(contractLinkInfo.sentAt).toLocaleString()}{contractLinkInfo.requestedByName ? ` by ${contractLinkInfo.requestedByName}` : ''}</small>
                      ) : null}
                      {contractLastCheckedAt ? (
                        <small className="muted">Signature status last checked: {new Date(contractLastCheckedAt).toLocaleString()}</small>
                      ) : null}
                    </div>
                  ) : null}
                  <input value={appForm.applicantName} onChange={(e) => setAppForm((p) => ({ ...p, applicantName: e.target.value }))} placeholder="Client name *" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }} />
                  <input value={appForm.applicantEmail} onChange={(e) => setAppForm((p) => ({ ...p, applicantEmail: e.target.value }))} placeholder="Applicant email" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }} />
                  <input value={appForm.applicantPhone} onChange={(e) => setAppForm((p) => ({ ...p, applicantPhone: e.target.value }))} placeholder="Applicant phone" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }} />
                  {String(appForm.appType || '').toLowerCase().includes('inner circle') ? (
                    <select value={appForm.applicantEmail || ''} onChange={(e) => {
                      const selected = (Array.isArray(innerCircleUsers) ? innerCircleUsers : []).find((u) => clean(u?.email).toLowerCase() === clean(e.target.value).toLowerCase());
                      if (!selected) return;
                      setAppForm((p) => ({
                        ...p,
                        applicantName: clean(selected?.name || selected?.fullName || p.applicantName),
                        applicantEmail: clean(selected?.email || p.applicantEmail),
                        referredByName: p.referredByName || clean(selected?.name || selected?.fullName || ''),
                      }));
                    }} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }}>
                      <option value="">Select inner circle member *</option>
                      {(Array.isArray(innerCircleUsers) ? innerCircleUsers : []).map((u) => (
                        <option key={`ic-${u?.email || u?.name}`} value={u?.email || ''}>{u?.name || u?.fullName} {u?.email ? `(${u.email})` : ''}</option>
                      ))}
                    </select>
                  ) : null}
                  <select value={appForm.applicantLicensedStatus} onChange={(e) => setAppForm((p) => ({ ...p, applicantLicensedStatus: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }}>
                    <option value="Licensed">Licensed</option>
                    <option value="Unlicensed">Unlicensed</option>
                  </select>
                  <input value={appForm.state} onChange={(e) => setAppForm((p) => ({ ...p, state: e.target.value.toUpperCase() }))} placeholder="State *" maxLength={2} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }} />
                  <input value={appForm.referredByName} onChange={(e) => setAppForm((p) => ({ ...p, referredByName: e.target.value }))} placeholder="Referred by *" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }} />
                  <input value={appForm.policyWriterName} onChange={(e) => setAppForm((p) => ({ ...p, policyWriterName: e.target.value }))} placeholder="Policy written by *" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }} />
                  <input value={appForm.policyNumber} onChange={(e) => setAppForm((p) => ({ ...p, policyNumber: e.target.value }))} placeholder="Policy number (optional)" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }} />
                  <select value={appForm.productKey || DEFAULT_PRODUCT.key} onChange={(e) => {
                    const next = productByKey(e.target.value);
                    setAppForm((p) => ({ ...p, productKey: next.key, carrier: next.carrier, productName: next.productName }));
                  }} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }}>
                    {PRODUCT_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                  <input value={appForm.carrier || DEFAULT_PRODUCT.carrier} readOnly disabled style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }} />
                  <input value={appForm.monthlyPremium} onChange={(e) => setAppForm((p) => ({ ...p, monthlyPremium: e.target.value }))} placeholder={String(appForm.appType || '').toLowerCase().includes('regular') || String(appForm.appType || '').toLowerCase().includes('juvenile') ? "Monthly premium (optional)" : "Monthly premium"} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }} />
                  {(String(appForm.appType || '').toLowerCase().includes('regular') || String(appForm.appType || '').toLowerCase().includes('juvenile')) ? (
                    <input value={appForm.annualPremium} onChange={(e) => setAppForm((p) => ({ ...p, annualPremium: e.target.value }))} placeholder="Annualized premium (AP)" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#fff' }} />
                  ) : null}
                </div>
                <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#020617', padding: 10, display: 'grid', gap: 8 }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#E5E7EB' }}>
                    <input type="checkbox" checked={Boolean(appForm.deliveryRequirementNeeded)} onChange={(e) => setAppForm((p) => ({ ...p, deliveryRequirementNeeded: Boolean(e.target.checked) }))} />
                    Delivery requirement needed (may delay payout)
                  </label>
                  {appForm.deliveryRequirementNeeded ? (
                    <input value={appForm.deliveryRequirementNote || ''} onChange={(e) => setAppForm((p) => ({ ...p, deliveryRequirementNote: e.target.value }))} placeholder="Optional note (ex: waiting on signed delivery docs)" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#0b1220', color: '#fff' }} />
                  ) : null}
                </div>
                <div style={{ color: '#9CA3AF', fontSize: 13 }}>Estimated Sponsorship Policy payout: <strong style={{ color: '#E5E7EB' }}>{String(appForm.appType || '').toLowerCase().includes('sponsorship') ? `$${isInnerCircleName(clean(appForm.policyWriterName || session?.name || '')) ? 500 : 400}` : 'Based on policy type rules'}</strong></div>
                <div style={{ color: '#9CA3AF', fontSize: 12 }}>Automatic payout runs as normal. The only standard delay is when Delivery Requirement is marked and documents are still pending.</div>
                {requiresContract && !contractStatus.signed ? <div style={{ color: '#FCA5A5', fontSize: 12 }}>Policy submit is locked until contracting is completed.</div> : null}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={submitPolicyFromBackoffice} disabled={submitBusy || !canSubmitPolicy} style={{ padding: '10px 14px', borderRadius: 10, border: 0, background: '#C8A96B', color: '#0B1020', fontWeight: 800 }}>
                    {submitBusy ? 'Submitting…' : 'Submit App'}
                  </button>
                  <a href="/inner-circle-app-submit" target="_blank" rel="noreferrer" style={{ color: '#93C5FD' }}>Open full app submit page</a>
                  {submitMsg ? <span style={{ color: submitMsg.toLowerCase().includes('fail') || submitMsg.toLowerCase().includes('required') ? '#FCA5A5' : '#86EFAC' }}>{submitMsg}</span> : null}
                </div>
              </div>
            ) : null}

            {tab === 'academy' ? (
              <div style={{ border: '1px solid #2A3142', borderRadius: 12, overflow: 'hidden', background: '#0F172A' }}>
                <iframe title="IUL Academy" src={`/iul-learning-academy?name=${encodeURIComponent(session?.name || '')}&email=${encodeURIComponent(session?.email || '')}&licensed=1&v=20260315-3`} style={{ width: '100%', minHeight: 1400, border: 0, background: '#020617' }} />
              </div>
            ) : null}

            {tab === 'awards' ? (
              <div style={{ border: '1px solid #2A3142', borderRadius: 12, overflow: 'hidden', background: '#0F172A' }}>
                <iframe title="Achievement Center" src={`/achievement-center?name=${encodeURIComponent(session?.name || '')}&email=${encodeURIComponent(session?.email || '')}&licensed=1`} style={{ width: '100%', minHeight: 1200, border: 0, background: '#020617' }} />
              </div>
            ) : null}

            {tab === 'growth' ? (
              <div style={{ border: '1px solid #2A3142', borderRadius: 12, overflow: 'hidden', background: '#0F172A' }}>
                <iframe title="Growth Hub" src="/growth-hub" style={{ width: '100%', minHeight: 980, border: 0, background: '#020617' }} />
              </div>
            ) : null}

            {tab === 'resources' ? (
              <div style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14, display: 'grid', gap: 8 }}>
                <h3 style={{ marginTop: 0 }}>Resources</h3>
                <a href="/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf" target="_blank" rel="noreferrer" style={{ color: '#93C5FD' }}>Licensed Onboarding Playbook</a>
                <a href="/docs/onboarding/legacy-link-comp-schedule-bonuses-v2.pdf" target="_blank" rel="noreferrer" style={{ color: '#93C5FD' }}>Comp Schedule + Bonuses + FAQ</a>
                <a href="/docs/onboarding/legacy-link-sponsorship-phone-application-sop.pdf" target="_blank" rel="noreferrer" style={{ color: '#93C5FD' }}>Sponsorship Application Call SOP</a>
              </div>
            ) : null}

            {tab === 'scriptvault' ? (
              <div style={{ border: '1px solid #2A3142', borderRadius: 12, overflow: 'hidden', background: '#0F172A' }}>
                <iframe
                  title="Script Vault 2.0"
                  src={`/inner-circle-scripts?home=/licensed-backoffice&name=${encodeURIComponent(session?.name || '')}&email=${encodeURIComponent(session?.email || '')}&licensed=1`}
                  style={{ width: '100%', minHeight: 1150, border: 0, background: '#020617' }}
                />
              </div>
            ) : null}

            {tab === 'linkleads' ? (
              <div style={{ border: '1px solid #334155', borderRadius: 18, background: 'radial-gradient(120% 120% at 0% 0%, #12203a 0%, #0B1220 55%, #070b14 100%)', padding: 18, display: 'grid', gap: 14, boxShadow: '0 18px 40px rgba(2,6,23,.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 22, letterSpacing: '.01em' }}>VIP Links</h3>
                    <small style={{ color: '#94A3B8' }}>Your personal sponsorship link hub.</small>
                  </div>
                  <span style={{ border: '1px solid #14532d', background: '#052e16', color: '#86efac', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 800 }}>HARDWIRED</span>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className="pill">Attribution Locked</span>
                  <span className="pill">Cross-Device Saved</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))', gap: 14 }}>
                  <div style={{ border: '1px solid #166534', borderRadius: 14, background: 'linear-gradient(180deg,#0B1220 0%, #0a2316 100%)', padding: 14, display: 'grid', gap: 10 }}>
                    <strong style={{ color: '#DCFCE7', fontSize: 16 }}>Your Personal Sponsorship Link</strong>
                    <small style={{ color: '#86EFAC' }}>Share this link so every referral is automatically attributed to your agent profile.</small>

                    <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #166534', background: '#020617', color: '#DCFCE7', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, wordBreak: 'break-all' }}>
                      {`${typeof window !== 'undefined' ? window.location.origin : 'https://innercirclelink.com'}${personalSponsorshipLink}`}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <a href={personalSponsorshipLink} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                        <button type="button" style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: '#16A34A', color: '#fff', fontWeight: 700, boxShadow: '0 8px 18px rgba(22,163,74,.35)' }}>Open Personal Sponsorship Page</button>
                      </a>
                      <button type="button" className="ghost" onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}${personalSponsorshipLink}`);
                        setCopiedSponsor(true);
                        setTimeout(() => setCopiedSponsor(false), 1400);
                      }}>
                        {copiedSponsor ? 'Copied ✅' : 'Copy Sponsorship Link'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
