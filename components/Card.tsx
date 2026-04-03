import { View, ViewProps } from 'react-native';
import { colors, spacing, radius, shadows } from '../constants/theme';

interface Props extends ViewProps {
  variant?: 'default' | 'raised' | 'ghost';
  padding?: keyof typeof spacing;
}

export function Card({ variant = 'default', padding = '2xl', style, ...props }: Props) {
  const bg =
    variant === 'raised'
      ? colors.surfaceRaised
      : variant === 'ghost'
        ? 'transparent'
        : colors.surface;

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.lg,
          padding: spacing[padding],
          ...(variant !== 'ghost'
            ? { borderWidth: 1, borderColor: colors.borderSubtle }
            : {}),
          ...(variant === 'raised' ? shadows.sm : {}),
        },
        style,
      ]}
      {...props}
    />
  );
}
