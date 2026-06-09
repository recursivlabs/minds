import { describe, it, expect } from 'vitest';
import { getPreference, setPreference } from '../preferences';

describe('preferences', () => {
  it('returns sensible defaults', () => {
    expect(getPreference('aiEnabled')).toBe(true);
    expect(getPreference('defaultFeed')).toBe('foryou');
    expect(getPreference('showNsfw')).toBe(false);
  });

  it('set then get round-trips and persists in-memory', () => {
    setPreference('defaultFeed', 'following');
    expect(getPreference('defaultFeed')).toBe('following');
    setPreference('showNsfw', true);
    expect(getPreference('showNsfw')).toBe(true);
    // restore defaults so test order doesn't leak
    setPreference('defaultFeed', 'foryou');
    setPreference('showNsfw', false);
  });
});
