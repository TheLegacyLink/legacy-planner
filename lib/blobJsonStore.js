let memoryFallback = globalThis.__legacyMemoryStoresV1;
if (!memoryFallback) {
  memoryFallback = {};
  globalThis.__legacyMemoryStoresV1 = memoryFallback;
}

async function tryImportBlob() {
  try {
    const mod = await import('@vercel/blob');
    return mod;
  } catch {
    return null;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export async function loadJsonFile(pathname, fallback = null) {
  const blob = await tryImportBlob();

  if (!blob || !process.env.BLOB_READ_WRITE_TOKEN) {
    if (!(pathname in memoryFallback)) memoryFallback[pathname] = clone(fallback);
    return clone(memoryFallback[pathname]);
  }

  try {
    const { blobs } = await blob.list({ prefix: pathname, limit: 200 });
    const matches = (blobs || []).filter((b) => b.pathname === pathname);
    const match = matches.sort((a, b) => new Date(b.uploadedAt || b.uploaded_at || 0).getTime() - new Date(a.uploadedAt || a.uploaded_at || 0).getTime())[0];
    if (!match?.url) return clone(fallback);

    const res = await fetch(match.url, { cache: 'no-store' });
    if (!res.ok) return clone(fallback);
    const parsed = await res.json().catch(() => fallback);
    return parsed == null ? clone(fallback) : parsed;
  } catch {
    if (!(pathname in memoryFallback)) memoryFallback[pathname] = clone(fallback);
    return clone(memoryFallback[pathname]);
  }
}

export async function saveJsonFile(pathname, value) {
  const blob = await tryImportBlob();
  const next = value;

  if (!blob || !process.env.BLOB_READ_WRITE_TOKEN) {
    memoryFallback[pathname] = clone(next);
    return next;
  }

  await blob.put(pathname, JSON.stringify(next), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true
  });

  return next;
}

export async function loadJsonStore(pathname, fallback = []) {
  const out = await loadJsonFile(pathname, fallback);
  return Array.isArray(out) ? out : clone(fallback);
}

export async function saveJsonStore(pathname, value) {
  const next = Array.isArray(value) ? value : [];
  await saveJsonFile(pathname, next);
  return next;
}
