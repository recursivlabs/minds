import { View, Pressable, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { spacing } from '../constants/theme';
import { useColors, useTheme } from '../lib/theme';
import { useSmartBack } from '../lib/navigation';
import { useMobileDrawer } from './MobileDrawer';

// Full Minds wordmark (theme-matched) — same assets the desktop SideNav uses.
const LOGO_DARK = require('../assets/logo-dark-mode.svg');
const LOGO_LIGHT = require('../assets/logo-light-mode.svg');

interface Props {
  showBack?: boolean;
  title?: string;
}

export function Header({ showBack, title }: Props) {
  const router = useRouter();
  const goBack = useSmartBack();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const colors = useColors();
  const { isDark } = useTheme();
  const drawer = useMobileDrawer();
  const isDesktop = Platform.OS === 'web' && width > 768;

  // Avatar opens the X-style drawer when mounted (native tabs layout);
  // outside the provider (narrow web) it falls back to the profile route.
  const onAvatarPress = () => {
    if (drawer) {
      drawer.open();
      return;
    }
    const slug = user?.username || user?.id;
    router.push(slug ? (`/(tabs)/user/${slug}` as any) : ('/(tabs)/profile' as any));
  };

  if (isDesktop) {
    // No back button and no title → nothing to show. Don't render an empty bar
    // (it was leaving a blank strip above the feed's For You/Following tabs).
    if (!showBack && !title) return null;
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
              onPress={goBack}
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

  // Mobile header — X layout: avatar (drawer) top-left, full wordmark
  // centered. Sub-screens keep back chevron + title on the left instead.
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
        minHeight: 48,
      }}
    >
      {/* Centered wordmark on root screens — absolutely positioned so it
          stays truly centered regardless of what sits left/right. */}
      {!title && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={isDark ? LOGO_DARK : LOGO_LIGHT}
            style={{ width: 78, height: 30 }}
            contentFit="contain"
            accessibilityLabel="Minds"
          />
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {showBack && (
          <Pressable
            onPress={goBack}
            hitSlop={12}
            style={{ marginRight: spacing.xs }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        )}
        {title ? (
          <Text variant="bodyMedium" style={{ fontWeight: '400' }}>{title}</Text>
        ) : (
          <Pressable hitSlop={8} onPress={onAvatarPress}>
            <Avatar uri={user?.image} name={user?.name} size="sm" />
          </Pressable>
        )}
      </View>

      {/* Sub-screens keep the avatar on the right (root screens have it on
          the left as the drawer trigger). */}
      {title ? (
        <Pressable hitSlop={8} onPress={onAvatarPress}>
          <Avatar uri={user?.image} name={user?.name} size="sm" />
        </Pressable>
      ) : (
        <View style={{ width: 32 }} />
      )}
    </View>
  );
}
