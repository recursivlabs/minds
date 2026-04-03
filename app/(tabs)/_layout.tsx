import { Tabs, useRouter, usePathname } from 'expo-router';
import { View, Pressable, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../constants/theme';
import { Text } from '../../components/Text';

const NAV_ITEMS = [
  { name: 'index', label: 'Feed', icon: 'newspaper-outline' as const, activeIcon: 'newspaper' as const },
  { name: 'explore', label: 'Explore', icon: 'compass-outline' as const, activeIcon: 'compass' as const },
  { name: 'create', label: 'Create', icon: 'add-circle-outline' as const, activeIcon: 'add-circle' as const },
  { name: 'chat', label: 'Chat', icon: 'chatbubbles-outline' as const, activeIcon: 'chatbubbles' as const },
  { name: 'profile', label: 'Profile', icon: 'person-outline' as const, activeIcon: 'person' as const },
];

function SideRail() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isActive = (name: string) => {
    if (name === 'index') return pathname === '/' || pathname === '';
    return pathname.includes(name);
  };

  return (
    <View
      style={{
        width: 64,
        backgroundColor: colors.bg,
        borderRightWidth: 0.5,
        borderRightColor: colors.borderSubtle,
        paddingTop: insets.top + spacing.xl,
        paddingBottom: insets.bottom + spacing.xl,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* Logo */}
      <Pressable onPress={() => router.push('/(tabs)')}>
        <Text
          variant="h2"
          color={colors.accent}
          style={{ fontSize: 16, letterSpacing: 3, fontWeight: '300' }}
        >
          m
        </Text>
      </Pressable>

      {/* Nav items */}
      <View style={{ gap: spacing.xl, alignItems: 'center' }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.name);
          return (
            <Pressable
              key={item.name}
              onPress={() => router.push(item.name === 'index' ? '/(tabs)' : `/(tabs)/${item.name}` as any)}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center' as const,
                justifyContent: 'center' as const,
                backgroundColor: active ? colors.accentSubtle : 'transparent',
                opacity: pressed ? 0.7 : 1,
                cursor: 'pointer' as any,
              })}
            >
              <Ionicons
                name={active ? item.activeIcon : item.icon}
                size={22}
                color={active ? colors.accent : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Bottom spacer */}
      <View />
    </View>
  );
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
        <SideRail />
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
            <Ionicons name="chatbubbles-outline" size={22} color={color} />
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
      <Tabs.Screen name="wallet" options={{ href: null }} />
      <Tabs.Screen name="boost" options={{ href: null }} />
      <Tabs.Screen name="discover" options={{ href: null }} />
      <Tabs.Screen name="admin" options={{ href: null }} />
      <Tabs.Screen name="post/[id]" options={{ href: null }} />
      <Tabs.Screen name="user/[username]" options={{ href: null }} />
      <Tabs.Screen name="community/[id]" options={{ href: null }} />
    </Tabs>
  );
}
