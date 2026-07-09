import { Platform } from 'react-native';

// Client error monitoring via PostHog — the SAME project the platform server
// already reports to (postHogService on the API). Server errors + web client
// errors + future Minds Cloud apps all land in one PostHog dashboard,
// correlated by user. Set EXPO_PUBLIC_POSTHOG_KEY (the phc_... project key,
// safe on the client) + optional EXPO_PUBLIC_POSTHOG_HOST in the deploy env.
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || '';
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let ph: any = null;
let loaded = false;
function client() {
  if (loaded) return ph;
  loaded = true;
  // Web-first: minds is deployed as web. Native error monitoring (posthog-
  // react-native) can be added later; it no-ops on native for now.
  if (Platform.OS !== 'web' || !KEY) return null;
  try {
    const posthog = require('posthog-js').default ?? require('posthog-js');
    posthog.init(KEY, {
      api_host: HOST,
      capture_pageview: false,
      autocapture: false,
      person_profiles: 'identified_only',
    });
    ph = posthog;
  } catch {
    ph = null;
  }
  return ph;
}

/** Initialize at app boot. */
export function initMonitoring() {
  client();
}

const exceptionProps = (err: Error, source: string, extra?: Record<string, any>) => ({
  $exception_type: err.name || 'Error',
  $exception_message: err.message,
  $exception_stack_trace_raw: err.stack || '',
  $exception_source: source,
  $lib: 'minds-web',
  ...extra,
});

/** Report an error (and always log it). Accepts unknown for catch blocks. */
export function captureException(error: unknown, context?: Record<string, any>) {
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
  console.error('[Error]', err.message, context || '');
  const p = client();
  if (p) p.capture('$exception', exceptionProps(err, 'web', context));
}

/** Report a non-fatal condition on a critical path. */
export function captureMessage(message: string, context?: Record<string, any>) {
  console.warn('[Warn]', message, context || '');
  const p = client();
  if (p) p.capture('$exception', exceptionProps(new Error(message), 'web', { level: 'warning', ...context }));
}

export function setUser(user: { id: string; username?: string; email?: string } | null) {
  const p = client();
  if (!p) return;
  if (user) p.identify(user.id, { username: user.username, email: user.email });
  else p.reset();
}
