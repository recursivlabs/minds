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
          <Text variant="h3" style={{ fontWeight: '400' }}>{title}</Text>
        ) : !isDesktop ? (
          <Text
            variant="h2"
            color={colors.accent}
            style={{ letterSpacing: 5, fontWeight: '300' }}
          >
            minds
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <Pressable hitSlop={8}>
          <Ionicons name="notifications-outline" size={20} color={colors.textMuted} />
        </Pressable>
        {!isDesktop && (
          <Pressable onPress={() => router.push('/(tabs)/profile')}>
            <Avatar uri={user?.image} name={user?.name} size="sm" />
          </Pressable>
        )}
      </View>
    </View>
  );
}
