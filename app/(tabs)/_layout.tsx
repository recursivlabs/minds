import * as React from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { View, Platform, AppState, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../constants/theme';
import { useTheme } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { ORG_ID } from '../../lib/recursiv';
import { isUsernamePicked } from '../../lib/onboarding';
import { subscribeToInvalidations } from '../../lib/cache';
import { SideNav, useSidebarState } from '../../components/SideNav';

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web';
  const sidebar = useSidebarState();
  const { colors } = useTheme();
  const { sdk, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Username gate. Forced redirect for users without a clean URL-safe
  // username (signup may have written email-prefix garbage; legacy
  // accounts may have no username). Once picked, the flag prevents loops.
  //
  // No swipe-deck onboarding gate. New signups land straight in the For
  // You feed with our best default content. A top-of-feed CTA invites
  // them to set up a personal AI agent when they're ready — but that's
  // optional. Dismissing the CTA leaves the default feed working fine.
  React.useEffect(() => {
    if (!sdk || !user?.id) return;
    let cancelled = false;
    (async () => {
      const picked = await isUsernamePicked();
      const currentUsername = (user.username || '').toLowerCase();
      const needsUsername = !picked && (
        !currentUsername ||
        !/^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])?$/.test(currentUsername)
      );
      if (cancelled) return;
      if (needsUsername) {
        router.replace('/auth/pick-username' as any);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, user?.id, user?.username, router]);

  // Poll unread notification count
  const [unreadCount, setUnreadCount] = React.useState(0);
  React.useEffect(() => {
    if (!sdk) return;
    let active = true;
    const check = async () => {
      // Don't poll a backgrounded app / hidden tab — battery and QPS waste,
      // and at cutover scale a fleet of idle tabs is real load.
      if (Platform.OS === 'web') {
        if (typeof document !== 'undefined' && document.hidden) return;
      } else if (AppState.currentState !== 'active') return;
      try {
        const res = await sdk.notifications.list({ limit: 20, status: 'unread', organization_id: ORG_ID || undefined } as any);
        if (active) {
          // Read state lives in `status` — the old `read`/`is_read` fields
          // don't exist on the SDK type, so every notification passed this
          // filter and the badge showed the full fetch count forever, even
          // after Mark all read.
          const unread = (res.data || []).filter((n: any) => n.status === 'unread').length;
          setUnreadCount(unread);
        }
      } catch {}
    };
    check();
    const interval = setInterval(check, 60_000); // check every 60s
    // Re-check the moment the app/tab comes back, and when another screen
    // marks notifications read (signalled via cache invalidation).
    let removeWake: (() => void) | undefined;
    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') {
        const onVis = () => { if (!document.hidden) check(); };
        document.addEventListener('visibilitychange', onVis);
        removeWake = () => document.removeEventListener('visibilitychange', onVis);
      }
    } else {
      const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
      removeWake = () => sub.remove();
    }
    const unsubInval = subscribeToInvalidations((key) => {
      if (key.startsWith('notifications')) check();
    });
    return () => { active = false; clearInterval(interval); removeWake?.(); unsubInval(); };
  }, [sdk]);

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', backgroundColor: colors.bg }}>
        {/* Center the whole nav + content + rail group like X (equal empty
            gutters on both sides), capped so it doesn't sprawl on wide screens. */}
        <View style={{ flex: 1, flexDirection: 'row', maxWidth: 1280 }}>
        <SideNav collapsed={sidebar.collapsed} onToggle={sidebar.toggle} />
        <View style={{ flex: 1 }}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: 'none' },
            }}
          >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="explore" />
            <Tabs.Screen name="create" />
            <Tabs.Screen name="chat" />
            <Tabs.Screen name="profile" />
            <Tabs.Screen name="wallet" options={{ href: null }} />
            <Tabs.Screen name="boost" options={{ href: null }} />
            <Tabs.Screen name="discover" options={{ href: null }} />
            <Tabs.Screen name="admin" options={{ href: null }} />
            <Tabs.Screen name="notifications" options={{ href: null }} />
            <Tabs.Screen name="settings" options={{ href: null }} />
            <Tabs.Screen name="billing" options={{ href: null }} />
            <Tabs.Screen name="invites" options={{ href: null }} />
            <Tabs.Screen name="email" options={{ href: null }} />
            <Tabs.Screen name="protocols" options={{ href: null }} />
            <Tabs.Screen name="apps" options={{ href: null }} />
            <Tabs.Screen name="org-settings" options={{ href: null }} />
            <Tabs.Screen name="webhooks" options={{ href: null }} />
            <Tabs.Screen name="feedback" options={{ href: null }} />
            <Tabs.Screen name="jobs" options={{ href: null }} />
            <Tabs.Screen name="post/[id]" options={{ href: null }} />
            <Tabs.Screen name="user/[username]" options={{ href: null }} />
            <Tabs.Screen name="community/[id]" options={{ href: null }} />
          </Tabs>
        </View>
        </View>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: 0.5,
          elevation: 0,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '400',
          letterSpacing: 0.2,
        },
        tabBarIconStyle: { marginTop: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => (
            <Ionicons name="newspaper-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => (
            <Ionicons name="search-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color }) => (
            <Ionicons name="add-circle-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubble-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color }) => (
            <Ionicons name="notifications-outline" size={22} color={color} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.error, fontSize: 10 },
        }}
      />
      {/* Profile moved to the header avatar — not a primary tab. */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="wallet" options={{ href: null }} />
      <Tabs.Screen name="boost" options={{ href: null }} />
      <Tabs.Screen name="discover" options={{ href: null }} />
      <Tabs.Screen name="admin" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="billing" options={{ href: null }} />
      <Tabs.Screen name="invites" options={{ href: null }} />
      <Tabs.Screen name="email" options={{ href: null }} />
      <Tabs.Screen name="protocols" options={{ href: null }} />
      <Tabs.Screen name="apps" options={{ href: null }} />
      <Tabs.Screen name="org-settings" options={{ href: null }} />
      <Tabs.Screen name="webhooks" options={{ href: null }} />
      <Tabs.Screen name="feedback" options={{ href: null }} />
      <Tabs.Screen name="jobs" options={{ href: null }} />
      <Tabs.Screen name="post/[id]" options={{ href: null }} />
      <Tabs.Screen name="user/[username]" options={{ href: null }} />
      <Tabs.Screen name="community/[id]" options={{ href: null }} />
    </Tabs>
  );
}
