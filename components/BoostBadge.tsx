import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { colors, spacing, radius } from '../constants/theme';

export function BoostBadge() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.boostMuted,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.full,
        alignSelf: 'flex-start',
      }}
    >
      <Ionicons name="rocket" size={12} color={colors.boost} />
      <Text variant="caption" color={colors.boost} style={{ fontSize: 11, fontWeight: '600' }}>
        Boosted
      </Text>
    </View>
  );
}
