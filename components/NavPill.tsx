import * as React from 'react';
import { View, Pressable, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useTheme } from '../lib/theme';
import { spacing } from '../constants/theme';

// Floating pill bottom nav (KEMPT-style) in Minds colors: a rounded raised
// bar with a soft gold glow behind the active tab. Icon-only — five
// self-explanatory glyphs. Rendered as a custom tabBar but NOT absolutely
// positioned: the wrapper occupies layout space so no screen content hides
// behind it (avoids auditing every screen for bottom padding).

const PILL_HEIGHT = 60;
const PILL_RADIUS = 30;

type IconSpec = { active: string; inactive: string; size: number };

const ICONS: Record<string, IconSpec> = {
  index: { active: 'home', inactive: 'home-outline', size: 25 },
  explore: { active: 'search', inactive: 'search-outline', size: 25 },
  create: { active: 'add-circle', inactive: 'add-circle-outline', size: 27 },
  chat: { active: 'chatbubble', inactive: 'chatbubble-outline', size: 24 },
  notifications: { active: 'notifications', inactive: 'notifications-outline', size: 25 },
};

export function NavPill({
  state,
  descriptors,
  navigation,
  badges = {},
}: BottomTabBarProps & { badges?: Record<string, number> }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  // A custom tabBar receives EVERY route — `href: null` no longer hides
  // anything, so filter to the five primary tabs explicitly.
  const routes = state.routes.filter((r) => ICONS[r.name]);
  const activeKey = state.routes[state.index]?.key;

  return (
    <View
      style={{
        paddingHorizontal: spacing.xl,
        paddingBottom: Math.max(insets.bottom, spacing.md),
        paddingTop: spacing.sm,
        backgroundColor: colors.bg,
      }}
    >
      <View
        style={{
          height: PILL_HEIGHT,
          borderRadius: PILL_RADIUS,
          backgroundColor: isDark ? colors.surfaceRaised : colors.surface,
          borderWidth: 0.5,
          borderColor: colors.borderSubtle,
          flexDirection: 'row',
          alignItems: 'center',
          overflow: 'hidden',
          // Soft lift so the pill reads as floating above the page.
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.45 : 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        {routes.map((route) => {
          const focused = route.key === activeKey;
          const icon = ICONS[route.name];
          const badge = badges[route.name] || 0;
          const label = (descriptors[route.key]?.options as any)?.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={label}
              onPress={onPress}
              style={{ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' }}
            >
              {/* Layered gold glow behind the active icon (no SVG dep —
                  concentric translucent circles + accent shadow). */}
              {focused && (
                <>
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: colors.accentSubtle,
                    }}
                  />
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: colors.accentMuted,
                      shadowColor: colors.accent,
                      shadowOpacity: 0.55,
                      shadowRadius: 14,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 0,
                    }}
                  />
                </>
              )}
              <View>
                <Ionicons
                  name={(focused ? icon.active : icon.inactive) as any}
                  size={icon.size}
                  color={focused ? colors.accent : colors.textMuted}
                />
                {badge > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -8,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      paddingHorizontal: 4,
                      backgroundColor: colors.error,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      variant="caption"
                      style={{ fontSize: 10, fontWeight: '700', color: '#fff', lineHeight: Platform.OS === 'ios' ? 12 : 14 }}
                    >
                      {badge > 99 ? '99+' : badge}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
