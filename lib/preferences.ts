import { Platform } from 'react-native';

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

// Hydrate
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    const saved = window.localStorage.getItem(PREFS_KEY);
    if (saved) prefs = { ...defaults, ...JSON.parse(saved) };
  } catch {}
}

function persist() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
  }
}

export function getPreference<K extends keyof Preferences>(key: K): Preferences[K] {
  return prefs[key];
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  prefs[key] = value;
  persist();
}
