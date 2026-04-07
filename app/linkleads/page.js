'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const CONTACT = {
  phone: '201-862-7040',
  email: 'Support@thelegacylink.com',
  address: '340 Old River Road, Edgewater NJ 07020'
};

const LINK_PILLARS = [
  { key: 'L', title: 'Live-Intent', desc: 'Prospects actively shopping for coverage and ready to speak.' },
  { key: 'I', title: 'Instant Delivery', desc: 'Leads delivered in real-time so your team can move first.' },
  { key: 'N', title: 'Nurture-Ready', desc: 'Lead data structured for immediate script and follow-up execution.' },
  { key: 'K', title: 'Knowledge-Backed', desc: 'Campaigns optimized for insurance outcomes and compliant outreach.' }
];

const LEAD_TYPES = [
  {
    name: 'Veterans Leads',
    price: '$22–$54',
    subtitle: 'Military veterans seeking coverage',
    icon: '🪖',
    bullets: ['Ages 25–75+', 'VA benefit positioning', 'High-intent social + search traffic']
  },
  {
    name: 'Final Expense Leads',
    price: '$16–$29',
    subtitle: 'Affordable life insurance prospects',
    icon: '🛡️',
    bullets: ['Ages 50–65+', 'Fast dial-cycle fit', 'Built for consistent volume']
  },
  {
    name: 'IUL Leads',
    price: '$28–$49',
    subtitle: 'Tax-free retirement + infinite banking',
    icon: '📈',
    bullets: ['Ages 25–65+', 'Premium-ready profile', 'Retirement-focused messaging']
  },
  {
    name: 'Mortgage Protection',
    price: '$30–$58',
    subtitle: 'Homeowner family protection opportunities',
    icon: '🏠',
    bullets: ['Ages 30–65+', 'Term/IUL fit', 'Strong protection intent']
  },
  {
    name: 'Spanish Leads',
    price: '$36–$50',
    subtitle: 'Bilingual Hispanic-market campaigns',
    icon: '🌎',
    bullets: ['Spanish-speaking prospects', 'Cultural relevance', 'Ages 25–65+']
  },
  {
    name: 'Trucker Leads',
    price: '$36–$67',
    subtitle: 'Commercial driver targeting',
    icon: '🚛',
    bullets: ['CDL/commercial niche', 'High family-protection need', 'Ages 25–65+']
  },
  {
    name: 'Health Leads (Under 65)',
    price: '$42',
    subtitle: 'Under-65 health insurance market',
    icon: '🏥',
    bullets: ['Cost-conscious buyers', 'Rapid campaign delivery', 'Strong call-through intent']
  }
];

const AGED_LEADS = [
  { name: 'Final Expense', price: '$5' },
  { name: 'IUL', price: '$8.40' },
  { name: 'Veterans', price: '$8.40' },
  { name: 'Mortgage Protection', price: '$8.40' },
  { name: 'Spanish', price: '$8.40' },
  { name: 'Trucker', price: '$8.40' },
  { name: 'Health', price: '$7.20' }
];

const SESSION_KEY = 'legacy_lead_marketplace_user_v1';
const HUB_SESSION_KEY = 'inner_circle_hub_member_v1';
const SETUP_PROFILE_KEY = 'linkleads_setup_profile_v1';
const SETUP_PROFILE_MAP_KEY = 'linkleads_setup_profiles_by_email_v1';
const LAST_ORDER_INTENT_KEY = 'linkleads_last_order_intent_v1';
const WEEKLY_SUBSCRIPTION_DISCOUNT_PCT = 12;

const ORDER_MENU = [
  { key: 'veterans', label: 'Veterans Leads', unitPrice: 31.5, minQty: 20 },
  { key: 'final-expense', label: 'Final Expense Leads', unitPrice: 20.7, minQty: 20 },
  { key: 'iul', label: 'IUL Leads', unitPrice: 34.2, minQty: 20 },
  { key: 'mortgage-protection', label: 'Mortgage Protection Leads', unitPrice: 38.1, minQty: 20 },
  { key: 'spanish', label: 'Spanish Leads', unitPrice: 38.1, minQty: 20 },
  { key: 'trucker', label: 'Trucker Leads', unitPrice: 45, minQty: 20 },
  { key: 'health-under-65', label: 'Health Leads (Under 65)', unitPrice: 42, minQty: 20 },
  { key: 'sponsor', label: 'Recruiting Leads', unitPrice: 31.25, minQty: 15 }
];

const LEAD_PACKAGE_PRICING = {
  veterans: { standard: 24, blended: 31.5, premium: 54 },
  'final-expense': { standard: 18, blended: 20.7, premium: 28.8 },
  iul: { standard: 30, blended: 34.2, premium: 49.2 },
  'mortgage-protection': { standard: 32.4, blended: 38.1, premium: 57.6 },
  spanish: { standard: 32.4, blended: 38.1, premium: 57.6 },
  trucker: { standard: 38.4, blended: 45, premium: 67.2 },
  'health-under-65': { standard: 42, blended: 42, premium: 42 },
  sponsor: { standard: 25, blended: 31.25, premium: 41 }
};

const TIME_ZONES = [
  '(GMT-08:00) Pacific Time (US & Canada)',
  '(GMT-07:00) Mountain Time (US & Canada)',
  '(GMT-06:00) Central Time (US & Canada)',
  '(GMT-05:00) Eastern Time (US & Canada)'
];

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','District Of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'
];

const US_STATE_CODE_BY_NAME = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE',
  'District Of Columbia': 'DC', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR',
  Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT',
  Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY'
};

const WEEK_DAYS = ['Mon', 'Tues', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LEAD_PACKAGES = [
  {
    key: 'standard',
    ribbon: 'LOWEST COST',
    title: 'Standard',
    accent: '#4f46e5',
    bullets: ['Basic contact info', 'Lead form generated', 'Quick delivery']
  },
  {
    key: 'blended',
    ribbon: 'MOST POPULAR',
    title: 'Blended',
    accent: '#dc2626',
    bullets: ['Mix of standard + premium data', 'Balanced quality', 'Stronger conversion potential']
  },
  {
    key: 'premium',
    ribbon: 'HIGHEST QUALITY',
    title: 'Premium',
    accent: '#16a34a',
    bullets: ['Complete demographics', 'Higher-intent details', 'Best conversion rates']
  }
];
const DAILY_CAP_OPTIONS = ['5', '10', '20', '30', '40', '50', '75', '100'];
const SETUP_STEPS = ['Personal Information', 'Business Information', 'Lead Defaults'];
const MARKET_FILTERS_KEY = 'linkleads_market_filters_saved_v1';
const MARKET_FILTER_DRAFT_KEY = 'linkleads_market_filters_draft_v1';
const MARKET_FILTER_DEFAULTS = {
  language: 'all',
  states: [],
  search: ''
};
const MARKET_TABS = [
  { key: 'inventory', label: 'Leads' },
  { key: 'orders', label: 'Lead Orders' },
  { key: 'scripts', label: 'Downloadable Scripts' }
];
const DOWNLOADABLE_SCRIPTS = [
  { key: 'iul-opener', name: 'IUL First Call Opener', type: 'Phone Script', level: 'Beginner', url: '/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf' },
  { key: 'fe-objection', name: 'Final Expense Objection Handling', type: 'Phone Script', level: 'Intermediate', url: '/docs/onboarding/legacy-link-unlicensed-onboarding-playbook.pdf' },
  { key: 'sponsor-followup', name: 'Sponsorship Follow-Up Sequence', type: 'SMS + Call', level: 'Advanced', url: '/docs/onboarding/legacy-link-licensed-onboarding-playbook.pdf' }
];

const TEST_PROFILE_SEEDS = {
  'info@thelegacylink.com': {
    firstName: 'Legacy',
    lastName: 'Link Test',
    phone: '(201) 862-7040',
    timeZone: 'America/New_York',
    title: 'Licensed Agent',
    imoAgency: 'The Legacy Link',
    licensedStates: ['New Jersey', 'New York', 'Pennsylvania', 'Florida', 'Texas'],
    defaultDays: ['Mon', 'Tues', 'Wed', 'Thu', 'Fri'],
    dailyLeadCap: '20'
  }
};

const TESTIMONIALS = [
  {
    name: 'Tray Honeycutt',
    role: 'Integrity Partner',
    quote: 'Dude, this is the most advanced high level build out ever!',
    result: 'Advanced system design + stronger appointment flow.'
  },
  {
    name: 'Insurance Agency Owner',
    role: 'Independent Agency',
    quote: 'The lead quality and speed changed our close rate in under 30 days.',
    result: 'More live conversations with less wasted dial time.'
  },
  {
    name: 'Team Builder',
    role: 'Regional Leader',
    quote: 'Sponsor Leads gave us people already open to team growth conversations.',
    result: 'Faster recruiting pipeline with clearer intent.'
  }
];

const FAQ = [
  {
    q: 'How do pricing ranges work?',
    a: 'Ranges depend on lead type, targeting depth, and volume ordered. Higher volume typically lowers effective pricing.'
  },
  {
    q: 'Are Sponsor Leads fixed price?',
    a: 'Yes. Sponsor Leads are $25 per lead with a minimum order of 15 leads.'
  },
  {
    q: 'How fast are leads delivered?',
    a: 'Real-time campaigns are delivered as leads are generated so your team can contact quickly.'
  },
  {
    q: 'Can I order by licensed state?',
    a: 'Yes. Orders can be aligned to your licensed states and campaign objectives.'
  }
];

const INITIAL_SETUP = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  timeZone: '(GMT-05:00) Eastern Time (US & Canada)',
  homeStreet: '',
  homeCity: '',
  homeState: 'New Jersey',
  homeZip: '',
  homeCountry: 'United States',
  title: 'Insurance Agent',
  npnId: '',
  imoAgency: 'Legacy Link',
  sameAsHomeAddress: true,
  businessStreet: '',
  businessCity: '',
  businessState: 'New Jersey',
  businessZip: '',
  businessCountry: 'United States',
  agentWebsite: '',
  licensedStates: [],
  useProfileInfo: true,
  useProfileInfoThankYou: false,
  displayAgentTitle: 'Insurance Agent',
  displayAgentName: '',
  displayAgentNpn: '',
  displayAgentEmail: '',
  displayAgentPhone: '',
  displayAgentWebsite: '',
  displayAgentCalendarLink: '',
  profilePhotoName: '',
  profilePhotoDataUrl: '',
  defaultDays: ['Mon', 'Tues', 'Wed', 'Thu', 'Fri'],
  dailyLeadCap: '10',
  sendAgentDetailsEmail: false,
  sendAgentDetailsSms: false,
  sendLeadDetailsEmail: true,
  sendLeadDetailsSms: true
};

function PremiumStat({ value, label }) {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, background: 'rgba(255,255,255,0.08)', padding: 12 }}>
      <strong style={{ display: 'block', color: '#fff', fontSize: 18 }}>{value}</strong>
      <span style={{ color: '#cbd5e1', fontSize: 13 }}>{label}</span>
    </div>
  );
}

function packageUnitPrice(leadType = '', pkg = 'blended', fallback = 0) {
  const row = LEAD_PACKAGE_PRICING[String(leadType || '').toLowerCase()] || null;
  const price = Number(row?.[pkg]);
  if (Number.isFinite(price) && price > 0) return price;
  const fb = Number(fallback || 0);
  return Number.isFinite(fb) ? fb : 0;
}

export default function LinkLeadsPage(props = {}) {
  const forceShowBuilder = Boolean(props?.forceShowBuilder);
  const hideMarketingSections = Boolean(props?.hideMarketingSections);
  const standaloneMode = Boolean(props?.standaloneMode || forceShowBuilder);
  const telHref = `tel:${CONTACT.phone.replace(/[^\d]/g, '')}`;
  const [order, setOrder] = useState({
    leadType: ORDER_MENU[0].key,
    quantity: ORDER_MENU[0].minQty,
    buyerName: '',
    buyerEmail: '',
    buyerNpn: '',
    targetState: 'all',
    subscriptionWeekly: false
  });
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [checkoutNotice, setCheckoutNotice] = useState('');
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [clientIp, setClientIp] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const signatureCanvasRef = useRef(null);
  const cloudPersistTimerRef = useRef(null);
  const [setup, setSetup] = useState(INITIAL_SETUP);
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [setupStep, setSetupStep] = useState(0);
  const [showSetupEditor, setShowSetupEditor] = useState(false);
  const [showMarketplaceFilters, setShowMarketplaceFilters] = useState(true);
  const [marketTab, setMarketTab] = useState('inventory');
  const [showInlineBuilder, setShowInlineBuilder] = useState(false);
  const [showCompletionProfile, setShowCompletionProfile] = useState(false);
  const [marketFilters, setMarketFilters] = useState(MARKET_FILTER_DEFAULTS);
  const [savedMarketFilters, setSavedMarketFilters] = useState([]);
  const [leadPackage, setLeadPackage] = useState('blended');
  const [perfSnapshot, setPerfSnapshot] = useState({ todayEarned: 0, todayClosed: 0, mtdEarned: 0, mtdClosed: 0 });
  const [cloudProfileLoadedFor, setCloudProfileLoadedFor] = useState('');
  const [orderHistoryRows, setOrderHistoryRows] = useState([]);
  const [orderHistoryLoading, setOrderHistoryLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const inlineBuilder = String(params.get('showBuilder') || '') === '1';
    const profileView = String(params.get('view') || '').toLowerCase() === 'profile';
    setShowInlineBuilder(forceShowBuilder || inlineBuilder);
    setShowCompletionProfile(profileView);

    const autoName = String(params.get('name') || params.get('autoName') || '').trim();
    const autoEmail = String(params.get('email') || params.get('autoEmail') || '').trim();
    const autoRole = String(params.get('role') || params.get('autoRole') || 'buyer').trim() || 'buyer';
    const autoNpn = String(params.get('npn') || params.get('autoNpn') || '').replace(/\D/g, '');
    const autoStates = String(params.get('states') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const hubMember = (() => {
      try { return JSON.parse(localStorage.getItem(HUB_SESSION_KEY) || 'null'); } catch { return null; }
    })();
    const hubName = String(hubMember?.applicantName || hubMember?.name || '').trim();
    const hubEmail = String(hubMember?.email || '').trim();
    const hubStates = Array.isArray(hubMember?.licensedStates)
      ? hubMember.licensedStates
      : String(hubMember?.licensedStates || hubMember?.licensedState || hubMember?.state || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    if (!hubEmail && !autoEmail) {
      window.location.href = '/inner-circle-hub';
      return;
    }

    try {
      if (autoName || autoEmail || hubName || hubEmail) {
        const seeded = {
          name: autoName || hubName || autoEmail || hubEmail,
          email: autoEmail || hubEmail || '',
          role: autoRole || 'agent'
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(seeded));
      }

      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      const sessionName = String(session?.name || '');
      const sessionEmail = String(session?.email || '');
      const fullName = sessionName.split(' ');
      const firstName = fullName[0] || '';
      const lastName = fullName.slice(1).join(' ');

      const lastOrder = JSON.parse(localStorage.getItem(LAST_ORDER_INTENT_KEY) || 'null');
      setOrder((prev) => ({
        ...prev,
        leadType: lastOrder?.leadType || prev.leadType,
        quantity: lastOrder?.quantity || prev.quantity,
        subscriptionWeekly: typeof lastOrder?.subscriptionWeekly === 'boolean' ? lastOrder.subscriptionWeekly : prev.subscriptionWeekly,
        buyerName: prev.buyerName || sessionName,
        buyerEmail: prev.buyerEmail || sessionEmail,
        buyerNpn: prev.buyerNpn || autoNpn,
        targetState: prev.targetState !== 'all' ? prev.targetState : (lastOrder?.targetState || autoStates[0] || 'all')
      }));

      const profileMap = JSON.parse(localStorage.getItem(SETUP_PROFILE_MAP_KEY) || '{}');
      const profileByEmail = sessionEmail ? profileMap?.[String(sessionEmail).toLowerCase()] : null;
      const legacySaved = JSON.parse(localStorage.getItem(SETUP_PROFILE_KEY) || 'null');
      const saved = profileByEmail || (!sessionEmail ? legacySaved : null);

      const detectedTimeZone = (() => {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; }
      })();
      const defaultTimeZone = TIME_ZONES.includes(detectedTimeZone) ? detectedTimeZone : INITIAL_SETUP.timeZone;

      const normalizedEmail = String(sessionEmail || '').toLowerCase();
      const testSeed = !saved ? TEST_PROFILE_SEEDS[normalizedEmail] : null;

      const hydratedBase = saved ? { ...INITIAL_SETUP, ...saved } : {
        ...INITIAL_SETUP,
        firstName,
        lastName,
        email: sessionEmail,
        npnId: autoNpn,
        timeZone: defaultTimeZone,
        displayAgentName: sessionName,
        displayAgentEmail: sessionEmail
      };

      const hydrated = testSeed
        ? {
            ...hydratedBase,
            ...testSeed,
            email: sessionEmail || hydratedBase.email,
            displayAgentName: sessionName || `${testSeed.firstName || ''} ${testSeed.lastName || ''}`.trim(),
            displayAgentEmail: sessionEmail || hydratedBase.displayAgentEmail,
            licensedStates: Array.from(new Set([...(hydratedBase.licensedStates || []), ...(testSeed.licensedStates || [])]))
          }
        : hydratedBase;

      const seededStates = [...autoStates, ...hubStates].filter(Boolean);
      const mergedStates = seededStates.length
        ? Array.from(new Set([...(hydrated.licensedStates || []), ...seededStates]))
        : hydrated.licensedStates;

      const finalSetup = {
        ...hydrated,
        licensedStates: mergedStates,
        firstName: hydrated.firstName || firstName,
        lastName: hydrated.lastName || lastName,
        email: hydrated.email || sessionEmail,
        timeZone: hydrated.timeZone || defaultTimeZone
      };

      setSetup(finalSetup);
      setOrder((prev) => ({
        ...prev,
        targetState: prev.targetState !== 'all' ? prev.targetState : ((finalSetup.licensedStates || [])[0] || 'all')
      }));
      if (saved?.completedAt || validateSetup(finalSetup)) {
        setSetupCompleted(true);
        setShowSetupEditor(false);
      }

      const storedFilters = JSON.parse(localStorage.getItem(MARKET_FILTERS_KEY) || '[]');
      if (Array.isArray(storedFilters)) setSavedMarketFilters(storedFilters);

      const savedDraftFilters = JSON.parse(localStorage.getItem(MARKET_FILTER_DRAFT_KEY) || 'null');
      if (savedDraftFilters && typeof savedDraftFilters === 'object') {
        setMarketFilters((prev) => ({ ...prev, ...savedDraftFilters }));
      }
    } catch {}

    const checkout = String(params.get('checkout') || '').toLowerCase();
    if (checkout === 'success') {
      setCheckoutNotice('Payment received. A premium confirmation email has been sent and your lead setup will be completed within 48 hours.');
      setShowCompletionProfile(true);
    } else if (checkout === 'cancel') {
      setCheckoutNotice('Checkout canceled. Your order was not charged.');
      setShowCompletionProfile(false);
    }
  }, [forceShowBuilder]);

  useEffect(() => {
    if (!setupCompleted) {
      setShowSetupEditor(true);
    }
  }, [setupCompleted]);

  useEffect(() => {
    const emailKey = String(setup?.email || order?.buyerEmail || '').trim().toLowerCase();
    if (!emailKey || cloudProfileLoadedFor === emailKey) return;

    let canceled = false;
    (async () => {
      try {
        const res = await fetch(`/api/linkleads/profile?email=${encodeURIComponent(emailKey)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok || !data?.profile || canceled) return;

        const profile = data.profile || {};
        const cloudSetup = profile?.setup && typeof profile.setup === 'object' ? profile.setup : null;
        const cloudOrder = profile?.orderPrefs && typeof profile.orderPrefs === 'object' ? profile.orderPrefs : null;
        const cloudFilters = profile?.marketFilters && typeof profile.marketFilters === 'object' ? profile.marketFilters : null;

        if (cloudSetup) {
          setSetup((prev) => ({
            ...prev,
            ...cloudSetup,
            licensedStates: Array.from(new Set([...(prev.licensedStates || []), ...(cloudSetup.licensedStates || [])]))
          }));
          if (cloudSetup?.completedAt || validateSetup(cloudSetup)) {
            setSetupCompleted(true);
            setShowSetupEditor(false);
          }
        }

        if (cloudOrder) {
          setOrder((prev) => ({
            ...prev,
            ...cloudOrder,
            buyerName: prev.buyerName || cloudOrder.buyerName || prev.buyerName,
            buyerEmail: prev.buyerEmail || cloudOrder.buyerEmail || prev.buyerEmail
          }));
        }

        if (cloudFilters) {
          setMarketFilters((prev) => ({ ...prev, ...cloudFilters }));
        }
      } catch {}
      finally {
        if (!canceled) setCloudProfileLoadedFor(emailKey);
      }
    })();

    return () => { canceled = true; };
  }, [setup?.email, order?.buyerEmail, cloudProfileLoadedFor]);

  useEffect(() => {
    const emailKey = String(setup?.email || order?.buyerEmail || '').trim().toLowerCase();
    if (!emailKey) return;

    if (cloudPersistTimerRef.current) clearTimeout(cloudPersistTimerRef.current);
    cloudPersistTimerRef.current = setTimeout(() => {
      persistProfileToCloud(setup, order, marketFilters);
    }, 800);

    return () => {
      if (cloudPersistTimerRef.current) clearTimeout(cloudPersistTimerRef.current);
    };
  }, [
    setup,
    order.leadType,
    order.quantity,
    order.targetState,
    order.subscriptionWeekly,
    order.buyerEmail,
    marketFilters,
    leadPackage
  ]);

  useEffect(() => {
    if (!setup.useProfileInfo) return;
    setSetup((prev) => ({
      ...prev,
      displayAgentTitle: prev.title || prev.displayAgentTitle,
      displayAgentName: `${prev.firstName || ''} ${prev.lastName || ''}`.trim() || prev.displayAgentName,
      displayAgentNpn: prev.npnId || prev.displayAgentNpn,
      displayAgentEmail: prev.email || prev.displayAgentEmail,
      displayAgentPhone: prev.phone || prev.displayAgentPhone,
      displayAgentWebsite: prev.agentWebsite || prev.displayAgentWebsite
    }));
  }, [
    setup.useProfileInfo,
    setup.title,
    setup.firstName,
    setup.lastName,
    setup.npnId,
    setup.email,
    setup.phone,
    setup.agentWebsite
  ]);

  useEffect(() => {
    const selectedStates = Array.isArray(marketFilters.states) ? marketFilters.states.filter(Boolean) : [];
    if (!selectedStates.length) return;
    setSetup((prev) => {
      const prevStates = Array.isArray(prev.licensedStates) ? prev.licensedStates : [];
      if (JSON.stringify(prevStates) === JSON.stringify(selectedStates)) return prev;
      return { ...prev, licensedStates: selectedStates };
    });
  }, [marketFilters.states]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(MARKET_FILTER_DRAFT_KEY, JSON.stringify(marketFilters));
    } catch {}
  }, [marketFilters]);

  useEffect(() => {
    const full = `${setup.firstName || ''} ${setup.lastName || ''}`.trim();
    setOrder((prev) => ({
      ...prev,
      buyerName: prev.buyerName || full,
      buyerEmail: prev.buyerEmail || setup.email || ''
    }));
  }, [setup.firstName, setup.lastName, setup.email]);

  useEffect(() => {
    async function loadClientIp() {
      try {
        const res = await fetch('/api/client-ip', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) setClientIp(String(data.ip || ''));
      } catch {}
    }
    loadClientIp();
  }, []);

  function getCanvasPoint(event) {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const source = event?.touches?.[0] || event;
    if (!source) return null;
    return { x: source.clientX - rect.left, y: source.clientY - rect.top };
  }

  function beginSignature(event) {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(event);
    if (!pt) return;
    event.preventDefault?.();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    setIsSigning(true);
  }

  function drawSignature(event) {
    if (!isSigning) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(event);
    if (!pt) return;
    event.preventDefault?.();
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  }

  function endSignature() {
    if (!isSigning) return;
    setIsSigning(false);
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSignatureDataUrl(dataUrl);
  }

  function clearSignature() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl('');
  }

  const selectedOrderType = useMemo(() => ORDER_MENU.find((x) => x.key === order.leadType) || ORDER_MENU[0], [order.leadType]);
  const selectedLeadPackage = useMemo(() => LEAD_PACKAGES.find((x) => x.key === leadPackage) || LEAD_PACKAGES[1], [leadPackage]);
  const normalizedQty = (() => {
    const minQty = Number(selectedOrderType?.minQty || 20);
    const raw = Number(order.quantity || 0);
    const safe = Number.isFinite(raw) ? raw : minQty;
    return Math.max(minQty, Math.ceil(safe / 5) * 5);
  })();
  const selectedUnitPrice = useMemo(
    () => packageUnitPrice(selectedOrderType?.key, leadPackage, selectedOrderType?.unitPrice || 0),
    [selectedOrderType, leadPackage]
  );
  const estimatedSubtotal = useMemo(() => Number(selectedUnitPrice * normalizedQty), [selectedUnitPrice, normalizedQty]);
  const subscriptionDiscount = order.subscriptionWeekly ? Number((estimatedSubtotal * WEEKLY_SUBSCRIPTION_DISCOUNT_PCT) / 100) : 0;
  const discountedSubtotal = Math.max(0, estimatedSubtotal - subscriptionDiscount);
  const profilePhotoSrc = '/legacy-link-logo-official.png';
  const shareableAgentSlug = String(`${setup.firstName || ''} ${setup.lastName || ''}`.trim() || (setup.email || order.buyerEmail || '').split('@')[0] || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hubMember = (() => {
      try { return JSON.parse(localStorage.getItem(HUB_SESSION_KEY) || 'null'); } catch { return null; }
    })();

    const ownerName = String(setup.displayAgentName || `${setup.firstName || ''} ${setup.lastName || ''}`.trim() || hubMember?.applicantName || hubMember?.name || '').trim();
    const ownerEmail = String(setup.email || order.buyerEmail || hubMember?.email || '').trim();
    if (!ownerName && !ownerEmail) return;

    let canceled = false;
    async function loadPerf() {
      try {
        const url = `/api/inner-circle-hub-kpi?name=${encodeURIComponent(ownerName)}&email=${encodeURIComponent(ownerEmail)}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!canceled && res.ok && data?.ok && data?.kpi) {
          const k = data.kpi || {};
          setPerfSnapshot({
            todayEarned: Number(k?.potentialToday || 0),
            todayClosed: Number(k?.closesToday || 0),
            mtdEarned: Number(k?.potentialEarned || 0),
            mtdClosed: Number(k?.closesThisMonth || 0)
          });
        }
      } catch {}
    }

    loadPerf();
    return () => { canceled = true; };
  }, [setup.firstName, setup.lastName, setup.displayAgentName, setup.email, order.buyerEmail]);

  useEffect(() => {
    const buyerEmail = String(setup.email || order.buyerEmail || '').trim().toLowerCase();
    if (!buyerEmail) {
      setOrderHistoryRows([]);
      return;
    }

    let canceled = false;
    setOrderHistoryLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/linkleads/orders?buyerEmail=${encodeURIComponent(buyerEmail)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (canceled) return;
        if (res.ok && data?.ok && Array.isArray(data?.rows)) {
          setOrderHistoryRows(data.rows);
        } else {
          setOrderHistoryRows([]);
        }
      } catch {
        if (!canceled) setOrderHistoryRows([]);
      } finally {
        if (!canceled) setOrderHistoryLoading(false);
      }
    })();

    return () => { canceled = true; };
  }, [setup.email, order.buyerEmail]);

  const availableStatesForMarketplace = useMemo(() => US_STATES, []);

  const marketRows = useMemo(() => {
    const qualityByKey = {
      veterans: 'High Intent',
      'final-expense': 'Standard',
      iul: 'Premium Ready',
      'mortgage-protection': 'High Intent',
      spanish: 'High Intent',
      trucker: 'Niche',
      'health-under-65': 'Standard',
      sponsor: 'Recruiting'
    };

    return ORDER_MENU.map((item, idx) => ({
      key: item.key,
      leadType: item.label,
      bucket: item.key === 'sponsor' ? 'Sponsorship' : 'Insurance',
      leadQuality: qualityByKey[item.key] || 'Standard',
      language: item.key === 'spanish' ? 'Spanish' : 'English',
      stateScope: 'Licensed States',
      minQty: item.minQty,
      unitPrice: item.unitPrice
    }));
  }, []);

  const marketFilteredRows = useMemo(() => {
    const q = String(marketFilters.search || '').trim().toLowerCase();
    return marketRows.filter((r) => {
      if (marketFilters.language !== 'all' && r.language !== marketFilters.language) return false;
      if (q) {
        const hay = `${r.leadType} ${r.bucket} ${r.leadQuality} ${r.language}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [marketFilters, marketRows]);

  const marketOrderRows = useMemo(() => {
    const q = String(marketFilters.search || '').trim().toLowerCase();

    return (orderHistoryRows || [])
      .map((r) => ({
        id: String(r?.orderId || ''),
        key: String(r?.leadType || '').trim().toLowerCase(),
        leadType: String(r?.leadLabel || 'Lead Order'),
        leadQuality: String(r?.leadPackage || 'Standard'),
        quantity: Number(r?.quantity || 0),
        amount: Number(r?.amountTotalUsd || 0),
        orderedAt: String(r?.createdAt || r?.paidAt || ''),
        status: String(r?.fulfillmentStatus || 'setup_pending')
      }))
      .filter((r) => {
        if (q) {
          const hay = `${r.id} ${r.leadType} ${r.leadQuality} ${r.quantity} ${r.status}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [orderHistoryRows, marketFilters.search]);

  const normalizeOrderQuantity = (rawValue, minOverride) => {
    const minQty = Number(minOverride || selectedOrderType?.minQty || 20);
    const raw = Number(rawValue || 0);
    const safe = Number.isFinite(raw) ? raw : minQty;
    return Math.max(minQty, Math.ceil(safe / 5) * 5);
  };

  const updateOrder = (k, v) => setOrder((p) => ({
    ...p,
    [k]: k === 'quantity' ? normalizeOrderQuantity(v) : v
  }));
  const updateSetup = (k, v) => setSetup((p) => ({ ...p, [k]: v }));

  function updateMarketFilter(k, v) {
    setMarketFilters((prev) => ({ ...prev, [k]: v }));
  }

  function toggleMarketState(stateName) {
    setMarketFilters((prev) => {
      const existing = Array.isArray(prev.states) ? prev.states : [];
      const has = existing.includes(stateName);
      return { ...prev, states: has ? existing.filter((s) => s !== stateName) : [...existing, stateName] };
    });
  }

  function clearMarketFilters() {
    setMarketFilters(MARKET_FILTER_DEFAULTS);
  }

  function saveCurrentMarketFilter() {
    if (typeof window === 'undefined') return;
    const name = window.prompt('Name this filter set:', 'My Filter');
    if (!name) return;
    const next = [
      ...savedMarketFilters.filter((f) => String(f?.name || '').toLowerCase() !== String(name).toLowerCase()),
      { name: String(name).trim(), filters: marketFilters }
    ];
    setSavedMarketFilters(next);
    try { localStorage.setItem(MARKET_FILTERS_KEY, JSON.stringify(next)); } catch {}
  }

  function applySavedMarketFilter(name = '') {
    const found = savedMarketFilters.find((f) => String(f?.name || '') === String(name));
    if (!found?.filters) return;
    setMarketFilters({ ...MARKET_FILTER_DEFAULTS, ...found.filters });
  }

  function deleteSavedMarketFilter(name = '') {
    const next = savedMarketFilters.filter((f) => String(f?.name || '') !== String(name));
    setSavedMarketFilters(next);
    try { localStorage.setItem(MARKET_FILTERS_KEY, JSON.stringify(next)); } catch {}
  }

  function jumpToOrderFromMarket(row) {
    if (!row?.key) return;

    if (!setupReady && !validateSetup(setup)) {
      const missing = getMissingSetupFields(setup);
      setSetupError(`Complete First-Time Setup before ordering leads. Missing: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ` +${missing.length - 6} more` : ''}.`);
      setShowSetupEditor(true);
      if (typeof document !== 'undefined') document.getElementById('first-time-setup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    updateOrder('leadType', row.key);
    updateOrder('quantity', normalizeOrderQuantity(order.quantity, row.minQty || 20));
    const selectedState = Array.isArray(marketFilters.states) ? marketFilters.states[0] : '';
    if (selectedState) updateOrder('targetState', selectedState);
    if (typeof document !== 'undefined') document.getElementById('order-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toggleLicensedState(stateName) {
    setSetup((prev) => {
      const has = prev.licensedStates.includes(stateName);
      return { ...prev, licensedStates: has ? prev.licensedStates.filter((s) => s !== stateName) : [...prev.licensedStates, stateName] };
    });
  }

  function toggleDefaultDay(day) {
    setSetup((prev) => {
      const has = prev.defaultDays.includes(day);
      return { ...prev, defaultDays: has ? prev.defaultDays.filter((d) => d !== day) : [...prev.defaultDays, day] };
    });
  }

  function validateSetup(s = setup) {
    const required = [
      s.firstName, s.lastName, s.email, s.phone, s.dateOfBirth, s.timeZone,
      s.homeStreet, s.homeCity, s.homeState, s.homeZip,
      s.title, s.npnId, s.imoAgency
    ].every((v) => String(v || '').trim());

    const hasLicensedStates = Array.isArray(s.licensedStates) && s.licensedStates.length > 0;
    const dailyLeadCapValue = Number(s.dailyLeadCap || 0);
    const hasValidDailyCap = Number.isFinite(dailyLeadCapValue) && dailyLeadCapValue >= 5;

    return required && hasLicensedStates && hasValidDailyCap;
  }

  function isPersonalStepValid(s = setup) {
    return [
      s.firstName,
      s.lastName,
      s.email,
      s.phone,
      s.dateOfBirth,
      s.timeZone,
      s.homeStreet,
      s.homeCity,
      s.homeState,
      s.homeZip,
      s.homeCountry
    ].every((v) => String(v || '').trim());
  }

  function isBusinessStepValid(s = setup) {
    return [s.title, s.npnId, s.imoAgency].every((v) => String(v || '').trim());
  }

  function isLeadDefaultsStepValid(s = setup) {
    return Array.isArray(s.licensedStates)
      && s.licensedStates.length > 0
      && Number.isFinite(Number(s.dailyLeadCap || 0))
      && Number(s.dailyLeadCap || 0) >= 5;
  }

  function getMissingSetupFields(s = setup) {
    const missing = [];
    const check = (label, value) => {
      if (!String(value || '').trim()) missing.push(label);
    };

    check('First Name', s.firstName);
    check('Last Name', s.lastName);
    check('Email', s.email);
    check('Phone Number', s.phone);
    check('Date Of Birth', s.dateOfBirth);
    check('Time Zone', s.timeZone);
    check('Street Address', s.homeStreet);
    check('City', s.homeCity);
    check('State', s.homeState);
    check('Zip Code', s.homeZip);
    check('Country', s.homeCountry);
    check('Title', s.title);
    check('NPN ID', s.npnId);
    check('IMO / Agency', s.imoAgency);

    if (!Array.isArray(s.licensedStates) || s.licensedStates.length === 0) missing.push('Licensed States');

    const dailyLeadCapValue = Number(s.dailyLeadCap || 0);
    if (!Number.isFinite(dailyLeadCapValue) || dailyLeadCapValue < 5) missing.push('Daily Lead Cap (minimum 5)');

    return missing;
  }

  const setupReady = Boolean(setupCompleted || setup?.completedAt || validateSetup(setup));

  function persistProfileToCloud(nextSetup = setup, nextOrder = order, nextFilters = marketFilters) {
    const emailKey = String(nextSetup?.email || nextOrder?.buyerEmail || '').trim().toLowerCase();
    if (!emailKey) return;

    fetch('/api/linkleads/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailKey,
        setup: nextSetup,
        marketFilters: nextFilters,
        orderPrefs: {
          leadType: nextOrder?.leadType,
          quantity: nextOrder?.quantity,
          targetState: nextOrder?.targetState,
          subscriptionWeekly: Boolean(nextOrder?.subscriptionWeekly),
          leadPackage
        }
      })
    }).catch(() => {});
  }

  function saveSetup(markComplete = false) {
    const snapshot = {
      ...setup,
      completedAt: markComplete ? new Date().toISOString() : (setup?.completedAt || '')
    };

    try {
      localStorage.setItem(SETUP_PROFILE_KEY, JSON.stringify(snapshot));
      const emailKey = String(setup?.email || order?.buyerEmail || '').trim().toLowerCase();
      if (emailKey) {
        const profileMap = JSON.parse(localStorage.getItem(SETUP_PROFILE_MAP_KEY) || '{}');
        profileMap[emailKey] = snapshot;
        localStorage.setItem(SETUP_PROFILE_MAP_KEY, JSON.stringify(profileMap));
      }
    } catch {}

    if (markComplete && validateSetup(snapshot)) {
      setSetupCompleted(true);
      setShowSetupEditor(false);
    }
    persistProfileToCloud(snapshot, order, marketFilters);
    setSetupError('');
  }

  async function startCheckout() {
    setOrderError('');
    if (!order.buyerName.trim() || !order.buyerEmail.trim()) {
      setOrderError('Please enter your full name and email before checkout.');
      return;
    }

    if (!policyAccepted) {
      setOrderError('Please review and accept the Lead Purchase + Replacement Policy before checkout.');
      return;
    }

    if (!signatureDataUrl) {
      setOrderError('Please provide your digital signature before checkout.');
      return;
    }

    if (!setupReady && !validateSetup(setup)) {
      const missing = getMissingSetupFields(setup);
      setSetupError(`Please complete all required First-Time Setup fields before checkout. Missing: ${missing.join(', ')}.`);
      setShowSetupEditor(true);
      setOrderError('First-Time Setup is incomplete. Please complete all required fields marked with * and save.');
      if (typeof document !== 'undefined') document.getElementById('first-time-setup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (typeof window !== 'undefined' && !sessionStorage.getItem(SESSION_KEY)) {
      window.location.href = '/inner-circle-hub';
      return;
    }

    try {
      localStorage.setItem(LAST_ORDER_INTENT_KEY, JSON.stringify({
        leadType: selectedOrderType?.key,
        leadPackage,
        quantity: normalizedQty,
        targetState: order.targetState,
        subscriptionWeekly: Boolean(order.subscriptionWeekly),
        savedAt: new Date().toISOString()
      }));
    } catch {}

    setOrderLoading(true);
    try {
      const res = await fetch('/api/linkleads/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadType: selectedOrderType?.key,
          leadLabel: selectedOrderType?.label,
          leadPackage,
          unitPriceUsd: Number(selectedUnitPrice.toFixed(2)),
          quantity: normalizedQty,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          buyerNpn: order.buyerNpn,
          targetState: order.targetState,
          subscriptionWeekly: Boolean(order.subscriptionWeekly),
          subscriptionDiscountPct: order.subscriptionWeekly ? WEEKLY_SUBSCRIPTION_DISCOUNT_PCT : 0,
          subtotalUsd: Number(estimatedSubtotal.toFixed(2)),
          discountedSubtotalUsd: Number(discountedSubtotal.toFixed(2)),
          policyAccepted: true,
          policyAcceptedAt: new Date().toISOString(),
          firstTimeSetup: {
            ...setup,
            sameAsHomeAddress: Boolean(setup.sameAsHomeAddress),
            licensedStates: setup.licensedStates,
            defaultDays: setup.defaultDays,
            submittedAt: new Date().toISOString()
          },
          digitalSignature: {
            dataUrl: signatureDataUrl,
            ipAddress: clientIp,
            signedAt: new Date().toISOString()
          },
          origin: window.location.origin
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.url) {
        setOrderError(data?.error || 'Could not start checkout right now.');
        return;
      }
      saveSetup(true);
      window.location.href = data.url;
    } finally {
      setOrderLoading(false);
    }
  }

  return (
    <main className={`publicPage ${hideMarketingSections && showInlineBuilder ? 'llBuilderOnly' : ''} ${standaloneMode ? 'llStandalonePage' : ''}`} style={{ paddingBottom: 92, background: '#020617' }}>
      <div style={{ maxWidth: standaloneMode ? 1560 : 1180, margin: '0 auto', padding: standaloneMode ? '16px 20px' : 12 }}>
        <header
          style={{
            position: 'sticky',
            top: 8,
            zIndex: 30,
            border: '1px solid #1f2a44',
            borderRadius: 14,
            background: 'rgba(2,6,23,0.86)',
            backdropFilter: 'blur(8px)',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap'
          }}
        >
          <img src="/legacy-link-logo-official.png" alt="Link Leads" style={{ width: 34, height: 34, borderRadius: 999, objectFit: 'contain', background: '#0b1220', padding: 4 }} />
          <strong style={{ color: '#e2e8f0' }}>Link Leads</strong>
          <a href="#leads" className="ghost" style={{ textDecoration: 'none' }}>Our Leads</a>
          <a href="#stories" className="ghost" style={{ textDecoration: 'none' }}>Success Stories</a>
          <a href="/linkleads/order-builder" className="ghost" style={{ textDecoration: 'none' }}>Checkout</a>
          <a href="#pricing" className="ghost" style={{ textDecoration: 'none' }}>Pricing</a>
          <a href="#faq" className="ghost" style={{ textDecoration: 'none' }}>FAQ</a>
          <a href="#contact" className="ghost" style={{ textDecoration: 'none' }}>Contact</a>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <a href="/linkleads/order-builder" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><button type="button">Open Order Builder</button></a>
          </div>
        </header>

        {checkoutNotice ? (
          <div style={{ marginTop: 12, border: '1px solid #2563eb', borderRadius: 12, background: 'rgba(37,99,235,0.12)', padding: 12, color: '#dbeafe', fontWeight: 600 }}>
            {checkoutNotice}
          </div>
        ) : null}

        <section
          className="llMarketingSection"
          style={{
            marginTop: 12,
            border: '1px solid #1f2a44',
            borderRadius: 18,
            overflow: 'hidden',
            background: 'radial-gradient(circle at 15% -10%, rgba(37,99,235,0.45), transparent 55%), radial-gradient(circle at 90% 10%, rgba(200,169,107,0.3), transparent 45%), #0b1220'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
            <div style={{ padding: 24, display: 'grid', gap: 12 }}>
              <span className="pill" style={{ background: 'rgba(37,99,235,0.2)', color: '#bfdbfe', border: '1px solid rgba(147,197,253,0.4)', width: 'fit-content' }}>Legacy Link Premium Lead Marketplace</span>
              <h1 style={{ margin: 0, color: '#fff', fontSize: 40, lineHeight: 1.05 }}>High-Intent Insurance Leads That Actually Convert</h1>
              <p style={{ margin: 0, color: '#cbd5e1', fontSize: 16 }}>
                Built for serious producers and team builders. Real-time delivery, volume-based pricing, and account-level tracking.
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href="/linkleads/order-builder" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><button type="button">Open Order Builder</button></a>
              </div>

              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', marginTop: 4 }}>
                <PremiumStat value="Real-Time" label="Lead Delivery" />
                <PremiumStat value="Volume" label="Pricing by order size" />
                <PremiumStat value="Sponsor Leads" label="$25 fixed • Min 15" />
              </div>
            </div>

            <div style={{ minHeight: 340, position: 'relative', borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'grid', placeItems: 'center', padding: 24 }}>
              <img
                src="/legacy-link-logo-official.png"
                alt="The Legacy Link"
                style={{ width: 'min(100%, 260px)', height: 'min(100%, 260px)', objectFit: 'contain', display: 'block', filter: 'drop-shadow(0 12px 30px rgba(2,6,23,0.45))' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(2,6,23,0.12) 0%, rgba(2,6,23,0.75) 100%)' }} />
              <div className="llFloatingBadge" style={{ position: 'absolute', right: 14, top: 14, border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '8px 10px', background: 'rgba(2,6,23,0.55)', color: '#fff', fontWeight: 700, fontSize: 12 }}>
                Verified by The Legacy Link
              </div>
              <div style={{ position: 'absolute', left: 14, right: 14, bottom: 14, display: 'grid', gap: 8 }}>
                <span className="pill" style={{ background: 'rgba(255,255,255,0.13)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)', width: 'fit-content' }}>Used by high-performing teams</span>
                <p style={{ margin: 0, color: '#e2e8f0', fontSize: 14 }}>
                  Sign in, choose category, checkout, and route purchased leads directly to your account.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="llMarketingSection" style={{ marginTop: 12, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
          {['Veterans', 'Final Expense', 'IUL', 'Mortgage', 'Spanish', 'Trucker', 'Health', 'Sponsor'].map((x) => (
            <div key={x} style={{ border: '1px solid #1f2a44', borderRadius: 10, padding: 10, background: '#0b1220', color: '#94a3b8', textAlign: 'center', fontWeight: 700 }}>
              {x} Leads
            </div>
          ))}
        </section>

        <section className="llMarketingSection" style={{ marginTop: 12, border: '1px solid #1f2a44', borderRadius: 14, padding: 14, background: '#0b1220' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#fff' }}>Why L.I.N.K Leads</h3>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            {LINK_PILLARS.map((p) => (
              <div key={p.key} className="llGlassCard" style={{ border: '1px solid #24314f', borderRadius: 12, background: 'linear-gradient(180deg,#0f172a 0%, #020617 100%)', padding: 12 }}>
                <strong style={{ color: '#e2e8f0' }}>{p.key} — {p.title}</strong>
                <p style={{ color: '#94a3b8', marginBottom: 0 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="leads" className="llMarketingSection" style={{ marginTop: 14 }}>
          <div style={{ border: '1px solid #1f2a44', borderRadius: 14, padding: 14, background: '#0b1220' }}>
            <h2 style={{ color: '#fff', margin: 0 }}>Explore Our Insurance Lead Options</h2>
            <p style={{ color: '#94a3b8', marginBottom: 0 }}>
              Pricing ranges reflect campaign type, targeting depth, and quantity ordered.
            </p>
          </div>

          <div style={{ marginTop: 10, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
            {LEAD_TYPES.map((lead) => (
              <article key={lead.name} className="llHoverCard" style={{ border: '1px solid #24314f', borderRadius: 14, background: '#0b1220', padding: 14, display: 'grid', gap: 8, boxShadow: '0 10px 30px rgba(2,6,23,0.45)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <strong style={{ color: '#e2e8f0' }}>{lead.name}</strong>
                  <span style={{ fontSize: 20 }}>{lead.icon}</span>
                </div>
                <div style={{ color: '#60a5fa', fontWeight: 800 }}>{lead.price} <small style={{ color: '#94a3b8', fontWeight: 500 }}>per lead</small></div>
                <small style={{ color: '#cbd5e1' }}>{lead.subtitle}</small>
                <ul style={{ margin: 0, paddingLeft: 18, color: '#94a3b8', display: 'grid', gap: 4 }}>
                  {lead.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
                <a href="/inner-circle-hub" style={{ textDecoration: 'none', marginTop: 2 }}>
                  <button type="button" className="publicPrimaryBtn publicBtnBlock">Order {lead.name}</button>
                </a>
              </article>
            ))}

            <article className="llHoverCard" style={{ border: '2px solid #1d4ed8', borderRadius: 14, background: 'linear-gradient(180deg,#0b1220 0%, #111c36 100%)', padding: 14, display: 'grid', gap: 8, boxShadow: '0 14px 34px rgba(29,78,216,0.28)' }}>
              <span className="pill" style={{ background: '#1d4ed8', color: '#fff', width: 'fit-content' }}>NEW • Team Building</span>
              <strong style={{ color: '#fff' }}>Sponsor Leads</strong>
              <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: 20 }}>$25 <small style={{ color: '#cbd5e1', fontWeight: 600, fontSize: 13 }}>fixed per lead</small></div>
              <p style={{ margin: 0, color: '#cbd5e1' }}>People interested in joining and building with a producing team.</p>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#bfdbfe', display: 'grid', gap: 4 }}>
                <li>Team-building intent</li>
                <li>Business opportunity angle</li>
                <li>Minimum order: 15 leads</li>
              </ul>
              <a href="/inner-circle-hub" style={{ textDecoration: 'none' }}>
                <button type="button" className="publicPrimaryBtn publicBtnBlock">Order Sponsor Leads</button>
              </a>
            </article>
          </div>
        </section>

        {!showInlineBuilder ? (
          <section className="llMarketingSection" style={{ marginTop: 14, border: '1px solid #334155', borderRadius: 14, padding: 16, background: 'linear-gradient(180deg,#0b1220 0%, #111827 100%)' }}>
            <h3 style={{ marginTop: 0, color: '#fff' }}>Secure Checkout Builder</h3>
            <p style={{ color: '#cbd5e1', marginTop: 0 }}>Personal Information, Business Information, Lead Defaults, Lead Type, and Weekly Subscription now live on a dedicated premium page.</p>
            <a href="/linkleads/order-builder" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button type="button" style={{ background: '#dc2626', color: '#fff' }}>Open Order Builder Page</button>
            </a>
          </section>
        ) : null}

        <section id="order-builder" style={{ marginTop: 14, border: '1px solid #1d4ed8', borderRadius: 14, padding: 14, background: 'linear-gradient(180deg,#0b1220 0%, #111c36 100%)', display: showInlineBuilder ? 'block' : 'none' }}>
          <h3 style={{ marginTop: 0, color: '#fff' }}>Secure Checkout Builder</h3>
          <p style={{ color: '#cbd5e1', marginTop: 0 }}>Place your order now. After payment, you’ll receive a premium confirmation email and your lead setup will be completed within 48 hours.</p>

          {showCompletionProfile ? (
            <section style={{ marginBottom: 12, border: '1px solid #ef4444', borderRadius: 14, background: 'linear-gradient(135deg,#1f2937 0%, #0b1220 55%, #111827 100%)', padding: 16, boxShadow: '0 18px 45px rgba(239,68,68,0.22)' }}>
              <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', alignItems: 'center' }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="pill" style={{ background: '#dc2626', color: '#fff', border: '1px solid #ef4444' }}>✓ Profile Complete</span>
                    {SETUP_STEPS.map((s) => (
                      <span key={s} className="pill" style={{ background: '#065f46', color: '#d1fae5', border: '1px solid #10b981' }}>✓ {s}</span>
                    ))}
                  </div>

                  <h3 style={{ margin: 0, color: '#fff', fontSize: 30, lineHeight: 1.05 }}>You’re All Set! 🎉</h3>
                  <p style={{ margin: 0, color: '#cbd5e1', fontSize: 15 }}>
                    Welcome, {setup.firstName || order.buyerName || 'Agent'}. Your premium lead profile is live and ready for conversion.
                  </p>

                  <div style={{ display: 'grid', gap: 6, border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#020617' }}>
                    <small style={{ color: '#94a3b8' }}>Lead Type: <strong style={{ color: '#e2e8f0' }}>{selectedOrderType?.label}</strong></small>
                    <small style={{ color: '#94a3b8' }}>Licensed States: <strong style={{ color: '#e2e8f0' }}>{(setup.licensedStates || []).slice(0, 5).join(', ') || 'Not set'}</strong>{(setup.licensedStates || []).length > 5 ? <span style={{ color: '#94a3b8' }}> +{(setup.licensedStates || []).length - 5} more</span> : null}</small>
                    <small style={{ color: '#94a3b8' }}>Default Days: <strong style={{ color: '#e2e8f0' }}>{(setup.defaultDays || []).join(', ') || 'Not set'}</strong></small>
                    <small style={{ color: '#94a3b8' }}>Daily Cap: <strong style={{ color: '#e2e8f0' }}>{setup.dailyLeadCap || '-'}</strong></small>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a href="/linkleads/orders" style={{ textDecoration: 'none' }}><button type="button" style={{ background: '#dc2626', color: '#fff' }}>Start Managing Leads</button></a>
                    <a href={`/linkleads/personal-website?email=${encodeURIComponent(setup.email || order.buyerEmail || '')}`} style={{ textDecoration: 'none' }}><button type="button" className="ghost">Open Personal Website Preview</button></a>
                    <a href={`/agent/${encodeURIComponent(shareableAgentSlug || 'agent')}`} style={{ textDecoration: 'none' }}><button type="button" className="ghost">Open Shareable Agent Link</button></a>
                    <button type="button" className="ghost" onClick={() => setShowCompletionProfile(false)}>Place Another Order</button>
                  </div>
                </div>

                <div style={{ textAlign: 'center', position: 'relative' }}>
                  <span className="pill llFloatingBadge" style={{ position: 'absolute', top: 10, right: 18, background: '#111827', color: '#fff', border: '1px solid #334155' }}>Verified by The Legacy Link</span>
                  <img src={profilePhotoSrc} alt="Lead profile" style={{ width: 'min(100%, 290px)', borderRadius: 12, border: '1px solid #334155', objectFit: 'cover', background: '#020617' }} />
                </div>
              </div>
            </section>
          ) : null}

          {!setupCompleted ? (
          <section style={{ marginBottom: 12, border: '1px solid #334155', borderRadius: 12, background: '#020617', padding: 12 }}>
                <div style={{ border: '1px solid #24314f', borderRadius: 12, padding: 10, marginBottom: 10, background: 'linear-gradient(180deg,#0b1220 0%, #030712 100%)' }}>
              <div className="panelRow" style={{ justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong style={{ color: '#fff', fontSize: 15 }}>Lead Marketplace Explorer</strong>
                  <small style={{ color: '#94a3b8', display: 'block', marginTop: 2 }}>Filter by state, quality, and campaign type. Then click Order to jump into checkout.</small>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {MARKET_TABS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className="ghost"
                      style={{
                        background: marketTab === t.key ? '#dc2626' : '#0f172a',
                        color: '#fff',
                        borderColor: marketTab === t.key ? '#dc2626' : '#334155'
                      }}
                      onClick={() => setMarketTab(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                  {marketTab !== 'scripts' ? (
                    <button type="button" className="ghost" onClick={() => setShowMarketplaceFilters((prev) => !prev)}>
                      {showMarketplaceFilters ? 'Hide Filters' : 'Show Filters'}
                    </button>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="pill" style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155' }}>Licensed States: {availableStatesForMarketplace.length}</span>
                <span className="pill" style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155' }}>Selected: {(marketFilters.states || []).length || 'All'}</span>
              </div>
              {!setupReady ? (
                <small style={{ color: '#fca5a5', display: 'block', marginTop: 8 }}>
                  Complete First-Time Setup (Personal Info, Business Info, and Lead Defaults) before placing any order.
                </small>
              ) : null}
            </div>

            {showMarketplaceFilters && marketTab !== 'scripts' ? (
              <div style={{ display: 'grid', gap: 8, marginBottom: 10, border: '1px solid #24314f', borderRadius: 10, padding: 10, background: '#020817' }}>
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                  <label style={{ display: 'grid', gap: 6, color: '#cbd5e1' }}>Language
                    <select value={marketFilters.language} onChange={(e) => updateMarketFilter('language', e.target.value)}>
                      <option value="all">All</option>
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 6, color: '#cbd5e1' }}>Search
                    <input value={marketFilters.search} onChange={(e) => updateMarketFilter('search', e.target.value)} placeholder="Search lead types..." />
                  </label>
                </div>

                <div id="licensed-state-selector" style={{ display: 'grid', gap: 6 }}>
                  <small style={{ color: '#cbd5e1' }}>Licensed States (click to select) *</small>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {availableStatesForMarketplace.map((s) => {
                      const selected = (marketFilters.states || []).includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          className="ghost"
                          style={{
                            borderColor: selected ? '#dc2626' : '#334155',
                            background: selected ? '#dc2626' : '#0f172a',
                            color: '#fff',
                            padding: '6px 10px',
                            borderRadius: 999
                          }}
                          onClick={() => toggleMarketState(s)}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select defaultValue="" onChange={(e) => {
                    const name = e.target.value;
                    if (!name) return;
                    applySavedMarketFilter(name);
                    e.currentTarget.value = '';
                  }}>
                    <option value="">Select saved filter</option>
                    {savedMarketFilters.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                  </select>
                  <button type="button" style={{ background: '#dc2626', color: '#fff' }} onClick={saveCurrentMarketFilter}>Save</button>
                  <button type="button" className="ghost" onClick={() => {
                    const name = typeof window !== 'undefined' ? window.prompt('Delete which saved filter? Enter exact name.') : '';
                    if (name) deleteSavedMarketFilter(name);
                  }}>Delete</button>
                  <button type="button" className="ghost" onClick={() => setMarketFilters({ ...MARKET_FILTER_DEFAULTS, states: [] })}>Clear</button>
                  <button type="button" className="ghost" onClick={() => setMarketFilters((prev) => ({ ...prev }))}>Refresh</button>
                </div>
              </div>
            ) : null}

            {marketTab === 'inventory' ? (
              <div style={{ border: '1px solid #334155', borderRadius: 10, overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 860 }}>
                  <thead>
                    <tr>
                      <th>Lead Type</th>
                      <th>Bucket</th>
                      <th>Lead Quality</th>
                      <th>Language</th>
                      <th>State Scope</th>
                      <th>Min Order</th>
                      <th>Price</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketFilteredRows.map((r, idx) => (
                      <tr key={r.key} style={{ background: idx % 2 === 0 ? '#030712' : '#0b1220', color: '#e2e8f0' }}>
                        <td style={{ color: '#f8fafc', fontWeight: 700 }}>{r.leadType}</td>
                        <td style={{ color: '#cbd5e1' }}>{r.bucket}</td>
                        <td style={{ color: '#cbd5e1' }}>{r.leadQuality}</td>
                        <td style={{ color: '#cbd5e1' }}>{r.language}</td>
                        <td style={{ color: '#cbd5e1' }}>{(marketFilters.states || []).length ? marketFilters.states.join(', ') : 'All Licensed States'}</td>
                        <td style={{ color: '#e2e8f0', fontWeight: 600 }}>{r.minQty}</td>
                        <td style={{ color: '#f8fafc', fontWeight: 700 }}>${r.unitPrice}</td>
                        <td>
                          <button
                            type="button"
                            style={{ background: '#dc2626', color: '#fff', cursor: 'pointer' }}
                            onClick={() => jumpToOrderFromMarket(r)}
                          >
                            Order
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!marketFilteredRows.length ? (
                      <tr>
                        <td colSpan={8} style={{ color: '#94a3b8', textAlign: 'center', padding: 16 }}>No lead inventory rows match your filters.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}

            {marketTab === 'orders' ? (
              <div style={{ border: '1px solid #334155', borderRadius: 10, overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 860 }}>
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Lead Type Purchased</th>
                      <th>Lead Package</th>
                      <th>Quantity</th>
                      <th>Amount</th>
                      <th>Ordered</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketOrderRows.map((r, idx) => (
                      <tr key={r.id || idx} style={{ background: idx % 2 === 0 ? '#030712' : '#0b1220', color: '#e2e8f0' }}>
                        <td style={{ color: '#cbd5e1' }}>{r.id || '—'}</td>
                        <td style={{ color: '#f8fafc', fontWeight: 700 }}>{r.leadType}</td>
                        <td style={{ color: '#cbd5e1', textTransform: 'capitalize' }}>{r.leadQuality}</td>
                        <td style={{ color: '#e2e8f0', fontWeight: 700 }}>{Number(r.quantity || 0)}</td>
                        <td style={{ color: '#cbd5e1' }}>${Number(r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ color: '#cbd5e1' }}>{r.orderedAt ? new Date(r.orderedAt).toLocaleString() : '—'}</td>
                        <td>
                          <span className="pill" style={{ background: String(r.status).toLowerCase() === 'delivered' ? '#065f46' : '#7c2d12', color: '#fff', textTransform: 'capitalize' }}>
                            {String(r.status || 'setup_pending').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td><button type="button" style={{ background: '#dc2626', color: '#fff' }} onClick={() => jumpToOrderFromMarket({ key: r.key, minQty: Number(r.quantity || 20) || 20 })}>Reorder</button></td>
                      </tr>
                    ))}
                    {!marketOrderRows.length ? (
                      <tr>
                        <td colSpan={8} style={{ color: '#94a3b8', textAlign: 'center', padding: 16 }}>
                          {orderHistoryLoading ? 'Loading order history...' : 'No lead orders found yet.'}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}

            {marketTab === 'scripts' ? (
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                {DOWNLOADABLE_SCRIPTS.map((s) => (
                  <article key={s.key} style={{ border: '1px solid #334155', borderRadius: 10, background: 'linear-gradient(180deg,#0b1220 0%, #111827 100%)', padding: 12, display: 'grid', gap: 8 }}>
                    <span className="pill" style={{ width: 'fit-content', background: '#1e293b', color: '#bfdbfe', border: '1px solid #334155' }}>{s.level}</span>
                    <strong style={{ color: '#fff' }}>{s.name}</strong>
                    <small style={{ color: '#94a3b8' }}>{s.type}</small>
                    <a href={s.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                      <button type="button" style={{ width: '100%', background: '#dc2626', color: '#fff' }}>Download Script</button>
                    </a>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
          ) : null}

          {setupCompleted ? (
            <section className="llGoatDash" style={{ marginBottom: 12, border: '1px solid #d1d5db', borderRadius: 16, background: '#f8fafc', padding: 10 }}>
              <div className="llGoatGrid" style={{ display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)', gap: 12 }}>
                <aside className="llGoatSidebar" style={{ border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff', padding: 12, display: 'grid', gap: 10, alignContent: 'start' }}>
                  <div style={{ borderBottom: '1px solid #eef2f7', paddingBottom: 10 }}>
                    <img src="/legacy-link-logo-official.png" alt="The Legacy Link" style={{ width: 34, height: 34, objectFit: 'contain', marginBottom: 6 }} />
                    <strong style={{ color: '#111827', display: 'block' }}>Link Leads Dashboard</strong>
                    <small style={{ color: '#6b7280' }}>Main Menu</small>
                  </div>
                  {['Dashboard', 'Leads', 'Lead Orders', 'Calendar', 'Export Profiles', 'Settings', 'Important Resources', 'Notifications'].map((item) => {
                    const isLeadsActive = item === 'Leads' && marketTab === 'inventory';
                    const isOrdersActive = item === 'Lead Orders' && marketTab === 'orders';
                    const isActive = isLeadsActive || isOrdersActive;
                    return (
                      <button
                        key={item}
                        type="button"
                        className="ghost"
                        style={{ justifyContent: 'flex-start', background: isActive ? '#fee2e2' : '#fff', color: isActive ? '#b91c1c' : '#374151', borderColor: '#e5e7eb' }}
                        onClick={() => {
                          if (item === 'Dashboard') {
                            if (typeof window !== 'undefined') window.location.href = '/inner-circle-hub';
                            return;
                          }
                          if (item === 'Leads') {
                            setMarketTab('inventory');
                            return;
                          }
                          if (item === 'Lead Orders') {
                            setMarketTab('orders');
                          }
                        }}
                      >
                        {item}
                      </button>
                    );
                  })}
                  <div style={{ borderTop: '1px solid #eef2f7', marginTop: 6, paddingTop: 8 }}>
                    <button type="button" className="ghost" style={{ width: '100%', justifyContent: 'flex-start', color: '#b91c1c', borderColor: '#fecaca', background: '#fff5f5' }}>Log Out</button>
                  </div>
                </aside>

                <div className="llGoatMain" style={{ border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff', padding: 12, display: 'grid', gap: 12 }}>
                  <div className="llGoatTopbar" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="pill" style={{ background: '#10b981', color: '#ecfeff', border: 'none' }}>$ AP Today: ${Number(perfSnapshot.todayEarned || 0).toLocaleString()} / {Number(perfSnapshot.todayClosed || 0)} Closed</span>
                    <span className="pill" style={{ background: '#10b981', color: '#ecfeff', border: 'none' }}>AP MTD: ${Number(perfSnapshot.mtdEarned || 0).toLocaleString()} / {Number(perfSnapshot.mtdClosed || 0)} Closed</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input placeholder="Search leads..." style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', minWidth: 190 }} />
                      <button type="button" className="ghost" style={{ background: '#fff', color: '#374151', borderColor: '#e5e7eb' }}>Home</button>
                      <button type="button" style={{ background: '#dc2626', color: '#fff' }} onClick={() => {
                        if (typeof window !== 'undefined') window.open('/linkleads/order-builder', '_blank', 'noopener,noreferrer');
                      }}>Order Leads</button>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', padding: '2px 8px 6px' }}>
                    <h2 style={{ margin: '2px 0', fontSize: 'clamp(38px,4.3vw,60px)', lineHeight: 1.03, color: '#111827', letterSpacing: '-0.02em' }}>High-Converting {selectedOrderType?.label || 'Insurance Leads'}</h2>
                    <div style={{ color: '#dc2626', fontSize: 'clamp(34px,3.8vw,52px)', fontWeight: 800, lineHeight: 1.05 }}>That Actually Close!</div>
                  </div>

                  <div className="llGoatContent" style={{ display: 'grid', gap: 12, alignItems: 'start', gridTemplateColumns: 'minmax(320px,1.05fr) minmax(360px,1.25fr)' }}>
                    <div className="llGoatLeadCard" style={{ border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff', padding: 12, display: 'grid', gap: 10 }}>
                      <strong style={{ color: '#374151' }}>{selectedOrderType?.label || 'Insurance Leads'}</strong>
                      <div className="llGoatVisualGrid" style={{ display: 'grid', placeItems: 'center', padding: 14, border: '1px solid #e5e7eb', borderRadius: 12, background: '#f8fafc' }}>
                        <img src={profilePhotoSrc} alt="The Legacy Link" style={{ width: 'min(100%, 180px)', height: 120, objectFit: 'contain', borderRadius: 10 }} />
                      </div>
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                        <div style={{ fontSize: 32, fontWeight: 800, color: '#111827', marginBottom: 6 }}>{selectedOrderType?.label}</div>
                        <p style={{ margin: 0, color: '#4b5563' }}>Perfect for agents targeting high-intent shoppers actively looking for life insurance.</p>
                        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span className="pill" style={{ background: '#dc2626', color: '#fff' }}>Filled in 2 Days</span>
                          <span className="pill" style={{ background: '#dc2626', color: '#fff' }}>Real-Time</span>
                          <span className="pill" style={{ background: '#dc2626', color: '#fff' }}>TCPA Compliant</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff', padding: 14, display: 'grid', gap: 12 }}>
                        <strong style={{ color: '#374151' }}>Lead Order Options</strong>

                        <div className="llPackageGrid" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
                          {LEAD_PACKAGES.map((pkg) => {
                            const active = pkg.key === leadPackage;
                            return (
                              <button
                                key={pkg.key}
                                type="button"
                                onClick={() => setLeadPackage(pkg.key)}
                                style={{ border: `1px solid ${active ? '#dc2626' : '#e5e7eb'}`, borderRadius: 12, background: active ? '#fff1f2' : '#fff', padding: 10, textAlign: 'left', cursor: 'pointer' }}
                              >
                                <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, background: pkg.accent, color: '#fff', fontSize: 10, fontWeight: 800 }}>{pkg.ribbon}</div>
                                <div style={{ marginTop: 8, fontWeight: 800, color: '#111827', fontSize: 24 }}>{pkg.title}</div>
                                <div style={{ marginTop: 3, color: '#dc2626', fontWeight: 800, fontSize: 46, lineHeight: 1 }}>${packageUnitPrice(selectedOrderType?.key, pkg.key, selectedOrderType?.unitPrice).toFixed(2)}</div>
                                <div style={{ color: '#4b5563', fontSize: 13, marginBottom: 2 }}>per lead</div>
                                <div style={{ marginTop: 6, color: '#4b5563', fontSize: 12, minHeight: 56 }}>
                                  {(selectedOrderType?.key === 'sponsor' && pkg.key === 'premium'
                                    ? ['Completed sponsorship form', 'Pre-qualified recruiting intent', 'Highest conversion potential']
                                    : pkg.bullets
                                  ).map((b) => <div key={b}>• {b}</div>)}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        <div className="llOrderTopGrid" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0,1fr) 140px' }}>
                          <label style={{ display: 'grid', gap: 6, color: '#111827' }}>Lead Type
                            <select value={order.leadType} onChange={(e) => updateOrder('leadType', e.target.value)} style={{ border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 12px', background: '#fff', minHeight: 44 }}>
                              {ORDER_MENU.map((x) => (
                                <option key={x.key} value={x.key}>{x.label} (from ${packageUnitPrice(x.key, 'standard', x.unitPrice).toFixed(2)}/lead)</option>
                              ))}
                            </select>
                          </label>

                          <label style={{ display: 'grid', gap: 6, color: '#111827' }}>Quantity
                            <input type="number" min={selectedOrderType?.minQty || 20} step={5} value={normalizedQty} onChange={(e) => updateOrder('quantity', normalizeOrderQuantity(e.target.value, selectedOrderType?.minQty || 20))} style={{ border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 12px', minHeight: 44 }} />
                          </label>
                        </div>

                        <div className="llFieldsGrid" style={{ display: 'grid', gap: 16, alignItems: 'start', gridTemplateColumns: '1fr' }}>
                          <div style={{ border: '1px solid #dc2626', borderRadius: 12, padding: 14, background: '#fff' }}>
                            <div className="llLeadFieldsSplit" style={{ display: 'grid', gap: 20, gridTemplateColumns: '1fr 1fr' }}>
                              <div>
                                <strong style={{ color: '#dc2626', display: 'block', marginBottom: 6 }}>Standard Lead Fields</strong>
                                <div style={{ color: '#374151', fontWeight: 700, marginBottom: 2 }}>Contact Info:</div>
                                <ul style={{ margin: '0 0 8px 20px', color: '#4b5563', lineHeight: 1.6 }}>
                                  <li>First Name</li>
                                  <li>Last Name</li>
                                  <li>Phone Number</li>
                                  <li>Email Address</li>
                                  <li>State</li>
                                </ul>
                                <div style={{ color: '#374151', fontWeight: 700, marginBottom: 2 }}>IUL Specific Details:</div>
                                <ul style={{ margin: '0 0 0 18px', color: '#4b5563', lineHeight: 1.6 }}>
                                  <li>IUL Goal</li>
                                  <li>Employment Status</li>
                                  <li>Desired Contribution</li>
                                  <li>Desired Retirement Age</li>
                                  <li>Current Retirement Plan</li>
                                </ul>
                              </div>
                              <div style={{ borderLeft: '1px solid #fee2e2', paddingLeft: 18 }}>
                                <strong style={{ color: '#dc2626', display: 'block', marginBottom: 6 }}>Premium Lead Fields</strong>
                                <div style={{ color: '#374151', fontWeight: 700, marginBottom: 2 }}>All Standard Fields +</div>
                                <ul style={{ margin: '0 0 8px 18px', color: '#4b5563', lineHeight: 1.6 }}>
                                  <li>Date Of Birth</li>
                                  <li>Age</li>
                                  <li>OTP Code (When Available)</li>
                                  <li>IP Address</li>
                                  <li>Trusted Form URL</li>
                                </ul>
                                {selectedOrderType?.key === 'sponsor' ? (
                                  <div style={{ border: '1px solid #fecaca', background: '#fff1f2', color: '#9f1239', borderRadius: 10, padding: '8px 10px', fontWeight: 700, marginBottom: 8 }}>
                                    Recruiting Premium Note: These leads are people who already completed the sponsorship form and were approved.
                                  </div>
                                ) : null}
                                <div style={{ color: '#4b5563' }}>All leads generated on landing pages/websites.</div>
                              </div>
                            </div>
                            <small style={{ color: '#6b7280', display: 'block', marginTop: 8 }}>Selected quality: <strong>{selectedLeadPackage.title}</strong></small>
                          </div>
                        </div>

                        <div style={{ border: '1px solid #dc2626', borderRadius: 12, padding: 12, background: '#fff5f5', maxWidth: 520, margin: '4px 0 0 auto' }}>
                          <small style={{ color: '#7f1d1d', fontWeight: 700 }}>Estimated Amount</small>
                          <div style={{ fontSize: 42, color: '#111827', fontWeight: 800, lineHeight: 1.05, marginTop: 2 }}>${discountedSubtotal.toLocaleString()}</div>
                          <small style={{ color: '#6b7280' }}>{selectedOrderType?.label} • {normalizedQty} leads</small>
                        </div>

                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 10, background: '#f9fafb', display: 'grid', gap: 8 }}>
                          <div className="panelRow" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            <small style={{ color: '#374151', fontWeight: 700 }}>Licensed States (click to add/remove) • {(setup.licensedStates || []).length}</small>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" className="ghost" onClick={() => updateOrder('targetState', 'all')}>Route: All</button>
                            </div>
                          </div>

                          <div className="llStateGrid" style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(10,minmax(0,1fr))' }}>
                            {US_STATES.map((stateName) => {
                              const selected = setup.licensedStates.includes(stateName);
                              const short = US_STATE_CODE_BY_NAME[stateName] || stateName.slice(0, 2).toUpperCase();
                              return (
                                <button
                                  key={stateName}
                                  type="button"
                                  onClick={() => toggleLicensedState(stateName)}
                                  style={{ border: '1px solid #dc2626', borderRadius: 6, background: selected ? '#dc2626' : '#fff', color: selected ? '#fff' : '#dc2626', padding: '5px 6px', fontSize: 11, fontWeight: 700 }}
                                  title={stateName}
                                >
                                  {short}
                                </button>
                              );
                            })}
                          </div>

                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {(setup.licensedStates || []).map((s) => {
                              const active = order.targetState === s;
                              return (
                                <button key={`route-${s}`} type="button" onClick={() => updateOrder('targetState', s)} style={{ border: '1px solid #334155', borderRadius: 999, background: active ? '#0f172a' : '#fff', color: active ? '#fff' : '#334155', padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                                  Route {s}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <small style={{ color: '#374151', fontWeight: 700 }}>Delivery Days</small>
                          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {WEEK_DAYS.map((d) => {
                              const selected = setup.defaultDays.includes(d);
                              return (
                                <button key={d} type="button" onClick={() => toggleDefaultDay(d)} style={{ border: '1px solid #dc2626', borderRadius: 6, background: selected ? '#dc2626' : '#fff', color: selected ? '#fff' : '#dc2626', padding: '6px 10px', fontWeight: 700 }}>
                                  {d.toUpperCase()}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                          <label style={{ display: 'grid', gap: 6, color: '#111827' }}>Max Per Day
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button type="button" className="ghost" onClick={() => {
                                const current = Number(setup.dailyLeadCap || 0);
                                const next = Math.max(0, current - 1);
                                updateSetup('dailyLeadCap', next ? String(next) : '-');
                              }}>−</button>
                              <strong style={{ color: '#111827', minWidth: 28, textAlign: 'center' }}>{setup.dailyLeadCap || '-'}</strong>
                              <button type="button" className="ghost" onClick={() => {
                                const current = Number(setup.dailyLeadCap || 0);
                                const next = Math.min(100, current + 1);
                                updateSetup('dailyLeadCap', String(next || 1));
                              }}>+</button>
                              <small style={{ color: '#6b7280' }}>Daily routing cap</small>
                            </div>
                          </label>
                        </div>

                        <div style={{ border: '1px solid #dc2626', borderRadius: 12, padding: 12 }}>
                          <strong style={{ color: '#374151' }}>Your Order Total</strong>
                          <div style={{ fontSize: 52, color: '#111827', fontWeight: 800 }}>${discountedSubtotal.toLocaleString()}</div>
                          <small style={{ color: '#6b7280' }}>({selectedOrderType?.label} • {normalizedQty} leads)</small>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {(!setupCompleted || showSetupEditor) ? (
          <section id="first-time-setup" style={{ marginBottom: 12, border: '1px solid #334155', borderRadius: 12, background: '#020617', padding: 12 }}>
            <div className="panelRow" style={{ justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <strong style={{ color: '#fff' }}>First-Time Setup (Required)</strong>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {setupCompleted ? <span className="pill" style={{ background: '#065f46', color: '#d1fae5' }}>Saved</span> : <span className="pill" style={{ background: '#7c2d12', color: '#ffedd5' }}>Complete this once</span>}
                {setupCompleted ? (
                  <button type="button" className="ghost" onClick={() => setShowSetupEditor((prev) => !prev)}>
                    {showSetupEditor ? 'Hide Defaults Editor' : 'Edit Defaults'}
                  </button>
                ) : null}
              </div>
            </div>
            <small style={{ color: '#94a3b8', display: 'block', marginBottom: 10 }}>
              Complete these defaults one time. These settings apply to future lead routing preferences.
            </small>

            {setupCompleted && !showSetupEditor ? (
              <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#0b1220', padding: 12, display: 'grid', gap: 8 }}>
                <strong style={{ color: '#e2e8f0' }}>Profile Defaults Saved</strong>
                <small style={{ color: '#94a3b8' }}>
                  This profile is complete. You can edit anytime if your licensed states, days, or routing preferences change.
                </small>
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
                  <div style={{ border: '1px solid #24314f', borderRadius: 8, padding: 8, background: '#020617' }}>
                    <small style={{ color: '#94a3b8' }}>Licensed States</small>
                    <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{(setup.licensedStates || []).length}</div>
                  </div>
                  <div style={{ border: '1px solid #24314f', borderRadius: 8, padding: 8, background: '#020617' }}>
                    <small style={{ color: '#94a3b8' }}>Default Days</small>
                    <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{(setup.defaultDays || []).join(', ') || '-'}</div>
                  </div>
                  <div style={{ border: '1px solid #24314f', borderRadius: 8, padding: 8, background: '#020617' }}>
                    <small style={{ color: '#94a3b8' }}>Daily Lead Cap</small>
                    <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{setup.dailyLeadCap || '-'}</div>
                  </div>
                </div>
              </div>
            ) : (
              <>
            <div style={{ display: 'grid', gap: 10, marginBottom: 10 }}>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
                {SETUP_STEPS.map((label, idx) => {
                  const active = idx === setupStep;
                  const done = idx < setupStep;
                  return (
                    <div key={label} style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: active ? 'rgba(185,28,28,0.18)' : '#020617', position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 999, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 11, background: done || active ? '#dc2626' : '#1e293b', color: '#fff' }}>
                          {idx + 1}
                        </div>
                        <div>
                          <small style={{ color: done ? '#86efac' : active ? '#fecaca' : '#94a3b8', fontWeight: 700, display: 'block', lineHeight: 1.1 }}>Step {idx + 1}</small>
                          <div style={{ color: '#e2e8f0', fontWeight: active ? 700 : 600, fontSize: 13 }}>{label}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {setupStep === 0 ? (
              <>
                <h4 style={{ marginTop: 2, marginBottom: 4, color: '#bfdbfe' }}>Personal Information</h4>
                <small style={{ color: '#94a3b8', display: 'block', marginBottom: 8 }}>Enter your personal and contact profile details.</small>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>First Name *<input value={setup.firstName} onChange={(e) => updateSetup('firstName', e.target.value)} /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Last Name *<input value={setup.lastName} onChange={(e) => updateSetup('lastName', e.target.value)} /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Email *<input type="email" value={setup.email} onChange={(e) => updateSetup('email', e.target.value)} /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Phone Number *<input value={setup.phone} onChange={(e) => updateSetup('phone', e.target.value)} placeholder="(646) 945-9530" /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Date Of Birth *<input type="date" value={setup.dateOfBirth} onChange={(e) => updateSetup('dateOfBirth', e.target.value)} /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Time Zone *
                    <select value={setup.timeZone} onChange={(e) => updateSetup('timeZone', e.target.value)}>{TIME_ZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}</select>
                  </label>
                </div>

                <h4 style={{ marginTop: 12, marginBottom: 8, color: '#bfdbfe' }}>Home Address</h4>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Street Address *<input value={setup.homeStreet} onChange={(e) => updateSetup('homeStreet', e.target.value)} /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>City *<input value={setup.homeCity} onChange={(e) => updateSetup('homeCity', e.target.value)} /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>State *<input value={setup.homeState} onChange={(e) => updateSetup('homeState', e.target.value)} /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Zip Code *<input value={setup.homeZip} onChange={(e) => updateSetup('homeZip', e.target.value)} /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Country *
                    <select value={setup.homeCountry} onChange={(e) => updateSetup('homeCountry', e.target.value)}>
                      <option value="United States">United States</option>
                    </select>
                  </label>
                </div>
              </>
            ) : null}

            {setupStep === 1 ? (
              <>
                <h4 style={{ marginTop: 2, marginBottom: 4, color: '#bfdbfe' }}>Business Information</h4>
                <small style={{ color: '#94a3b8', display: 'block', marginBottom: 8 }}>Tell us where you operate and where you are licensed.</small>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Title *<input value={setup.title} onChange={(e) => updateSetup('title', e.target.value)} /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>NPN ID *<input value={setup.npnId} onChange={(e) => updateSetup('npnId', e.target.value.replace(/\D/g, ''))} /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>IMO / Agency *<input value={setup.imoAgency} onChange={(e) => updateSetup('imoAgency', e.target.value)} /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Agent Website<input value={setup.agentWebsite} onChange={(e) => updateSetup('agentWebsite', e.target.value)} placeholder="https://example.com" /></label>
                </div>

                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, color: '#cbd5e1' }}>
                  <input type="checkbox" checked={setup.sameAsHomeAddress} onChange={(e) => {
                    const checked = e.target.checked;
                    updateSetup('sameAsHomeAddress', checked);
                    if (checked) {
                      setSetup((prev) => ({
                        ...prev,
                        businessStreet: prev.homeStreet,
                        businessCity: prev.homeCity,
                        businessState: prev.homeState,
                        businessZip: prev.homeZip,
                        businessCountry: prev.homeCountry
                      }));
                    }
                  }} />
                  Same As Home Address
                </label>

                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', marginTop: 8 }}>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Business Street Address
                    <input disabled={setup.sameAsHomeAddress} value={setup.sameAsHomeAddress ? setup.homeStreet : setup.businessStreet} onChange={(e) => updateSetup('businessStreet', e.target.value)} />
                  </label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Business City
                    <input disabled={setup.sameAsHomeAddress} value={setup.sameAsHomeAddress ? setup.homeCity : setup.businessCity} onChange={(e) => updateSetup('businessCity', e.target.value)} />
                  </label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Business State
                    <input disabled={setup.sameAsHomeAddress} value={setup.sameAsHomeAddress ? setup.homeState : setup.businessState} onChange={(e) => updateSetup('businessState', e.target.value)} />
                  </label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Business Zip
                    <input disabled={setup.sameAsHomeAddress} value={setup.sameAsHomeAddress ? setup.homeZip : setup.businessZip} onChange={(e) => updateSetup('businessZip', e.target.value)} />
                  </label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Business Country
                    <select disabled={setup.sameAsHomeAddress} value={setup.sameAsHomeAddress ? setup.homeCountry : setup.businessCountry} onChange={(e) => updateSetup('businessCountry', e.target.value)}>
                      <option value="United States">United States</option>
                    </select>
                  </label>
                </div>

                <div style={{ marginTop: 12, border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#0b1220' }}>
                  <strong style={{ color: '#e2e8f0' }}>Licensed States ({setup.licensedStates.length} selected)</strong>
                  <small style={{ display: 'block', color: '#94a3b8', marginTop: 4 }}>
                    We simplified this step: licensed states are selected once above using “Licensed States (click to select)”.
                  </small>
                  <small style={{ display: 'block', color: '#cbd5e1', marginTop: 6 }}>
                    Current: {setup.licensedStates.length ? setup.licensedStates.join(', ') : 'No states selected yet'}
                  </small>
                  <div style={{ marginTop: 8 }}>
                    <button type="button" className="ghost" onClick={() => document.getElementById('licensed-state-selector')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                      Edit Licensed States Above
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {setupStep === 2 ? (
              <>
                <h4 style={{ marginTop: 2, marginBottom: 6, color: '#bfdbfe' }}>Lead Preferences</h4>
                <small style={{ color: '#94a3b8', display: 'block', marginBottom: 8 }}>Making a change here does not affect current lead orders.</small>
                <label style={{ color: '#cbd5e1' }}><input type="checkbox" checked={setup.useProfileInfo} onChange={(e) => updateSetup('useProfileInfo', e.target.checked)} /> Use Profile Info (Name, NPN, Email, Phone)</label>
                <label style={{ color: '#cbd5e1', display: 'block', marginTop: 6 }}><input type="checkbox" checked={setup.useProfileInfoThankYou} onChange={(e) => updateSetup('useProfileInfoThankYou', e.target.checked)} /> Use Profile Info For Thank You Page</label>

                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', marginTop: 8 }}>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Display Agent Title<input disabled={setup.useProfileInfo} value={setup.displayAgentTitle} onChange={(e) => updateSetup('displayAgentTitle', e.target.value)} /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Display Agent Name<input disabled={setup.useProfileInfo} value={setup.displayAgentName} onChange={(e) => updateSetup('displayAgentName', e.target.value)} /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Display Agent NPN<input disabled={setup.useProfileInfo} value={setup.displayAgentNpn} onChange={(e) => updateSetup('displayAgentNpn', e.target.value.replace(/\D/g, ''))} /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Display Agent Email<input disabled={setup.useProfileInfo} value={setup.displayAgentEmail} onChange={(e) => updateSetup('displayAgentEmail', e.target.value)} /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Display Agent Phone
                    <input disabled={setup.useProfileInfo} value={setup.displayAgentPhone} onChange={(e) => updateSetup('displayAgentPhone', e.target.value)} />
                    {setup.displayAgentPhone ? <small style={{ color: '#86efac' }}>✓ Verified</small> : null}
                  </label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Display Agent Website<input disabled={setup.useProfileInfo} value={setup.displayAgentWebsite} onChange={(e) => updateSetup('displayAgentWebsite', e.target.value)} /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Display Agent Calendar Link<input value={setup.displayAgentCalendarLink} onChange={(e) => updateSetup('displayAgentCalendarLink', e.target.value)} placeholder="https://calendar.example.com" /></label>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Upload Profile Picture
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) {
                          updateSetup('profilePhotoName', '');
                          updateSetup('profilePhotoDataUrl', '');
                          return;
                        }
                        updateSetup('profilePhotoName', file.name || 'profile-photo');
                        const reader = new FileReader();
                        reader.onload = () => {
                          updateSetup('profilePhotoDataUrl', String(reader.result || ''));
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    {setup.profilePhotoName ? <small style={{ color: '#94a3b8' }}>{setup.profilePhotoName}</small> : null}
                    {setup.profilePhotoDataUrl ? <img src={setup.profilePhotoDataUrl} alt="Profile preview" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 999, border: '1px solid #334155' }} /> : null}
                  </label>
                </div>

                <h4 style={{ marginTop: 12, marginBottom: 8, color: '#bfdbfe' }}>Default Days Per Week</h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 0, marginBottom: 8 }}>
                  {WEEK_DAYS.map((d) => {
                    const selected = setup.defaultDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        className="ghost"
                        style={{
                          borderColor: selected ? '#dc2626' : '#334155',
                          background: selected ? '#dc2626' : '#0f172a',
                          color: '#fff'
                        }}
                        onClick={() => toggleDefaultDay(d)}
                      >
                        {d}
                      </button>
                    );
                  })}
                  <button type="button" style={{ background: '#dc2626', color: '#fff' }} onClick={() => updateSetup('defaultDays', [...WEEK_DAYS])}>Select all days</button>
                </div>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                  <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>Daily Lead Cap *
                    <select value={setup.dailyLeadCap} onChange={(e) => updateSetup('dailyLeadCap', e.target.value)}>{DAILY_CAP_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                    <small style={{ color: '#94a3b8' }}>Minimum 5. Set your daily cap to control how many leads route each day.</small>
                  </label>
                </div>

                <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                  <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#0b1220' }}>
                    <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: 8 }}>Send “Agent Details” On Assignment To Lead</strong>
                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                      <label style={{ color: '#cbd5e1' }}><input type="checkbox" checked={setup.sendAgentDetailsEmail} onChange={(e) => updateSetup('sendAgentDetailsEmail', e.target.checked)} /> Email</label>
                      <label style={{ color: '#cbd5e1' }}><input type="checkbox" checked={setup.sendAgentDetailsSms} onChange={(e) => updateSetup('sendAgentDetailsSms', e.target.checked)} /> Text Message</label>
                    </div>
                  </div>

                  <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#0b1220' }}>
                    <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: 8 }}>Send “Lead Details” On Assignment To Agent</strong>
                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                      <label style={{ color: '#cbd5e1' }}><input type="checkbox" checked={setup.sendLeadDetailsEmail} onChange={(e) => updateSetup('sendLeadDetailsEmail', e.target.checked)} /> Email</label>
                      <label style={{ color: '#cbd5e1' }}><input type="checkbox" checked={setup.sendLeadDetailsSms} onChange={(e) => updateSetup('sendLeadDetailsSms', e.target.checked)} /> Text Message</label>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="ghost"
                style={{ background: '#fff', color: '#111827', borderColor: '#cbd5e1' }}
                disabled={setupStep === 0}
                onClick={() => setSetupStep((prev) => Math.max(0, prev - 1))}
              >
                Back
              </button>
              <button type="button" className="ghost" style={{ background: '#0f172a', color: '#fff', borderColor: '#334155' }} onClick={() => saveSetup(false)}>Save for Later</button>
              {setupStep < SETUP_STEPS.length - 1 ? (
                <button type="button" style={{ background: '#dc2626', color: '#fff' }} onClick={() => {
                  const valid = setupStep === 0 ? isPersonalStepValid(setup) : (setupStep === 1 ? isBusinessStepValid(setup) : isLeadDefaultsStepValid(setup));
                  if (!valid) {
                    setSetupError('Some required fields are still missing in this step. You can continue, but setup must be fully complete before ordering.');
                  } else {
                    setSetupError('');
                  }
                  setSetupStep((prev) => Math.min(SETUP_STEPS.length - 1, prev + 1));
                }}>Next</button>
              ) : (
                <button type="button" style={{ background: '#dc2626', color: '#fff' }} onClick={() => {
                  if (!validateSetup(setup)) {
                    const firstInvalidStep = !isPersonalStepValid(setup) ? 0 : (!isBusinessStepValid(setup) ? 1 : 2);
                    const missing = getMissingSetupFields(setup);
                    setSetupStep(firstInvalidStep);
                    setSetupError(`Please complete all required setup fields before continuing. Missing: ${missing.join(', ')}.`);
                    return;
                  }
                  saveSetup(true);
                }}>Save + Mark Complete</button>
              )}
            </div>

            {setupError ? <p style={{ color: '#fca5a5', marginBottom: 0 }}>{setupError}</p> : null}
              </>
            )}
          </section>
          ) : (
            <section style={{ marginBottom: 12, border: '1px solid #1f2a44', borderRadius: 12, background: '#0b1220', padding: 12 }}>
              <div className="panelRow" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'grid', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ color: '#e2e8f0' }}>First-Time Setup Saved</strong>
                    <span style={{ border: '1px solid #16a34a', background: '#052e16', color: '#86efac', borderRadius: 999, fontSize: 11, fontWeight: 800, padding: '2px 8px', letterSpacing: '.02em' }}>COMPLETED</span>
                  </div>
                  <small style={{ color: '#94a3b8' }}>Your profile defaults are complete and hidden by default.</small>
                </div>
                <button type="button" className="ghost" onClick={() => setShowSetupEditor(true)}>Show / Edit Setup</button>
              </div>
            </section>
          )}

          <div style={{ display: setupCompleted ? 'none' : 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>
              Lead Type
              <select value={order.leadType} onChange={(e) => updateOrder('leadType', e.target.value)} style={{ width: '100%', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#e2e8f0', padding: '10px 12px' }}>
                {ORDER_MENU.map((x) => (
                  <option key={x.key} value={x.key}>{x.label} (from ${packageUnitPrice(x.key, 'standard', x.unitPrice).toFixed(2)}/lead • min {x.minQty})</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6, color: '#e2e8f0' }}>
              Quantity
              <input
                type="number"
                min={selectedOrderType?.minQty || 20}
                step={5}
                value={normalizedQty}
                onChange={(e) => updateOrder('quantity', normalizeOrderQuantity(e.target.value, selectedOrderType?.minQty || 20))}
                style={{ width: '100%', borderRadius: 10, border: '1px solid #334155', background: '#020617', color: '#e2e8f0', padding: '10px 12px' }}
              />
            </label>

            <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#020617', padding: 12, color: '#e2e8f0', display: 'grid', gap: 6 }}>
              <small style={{ color: '#94a3b8' }}>Estimated Subtotal</small>
              <strong style={{ fontSize: 24, color: '#fbbf24' }}>${discountedSubtotal.toLocaleString()}</strong>
              {order.subscriptionWeekly ? (
                <small style={{ color: '#bbf7d0', fontWeight: 700 }}>
                  Weekly Subscription Discount (<span style={{ color: '#fbbf24' }}>{WEEKLY_SUBSCRIPTION_DISCOUNT_PCT}%</span>): -${subscriptionDiscount.toLocaleString()}
                </small>
              ) : null}
              {!order.subscriptionWeekly ? <small style={{ color: '#94a3b8' }}>One-time order subtotal: ${estimatedSubtotal.toLocaleString()}</small> : null}
              <small style={{ color: '#94a3b8' }}>{selectedOrderType?.label} • {normalizedQty} leads • {order.targetState === 'all' ? 'All Licensed States' : order.targetState}</small>
            </div>
          </div>

          <details style={{ marginTop: 12, border: '1px solid #475569', borderRadius: 12, background: '#0b1220', padding: 12 }}>
            <summary style={{ cursor: 'pointer', color: '#e2e8f0', fontWeight: 700 }}>Lead Purchase + Replacement Policy (required before checkout)</summary>
            <div className="llPolicyReadable" style={{ marginTop: 10, color: '#e2e8f0', fontSize: 13, lineHeight: 1.7 }}>
              <p style={{ marginTop: 0 }}>
                The Legacy Link is committed to providing quality leads. By purchasing leads, you acknowledge that all sales are final,
                you waive your right to a refund, and you waive your right to dispute lead charges for any reason.
              </p>
              <p>
                <strong>Replacement window:</strong> requests must be submitted within <strong>72 hours</strong> of order fulfillment.
              </p>
              <p style={{ marginBottom: 6 }}><strong>Eligible for replacement:</strong></p>
              <ul style={{ marginTop: 0 }}>
                <li>Disconnected phone number (AI validation)</li>
                <li>Duplicate lead received within 60 days</li>
                <li>Lead age above 85 with DOB available (AI validation)</li>
                <li>Lead delivered outside ordered geographic territory (AI validation)</li>
                <li>Lead already sold by an agent who purchased from us (phone + SOLD-status match)</li>
              </ul>
              <p style={{ marginBottom: 6 }}><strong>Not eligible for replacement:</strong></p>
              <ul style={{ marginTop: 0 }}>
                <li>Unresponsive numbers (no answers/voicemail)</li>
                <li>Wrong numbers / wrong info</li>
                <li>Duplicates received more than 60 days apart</li>
                <li>Free leads</li>
                <li>OTP (SMS-verified) leads unless aged 45+ days</li>
              </ul>
              <p style={{ marginBottom: 0 }}>
                We apply this policy consistently to maintain quality, competitive pricing, and long-term lead performance.
              </p>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                Full policy: <a href="/welcome/lead-replacement-policy" target="_blank" rel="noreferrer">View Lead Replacement Policy</a>
              </p>
            </div>
          </details>

          <div style={{ marginTop: 10, border: '1px solid #334155', borderRadius: 12, background: '#020617', padding: 12, display: 'grid', gap: 8 }}>
            <strong style={{ color: '#e2e8f0' }}>Weekly Subscription</strong>
            <label style={{ color: '#cbd5e1', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={order.subscriptionWeekly} onChange={(e) => updateOrder('subscriptionWeekly', e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                Yes, apply a <strong style={{ color: '#fbbf24', fontSize: 16 }}>{WEEKLY_SUBSCRIPTION_DISCOUNT_PCT}% discount</strong> and enroll this lead type for weekly recurring delivery.
              </span>
            </label>
            <small style={{ color: '#94a3b8' }}>You can pause recurring weekly delivery anytime from your account manager.</small>
            <small style={{ color: '#94a3b8' }}>Minimum order: {selectedOrderType?.minQty} leads for {selectedOrderType?.label}.</small>
          </div>

          <section style={{ marginTop: 10, border: '1px solid #334155', borderRadius: 12, background: '#0b1220', padding: 12, display: 'grid', gap: 8 }}>
            <div className="panelRow" style={{ justifyContent: 'space-between' }}>
              <strong style={{ color: '#e2e8f0' }}>Digital Signature</strong>
              <button type="button" className="ghost" onClick={clearSignature}>Clear</button>
            </div>
            <canvas
              ref={signatureCanvasRef}
              width={1200}
              height={220}
              onMouseDown={beginSignature}
              onMouseMove={drawSignature}
              onMouseUp={endSignature}
              onMouseLeave={endSignature}
              onTouchStart={beginSignature}
              onTouchMove={drawSignature}
              onTouchEnd={endSignature}
              style={{ width: '100%', height: 220, borderRadius: 10, border: '1px solid #475569', background: '#e5e7eb', touchAction: 'none' }}
            />
            <small style={{ color: '#94a3b8' }}>Sign above to confirm your order.</small>
            <small style={{ color: '#94a3b8' }}>Your IP Address: <strong style={{ color: '#e2e8f0' }}>{clientIp || 'Capturing...'}</strong></small>
          </section>

          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, color: '#e2e8f0' }}>
            <input type="checkbox" checked={policyAccepted} onChange={(e) => setPolicyAccepted(e.target.checked)} style={{ marginTop: 3 }} />
            <small style={{ color: '#cbd5e1' }}>
              I acknowledge and agree to the Lead Purchase + Replacement Policy, including final-sale terms and 72-hour replacement submission window.
            </small>
          </label>

          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={startCheckout} disabled={orderLoading}>
              {orderLoading ? 'Starting Secure Checkout...' : (setupReady ? 'Pay & Reserve Leads' : 'Complete Setup to Unlock Checkout')}
            </button>
            <small style={{ color: '#94a3b8' }}>After payment, setup + delivery starts and is completed within 48 hours.</small>
          </div>
          {orderError ? <p style={{ color: '#fca5a5', marginBottom: 0 }}>{orderError}</p> : null}
        </section>

        <section id="pricing" className="llMarketingSection" style={{ marginTop: 14, border: '1px solid #1f2a44', borderRadius: 14, padding: 14, background: '#0b1220' }}>
          <h3 style={{ marginTop: 0, color: '#fff' }}>Aged Leads Store</h3>
          <p style={{ color: '#94a3b8' }}>Discounted inventory for dial-heavy and nurture-focused teams.</p>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
            {AGED_LEADS.map((a) => (
              <div key={a.name} style={{ border: '1px solid #24314f', borderRadius: 10, background: '#020617', padding: 10, textAlign: 'center' }}>
                <strong style={{ color: '#e2e8f0' }}>{a.name}</strong>
                <div style={{ color: '#60a5fa' }}>from {a.price}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <a href="/linkleads/order-builder" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><button type="button">Order Aged Leads</button></a>
          </div>
        </section>

        <section id="stories" className="llMarketingSection" style={{ marginTop: 14, border: '1px solid #1f2a44', borderRadius: 14, padding: 14, background: '#0b1220' }}>
          <div className="panelRow" style={{ marginBottom: 10 }}>
            <h3 style={{ color: '#fff', margin: 0 }}>Success Stories from Insurance Agents</h3>
            <span className="pill onpace">Trusted by producers</span>
          </div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
            {TESTIMONIALS.map((t) => (
              <article key={t.quote} className="llHoverCard" style={{ border: '1px solid #24314f', borderRadius: 12, background: '#020617', padding: 12 }}>
                <div style={{ color: '#f59e0b', marginBottom: 6 }}>★★★★★</div>
                <p style={{ margin: 0, color: '#e2e8f0', fontStyle: 'italic' }}>“{t.quote}”</p>
                <p style={{ margin: '8px 0 0', color: '#cbd5e1' }}><strong>{t.name}</strong> • {t.role}</p>
                <small style={{ color: '#94a3b8' }}>{t.result}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="llMarketingSection" style={{ marginTop: 14, border: '1px solid #1f2a44', borderRadius: 14, padding: 14, background: '#0b1220' }}>
          <h3 style={{ marginTop: 0, color: '#fff' }}>How It Works</h3>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            {[
              ['1', 'Open Lead Market', 'Access Link Leads inventory with your account.'],
              ['2', 'Choose Lead Type', 'Select category, volume, and target state strategy.'],
              ['3', 'Checkout + Delivery', 'Complete payment and route leads to your account.']
            ].map(([n, h, d]) => (
              <div key={n} style={{ border: '1px solid #24314f', borderRadius: 12, background: '#020617', padding: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 999, background: '#1d4ed8', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, marginBottom: 6 }}>{n}</div>
                <strong style={{ color: '#e2e8f0', display: 'block' }}>{h}</strong>
                <small style={{ color: '#94a3b8' }}>{d}</small>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="llMarketingSection" style={{ marginTop: 14, border: '1px solid #1f2a44', borderRadius: 14, padding: 14, background: '#0b1220' }}>
          <h3 style={{ marginTop: 0, color: '#fff' }}>Got Questions? We’ve Got Answers</h3>
          {FAQ.map((f) => (
            <details key={f.q} style={{ border: '1px solid #24314f', borderRadius: 10, background: '#020617', padding: 10, marginTop: 8 }}>
              <summary style={{ color: '#e2e8f0', cursor: 'pointer', fontWeight: 700 }}>{f.q}</summary>
              <p style={{ color: '#94a3b8', marginBottom: 0 }}>{f.a}</p>
            </details>
          ))}
        </section>

        <section className="llMarketingSection" style={{ marginTop: 14, border: '1px solid #1f2a44', borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg,#0b1220 0%, #172554 100%)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Ready to Scale Production This Week?</h3>
              <p style={{ color: '#cbd5e1', margin: 0 }}>Get into Link Leads now, place your first order, and start routing high-intent opportunities to your team account.</p>
              <div style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, background: 'rgba(2,6,23,0.5)', padding: 12 }}>
                <strong style={{ color: '#fff', display: 'block', marginBottom: 6 }}>About Kimora Link</strong>
                <p style={{ color: '#cbd5e1', margin: 0, fontSize: 14, lineHeight: 1.7 }}>
                  In just over two years, I’ve focused on building real economic impact through insurance production, leadership, and community service.
                  We’ve scaled to a network of 300+ agents, created multiple income streams from one ecosystem, and put more than $80 million back into our community.
                  Link Leads is designed for serious professionals who want premium opportunities, consistent volume, and the right infrastructure to scale.
                </p>
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.16)' }}>
                  <div style={{ color: '#fbbf24', fontSize: 30, lineHeight: 1, fontFamily: '"Snell Roundhand", "Brush Script MT", cursive' }}>Kimora Link</div>
                  <small style={{ color: '#bfdbfe', letterSpacing: '.08em', textTransform: 'uppercase' }}>Founder • The Legacy Link</small>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a href="/linkleads/order-builder" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><button type="button">Open Order Builder</button></a>
              </div>
            </div>
            <div style={{ minHeight: 200, position: 'relative' }}>
              <img src="https://assets.cdn.filesafe.space/I7bXOorPHk415nKgsFfa/media/69b30058222c33827f16510f.png" alt="Kimora Link" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(2,6,23,0.12) 0%, rgba(2,6,23,0.56) 100%)' }} />
            </div>
          </div>
        </section>

        <section id="contact" className="llMarketingSection" style={{ marginTop: 14, border: '1px solid #1f2a44', borderRadius: 14, padding: 14, background: '#0b1220' }}>
          <h3 style={{ marginTop: 0, color: '#fff' }}>Request Access</h3>
          <p style={{ color: '#94a3b8' }}>To activate ordering, contact support with your name, product type, target states, and order size.</p>
          <p style={{ marginBottom: 0, color: '#cbd5e1' }}>
            <strong>Phone:</strong> <a href={telHref}>{CONTACT.phone}</a> &nbsp;•&nbsp;
            <strong>Email:</strong> <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          </p>
          <small style={{ color: '#94a3b8' }}>Address: {CONTACT.address}</small>
        </section>

        <footer className="llFooterMain" style={{ marginTop: 12, borderTop: '1px solid #1f2a44', paddingTop: 10, paddingBottom: 6, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <small style={{ color: '#64748b' }}>© 2026 The Legacy Link. All rights reserved.</small>
          <small><a href="/welcome/privacy">Privacy Policy</a></small>
          <small><a href="/welcome/terms">Terms & Conditions</a></small>
          <small><a href="/welcome/lead-replacement-policy">Lead Replacement Policy</a></small>
        </footer>
      </div>

      <div className="llBottomBar" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, background: '#020617', borderTop: '1px solid #1d4ed8' }}>
        <div className="llStickyWrap" style={{ maxWidth: 1180, margin: '0 auto', padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <strong style={{ color: '#e2e8f0' }}>Link Leads • Open Orders</strong>
          <div className="llStickyButtons" style={{ display: 'flex', gap: 8 }}>
            <a
              href="/linkleads/order-builder"
              target="_blank"
              rel="noreferrer"
              style={{ background: '#1d4ed8', color: '#fff', textDecoration: 'none', padding: '8px 12px', borderRadius: 10, fontWeight: 700 }}
            >
              Open Standalone Builder
            </a>
            <a
              href={telHref}
              style={{ background: '#0f172a', color: '#fff', textDecoration: 'none', padding: '8px 12px', borderRadius: 10, border: '1px solid #334155', fontWeight: 700 }}
            >
              Call {CONTACT.phone}
            </a>
          </div>
        </div>
      </div>

      <style>{`
        .llBuilderOnly .llMarketingSection { display: none !important; }
        .llBuilderOnly #order-builder { display: block !important; margin-top: 12px !important; border-color: #334155 !important; background: linear-gradient(180deg,#0b1220 0%, #111827 100%) !important; }
        .llBuilderOnly #order-builder h3 { font-size: 22px; }
        .llBuilderOnly #order-builder p { color: #94a3b8 !important; }
        .llBuilderOnly .llFooterMain { display: none !important; }
        .llBuilderOnly .llBottomBar { display: none !important; }
        .llBuilderOnly header { position: static !important; }

        .llStandalonePage #order-builder {
          border: none !important;
          background: transparent !important;
          padding: 0 !important;
          margin-top: 8px !important;
        }
        .llStandalonePage .llGoatMain {
          border-radius: 16px !important;
        }

        .llHoverCard { transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
        .llHoverCard:hover { transform: translateY(-3px); border-color: #3b82f6 !important; box-shadow: 0 18px 40px rgba(29,78,216,.2) !important; }
        .llGlassCard { transition: transform .2s ease; }
        .llGlassCard:hover { transform: translateY(-2px); }
        .llFloatingBadge { animation: llFloat 2.8s ease-in-out infinite; }
        @keyframes llFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }

        .llGoatDash { box-shadow: 0 10px 30px rgba(2,6,23,.08); }
        .llGoatSidebar button { min-height: 36px; font-weight: 600; }
        .llGoatMain { box-shadow: inset 0 0 0 1px rgba(226,232,240,.55); }
        .llGoatTopbar input::placeholder { color: #9ca3af; }
        .llGoatTiers > button { transition: transform .15s ease, box-shadow .15s ease; }
        .llGoatTiers > button:hover { transform: translateY(-1px); box-shadow: 0 8px 16px rgba(2,6,23,.08); }

        .llPolicyReadable,
        .llPolicyReadable p,
        .llPolicyReadable ul,
        .llPolicyReadable li,
        .llPolicyReadable strong {
          color: #e2e8f0 !important;
        }
        .llPolicyReadable a {
          color: #60a5fa !important;
          text-decoration: underline;
        }

        @media (max-width: 1180px) {
          .llGoatGrid { grid-template-columns: 1fr !important; }
          .llGoatSidebar { display: none !important; }
        }

        @media (max-width: 1180px) {
          .llFieldsGrid { grid-template-columns: 1fr !important; }
          .llLeadFieldsSplit { grid-template-columns: 1fr !important; }
          .llLeadFieldsSplit > div + div { border-left: 0 !important; padding-left: 0 !important; border-top: 1px solid #fee2e2; padding-top: 12px; }
        }

        @media (max-width: 980px) {
          .llGoatContent { grid-template-columns: 1fr !important; }
          .llGoatVisualGrid { grid-template-columns: 1fr !important; }
          .llGoatTiers { grid-template-columns: 1fr !important; }
          .llOrderTopGrid { grid-template-columns: 1fr !important; }
          .llPackageGrid { grid-template-columns: 1fr !important; }
          .llFieldsGrid { grid-template-columns: 1fr !important; }
          .llStateGrid { grid-template-columns: repeat(7,minmax(0,1fr)) !important; }
        }

        @media (max-width: 820px) {
          #leads h2 { font-size: 24px; }
          h1 { font-size: 34px !important; }
          .llStickyWrap { justify-content: center !important; }
          .llStickyButtons { width: 100%; display: grid !important; grid-template-columns: 1fr 1fr; }
          .llStickyWrap a { text-align: center; }
          .llGoatTopbar { flex-direction: column; align-items: stretch !important; }
          .llGoatTopbar > div { margin-left: 0 !important; width: 100%; }
        }
      `}</style>
    </main>
  );
}
