import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setCache, getCached, isFresh, invalidate, invalidatePrefix, clearAll } from '../cache';

beforeEach(() => clearAll());
afterEach(() => vi.useRealTimers());

describe('cache', () => {
  it('stores and retrieves a value', () => {
    setCache('k', { a: 1 });
    expect(getCached('k')).toEqual({ a: 1 });
    expect(getCached('missing')).toBeNull();
  });

  it('isFresh is true right after set, false after the 30s window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    setCache('k', 1);
    expect(isFresh('k')).toBe(true);
    vi.setSystemTime(new Date('2026-01-01T00:00:31Z')); // +31s
    expect(isFresh('k')).toBe(false);
    // stale-while-revalidate: value is still readable, just not fresh
    expect(getCached('k')).toBe(1);
  });

  it('invalidate removes a single key', () => {
    setCache('k', 1);
    invalidate('k');
    expect(getCached('k')).toBeNull();
  });

  it('invalidatePrefix removes all keys with the prefix', () => {
    setCache('post:1', 'a');
    setCache('post:2', 'b');
    setCache('user:1', 'c');
    invalidatePrefix('post:');
    expect(getCached('post:1')).toBeNull();
    expect(getCached('post:2')).toBeNull();
    expect(getCached('user:1')).toBe('c');
  });
});
