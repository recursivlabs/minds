import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

export function initSentry() {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
    attachStacktrace: true,
  });
}

export function captureException(error: Error, context?: Record<string, any>) {
  console.error('[Sentry]', error.message, context);
  if (SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
}

export function setUser(user: { id: string; username?: string; email?: string } | null) {
  if (!SENTRY_DSN) return;
  if (user) {
    Sentry.setUser({ id: user.id, username: user.username, email: user.email });
  } else {
    Sentry.setUser(null);
  }
}
