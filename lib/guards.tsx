import * as React from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from './auth';

/**
 * True only for platform/admin users. Matches the check used by the SideNav
 * admin item and the admin Badge.
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return !!((user as any)?.role === 'admin' || (user as any)?.is_admin);
}

/**
 * Gate a platform/admin-only screen. Non-admins are redirected to the feed.
 * Returns false while loading or when not allowed, so the screen renders
 * nothing instead of flashing platform tooling at a consumer.
 */
export function useRequireAdmin(): boolean {
  const { isLoading } = useAuth();
  const isAdmin = useIsAdmin();
  const router = useRouter();
  React.useEffect(() => {
    if (!isLoading && !isAdmin) router.replace('/(tabs)');
  }, [isLoading, isAdmin, router]);
  return isAdmin && !isLoading;
}

/**
 * Wrap a screen so only platform/admin users can render it. Consumers who hit
 * the route directly are bounced to the feed before the screen's own hooks run.
 */
export function withAdminGuard<P extends object>(Component: React.ComponentType<P>) {
  return function AdminGuarded(props: P) {
    const allowed = useRequireAdmin();
    if (!allowed) return null;
    return <Component {...props} />;
  };
}
