import * as React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { colors, spacing, radius } from '../constants/theme';

interface Props {
  children: React.ReactNode;
}

export function NSFWOverlay({ children }: Props) {
  const [revealed, setRevealed] = React.useState(false);

  if (revealed) {
    return <>{children}</>;
  }

  return (
    <View style={{ position: 'relative', overflow: 'hidden' }}>
      <View style={{ opacity: 0.05 }}>
        {children}
      </View>
      <Pressable
        onPress={() => setRevealed(true)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(9, 9, 11, 0.92)',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.md,
          gap: spacing.sm,
        }}
      >
        <Ionicons name="eye-off" size={28} color={colors.textMuted} />
        <Text variant="bodyMedium" color={colors.textSecondary}>
          This content is marked NSFW
        </Text>
        <View
          style={{
            backgroundColor: colors.surfaceHover,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: radius.md,
            marginTop: spacing.xs,
          }}
        >
          <Text variant="caption" color={colors.textSecondary}>
            Tap to reveal
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
