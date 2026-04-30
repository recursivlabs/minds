import { Recursiv } from '@recursiv/sdk';

export const BASE_URL =
  process.env.EXPO_PUBLIC_RECURSIV_API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  'https://api.recursiv.io/api/v1';

export const BASE_ORIGIN = BASE_URL.replace(/\/api\/v1$/, '');

export const API_KEY = process.env.EXPO_PUBLIC_RECURSIV_API_KEY || '';

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

/**
 * Default SDK instance for public data.
 */
let _sdk: Recursiv | null = null;

export function getSdk(): Recursiv {
  if (!_sdk) {
    if (!API_KEY) throw new Error('No API key configured');
    _sdk = new Recursiv({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      timeout: 120_000,
    });
  }
  return _sdk;
}

export const sdk = API_KEY
  ? new Recursiv({ apiKey: API_KEY, baseUrl: BASE_URL, timeout: 120_000 })
  : (null as unknown as Recursiv);
