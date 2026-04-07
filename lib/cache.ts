/**
 * In-memory cache with stale-while-revalidate pattern.
 * Persists to localStorage on web for instant loads after refresh.
 */
import { Platform } from 'react-native';

type CacheEntry = {
  data: any;
  timestamp: number;
};

const store = new Map<string, CacheEntry>();
const STORAGE_KEY = 'minds:cache';

// Data is "fresh" for 30 seconds — won't refetch at all
const FRESH_MS = 30_000;

// Hydrate from localStorage on web
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, CacheEntry>;
      const now = Date.now();
      for (const [key, entry] of Object.entries(parsed)) {
        // Only restore entries less than 10 minutes old
        if (now - entry.timestamp < 10 * 60_000) {
          store.set(key, entry);
        }
      }
    }
  } catch {}
}

// Debounced persist to localStorage
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const obj: Record<string, CacheEntry> = {};
      const now = Date.now();
      for (const [key, entry] of store.entries()) {
        // Only persist entries less than 10 minutes old, skip large data
        if (now - entry.timestamp < 10 * 60_000) {
          obj[key] = entry;
        }
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {}
  }, 1000);
}

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
  schedulePersist();
}

export function invalidate(key: string): void {
  store.delete(key);
  schedulePersist();
}

export function invalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  schedulePersist();
}
