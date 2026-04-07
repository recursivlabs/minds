import { Tabs, useRouter, usePathname } from 'expo-router';
import { View, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../constants/theme';
import { SideNav, useSidebarState } from '../../components/SideNav';

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web';
  const sidebar = useSidebarState();

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
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 0.5,
          elevation: 0,
          height: 56,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '400',
          letterSpacing: 0.2,
        },
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
          title: 'Explore',
          tabBarIcon: ({ color }) => (
            <Ionicons name="compass-outline" size={22} color={color} />
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
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Tokens',
          tabBarIcon: ({ color }) => (
            <Ionicons name="bulb-outline" size={22} color={color} />
          ),
        }}
      />
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
  );
}
