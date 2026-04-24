import * as React from 'react';
import { getItem, setItem } from './storage';

/**
 * Shared state across the onboarding flow. Each screen reads + writes
 * to this context; the final "Building" screen submits the whole
 * payload to `sdk.agents.bootstrap({ preferences })` (stubbed for now).
 */

export type OnboardingPersona = 'curious' | 'skeptical' | 'playful' | 'calm';
export type OnboardingVibe = 'deep' | 'news' | 'takes' | 'visual';

export interface OnboardingState {
  agentName: string;
  agentAvatar: number; // index 0-3 of preset avatars
  interests: string[]; // tag keys from MINDS_INTERESTS
  freeTextInterests: string;
  vibes: OnboardingVibe[];
  persona: OnboardingPersona;
  pasteSources: {
    rss: string[];
    substack: string[];
    bluesky: string;
    mastodon: string;
    nostr: string;
    youtube: string[];
  };
}

const DEFAULT_STATE: OnboardingState = {
  agentName: 'Minds',
  agentAvatar: 0,
  interests: [],
  freeTextInterests: '',
  vibes: ['news'],
  persona: 'curious',
  pasteSources: {
    rss: [],
    substack: [],
    bluesky: '',
    mastodon: '',
    nostr: '',
    youtube: [],
  },
};

interface OnboardingContextValue {
  state: OnboardingState;
  update: (patch: Partial<OnboardingState>) => void;
  updateSources: (patch: Partial<OnboardingState['pasteSources']>) => void;
  reset: () => void;
}

const OnboardingContext = React.createContext<OnboardingContextValue | null>(null);

const ONBOARDING_COMPLETE_KEY = 'minds:onboarding:complete';

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<OnboardingState>(DEFAULT_STATE);

  const update = React.useCallback((patch: Partial<OnboardingState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateSources = React.useCallback((patch: Partial<OnboardingState['pasteSources']>) => {
    setState((prev) => ({ ...prev, pasteSources: { ...prev.pasteSources, ...patch } }));
  }, []);

  const reset = React.useCallback(() => setState(DEFAULT_STATE), []);

  const value = React.useMemo(() => ({ state, update, updateSources, reset }), [state, update, updateSources, reset]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = React.useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}

export async function markOnboardingComplete() {
  await setItem(ONBOARDING_COMPLETE_KEY, '1');
}

export async function isOnboardingComplete(): Promise<boolean> {
  const v = await getItem(ONBOARDING_COMPLETE_KEY);
  return v === '1';
}

/** 24 onboarding interest tags. Mirrors the server-side MINDS_INTEREST_SOURCES map. */
export const MINDS_INTERESTS: { key: string; label: string }[] = [
  { key: 'ai', label: 'AI' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'design', label: 'Design' },
  { key: 'tech', label: 'Tech' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'politics', label: 'Politics' },
  { key: 'nfl', label: 'NFL' },
  { key: 'startups', label: 'Startups' },
  { key: 'science', label: 'Science' },
  { key: 'philosophy', label: 'Philosophy' },
  { key: 'music', label: 'Music' },
  { key: 'film', label: 'Film' },
  { key: 'gaming', label: 'Gaming' },
  { key: 'books', label: 'Books' },
  { key: 'climate', label: 'Climate' },
  { key: 'space', label: 'Space' },
  { key: 'health', label: 'Health' },
  { key: 'art', label: 'Art' },
  { key: 'history', label: 'History' },
  { key: 'food', label: 'Food' },
  { key: 'travel', label: 'Travel' },
  { key: 'finance', label: 'Finance' },
  { key: 'journalism', label: 'Journalism' },
  { key: 'culture', label: 'Culture' },
];

export const PERSONAS: { key: OnboardingPersona; title: string; description: string }[] = [
  { key: 'curious', title: 'Curious', description: 'Asks questions. Surfaces why things matter.' },
  { key: 'skeptical', title: 'Skeptical', description: 'Flags claims. Pulls counterpoints.' },
  { key: 'playful', title: 'Playful', description: 'Wit and cultural references.' },
  { key: 'calm', title: 'Calm', description: 'Minimal commentary. Lets sources speak.' },
];

export const VIBES: { key: OnboardingVibe; title: string }[] = [
  { key: 'deep', title: 'Deep dives' },
  { key: 'news', title: 'News briefs' },
  { key: 'takes', title: 'Hot takes' },
  { key: 'visual', title: 'Visual stuff' },
];
