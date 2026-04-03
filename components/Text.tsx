import { Text as RNText, TextProps, TextStyle } from 'react-native';
import { colors, typography } from '../constants/theme';

type Variant = keyof typeof typography;

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  align?: TextStyle['textAlign'];
}

export function Text({ variant = 'body', color, align, style, ...props }: Props) {
  return (
    <RNText
      style={[
        typography[variant],
        { color: color || (variant === 'caption' || variant === 'label' ? colors.textSecondary : colors.text) },
        align ? { textAlign: align } : undefined,
        style,
      ]}
      {...props}
    />
  );
}
