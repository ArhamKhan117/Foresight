/**
 * Simple in-memory cache with TTL for on-chain RPC calls.
 * Shows stale data instantly, refreshes in background.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const store = new Map<string, CacheEntry<any>>();
const TTL = 60_000; // 60s — data older than this gets refreshed in background

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  return entry.data;
}

export function setCache<T>(key: string, data: T): void {
  store.set(key, { data, timestamp: Date.now() });
}

export function isStale(key: string): boolean {
  const entry = store.get(key);
  if (!entry) return true;
  return Date.now() - entry.timestamp > TTL;
}

/**
 * Get cached value instantly, and if stale (or missing), call fetcher in background.
 * Returns cached value (or null) synchronously via callback, then calls onUpdate when fresh data arrives.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  onUpdate: (data: T) => void
): Promise<void> {
  const cached = getCached<T>(key);
  if (cached !== null) {
    onUpdate(cached); // show instantly
  }
  if (isStale(key)) {
    try {
      const fresh = await fetcher();
      setCache(key, fresh);
      onUpdate(fresh);
    } catch (e) {
      // If fetch fails but we have cache, keep showing it
      if (cached === null) console.error("Cache fetch failed:", key, e);
    }
  }
}
