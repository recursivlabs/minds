import { getItemSync, getItem, setItem } from './storage';

const PREFS_KEY = 'minds:preferences';

interface Preferences {
  showNsfw: boolean;
  autoplayVideo: boolean;
  /**
   * Master AI switch. When false, the personal-agent surfaces are
   * disabled or hidden across the app: no curator runs, agent hidden
   * from Chat list, agent-sourced alerts suppressed, For You falls
   * back to chronological. Default true (opt-out, not opt-in) because
   * the agent IS the differentiator — but legacy Minds users with
   * anti-AI sensibilities can flip it off and the network still works
   * the way they remember.
   */
  aiEnabled: boolean;
}

const defaults: Preferences = {
  showNsfw: false,
  autoplayVideo: true,
  aiEnabled: true,
};

let prefs: Preferences = { ...defaults };

// Sync hydrate on web
const cached = getItemSync(PREFS_KEY);
if (cached) try { prefs = { ...defaults, ...JSON.parse(cached) }; } catch {}

// Async hydrate on native
getItem(PREFS_KEY).then(saved => {
  if (saved) try { prefs = { ...defaults, ...JSON.parse(saved) }; } catch {}
});

function persist() {
  setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function getPreference<K extends keyof Preferences>(key: K): Preferences[K] {
  return prefs[key];
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  prefs[key] = value;
  persist();
}
