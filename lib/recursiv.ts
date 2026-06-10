import { Recursiv } from '@recursiv/sdk';

export const BASE_URL =
  process.env.EXPO_PUBLIC_RECURSIV_API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  'https://api.recursiv.io/api/v1';

export const BASE_ORIGIN = BASE_URL.replace(/\/api\/v1$/, '');

// The site's own origin, used as the Referer for Bunny video requests (Bunny's
// "Block Direct URL Access" gates on referer). On web the browser sends this
// automatically; on native we attach it explicitly to the video/thumbnail
// requests. Falls back to the prod domain when there's no window (native).
export const SITE_URL =
  (typeof window !== 'undefined' && window.location?.origin) ||
  process.env.EXPO_PUBLIC_SITE_URL ||
  'https://minds.on.recursiv.io';

// Hardcoded fallbacks point at the Minds 2.0 project on prod. Expo's bundler
// inlines EXPO_PUBLIC_* at build time, so when Coolify env is empty (which is
// the current state for recursiv-minds), these fallbacks bake into the bundle.
// Override via env in dev / staging if needed.
export const ORG_ID =
  process.env.EXPO_PUBLIC_RECURSIV_ORG_ID || '019d517b-bb87-744d-92db-b3801dc15927';
export const PROJECT_ID =
  process.env.EXPO_PUBLIC_RECURSIV_PROJECT_ID || '019d5190-f0c0-717e-a1bd-ef9c335292b9';

/**
 * Create an authenticated SDK instance with a per-user API key.
 */
export function createAuthedSdk(apiKey: string): Recursiv {
  return new Recursiv({
    apiKey,
    baseUrl: BASE_URL,
    timeout: 120_000,
  });
}

// NOTE: there is intentionally NO shared/default SDK here. A baked app key in
// a public bundle is extractable by anyone, and any fetch made with it acts as
// the KEY OWNER, not the signed-in user (the phantom-communities identity bug).
// Public pre-auth flows use the anon SDK in lib/auth.tsx; everything else must
// use the signed-in user's SDK from useAuth().
