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
    // Versioned-path strategy: each save writes a unique key under `${pathname}__v/`.
    // Paginate through ALL versions to find the actual newest (avoids 200-item list limit bug).
    const versionPrefix = `${pathname}__v/`;
    let allVersionBlobs = [];
    let cursor;
    let hasMore = true;
    while (hasMore) {
      const page = await blob.list({ prefix: versionPrefix, limit: 1000, ...(cursor ? { cursor } : {}) });
      allVersionBlobs = allVersionBlobs.concat(page?.blobs || []);
      hasMore = Boolean(page?.hasMore);
      cursor = page?.cursor;
      if (allVersionBlobs.length > 10000) break; // safety cap
    }
    const newestVersion = allVersionBlobs
      .sort((a, b) => String(b.pathname || '').localeCompare(String(a.pathname || '')))[0];

    if (newestVersion?.url) {
      const res = await fetch(newestVersion.url, { cache: 'no-store' });
      if (res.ok) {
        const parsed = await res.json().catch(() => fallback);
        return parsed == null ? clone(fallback) : parsed;
      }
    }

    // Back-compat: read old non-versioned key if present.
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

  const versionedPath = `${pathname}__v/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  await blob.put(versionedPath, JSON.stringify(next), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: false
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

// ─── Direct (non-versioned) read/write ──────────────────────────────────────
// Use for time-sensitive stores like OTP codes where we only need current state
// and versioned accumulation causes list() to miss recent writes.

export async function loadJsonStoreDirect(pathname, fallback = []) {
  const blob = await tryImportBlob();

  if (!blob || !process.env.BLOB_READ_WRITE_TOKEN) {
    if (!(pathname in memoryFallback)) memoryFallback[pathname] = clone(fallback);
    return clone(memoryFallback[pathname]);
  }

  try {
    const { blobs } = await blob.list({ prefix: pathname, limit: 10 });
    const match = (blobs || []).find((b) => b.pathname === pathname);
    if (!match?.url) return clone(fallback);
    const res = await fetch(match.url, { cache: 'no-store' });
    if (!res.ok) return clone(fallback);
    const parsed = await res.json().catch(() => fallback);
    return Array.isArray(parsed) ? parsed : clone(fallback);
  } catch {
    if (!(pathname in memoryFallback)) memoryFallback[pathname] = clone(fallback);
    return clone(memoryFallback[pathname]);
  }
}

export async function saveJsonStoreDirect(pathname, value) {
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
