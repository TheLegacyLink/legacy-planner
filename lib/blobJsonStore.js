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

export async function loadJsonStore(pathname, fallback = []) {
  const blob = await tryImportBlob();

  if (!blob || !process.env.BLOB_READ_WRITE_TOKEN) {
    if (!memoryFallback[pathname]) memoryFallback[pathname] = clone(fallback);
    return clone(memoryFallback[pathname]);
  }

  try {
    const { blobs } = await blob.list({ prefix: pathname, limit: 20 });
    const match = (blobs || []).find((b) => b.pathname === pathname);
    if (!match?.url) return clone(fallback);

    const res = await fetch(match.url, { cache: 'no-store' });
    if (!res.ok) return clone(fallback);
    const parsed = await res.json().catch(() => fallback);
    return Array.isArray(parsed) ? parsed : clone(fallback);
  } catch {
    if (!memoryFallback[pathname]) memoryFallback[pathname] = clone(fallback);
    return clone(memoryFallback[pathname]);
  }
}

export async function saveJsonStore(pathname, value) {
  const blob = await tryImportBlob();
  const next = Array.isArray(value) ? value : [];

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
