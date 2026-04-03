import { Pressable, ActivityIndicator, ViewStyle, Platform } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radius } from '../constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  children: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  accentColor?: string;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const sizeStyles: Record<Size, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { paddingVertical: 7, paddingHorizontal: 14, fontSize: 13 },
  md: { paddingVertical: 10, paddingHorizontal: 20, fontSize: 15 },
  lg: { paddingVertical: 13, paddingHorizontal: 24, fontSize: 15 },
};

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  accentColor,
  fullWidth = false,
  style,
}: Props) {
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  const bgColor =
    variant === 'primary'
      ? accentColor || colors.accent
      : variant === 'secondary'
        ? colors.glass
        : 'transparent';

  const textColor =
    variant === 'primary' ? colors.textInverse : colors.text;

  const borderColor =
    variant === 'secondary' ? colors.glassBorder : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          borderRadius: radius.sm,
          backgroundColor: bgColor,
          borderWidth: variant === 'secondary' ? 0.5 : 0,
          borderColor,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          flexDirection: 'row' as const,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          ...(fullWidth ? { width: '100%' as any } : {}),
          ...(Platform.OS === 'web'
            ? { cursor: isDisabled ? 'default' : 'pointer', transition: 'opacity 0.15s ease' }
            : {}),
        } as ViewStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text
          variant="bodyMedium"
          color={textColor}
          style={{ fontSize: s.fontSize }}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}
