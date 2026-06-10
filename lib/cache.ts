/**
 * In-memory cache with stale-while-revalidate pattern.
 * Persists to localStorage on web for instant loads after refresh.
 *
 * CRITICAL: the persisted cache is NAMESPACED PER USER ID. The cache holds
 * identity-scoped data (profile, conversations, communities, personal feed), so
 * a single shared key let one account's cached data render under another in the
 * same browser — the "my identity flashed / communities I'm not in showed up"
 * bug. Each account now reads/writes only `minds:cache:v3:<userId>`, so accounts
 * can never see each other's cache. The namespace is resolved synchronously at
 * boot from the stored auth user, so the very first render is already correct.
 */
import { Platform } from 'react-native';

type CacheEntry = {
  data: any;
  timestamp: number;
};

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
const store = new Map<string, CacheEntry>();
const BASE_KEY = 'minds:cache:v3';
const AUTH_USER_KEY = 'minds:user'; // matches KEYS.user in lib/auth.tsx

// Sweep the legacy SHARED (cross-account-unsafe) keys so they can't leak.
if (isWeb) {
  for (const k of ['minds:cache', 'minds:cache:v2']) {
    try { window.localStorage.removeItem(k); } catch {}
  }
}

// Resolve the current user's id synchronously from the stored auth user, so the
// first hydrate already uses the correct per-user namespace (no wrong-identity
// flash before auth finishes booting).
function readStoredUserId(): string | null {
  if (!isWeb) return null;
  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw)?.id ?? null) : null;
  } catch { return null; }
}

let activeNamespace = readStoredUserId() || 'anon';
let STORAGE_KEY = `${BASE_KEY}:${activeNamespace}`;

// Data is "fresh" for 30 seconds — won't refetch at all
const FRESH_MS = 30_000;

// Debounced persist to localStorage
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (!isWeb) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const obj: Record<string, CacheEntry> = {};
      const now = Date.now();
      for (const [key, entry] of store.entries()) {
        if (now - entry.timestamp < 10 * 60_000) obj[key] = entry;
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {}
  }, 1000);
}

// Load the active namespace's persisted entries into the in-memory store.
function hydrate() {
  store.clear();
  if (!isWeb) return;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved) as Record<string, CacheEntry>;
    const now = Date.now();
    for (const [key, entry] of Object.entries(parsed)) {
      if (now - entry.timestamp < 10 * 60_000) store.set(key, entry);
    }
  } catch {}
}
hydrate(); // initial hydrate for the stored user (or anon)

/**
 * Point the cache at a user's namespace. Called by auth on boot/sign-in/sign-out
 * so each account reads + writes only its own cache. Switching users clears the
 * in-memory store and loads the new user's persisted namespace — the previous
 * user's data can never bleed through.
 */
export function setCacheUser(userId: string | null): void {
  const next = userId || 'anon';
  if (next === activeNamespace) return;
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; } // drop any pending write to the old namespace
  activeNamespace = next;
  STORAGE_KEY = `${BASE_KEY}:${next}`;
  hydrate();
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

// Simple pub-sub so data hooks can re-fetch when their cached entry is
// invalidated — e.g. SideNav's `useCommunities` reacting to a join/leave
// in the community screen without a full logout/login.
type InvalidationListener = (key: string) => void;
const listeners = new Set<InvalidationListener>();

export function subscribeToInvalidations(listener: InvalidationListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(key: string) {
  for (const fn of listeners) {
    try { fn(key); } catch { /* ignore */ }
  }
}

export function invalidate(key: string): void {
  store.delete(key);
  schedulePersist();
  notify(key);
}

/**
 * Wipe the active namespace's cache (in-memory + its localStorage key). Called
 * on sign-out so a signed-out browser holds no identity-scoped data.
 */
export function clearAll(): void {
  store.clear();
  if (isWeb) {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
  }
}

export function invalidatePrefix(prefix: string): void {
  const removed: string[] = [];
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      removed.push(key);
    }
  }
  schedulePersist();
  for (const key of removed) notify(key);
  if (removed.length === 0) notify(prefix); // still wake listeners
}
