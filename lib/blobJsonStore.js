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
    // PRIMARY: try __cur path first — immediately consistent, written on every save.
    const curPath = `${pathname}__cur`;
    const { blobs: curBlobs } = await blob.list({ prefix: curPath, limit: 5 });
    const curMatch = (curBlobs || []).find((b) => b.pathname === curPath);
    if (curMatch?.url) {
      const cacheBustedUrl = curMatch.url + (curMatch.url.includes('?') ? '&' : '?') + `_t=${Date.now()}`;
      const res = await fetch(cacheBustedUrl, { cache: 'no-store' });
      if (res.ok) {
        const parsed = await res.json().catch(() => null);
        if (parsed != null) return parsed;
      }
    }

    // FALLBACK: versioned-path strategy (for files saved before __cur fix, 2026-05-25)
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

    return clone(fallback);
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

  const jsonStr = JSON.stringify(next);
  const blobOpts = { access: 'public', contentType: 'application/json', addRandomSuffix: false };

  // Write to fixed __cur path (immediately consistent, same URL every save)
  const curPath = `${pathname}__cur`;
  await blob.put(curPath, jsonStr, { ...blobOpts, allowOverwrite: true });

  // Also write versioned copy for history / rollback
  const versionedPath = `${pathname}__v/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  await blob.put(versionedPath, jsonStr, { ...blobOpts, allowOverwrite: false });

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

export async function loadJsonStoreDirect(pathname, fallback = null) {
  const blob = await tryImportBlob();

  if (!blob || !process.env.BLOB_READ_WRITE_TOKEN) {
    if (!(pathname in memoryFallback)) memoryFallback[pathname] = clone(fallback);
    return clone(memoryFallback[pathname]);
  }

  try {
    const { blobs } = await blob.list({ prefix: pathname, limit: 10 });
    const match = (blobs || []).find((b) => b.pathname === pathname);
    if (!match?.url) return clone(fallback);
    // Cache-bust the URL to bypass CDN edge cache on overwritten blobs
    const cacheBustedUrl = match.url + (match.url.includes('?') ? '&' : '?') + `_t=${Date.now()}`;
    const res = await fetch(cacheBustedUrl, { cache: 'no-store' });
    if (!res.ok) {
      // Retry once without cache bust in case CDN strips query params
      const retry = await fetch(match.url, { cache: 'no-store' });
      if (!retry.ok) return clone(fallback);
      const parsed = await retry.json().catch(() => null);
      return parsed != null ? parsed : clone(fallback);
    }
    const parsed = await res.json().catch(() => null);
    return parsed != null ? parsed : clone(fallback);
  } catch {
    if (!(pathname in memoryFallback)) memoryFallback[pathname] = clone(fallback);
    return clone(memoryFallback[pathname]);
  }
}

export async function saveJsonStoreDirect(pathname, value) {
  const blob = await tryImportBlob();
  // Serialize any JSON-compatible value (object, array, primitive)
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
