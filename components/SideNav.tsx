import * as React from 'react';
import { View, Pressable, Platform, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { useConversations, useCommunities } from '../lib/hooks';
import { colors, spacing, radius } from '../constants/theme';

const COLLAPSED_WIDTH = 60;
const EXPANDED_WIDTH = 240;
const COLLAPSE_KEY = 'minds:sidebar:collapsed';

type NavItem = { name: string; label: string; icon: string; activeIcon: string };

const NAV_ITEMS: NavItem[] = [
  { name: 'index', label: 'Feed', icon: 'newspaper-outline', activeIcon: 'newspaper' },
  { name: 'explore', label: 'Explore', icon: 'compass-outline', activeIcon: 'compass' },
  { name: 'create', label: 'Create', icon: 'add-circle-outline', activeIcon: 'add-circle' },
  { name: 'wallet', label: 'Wallet', icon: 'diamond-outline', activeIcon: 'diamond' },
  { name: 'notifications', label: 'Notifications', icon: 'notifications-outline', activeIcon: 'notifications' },
];

const BOTTOM_ITEMS: NavItem[] = [
  { name: 'admin', label: 'Admin', icon: 'shield-outline', activeIcon: 'shield' },
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
  const { conversations } = useConversations();
  const { communities } = useCommunities(5);

  const isActive = (name: string) => {
    if (name === 'index') return pathname === '/' || pathname === '';
    if (name === 'notifications') return false; // no notifications tab yet
    return pathname.includes(name);
  };

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  // Combine recent DMs and communities for inbox
  const recentDMs = (conversations || []).slice(0, 4).map((c: any) => {
    const other = c.participants?.find((p: any) => p.id !== user?.id) || c.participants?.[0];
    return {
      id: c.id,
      type: 'dm' as const,
      name: c.name || other?.name || 'Conversation',
      avatar: other?.image || null,
      preview: c.lastMessage?.content || c.last_message?.content || '',
    };
  });
  const recentCommunities = (communities || []).slice(0, 3).map((c: any) => ({
    id: c.id,
    type: 'community' as const,
    name: c.name || 'Community',
    avatar: c.image || c.avatar || null,
    preview: `${c.memberCount || c.member_count || 0} members`,
  }));
  const inboxItems = [...recentDMs, ...recentCommunities];

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.name);
    const isNotifications = item.name === 'notifications';
    return (
      <Pressable
        key={item.name}
        onPress={() => {
          if (isNotifications) {
            // No notifications page yet — show coming soon
            if (Platform.OS === 'web') alert('Notifications coming soon');
            return;
          }
          router.push(item.name === 'index' ? '/(tabs)' : `/(tabs)/${item.name}` as any);
        }}
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
        <View style={{ position: 'relative' }}>
          <Ionicons
            name={(active ? item.activeIcon : item.icon) as any}
            size={20}
            color={active ? colors.accent : colors.textMuted}
          />
          {/* Gold dot badge for notifications */}
          {isNotifications && (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -4,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.accent,
              }}
            />
          )}
        </View>
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
        borderRightColor: 'rgba(255,255,255,0.06)',
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
              marginBottom: spacing['2xl'],
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
                    opacity: pressed ? 0.5 : 0.7,
                    padding: 6,
                    borderRadius: 6,
                    backgroundColor: pressed ? 'rgba(255,255,255,0.05)' : 'transparent',
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

          {/* Separator */}
          {!collapsed && (
            <View
              style={{
                height: 0.5,
                backgroundColor: 'rgba(255,255,255,0.06)',
                marginHorizontal: spacing.lg,
                marginVertical: spacing.xl,
              }}
            />
          )}

          {/* Inbox section — only when expanded */}
          {!collapsed && (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <Text
                variant="caption"
                color={colors.textMuted}
                style={{ fontSize: 11, fontWeight: '400', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing.md }}
              >
                Recent
              </Text>
              <ScrollView
                style={{ maxHeight: 240 }}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {inboxItems.length === 0 ? (
                  <Text variant="caption" color={colors.textMuted} style={{ paddingVertical: spacing.sm }}>
                    No recent activity
                  </Text>
                ) : (
                  inboxItems.map((item) => (
                    <Pressable
                      key={`${item.type}-${item.id}`}
                      onPress={() => {
                        if (item.type === 'dm') {
                          router.push({ pathname: '/(tabs)/chat', params: { id: item.id } } as any);
                        } else {
                          router.push(`/(tabs)/community/${item.id}` as any);
                        }
                      }}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.sm,
                        opacity: pressed ? 0.7 : 1,
                        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                      })}
                    >
                      <Avatar uri={item.avatar} name={item.name} size="xs" />
                      <View style={{ flex: 1 }}>
                        <Text
                          variant="caption"
                          numberOfLines={1}
                          style={{ fontWeight: '400', fontSize: 13 }}
                        >
                          {item.name}
                        </Text>
                        {item.preview ? (
                          <Text
                            variant="caption"
                            color={colors.textMuted}
                            numberOfLines={1}
                            style={{ fontSize: 11 }}
                          >
                            {item.preview}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Bottom section */}
        <View style={{ gap: spacing.xs, marginTop: spacing.xl }}>
          {BOTTOM_ITEMS.map(renderNavItem)}

          {/* User profile */}
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={({ pressed }) => ({
              flexDirection: 'row' as const,
              alignItems: 'center' as const,
              gap: spacing.md,
              paddingVertical: spacing.sm + 2,
              paddingHorizontal: collapsed ? 0 : spacing.md,
              marginHorizontal: collapsed ? 0 : spacing.sm,
              borderRadius: radius.md,
              backgroundColor: isActive('profile') ? colors.accentSubtle : 'transparent',
              opacity: pressed ? 0.7 : 1,
              justifyContent: collapsed ? 'center' as const : 'flex-start' as const,
              marginTop: spacing.xs,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Avatar uri={user?.image} name={user?.name} size="xs" />
            {!collapsed && (
              <View style={{ flex: 1 }}>
                <Text variant="caption" numberOfLines={1} style={{ fontWeight: '400' }}>
                  {user?.name || user?.username || 'Profile'}
                </Text>
                {user?.username && (
                  <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 11 }}>
                    @{user.username}
                  </Text>
                )}
              </View>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
