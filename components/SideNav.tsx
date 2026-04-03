import * as React from 'react';
import { View, Pressable, Platform, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { colors, spacing, radius } from '../constants/theme';

const COLLAPSED_WIDTH = 60;
const EXPANDED_WIDTH = 220;
const COLLAPSE_KEY = 'minds:sidebar:collapsed';

const NAV_ITEMS = [
  { name: 'index', label: 'Feed', icon: 'newspaper-outline' as const, activeIcon: 'newspaper' as const },
  { name: 'explore', label: 'Explore', icon: 'compass-outline' as const, activeIcon: 'compass' as const },
  { name: 'create', label: 'Create', icon: 'add-circle-outline' as const, activeIcon: 'add-circle' as const },
  { name: 'chat', label: 'Chat', icon: 'chatbubbles-outline' as const, activeIcon: 'chatbubbles' as const },
  { name: 'wallet', label: 'Wallet', icon: 'diamond-outline' as const, activeIcon: 'diamond' as const },
  { name: 'boost', label: 'Boost', icon: 'rocket-outline' as const, activeIcon: 'rocket' as const },
];

const BOTTOM_ITEMS = [
  { name: 'admin', label: 'Admin', icon: 'shield-outline' as const, activeIcon: 'shield' as const },
  { name: 'profile', label: 'Profile', icon: 'person-outline' as const, activeIcon: 'person' as const },
];

export function useSidebarState() {
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(COLLAPSE_KEY);
      if (saved === 'true') setCollapsed(true);
    }
  }, []);

  const toggle = React.useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.setItem(COLLAPSE_KEY, String(next));
      }
      return next;
    });
  }, []);

  return { collapsed, toggle, width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH };
}

interface SideNavProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SideNav({ collapsed, onToggle }: SideNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const isActive = (name: string) => {
    if (name === 'index') return pathname === '/' || pathname === '';
    return pathname.includes(name);
  };

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  const renderNavItem = (item: typeof NAV_ITEMS[0]) => {
    const active = isActive(item.name);
    return (
      <Pressable
        key={item.name}
        onPress={() => router.push(item.name === 'index' ? '/(tabs)' : `/(tabs)/${item.name}` as any)}
        style={({ pressed }) => ({
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          gap: spacing.md,
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: collapsed ? 0 : spacing.md,
          marginHorizontal: collapsed ? 0 : spacing.sm,
          borderRadius: radius.md,
          backgroundColor: active ? colors.accentSubtle : 'transparent',
          opacity: pressed ? 0.7 : 1,
          justifyContent: collapsed ? 'center' as const : 'flex-start' as const,
          ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } as any : {}),
        })}
      >
        <Ionicons
          name={active ? item.activeIcon : item.icon}
          size={20}
          color={active ? colors.accent : colors.textMuted}
        />
        {!collapsed && (
          <Text
            variant="body"
            color={active ? colors.accent : colors.textSecondary}
            style={{ fontSize: 14, fontWeight: active ? '500' : '300' }}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <View
      style={{
        width,
        backgroundColor: colors.bg,
        borderRightWidth: 0.5,
        borderRightColor: colors.borderSubtle,
        ...(Platform.OS === 'web' ? { transition: 'width 0.2s ease' } as any : {}),
      }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: spacing['3xl'],
          paddingBottom: spacing.xl,
          justifyContent: 'space-between',
          minHeight: '100%' as any,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top section */}
        <View>
          {/* Logo + collapse toggle */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'space-between',
              paddingHorizontal: collapsed ? 0 : spacing.lg,
              marginBottom: spacing['3xl'],
            }}
          >
            {collapsed ? (
              <Pressable onPress={onToggle} hitSlop={12}>
                <Text
                  variant="h2"
                  color={colors.accent}
                  style={{ fontSize: 18, letterSpacing: 2, fontWeight: '300' }}
                >
                  m
                </Text>
              </Pressable>
            ) : (
              <>
                <Pressable onPress={() => router.push('/(tabs)')}>
                  <Text
                    variant="h2"
                    color={colors.accent}
                    style={{ fontSize: 18, letterSpacing: 4, fontWeight: '300' }}
                  >
                    minds
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onToggle}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.5 : 0.4,
                    padding: 4,
                  })}
                >
                  <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
                </Pressable>
              </>
            )}
          </View>

          {/* Main nav */}
          <View style={{ gap: spacing.xs }}>
            {NAV_ITEMS.map(renderNavItem)}
          </View>
        </View>

        {/* Bottom section */}
        <View style={{ gap: spacing.xs, marginTop: spacing['3xl'] }}>
          {BOTTOM_ITEMS.map(renderNavItem)}

          {/* User */}
          {user && !collapsed && (
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              style={({ pressed }) => ({
                flexDirection: 'row' as const,
                alignItems: 'center' as const,
                gap: spacing.md,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.lg,
                marginTop: spacing.md,
                opacity: pressed ? 0.7 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Avatar uri={user.image} name={user.name} size="sm" />
              <View style={{ flex: 1 }}>
                <Text variant="caption" numberOfLines={1} style={{ fontWeight: '400' }}>
                  {user.name || user.username}
                </Text>
                <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 11 }}>
                  @{user.username}
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
