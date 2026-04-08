import * as React from 'react';
import { View, Pressable, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { colors, spacing, radius } from '../constants/theme';

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

interface Props {
  content: string;
}

/**
 * Extracts the first URL from post content and renders it as a
 * tappable link card with domain and icon.
 */
export const LinkPreview = React.memo(function LinkPreview({ content }: Props) {
  const url = extractFirstUrl(content);
  if (!url) return null;

  const domain = getDomain(url);

  const handlePress = () => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener');
    } else {
      Linking.openURL(url);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginTop: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
      })}
    >
      <Ionicons name="link-outline" size={16} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text variant="caption" color={colors.accent} numberOfLines={1}>{domain}</Text>
        <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 11 }}>{url}</Text>
      </View>
      <Ionicons name="open-outline" size={14} color={colors.textMuted} />
    </Pressable>
  );
});
