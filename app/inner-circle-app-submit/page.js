'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'legacy-inner-circle-policy-apps-v1';
const SESSION_KEY = 'legacy-inner-circle-submit-session-v1';
const HUB_SESSION_KEY = 'inner_circle_hub_member_v1';

const PRODUCT_OPTIONS = [
  { key: 'fg_pathsetter', label: 'IUL Pathsetter (F&G)', carrier: 'F&G', productName: 'IUL Pathsetter' },
  { key: 'nlg_flex_life', label: 'Flex Life (NLG)', carrier: 'National Life Group', productName: 'Flex Life' }
];
const DEFAULT_PRODUCT = PRODUCT_OPTIONS[0];

function productByKey(key = '') {
  return PRODUCT_OPTIONS.find((p) => p.key === key) || DEFAULT_PRODUCT;
}

function normalizeRef(ref = '') {
  const cleaned = String(ref).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (cleaned === 'latricia_wright') return 'leticia_wright';
  return cleaned;
}

function normalizePremiumInput(v = '') {
  const raw = String(v || '').replace(/[^0-9.]/g, '');
  if (!raw) return '';

  const [wholeRaw, ...rest] = raw.split('.');
  const whole = wholeRaw || '0';
  const decimal = rest.join('').slice(0, 2);
  const rebuilt = decimal ? `${whole}.${decimal}` : whole;

  const n = Number(rebuilt);
  if (Number.isNaN(n)) return '';

  // Hard cap requested by Kimora.
  if (n > 5000) return '5000';
  return rebuilt;
}

function formatPhoneInput(v = '') {
  const digits = String(v || '').replace(/\D/g, '').slice(0, 10);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function roundMoney(v = 0) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function isAnnualizedType(appType = '') {
  const type = String(appType || '').toLowerCase();
  return type.includes('regular') || type.includes('juvenile');
}

function calcPreview(appType = '', monthlyPremium = 0, annualPremiumInput = 0, licensedStatus = '', carrier = '', productName = '') {
  const type = String(appType || '').toLowerCase();
  const monthly = Math.max(0, Number(monthlyPremium || 0) || 0);
  const annualFromMonthly = roundMoney(monthly * 12);
  const annualInput = Math.max(0, Number(annualPremiumInput || 0) || 0);
  const annual = isAnnualizedType(type) && annualInput > 0 ? roundMoney(annualInput) : annualFromMonthly;
  const licensed = String(licensedStatus || '').toLowerCase() === 'licensed';

  let commissionRate = 0;
  let points = 0;
  let flatPayout = false;

  if (type.includes('sponsorship')) {
    points = 500;
    flatPayout = true;
  } else if (type.includes('bonus')) {
    points = licensed ? 500 : 0;
    flatPayout = true;
  } else if (type.includes('inner circle')) {
    const isNlgFlex = String(carrier || '').toLowerCase().includes('national life') || String(productName || '').toLowerCase().includes('flex life');
    points = isNlgFlex ? 1200 : 500;
    flatPayout = true;
  } else if (type.includes('regular')) {
    commissionRate = 0.7;
    points = roundMoney(annual * commissionRate);
  } else if (type.includes('juvenile')) {
    commissionRate = 0.5;
    points = roundMoney(annual * commissionRate);
  }

  const advance = flatPayout ? roundMoney(points) : roundMoney(points * 0.75);
  const remaining = flatPayout ? 0 : roundMoney(points - advance);
  const m10 = flatPayout ? 0 : roundMoney(remaining / 3);

  return {
    annualPremium: annual,
    commissionRate,
    pointsEarned: points,
    advancePayout: advance,
    remainingBalance: remaining,
    month10Payout: m10,
    month11Payout: m10,
    month12Payout: m10,
    flatPayout,
    bonusEligible: type.includes('bonus') ? licensed : true,
    annualizedInputUsed: isAnnualizedType(type) && annualInput > 0
  };
}

function csvNameToDisplay(raw = '') {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (!v.includes(',')) return v;
  const parts = v.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return v;
  const last = parts[0];
  const first = parts.slice(1).join(' ').trim();
  return `${first} ${last}`.trim();
}

function prefillFromSearch() {
  if (typeof window === 'undefined') return null;
  const sp = new URLSearchParams(window.location.search);
  const refCode = normalizeRef(sp.get('ref') || sp.get('refCode') || '');
  const firstName = String(sp.get('firstName') || '').trim();
  const lastName = String(sp.get('lastName') || '').trim();
  const nameRaw = String(sp.get('name') || `${firstName} ${lastName}` || '').trim();
  const name = csvNameToDisplay(nameRaw);
  const email = String(sp.get('email') || '').trim();
  const phone = String(sp.get('phone') || '').trim();
  const state = String(sp.get('state') || '').trim().toUpperCase().slice(0, 2);
  const licensed = String(sp.get('licensed') || '').trim();
  const referredBy = csvNameToDisplay(String(sp.get('referredBy') || '').trim());
  const policyWriter = csvNameToDisplay(String(sp.get('policyWriter') || '').trim());
  const appType = String(sp.get('appType') || '').trim();
  const policyNumber = String(sp.get('policyNumber') || '').trim();
  const monthlyPremium = String(sp.get('monthlyPremium') || '').trim();
  const carrier = String(sp.get('carrier') || '').trim();
  const productName = String(sp.get('productName') || '').trim();
  const source = String(sp.get('source') || '').trim();
  const existingSubmissionId = String(sp.get('existingId') || '').trim();

  const hasAny = Boolean(name || email || phone || state || licensed || referredBy || refCode || policyWriter || appType || policyNumber || monthlyPremium || carrier || productName || source || existingSubmissionId);
  if (!hasAny) return null;

  return {
    refCode,
    applicantName: name,
    applicantEmail: email,
    applicantPhone: phone,
    applicantLicensedStatus: licensed,
    state,
    referredByNameRaw: referredBy,
    policyWriterNameRaw: policyWriter,
    appType,
    policyNumber,
    monthlyPremium,
    carrier,
    productName,
    source,
    existingSubmissionId
  };
}

function mapReferrerToUser(raw = '', users = [], refCode = '') {
  const input = String(raw || '').trim().toLowerCase();
  const byCode = String(refCode || '').replace(/[_-]+/g, ' ').trim().toLowerCase();
  if (!input && !byCode) return '';

  for (const u of users || []) {
    const n = String(u?.name || '').trim().toLowerCase();
    if (!n) continue;
    if (input && (n === input || n.includes(input) || input.includes(n))) return u.name;
    if (byCode && (n.includes(byCode) || byCode.includes(n.split(' ')[0] || ''))) return u.name;
  }
  return '';
}

export default function InnerCircleAppSubmitPage() {
  const [ref, setRef] = useState('');
  const [saved, setSaved] = useState('');
  const [skipBusy, setSkipBusy] = useState(false);
  const [contractStatus, setContractStatus] = useState({ loading: false, checkedEmail: '', signed: false, signedAt: '' });
  const [contractEmailBusy, setContractEmailBusy] = useState(false);
  const [contractEmailMsg, setContractEmailMsg] = useState('');
  const [contractLinkInfo, setContractLinkInfo] = useState({ loading: false, sentAt: '', requestedByName: '' });
  const [contractLastCheckedAt, setContractLastCheckedAt] = useState('');
  const [showSignedToast, setShowSignedToast] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [adminBypassContractGate, setAdminBypassContractGate] = useState(false);
  const [adminMarkedAppReceived, setAdminMarkedAppReceived] = useState(false);
  const signedRef = useRef(false);

  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [users, setUsers] = useState([]);
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [form, setForm] = useState({
    appType: '',
    applicantName: '',
    applicantEmail: '',
    applicantPhone: '',
    applicantLicensedStatus: '',
    referredByName: '',
    referredByOtherName: '',
    policyWriterName: '',
    policyWriterOtherName: '',
    state: '',
    policyNumber: '',
    monthlyPremium: '',
    annualPremium: '',
    productKey: DEFAULT_PRODUCT.key,
    carrier: DEFAULT_PRODUCT.carrier,
    productName: DEFAULT_PRODUCT.productName,
    status: 'Submitted'
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pre = prefillFromSearch();
    setPrefill(pre);
    setRef(pre?.refCode || '');

    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.name) setSession(parsed);
      }

      // Seamless access for Inner Circle members coming from the Hub.
      if (!raw) {
        const hubRaw = localStorage.getItem(HUB_SESSION_KEY);
        if (hubRaw) {
          const hubMember = JSON.parse(hubRaw);
          const hubName = String(hubMember?.applicantName || hubMember?.name || '').trim();
          if (hubName) {
            const derived = { name: hubName, role: 'submitter', source: 'inner_circle_hub' };
            setSession(derived);
            localStorage.setItem(SESSION_KEY, JSON.stringify(derived));
          }
        }
      }
    } catch {
      // ignore
    }

    async function loadUsers() {
      try {
        const res = await fetch('/api/inner-circle-auth', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok && Array.isArray(data.users)) {
          setUsers(data.users);
          if (!loginName && data.users[0]?.name) setLoginName(data.users[0].name);
        }
      } finally {
        setAuthLoading(false);
      }
    }

    loadUsers();
  }, []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const isAdmin = String(session?.role || '').toLowerCase() === 'admin';
  const isInnerCircleType = useMemo(() => String(form.appType || '').toLowerCase().includes('inner circle'), [form.appType]);
  const requiresContract = useMemo(() => {
    const t = String(form.appType || '').toLowerCase();
    return t.includes('sponsorship') || t.includes('bonus') || t.includes('inner circle');
  }, [form.appType]);
  const usesAnnualizedPremium = useMemo(() => isAnnualizedType(form.appType), [form.appType]);

  async function loadContractLinkInfo(email = '') {
    const em = String(email || '').trim().toLowerCase();
    if (!em) {
      setContractLinkInfo({ loading: false, sentAt: '', requestedByName: '' });
      return;
    }

    setContractLinkInfo((s) => ({ ...s, loading: true }));
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

  async function checkContractSignature(email = '', applicantName = '') {
    const em = String(email || '').trim().toLowerCase();
    const nm = String(applicantName || '').trim();
    if (!em && !nm) {
      setContractStatus({ loading: false, checkedEmail: '', signed: false, signedAt: '' });
      return;
    }

    setContractStatus((s) => ({ ...s, loading: true, checkedEmail: em || nm }));
    try {
      const qs = new URLSearchParams();
      if (em) qs.set('email', em);
      if (nm) qs.set('name', nm);
      const res = await fetch(`/api/contract-signatures?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setContractStatus({ loading: false, checkedEmail: em || nm, signed: false, signedAt: '' });
        setContractLastCheckedAt(new Date().toISOString());
        return;
      }
      setContractStatus({
        loading: false,
        checkedEmail: em || nm,
        signed: Boolean(data?.signed),
        signedAt: data?.row?.signedAt || ''
      });
      setContractLastCheckedAt(new Date().toISOString());
    } catch {
      setContractStatus({ loading: false, checkedEmail: em || nm, signed: false, signedAt: '' });
      setContractLastCheckedAt(new Date().toISOString());
    }
  }

  useEffect(() => {
    if (!prefill || prefillApplied) return;
    const mappedReferrer = mapReferrerToUser(prefill.referredByNameRaw, users, prefill.refCode);
    const mappedWriter = mapReferrerToUser(prefill.policyWriterNameRaw, users, prefill.refCode);

    setForm((prev) => ({
      ...prev,
      appType: prefill.appType || prev.appType,
      applicantName: prefill.applicantName || prev.applicantName,
      applicantEmail: prefill.applicantEmail || prev.applicantEmail,
      applicantPhone: formatPhoneInput(prefill.applicantPhone) || prev.applicantPhone,
      applicantLicensedStatus: prefill.applicantLicensedStatus || prev.applicantLicensedStatus,
      state: prefill.state || prev.state,
      referredByName: mappedReferrer
        ? mappedReferrer
        : (prefill.referredByNameRaw ? 'Other' : prev.referredByName),
      referredByOtherName: mappedReferrer
        ? ''
        : (prefill.referredByNameRaw || prev.referredByOtherName),
      policyWriterName: mappedWriter || prefill.policyWriterNameRaw || prev.policyWriterName,
      policyNumber: prefill.policyNumber || prev.policyNumber,
      monthlyPremium: prefill.monthlyPremium || prev.monthlyPremium,
      carrier: prefill.carrier || prev.carrier,
      productName: prefill.productName || prev.productName
    }));
    setPrefillApplied(true);
  }, [prefill, prefillApplied, users]);

  // Default writer/referrer to signed-in submitter when opening from own back office.
  useEffect(() => {
    const me = String(session?.name || '').trim();
    if (!me) return;

    setForm((prev) => {
      const next = { ...prev };
      let changed = false;

      if (!String(prev.referredByName || '').trim()) {
        next.referredByName = me;
        changed = true;
      }

      if (!String(prev.policyWriterName || '').trim()) {
        next.policyWriterName = me;
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [session?.name]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!requiresContract) {
        setContractStatus({ loading: false, checkedEmail: '', signed: true, signedAt: '' });
        setContractLinkInfo({ loading: false, sentAt: '', requestedByName: '' });
        return;
      }

      if (form.applicantEmail.trim() || form.applicantName.trim()) {
        checkContractSignature(form.applicantEmail, form.applicantName);
        if (form.applicantEmail.trim()) loadContractLinkInfo(form.applicantEmail);
      } else {
        setContractStatus({ loading: false, checkedEmail: '', signed: false, signedAt: '' });
        setContractLinkInfo({ loading: false, sentAt: '', requestedByName: '' });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [form.applicantEmail, form.applicantName, requiresContract]);

  useEffect(() => {
    if (!requiresContract) return;

    const email = String(form.applicantEmail || '').trim();
    const name = String(form.applicantName || '').trim();
    if ((!email && !name) || contractStatus.signed) return;

    const timer = setInterval(() => {
      checkContractSignature(email, name);
    }, 60 * 60 * 1000);

    return () => clearInterval(timer);
  }, [form.applicantEmail, form.applicantName, contractStatus.signed, requiresContract]);

  useEffect(() => {
    const prev = signedRef.current;
    if (!prev && contractStatus.signed && contractStatus.checkedEmail) {
      setShowSignedToast(true);
      const t = setTimeout(() => setShowSignedToast(false), 4500);
      signedRef.current = contractStatus.signed;
      return () => clearTimeout(t);
    }
    signedRef.current = contractStatus.signed;
  }, [contractStatus.signed, contractStatus.checkedEmail]);

  useEffect(() => {
    if (!isAdmin && isInnerCircleType) {
      update('appType', '');
      return;
    }
    if (!isAdmin) return;
    if (!isInnerCircleType) return;
    setAdminMarkedAppReceived(true);
  }, [isAdmin, isInnerCircleType]);

  const canSubmit = useMemo(() => {
    const referredByOk = form.referredByName === 'Other'
      ? form.referredByOtherName.trim()
      : form.referredByName.trim();

    const writerOk = form.policyWriterName === 'Other'
      ? form.policyWriterOtherName.trim()
      : form.policyWriterName.trim();

    const contractOk = !requiresContract || contractStatus.signed || (isAdmin && (adminBypassContractGate || adminMarkedAppReceived));
    const premiumOk = usesAnnualizedPremium
      ? (form.annualPremium !== '' || form.monthlyPremium !== '')
      : form.monthlyPremium !== '';

    return (
      form.appType.trim() &&
      form.applicantName.trim() &&
      form.applicantEmail.trim() &&
      (isInnerCircleType || form.applicantPhone.trim()) &&
      form.applicantLicensedStatus.trim() &&
      referredByOk &&
      writerOk &&
      form.state.trim() &&
      premiumOk &&
      contractOk
    );
  }, [form, requiresContract, contractStatus.signed, isAdmin, adminBypassContractGate, adminMarkedAppReceived, usesAnnualizedPremium, isInnerCircleType]);

  const canMarkSkipped = useMemo(() => {
    const referredByOk = form.referredByName === 'Other'
      ? form.referredByOtherName.trim()
      : form.referredByName.trim();

    const writerOk = form.policyWriterName === 'Other'
      ? form.policyWriterOtherName.trim()
      : form.policyWriterName.trim();

    return Boolean(
      session?.name &&
      form.applicantName.trim() &&
      form.applicantEmail.trim() &&
      form.applicantLicensedStatus.trim() &&
      referredByOk &&
      writerOk &&
      form.state.trim()
    );
  }, [session?.name, form]);

  const payoutPreview = useMemo(() => {
    return calcPreview(form.appType, form.monthlyPremium, form.annualPremium, form.applicantLicensedStatus, form.carrier, form.productName);
  }, [form.appType, form.monthlyPremium, form.annualPremium, form.applicantLicensedStatus, form.carrier, form.productName]);

  const [animatedPreview, setAnimatedPreview] = useState({
    annualPremium: 0,
    commissionRate: 0,
    pointsEarned: 0,
    advancePayout: 0,
    remainingBalance: 0,
    month10Payout: 0,
    month11Payout: 0,
    month12Payout: 0
  });

  useEffect(() => {
    const to = { ...payoutPreview };

    if (
      typeof window === 'undefined'
      || typeof window.requestAnimationFrame !== 'function'
      || !window.performance
    ) {
      setAnimatedPreview(to);
      return;
    }

    const start = window.performance.now();
    const duration = 420;
    const from = { ...animatedPreview };

    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = {
        annualPremium: from.annualPremium + (to.annualPremium - from.annualPremium) * eased,
        commissionRate: from.commissionRate + (to.commissionRate - from.commissionRate) * eased,
        pointsEarned: from.pointsEarned + (to.pointsEarned - from.pointsEarned) * eased,
        advancePayout: from.advancePayout + (to.advancePayout - from.advancePayout) * eased,
        remainingBalance: from.remainingBalance + (to.remainingBalance - from.remainingBalance) * eased,
        month10Payout: from.month10Payout + (to.month10Payout - from.month10Payout) * eased,
        month11Payout: from.month11Payout + (to.month11Payout - from.month11Payout) * eased,
        month12Payout: from.month12Payout + (to.month12Payout - from.month12Payout) * eased
      };
      setAnimatedPreview(next);
      if (t < 1) raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payoutPreview.annualPremium, payoutPreview.commissionRate, payoutPreview.pointsEarned, payoutPreview.advancePayout, payoutPreview.remainingBalance, payoutPreview.month10Payout, payoutPreview.month11Payout, payoutPreview.month12Payout]);

  async function sendAgreementLinkEmail() {
    const applicantName = String(form.applicantName || '').trim();
    const applicantEmail = String(form.applicantEmail || '').trim();
    if (!applicantName || !applicantEmail) {
      setContractEmailMsg('Please enter applicant name and email first.');
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
          applicantPhone: form.applicantPhone,
          applicantState: form.state,
          requestedByName: session?.name || '',
          requestedByEmail: session?.email || ''
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setContractEmailMsg(`Could not send agreement email: ${data?.error || 'unknown_error'}`);
        return;
      }
      const sentAt = data?.sentAt || new Date().toISOString();
      setContractLinkInfo({ loading: false, sentAt, requestedByName: session?.name || '' });
      setContractEmailMsg('Agreement email sent successfully.');
    } catch {
      setContractEmailMsg('Could not send agreement email right now.');
    } finally {
      setContractEmailBusy(false);
    }
  }

  async function adminMarkSigned() {
    if (!isAdmin) return;
    const applicantEmail = String(form.applicantEmail || '').trim();
    const applicantName = String(form.applicantName || '').trim();
    if (!applicantEmail || !applicantName) {
      setContractEmailMsg('Add applicant name and email first.');
      return;
    }

    setContractEmailBusy(true);
    setContractEmailMsg('');
    try {
      const res = await fetch('/api/contract-signatures/admin-mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorName: session?.name || '',
          applicantEmail,
          applicantName
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setContractEmailMsg(`Could not mark signed: ${data?.error || 'unknown_error'}`);
        return;
      }
      setContractEmailMsg('Marked as signed by admin.');
      await checkContractSignature(applicantEmail);
    } catch {
      setContractEmailMsg('Could not mark signed right now.');
    } finally {
      setContractEmailBusy(false);
    }
  }

  async function markSkippedApp() {
    if (!canMarkSkipped || !session?.name || skipBusy) return;

    const effectiveReferredBy = form.referredByName === 'Other'
      ? form.referredByOtherName.trim()
      : form.referredByName;

    const effectivePolicyWriter = form.policyWriterName === 'Other'
      ? form.policyWriterOtherName.trim()
      : form.policyWriterName;

    setSkipBusy(true);
    setSaved('');
    try {
      const payload = {
        mode: 'skip_onboarding',
        record: {
          applicantName: form.applicantName,
          applicantEmail: form.applicantEmail,
          applicantPhone: form.applicantPhone,
          applicantLicensedStatus: form.applicantLicensedStatus,
          referredByName: effectiveReferredBy,
          policyWriterName: effectivePolicyWriter,
          state: form.state,
          submittedBy: session.name,
          submittedByRole: session.role || 'submitter',
          note: 'Marked as skipped in app submit flow. No production credit; onboarding credentials sent.'
        }
      };

      const res = await fetch('/api/policy-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setSaved(`Could not mark skipped: ${data?.error || 'unknown_error'}`);
        return;
      }

      setSaved('Applicant marked as skipped. No production credit added. Welcome + credentials flow triggered.');
      setForm((prev) => ({
        ...prev,
        appType: '',
        policyNumber: '',
        monthlyPremium: '',
        annualPremium: ''
      }));
    } catch {
      setSaved('Could not mark skipped right now. Please retry.');
    } finally {
      setSkipBusy(false);
    }
  }

  async function login(e) {
    e.preventDefault();
    setLoginError('');
    setLoginBusy(true);
    try {
      const res = await fetch('/api/inner-circle-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: loginName, password: loginPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.user) {
        setLoginError('Invalid login. Please check your password.');
        return;
      }

      setSession(data.user);
      localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
      setLoginPassword('');
    } catch {
      setLoginError('Login failed. Please retry.');
    } finally {
      setLoginBusy(false);
    }
  }

  function logout() {
    setSession(null);
    if (typeof window !== 'undefined') localStorage.removeItem(SESSION_KEY);
  }

  function continueWithoutPassword() {
    const chosen = (users || []).find((u) => String(u?.name || '') === String(loginName || ''));
    const fallbackName = String(loginName || '').trim();
    const derived = {
      name: String(chosen?.name || fallbackName || 'Inner Circle Member').trim(),
      role: String(chosen?.role || 'submitter').trim() || 'submitter',
      source: 'no_password_access'
    };
    setSession(derived);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(derived)); } catch {}
    }
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || !session?.name) return;

    const effectiveReferredBy = form.referredByName === 'Other'
      ? form.referredByOtherName.trim()
      : form.referredByName;

    const effectivePolicyWriter = form.policyWriterName === 'Other'
      ? form.policyWriterOtherName.trim()
      : form.policyWriterName;

    const autoApproveFromFng = String(prefill?.source || '').toLowerCase().startsWith('fng-');
    const record = {
      id: prefill?.existingSubmissionId || `app_${Date.now()}`,
      ...form,
      status: autoApproveFromFng ? 'Approved' : (form.status || 'Submitted'),
      referredByName: effectiveReferredBy,
      policyWriterName: effectivePolicyWriter,
      carrier: form.carrier,
      productName: form.productName,
      submittedBy: session.name,
      submittedByRole: session.role || 'submitter',
      refCode: ref,
      submittedAt: new Date().toISOString(),
      payoutStatus: 'Unpaid',
      payoutAmount: 0,
      contractRequired: requiresContract,
      contractSignedAt: requiresContract ? (contractStatus.signedAt || '') : '',
      contractSignatureVerified: requiresContract ? Boolean(contractStatus.signed || (isAdmin && adminMarkedAppReceived)) : true,
      contractGateBypassedByAdmin: requiresContract ? Boolean(isAdmin && adminBypassContractGate && !contractStatus.signed) : false,
      applicationReceivedByAdmin: Boolean(isAdmin && adminMarkedAppReceived),
      applicationReceivedMarkedBy: Boolean(isAdmin && adminMarkedAppReceived) ? String(session?.name || '') : '',
      applicationReceivedMarkedAt: Boolean(isAdmin && adminMarkedAppReceived) ? new Date().toISOString() : '',
      approvedAt: autoApproveFromFng ? new Date().toISOString() : ''
    };

    if (typeof window !== 'undefined') {
      let list = [];
      try {
        list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      } catch {
        list = [];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...list]));
    }

    try {
      await fetch('/api/policy-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'upsert', record })
      });
    } catch {
      // non-blocking: keep local backup
    }

    setSaved(autoApproveFromFng ? 'Application submitted and auto-approved from F&G Book of Business.' : 'Application submitted successfully.');
    setForm({
      appType: '',
      applicantName: '',
      applicantEmail: '',
      applicantPhone: '',
      applicantLicensedStatus: '',
      referredByName: '',
      referredByOtherName: '',
      policyWriterName: '',
      policyWriterOtherName: '',
      state: '',
      policyNumber: '',
      monthlyPremium: '',
      annualPremium: '',
      productKey: DEFAULT_PRODUCT.key,
      carrier: DEFAULT_PRODUCT.carrier,
      productName: DEFAULT_PRODUCT.productName,
      status: 'Submitted'
    });
    setAdminBypassContractGate(false);
    setAdminMarkedAppReceived(false);
  };

  if (authLoading) {
    return (
      <main className="publicPage">
        <div className="panel" style={{ maxWidth: 480 }}>
          <h3 style={{ marginTop: 0 }}>Loading...</h3>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="publicPage">
        <div className="panel" style={{ maxWidth: 480 }}>
          <h3 style={{ marginTop: 0 }}>Inner Circle Login</h3>
          <p className="muted" style={{ marginTop: -2 }}>Use your individual password to access policy submission.</p>

          <form className="settingsGrid" onSubmit={login}>
            <label>
              Name
              <select value={loginName} onChange={(e) => setLoginName(e.target.value)}>
                {users.map((u) => (
                  <option key={u.name} value={u.name}>{u.name}</option>
                ))}
              </select>
            </label>
            <label>
              Password
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            </label>
            <div className="rowActions" style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" disabled={loginBusy}>{loginBusy ? 'Signing in...' : 'Sign In'}</button>
              <button type="button" className="ghost" onClick={continueWithoutPassword}>Continue (No Password)</button>
            </div>
            <p className="muted" style={{ gridColumn: '1 / -1', marginTop: -4 }}>Inner Circle can continue without password if needed. Use Sign In when password access is working.</p>
            {loginError ? <p className="red">{loginError}</p> : null}
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="publicPage" style={{ background: 'radial-gradient(circle at top,#17120a 0%,#0b1020 42%, #05070f 100%)', minHeight: '100vh' }}>
      {showSignedToast ? (
        <div
          style={{
            position: 'fixed',
            right: 16,
            top: 16,
            zIndex: 70,
            background: '#16a34a',
            color: '#ffffff',
            padding: '10px 14px',
            borderRadius: 10,
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            fontWeight: 600
          }}
        >
          ✅ Contract signed — you can submit the application now.
        </div>
      ) : null}
      <div className="panel" style={{ maxWidth: 960, border: '1px solid #5f4a23', background: 'linear-gradient(180deg,#0f172a 0%, #0b1020 100%)', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 4, color: '#fff' }}>Policy Details</h3>
            <p className="muted" style={{ margin: 0, color: '#cbd5e1' }}>Signed in as {session.name}</p>
          </div>
          <button type="button" className="ghost" onClick={logout}>Log Out</button>
        </div>
        {ref ? <p className="pill onpace">Referral code locked: {ref}</p> : null}
        {prefill ? <p className="pill">Prefilled from booked call — review and complete remaining fields.</p> : null}
        <div style={{ border: '1px solid #5f4a23', borderRadius: 12, padding: 14, background: 'linear-gradient(135deg,#1f2937 0%,#0b1020 55%,#111827 100%)', marginBottom: 12 }}>
          <strong style={{ color: '#f8fafc', fontSize: 24 }}>Inner Circle Policy Points + Payout Logic</strong>
          <p className="muted" style={{ margin: '8px 0 0', color: '#d1d5db', fontSize: 18, lineHeight: 1.45 }}>
            Every policy type has its own point value and payout formula. Sponsorship and Bonus Policies use fixed points. Regular and Juvenile Policies use annual premium multiplied by the Inner Circle commission rate, with 75% paid upfront and the remaining balance paid in months 10, 11, and 12.
          </p>
        </div>

        <div className="policyDesktopWrap">
        <form id="policySubmitForm" className="settingsGrid premiumPolicyForm" onSubmit={submit}>
          <label>
            Application Type *
            <select value={form.appType} onChange={(e) => update('appType', e.target.value)}>
              <option value="">Select application type</option>
              <option value="Sponsorship App">Sponsorship App</option>
              <option value="Bonus Policy">Bonus Policy</option>
              {isAdmin ? <option value="Inner Circle App">Inner Circle App</option> : null}
              <option value="Regular App">Regular App</option>
              <option value="Juvenile App">Juvenile App</option>
            </select>
            {form.appType ? (
              <small style={{ marginTop: 6, display: 'inline-flex' }} className={requiresContract ? 'pill atrisk' : 'pill onpace'}>
                {requiresContract ? 'Contract Required' : 'No Contract Required'}
              </small>
            ) : null}
          </label>

          <div style={{ gridColumn: '1 / -1', border: '1px solid #5f4a23', borderRadius: 14, padding: 14, background: 'linear-gradient(180deg,#020b22 0%,#020617 100%)' }}>
            <div className="panelRow" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: '#fff', fontSize: 30 }}>Live Calculation Preview</strong>
              {form.appType ? <span className="pill">{form.appType}</span> : <span className="pill offpace">Select app type</span>}
            </div>
            <div className="premiumPreviewGrid" style={{ display: 'grid', gap: 10, marginTop: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
              <div><small className="muted">💼 Annual Premium</small><div style={{ color: '#fff', fontWeight: 800 }}>${animatedPreview.annualPremium.toFixed(2)}</div></div>
              <div><small className="muted">📊 Commission Rate</small><div style={{ color: '#fff', fontWeight: 800 }}>{Math.round((animatedPreview.commissionRate || 0) * 100)}%</div></div>
              <div><small className="muted">⭐ Points Earned</small><div style={{ color: '#fff', fontWeight: 800 }}>{animatedPreview.pointsEarned.toFixed(2)}</div></div>
              <div><small className="muted">💸 Advance Payout (75%)</small><div style={{ color: '#86efac', fontWeight: 800 }}>${animatedPreview.advancePayout.toFixed(2)}</div></div>
              <div><small className="muted">🧾 Remaining Balance</small><div style={{ color: '#fff', fontWeight: 800 }}>${animatedPreview.remainingBalance.toFixed(2)}</div></div>
              <div><small className="muted">📅 Month 10</small><div style={{ color: '#cbd5e1', fontWeight: 700 }}>${animatedPreview.month10Payout.toFixed(2)}</div></div>
              <div><small className="muted">📅 Month 11</small><div style={{ color: '#cbd5e1', fontWeight: 700 }}>${animatedPreview.month11Payout.toFixed(2)}</div></div>
              <div><small className="muted">📅 Month 12</small><div style={{ color: '#cbd5e1', fontWeight: 700 }}>${animatedPreview.month12Payout.toFixed(2)}</div></div>
            </div>
            {payoutPreview.flatPayout ? (
              <small style={{ color: '#86efac', display: 'block', marginTop: 8 }}>
                {form.appType === 'Inner Circle App'
                  ? `Inner Circle flat-rate based on product: ${String(form.carrier || '').toLowerCase().includes('national life') || String(form.productName || '').toLowerCase().includes('flex life') ? '1,200 points (NLG Flex Life)' : '500 points (F&G Pathsetter)'} on approval (no Month 10/11/12 backend payout).`
                  : 'Flat-rate payout: 100% paid upfront. No Month 10/11/12 backend payout.'}
              </small>
            ) : null}
            {form.appType === 'Bonus Policy' && !payoutPreview.bonusEligible ? (
              <small style={{ color: '#fca5a5', display: 'block', marginTop: 8 }}>Bonus Policy rule: applicant must be licensed to earn 500 points.</small>
            ) : null}
            {usesAnnualizedPremium ? (
              <small style={{ color: '#93c5fd', display: 'block', marginTop: 8 }}>
                {payoutPreview.annualizedInputUsed ? 'Using Annualized Premium (AP) for commission math.' : 'Tip: add Annualized Premium (AP) to calculate commission accurately for regular/juvenile apps.'}
              </small>
            ) : null}
            <small style={{ color: '#9CA3AF', display: 'block', marginTop: 8 }}>
              Points/payout are pending on submission and only post after status is Approved.
            </small>
          </div>

          <label>
            Client Name *
            <input
              value={form.applicantName}
              onChange={(e) => update('applicantName', e.target.value)}
              placeholder="Enter client's full name"
            />
          </label>

          <label>
            Applicant Email *
            <input
              type="email"
              value={form.applicantEmail}
              onChange={(e) => update('applicantEmail', e.target.value)}
              placeholder="applicant@email.com"
            />
          </label>

          {isInnerCircleType ? (
            <label>
              Inner Circle Member *
              <select
                value={users.find((u) => String(u?.email || '').toLowerCase() === String(form.applicantEmail || '').toLowerCase())?.email || ''}
                onChange={(e) => {
                  const selected = users.find((u) => String(u?.email || '').toLowerCase() === String(e.target.value || '').toLowerCase());
                  if (!selected) return;
                  setForm((prev) => ({
                    ...prev,
                    applicantName: selected.name || prev.applicantName,
                    applicantEmail: selected.email || prev.applicantEmail,
                    referredByName: prev.referredByName || selected.name || ''
                  }));
                }}
              >
                <option value="">Select inner circle member</option>
                {users.map((u) => (
                  <option key={`member-${u.email || u.name}`} value={u.email || ''}>{u.name} {u.email ? `(${u.email})` : ''}</option>
                ))}
              </select>
            </label>
          ) : null}

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {!requiresContract ? (
              <span className="pill onpace">No ICA required for this policy type.</span>
            ) : (
              <>
                {contractStatus.loading ? <span className="pill">Checking contract signature…</span> : null}
                {!contractStatus.loading && form.applicantEmail && contractStatus.signed ? (
                  <span className="pill onpace">Contract Signed ✅ {contractStatus.signedAt ? `(${new Date(contractStatus.signedAt).toLocaleDateString()})` : ''}</span>
                ) : null}
                {!contractStatus.loading && form.applicantEmail && !contractStatus.signed ? (
                  <>
                    <span className="pill atrisk">Contract Required Before Submit</span>
                    <button type="button" className="ghost" onClick={sendAgreementLinkEmail} disabled={contractEmailBusy}>
                      {contractEmailBusy ? 'Sending Agreement…' : 'Send Agreement Link to Applicant'}
                    </button>
                    <button type="button" className="ghost" onClick={() => checkContractSignature(form.applicantEmail)}>
                      Refresh Signature Status
                    </button>
                    {isAdmin ? (
                      <>
                        <button type="button" className="ghost" onClick={adminMarkSigned} disabled={contractEmailBusy}>
                          Mark Signed (Admin)
                        </button>
                        {isInnerCircleType ? (
                          <button type="button" className="ghost" onClick={() => setAdminMarkedAppReceived(true)}>
                            Quick Action: Mark Received (Inner Circle)
                          </button>
                        ) : null}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="checkbox"
                            checked={adminMarkedAppReceived}
                            onChange={(e) => setAdminMarkedAppReceived(e.target.checked)}
                          />
                          Admin: I already received this signed application
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="checkbox"
                            checked={adminBypassContractGate}
                            onChange={(e) => setAdminBypassContractGate(e.target.checked)}
                          />
                          Admin override: submit without contract
                        </label>
                      </>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </div>
          {requiresContract && contractEmailMsg ? <small className="muted" style={{ gridColumn: '1 / -1' }}>{contractEmailMsg}</small> : null}
          {requiresContract && contractLinkInfo.sentAt ? (
            <small className="muted" style={{ gridColumn: '1 / -1' }}>
              Agreement link last sent: {new Date(contractLinkInfo.sentAt).toLocaleString()}
              {contractLinkInfo.requestedByName ? ` by ${contractLinkInfo.requestedByName}` : ''}
            </small>
          ) : null}
          {requiresContract && contractLastCheckedAt ? (
            <small className="muted" style={{ gridColumn: '1 / -1' }}>
              Signature status last checked: {new Date(contractLastCheckedAt).toLocaleString()}
            </small>
          ) : null}
          {requiresContract && isAdmin && (adminBypassContractGate || adminMarkedAppReceived) ? (
            <small className="muted" style={{ gridColumn: '1 / -1', color: '#92400e' }}>
              Admin override active for this submission.
            </small>
          ) : null}

          <label>
            Applicant Phone {isInnerCircleType ? '(optional)' : '*'}
            <input
              value={form.applicantPhone}
              onChange={(e) => update('applicantPhone', formatPhoneInput(e.target.value))}
              placeholder="(555) 555-5555"
            />
          </label>

          <label>
            Licensed? *
            <select value={form.applicantLicensedStatus} onChange={(e) => update('applicantLicensedStatus', e.target.value)}>
              <option value="">Select status</option>
              <option value="Licensed">Licensed</option>
              <option value="Unlicensed">Unlicensed</option>
            </select>
          </label>

          <label>
            Referred By *
            <select value={form.referredByName} onChange={(e) => {
              const value = e.target.value;
              setForm((prev) => ({
                ...prev,
                referredByName: value,
                referredByOtherName: value === 'Other' ? prev.referredByOtherName : ''
              }));
            }}>
              <option value="">Select inner circle agent</option>
              {users.map((u) => (
                <option key={`ref-${u.name}`} value={u.name}>{u.name}</option>
              ))}
              <option value="Other">Other</option>
            </select>
          </label>

          {form.referredByName === 'Other' ? (
            <label>
              Referred By Full Name *
              <input
                value={form.referredByOtherName}
                onChange={(e) => update('referredByOtherName', e.target.value)}
                placeholder="Enter full name"
              />
            </label>
          ) : null}

          <label>
            Policy Written By *
            <select value={form.policyWriterName} onChange={(e) => update('policyWriterName', e.target.value)}>
              <option value="">Select policy writer</option>
              {users.map((u) => (
                <option key={`writer-${u.name}`} value={u.name}>{u.name}</option>
              ))}
              <option value="Other">Other</option>
            </select>
          </label>

          {form.policyWriterName === 'Other' ? (
            <label>
              Policy Writer Full Name *
              <input
                value={form.policyWriterOtherName}
                onChange={(e) => update('policyWriterOtherName', e.target.value)}
                placeholder="Enter full name"
              />
            </label>
          ) : null}

          <label>
            State *
            <input
              value={form.state}
              onChange={(e) => update('state', e.target.value.toUpperCase())}
              placeholder="e.g., FL"
              maxLength={2}
            />
          </label>

          <label>
            Product *
            <select
              value={form.productKey || DEFAULT_PRODUCT.key}
              onChange={(e) => {
                const next = productByKey(e.target.value);
                setForm((prev) => ({
                  ...prev,
                  productKey: next.key,
                  carrier: next.carrier,
                  productName: next.productName
                }));
              }}
            >
              {PRODUCT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label>
            Carrier *
            <input value={form.carrier || DEFAULT_PRODUCT.carrier} disabled readOnly />
          </label>

          <label>
            Policy Number (Optional)
            <input
              value={form.policyNumber}
              onChange={(e) => update('policyNumber', e.target.value)}
              placeholder="Enter policy number if available"
            />
          </label>

          <label>
            Monthly Premium {usesAnnualizedPremium ? '(optional)' : '*'}
            <input
              type="number"
              min="0"
              max="5000"
              step="0.01"
              value={form.monthlyPremium}
              onChange={(e) => update('monthlyPremium', normalizePremiumInput(e.target.value))}
              onBlur={() => {
                const n = Number(form.monthlyPremium || 0);
                if (!Number.isNaN(n) && form.monthlyPremium !== '') {
                  update('monthlyPremium', Math.min(5000, n).toFixed(2));
                }
              }}
              placeholder="0.00"
            />
          </label>

          {usesAnnualizedPremium ? (
            <label>
              Annualized Premium (AP) *
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.annualPremium}
                onChange={(e) => update('annualPremium', e.target.value)}
                placeholder="Enter AP used for commission"
              />
            </label>
          ) : null}

          <div className="rowActions" style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="submit" disabled={!canSubmit}>Submit Application</button>
            <button type="button" className="ghost" onClick={markSkippedApp} disabled={!canMarkSkipped || skipBusy}>
              {skipBusy ? 'Saving Skip…' : 'Applicant Skipped App (No Credit)'}
            </button>
            {requiresContract && !contractStatus.signed && !(isAdmin && (adminBypassContractGate || adminMarkedAppReceived)) ? <small className="muted">Signature gate: applicant must complete ICA before submit.</small> : null}
            <small className="muted">Skip action still triggers onboarding credentials + welcome flow.</small>
          </div>
        </form>

        <aside className="policySidebar" aria-label="Summary and submit">
          <div className="policySidebarCard">
            <strong style={{ color: '#fff', fontSize: 18 }}>Submission Summary</strong>
            <div className="policySidebarList">
              <div><small className="muted">Application Type</small><div style={{ color: '#f8fafc', fontWeight: 700 }}>{form.appType || '—'}</div></div>
              <div><small className="muted">Policy Writer</small><div style={{ color: '#f8fafc', fontWeight: 700 }}>{form.policyWriterName === 'Other' ? (form.policyWriterOtherName || '—') : (form.policyWriterName || '—')}</div></div>
              <div><small className="muted">Product</small><div style={{ color: '#f8fafc', fontWeight: 700 }}>{form.productName || '—'}</div></div>
              <div><small className="muted">Carrier</small><div style={{ color: '#f8fafc', fontWeight: 700 }}>{form.carrier || '—'}</div></div>
              <div><small className="muted">Referred By</small><div style={{ color: '#f8fafc', fontWeight: 700 }}>{form.referredByName === 'Other' ? (form.referredByOtherName || '—') : (form.referredByName || '—')}</div></div>
              <div><small className="muted">Monthly Premium</small><div style={{ color: '#f8fafc', fontWeight: 700 }}>${Number(form.monthlyPremium || 0).toFixed(2)}</div></div>
              {usesAnnualizedPremium ? <div><small className="muted">Annualized Premium (AP)</small><div style={{ color: '#f8fafc', fontWeight: 700 }}>${Number(form.annualPremium || 0).toFixed(2)}</div></div> : null}
              <div><small className="muted">Points Earned</small><div style={{ color: '#f8fafc', fontWeight: 700 }}>{animatedPreview.pointsEarned.toFixed(2)}</div></div>
              <div><small className="muted">Advance Payout</small><div style={{ color: '#86efac', fontWeight: 800 }}>${animatedPreview.advancePayout.toFixed(2)}</div></div>
            </div>
            <div style={{ marginTop: 10 }}>
              {contractStatus.signed || (isAdmin && adminMarkedAppReceived)
                ? <span className="pill onpace">Contract/Received ✅</span>
                : <span className="pill atrisk">Contract Required</span>}
            </div>
            <button type="submit" form="policySubmitForm" className="publicPrimaryBtn" disabled={!canSubmit} style={{ width: '100%', marginTop: 12 }}>
              Submit Application
            </button>
            <button type="button" className="ghost" onClick={markSkippedApp} disabled={!canMarkSkipped || skipBusy} style={{ width: '100%', marginTop: 8 }}>
              {skipBusy ? 'Saving Skip…' : 'Applicant Skipped App (No Credit)'}
            </button>
          </div>
        </aside>
        </div>

        {saved ? <p className="green">{saved}</p> : null}
      </div>
      <style jsx global>{`
        .premiumPolicyForm label {
          color: #f1f5f9;
          font-weight: 700;
        }
        .premiumPolicyForm input,
        .premiumPolicyForm select {
          background: #0f172a;
          color: #f8fafc;
          border: 1px solid #475569;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 16px;
        }
        .premiumPolicyForm input::placeholder {
          color: #94a3b8;
        }
        .premiumPolicyForm input:focus,
        .premiumPolicyForm select:focus {
          outline: none;
          border-color: #c8a96b;
          box-shadow: 0 0 0 2px rgba(200,169,107,.25);
        }
        .premiumPreviewGrid > div {
          border: 1px solid #334155;
          border-radius: 10px;
          background: #0b1220;
          padding: 10px;
          transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
        }
        .premiumPreviewGrid > div:hover {
          transform: translateY(-2px);
          border-color: #c8a96b;
          box-shadow: 0 10px 22px rgba(0,0,0,.28);
        }
        .premiumPreviewGrid .muted,
        .premiumPreviewGrid small {
          color: #cbd5e1 !important;
          font-size: 13px;
        }
        .premiumPolicyForm .rowActions button,
        .premiumPolicyForm .publicPrimaryBtn {
          background: linear-gradient(135deg, #c8a96b 0%, #a78647 100%) !important;
          color: #0b1020 !important;
          border: 1px solid #d6bd8d !important;
          font-weight: 800;
          border-radius: 10px;
          transition: transform .18s ease, filter .18s ease;
        }
        .premiumPolicyForm .rowActions button:hover,
        .premiumPolicyForm .publicPrimaryBtn:hover {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }
        .policyDesktopWrap {
          display: grid;
          grid-template-columns: 1.55fr .85fr;
          gap: 12px;
          align-items: start;
        }
        .policySidebar {
          position: sticky;
          top: 14px;
        }
        .policySidebarCard {
          border: 1px solid #5f4a23;
          border-radius: 12px;
          background: linear-gradient(180deg,#020b22 0%,#0b1020 100%);
          padding: 12px;
          transition: box-shadow .2s ease, border-color .2s ease;
        }
        .policySidebarCard:hover {
          border-color: #c8a96b;
          box-shadow: 0 14px 30px rgba(0,0,0,.32);
        }
        .policySidebarList {
          display: grid;
          gap: 8px;
          margin-top: 10px;
        }
        @media (max-width: 960px) {
          .policyDesktopWrap {
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .policySidebar {
            position: static;
          }
          .premiumPolicyForm label {
            font-size: 14px;
          }
          .premiumPolicyForm input,
          .premiumPolicyForm select {
            font-size: 15px;
            padding: 10px;
          }
          .premiumPreviewGrid {
            grid-template-columns: repeat(2,minmax(140px,1fr)) !important;
          }
        }
      `}</style>
    </main>
  );
}
