import { View, ViewProps, Platform } from 'react-native';
import { colors, spacing, radius, shadows } from '../constants/theme';

interface Props extends ViewProps {
  variant?: 'default' | 'raised' | 'ghost';
  padding?: keyof typeof spacing;
}

export function Card({ variant = 'default', padding = 'lg', style, ...props }: Props) {
  const bg =
    variant === 'raised'
      ? colors.surfaceRaised
      : variant === 'ghost'
        ? 'transparent'
        : colors.glass;

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          padding: spacing[padding],
          ...(variant !== 'ghost'
            ? { borderWidth: 0.5, borderColor: colors.glassBorder }
            : {}),
          ...(variant === 'raised' ? shadows.sm : {}),
          ...(Platform.OS === 'web' && variant !== 'ghost'
            ? { backdropFilter: 'blur(20px)' } as any
            : {}),
        },
        style,
      ]}
      {...props}
    />
  );
}
