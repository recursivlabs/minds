import { getItemSync, getItem, setItem } from './storage';

const PREFS_KEY = 'minds:preferences';

/** Feed shown when the home tab is opened. */
export type DefaultFeed = 'foryou' | 'following';

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
  /**
   * Which feed tab opens by default on the home screen. Default 'foryou'
   * so a new user lands on the agent-curated brief; existing users can
   * switch to 'following' if they prefer the chronological social-graph
   * stream as their main loop.
   */
  defaultFeed: DefaultFeed;
  /**
   * Conversation ids the user has muted (device-local). A muted thread still
   * receives messages but its unread badge is dimmed and it doesn't draw
   * attention — Signal-style per-chat mute. Server-side mute (cross-device +
   * push suppression) is a follow-up; this is the local layer.
   */
  mutedConversations: string[];
}

const defaults: Preferences = {
  showNsfw: false,
  autoplayVideo: true,
  aiEnabled: true,
  defaultFeed: 'foryou',
  mutedConversations: [],
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

// ── Per-conversation mute (device-local) ──
export function isConversationMuted(conversationId: string): boolean {
  return prefs.mutedConversations.includes(conversationId);
}

/** Toggle mute for a conversation; returns the new muted state. */
export function toggleConversationMute(conversationId: string): boolean {
  const set = new Set(prefs.mutedConversations);
  const muted = !set.has(conversationId);
  if (muted) set.add(conversationId); else set.delete(conversationId);
  prefs.mutedConversations = Array.from(set);
  persist();
  return muted;
}
