import * as React from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { View, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../constants/theme';
import { useTheme } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { ORG_ID } from '../../lib/recursiv';
import { isOnboardingComplete, markOnboardingComplete } from '../../lib/onboarding';
import { SideNav, useSidebarState } from '../../components/SideNav';

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web';
  const sidebar = useSidebarState();
  const { colors } = useTheme();
  const { sdk, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Onboarding gate. New authenticated users go to swipe calibration.
  // Legacy users (any prior post or follow on this account) bypass it
  // entirely — they want their feed, not a 60-second tutorial.
  React.useEffect(() => {
    if (!sdk || !user?.id) return;
    let cancelled = false;
    (async () => {
      const done = await isOnboardingComplete();
      if (cancelled || done) return;

      try {
        const [posts, following] = await Promise.all([
          sdk.posts.list({ author_id: user.id, limit: 1 }).catch(() => null),
          sdk.users.following(user.id, { limit: 1 } as any).catch(() => null),
        ]);
        const hasPost = (posts?.data?.length ?? 0) > 0;
        const hasFollow = (following?.data?.length ?? 0) > 0;
        if (cancelled) return;
        if (hasPost || hasFollow) {
          await markOnboardingComplete();
          return;
        }
      } catch {
        // Detection failure → fall through to onboarding (safer default).
      }

      if (cancelled) return;
      router.replace('/onboarding/swipe' as any);
    })();
    return () => { cancelled = true; };
  }, [sdk, user?.id, router]);

  // Poll unread notification count
  const [unreadCount, setUnreadCount] = React.useState(0);
  React.useEffect(() => {
    if (!sdk) return;
    let active = true;
    const check = async () => {
      try {
        const res = await sdk.notifications.list({ limit: 20, organization_id: ORG_ID || undefined });
        if (active) {
          const unread = (res.data || []).filter((n: any) => !n.read && !n.is_read).length;
          setUnreadCount(unread);
        }
      } catch {}
    };
    check();
    const interval = setInterval(check, 60_000); // check every 60s
    return () => { active = false; clearInterval(interval); };
  }, [sdk]);

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
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
            <Tabs.Screen name="jobs" options={{ href: null }} />
            <Tabs.Screen name="post/[id]" options={{ href: null }} />
            <Tabs.Screen name="user/[username]" options={{ href: null }} />
            <Tabs.Screen name="community/[id]" options={{ href: null }} />
          </Tabs>
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
      <Tabs.Screen name="jobs" options={{ href: null }} />
      <Tabs.Screen name="post/[id]" options={{ href: null }} />
      <Tabs.Screen name="user/[username]" options={{ href: null }} />
      <Tabs.Screen name="community/[id]" options={{ href: null }} />
    </Tabs>
  );
}
