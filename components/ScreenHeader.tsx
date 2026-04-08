import * as React from 'react';
import { View, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { colors, spacing } from '../constants/theme';

interface Props {
  title: string;
  showBack?: boolean;
  right?: React.ReactNode;
}

/**
 * Consistent screen header used across all pages.
 * Same height, same padding, same border treatment.
 */
export const ScreenHeader = React.memo(function ScreenHeader({ title, showBack = true, right }: Props) {
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
        minHeight: 52,
      }}
    >
      {showBack && (
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => ({
            opacity: pressed ? 0.5 : 1,
            ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
          })}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      )}
      <Text variant="h3" style={{ flex: 1 }} numberOfLines={1}>{title}</Text>
      {right || null}
    </View>
  );
});
