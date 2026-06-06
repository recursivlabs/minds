// Consumer Plus/Pro subscriptions. Starts a Stripe Checkout on the Minds
// network's BYOK Stripe account via the Recursiv app-subscription endpoint, then
// hands the user to Stripe. The encode/billing webhook flips app_subscription,
// which the video primitive (and other gates) read for tier.
import { Platform, Linking } from 'react-native';
import * as storage from './storage';
import { BASE_URL, SITE_URL } from './recursiv';

export type PaidTier = 'plus' | 'pro';

async function apiKey(): Promise<string> {
  return (await storage.getItem('minds:api_key')) || '';
}

/**
 * Begin a checkout for a paid tier. Returns the Stripe Checkout URL on success.
 * Throws with a friendly message if the app's Stripe account isn't configured
 * yet (so the UI can say "launching soon" rather than a raw 503).
 */
export async function startCheckout(tier: PaidTier): Promise<string> {
  const res = await fetch(`${BASE_URL}/app-subscriptions/checkout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${await apiKey()}`,
    },
    body: JSON.stringify({ tier, return_url: `${SITE_URL}/billing?sub=success&tier=${tier}` }),
  });

  if (res.status === 503) {
    throw new Error('Subscriptions are launching soon — check back shortly.');
  }
  if (!res.ok) {
    throw new Error('Could not start checkout. Please try again.');
  }
  const json = await res.json();
  const url: string | undefined = json?.data?.url;
  if (!url) throw new Error('Could not start checkout. Please try again.');
  return url;
}

/** Start checkout and send the user to Stripe (new tab on web, browser on native). */
export async function openCheckout(tier: PaidTier): Promise<void> {
  const url = await startCheckout(tier);
  if (Platform.OS === 'web') {
    // Same-tab redirect keeps the Stripe return flow simple.
    window.location.href = url;
  } else {
    await Linking.openURL(url);
  }
}
