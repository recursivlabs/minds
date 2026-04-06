import { View, ViewProps, Platform } from 'react-native';
import { colors, spacing, radius } from '../constants/theme';

interface Props extends ViewProps {
  variant?: 'default' | 'raised' | 'ghost';
  padding?: keyof typeof spacing;
}

export function Card({ variant = 'default', padding = 'lg', style, ...props }: Props) {
  const bg =
    variant === 'raised'
      ? 'rgba(255,255,255,0.03)'
      : variant === 'ghost'
        ? 'transparent'
        : 'rgba(255,255,255,0.03)';

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          padding: spacing[padding],
          ...(variant !== 'ghost'
            ? { borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' }
            : {}),
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
