import * as React from 'react';
import { View, Image } from 'react-native';
import { Text } from './Text';
import { colors, radius } from '../constants/theme';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface Props {
  uri?: string | null;
  name?: string;
  size?: AvatarSize;
}

const sizes: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const fontSizes: Record<AvatarSize, number> = {
  xs: 10,
  sm: 12,
  md: 15,
  lg: 20,
  xl: 28,
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashColor(name?: string): string {
  if (!name) return colors.accent;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 50%, 40%)`;
}

export const Avatar = React.memo(function Avatar({ uri, name, size = 'md' }: Props) {
  const dim = sizes[size];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: dim,
          height: dim,
          borderRadius: radius.full,
          backgroundColor: colors.surfaceHover,
          borderWidth: 0.5,
          borderColor: colors.glassBorder,
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: dim,
        height: dim,
        borderRadius: radius.full,
        backgroundColor: hashColor(name),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.5,
        borderColor: colors.glassBorder,
      }}
    >
      <Text
        variant="bodyMedium"
        color="#fff"
        style={{ fontSize: fontSizes[size] }}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
});
