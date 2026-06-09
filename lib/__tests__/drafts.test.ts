import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { saveDraft, getLatestDraft, clearDraft } from '../drafts';

beforeEach(() => {
  clearDraft();
  window.localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('drafts', () => {
  it('saves and restores a recent draft', () => {
    saveDraft('hello world');
    expect(getLatestDraft()?.content).toBe('hello world');
  });

  it('keeps only a single slot (regression: old code accumulated ghosts)', () => {
    saveDraft('first');
    saveDraft('second');
    expect(getLatestDraft()?.content).toBe('second');
  });

  it('clearDraft removes the draft (cleared on successful post)', () => {
    saveDraft('to be posted');
    clearDraft();
    expect(getLatestDraft()).toBeNull();
  });

  it('does NOT restore a draft older than 24h (regression: resurrecting posted text)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    saveDraft('stale text');
    expect(getLatestDraft()?.content).toBe('stale text');
    vi.setSystemTime(new Date('2026-01-02T01:00:00Z')); // +25h
    expect(getLatestDraft()).toBeNull();
  });
});
