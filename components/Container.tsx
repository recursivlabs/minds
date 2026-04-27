import { View, ViewProps, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import { spacing } from '../constants/theme';

interface Props extends ViewProps {
  safeTop?: boolean;
  safeBottom?: boolean;
  padded?: boolean;
  centered?: boolean;
  maxWidth?: number;
  /** Disable the on-screen keyboard avoidance wrapper. Default: enabled. */
  noAvoidKeyboard?: boolean;
}

export function Container({
  safeTop = false,
  safeBottom = false,
  padded = true,
  centered = false,
  maxWidth,
  noAvoidKeyboard = false,
  style,
  children,
  ...props
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const inner = (
    <View
      style={[
        {
          flex: 1,
          width: '100%',
          maxWidth: Platform.OS === 'web' ? maxWidth : undefined,
          alignSelf: 'center',
          ...(padded ? { paddingHorizontal: spacing.xl } : {}),
          ...(centered ? { alignItems: 'center', justifyContent: 'center' } : {}),
        },
      ]}
    >
      {children}
    </View>
  );

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: colors.bg,
          paddingTop: safeTop ? insets.top : 0,
          paddingBottom: safeBottom ? insets.bottom : 0,
        },
        style,
      ]}
      {...props}
    >
      {noAvoidKeyboard || Platform.OS === 'web' ? (
        inner
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={safeTop ? insets.top : 0}
        >
          {inner}
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
