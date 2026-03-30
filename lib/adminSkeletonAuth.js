function clean(v = '') {
  return String(v || '').trim();
}

function normalize(v = '') {
  return clean(v).toLowerCase();
}

const KIMORA_ALIASES = new Set([
  'kimora link',
  'kimora',
  'kimora@thelegacylink.com',
  'support@thelegacylink.com',
  'investalinkinsurance@gmail.com'
]);

export function getAdminSkeletonPassword() {
  return clean(process.env.ADMIN_SKELETON_PASSWORD || process.env.MASTER_LOGIN_PASSWORD || 'LegacyLink2026');
}

export function isKimoraIdentity(value = '') {
  return KIMORA_ALIASES.has(normalize(value));
}

export function canUseAdminSkeleton({ user = {}, identifier = '' } = {}) {
  return isKimoraIdentity(identifier) || isKimoraIdentity(user?.name) || isKimoraIdentity(user?.email);
}

export function isValidAdminSkeleton(password = '', ctx = {}) {
  const pw = clean(password);
  if (!pw) return false;
  return pw === getAdminSkeletonPassword() && canUseAdminSkeleton(ctx);
}
