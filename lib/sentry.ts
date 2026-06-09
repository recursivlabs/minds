import { Platform } from 'react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

// Web is the primary surface (minds.on.recursiv.io), so error monitoring MUST
// work there — it previously short-circuited to null on web, meaning every
// production web error vanished. Load @sentry/react on web and
// @sentry/react-native on native.
let S: any = null;
let loaded = false;
function load() {
  if (loaded) return S;
  loaded = true;
  try {
    S = Platform.OS === 'web' ? require('@sentry/react') : require('@sentry/react-native');
  } catch {
    S = null;
  }
  return S;
}

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

export function initSentry() {
  if (!SENTRY_DSN) return;
  const s = load();
  if (!s) return;
  s.init({
    dsn: SENTRY_DSN,
    environment: isDev ? 'development' : 'production',
    tracesSampleRate: 0.2,
    attachStacktrace: true,
    // Native-only session tracking.
    ...(Platform.OS !== 'web' ? { enableAutoSessionTracking: true } : {}),
  });
}

/** Report an error to Sentry (and always log it). Accepts unknown so callers
 *  can pass whatever a catch block hands them. */
export function captureException(error: unknown, context?: Record<string, any>) {
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
  console.error('[Error]', err.message, context || '');
  if (!SENTRY_DSN) return;
  const s = load();
  if (s) s.captureException(err, { extra: context });
}

/** Report a non-fatal condition (e.g. a swallowed failure on a critical path). */
export function captureMessage(message: string, context?: Record<string, any>) {
  console.warn('[Warn]', message, context || '');
  if (!SENTRY_DSN) return;
  const s = load();
  if (s) s.captureMessage(message, { level: 'warning', extra: context });
}

export function setUser(user: { id: string; username?: string; email?: string } | null) {
  if (!SENTRY_DSN) return;
  const s = load();
  if (!s) return;
  s.setUser(user ? { id: user.id, username: user.username, email: user.email } : null);
}
