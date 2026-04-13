import { getItemSync, getItem, setItem } from './storage';

const PREFS_KEY = 'minds:preferences';

interface Preferences {
  showNsfw: boolean;
  autoplayVideo: boolean;
}

const defaults: Preferences = {
  showNsfw: false,
  autoplayVideo: true,
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
