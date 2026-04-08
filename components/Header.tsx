import { View, Pressable, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { colors, spacing } from '../constants/theme';

interface Props {
  showBack?: boolean;
  title?: string;
}

export function Header({ showBack, title }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;

  if (isDesktop) {
    // Minimal desktop header — just page context, no logo/bell/avatar (all in sidebar)
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.xl,
          backgroundColor: colors.bg,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.borderSubtle,
          minHeight: 40,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {showBack && (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={{ marginRight: spacing.xs }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
            </Pressable>
          )}
          {title ? (
            <Text variant="bodyMedium" color={colors.textSecondary} style={{ fontSize: 14 }}>
              {title}
            </Text>
          ) : null}
        </View>
        <View />
      </View>
    );
  }

  // Mobile header — wordmark + notification bell
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.xl,
        backgroundColor: colors.bg,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {showBack && (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={{ marginRight: spacing.xs }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        )}
        {title ? (
          <Text variant="bodyMedium" style={{ fontWeight: '400' }}>{title}</Text>
        ) : (
          <Text
            variant="h2"
            color={colors.accent}
            style={{ letterSpacing: 5, fontWeight: '300' }}
          >
            minds
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <Pressable
          hitSlop={8}
          onPress={() => {
            // Notifications - no-op for now, navigates when ready
          }}
          style={{ position: 'relative' }}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.textMuted} />
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
        </Pressable>
      </View>
    </View>
  );
}
