import { Recursiv } from '@recursiv/sdk';

export const BASE_URL =
  process.env.EXPO_PUBLIC_RECURSIV_API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  'https://api.recursiv.io/api/v1';

export const BASE_ORIGIN = BASE_URL.replace(/\/api\/v1$/, '');

export const API_KEY = process.env.EXPO_PUBLIC_RECURSIV_API_KEY || '';

export const ORG_ID = process.env.EXPO_PUBLIC_RECURSIV_ORG_ID || '';

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
