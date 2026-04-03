import { View, ViewProps, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../constants/theme';

interface Props extends ViewProps {
  safeTop?: boolean;
  safeBottom?: boolean;
  padded?: boolean;
  centered?: boolean;
  maxWidth?: number;
}

export function Container({
  safeTop = false,
  safeBottom = false,
  padded = true,
  centered = false,
  maxWidth,
  style,
  children,
  ...props
}: Props) {
  const insets = useSafeAreaInsets();

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
    </View>
  );
}
