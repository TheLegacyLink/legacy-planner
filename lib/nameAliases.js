export function clean(v = '') {
  return String(v || '').trim();
}

const NAME_ALIAS_RULES = [
  [/\bletitia\b/g, 'leticia'],
  [/\blatricia\b/g, 'leticia'],
  [/\bletricia\b/g, 'leticia'],
  [/\bletisha\b/g, 'leticia']
];

export function normalizePersonName(value = '') {
  let out = clean(value)
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [pattern, canonical] of NAME_ALIAS_RULES) {
    out = out.replace(pattern, canonical);
  }

  return out.replace(/\s+/g, ' ').trim();
}

export function samePersonName(a = '', b = '') {
  return normalizePersonName(a) === normalizePersonName(b);
}
