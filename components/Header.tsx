import { View, Pressable } from 'react-native';
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

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
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
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        )}
        {title ? (
          <Text variant="h3">{title}</Text>
        ) : (
          <Text
            variant="h2"
            color={colors.accent}
            style={{ letterSpacing: -1, fontWeight: '700' }}
          >
            minds
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <Pressable hitSlop={8}>
          <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={() => router.push('/(tabs)/profile')}>
          <Avatar uri={user?.image} name={user?.name} size="sm" />
        </Pressable>
      </View>
    </View>
  );
}
