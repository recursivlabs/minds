import * as React from 'react';
import { TextInput, TextInputProps, View, Platform } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radius, typography } from '../constants/theme';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: Props) {
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
      {label ? (
        <Text variant="label" color={colors.textSecondary}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: error ? colors.error : focused ? colors.borderFocus : colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: 13,
            color: colors.text,
            ...typography.body,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <Text variant="caption" color={colors.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
