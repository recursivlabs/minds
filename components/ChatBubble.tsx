import * as React from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radius } from '../constants/theme';

interface Props {
  message: any;
  isOwn: boolean;
}

export const ChatBubble = React.memo(function ChatBubble({ message, isOwn }: Props) {
  const content = message.content || message.text || message.body || '';
  const timestamp = message.createdAt || message.created_at || '';

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <View
      style={{
        alignSelf: isOwn ? 'flex-end' : 'flex-start',
        maxWidth: '80%',
        marginBottom: spacing.sm,
      }}
    >
      <View
        style={{
          backgroundColor: isOwn ? colors.accent : colors.surfaceRaised,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: radius.lg,
          borderBottomRightRadius: isOwn ? radius.sm : radius.lg,
          borderBottomLeftRadius: isOwn ? radius.lg : radius.sm,
        }}
      >
        <Text variant="body" color={isOwn ? '#fff' : colors.text}>
          {content}
        </Text>
      </View>
      {formattedTime ? (
        <Text
          variant="caption"
          color={colors.textMuted}
          style={{
            marginTop: spacing.xs,
            alignSelf: isOwn ? 'flex-end' : 'flex-start',
            fontSize: 11,
          }}
        >
          {formattedTime}
        </Text>
      ) : null}
    </View>
  );
});
