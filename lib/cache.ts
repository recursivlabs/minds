/**
 * Simple in-memory cache with stale-while-revalidate pattern.
 * Returns cached data instantly while refreshing in background.
 */

type CacheEntry = {
  data: any;
  timestamp: number;
};

const store = new Map<string, CacheEntry>();

// Data is "fresh" for 30 seconds — won't refetch at all
const FRESH_MS = 30_000;
// Data is "stale" for 5 minutes — show cached, refetch in background
const STALE_MS = 5 * 60_000;

export function getCached(key: string): any | null {
  const entry = store.get(key);
  if (!entry) return null;
  return entry.data;
}

export function isFresh(key: string): boolean {
  const entry = store.get(key);
  if (!entry) return false;
  return Date.now() - entry.timestamp < FRESH_MS;
}

export function setCache(key: string, data: any): void {
  store.set(key, { data, timestamp: Date.now() });
}

export function invalidate(key: string): void {
  store.delete(key);
}

export function invalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
