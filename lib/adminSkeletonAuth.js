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

export function getAdminSkeletonPasswords() {
  const values = [
    clean(process.env.ADMIN_SKELETON_PASSWORD),
    clean(process.env.MASTER_LOGIN_PASSWORD),
    'LegacyLink2026'
  ].filter(Boolean);
  return [...new Set(values)];
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
  return getAdminSkeletonPasswords().includes(pw) && canUseAdminSkeleton(ctx);
}
