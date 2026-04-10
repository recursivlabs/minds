import { Platform } from 'react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

let Sentry: any = null;

function getSentry() {
  if (Sentry) return Sentry;
  if (Platform.OS === 'web') return null;
  try {
    Sentry = require('@sentry/react-native');
    return Sentry;
  } catch {
    return null;
  }
}

export function initSentry() {
  if (!SENTRY_DSN) return;
  const S = getSentry();
  if (!S) return;

  S.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
    attachStacktrace: true,
  });
}

export function captureException(error: Error, context?: Record<string, any>) {
  console.error('[Error]', error.message, context);
  const S = getSentry();
  if (SENTRY_DSN && S) {
    S.captureException(error, { extra: context });
  }
}

export function setUser(user: { id: string; username?: string; email?: string } | null) {
  const S = getSentry();
  if (!SENTRY_DSN || !S) return;
  if (user) {
    S.setUser({ id: user.id, username: user.username, email: user.email });
  } else {
    S.setUser(null);
  }
}
